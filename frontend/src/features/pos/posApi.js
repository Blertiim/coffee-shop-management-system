import { apiRequest, buildApiUrl, unwrapApiData } from "../../lib/api";

export const getTables = async (token, signal) =>
  unwrapApiData(
    await apiRequest("/tables", {
      method: "GET",
      token,
      signal,
    })
  );

export const getCategories = async (token, signal) =>
  unwrapApiData(
    await apiRequest("/categories", {
      method: "GET",
      token,
      signal,
    })
  );

export const getProducts = async (token, signal) =>
  unwrapApiData(
    await apiRequest("/products", {
      method: "GET",
      token,
      signal,
    })
  );

export const createOrder = async (token, orderPayload) =>
  unwrapApiData(
    await apiRequest("/orders", {
      method: "POST",
      token,
      body: orderPayload,
    })
  );

export const getActiveOrderByTable = async (token, tableId, signal) =>
  unwrapApiData(
    await apiRequest(`/orders/table/${tableId}/active`, {
      method: "GET",
      token,
      signal,
    })
  );

export const getTodayPaidTotals = async (token, signal) =>
  unwrapApiData(
    await apiRequest("/orders/totals/today-paid", {
      method: "GET",
      token,
      signal,
    })
  );

export const appendItemsToOrder = async (token, orderId, payload) =>
  unwrapApiData(
    await apiRequest(`/orders/${orderId}/items`, {
      method: "POST",
      token,
      body: payload,
    })
  );

export const getOrderById = async (token, orderId, signal) =>
  unwrapApiData(
    await apiRequest(`/orders/${orderId}`, {
      method: "GET",
      token,
      signal,
    })
  );

export const updateOrderStatus = async (token, orderId, status) =>
  unwrapApiData(
    await apiRequest(`/orders/${orderId}/status`, {
      method: "PATCH",
      token,
      body: { status },
    })
  );

export const generateOrderInvoice = async (token, orderId) =>
  unwrapApiData(
    await apiRequest(`/orders/${orderId}/generate-invoice`, {
      method: "PATCH",
      token,
    })
  );

export const completeOrderPayment = async (token, orderId) =>
  unwrapApiData(
    await apiRequest(`/orders/${orderId}/complete-payment`, {
      method: "PATCH",
      token,
    })
  );

const parseDownloadError = async (response) => {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = await response.json();
    return payload?.message || payload?.error || "Failed to download receipt";
  }

  const payload = await response.text();
  return payload || "Failed to download receipt";
};

export const downloadOrderReceipt = async (token, orderId) => {
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
  link.download = `coupon-order-${orderId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
};
