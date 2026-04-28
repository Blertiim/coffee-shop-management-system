import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
} from "../lib/authStorage";
import { buildApiUrl } from "../lib/api";

const POS_ALLOWED_ROLES = new Set(["admin", "waiter", "staff", "manager"]);
const PosAppContext = createContext(null);

const normalizeRole = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const isManagerRole = (role) => {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "manager";
};

const buildNotice = (notice) => {
  if (!notice) {
    return null;
  }

  if (typeof notice === "string") {
    return {
      type: "success",
      message: notice,
      duration: 3200,
    };
  }

  return {
    type: notice.type || "info",
    message: notice.message || "",
    duration: notice.duration ?? 3200,
  };
};

const buildRealtimeStreamUrl = (token, channels = []) => {
  const params = new URLSearchParams();
  params.set("token", token);

  if (channels.length > 0) {
    params.set("channels", channels.join(","));
  }

  return buildApiUrl(`/system/realtime?${params.toString()}`);
};

const buildGuestOrderAlert = (payload) => {
  if (!payload) {
    return null;
  }

  return {
    eventId: String(payload.eventId || `guest-order-${Date.now()}`),
    orderId: Number(payload.orderId) || null,
    tableId: Number(payload.tableId) || null,
    tableNumber: Number(payload.tableNumber) || null,
    location: String(payload.location || "").trim(),
    itemCount: Math.max(1, Number(payload.itemCount) || 1),
    total: Number(payload.total || 0),
    appendedToExistingOrder: Boolean(payload.appendedToExistingOrder),
    assignedWaiterId: Number(payload.assignedWaiterId) || null,
    timestamp: payload.timestamp || new Date().toISOString(),
  };
};

const createInitialState = () => {
  const session = getStoredSession();
  const initialScreen = session
    ? isManagerRole(session.user?.role)
      ? "manager"
      : "tables"
    : "login";

  return {
    session,
    screen: initialScreen,
    selectedTable: null,
    tablesRefreshToken: 0,
    notice: null,
    guestOrderAlert: null,
    highlightedGuestTableId: null,
  };
};

const reducer = (state, action) => {
  switch (action.type) {
    case "LOGIN_SUCCESS":
      return {
        ...state,
        session: action.payload,
        screen: isManagerRole(action.payload?.user?.role) ? "manager" : "tables",
        selectedTable: null,
        notice: null,
        guestOrderAlert: null,
        highlightedGuestTableId: null,
      };

    case "LOGOUT":
      return {
        ...state,
        session: null,
        screen: "login",
        selectedTable: null,
        notice: null,
        guestOrderAlert: null,
        highlightedGuestTableId: null,
      };

    case "SELECT_TABLE":
      return {
        ...state,
        selectedTable: action.payload,
        screen: "order",
        notice: null,
        guestOrderAlert:
          state.guestOrderAlert?.tableId === action.payload?.id
            ? null
            : state.guestOrderAlert,
        highlightedGuestTableId:
          state.highlightedGuestTableId === action.payload?.id
            ? null
            : state.highlightedGuestTableId,
      };

    case "RETURN_TO_TABLES":
      return {
        ...state,
        screen: "tables",
        selectedTable: null,
        tablesRefreshToken: action.payload?.refresh
          ? state.tablesRefreshToken + 1
          : state.tablesRefreshToken,
        notice: buildNotice(action.payload?.notice),
      };

    case "SHOW_NOTICE":
      return {
        ...state,
        notice: buildNotice(action.payload),
      };

    case "DISMISS_NOTICE":
      return {
        ...state,
        notice: null,
      };

    case "GUEST_ORDER_RECEIVED": {
      const nextAlert = buildGuestOrderAlert(action.payload);

      return {
        ...state,
        guestOrderAlert: nextAlert,
        highlightedGuestTableId: nextAlert?.tableId || null,
        tablesRefreshToken: state.tablesRefreshToken + 1,
      };
    }

    case "DISMISS_GUEST_ORDER_ALERT":
      return {
        ...state,
        guestOrderAlert: null,
      };

    default:
      return state;
  }
};

export function PosAppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  useEffect(() => {
    if (state.session) {
      saveStoredSession(state.session);
      return;
    }

    clearStoredSession();
  }, [state.session]);

  useEffect(() => {
    if (typeof window === "undefined" || !state.session?.token) {
      return undefined;
    }

    const normalizedRole = normalizeRole(state.session.user?.role);

    if (!["waiter", "staff"].includes(normalizedRole)) {
      return undefined;
    }

    const source = new EventSource(
      buildRealtimeStreamUrl(state.session.token, ["orders", "tables"])
    );

    const handleUpdate = (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");

        if (payload.type !== "guest-order.created") {
          return;
        }

        if (
          normalizedRole === "waiter" &&
          payload.assignedWaiterId &&
          Number(payload.assignedWaiterId) !== state.session.user?.id
        ) {
          return;
        }

        dispatch({
          type: "GUEST_ORDER_RECEIVED",
          payload,
        });
      } catch (error) {
        console.error("Failed to parse guest order realtime event:", error);
      }
    };

    source.addEventListener("update", handleUpdate);

    return () => {
      source.removeEventListener("update", handleUpdate);
      source.close();
    };
  }, [state.session?.token, state.session?.user?.id, state.session?.user?.role]);

  const loginSuccess = useCallback((loginResponse, staffProfile) => {
    const nextSession = {
      token: loginResponse.token,
      user: loginResponse.user,
      staffProfile,
    };

    const normalizedRole = normalizeRole(nextSession.user?.role);

    if (!POS_ALLOWED_ROLES.has(normalizedRole)) {
      throw new Error("This POS login is only available for cafe staff accounts.");
    }

    dispatch({
      type: "LOGIN_SUCCESS",
      payload: nextSession,
    });
  }, []);

  const logout = useCallback(() => {
    dispatch({ type: "LOGOUT" });
  }, []);

  const selectTable = useCallback((table) => {
    dispatch({
      type: "SELECT_TABLE",
      payload: table,
    });
  }, []);

  const returnToTables = useCallback((options = {}) => {
    dispatch({
      type: "RETURN_TO_TABLES",
      payload: options,
    });
  }, []);

  const showNotice = useCallback((notice) => {
    dispatch({
      type: "SHOW_NOTICE",
      payload: notice,
    });
  }, []);

  const dismissNotice = useCallback(() => {
    dispatch({ type: "DISMISS_NOTICE" });
  }, []);

  const dismissGuestOrderAlert = useCallback(() => {
    dispatch({ type: "DISMISS_GUEST_ORDER_ALERT" });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      loginSuccess,
      logout,
      selectTable,
      returnToTables,
      showNotice,
      dismissNotice,
      dismissGuestOrderAlert,
    }),
    [
      dismissGuestOrderAlert,
      dismissNotice,
      loginSuccess,
      logout,
      returnToTables,
      selectTable,
      showNotice,
      state,
    ]
  );

  return <PosAppContext.Provider value={value}>{children}</PosAppContext.Provider>;
}

export const usePosApp = () => {
  const context = useContext(PosAppContext);

  if (!context) {
    throw new Error("usePosApp must be used inside PosAppProvider");
  }

  return context;
};
