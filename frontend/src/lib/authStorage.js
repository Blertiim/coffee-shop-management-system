const AUTH_STORAGE_KEY = "coffee-shop-pos-session";

const getSessionStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
};

const clearLegacyLocalSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const getStoredSession = () => {
  try {
    const storage = getSessionStorage();
    const rawValue = storage?.getItem(AUTH_STORAGE_KEY);

    clearLegacyLocalSession();

    return rawValue ? JSON.parse(rawValue) : null;
  } catch (error) {
    console.error("Failed to read stored POS session:", error);
    return null;
  }
};

export const saveStoredSession = (session) => {
  const storage = getSessionStorage();

  storage?.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  clearLegacyLocalSession();
};

export const clearStoredSession = () => {
  const storage = getSessionStorage();

  storage?.removeItem(AUTH_STORAGE_KEY);
  clearLegacyLocalSession();
};
