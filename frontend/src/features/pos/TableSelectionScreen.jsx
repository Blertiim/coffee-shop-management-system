import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PosScreenLoader from "../../components/PosScreenLoader";
import { usePosApp } from "../../context/PosAppContext";
import useApiResource from "../../hooks/useApiResource";
import { getActiveOrderByTable, getTables, getTodayPaidTotals } from "./posApi";

const TABLES_PATH = "/tables";
const TABLE_PATH_PATTERN = /^\/table\/(\d+)\/?$/;

const buildTablePath = (visualTableId, fallbackTableNumber) => {
  const parsedVisualId = Number(visualTableId);

  if (Number.isFinite(parsedVisualId) && parsedVisualId > 0) {
    return `/table/${parsedVisualId}`;
  }

  return `/table/${fallbackTableNumber}`;
};

const replacePathname = (pathname) => {
  if (typeof window === "undefined" || window.location.pathname === pathname) {
    return;
  }

  window.history.replaceState({}, "", pathname);
};

const pushPathname = (pathname) => {
  if (typeof window === "undefined" || window.location.pathname === pathname) {
    return;
  }

  window.history.pushState({}, "", pathname);
};

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

      if (["occupied", "pending", "preparing", "served"].includes(status)) {
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

const MONITOR_SECTIONS = [
  { key: "Main Hall", label: "Salla" },
  { key: "Terrace 1", label: "Terrasa1" },
  { key: "Terrace 2", label: "Terrasa2" },
];

const LOCATION_LABELS = {
  all: "Tavolinat",
  "Main Hall": "Salla",
  "Terrace 1": "Terrasa1",
  "Terrace 2": "Terrasa2",
};

const getLocationLabel = (location) => LOCATION_LABELS[location] || location || "Seksioni";
const getShortName = (value) => String(value || "").trim().split(/\s+/)[0] || "";

const buildTableBindings = (tables) =>
  [...tables]
    .sort((left, right) => left.number - right.number)
    .map((table) => ({
      table,
      visualId: table.number,
    }));

const getTableCardTheme = (status, isOpening) => {
  if (isOpening) {
    return {
      label: "Hapet...",
      className:
        "border-[#d67188] bg-[linear-gradient(180deg,rgba(190,69,95,0.98)_0%,rgba(147,47,72,0.99)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_rgba(93,25,44,0.28)]",
      stripeClass: "bg-[#ffd6de]",
    };
  }

  const normalized = normalizeStatus(status);

  if (normalized === "pending_payment") {
    return {
      label: "Pagese",
      className:
        "border-[#63d26d] bg-[linear-gradient(180deg,rgba(78,189,100,0.98)_0%,rgba(42,139,71,0.99)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_18px_rgba(23,88,48,0.26)]",
      stripeClass: "bg-[#fff0a7]",
    };
  }

  if (normalized === "reserved") {
    return {
      label: "Rezervuar",
      className:
        "border-[#7f94ff] bg-[linear-gradient(180deg,rgba(92,113,224,0.98)_0%,rgba(55,74,171,0.99)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_18px_rgba(38,53,112,0.24)]",
      stripeClass: "bg-[#d6ceff]",
    };
  }

  if (["occupied", "pending", "preparing", "served"].includes(normalized)) {
    return {
      label: "Aktive",
      className:
        "border-[#d67188] bg-[linear-gradient(180deg,rgba(187,66,95,0.98)_0%,rgba(145,42,72,0.99)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_rgba(91,25,45,0.28)]",
      stripeClass: "bg-[#c5f0ff]",
    };
  }

  return {
    label: "Lire",
    className:
      "border-[#33d3d7] bg-[linear-gradient(180deg,rgba(36,174,191,0.98)_0%,rgba(18,121,156,0.99)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_18px_rgba(9,77,98,0.26)]",
    stripeClass: "bg-[#d0fff3]",
  };
};

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
  const routeAttemptRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isTablePath = TABLE_PATH_PATTERN.test(window.location.pathname);

    if (!isTablePath && window.location.pathname !== TABLES_PATH) {
      window.history.replaceState({}, "", TABLES_PATH);
    }
  }, []);

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
  const tableBindings = useMemo(() => buildTableBindings(visibleTables), [visibleTables]);

  const locations = useMemo(
    () => Array.from(new Set(visibleTables.map((table) => table.location).filter(Boolean))),
    [visibleTables]
  );
  const displayedBindings = useMemo(
    () =>
      selectedLocation === "all"
        ? tableBindings
        : tableBindings.filter(({ table }) => table.location === selectedLocation),
    [selectedLocation, tableBindings]
  );

  const summary = useMemo(() => buildTableSummary(visibleTables), [visibleTables]);

  const openOrderStatuses = useMemo(
    () => new Set(["occupied", "pending", "preparing", "served", "pending_payment"]),
    []
  );

  useEffect(() => {
    if (selectedLocation === "all") {
      return;
    }

    if (!locations.includes(selectedLocation)) {
      setSelectedLocation("all");
    }
  }, [locations, selectedLocation]);

  const handleTableSelect = useCallback(
    async (table, visualTableId = table.number) => {
      const tableStatus = normalizeStatus(table.status);
      const nextPathname = buildTablePath(visualTableId, table.number);
      setOpeningTableId(table.id);

      try {
        pushPathname(nextPathname);

        if (openOrderStatuses.has(tableStatus)) {
          const activeOrder = await getActiveOrderByTable(session.token, table.id);

          selectTable({
            ...table,
            activeOrder,
            visualId: visualTableId,
          });
          return;
        }

        selectTable({
          ...table,
          visualId: visualTableId,
        });
      } catch (requestError) {
        if (requestError.status === 401) {
          logout();
          return;
        }

        replacePathname(TABLES_PATH);

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

  useEffect(() => {
    if (typeof window === "undefined" || isLoading || openingTableId !== null) {
      return;
    }

    const matchedRoute = window.location.pathname.match(TABLE_PATH_PATTERN);

    if (!matchedRoute) {
      routeAttemptRef.current = "";
      return;
    }

    const currentPath = matchedRoute[0];

    if (routeAttemptRef.current === currentPath) {
      return;
    }

    const visualTableId = Number(matchedRoute[1]);
    const matchedBinding = tableBindings.find((binding) => binding.visualId === visualTableId);

    routeAttemptRef.current = currentPath;

    if (!matchedBinding) {
      replacePathname(TABLES_PATH);
      return;
    }

    handleTableSelect(matchedBinding.table, matchedBinding.visualId);
  }, [handleTableSelect, isLoading, openingTableId, tableBindings]);

  return (
    <main className="pos-shell">
      <section className="flex min-h-[calc(100vh-24px)] items-center justify-center rounded-[28px] border border-[#132848] bg-[radial-gradient(circle_at_18%_18%,rgba(33,88,188,0.18)_0%,transparent_24%),radial-gradient(circle_at_82%_78%,rgba(41,138,214,0.1)_0%,transparent_28%),linear-gradient(180deg,#03060b_0%,#06111d_42%,#081423_100%)] p-3 sm:p-4">
        <div className="w-full max-w-[1180px] rounded-[6px] border border-[#0d2e67] bg-[#05080f] p-2 shadow-[0_30px_70px_rgba(0,0,0,0.48)]">
          <div className="rounded-[4px] border border-[#1a70d7] bg-[linear-gradient(180deg,#0a1d39_0%,#081830_100%)] p-[4px] shadow-[inset_0_0_0_1px_rgba(88,180,255,0.16)]">
            <div className="grid min-h-[70vh] grid-cols-[minmax(0,1fr)_84px] gap-[4px] rounded-[2px] border border-[#35a9ff]/45 bg-[linear-gradient(180deg,rgba(4,26,69,0.96)_0%,rgba(3,21,57,0.98)_100%)] p-[4px] lg:grid-cols-[minmax(0,1fr)_90px]">
              <div className="flex min-h-0 flex-col rounded-[2px] border border-[#3ab4ff]/35 bg-[radial-gradient(circle_at_72%_52%,rgba(130,220,255,0.18)_0%,transparent_22%),linear-gradient(180deg,#0f63e2_0%,#0b55d5_28%,#0a5adc_68%,#0a4fca_100%)]">
                <div className="flex items-center justify-between border-b border-[#49bfff]/25 px-[6px] py-[4px] text-[9px] font-medium tracking-[0.08em] text-[#a6ddff]">
                  <span>{getLocationLabel(selectedLocation)}</span>
                  <span>{waiterName}</span>
                </div>

                {error ? (
                  <div className="mx-[6px] mt-[6px] rounded-[2px] border border-[#f48a97] bg-[rgba(143,35,57,0.72)] px-2 py-1 text-[10px] text-white">
                    {error}
                  </div>
                ) : null}

                {isLoading ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-4">
                    <PosScreenLoader label="Loading assigned tables..." />
                  </div>
                ) : visibleTables.length === 0 ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-4 text-center text-[11px] text-[#d8efff]">
                    Nuk u gjet asnje tavoline per kete kamarier.
                  </div>
                ) : displayedBindings.length === 0 ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-4 text-center text-[11px] text-[#d8efff]">
                    Nuk ka tavolina ne kete seksion.
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col px-[6px] pb-[6px] pt-[6px]">
                    <div className="grid content-start grid-cols-2 gap-[4px] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {displayedBindings.map(({ table, visualId }) => {
                        const isOpening = openingTableId === table.id;
                        const theme = getTableCardTheme(table.status, isOpening);
                        const compactWaiter = getShortName(
                          table.assignedWaiter?.fullName || waiterName
                        );
                        const showMeta = normalizeStatus(table.status) !== "available";

                        return (
                          <button
                            key={table.id}
                            type="button"
                            onClick={() => handleTableSelect(table, visualId)}
                            disabled={isOpening}
                            className={`relative flex min-h-[54px] flex-col justify-start overflow-hidden rounded-[2px] border px-[6px] py-[5px] text-left outline-none transition hover:brightness-105 focus-visible:brightness-105 active:scale-[0.99] disabled:cursor-progress disabled:opacity-90 md:min-h-[58px] ${theme.className}`}
                            aria-label={`Open Table ${visualId}`}
                            title={`Table ${visualId}`}
                          >
                            <span
                              className={`absolute inset-y-0 left-0 w-[3px] ${theme.stripeClass}`}
                            />
                            <span className="pl-[5px] text-[9px] font-medium tracking-[0.01em] text-white">
                              Tavolina - {visualId}
                            </span>
                            <span className="mt-[3px] pl-[5px] text-[8px] font-medium leading-tight text-white/90">
                              {showMeta ? compactWaiter || theme.label : "\u00A0"}
                            </span>
                            <span className="mt-[1px] pl-[5px] text-[7px] uppercase tracking-[0.12em] text-white/80">
                              {showMeta ? theme.label : "\u00A0"}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-auto pt-4">
                      <div className="h-px w-full bg-[linear-gradient(90deg,rgba(98,209,255,0.08)_0%,rgba(93,213,255,0.55)_18%,rgba(93,213,255,0.55)_82%,rgba(98,209,255,0.08)_100%)]" />
                      <div className="mt-1 flex items-center justify-between text-[8px] tracking-[0.08em] text-[#8fd8ff]">
                        <span>ready</span>
                        <span>
                          {summary.available} free | {summary.openOrder + summary.pendingPayment} open
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <aside className="flex min-h-0 flex-col gap-[4px]">
                {MONITOR_SECTIONS.map((section) => {
                  const isActive = selectedLocation === section.key;

                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() =>
                        setSelectedLocation((current) =>
                          current === section.key ? "all" : section.key
                        )
                      }
                      className={`min-h-[74px] rounded-[2px] border px-1 text-center text-[9px] font-medium tracking-[0.04em] transition md:min-h-[82px] ${
                        isActive
                          ? "border-[#7fe1ff] bg-[linear-gradient(180deg,rgba(53,181,200,0.98)_0%,rgba(21,123,167,0.99)_100%)] text-white"
                          : "border-[#39b4ff]/35 bg-[linear-gradient(180deg,rgba(43,177,193,0.92)_0%,rgba(19,128,173,0.96)_100%)] text-[#e4fbff] hover:brightness-105"
                      }`}
                    >
                      {section.label}
                    </button>
                  );
                })}

                <div className="flex-1 rounded-[2px] border border-[#3ab4ff]/22 bg-[linear-gradient(180deg,rgba(14,72,163,0.3)_0%,rgba(7,44,113,0.18)_100%)]" />

                <div className="rounded-[2px] border border-[#48d782] bg-[linear-gradient(180deg,rgba(48,198,103,0.98)_0%,rgba(24,155,82,0.99)_100%)] px-1 py-2 text-center text-[#ebfff2]">
                  <p className="m-0 text-[7px] uppercase tracking-[0.16em]">Totali</p>
                  <p className="m-0 mt-1 text-[10px] font-semibold">
                    {formatPrice(dailyPaidTotals.totalPaid)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-[4px]">
                  <button
                    type="button"
                    className="min-h-[54px] rounded-[2px] border border-[#d46e83] bg-[linear-gradient(180deg,rgba(196,72,95,0.98)_0%,rgba(147,46,73,0.99)_100%)] px-1 text-center text-[8px] font-semibold tracking-[0.06em] text-white transition hover:brightness-105 active:scale-[0.99]"
                    onClick={logout}
                  >
                    Logout
                  </button>

                  <div className="flex min-h-[54px] flex-col items-center justify-center rounded-[2px] border border-[#d8d46d] bg-[linear-gradient(180deg,rgba(214,202,95,0.98)_0%,rgba(188,178,74,0.99)_100%)] px-1 text-center text-[#35516d]">
                    <span className="text-[7px] uppercase tracking-[0.16em]">Open</span>
                    <span className="mt-1 text-[10px] font-bold">
                      {summary.openOrder + summary.pendingPayment}
                    </span>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
