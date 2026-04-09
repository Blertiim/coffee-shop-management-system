const PLACEHOLDER_JWT_SECRETS = new Set([
  "",
  "change-me",
  "changeme",
  "secret_key",
  "secret-key",
  "secretkey",
  "secret",
  "jwt_secret",
  "jwt-secret",
  "jwtsecret",
]);

const PRIVATE_DEV_ORIGIN_PATTERN =
  /^https?:\/\/(?:(?:localhost|127\.0\.0\.1|\[::1\])|(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(?:192\.168\.\d{1,3}\.\d{1,3})|(?:172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}))(?::\d{1,5})?$/i;

const getNodeEnv = () => (process.env.NODE_ENV || "development").trim().toLowerCase();

const isProductionEnv = () => getNodeEnv() === "production";

const getJwtSecret = () => {
  const secret = (process.env.JWT_SECRET || "").trim();

  if (!secret || PLACEHOLDER_JWT_SECRETS.has(secret.toLowerCase())) {
    throw new Error(
      "JWT_SECRET must be set to a strong non-placeholder value before the server can run."
    );
  }

  return secret;
};

const parseCorsOrigins = () => {
  const rawOrigins = (process.env.CORS_ORIGINS || "").trim();

  if (!rawOrigins || rawOrigins === "*") {
    return null;
  }

  const origins = rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length ? new Set(origins) : null;
};

const buildCorsOriginChecker = () => {
  const rawOrigins = (process.env.CORS_ORIGINS || "").trim();
  const allowedOrigins = parseCorsOrigins();

  if (rawOrigins === "*") {
    if (isProductionEnv()) {
      throw new Error("CORS_ORIGINS cannot be '*' in production.");
    }

    return {
      description: "local/private-network development origins",
      isOriginAllowed: (origin) => !origin || PRIVATE_DEV_ORIGIN_PATTERN.test(origin),
    };
  }

  if (!allowedOrigins) {
    if (isProductionEnv()) {
      throw new Error("CORS_ORIGINS must be set explicitly in production.");
    }

    return {
      description: "local/private-network development origins",
      isOriginAllowed: (origin) => !origin || PRIVATE_DEV_ORIGIN_PATTERN.test(origin),
    };
  }

  return {
    description: Array.from(allowedOrigins).join(", "),
    isOriginAllowed: (origin) => !origin || allowedOrigins.has(origin),
  };
};

const assertSecurityConfig = () => {
  getJwtSecret();
  buildCorsOriginChecker();
};

module.exports = {
  assertSecurityConfig,
  buildCorsOriginChecker,
  getJwtSecret,
  getNodeEnv,
  isProductionEnv,
};
