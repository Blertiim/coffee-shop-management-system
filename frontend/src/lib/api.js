const resolveAutoApiBaseUrls = () => {
  const apiPort = String(import.meta.env.VITE_API_PORT || "5000").trim() || "5000";
  const localCandidates = [`http://127.0.0.1:${apiPort}/api`, `http://localhost:${apiPort}/api`];

  if (typeof window === "undefined") {
    return localCandidates;
  }

  const currentOrigin = window.location.origin;
  const currentHostCandidate =
    window.location.hostname && window.location.protocol
      ? `${window.location.protocol}//${window.location.hostname}:${apiPort}/api`
      : null;
  const sameOriginCandidate =
    currentOrigin && currentOrigin !== "null"
      ? `${currentOrigin.replace(/\/$/, "")}/api`
      : null;

  return [currentHostCandidate, ...localCandidates, sameOriginCandidate].filter(
    (candidate, index, candidates) => candidate && candidates.indexOf(candidate) === index
  );
};

const isAutoApiBaseUrl =
  (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "auto")
    .trim()
    .toLowerCase() === "auto";

const autoApiBaseUrls = resolveAutoApiBaseUrls();

const rawApiBaseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "auto";

const API_BASE_URL =
  isAutoApiBaseUrl
    ? autoApiBaseUrls[0]
    : rawApiBaseUrl.replace(/\/$/, "");

const buildUrl = (path, baseUrl = API_BASE_URL) => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
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
    const baseUrls = isAutoApiBaseUrl ? autoApiBaseUrls : [API_BASE_URL];
    let lastNetworkError = null;

    for (let index = 0; index < baseUrls.length; index += 1) {
      try {
        const response = await fetch(buildUrl(path, baseUrls[index]), {
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

        // When the desktop app ends up on an unreachable LAN origin, retry the API on loopback.
        if (error?.name === "AbortError" || error?.status) {
          throw error;
        }

        lastNetworkError = error;
      }
    }

    throw lastNetworkError || new Error("Failed to fetch");
  } catch (error) {
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
