const express = require("express");
const router = express.Router();
const authController = require("./auth.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOrManager } = require("../../middlewares/role.middleware");
const { createRateLimiter } = require("../../middlewares/rate-limit.middleware");

const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Too many login attempts. Please wait a few minutes and try again.",
  keyGenerator: (req) =>
    `${req.ip || "unknown"}:${String(req.body?.email || "")
      .trim()
      .toLowerCase()}`,
});

const posStaffRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: "Too many POS staff requests. Please slow down and try again.",
});

const posLoginRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Too many PIN attempts. Please wait a few minutes and try again.",
  keyGenerator: (req) =>
    `${req.ip || "unknown"}:${String(req.body?.userId || "unknown").trim()}`,
});

router.post("/register", authMiddleware, adminOrManager, authController.register);
router.post("/login", loginRateLimiter, authController.login);
router.get("/pos-staff", posStaffRateLimiter, authController.getPosStaffProfiles);
router.post("/pos-login", posLoginRateLimiter, authController.posLogin);

module.exports = router;
