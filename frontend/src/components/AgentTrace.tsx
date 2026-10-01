import type { AgentStep } from "@/lib/backend";

const AGENT_LABELS: Record<string, string> = {
  input_guard: "Input guard",
  router: "Router",
  planner: "Planner",
  retriever: "Retriever",
  assembler: "Assembler",
  grader: "Evidence grader",
  synthesizer: "Synthesizer",
  verifier: "Verifier",
  abstain: "Abstain",
  output_guard: "Output guard",
};

function tone(step: AgentStep): string {
  if (step.detail.startsWith("Blocked")) {
    return "bg-orange-500";
  }
  if (step.agent === "abstain" || step.detail.startsWith("Sources don't") || step.detail.startsWith("Evidence insufficient")) {
    return "bg-amber-400";
  }
  if (step.agent.endsWith("guard")) {
    return "bg-emerald-500";
  }
  return "bg-blue-500";
}

type AgentTraceProps = {
  steps: AgentStep[];
  running: boolean;
};

export function AgentTrace({ steps, running }: AgentTraceProps) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">Agent trace</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Each agent&apos;s decision for the latest question, streamed live.
          </p>
        </div>
        {running ? (
          <span className="mt-1 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        ) : null}
      </div>

      {steps.length === 0 && !running ? (
        <p className="rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          Ask a question to watch the guards, router, retriever, grader, synthesizer, and
          verifier work.
        </p>
      ) : (
        <ol className="relative space-y-3 border-l border-slate-200 pl-5 dark:border-slate-700">
          {steps.map((step, index) => (
            <li className="animate-fade-up relative" key={`${step.agent}-${index}`}>
              <span
                className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-slate-900 ${tone(step)}`}
              />
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                {AGENT_LABELS[step.agent] ?? step.agent}
              </p>
              <p className="mt-0.5 break-words text-sm leading-6 text-slate-800 dark:text-slate-200">
                {step.detail}
              </p>
            </li>
          ))}
          {running ? (
            <li className="relative">
              <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 animate-pulse rounded-full bg-slate-300 ring-4 ring-white dark:bg-slate-600 dark:ring-slate-900" />
              <p className="text-sm text-slate-400">Working…</p>
            </li>
          ) : null}
        </ol>
      )}
    </section>
  );
}
