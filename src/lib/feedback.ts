import { getRedis } from "@/lib/redis";

export type FeedbackVote = "up" | "down";

export type FeedbackEvent = {
  vote: FeedbackVote;
  question: string;
  answer: string;
  documentId: string | null;
  timestamp: string;
};

const FEEDBACK_LOG_KEY = "feedback:events";
const MAX_EVENTS = 500;

export async function logFeedbackEvent(event: FeedbackEvent) {
  const redis = getRedis();

  await redis.lpush(FEEDBACK_LOG_KEY, JSON.stringify(event));
  await redis.ltrim(FEEDBACK_LOG_KEY, 0, MAX_EVENTS - 1);
}
