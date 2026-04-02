const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const normalizeRole = (role) =>
  typeof role === "string" ? role.trim().toLowerCase() : "";

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Invalid authorization format" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "SECRET_KEY");

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const authorizeRoles = (...allowedRoles) => {
  const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!normalizedAllowedRoles.includes(normalizeRole(req.user.role))) {
      return res.status(403).json({ error: "Access denied" });
    }

    next();
  };
};

const requireAdmin = authorizeRoles("admin");

module.exports = authenticate;
module.exports.authorizeRoles = authorizeRoles;
module.exports.requireAdmin = requireAdmin;
