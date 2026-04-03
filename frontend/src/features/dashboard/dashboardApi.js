import { apiRequest, unwrapApiData } from "../../lib/api";

export const getDashboardStats = async (token, signal) =>
  unwrapApiData(
    await apiRequest("/dashboard/stats", {
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

export const getRecentOrders = async (token, signal) =>
  unwrapApiData(
    await apiRequest("/dashboard/recent-orders", {
      method: "GET",
      token,
      signal,
    })
  );
