type RateLimiterOptions = {
  maxAttempts: number;
  windowMs: number;
  now?: () => number;
};

type AttemptWindow = {
  count: number;
  resetAt: number;
};

export function createRateLimiter({
  maxAttempts,
  windowMs,
  now = Date.now,
}: RateLimiterOptions) {
  const attempts = new Map<string, AttemptWindow>();

  return {
    check(key: string): { allowed: boolean; retryAfterSeconds: number } {
      const currentTime = now();
      const current = attempts.get(key);

      if (!current || currentTime >= current.resetAt) {
        attempts.set(key, {
          count: 1,
          resetAt: currentTime + windowMs,
        });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      if (current.count >= maxAttempts) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((current.resetAt - currentTime) / 1_000),
          ),
        };
      }

      current.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
