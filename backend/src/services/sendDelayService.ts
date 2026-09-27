import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redis = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  }
);

export async function waitForSendSlot() {
  const minDelay = Number(
    process.env.MIN_EMAIL_DELAY_MS || 2000
  );

  const key = "email-send-throttle:last-send";

  while (true) {
    const now = Date.now();

    /*
     * Atomically:
     *
     * 1. Read the last send time
     * 2. Check whether enough time has passed
     * 3. Reserve the new send slot if available
     *
     * Return:
     *   1 = slot acquired
     *   0 = slot not available
     *   remaining milliseconds
     */

    const script = `
      local lastSend = redis.call("GET", KEYS[1])
      local now = tonumber(ARGV[1])
      local minDelay = tonumber(ARGV[2])

      if not lastSend then
        redis.call("SET", KEYS[1], ARGV[1])
        return {1, 0}
      end

      local elapsed = now - tonumber(lastSend)

      if elapsed >= minDelay then
        redis.call("SET", KEYS[1], ARGV[1])
        return {1, 0}
      end

      return {0, minDelay - elapsed}
    `;

    const result = (await redis.eval(
      script,
      1,
      key,
      now.toString(),
      minDelay.toString()
    )) as [number, number];

    const acquired = Number(result[0]) === 1;
    const remaining = Number(result[1]);

    if (acquired) {
      return;
    }

    /*
     * Wait until the next slot should become available.
     *
     * Add a small buffer to reduce unnecessary
     * Redis polling.
     */

    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.max(remaining, 100)
      )
    );
  }
}