import { apiRequest } from "../../lib/api";

export const login = (credentials) =>
  apiRequest("/auth/login", {
    method: "POST",
    body: credentials,
  });
