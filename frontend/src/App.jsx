import { Suspense, lazy } from "react";

import PosScreenLoader from "./components/PosScreenLoader";
import PosToast from "./components/PosToast";
import { PosAppProvider, usePosApp } from "./context/PosAppContext";

const PosLoginScreen = lazy(() => import("./features/auth/PosLoginScreen"));
const PosOrderScreen = lazy(() => import("./features/pos/PosOrderScreen"));
const TableSelectionScreen = lazy(() =>
  import("./features/pos/TableSelectionScreen")
);
const ManagerDashboard = lazy(() =>
  import("./features/manager/ManagerDashboard")
);

const normalizeRole = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

function PosAppShell() {
  const { session, screen, selectedTable, notice, dismissNotice, logout } = usePosApp();
  const isManagerView = ["admin", "manager"].includes(normalizeRole(session?.user?.role));

  return (
    <div className="app-root">
      <Suspense fallback={<PosScreenLoader label="Preparing your POS workspace..." />}>
        {!session || screen === "login" ? (
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
