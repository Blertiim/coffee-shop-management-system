const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOnly, adminOrManager } = require("../../middlewares/role.middleware");
const systemController = require("./system.controller");

const router = express.Router();

router.get("/docs", systemController.getSwaggerUi);
router.get("/docs/openapi.json", systemController.getOpenApiSpec);
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
