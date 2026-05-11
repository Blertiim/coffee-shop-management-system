import { Component, Suspense, lazy, useEffect } from "react";

import PosGuestOrderAlert from "./components/PosGuestOrderAlert";
import PosScreenLoader from "./components/PosScreenLoader";
import PosToast from "./components/PosToast";
import { PosAppProvider, usePosApp } from "./context/PosAppContext";

const PosLoginScreen = lazy(() => import("./features/auth/PosLoginScreen"));
const GuestOrderScreen = lazy(() => import("./features/guest/GuestOrderScreen"));
const PosOrderScreen = lazy(() => import("./features/pos/PosOrderScreen"));
const TableSelectionScreen = lazy(() =>
  import("./features/pos/TableSelectionScreen")
);
const ManagerDashboard = lazy(() =>
  import("./features/manager/ManagerDashboard")
);
const POS_IDLE_LOGOUT_MS = 30 * 1000;
const POS_IDLE_LOGOUT_SCREENS = new Set(["tables", "order"]);

const normalizeRole = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const isGuestOrderingRoute = () =>
  typeof window !== "undefined" && /^\/guest\/table\/[^/]+\/?$/.test(window.location.pathname);

class PosRuntimeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("POS runtime error:", error);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <main className="pos-shell">
          <section className="flex min-h-[calc(100vh-24px)] flex-col items-center justify-center rounded-[24px] border border-[#6d3b3f] bg-[linear-gradient(180deg,rgba(40,18,22,0.98)_0%,rgba(19,11,14,0.99)_100%)] px-6 py-10 text-center shadow-[0_24px_48px_rgba(0,0,0,0.38)]">
            <p className="m-0 text-[11px] uppercase tracking-[0.24em] text-[#ffb7af]">
              POS Error
            </p>
            <h1 className="m-0 mt-3 text-[1.8rem] font-semibold text-white">
              The waiter screen crashed
            </h1>
            <p className="m-0 mt-3 max-w-[520px] text-sm text-[#f3d5d0]">
              We stopped the black screen and caught the error. Return to login, then try the
              waiter again.
            </p>
            <button
              type="button"
              className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-[8px] border border-[#ffb1a8] bg-[#f5d8d3] px-5 text-sm font-semibold text-[#321316] transition hover:brightness-105 active:scale-[0.99]"
              onClick={this.props.onReset}
            >
              Back To Login
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

function PosAppShell() {
  const {
    session,
    screen,
    selectedTable,
    notice,
    guestOrderAlert,
    dismissNotice,
    dismissGuestOrderAlert,
    logout,
    returnToTables,
  } = usePosApp();
  const isManagerView = ["admin", "manager"].includes(normalizeRole(session?.user?.role));
  const isGuestRoute = isGuestOrderingRoute();
  const isPosIdleProtectedScreen =
    Boolean(session) &&
    !isGuestRoute &&
    !isManagerView &&
    POS_IDLE_LOGOUT_SCREENS.has(screen);

  useEffect(() => {
    if (typeof window === "undefined" || !isPosIdleProtectedScreen) {
      return undefined;
    }

    let timeoutId = 0;
    const activityEvents = [
      "pointerdown",
      "pointermove",
      "keydown",
      "wheel",
      "touchstart",
    ];

    const resetIdleTimer = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        logout();
      }, POS_IDLE_LOGOUT_MS);
    };

    resetIdleTimer();

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetIdleTimer, { passive: true });
    });

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetIdleTimer);
      });
    };
  }, [isPosIdleProtectedScreen, logout]);

  const isViewingAlertTable =
    Boolean(guestOrderAlert?.tableId) && selectedTable?.id === guestOrderAlert.tableId;
  const runtimeResetKey = `${session?.user?.id || "guest"}:${screen}:${selectedTable?.id || "none"}`;

  return (
    <div className="app-root">
      <PosRuntimeErrorBoundary resetKey={runtimeResetKey} onReset={logout}>
        <Suspense fallback={<PosScreenLoader label="Preparing your POS workspace..." />}>
          {isGuestRoute ? (
            <GuestOrderScreen />
          ) : !session || screen === "login" ? (
            <PosLoginScreen />
          ) : isManagerView ? (
            <ManagerDashboard session={session} onLogout={logout} />
          ) : screen === "order" && selectedTable ? (
            <PosOrderScreen />
          ) : (
            <TableSelectionScreen />
          )}
        </Suspense>
      </PosRuntimeErrorBoundary>

      <PosGuestOrderAlert
        alert={guestOrderAlert}
        isViewingSameTable={isViewingAlertTable}
        onDismiss={dismissGuestOrderAlert}
        onShowTables={() => {
          dismissGuestOrderAlert();

          if (!isViewingAlertTable) {
            returnToTables({ refresh: true });
            return;
          }
        }}
      />
      <PosToast notice={notice} onDismiss={dismissNotice} />
    </div>
  );
}

export default function App() {
  return (
    <PosAppProvider>
      <PosAppShell />
    </PosAppProvider>
  );
}
