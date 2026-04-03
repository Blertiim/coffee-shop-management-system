const { sendError } = require("../utils/response");

const normalizeRole = (role) =>
  typeof role === "string" ? role.trim().toLowerCase() : "";

const authorizeRoles = (...allowedRoles) => {
  const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, "Authentication required");
    }

    if (!normalizedAllowedRoles.includes(normalizeRole(req.user.role))) {
      return sendError(res, 403, "Access denied");
    }

    return next();
  };
};

const adminOnly = authorizeRoles("admin");
const managerOnly = authorizeRoles("manager");
const waiterOnly = authorizeRoles("waiter");
const adminOrWaiter = authorizeRoles("admin", "waiter");
const adminOrManager = authorizeRoles("admin", "manager");
const adminManagerOrWaiter = authorizeRoles("admin", "manager", "waiter");

module.exports = {
  normalizeRole,
  authorizeRoles,
  adminOnly,
  managerOnly,
  waiterOnly,
  adminOrWaiter,
  adminOrManager,
  adminManagerOrWaiter,
};
