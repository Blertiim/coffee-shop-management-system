const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const path = require("path");

const prisma = require("../../config/prisma");
const { buildOpenApiSpec } = require("../../config/openapi");
const { getJwtSecret, isProductionEnv } = require("../../config/security");
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

const isEnabledValue = (value) => String(value || "").trim().toLowerCase() === "true";

const areDocsEnabled = () => !isProductionEnv() || isEnabledValue(process.env.API_DOCS_ENABLED);

const getDocsCredentials = () => ({
  username: String(process.env.API_DOCS_USERNAME || "").trim(),
  password: String(process.env.API_DOCS_PASSWORD || ""),
});

const safeCompare = (actual, expected) => {
  const actualBuffer = Buffer.from(String(actual || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));

  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
};

const parseBasicAuth = (authorization = "") => {
  const [scheme, encodedCredentials] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "basic" || !encodedCredentials) {
    return null;
  }

  const decoded = Buffer.from(encodedCredentials, "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex < 0) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
};

const buildDocsHtml = () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cafe Management API Docs</title>
    <link rel="stylesheet" href="/api/system/docs/assets/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api/system/docs/assets/swagger-ui-bundle.js"></script>
    <script src="/api/system/docs/swagger-init.js"></script>
  </body>
</html>`;

const buildDocsInitJs = () => `"use strict";

window.addEventListener("load", () => {
  window.SwaggerUIBundle({
    url: "/api/system/docs/openapi.json",
    dom_id: "#swagger-ui",
    deepLinking: true,
    displayRequestDuration: true,
    persistAuthorization: false
  });
});
`;

const buildApiCatalogHtml = () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API Catalog</title>
    <link rel="stylesheet" href="/api/system/api-catalog.css" />
  </head>
  <body>
    <main class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Cafe Management System</p>
          <h1>API Catalog</h1>
        </div>
        <a class="docs-link" href="/api/system/docs">Swagger Docs</a>
      </header>

      <section class="search-panel" aria-label="Search APIs">
        <input id="searchInput" type="search" placeholder="Search: banak, dashboard, invoice, stock..." autocomplete="off" />
        <div id="tagFilters" class="tag-filters" aria-label="API groups"></div>
      </section>

      <section id="flowSummary" class="flow-summary" aria-label="API flows"></section>
      <section id="apiList" class="api-list" aria-label="API endpoints"></section>
      <p id="emptyState" class="empty-state" hidden>No APIs match that search.</p>
    </main>
    <script src="/api/system/api-catalog.js"></script>
  </body>
</html>`;

const buildApiCatalogCss = () => `
:root {
  color-scheme: dark;
  --bg: #071814;
  --panel: #0d2a24;
  --panel-soft: #12382f;
  --line: rgba(163, 255, 211, 0.18);
  --text: #eefdf7;
  --muted: #a8c9bd;
  --accent: #8ee9bc;
  --blue: #89c6ff;
  --orange: #ffc36b;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 48px; }
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.eyebrow { margin: 0 0 6px; color: var(--accent); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
h1 { margin: 0; font-size: clamp(30px, 5vw, 52px); line-height: 1; }
.docs-link, .code-button, .api-button {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 12px;
  color: var(--text);
  text-decoration: none;
  background: rgba(255,255,255,0.07);
  font-weight: 700;
}
.search-panel { display: grid; gap: 12px; position: sticky; top: 0; z-index: 2; padding: 14px 0; background: var(--bg); }
#searchInput {
  width: 100%;
  min-height: 52px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  padding: 0 16px;
  font-size: 16px;
  outline: none;
}
#searchInput:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(142,233,188,0.12); }
.tag-filters { display: flex; flex-wrap: wrap; gap: 8px; }
.tag-filter {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--muted);
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 700;
}
.tag-filter.active { background: var(--accent); color: #062019; border-color: transparent; }
.flow-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin: 10px 0 16px; }
.flow-card, .api-card {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
}
.flow-card { padding: 14px; }
.flow-title { margin: 0 0 6px; font-weight: 800; }
.flow-text { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
.api-list { display: grid; gap: 10px; }
.api-card { padding: 14px; }
.api-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.method {
  min-width: 64px;
  border-radius: 7px;
  padding: 6px 8px;
  text-align: center;
  font-size: 12px;
  font-weight: 900;
  color: #061812;
  background: var(--accent);
}
.method.POST { background: var(--blue); }
.method.PUT, .method.PATCH { background: var(--orange); }
.method.DELETE { background: #ff8e8e; }
.path { margin: 0; word-break: break-word; font-family: Consolas, "SFMono-Regular", monospace; font-size: 15px; }
.summary { margin: 8px 0 0; color: var(--muted); line-height: 1.45; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.pill { border: 1px solid var(--line); border-radius: 999px; padding: 5px 8px; color: var(--muted); font-size: 12px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.code-path { margin: 10px 0 0; color: var(--muted); font-family: Consolas, "SFMono-Regular", monospace; font-size: 12px; word-break: break-word; }
.empty-state { margin: 28px 0 0; color: var(--muted); text-align: center; }
@media (max-width: 640px) {
  .shell { width: min(100% - 20px, 1180px); padding-top: 18px; }
  .topbar, .api-head { flex-direction: column; align-items: stretch; }
}
`;

