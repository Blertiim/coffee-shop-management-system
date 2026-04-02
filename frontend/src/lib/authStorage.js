const AUTH_STORAGE_KEY = "coffee-shop-dashboard-session";

export const getStoredSession = () => {
  try {
    const storedValue = localStorage.getItem(AUTH_STORAGE_KEY);

    return storedValue ? JSON.parse(storedValue) : null;
  } catch (error) {
    console.error("Failed to read stored session:", error);
    return null;
  }
};

export const saveStoredSession = (session) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const clearStoredSession = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};
