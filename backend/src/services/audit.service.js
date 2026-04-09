const prisma = require("../config/prisma");

const SENSITIVE_KEYS = new Set([
  "password",
  "pin",
  "token",
  "authorization",
  "accessToken",
  "refreshToken",
]);

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : value ?? null;

const sanitizeValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((accumulator, [key, entryValue]) => {
      if (SENSITIVE_KEYS.has(String(key))) {
        accumulator[key] = "[redacted]";
        return accumulator;
      }

      accumulator[key] = sanitizeValue(entryValue);
      return accumulator;
    }, {});
  }

  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 497)}...`;
  }

  return value;
};

const inferEntityType = (req) => {
  const match = String(req.baseUrl || req.path || "")
    .replace(/^\/api\//, "")
    .match(/^([a-z-]+)/i);

  return match ? match[1] : null;
};

const inferEntityId = (req) =>
  normalizeText(
    req.params?.id ||
      req.params?.tableId ||
      req.params?.waiterId ||
      req.params?.token ||
      null
  );

const inferAction = (req) => {
  const method = String(req.method || "").toUpperCase();
  const entityType = inferEntityType(req) || "system";
  const path = String(req.originalUrl || "").toLowerCase();

  if (path.includes("/login")) {
    return "auth.login";
  }

  if (path.includes("/register")) {
    return "auth.register";
  }

  const actionByMethod = {
    POST: "create",
    PUT: "update",
    PATCH: "update",
    DELETE: "delete",
  };

  return `${entityType}.${actionByMethod[method] || method.toLowerCase()}`;
};

const summarizeRequest = (req, res) => {
  const entityType = inferEntityType(req) || "system";
  const method = String(req.method || "").toUpperCase();
  const statusCode = Number(res?.statusCode || 0);

  return `${method} ${entityType} -> ${statusCode}`;
};

const resolveIpAddress = (req) => {
  const forwardedFor = req.headers?.["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || null;
};

const createAuditLog = async (data) => {
  try {
    await prisma.auditLog.create({
      data,
    });
  } catch (error) {
    console.error("Audit log write error:", error);
  }
};

const queueAuditLogFromRequest = (req, res, extra = {}) => {
  const method = String(req.method || "").toUpperCase();

  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return;
  }

  const payload = {
    actorId: req.user?.id || null,
    actorName: normalizeText(req.user?.fullName),
    actorRole: normalizeText(req.user?.role),
    method,
    route: normalizeText(req.originalUrl || req.baseUrl || req.path || ""),
    action: inferAction(req),
    entityType: inferEntityType(req),
    entityId: inferEntityId(req),
    statusCode: Number(res.statusCode || 0),
    summary: summarizeRequest(req, res),
    ipAddress: resolveIpAddress(req),
    userAgent: normalizeText(req.headers?.["user-agent"]),
    payload: sanitizeValue({
      body: req.body,
      params: req.params,
      query: req.query,
      ...extra,
    }),
  };

  setImmediate(() => {
    createAuditLog(payload);
  });
};

const logManualAuditEvent = async ({
  actorId = null,
  actorName = null,
  actorRole = null,
  action,
  entityType = "auth",
  entityId = null,
  statusCode = 200,
  summary = null,
  ipAddress = null,
  userAgent = null,
  payload = null,
}) =>
  createAuditLog({
    actorId,
    actorName,
    actorRole,
    method: "POST",
    route: entityType,
    action,
    entityType,
    entityId: entityId ? String(entityId) : null,
    statusCode,
    summary,
    ipAddress,
    userAgent,
    payload: sanitizeValue(payload),
  });

const getAuditLogs = async ({
  limit = 50,
  from = null,
  to = null,
  action = null,
  entityType = null,
}) => {
  const where = {
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
  };

  return prisma.auditLog.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    take: Math.min(Math.max(Number(limit) || 50, 1), 200),
  });
};

module.exports = {
  getAuditLogs,
  logManualAuditEvent,
  queueAuditLogFromRequest,
  sanitizeValue,
};
