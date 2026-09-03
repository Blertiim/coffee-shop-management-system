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

const normalizeRole = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

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

const normalizeStatus = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

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
    },
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
const TABLE_MONITOR_SLOT_PRESETS = [
  { left: 2.2, top: 6.4, width: 14.2, height: 9 },
  { left: 17.5, top: 6.4, width: 14.2, height: 9 },
  { left: 32.8, top: 6.4, width: 14.2, height: 9 },
  { left: 48.1, top: 6.4, width: 14.2, height: 9 },
  { left: 63.4, top: 6.4, width: 14.2, height: 9 },
  { left: 78.7, top: 6.4, width: 14.2, height: 9 },
  { left: 2.2, top: 16.6, width: 14.2, height: 9 },
  { left: 17.5, top: 16.6, width: 14.2, height: 9 },
  { left: 32.8, top: 16.6, width: 14.2, height: 9 },
  { left: 48.1, top: 16.6, width: 14.2, height: 9 },
  { left: 63.4, top: 16.6, width: 14.2, height: 9 },
  { left: 78.7, top: 16.6, width: 14.2, height: 9 },
  { left: 2.2, top: 26.8, width: 14.2, height: 9 },
  { left: 17.5, top: 26.8, width: 14.2, height: 9 },
  { left: 32.8, top: 26.8, width: 14.2, height: 9 },
];

const getFallbackMonitorSlot = (index) => {
  const fallbackIndex = Math.max(0, index - TABLE_MONITOR_SLOT_PRESETS.length);
  const columns = 6;
  const column = fallbackIndex % columns;
  const row = Math.floor(fallbackIndex / columns);

  return {
    left: 2.2 + column * 15.3,
    top: 37 + row * 10.2,
    width: 14.2,
    height: 9,
  };
};

const getMonitorSlot = (index) =>
  TABLE_MONITOR_SLOT_PRESETS[index] || getFallbackMonitorSlot(index);

const compactBindingsToMonitorSlots = (bindings) =>
  bindings.map((binding, index) => ({
    ...binding,
    slot: getMonitorSlot(index),
  }));

const buildTableBindings = (tables) =>
  [...tables]
    .sort((left, right) => left.number - right.number)
    .map((table, index) => ({
      table,
      visualId: index + 1,
      slot: getMonitorSlot(index),
    }));

const getTableCardTheme = (status, isOpening) => {
  if (isOpening) {
    return {
      label: "Hapet...",
      className: "border-[#f0d9b0] bg-[#fdf3e0] shadow-[0_4px_10px_rgba(196,143,62,0.14)]",
      stripeClass: "bg-[#d6923a]",
      metaTextClass: "text-[#a15c1f]",
    };
  }

  const normalized = normalizeStatus(status);

  if (normalized === "pending_payment") {
    return {
      label: "Pagese",
      className: "border-[#bfe6cf] bg-[#e7f7ed] shadow-[0_4px_10px_rgba(21,115,71,0.1)]",
      stripeClass: "bg-[#2f8f45]",
      metaTextClass: "text-[#157347]",
    };
  }

  if (normalized === "reserved") {
    return {
      label: "Rezervuar",
      className: "border-[#dcd0f5] bg-[#f3eefd] shadow-[0_4px_10px_rgba(106,76,194,0.1)]",
      stripeClass: "bg-[#8a6fd0]",
      metaTextClass: "text-[#6a4cc2]",
    };
  }

  if (["occupied", "pending", "preparing", "served"].includes(normalized)) {
    return {
      label: "Aktive",
      className: "border-[#f3c3c9] bg-[#fdedef] shadow-[0_4px_10px_rgba(179,54,74,0.1)]",
      stripeClass: "bg-[#d9576f]",
      metaTextClass: "text-[#b3364a]",
    };
  }

  return {
    label: "Lire",
    className: "border-[#d3e3fa] bg-white shadow-[0_4px_10px_rgba(20,55,110,0.06)]",
    stripeClass: "bg-[#1fa2ff]",
    metaTextClass: "text-[#5c7093]",
  };
};

