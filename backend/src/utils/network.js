const os = require("os");

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

const isPrivateIpv4 = (value) =>
  /^10\./.test(value) ||
  /^192\.168\./.test(value) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(value);

const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/$/, "");

const getInterfacePriority = (name = "") => {
  const normalizedName = String(name || "").trim().toLowerCase();

  if (
    normalizedName.includes("virtual") ||
    normalizedName.includes("vmware") ||
    normalizedName.includes("vbox") ||
    normalizedName.includes("hyper-v") ||
    normalizedName.includes("vethernet") ||
    normalizedName.includes("docker") ||
    normalizedName.includes("wsl") ||
    normalizedName.includes("loopback") ||
    normalizedName.includes("tailscale")
  ) {
    return 5;
  }

  if (
    normalizedName.includes("wi-fi") ||
    normalizedName.includes("wifi") ||
    normalizedName.includes("wireless") ||
    normalizedName.includes("wlan")
  ) {
    return 1;
  }

  if (
    normalizedName.startsWith("ethernet") ||
    normalizedName.includes("ethernet") ||
    normalizedName.includes("lan")
  ) {
    return 2;
  }

  return 3;
};

const parseHostHeader = (hostHeader = "") => {
  const normalized = String(hostHeader || "").trim();

  if (!normalized) {
    return {
      host: "",
      hostname: "",
      port: "",
    };
  }

  if (normalized.startsWith("[")) {
    const closingBracketIndex = normalized.indexOf("]");
    const hostname = closingBracketIndex >= 0 ? normalized.slice(1, closingBracketIndex) : normalized;
    const port =
      closingBracketIndex >= 0 && normalized.slice(closingBracketIndex + 1).startsWith(":")
        ? normalized.slice(closingBracketIndex + 2)
        : "";

    return {
      host: normalized,
      hostname,
      port,
    };
  }

  const lastColonIndex = normalized.lastIndexOf(":");

  if (lastColonIndex > 0 && /^\d+$/.test(normalized.slice(lastColonIndex + 1))) {
    return {
      host: normalized,
      hostname: normalized.slice(0, lastColonIndex),
      port: normalized.slice(lastColonIndex + 1),
    };
  }

  return {
    host: normalized,
    hostname: normalized,
    port: "",
  };
};

const getPreferredLanIpv4 = () => {
  const candidates = [];

  Object.entries(os.networkInterfaces()).forEach(([name, entries]) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.internal || entry.family !== "IPv4" || !entry.address) {
        return;
      }

      candidates.push({
        address: entry.address,
        name,
        isPrivate: isPrivateIpv4(entry.address),
        priority: getInterfacePriority(name),
      });
    });
  });

  if (candidates.length === 0) {
    return "";
  }

  candidates.sort((left, right) => {
    if (left.isPrivate !== right.isPrivate) {
      return left.isPrivate ? -1 : 1;
    }

    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    return left.address.localeCompare(right.address);
  });

  return candidates[0]?.address || "";
};

const getRequestProtocol = (req) =>
  String(req.headers?.["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim() || "http";

const getRequestPort = (req) => {
  const hostInfo = parseHostHeader(req.get("host"));

  if (hostInfo.port) {
    return hostInfo.port;
  }

  const configuredPort = String(process.env.PORT || "").trim();
  return configuredPort || "5000";
};

const getReachableAppBaseUrl = (req) => {
  const configuredBaseUrl = normalizeBaseUrl(process.env.GUEST_ORDER_PUBLIC_BASE_URL);

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const protocol = getRequestProtocol(req);
  const hostInfo = parseHostHeader(req.get("host"));
  const normalizedHost = String(hostInfo.hostname || "").trim().toLowerCase();

  if (hostInfo.host && normalizedHost && !LOOPBACK_HOSTS.has(normalizedHost)) {
    return `${protocol}://${hostInfo.host}`;
  }

  const lanIpv4 = getPreferredLanIpv4();
  const port = getRequestPort(req);

  if (lanIpv4) {
    return `${protocol}://${lanIpv4}${port ? `:${port}` : ""}`;
  }

  if (hostInfo.host) {
    return `${protocol}://${hostInfo.host}`;
  }

  return `${protocol}://localhost${port ? `:${port}` : ""}`;
};

module.exports = {
  getReachableAppBaseUrl,
};
