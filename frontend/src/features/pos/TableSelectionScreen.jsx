import { useCallback, useMemo, useState } from "react";

import PosScreenLoader from "../../components/PosScreenLoader";
import { usePosApp } from "../../context/PosAppContext";
import useApiResource from "../../hooks/useApiResource";
import FloorLayoutBoard from "./components/FloorLayoutBoard";
import { getActiveOrderByTable, getTables, getTodayPaidTotals } from "./posApi";

const normalizeRole = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const filterAssignedTables = (tables, user) => {
  const role = normalizeRole(user?.role);

  if (role !== "waiter" || !user?.id) {
    return [...tables];
  }

  const assignedTables = tables.filter((table) => table.assignedWaiterId === user.id);

  // Fallback for legacy data with no assignments yet.
  if (assignedTables.length === 0) {
    return [...tables];
  }

  return assignedTables;
};

const normalizeStatus = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const buildTableSummary = (tables) =>
  tables.reduce(
    (summary, table) => {
      const status = normalizeStatus(table.status);

      if (status === "occupied") {
        summary.openOrder += 1;
      } else if (status === "pending_payment") {
        summary.pendingPayment += 1;
      } else {
        summary.available += 1;
      }

      return summary;
    },
    {
      available: 0,
      openOrder: 0,
      pendingPayment: 0,
    }
  );

const quickStatClass =
  "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center";