export default function TableSelectionScreen() {
  const {
    session,
    logout,
    selectTable,
    showNotice,
    tablesRefreshToken,
    guestOrderAlert,
    highlightedGuestTableId,
    dismissedGuestOrderEventId,
    receiveGuestOrderAlert,
  } = usePosApp();
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [openingTableId, setOpeningTableId] = useState(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewport();

    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
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
    [session.token],
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

  const visibleTables = useMemo(
    () =>
      filterAssignedTables(tables, session.user).sort((left, right) => left.number - right.number),
    [session.user, tables],
  );
  const tableBindings = useMemo(() => buildTableBindings(visibleTables), [visibleTables]);

  const locations = useMemo(
    () => Array.from(new Set(visibleTables.map((table) => table.location).filter(Boolean))),
    [visibleTables],
  );
  const displayedBindings = useMemo(() => {
    const filteredBindings =
      selectedLocation === "all"
        ? tableBindings
        : tableBindings.filter(({ table }) => table.location === selectedLocation);

    return compactBindingsToMonitorSlots(filteredBindings);
  }, [selectedLocation, tableBindings]);
  const latestGuestOrderTable = useMemo(() => {
    const guestOrderBindings = tableBindings
      .filter(({ table }) => table.activeGuestOrder)
      .sort((left, right) => {
        const leftTime = new Date(
          left.table.activeGuestOrder?.updatedAt || left.table.activeGuestOrder?.createdAt || 0,
        ).getTime();
        const rightTime = new Date(
          right.table.activeGuestOrder?.updatedAt || right.table.activeGuestOrder?.createdAt || 0,
        ).getTime();

        return rightTime - leftTime;
      });

    return guestOrderBindings[0] || null;
  }, [tableBindings]);

  const latestGuestOrderEventId = useMemo(() => {
    const activeGuestOrder = latestGuestOrderTable?.table?.activeGuestOrder;

    if (!activeGuestOrder) {
      return "";
    }

    return `existing-guest-order-${activeGuestOrder.orderId}-${
      activeGuestOrder.updatedAt || activeGuestOrder.createdAt || latestGuestOrderTable.table.id
    }`;
  }, [latestGuestOrderTable]);

  const summary = useMemo(() => buildTableSummary(visibleTables), [visibleTables]);
  const openTablesCount = summary.openOrder + summary.pendingPayment;
  const isTabletLayout = useMemo(() => {
    if (!viewport.width || !viewport.height) {
      return false;
    }

    const shortestSide = Math.min(viewport.width, viewport.height);
    const longestSide = Math.max(viewport.width, viewport.height);
    const hasTouchViewport =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)")?.matches || navigator.maxTouchPoints > 0);

    return (
      viewport.width <= 1024 || (hasTouchViewport && shortestSide <= 1024 && longestSide <= 1400)
    );
  }, [viewport]);

  const openOrderStatuses = useMemo(
    () => new Set(["occupied", "pending", "preparing", "served", "pending_payment"]),
    [],
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
            message: `No active order found for Table ${visualTableId}.`,
          });
          return;
        }

        showNotice({
          type: "error",
          message:
            requestError.message || `Unable to open table ${visualTableId}. Please try again.`,
        });
      } finally {
        setOpeningTableId(null);
      }
    },
    [logout, openOrderStatuses, selectTable, session.token, showNotice],
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

  useEffect(() => {
    if (
      isLoading ||
      !latestGuestOrderTable ||
      !latestGuestOrderEventId ||
      guestOrderAlert?.eventId === latestGuestOrderEventId ||
      dismissedGuestOrderEventId === latestGuestOrderEventId
    ) {
      return;
    }

    const { table, visualId } = latestGuestOrderTable;
    const activeGuestOrder = table.activeGuestOrder;

    if (!activeGuestOrder) {
      return;
    }

    receiveGuestOrderAlert({
      eventId: latestGuestOrderEventId,
      orderId: activeGuestOrder.orderId,
      tableId: table.id,
      tableNumber: visualId || table.number,
      location: table.location,
      itemCount: activeGuestOrder.itemCount || 1,
      total: activeGuestOrder.total || 0,
      appendedToExistingOrder: true,
      assignedWaiterId: table.assignedWaiterId || null,
      timestamp:
        activeGuestOrder.updatedAt || activeGuestOrder.createdAt || new Date().toISOString(),
    });
  }, [
    dismissedGuestOrderEventId,
    guestOrderAlert?.eventId,
    isLoading,
    latestGuestOrderEventId,
    latestGuestOrderTable,
    receiveGuestOrderAlert,
  ]);

  return (
    <main className="min-h-[100dvh] bg-[linear-gradient(180deg,#f5f9ff_0%,#eef5ff_48%,#e8f1fd_100%)] p-0">
      <section className="flex min-h-[100dvh] rounded-none border-0 bg-[radial-gradient(circle_at_18%_18%,rgba(31,162,255,0.08)_0%,transparent_24%),radial-gradient(circle_at_82%_78%,rgba(56,120,217,0.08)_0%,transparent_28%),linear-gradient(180deg,#f5f9ff_0%,#eef5ff_48%,#e8f1fd_100%)] p-0">
        <div
          className={`grid min-h-full w-full rounded-none border-0 bg-[#d3e3fa] p-0 ${
            isTabletLayout
              ? "grid-rows-[minmax(0,1fr)_auto] gap-px"
              : "grid-cols-[minmax(0,1fr)_84px] gap-px sm:grid-cols-[minmax(0,1fr)_104px] sm:gap-px"
          }`}
        >
          <div className="relative min-h-0 overflow-hidden rounded-none border-0 bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_48%,#f3f8ff_100%)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_21%_18%,rgba(31,162,255,0.05)_0%,transparent_22%),radial-gradient(circle_at_70%_48%,rgba(31,162,255,0.07)_0%,transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.5)_0%,transparent_24%,transparent_100%)]" />

            <div className="relative z-10 flex h-full min-h-0 flex-col">
              <div className="flex items-center justify-between border-b border-[#e1ecfb] px-[5px] py-[4px] text-[8px] font-medium tracking-[0.08em] text-[#5c7093] sm:px-[6px] sm:text-[9px]">
                <span>{getLocationLabel(selectedLocation)}</span>
                <span>POS</span>
              </div>

              {error ? (
                <div className="mx-[6px] mt-[6px] rounded-[2px] border border-[#f3c3c9] bg-[#fdedef] px-2 py-1 text-[9px] text-[#b3364a] sm:text-[10px]">
                  {error}
                </div>
              ) : null}

              <div className="relative min-h-0 flex-1 overflow-hidden">
                {isLoading ? (
                  <div className="flex h-full items-center justify-center px-3 py-4">
                    <PosScreenLoader label="Loading assigned tables..." />
                  </div>
                ) : visibleTables.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 py-4 text-center text-[10px] text-[#5c7093] sm:text-[11px]">
                    Nuk u gjet asnje tavoline per kete kamarier.
                  </div>
                ) : displayedBindings.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 py-4 text-center text-[10px] text-[#5c7093] sm:text-[11px]">
                    Nuk ka tavolina ne kete seksion.
                  </div>
                ) : (
                  <div className="relative h-full">
                    {isTabletLayout ? (
                      <div className="scroll-y h-full overflow-y-auto px-[6px] pb-[28px] pt-[6px]">
                        <div className="grid content-start grid-cols-2 gap-[6px] sm:grid-cols-3">
                          {displayedBindings.map(({ table, visualId }) => {
                            const isOpening = openingTableId === table.id;
                            const isGuestHighlighted = highlightedGuestTableId === table.id;
                            const theme = getTableCardTheme(table.status, isOpening);
                            const showMeta = normalizeStatus(table.status) !== "available";

                            return (
                              <button
                                key={table.id}
                                type="button"
                                onClick={() => handleTableSelect(table, visualId)}
                                disabled={isOpening}
                                className={`relative flex min-h-[74px] flex-col justify-start overflow-hidden rounded-[2px] border px-[6px] py-[5px] text-left outline-none transition duration-150 hover:brightness-105 focus-visible:brightness-105 active:scale-[0.99] disabled:cursor-progress disabled:opacity-90 sm:min-h-[84px] ${theme.className} ${
                                  isGuestHighlighted
                                    ? "ring-2 ring-[#ffd977] ring-offset-0 shadow-[0_0_0_1px_rgba(255,219,119,0.55),0_0_16px_rgba(255,211,97,0.36)]"
                                    : ""
                                }`}
                                aria-label={`Open Table ${visualId}`}
                                title={`Table ${visualId}`}
                              >
                                {isGuestHighlighted ? (
                                  <span className="absolute right-[5px] top-[5px] rounded-full border border-[#fff1bf] bg-[#f1bd58] px-[5px] py-[1px] text-[7px] font-bold uppercase tracking-[0.12em] text-[#392306]">
                                    QR
                                  </span>
                                ) : null}
                                <span
                                  className={`absolute inset-y-0 left-0 w-[3px] ${theme.stripeClass}`}
                                />
                                <span className="pl-[5px] text-[9px] font-medium tracking-[0.01em] text-[#12213d]">
                                  Tavolina - {visualId}
                                </span>
                                <span
                                  className={`mt-[3px] pl-[5px] text-[8px] font-medium leading-tight ${theme.metaTextClass}`}
                                >
                                  {showMeta ? theme.label : "\u00A0"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-[6px_6px_18px_6px]">
                        {displayedBindings.map(({ table, visualId, slot }) => {
                          const isOpening = openingTableId === table.id;
                          const isGuestHighlighted = highlightedGuestTableId === table.id;
                          const theme = getTableCardTheme(table.status, isOpening);
                          const showMeta = normalizeStatus(table.status) !== "available";

                          return (
                            <button
                              key={table.id}
                              type="button"
                              onClick={() => handleTableSelect(table, visualId)}
                              disabled={isOpening}
                              className={`absolute flex flex-col justify-start overflow-hidden rounded-[2px] border px-[6px] py-[5px] text-left outline-none transition duration-150 hover:brightness-105 focus-visible:brightness-105 active:scale-[0.99] disabled:cursor-progress disabled:opacity-90 ${theme.className} ${
                                isGuestHighlighted
                                  ? "ring-2 ring-[#ffd977] ring-offset-0 shadow-[0_0_0_1px_rgba(255,219,119,0.55),0_0_16px_rgba(255,211,97,0.36)]"
                                  : ""
                              }`}
                              style={{
                                left: `${slot.left}%`,
                                top: `${slot.top}%`,
                                width: `${slot.width}%`,
                                height: `${slot.height}%`,
                              }}
                              aria-label={`Open Table ${visualId}`}
                              title={`Table ${visualId}`}
                            >
                              {isGuestHighlighted ? (
                                <span className="absolute right-[5px] top-[5px] rounded-full border border-[#fff1bf] bg-[#f1bd58] px-[5px] py-[1px] text-[7px] font-bold uppercase tracking-[0.12em] text-[#392306]">
                                  QR
                                </span>
                              ) : null}
                              <span
                                className={`absolute inset-y-0 left-0 w-[3px] ${theme.stripeClass}`}
                              />
                              <span className="pl-[5px] text-[9px] font-medium tracking-[0.01em] text-[#12213d]">
                                Tavolina - {visualId}
                              </span>
                              <span
                                className={`mt-[3px] pl-[5px] text-[8px] font-medium leading-tight ${theme.metaTextClass}`}
                              >
                                {showMeta ? theme.label : "\u00A0"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="absolute inset-x-[6px] bottom-[4px]">
                      <div className="h-px w-full bg-[#e1ecfb]" />
                      <div className="mt-1 flex items-center justify-between text-[8px] tracking-[0.08em] text-[#5c7093]">
                        <span>ready</span>
                        <span>
                          {summary.available} free | {openTablesCount} open
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isTabletLayout ? (
            <aside className="grid grid-cols-3 gap-px bg-[#d3e3fa]">
              {MONITOR_SECTIONS.map((section) => {
                const isActive = selectedLocation === section.key;

                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() =>
                      setSelectedLocation((current) =>
                        current === section.key ? "all" : section.key,
                      )
                    }
                    className={`min-h-[56px] border px-1 text-center text-[8px] font-medium tracking-[0.04em] transition ${
                      isActive
                        ? "border-[#e6b657] bg-[linear-gradient(180deg,#f2c977_0%,#c48f3e_100%)] text-white"
                        : "border-[#d3e3fa] bg-[#f7faff] text-[#12213d] hover:border-[#8fb8ee]"
                    }`}
                  >
                    {section.label}
                  </button>
                );
              })}

              <div className="flex min-h-[54px] flex-col items-center justify-center border border-[#5fb46a] bg-[linear-gradient(180deg,#5fc26c_0%,#2f8f45_100%)] px-1 text-center text-white">
                <span className="text-[7px] uppercase tracking-[0.16em]">Totali</span>
                <span className="mt-1 text-[9px] font-semibold">
                  {formatPrice(dailyPaidTotals.totalPaid)}
                </span>
              </div>

              <button
                type="button"
                className="min-h-[54px] border border-[#e3607a] bg-[linear-gradient(180deg,#eb5a6b_0%,#c23a52_100%)] px-1 text-center text-[7px] font-semibold tracking-[0.06em] text-white transition hover:brightness-105 active:scale-[0.99]"
                onClick={logout}
              >
                Logout
              </button>

              <div className="flex min-h-[54px] flex-col items-center justify-center border border-[#e6b657] bg-[linear-gradient(180deg,#f2c977_0%,#c48f3e_100%)] px-1 text-center text-white">
                <span className="text-[7px] uppercase tracking-[0.16em]">Open</span>
                <span className="mt-1 text-[9px] font-bold">{openTablesCount}</span>
              </div>
            </aside>
          ) : (
            <aside className="flex min-h-0 flex-col gap-[4px]">
              {MONITOR_SECTIONS.map((section) => {
                const isActive = selectedLocation === section.key;

                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() =>
                      setSelectedLocation((current) =>
                        current === section.key ? "all" : section.key,
                      )
                    }
                    className={`flex-1 rounded-[2px] border px-1 text-center text-[8px] font-medium tracking-[0.04em] transition min-h-[82px] sm:min-h-[98px] sm:text-[9px] ${
                      isActive
                        ? "border-[#e6b657] bg-[linear-gradient(180deg,#f2c977_0%,#c48f3e_100%)] text-white"
                        : "border-[#d3e3fa] bg-[#f7faff] text-[#12213d] hover:border-[#8fb8ee]"
                    }`}
                  >
                    {section.label}
                  </button>
                );
              })}

              <div className="relative flex-[1.15] overflow-hidden rounded-[2px] border border-[#e1ecfb] bg-[linear-gradient(180deg,#ffffff_0%,#f3f8ff_100%)] min-h-[146px]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(31,162,255,0.06)_0%,transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.5)_0%,transparent_35%,rgba(18,33,61,0.02)_100%)]" />
                <div className="relative flex h-full min-h-[146px] flex-col items-center justify-center px-2 py-3 text-center">
                  <p className="m-0 text-[7px] uppercase tracking-[0.24em] text-[#5c7093]">
                    Terminal
                  </p>
                  <p className="m-0 mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0f6bb8] sm:text-[11px]">
                    Rosit Bar
                  </p>
                  <p className="m-0 mt-2 text-[7px] uppercase tracking-[0.18em] text-[#5c7093]">
                    Table Control
                  </p>
                </div>
              </div>

              <div className="rounded-[2px] border border-[#5fb46a] bg-[linear-gradient(180deg,#5fc26c_0%,#2f8f45_100%)] px-1 py-3 text-center text-white sm:py-4">
                <p className="m-0 text-[7px] uppercase tracking-[0.16em]">Totali</p>
                <p className="m-0 mt-1 text-[9px] font-semibold sm:text-[10px]">
                  {formatPrice(dailyPaidTotals.totalPaid)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-[4px]">
                <button
                  type="button"
                  className="min-h-[58px] rounded-[2px] border border-[#e3607a] bg-[linear-gradient(180deg,#eb5a6b_0%,#c23a52_100%)] px-1 text-center text-[7px] font-semibold tracking-[0.06em] text-white transition hover:brightness-105 active:scale-[0.99] sm:min-h-[64px] sm:text-[8px]"
                  onClick={logout}
                >
                  Logout
                </button>

                <div className="flex min-h-[58px] flex-col items-center justify-center rounded-[2px] border border-[#e6b657] bg-[linear-gradient(180deg,#f2c977_0%,#c48f3e_100%)] px-1 text-center text-white sm:min-h-[64px]">
                  <span className="text-[7px] uppercase tracking-[0.16em]">Open</span>
                  <span className="mt-1 text-[9px] font-bold sm:text-[10px]">
                    {openTablesCount}
                  </span>
                </div>
              </div>
            </aside>
          )}
        </div>
      </section>
    </main>
  );
}
