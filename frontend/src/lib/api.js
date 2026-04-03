const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "/api"
).replace(/\/$/, "");

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
  const { token, headers, body, ...rest } = options;
  const resolvedHeaders = new Headers(headers || {});
  let resolvedBody = body;

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

  const response = await fetch(buildUrl(path), {
    ...rest,
    headers: resolvedHeaders,
    body: resolvedBody,
  });

  return parseResponse(response);
};
