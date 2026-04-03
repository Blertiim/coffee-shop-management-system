import { apiRequest, unwrapApiData } from "../../lib/api";

export const login = async (credentials) =>
  unwrapApiData(
    await apiRequest("/auth/login", {
      method: "POST",
      body: credentials,
    })
  );

export const getPosStaffProfiles = async (signal) =>
  unwrapApiData(
    await apiRequest("/auth/pos-staff", {
      method: "GET",
      signal,
    })
  );

export const posLogin = async (payload) =>
  unwrapApiData(
    await apiRequest("/auth/pos-login", {
      method: "POST",
      body: payload,
    })
  );
