import { apiRequest, unwrapApiData } from "../../lib/api";

export const login = async (credentials) =>
  unwrapApiData(
    await apiRequest("/auth/login", {
      method: "POST",
      body: credentials,
    })
  );
