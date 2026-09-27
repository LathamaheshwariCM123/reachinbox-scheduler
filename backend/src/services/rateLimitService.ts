import Redis from "ioredis";

const redis = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  }
);

const MAX_EMAILS_PER_HOUR = Number(
  process.env.MAX_EMAILS_PER_HOUR || 100
);

export async function checkHourlyRateLimit() {
  const key = `email-rate-limit:${new Date()
    .toISOString()
    .slice(0, 13)}`;

  /*
   * Atomically:
   *
   * 1. Increment the hourly counter
   * 2. Set expiry for a new counter
   * 3. Check whether the limit was exceeded
   * 4. Roll back the increment if necessary
   *
   * This prevents multiple workers from bypassing
   * the hourly limit at the same time.
   */

  const script = `
    local count = redis.call("INCR", KEYS[1])

    if count == 1 then
      redis.call("EXPIRE", KEYS[1], 3600)
    end

    if count > tonumber(ARGV[1]) then
      redis.call("DECR", KEYS[1])
      return {0, count - 1}
    end

    return {1, count}
  `;

  const result = (await redis.eval(
    script,
    1,
    key,
    MAX_EMAILS_PER_HOUR
  )) as [number, number];

  const allowed = result[0] === 1;
  const count = Number(result[1]);

  if (!allowed) {
    return {
      allowed: false,
      count,
      limit: MAX_EMAILS_PER_HOUR,
    };
  }

  return {
    allowed: true,
    count,
    limit: MAX_EMAILS_PER_HOUR,
  };
}