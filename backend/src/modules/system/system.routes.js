const express = require("express");
const path = require("path");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOnly, adminOrManager } = require("../../middlewares/role.middleware");
const systemController = require("./system.controller");

const router = express.Router();
const swaggerUiAssetPath = path.dirname(require.resolve("swagger-ui-dist/package.json"));

router.use(
  "/docs/assets",
  systemController.requireDocsAccess,
  express.static(swaggerUiAssetPath, {
    index: false,
    immutable: true,
    maxAge: "1d",
  })
);
router.get("/docs", systemController.requireDocsAccess, systemController.getSwaggerUi);
router.get(
  "/docs/swagger-init.js",
  systemController.requireDocsAccess,
  systemController.getSwaggerInitScript
);
router.get("/docs/openapi.json", systemController.requireDocsAccess, systemController.getOpenApiSpec);
router.get("/api-catalog", systemController.requireDocsAccess, systemController.getApiCatalog);
router.get("/api-catalog.css", systemController.requireDocsAccess, systemController.getApiCatalogCss);
router.get("/api-catalog.js", systemController.requireDocsAccess, systemController.getApiCatalogJs);
router.get("/realtime", systemController.streamRealtime);

router.get("/alerts", authMiddleware, adminOrManager, systemController.getAlerts);
router.get("/audit-logs", authMiddleware, adminOrManager, systemController.getAuditTrail);
router.get(
  "/backup/snapshot",
  authMiddleware,
  adminOnly,
  systemController.downloadBackupSnapshot
);

module.exports = router;
