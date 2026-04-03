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

const POS_ALLOWED_ROLES = new Set(["admin", "waiter", "staff", "manager"]);
const PosAppContext = createContext(null);

const normalizeRole = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

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

const createInitialState = () => {
  const session = getStoredSession();

  return {
    session,
    screen: session ? "tables" : "login",
    selectedTable: null,
    tablesRefreshToken: 0,
    notice: null,
  };
};

const reducer = (state, action) => {
  switch (action.type) {
    case "LOGIN_SUCCESS":
      return {
        ...state,
        session: action.payload,
        screen: "tables",
        selectedTable: null,
        notice: null,
      };

    case "LOGOUT":
      return {
        ...state,
        session: null,
        screen: "login",
        selectedTable: null,
        notice: null,
      };

    case "SELECT_TABLE":
      return {
        ...state,
        selectedTable: action.payload,
        screen: "order",
        notice: null,
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

  const value = useMemo(
    () => ({
      ...state,
      loginSuccess,
      logout,
      selectTable,
      returnToTables,
      showNotice,
      dismissNotice,
    }),
    [dismissNotice, loginSuccess, logout, returnToTables, selectTable, showNotice, state]
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
