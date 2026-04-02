import { apiRequest } from "../../lib/api";

export const getDashboardStats = (token, signal) =>
  apiRequest("/dashboard/stats", {
    method: "GET",
    token,
    signal,
  });

export const getTopProducts = (token, signal) =>
  apiRequest("/dashboard/top-products", {
    method: "GET",
    token,
    signal,
  });

export const getRecentOrders = (token, signal) =>
  apiRequest("/dashboard/recent-orders", {
    method: "GET",
    token,
    signal,
  });