const buildApiCatalogJs = (req) => {
  const workspaceRoot = path.resolve(__dirname, "../../../..").replace(/\\/g, "/");
  const openApiUrl = `${buildBaseUrl(req)}/api/system/docs/openapi.json`;

  return `"use strict";

const workspaceRoot = ${JSON.stringify(workspaceRoot)};
const openApiUrl = ${JSON.stringify(openApiUrl)};
const state = { endpoints: [], activeTag: "All", query: "" };

const flowHints = {
  "POS to Dashboard": "APIs that connect banak/POS activity with manager dashboard totals, orders, invoices, and realtime updates.",
  "Stock and Invoices": "Incoming invoices, products, stock alerts, and supplier flows.",
  "Guest Ordering": "QR table access, public menu, and guest order submission.",
  "Staff and Tables": "Waiters, table assignment, and operational setup."
};

const methodOrder = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const slugOperation = (method, apiPath) =>
  method.toLowerCase() + apiPath.replace(/^\\/api\\//, "").replace(/[{}]/g, "").split("/").map((part) => part || "root").join("-");

const normalize = (value) => String(value || "").toLowerCase();
const codeHref = (code) => {
  if (!code || !code.file) return "";
  const suffix = code.line ? ":" + code.line : "";
  return "vscode://file/" + workspaceRoot + "/" + code.file + suffix;
};

const swaggerHref = (endpoint) => "/api/system/docs#/" + encodeURIComponent(endpoint.tag) + "/" + slugOperation(endpoint.method, endpoint.path);

const collectSearchText = (endpoint) =>
  [endpoint.method, endpoint.path, endpoint.tag, endpoint.summary, endpoint.flow, endpoint.code?.file, ...(endpoint.keywords || [])]
    .map(normalize)
    .join(" ");

const flattenSpec = (spec) => {
  const endpoints = [];
  Object.entries(spec.paths || {}).forEach(([apiPath, operations]) => {
    methodOrder.forEach((method) => {
      const operation = operations[method.toLowerCase()];
      if (!operation) return;
      endpoints.push({
        method,
        path: apiPath,
        tag: operation.tags?.[0] || "Other",
        summary: operation.summary || "",
        flow: operation["x-flow"] || "General",
        keywords: operation["x-keywords"] || [],
        code: operation["x-code"] || null,
        secured: Boolean(operation.security?.length)
      });
    });
  });
  return endpoints;
};

const renderTags = () => {
  const tags = ["All", ...Array.from(new Set(state.endpoints.map((endpoint) => endpoint.tag))).sort()];
  const host = document.getElementById("tagFilters");
  host.replaceChildren(...tags.map((tag) => {
    const button = document.createElement("button");
    button.className = "tag-filter" + (state.activeTag === tag ? " active" : "");
    button.type = "button";
    button.textContent = tag;
    button.addEventListener("click", () => {
      state.activeTag = tag;
      render();
    });
    return button;
  }));
};

const renderFlows = (items) => {
  const flowHost = document.getElementById("flowSummary");
  const flows = Array.from(new Set(items.map((endpoint) => endpoint.flow))).filter(Boolean).slice(0, 4);
  flowHost.replaceChildren(...flows.map((flow) => {
    const card = document.createElement("article");
    card.className = "flow-card";
    const title = document.createElement("p");
    title.className = "flow-title";
    title.textContent = flow;
    const text = document.createElement("p");
    text.className = "flow-text";
    text.textContent = flowHints[flow] || "Related API endpoints for this part of the system.";
    card.append(title, text);
    return card;
  }));
};

const renderEndpoint = (endpoint) => {
  const card = document.createElement("article");
  card.className = "api-card";

  const head = document.createElement("div");
  head.className = "api-head";
  const pathWrap = document.createElement("div");
  const pathText = document.createElement("p");
  pathText.className = "path";
  pathText.textContent = endpoint.path;
  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent = endpoint.summary;
  pathWrap.append(pathText, summary);

  const method = document.createElement("span");
  method.className = "method " + endpoint.method;
  method.textContent = endpoint.method;
  head.append(pathWrap, method);

  const meta = document.createElement("div");
  meta.className = "meta";
  [endpoint.tag, endpoint.flow, endpoint.secured ? "Auth required" : "Public"].forEach((value) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = value;
    meta.appendChild(pill);
  });

  const actions = document.createElement("div");
  actions.className = "actions";
  const api = document.createElement("a");
  api.className = "api-button";
  api.href = swaggerHref(endpoint);
  api.textContent = "Open API";
  actions.appendChild(api);

  if (endpoint.code?.file) {
    const code = document.createElement("a");
    code.className = "code-button";
    code.href = codeHref(endpoint.code);
    code.textContent = "Open code";
    actions.appendChild(code);
  }

  const codePath = document.createElement("p");
  codePath.className = "code-path";
  codePath.textContent = endpoint.code?.file ? endpoint.code.file + (endpoint.code.line ? ":" + endpoint.code.line : "") : "";

  card.append(head, meta, actions);
  if (codePath.textContent) card.appendChild(codePath);
  return card;
};

const render = () => {
  const query = normalize(state.query);
  const items = state.endpoints.filter((endpoint) => {
    const matchesTag = state.activeTag === "All" || endpoint.tag === state.activeTag;
    const matchesQuery = !query || collectSearchText(endpoint).includes(query);
    return matchesTag && matchesQuery;
  });
  renderTags();
  renderFlows(items);
  document.getElementById("apiList").replaceChildren(...items.map(renderEndpoint));
  document.getElementById("emptyState").hidden = items.length > 0;
};

document.getElementById("searchInput").addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

fetch(openApiUrl)
  .then((response) => response.json())
  .then((spec) => {
    state.endpoints = flattenSpec(spec);
    render();
  })
  .catch(() => {
    document.getElementById("emptyState").hidden = false;
    document.getElementById("emptyState").textContent = "Could not load OpenAPI spec.";
  });
`;
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
  res.status(200).send(buildDocsHtml());
};

