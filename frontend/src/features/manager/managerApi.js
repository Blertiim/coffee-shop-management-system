import { apiRequest, buildApiUrl, unwrapApiData } from "../../lib/api";

export const getManagerStats = async (token, params = {}, signal) =>
  unwrapApiData(
    await apiRequest(`/dashboard/stats${new URLSearchParams(params).toString() ? `?${new URLSearchParams(params).toString()}` : ""}`, {
      method: "GET",
      token,
      signal,
    })
  );

export const getRevenueTrend = async (token, params = {}, signal) =>
  unwrapApiData(
    await apiRequest(`/dashboard/revenue-trend${new URLSearchParams(params).toString() ? `?${new URLSearchParams(params).toString()}` : ""}`, {
      method: "GET",
      token,
      signal,
    })
  );

export const getTopProducts = async (token, signal) =>
  unwrapApiData(
    await apiRequest("/dashboard/top-products", {
      method: "GET",
      token,
      signal,
    })
  );

export const getWaiterPerformance = async (token, params = {}, signal) =>
  unwrapApiData(
    await apiRequest(`/dashboard/waiter-performance${new URLSearchParams(params).toString() ? `?${new URLSearchParams(params).toString()}` : ""}`, {
      method: "GET",
      token,
      signal,
    })
  );

export const getDashboardOrders = async (token, params = {}, signal) =>
  unwrapApiData(
    await apiRequest(`/dashboard/orders${new URLSearchParams(params).toString() ? `?${new URLSearchParams(params).toString()}` : ""}`, {
      method: "GET",
      token,
      signal,
    })
  );

export const getDashboardInvoices = async (token, params = {}, signal) =>
  unwrapApiData(
    await apiRequest(`/dashboard/invoices${new URLSearchParams(params).toString() ? `?${new URLSearchParams(params).toString()}` : ""}`, {
      method: "GET",
      token,
      signal,
    })
  );

export const getDailySummary = async (token, params = {}, signal) =>
  unwrapApiData(
    await apiRequest(`/dashboard/daily-summary${new URLSearchParams(params).toString() ? `?${new URLSearchParams(params).toString()}` : ""}`, {
      method: "GET",
      token,
      signal,
    })
  );

export const getLowStockProducts = async (token, params = {}, signal) =>
  unwrapApiData(
    await apiRequest(`/dashboard/stock-alerts${new URLSearchParams(params).toString() ? `?${new URLSearchParams(params).toString()}` : ""}`, {
      method: "GET",
      token,
      signal,
    })
  );

export const getAdvancedReport = async (token, params = {}, signal) =>
  unwrapApiData(
    await apiRequest(`/dashboard/advanced-report${new URLSearchParams(params).toString() ? `?${new URLSearchParams(params).toString()}` : ""}`, {
      method: "GET",
      token,
      signal,
    })
  );

export const getSystemAlerts = async (token, params = {}, signal) =>
  unwrapApiData(
    await apiRequest(`/system/alerts${new URLSearchParams(params).toString() ? `?${new URLSearchParams(params).toString()}` : ""}`, {
      method: "GET",
      token,
      signal,
    })
  );

export const getAuditLogs = async (token, params = {}, signal) =>
  unwrapApiData(
    await apiRequest(`/system/audit-logs${new URLSearchParams(params).toString() ? `?${new URLSearchParams(params).toString()}` : ""}`, {
      method: "GET",
      token,
      signal,
    })
  );

export const getProducts = async (token, signal) =>
  apiRequest("/products", {
    method: "GET",
    token,
    signal,
  });

export const createProduct = async (token, payload) =>
  apiRequest("/products", {
    method: "POST",
    token,
    body: payload,
  });

export const updateProduct = async (token, productId, payload) =>
  apiRequest(`/products/${productId}`, {
    method: "PUT",
    token,
    body: payload,
  });

export const deleteProduct = async (token, productId) =>
  apiRequest(`/products/${productId}`, {
    method: "DELETE",
    token,
  });

export const updateProductStock = async (token, productId, payload) =>
  apiRequest(`/products/${productId}/stock`, {
    method: "PATCH",
    token,
    body: payload,
  });

