import { useCallback, useMemo, useState } from "react";

import PosScreenLoader from "../../components/PosScreenLoader";
import { usePosApp } from "../../context/PosAppContext";
import useApiResource from "../../hooks/useApiResource";
import TableTile from "./components/TableTile";
import { getActiveOrderByTable, getTables } from "./posApi";

const filterAssignedTables = (tables, assignedTableNumbers) => {
  if (!Array.isArray(assignedTableNumbers) || assignedTableNumbers.length === 0) {
    return [...tables];
  }

  const filteredTables = tables.filter((table) =>
    assignedTableNumbers.includes(table.number)
  );

  return filteredTables.length > 0 ? filteredTables : [...tables];
};

const buildTableSummary = (tables) =>
  tables.reduce(
    (summary, table) => {
      if (table.status === "occupied") {
        summary.occupied += 1;
      } else if (table.status === "reserved") {
        summary.reserved += 1;
      } else {
        summary.available += 1;
      }

      return summary;
    },
    {
      available: 0,
      occupied: 0,
      reserved: 0,
    }
  );

const quickStatClass =
  "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center";

export default function TableSelectionScreen() {
  const { session, logout, selectTable, showNotice, tablesRefreshToken } = usePosApp();
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [openingTableId, setOpeningTableId] = useState(null);

  const loadTables = useCallback(
    (signal) => getTables(session.token, signal),
    [session.token]
  );

  const {
    data: tables = [],
    isLoading,
    error,
  } = useApiResource(loadTables, {
    deps: [tablesRefreshToken],
    initialData: [],
    errorMessage: "Cannot load tables.",
    onUnauthorized: logout,
  });

  const waiterName = session.staffProfile?.name || session.user?.fullName || "Waiter";
  const visibleTables = useMemo(
    () =>
      filterAssignedTables(tables, session.staffProfile?.assignedTableNumbers || []).sort(
        (left, right) => left.number - right.number
      ),
    [session.staffProfile, tables]
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

  const handleTableSelect = async (table) => {
    const normalizedStatus =
      typeof table.status === "string" ? table.status.trim().toLowerCase() : "";

    setOpeningTableId(table.id);

    try {
      if (normalizedStatus === "occupied") {
        const activeOrder = await getActiveOrderByTable(
          session.token,
          table.id
        );

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

      showNotice({
        type: "error",
        message:
          requestError.message ||
          `Unable to open Table ${table.number}. Please try again.`,
      });
    } finally {
      setOpeningTableId(null);
    }
  };

  return (
    <main className="pos-shell">
      <section className="grid min-h-[calc(100vh-24px)] grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
        <div className="flex min-h-0 flex-col gap-4">
          <header className="pos-panel flex flex-wrap items-start justify-between gap-4 px-4 py-4">
            <div>
              <span className="pos-badge">Tables</span>
              <h1 className="pos-title mt-3">Welcome, {waiterName}</h1>
              <p className="pos-subtitle mt-2">
                Choose an available table to start a new order quickly.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                <p className="m-0 text-xs uppercase tracking-wide text-pos-muted">Occupied</p>
                <p className="m-0 mt-1 text-lg font-semibold text-amber-300">
                  {summary.occupied}
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

          <section className="pos-panel min-h-0 flex-1 p-3 sm:p-4">
            {isLoading ? (
              <PosScreenLoader label="Loading assigned tables..." />
            ) : filteredTables.length === 0 ? (
              <div className="pos-panel-soft flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-white/20 p-6 text-center">
                <p className="m-0 max-w-md text-sm text-pos-muted">
                  No tables found for this section. Try another filter.
                </p>
              </div>
            ) : (
              <div className="scroll-y grid max-h-[calc(100vh-240px)] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 2xl:grid-cols-3">
                {filteredTables.map((table) => (
                  <TableTile
                    key={table.id}
                    table={table}
                    isOpening={openingTableId === table.id}
                    onSelect={handleTableSelect}
                  />
                ))}
              </div>
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
              Occupied tables now open their active order for quick resume.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
