const jwt = require("jsonwebtoken");

const prisma = require("../../config/prisma");
const { buildOpenApiSpec } = require("../../config/openapi");
const { getJwtSecret } = require("../../config/security");
const { getSystemAlerts } = require("../../services/alert.service");
const { getAuditLogs } = require("../../services/audit.service");
const { buildCacheKey, remember } = require("../../services/cache.service");
const { registerRealtimeClient } = require("../../services/realtime.service");
const { sendError, sendSuccess, handleControllerError } = require("../../utils/response");

const parseLimit = (value, fallback = 50, max = 200) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
};

const buildBaseUrl = (req) =>
  `${req.protocol}://${req.get("host")}`;

const buildDocsHtml = (req) => {
  const openApiUrl = `${buildBaseUrl(req)}/api/system/docs/openapi.json`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cafe Management API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #081018; }
      #swagger-ui { min-height: 100vh; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.SwaggerUIBundle({
          url: ${JSON.stringify(openApiUrl)},
          dom_id: '#swagger-ui',
          deepLinking: true,
          displayRequestDuration: true,
          persistAuthorization: true
        });
      };
    </script>
  </body>
</html>`;
};

const authenticateRealtimeRequest = (req) => {
  if (req.user) {
    return req.user;
  }

  const token = String(req.query?.token || "").trim();

  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    return null;
  }
};

exports.getSwaggerUi = async (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(buildDocsHtml(req));
};

exports.getOpenApiSpec = async (req, res) => {
  const baseUrl = buildBaseUrl(req);
  return res.status(200).json(buildOpenApiSpec(baseUrl));
};

exports.getAlerts = async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "open";
    const limit = parseLimit(req.query.limit, 40, 200);
    const cacheKey = buildCacheKey("system:alerts", status, limit);

    const alerts = await remember(cacheKey, 15 * 1000, async () =>
      getSystemAlerts({ status, limit })
    );

    return sendSuccess(res, 200, "System alerts retrieved successfully", {
      status,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    return handleControllerError(res, error, "Get system alerts error");
  }
};

exports.getAuditTrail = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 50, 200);
    const filters = {
      limit,
      from: req.query.from || null,
      to: req.query.to || null,
      action: req.query.action || null,
      entityType: req.query.entityType || null,
    };
    const cacheKey = buildCacheKey("system:audit", filters);
    const logs = await remember(cacheKey, 8 * 1000, async () => getAuditLogs(filters));

    return sendSuccess(res, 200, "Audit logs retrieved successfully", {
      count: logs.length,
      logs,
    });
  } catch (error) {
    return handleControllerError(res, error, "Get audit logs error");
  }
};

exports.streamRealtime = async (req, res) => {
  const user = authenticateRealtimeRequest(req);

  if (!user) {
    return sendError(res, 401, "Valid stream token is required");
  }

  const channels = String(req.query?.channels || "dashboard,orders,alerts,tables,inventory")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  registerRealtimeClient(req, res, channels);
  return undefined;
};

exports.downloadBackupSnapshot = async (req, res) => {
  try {
    const [
      users,
      categories,
      products,
      tables,
      orders,
      inventory,
      alerts,
      auditLogs,
    ] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.category.findMany(),
      prisma.product.findMany(),
      prisma.table.findMany(),
      prisma.order.findMany({
        include: {
          items: true,
        },
      }),
      prisma.inventory.findMany(),
      prisma.systemAlert.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
    ]);

    const snapshot = {
      generatedAt: new Date().toISOString(),
      users,
      categories,
      products,
      tables,
      orders,
      inventory,
      alerts,
      auditLogs,
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="cafe-system-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`
    );

    return res.status(200).send(JSON.stringify(snapshot, null, 2));
  } catch (error) {
    return handleControllerError(res, error, "Download backup snapshot error");
  }
};
