const clients = new Map();
let clientSequence = 0;

const KEEPALIVE_INTERVAL_MS = 20 * 1000;

const normalizeChannels = (channels = []) =>
  new Set(
    (Array.isArray(channels) ? channels : String(channels || "").split(","))
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
  );

const inferChannelsFromPath = (path = "") => {
  const normalizedPath = String(path).toLowerCase();
  const channels = new Set(["system"]);

  if (normalizedPath.includes("/orders")) {
    channels.add("orders");
    channels.add("dashboard");
    channels.add("tables");
  }

  if (normalizedPath.includes("/inventory")) {
    channels.add("inventory");
    channels.add("alerts");
    channels.add("dashboard");
  }

  if (normalizedPath.includes("/products")) {
    channels.add("products");
    channels.add("dashboard");
  }

  if (normalizedPath.includes("/categories")) {
    channels.add("categories");
    channels.add("dashboard");
  }

  if (normalizedPath.includes("/tables")) {
    channels.add("tables");
    channels.add("dashboard");
  }

  if (normalizedPath.includes("/staff")) {
    channels.add("staff");
    channels.add("dashboard");
  }

  if (normalizedPath.includes("/auth")) {
    channels.add("auth");
  }

  return [...channels];
};

const shouldReceiveEvent = (clientChannels, targetChannels) => {
  if (clientChannels.has("*")) {
    return true;
  }

  return targetChannels.some((channel) => clientChannels.has(channel));
};

const writeEvent = (res, eventName, payload) => {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const registerRealtimeClient = (req, res, channels = []) => {
  const clientId = `client-${clientSequence += 1}`;
  const normalizedChannels = normalizeChannels(channels);

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  writeEvent(res, "connected", {
    clientId,
    channels: [...normalizedChannels],
    timestamp: new Date().toISOString(),
  });

  const keepAlive = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, KEEPALIVE_INTERVAL_MS);

  clients.set(clientId, {
    res,
    channels: normalizedChannels,
  });

  const cleanup = () => {
    clearInterval(keepAlive);
    clients.delete(clientId);
  };

  req.on("close", cleanup);
  req.on("end", cleanup);

  return cleanup;
};

const publishRealtimeEvent = (channels, payload) => {
  const normalizedChannels = normalizeChannels(channels);
  const eventPayload = {
    ...payload,
    channels: [...normalizedChannels],
    timestamp: new Date().toISOString(),
  };

  for (const { res, channels: clientChannels } of clients.values()) {
    if (!shouldReceiveEvent(clientChannels, eventPayload.channels)) {
      continue;
    }

    writeEvent(res, "update", eventPayload);
  }
};

module.exports = {
  inferChannelsFromPath,
  publishRealtimeEvent,
  registerRealtimeClient,
};
