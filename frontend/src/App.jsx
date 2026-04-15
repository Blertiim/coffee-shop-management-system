import { Suspense, lazy, useEffect } from "react";

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

function PosAppShell() {
  const { session, screen, selectedTable, notice, dismissNotice, logout } = usePosApp();
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

  return (
    <div className="app-root">
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
