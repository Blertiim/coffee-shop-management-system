const jwt = require("jsonwebtoken");

const prisma = require("../config/prisma");
const { sendError } = require("../utils/response");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return sendError(res, 401, "No token provided");
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return sendError(res, 401, "Invalid authorization format");
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
      return sendError(res, 401, "User not found");
    }

    if (typeof user.status === "string" && user.status.trim().toLowerCase() !== "active") {
      return sendError(res, 403, "User account is not active");
    }

    req.user = user;
    return next();
  } catch (error) {
    return sendError(res, 401, "Invalid token");
  }
};

module.exports = authenticate;
