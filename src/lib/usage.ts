import { getRedis } from "@/lib/redis";

export type UsageRoute = "chat" | "upload";

export type UsageEvent = {
  route: UsageRoute;
  latencyMs: number;
  timestamp: string;
};

const USAGE_LOG_KEY = "usage:events";
const MAX_EVENTS = 500;

export async function logUsageEvent(event: UsageEvent) {
  const redis = getRedis();

  await redis.lpush(USAGE_LOG_KEY, JSON.stringify(event));
  await redis.ltrim(USAGE_LOG_KEY, 0, MAX_EVENTS - 1);
}

export type UsageSummary = {
  totalRequests: number;
  byRoute: Record<UsageRoute, number>;
  averageLatencyMs: number;
  recentEvents: UsageEvent[];
};

export async function getUsageSummary(limit = 20): Promise<UsageSummary> {
  const redis = getRedis();
  const raw = await redis.lrange<string>(USAGE_LOG_KEY, 0, MAX_EVENTS - 1);

  const events = raw
    .map((entry) => {
      try {
        return typeof entry === "string"
          ? (JSON.parse(entry) as UsageEvent)
          : (entry as unknown as UsageEvent);
      } catch {
        return null;
      }
    })
    .filter((event): event is UsageEvent => event !== null);

  const byRoute: Record<UsageRoute, number> = { chat: 0, upload: 0 };
  let latencyTotal = 0;

  for (const event of events) {
    byRoute[event.route] = (byRoute[event.route] ?? 0) + 1;
    latencyTotal += event.latencyMs;
  }

  return {
    totalRequests: events.length,
    byRoute,
    averageLatencyMs: events.length ? Math.round(latencyTotal / events.length) : 0,
    recentEvents: events.slice(0, limit),
  };
}
