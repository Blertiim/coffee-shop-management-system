import { apiRequest, unwrapApiData } from "../../lib/api";

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

export const appendItemsToOrder = async (token, orderId, payload) =>
  unwrapApiData(
    await apiRequest(`/orders/${orderId}/items`, {
      method: "POST",
      token,
      body: payload,
    })
  );