export const getCategories = async (token, signal) =>
  apiRequest("/categories", {
    method: "GET",
    token,
    signal,
  });

export const getTables = async (token, signal) =>
  unwrapApiData(
    await apiRequest("/tables", {
      method: "GET",
      token,
      signal,
    })
  );

export const createCategory = async (token, payload) =>
  apiRequest("/categories", {
    method: "POST",
    token,
    body: payload,
  });

export const updateCategory = async (token, categoryId, payload) =>
  apiRequest(`/categories/${categoryId}`, {
    method: "PUT",
    token,
    body: payload,
  });

export const deleteCategory = async (token, categoryId) =>
  apiRequest(`/categories/${categoryId}`, {
    method: "DELETE",
    token,
  });

export const assignTableToWaiter = async (token, tableId, waiterId) =>
  unwrapApiData(
    await apiRequest(`/tables/${tableId}/assignment`, {
      method: "PATCH",
      token,
      body: { waiterId },
    })
  );

export const setWaiterTableAssignments = async (token, payload) =>
  unwrapApiData(
    await apiRequest("/tables/assignments/waiter", {
      method: "PUT",
      token,
      body: payload,
    })
  );

export const getWaiters = async (token, signal) =>
  unwrapApiData(
    await apiRequest("/staff/waiters", {
      method: "GET",
      token,
      signal,
    })
  );

export const createWaiter = async (token, payload) =>
  unwrapApiData(
    await apiRequest("/staff/waiters", {
      method: "POST",
      token,
      body: payload,
    })
  );

export const updateWaiter = async (token, waiterId, payload) =>
  unwrapApiData(
    await apiRequest(`/staff/waiters/${waiterId}`, {
      method: "PATCH",
      token,
      body: payload,
    })
  );

export const updateWaiterStatus = async (token, waiterId, payload) =>
  unwrapApiData(
    await apiRequest(`/staff/waiters/${waiterId}/status`, {
      method: "PATCH",
      token,
      body: payload,
    })
  );

export const deleteWaiter = async (token, waiterId) =>
  unwrapApiData(
    await apiRequest(`/staff/waiters/${waiterId}`, {
      method: "DELETE",
      token,
    })
  );

export const getGuestQrAccess = async (token, tableId) =>
  unwrapApiData(
    await apiRequest(`/guest/tables/${tableId}/access`, {
      method: "GET",
      token,
    })
  );

export const rotateGuestQrAccess = async (token, tableId) =>
  unwrapApiData(
    await apiRequest(`/guest/tables/${tableId}/access/rotate`, {
      method: "POST",
      token,
    })
  );

export const buildRealtimeStreamUrl = (token, channels = []) => {
  const params = new URLSearchParams();
  params.set("token", token);

  if (channels.length) {
    params.set("channels", channels.join(","));
  }

  return buildApiUrl(`/system/realtime?${params.toString()}`);
};

const parseDownloadError = async (response) => {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = await response.json();
    return payload?.message || payload?.error || "Failed to download invoice";
  }

  const payload = await response.text();
  return payload || "Failed to download invoice";
};

export const downloadInvoicePdf = async (token, orderId) => {
  const response = await fetch(buildApiUrl(`/orders/${orderId}/receipt`), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = new Error(await parseDownloadError(response));
    error.status = response.status;
    throw error;
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `invoice-order-${orderId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
};

const downloadReportFile = async (token, path, fileName) => {
  const response = await fetch(buildApiUrl(path), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = new Error(await parseDownloadError(response));
    error.status = response.status;
    throw error;
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
};

export const downloadAdvancedReportCsv = async (token, params = {}) => {
  const query = new URLSearchParams(params).toString();
  await downloadReportFile(
    token,
    `/dashboard/export/report.csv${query ? `?${query}` : ""}`,
    "advanced-sales-report.csv"
  );
};

export const downloadAdvancedReportPdf = async (token, params = {}) => {
  const query = new URLSearchParams(params).toString();
  await downloadReportFile(
    token,
    `/dashboard/export/report.pdf${query ? `?${query}` : ""}`,
    "advanced-sales-report.pdf"
  );
};
