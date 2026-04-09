const { invalidateCacheByPrefix } = require("../services/cache.service");
const { queueAuditLogFromRequest } = require("../services/audit.service");
const {
  inferChannelsFromPath,
  publishRealtimeEvent,
} = require("../services/realtime.service");

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

module.exports = (req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const method = String(req.method || "").toUpperCase();
    const route = String(req.originalUrl || req.path || "");

    if (!MUTATING_METHODS.has(method)) {
      return;
    }

    invalidateCacheByPrefix("dashboard:");
    invalidateCacheByPrefix("system:");

    if (
      !route.includes("/api/auth/login") &&
      !route.includes("/api/auth/pos-login") &&
      !route.includes("/api/auth/register")
    ) {
      queueAuditLogFromRequest(req, res, {
        durationMs: Date.now() - startedAt,
      });
    }

    publishRealtimeEvent(inferChannelsFromPath(route), {
      type: "resource.changed",
      method,
      route,
      statusCode: res.statusCode,
    });
  });

  return next();
};
