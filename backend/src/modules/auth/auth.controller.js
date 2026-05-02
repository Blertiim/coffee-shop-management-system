const prisma = require("../../config/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../../config/security");
const { logManualAuditEvent } = require("../../services/audit.service");
const { isDatabaseUnavailableError } = require("../../services/alert.service");
const {
  clearPosLoginAttemptState,
  getPosLoginBlock,
  registerFailedPosLoginAttempt,
} = require("../../services/pos-login-guard.service");

const POS_LOGIN_ROLES = new Set(["waiter", "manager"]);
const INVALID_POS_LOGIN_MESSAGE = "Invalid user or PIN";
const POS_LOGIN_LOCKED_MESSAGE =
  "Too many failed attempts. POS login is temporarily locked. Please wait and try again.";
const POS_LOGIN_DELAY_MESSAGE =
  "Please wait a few seconds before trying again.";

const normalizeRole = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const isActiveStatus = (value) =>
  typeof value === "string" && value.trim().toLowerCase() === "active";

const isValidPin = (value) =>
  typeof value === "string" && /^\d{4}$/.test(value.trim());

const mapPosProfile = (user) => ({
  id: user.id,
  name: user.fullName,
  role: user.role,
  status: user.status,
});

const resolveIpAddress = (req) => {
  const forwardedFor = req.headers?.["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || null;
};

const getAuditContext = (req) => ({
  ipAddress: resolveIpAddress(req),
  userAgent: req.headers?.["user-agent"] || null,
});

const buildUserPayload = async (user) => {
  const employee = await prisma.employee.findFirst({
    where: {
      email: user.email,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
      shift: true,
    },
  });

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    employee,
  };
};

exports.register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
      },
    });

    await logManualAuditEvent({
      actorId: req.user?.id || null,
      actorName: req.user?.fullName || null,
      actorRole: req.user?.role || null,
      action: "auth.register",
      entityType: "user",
      entityId: user.id,
      statusCode: 201,
      summary: `User account created for ${email}`,
      payload: { email, fullName },
      ...getAuditContext(req),
    });

    res.status(201).json({
      message: "User registered successfully",
      user: await buildUserPayload(user),
    });
  } catch (error) {
    console.error("Register error:", error);
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        error: "Database unavailable. Start MySQL and try again.",
      });
    }
    res.status(500).json({ error: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      await logManualAuditEvent({
        action: "auth.login.failed",
        entityType: "auth",
        statusCode: 401,
        summary: `Failed login for ${email}`,
        payload: { email },
        ...getAuditContext(req),
      });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      await logManualAuditEvent({
        actorId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: "auth.login.failed",
        entityType: "auth",
        entityId: user.id,
        statusCode: 401,
        summary: `Failed login for ${user.email}`,
        payload: { email },
        ...getAuditContext(req),
      });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!isActiveStatus(user.status)) {
      await logManualAuditEvent({
        actorId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: "auth.login.blocked",
        entityType: "auth",
        entityId: user.id,
        statusCode: 403,
        summary: `Inactive account login blocked for ${user.email}`,
        payload: { email },
        ...getAuditContext(req),
      });
      return res.status(403).json({ error: "User account is not active" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    await logManualAuditEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: "auth.login.success",
      entityType: "auth",
      entityId: user.id,
      statusCode: 200,
      summary: `Login successful for ${user.email}`,
      payload: { email },
      ...getAuditContext(req),
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: await buildUserPayload(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        error: "Database unavailable. Start MySQL and try again.",
      });
    }
    res.status(500).json({ error: "Server error" });
  }
};

exports.getPosStaffProfiles = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: Array.from(POS_LOGIN_ROLES),
        },
        status: "active",
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        status: true,
      },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    });

    return res.status(200).json({
      message: "POS staff profiles retrieved successfully",
      data: users.map(mapPosProfile),
    });
  } catch (error) {
    console.error("Get POS staff profiles error:", error);
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        error: "Database unavailable. Start MySQL and reload the POS.",
      });
    }
    return res.status(500).json({ error: "Server error" });
  }
};

