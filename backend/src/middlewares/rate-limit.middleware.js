const { sendError } = require("../utils/response");

const buckets = new Map();

const cleanupExpiredBuckets = () => {
  const now = Date.now();

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

const cleanupInterval = setInterval(cleanupExpiredBuckets, 60 * 1000);

if (typeof cleanupInterval.unref === "function") {
  cleanupInterval.unref();
}

const defaultKeyGenerator = (req) => req.ip || req.headers["x-forwarded-for"] || "unknown";

const createRateLimiter = ({
  windowMs,
  max,
  message = "Too many requests. Please try again later.",
  keyGenerator = defaultKeyGenerator,
}) => {
  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    throw new Error("createRateLimiter requires a positive integer windowMs");
  }

  if (!Number.isInteger(max) || max <= 0) {
    throw new Error("createRateLimiter requires a positive integer max");
  }

  return (req, res, next) => {
    const now = Date.now();
    const scopeKey = `${req.baseUrl || ""}:${req.path || ""}:${keyGenerator(req)}`;
    const existingBucket = buckets.get(scopeKey);

    const bucket =
      existingBucket && existingBucket.resetAt > now
        ? existingBucket
        : {
            count: 0,
            resetAt: now + windowMs,
          };

    bucket.count += 1;
    buckets.set(scopeKey, bucket);

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)))
      );

      return sendError(res, 429, message);
    }

    return next();
  };
};

module.exports = {
  createRateLimiter,
};