export default function TableSelectionScreen() {
  const {
    session,
    logout,
    selectTable,
    showNotice,
    tablesRefreshToken,
  } = usePosApp();
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [openingTableId, setOpeningTableId] = useState(null);

  const loadTables = useCallback(
    async (signal) => {
      const [tables, dailyPaidTotals] = await Promise.all([
        getTables(session.token, signal),
        getTodayPaidTotals(session.token, signal),
      ]);

      return {
        tables: tables || [],
        dailyPaidTotals: dailyPaidTotals || {
          totalPaid: 0,
          paidOrders: 0,
          currency: "EUR",
        },
      };
    },
    [session.token]
  );

  const {
    data: tableData,
    isLoading,
    error,
  } = useApiResource(loadTables, {
    deps: [tablesRefreshToken],
    initialData: {
      tables: [],
      dailyPaidTotals: {
        totalPaid: 0,
        paidOrders: 0,
        currency: "EUR",
      },
    },
    errorMessage: "Cannot load tables.",
    onUnauthorized: logout,
  });

  const tables = tableData?.tables || [];
  const dailyPaidTotals = tableData?.dailyPaidTotals || {
    totalPaid: 0,
    paidOrders: 0,
    currency: "EUR",
  };

  const waiterName = session.staffProfile?.name || session.user?.fullName || "Waiter";
  const visibleTables = useMemo(
    () =>
      filterAssignedTables(tables, session.user).sort(
        (left, right) => left.number - right.number
      ),
    [session.user, tables]
  );

  const locations = useMemo(
    () => Array.from(new Set(visibleTables.map((table) => table.location).filter(Boolean))),
    [visibleTables]
  );

  const filteredTables = useMemo(
    () =>
      selectedLocation === "all"
        ? visibleTables
        : visibleTables.filter((table) => table.location === selectedLocation),
    [selectedLocation, visibleTables]
  );

  const summary = useMemo(() => buildTableSummary(visibleTables), [visibleTables]);

  const openOrderStatuses = useMemo(
    () => new Set(["occupied", "pending", "preparing", "served", "pending_payment"]),
    []
  );

  const handleTableSelect = useCallback(
    async (table) => {
      const tableStatus = normalizeStatus(table.status);
      setOpeningTableId(table.id);

      try {
        if (openOrderStatuses.has(tableStatus)) {
          const activeOrder = await getActiveOrderByTable(session.token, table.id);

          selectTable({
            ...table,
            activeOrder,
          });
          return;
        }

        selectTable(table);
      } catch (requestError) {
        if (requestError.status === 401) {
          logout();
          return;
        }

        if (requestError.status === 404 && openOrderStatuses.has(tableStatus)) {
          showNotice({
            type: "error",
            message: `No active order found for Table ${table.number}.`,
          });
          return;
        }

        showNotice({
          type: "error",
          message:
            requestError.message ||
            `Unable to open table ${table.number}. Please try again.`,
        });
      } finally {
        setOpeningTableId(null);
      }
    },
    [logout, openOrderStatuses, selectTable, session.token, showNotice]
  );

  return (
    <main className="pos-shell">
      <section className="grid min-h-[calc(100vh-24px)] grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex min-h-0 flex-col gap-4">
          <header className="pos-panel flex flex-wrap items-start justify-between gap-4 px-4 py-4">
            <div>
              <span className="pos-badge">Tables</span>
              <h1 className="pos-title mt-3">Welcome, {waiterName}</h1>
              <p className="pos-subtitle mt-2">
                Open assigned tables, resume orders, and complete payments quickly.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              <div className={quickStatClass}>
                <p className="m-0 text-xs uppercase tracking-wide text-pos-muted">Assigned</p>
                <p className="m-0 mt-1 text-lg font-semibold text-white">
                  {visibleTables.length}
                </p>
              </div>

              <div className={quickStatClass}>
                <p className="m-0 text-xs uppercase tracking-wide text-pos-muted">Available</p>
                <p className="m-0 mt-1 text-lg font-semibold text-emerald-300">
                  {summary.available}
                </p>
              </div>

              <div className={quickStatClass}>
                <p className="m-0 text-xs uppercase tracking-wide text-pos-muted">Open Order</p>
                <p className="m-0 mt-1 text-lg font-semibold text-amber-300">
                  {summary.openOrder}
                </p>
              </div>

              <div className={quickStatClass}>
                <p className="m-0 text-xs uppercase tracking-wide text-pos-muted">
                  Pending Payment
                </p>
                <p className="m-0 mt-1 text-lg font-semibold text-orange-300">
                  {summary.pendingPayment}
                </p>
              </div>

              <div className={quickStatClass}>
                <p className="m-0 text-xs uppercase tracking-wide text-pos-muted">
                  Paid Today
                </p>
                <p className="m-0 mt-1 text-lg font-semibold text-emerald-300">
                  {formatPrice(dailyPaidTotals.totalPaid)} EUR
                </p>
                <p className="m-0 mt-0.5 text-[11px] text-pos-muted">
                  {dailyPaidTotals.paidOrders} payments
                </p>
              </div>

              <button type="button" className="pos-button pos-button-danger" onClick={logout}>
                Logout
              </button>
            </div>
          </header>

          {error ? (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
              {error}
            </div>
          ) : null}

          <section className="pos-panel min-h-0 flex-1 p-3 sm:p-4 lg:h-[calc(100vh-230px)]">
            {isLoading ? (
              <PosScreenLoader label="Loading assigned tables..." />
            ) : filteredTables.length === 0 ? (
              <div className="pos-panel-soft flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-white/20 p-6 text-center">
                <p className="m-0 max-w-md text-sm text-pos-muted">
                  No tables found for this section. Try another filter.
                </p>
              </div>
            ) : (
              <FloorLayoutBoard
                tables={filteredTables}
                selectedLocation={selectedLocation}
                openingTableId={openingTableId}
                onTableSelect={handleTableSelect}
              />
            )}
          </section>
        </div>

        <aside className="pos-panel-soft flex flex-col p-3">
          <div className="mb-3">
            <span className="pos-badge">Sections</span>
            <p className="pos-subtitle mt-2">Filter tables by room/area.</p>
          </div>

          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setSelectedLocation("all")}
              className={`pos-button justify-start rounded-xl border px-3 ${
                selectedLocation === "all"
                  ? "border-pos-accent bg-pos-accent text-slate-950"
                  : "border-white/10 bg-white/5 text-pos-text hover:bg-white/10"
              }`}
            >
              All Sections
            </button>

            {locations.map((location) => (
              <button
                key={location}
                type="button"
                onClick={() => setSelectedLocation(location)}
                className={`pos-button justify-start rounded-xl border px-3 ${
                  selectedLocation === location
                    ? "border-pos-accent bg-pos-accent text-slate-950"
                    : "border-white/10 bg-white/5 text-pos-text hover:bg-white/10"
                }`}
              >
                {location}
              </button>
            ))}
          </div>

          <div className="mt-auto rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="m-0 text-xs uppercase tracking-[0.14em] text-pos-muted">Shift note</p>
            <p className="mt-2 text-sm text-pos-muted">
              Tap any table directly on the floor layout to open its POS order screen.
            </p>
            <p className="mt-1 text-sm text-pos-muted">
              Colors show real-time status: Available, Open Order, and Pending Payment.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
