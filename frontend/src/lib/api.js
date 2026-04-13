const resolveAutoApiBaseUrl = () => {
  const apiPort = String(import.meta.env.VITE_API_PORT || "5000").trim() || "5000";

  if (typeof window === "undefined") {
    return `http://localhost:${apiPort}/api`;
  }
  const currentOrigin = window.location.origin;

  if (currentOrigin && currentOrigin !== "null") {
    return `${currentOrigin.replace(/\/$/, "")}/api`;
  }

  return `http://localhost:${apiPort}/api`;
};

const rawApiBaseUrl =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "auto";

const API_BASE_URL =
  rawApiBaseUrl.trim().toLowerCase() === "auto"
    ? resolveAutoApiBaseUrl()
    : rawApiBaseUrl.replace(/\/$/, "");

const buildUrl = (path) => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

export const buildApiUrl = (path) => buildUrl(path);

const parseResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      (typeof payload === "object" &&
        payload !== null &&
        (payload.error || payload.message)) ||
      (typeof payload === "string" && payload) ||
      `Request failed with status ${response.status}`;

    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

export const unwrapApiData = (payload) => payload?.data ?? payload;

export const apiRequest = async (path, options = {}) => {
  const { token, headers, body, signal, timeoutMs = 10000, ...rest } = options;
  const resolvedHeaders = new Headers(headers || {});
  let resolvedBody = body;
  const abortController = new AbortController();
  let didTimeout = false;
  let externalAbortHandler = null;
  let timeoutId = 0;

  if (token) {
    resolvedHeaders.set("Authorization", `Bearer ${token}`);
  }

  if (
    body !== undefined &&
    body !== null &&
    typeof body === "object" &&
    !(body instanceof FormData)
  ) {
    resolvedHeaders.set("Content-Type", "application/json");
    resolvedBody = JSON.stringify(body);
  }

  if (signal) {
    if (signal.aborted) {
      abortController.abort(signal.reason);
    } else {
      externalAbortHandler = () => abortController.abort(signal.reason);
      signal.addEventListener("abort", externalAbortHandler, { once: true });
    }
  }

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutId = window.setTimeout(() => {
      didTimeout = true;
      abortController.abort("timeout");
    }, timeoutMs);
  }

  try {
    const response = await fetch(buildUrl(path), {
      ...rest,
      headers: resolvedHeaders,
      body: resolvedBody,
      signal: abortController.signal,
    });

    return parseResponse(response);
  } catch (error) {
    if (didTimeout) {
      const timeoutError = new Error(
        "Request timed out. Check that the backend server is running."
      );
      timeoutError.name = "TimeoutError";
      timeoutError.status = 408;
      throw timeoutError;
    }

    throw error;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }

    if (signal && externalAbortHandler) {
      signal.removeEventListener("abort", externalAbortHandler);
    }
  }
};
