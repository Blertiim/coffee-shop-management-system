import { Suspense, lazy } from "react";

import PosScreenLoader from "./components/PosScreenLoader";
import PosToast from "./components/PosToast";
import { PosAppProvider, usePosApp } from "./context/PosAppContext";

const PosLoginScreen = lazy(() => import("./features/auth/PosLoginScreen"));
const PosOrderScreen = lazy(() => import("./features/pos/PosOrderScreen"));
const TableSelectionScreen = lazy(() =>
  import("./features/pos/TableSelectionScreen")
);

function PosAppShell() {
  const { session, screen, selectedTable, notice, dismissNotice } = usePosApp();

  return (
    <div className="app-root">
      <Suspense fallback={<PosScreenLoader label="Preparing your POS workspace..." />}>
        {!session || screen === "login" ? (
          <PosLoginScreen />
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
