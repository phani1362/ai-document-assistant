import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  createChatCompletion,
  createEmbeddings,
  type ChatMessage,
} from "@/lib/embeddings";
import {
  retrieveWithRankFusion,
  type RetrievedChunk,
} from "@/lib/retrieval";

const MAX_REWRITES = 3;
const FINAL_SOURCE_COUNT = 6;

export type AgentStep = {
  stage: "planning" | "retrieving" | "evaluating" | "correcting" | "answering";
  label: string;
};

type QueryPlan = { intent: string; queries: string[] };
type EvidenceAssessment = {
  sufficient: boolean;
  reason: string;
  followUpQuery?: string;
};

const RagState = Annotation.Root({
  question: Annotation<string>,
  history: Annotation<ChatMessage[]>({
    default: () => [],
    reducer: (_, value) => value,
  }),
  documentId: Annotation<string | undefined>,
  plan: Annotation<QueryPlan>({
    default: () => ({ intent: "", queries: [] }),
    reducer: (_, value) => value,
  }),
  embeddings: Annotation<number[][]>({
    default: () => [],
    reducer: (_, value) => value,
  }),
  chunks: Annotation<RetrievedChunk[]>({
    default: () => [],
    reducer: (_, value) => value,
  }),
  assessment: Annotation<EvidenceAssessment>({
    default: () => ({
      sufficient: false,
      reason: "Evidence has not been graded.",
    }),
    reducer: (_, value) => value,
  }),
  answerPrompt: Annotation<string>({
    default: () => "",
    reducer: (_, value) => value,
  }),
});

function parseJsonObject<T>(value: string): T | null {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate =
    fenced ?? value.slice(value.indexOf("{"), value.lastIndexOf("}") + 1);

  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

function formatEvidence(chunks: RetrievedChunk[]) {
  return chunks
    .map((chunk, index) => {
      const location = chunk.page
        ? `page ${chunk.page}`
        : `chunk ${chunk.index + 1}`;
      return `[Source ${index + 1}] (${chunk.fileName}, ${location}):\n${chunk.text}`;
    })
    .join("\n\n");
}

/** Build a request-scoped graph so callbacks cannot leak across requests. */
function createRagGraph(onStep?: (step: AgentStep) => void) {
  const plannerAgent = async (state: typeof RagState.State) => {
    onStep?.({
      stage: "planning",
      label: "Planner agent is rewriting the question",
    });
    const recentConversation = state.history
      .slice(-4)
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");
    const rawPlan = await createChatCompletion({
      systemPrompt:
        "You are the planner agent in a document RAG graph. Resolve references from conversation history. Return only JSON with intent (short string) and queries (1-3 diverse, standalone search queries). Preserve names, dates, and identifiers exactly. Do not answer the question.",
      userPrompt: `Conversation:\n${recentConversation || "(none)"}\n\nQuestion:\n${state.question}`,
    });
    const parsed = parseJsonObject<QueryPlan>(rawPlan);
    const rewrites = Array.isArray(parsed?.queries)
      ? parsed.queries
          .filter(
            (query): query is string =>
              typeof query === "string" && query.trim().length > 0,
          )
          .map((query) => query.trim())
          .slice(0, MAX_REWRITES)
      : [];

    return {
      plan: {
        intent: parsed?.intent?.trim() || state.question,
        queries: Array.from(new Set([state.question, ...rewrites])).slice(
          0,
          MAX_REWRITES,
        ),
      },
    };
  };

  const retrievalAgent = async (state: typeof RagState.State) => {
    onStep?.({
      stage: "retrieving",
      label: `Retriever agent is searching ${state.plan.queries.length} semantic view${state.plan.queries.length === 1 ? "" : "s"}`,
    });
    const embeddings = await createEmbeddings(state.plan.queries);
    const chunks = await retrieveWithRankFusion(
      embeddings,
      FINAL_SOURCE_COUNT,
      state.documentId,
    );
    return { embeddings, chunks };
  };

  const evidenceGraderAgent = async (state: typeof RagState.State) => {
    onStep?.({
      stage: "evaluating",
      label: "Evidence grader agent is checking coverage",
    });
    const rawAssessment = await createChatCompletion({
      systemPrompt:
        "You are the evidence grader agent in a corrective-RAG graph. Decide whether the excerpts contain enough information to answer faithfully. Return only JSON: {\"sufficient\": boolean, \"reason\": \"short explanation\", \"followUpQuery\": \"standalone search query when insufficient\"}. Do not use outside knowledge or answer the question.",
      userPrompt: `Question:\n${state.question}\n\nEvidence:\n${formatEvidence(state.chunks)}`,
    });
    const parsed = parseJsonObject<EvidenceAssessment>(rawAssessment);

    return {
      assessment: {
        sufficient:
          parsed?.sufficient ??
          state.chunks.some((chunk) => chunk.score >= 0.7),
        reason:
          parsed?.reason?.trim() ||
          "Evidence was graded using retrieval confidence.",
        followUpQuery: parsed?.followUpQuery?.trim() || undefined,
      },
    };
  };

  const correctiveRetrieverAgent = async (state: typeof RagState.State) => {
    onStep?.({
      stage: "correcting",
      label: "Corrective retriever agent is filling an evidence gap",
    });
    const query = state.assessment.followUpQuery || state.question;
    const [correctiveEmbedding] = await createEmbeddings([query]);
    const embeddings = [...state.embeddings, correctiveEmbedding];
    const chunks = await retrieveWithRankFusion(
      embeddings,
      FINAL_SOURCE_COUNT,
      state.documentId,
    );
    return { embeddings, chunks };
  };

  const answerAgent = (state: typeof RagState.State) => {
    onStep?.({
      stage: "answering",
      label: "Answer agent is preparing grounded citations",
    });
    return {
      answerPrompt: `Question:\n${state.question}\n\nRetrieval intent:\n${state.plan.intent}\n\nEvidence grade:\n${state.assessment.reason}\n\nSources:\n${formatEvidence(state.chunks)}`,
    };
  };

  return new StateGraph(RagState)
    .addNode("planner_agent", plannerAgent)
    .addNode("retrieval_agent", retrievalAgent)
    .addNode("evidence_grader_agent", evidenceGraderAgent)
    .addNode("corrective_retriever_agent", correctiveRetrieverAgent)
    .addNode("answer_agent", answerAgent)
    .addEdge(START, "planner_agent")
    .addEdge("planner_agent", "retrieval_agent")
    .addEdge("retrieval_agent", "evidence_grader_agent")
    .addConditionalEdges(
      "evidence_grader_agent",
      (state) =>
        !state.assessment.sufficient && state.assessment.followUpQuery
          ? "corrective_retriever_agent"
          : "answer_agent",
      ["corrective_retriever_agent", "answer_agent"],
    )
    .addEdge("corrective_retriever_agent", "answer_agent")
    .addEdge("answer_agent", END)
    .compile();
}

export async function runAgenticRetrieval({
  question,
  history,
  documentId,
  onStep,
}: {
  question: string;
  history: ChatMessage[];
  documentId?: string;
  onStep?: (step: AgentStep) => void;
}) {
  const graph = createRagGraph(onStep);
  return graph.invoke(
    { question, history, documentId },
    { recursionLimit: 8 },
  );
}
