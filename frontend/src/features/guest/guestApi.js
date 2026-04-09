import { apiRequest, unwrapApiData } from "../../lib/api";

export const getGuestMenu = async (token, signal) =>
  unwrapApiData(
    await apiRequest(`/guest/access/${token}/menu`, {
      method: "GET",
      signal,
    })
  );

export const submitGuestOrder = async (token, payload) =>
  unwrapApiData(
    await apiRequest(`/guest/access/${token}/order`, {
      method: "POST",
      body: payload,
    })
  );
