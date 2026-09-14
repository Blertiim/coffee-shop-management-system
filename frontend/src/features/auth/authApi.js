import { apiRequest, unwrapApiData } from "../../lib/api";

export const login = async (credentials) =>
  unwrapApiData(
    await apiRequest("/auth/login", {
      method: "POST",
      body: credentials,
    }),
  );

export const getPosStaffProfiles = async (signal) =>
  unwrapApiData(
    await apiRequest("/auth/pos-staff", {
      method: "GET",
      signal,
      timeoutMs: 45000,
    }),
  );

export const posLogin = async (payload) =>
  unwrapApiData(
    await apiRequest("/auth/pos-login", {
      method: "POST",
      body: payload,
    }),
  );

// Public — no auth required; the login screen fetches this before anyone
// is signed in.
export const getBranding = async (signal) =>
  unwrapApiData(
    await apiRequest("/system/branding", {
      method: "GET",
      signal,
    }),
  );