exports.posLogin = async (req, res) => {
  try {
    const userId = Number(req.body && req.body.userId);
    const pin =
      typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
    const identifier = Number.isInteger(userId) && userId > 0 ? `user:${userId}` : "";
    const auditContext = getAuditContext(req);
    const ipAddress = auditContext.ipAddress;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "Valid userId is required" });
    }

    if (!isValidPin(pin)) {
      return res.status(400).json({
        error: "PIN is required and must be exactly 4 digits",
      });
    }

    const activeBlock = getPosLoginBlock({
      identifier,
      ipAddress,
    });

    if (activeBlock) {
      res.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil(activeBlock.retryAfterMs / 1000)))
      );

      await logManualAuditEvent({
        action:
          activeBlock.type === "lockout"
            ? "auth.pos.locked"
            : "auth.pos.delayed",
        entityType: "auth",
        entityId: String(userId),
        statusCode: 429,
        summary:
          activeBlock.type === "lockout"
            ? `Blocked POS login for user ${userId} due to lockout`
            : `Delayed repeated POS login attempt for user ${userId}`,
        payload: { userId },
        ...auditContext,
      });

      return res.status(429).json({
        error:
          activeBlock.type === "lockout"
            ? POS_LOGIN_LOCKED_MESSAGE
            : POS_LOGIN_DELAY_MESSAGE,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !POS_LOGIN_ROLES.has(normalizeRole(user.role))) {
      const attemptState = registerFailedPosLoginAttempt({
        identifier,
        ipAddress,
      });

      res.setHeader(
        "Retry-After",
        String(
          Math.max(
            1,
            Math.ceil(
              ((attemptState.lockedUntil || attemptState.nextAllowedAt) - Date.now()) /
                1000
            )
          )
        )
      );

      await logManualAuditEvent({
        action: attemptState.lockedUntil ? "auth.pos.lockout" : "auth.pos.failed",
        entityType: "auth",
        statusCode: attemptState.lockedUntil ? 429 : 401,
        summary: `Failed POS login for user ${userId}`,
        payload: { userId },
        ...auditContext,
      });

      return res.status(attemptState.lockedUntil ? 429 : 401).json({
        error: attemptState.lockedUntil
          ? POS_LOGIN_LOCKED_MESSAGE
          : INVALID_POS_LOGIN_MESSAGE,
      });
    }

    if (!isActiveStatus(user.status)) {
      await logManualAuditEvent({
        actorId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: "auth.pos.blocked",
        entityType: "auth",
        entityId: user.id,
        statusCode: 403,
        summary: `Inactive POS login blocked for ${user.fullName}`,
        payload: { userId },
        ...auditContext,
      });
      return res.status(403).json({ error: "User account is not active" });
    }

    const isMatch = await bcrypt.compare(pin, user.password);

    if (!isMatch) {
      const attemptState = registerFailedPosLoginAttempt({
        identifier,
        ipAddress,
      });

      res.setHeader(
        "Retry-After",
        String(
          Math.max(
            1,
            Math.ceil(
              ((attemptState.lockedUntil || attemptState.nextAllowedAt) - Date.now()) /
                1000
            )
          )
        )
      );

      await logManualAuditEvent({
        actorId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: attemptState.lockedUntil ? "auth.pos.lockout" : "auth.pos.failed",
        entityType: "auth",
        entityId: user.id,
        statusCode: attemptState.lockedUntil ? 429 : 401,
        summary: `Failed POS login for ${user.fullName}`,
        payload: { userId },
        ...auditContext,
      });

      return res.status(attemptState.lockedUntil ? 429 : 401).json({
        error: attemptState.lockedUntil
          ? POS_LOGIN_LOCKED_MESSAGE
          : INVALID_POS_LOGIN_MESSAGE,
      });
    }

    clearPosLoginAttemptState({
      identifier,
      ipAddress,
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    await logManualAuditEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: "auth.pos.success",
      entityType: "auth",
      entityId: user.id,
      statusCode: 200,
      summary: `POS login successful for ${user.fullName}`,
      payload: { userId },
      ...auditContext,
    });

    return res.status(200).json({
      message: "POS login successful",
      token,
      user: await buildUserPayload(user),
    });
  } catch (error) {
    console.error("POS login error:", error);
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        error: "Database unavailable. Start MySQL and try again.",
      });
    }
    return res.status(500).json({ error: "Server error" });
  }
};