exports.getSwaggerInitScript = async (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.status(200).send(buildDocsInitJs());
};

exports.getOpenApiSpec = async (req, res) => {
  const baseUrl = buildBaseUrl(req);
  return res.status(200).json(buildOpenApiSpec(baseUrl));
};

exports.getApiCatalog = async (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(buildApiCatalogHtml());
};

exports.getApiCatalogCss = async (req, res) => {
  res.setHeader("Content-Type", "text/css; charset=utf-8");
  res.status(200).send(buildApiCatalogCss());
};

exports.getApiCatalogJs = async (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.status(200).send(buildApiCatalogJs(req));
};

exports.requireDocsAccess = (req, res, next) => {
  if (areDocsEnabled()) {
    if (!isProductionEnv()) {
      return next();
    }

    const expectedCredentials = getDocsCredentials();

    if (!expectedCredentials.username || !expectedCredentials.password) {
      return sendError(res, 404, "API documentation is not available");
    }

    const providedCredentials = parseBasicAuth(req.get("authorization"));

    if (
      providedCredentials &&
      safeCompare(providedCredentials.username, expectedCredentials.username) &&
      safeCompare(providedCredentials.password, expectedCredentials.password)
    ) {
      return next();
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="API Documentation"');
    return sendError(res, 401, "API documentation authentication required");
  }

  return sendError(res, 404, "API documentation is not available");
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
