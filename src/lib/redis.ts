import { Redis } from "@upstash/redis";

// Helper to get the client lazily so Next.js build doesn't crash if env vars are misconfigured
export function getRedis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}
