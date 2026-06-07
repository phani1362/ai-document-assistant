import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";

let chatLimiter: Ratelimit | null = null;
let uploadLimiter: Ratelimit | null = null;

function getChatLimiter() {
  chatLimiter ??= new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "ratelimit:chat",
  });

  return chatLimiter;
}

function getUploadLimiter() {
  uploadLimiter ??= new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "5 m"),
    prefix: "ratelimit:upload",
  });

  return uploadLimiter;
}

export function getRequestIdentifier(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  return forwardedFor?.split(",")[0]?.trim() || "anonymous";
}

export async function checkChatRateLimit(identifier: string) {
  return getChatLimiter().limit(identifier);
}

export async function checkUploadRateLimit(identifier: string) {
  return getUploadLimiter().limit(identifier);
}
