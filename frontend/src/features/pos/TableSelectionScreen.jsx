import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PosScreenLoader from "../../components/PosScreenLoader";
import { usePosApp } from "../../context/PosAppContext";
import useApiResource from "../../hooks/useApiResource";
import { getBranding } from "../auth/authApi";
import {
  getActiveOrderByTable,
  getTables,
  getTodayPaidTotals,
  updateTablePosition,
} from "./posApi";

const DEFAULT_BAR_NAME = "ROSIT BAR";
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

const isManagerRole = (role) => {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "manager";
};

// Every waiter browses every table in every section (Salla / Terrasa1 /
// Terrasa2) — "assigned" only tracks who's serving a table, it never hides
// a table from other waiters. Restricting by assignment used to make a
// whole section (e.g. "Salla") look completely empty for any waiter who
// happened to have no tables assigned there, even though the manager's
// view showed tables in it — which read as a bug ("Salla" and "Main Hall"
// looking disconnected) rather than the intended behavior.
const filterAssignedTables = (tables) => [...tables];

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

const getLocationLabel = (location) =>
  LOCATION_LABELS[location] || location || "Seksioni";
// Table cards sit on a percentage-based canvas so a manager-dragged position
// (positionX/positionY, also a %) keeps working at any screen size. The grid
// itself adapts its column count to the viewport — a phone gets fewer, much
// bigger/taller cards instead of the same tiny 6-across grid designed for a
// wide monitor. Column 6 below reproduces the original fixed monitor grid
// exactly, so desktop/kiosk screens render pixel-identically to before.
const TABLE_GRID_LAYOUTS = {
  3: {
    columns: 3,
    marginLeft: 2.4,
    colPitch: 31.87,
    columnWidth: 29.5,
    rowTopStart: 6.4,
    rowHeight: 15,
    rowPitch: 17,
  },
  4: {
    columns: 4,
    marginLeft: 2.3,
    colPitch: 23.85,
    columnWidth: 22.2,
    rowTopStart: 6.4,
    rowHeight: 12,
    rowPitch: 13.6,
  },
  5: {
    columns: 5,
    marginLeft: 2.2,
    colPitch: 19.12,
    columnWidth: 17.8,
    rowTopStart: 6.4,
    rowHeight: 10,
    rowPitch: 11.3,
  },
  6: {
    columns: 6,
    marginLeft: 2.2,
    colPitch: 15.3,
    columnWidth: 14.2,
    rowTopStart: 6.4,
    rowHeight: 9,
    rowPitch: 10.2,
  },
};

const getTableGridLayout = (columns) =>
  TABLE_GRID_LAYOUTS[columns] || TABLE_GRID_LAYOUTS[6];

// Fewer, wider columns on narrow viewports so table cards stay big enough to
// read and tap on a real phone; the desktop/kiosk grid (6 columns) is
// untouched.
const getTableColumnCount = (viewportWidth) => {
  if (!viewportWidth) {
    return 6;
  }

  if (viewportWidth < 480) {
    return 3;
  }

  if (viewportWidth < 768) {
    return 4;
  }

  if (viewportWidth < 1024) {
    return 5;
  }

  return 6;
};

// The 5/6-column (tablet/desktop/kiosk) layouts came from a monitor that's
// wide and comparatively short, so sizing a row as a % of the canvas HEIGHT
// worked fine there. On a phone the canvas is tall and narrow (the section
// buttons moved below it), so that same "% of height" row size ends up huge
// - a card taller than it needs to be for two short lines of text, with the
// section showing only 4-5 tables before you have to scroll for the rest.
// For the compact (3/4-column, phone/small-tablet) layouts we instead pick
// a fixed, comfortable card height in real pixels and convert it to a % of
// the canvas' measured height, so the card size no longer depends on how
// tall the canvas happens to be.
const COMPACT_TABLE_CARD_HEIGHT_PX = 68;
const COMPACT_TABLE_CARD_GAP_PX = 8;
const COMPACT_TABLE_CARD_TOP_PX = 8;
// How small a card is allowed to get when a dense saved floor plan has to be
// squeezed onto a phone - below this the card stops being comfortably
// tappable, so cards are allowed to sit closer together (or overlap slightly)
// instead of shrinking further.
const COMPACT_PLAN_MIN_CARD_WIDTH_PX = 60;
const COMPACT_PLAN_MIN_CARD_HEIGHT_PX = 46;
const COMPACT_PLAN_MIN_CARD_GAP_PX = 6;
// Under this width "Tavolina - 12" no longer fits, so the card shows just the
// table number (a little larger) rather than a clipped name.
const COMPACT_PLAN_NAME_MIN_CARD_WIDTH_PX = 92;

const getTableSlotSize = (layout) => ({
  width: layout.columnWidth,
  height: layout.rowHeight,
});

const getMonitorSlot = (index, layout) => {
  const column = index % layout.columns;
  const row = Math.floor(index / layout.columns);

  return {
    left: layout.marginLeft + column * layout.colPitch,
    top: layout.rowTopStart + row * layout.rowPitch,
    ...getTableSlotSize(layout),
  };
};

const hasCustomPosition = (table) =>
  typeof table?.positionX === "number" && typeof table?.positionY === "number";

// A manager-dragged position always wins ON THE BIG SCREEN, where the
// drag-the-floor-plan feature lives and the saved % values were recorded;
// tables that were never dragged fall back to the auto-generated grid so old
// data keeps working.
//
// On a phone/small tablet the raw values are not replayed as-is
// (useCustomPositions = false) - see fitSavedPlanToCanvas below, which keeps
// the same arrangement but scales it down to fit. Played back untouched, a
// plan recorded on a wide, short monitor falls apart on a tall, narrow phone:
// vertically the cards drift far apart (a small % of a very tall canvas is
// still a lot of pixels) and horizontally a card saved at e.g. 75% runs
// straight off the right edge.
const resolveTableSlot = (table, index, layout, useCustomPositions = true) => {
  if (useCustomPositions && hasCustomPosition(table)) {
    return {
      left: table.positionX,
      top: table.positionY,
      ...getTableSlotSize(layout),
    };
  }

  return getMonitorSlot(index, layout);
};

// Groups nearly-equal coordinates from the saved plan into columns (or rows):
// the manager drags cards by hand, so a column of tables is never at exactly
// the same X - it's 19.6, 19.6, 20, ... Values within PLAN_CLUSTER_TOLERANCE of
// each other are treated as the same column/row.
const PLAN_CLUSTER_TOLERANCE = 4;

const clusterPositions = (values) => {
  const sorted = [...new Set(values)].sort((first, second) => first - second);
  const indexByValue = new Map();
  let index = 0;
  let previous = sorted[0];

  sorted.forEach((value) => {
    if (value - previous > PLAN_CLUSTER_TOLERANCE) {
      index += 1;
    }

    indexByValue.set(value, index);
    previous = value;
  });

  return { indexByValue, count: index + 1 };
};

// Replays the manager's saved floor plan on a phone/small-tablet screen.
//
// The raw saved coordinates can't be used directly: they are a % of a wide,
// short monitor canvas, so on a tall, narrow phone the cards drift far apart
// vertically and run off the right edge horizontally. Scaling them to fit
// doesn't work either - hand-dragged positions are never perfectly aligned, so
// a tiny 0.6% wobble between two cards forces the whole plan to shrink.
//
// So instead the plan is read for what it actually means: which column a table
// is in and which row, i.e. who is left of whom and who is above whom. Those
// columns and rows are then laid out neatly on the phone - columns spread
// across the full width, rows at a fixed compact pitch from the top. The
// arrangement a waiter recognises from the big screen is preserved, the cards
// stay readable and tappable, and nothing lands off-screen or on top of
// something else.
//
// Returns null when there is nothing to fit (fewer than two saved positions, or
// the canvas has not been measured yet) so the caller falls back to the grid.
const fitSavedPlanToCanvas = (bindings, layout, canvasSize) => {
  if (!canvasSize?.width || !canvasSize?.height) {
    return null;
  }

  const positioned = bindings.filter(({ table }) => hasCustomPosition(table));

  if (positioned.length < 2) {
    return null;
  }

  const columns = clusterPositions(
    positioned.map(({ table }) => table.positionX),
  );
  const rows = clusterPositions(positioned.map(({ table }) => table.positionY));

  const cardWidthPx = Math.max(
    Math.min(
      (getTableSlotSize(layout).width / 100) * canvasSize.width,
      (canvasSize.width - (columns.count - 1) * COMPACT_PLAN_MIN_CARD_GAP_PX) /
        columns.count,
    ),
    COMPACT_PLAN_MIN_CARD_WIDTH_PX,
  );
  const cardHeightPx = Math.max(
    Math.min(
      COMPACT_TABLE_CARD_HEIGHT_PX,
      (canvasSize.height -
        COMPACT_TABLE_CARD_TOP_PX -
        (rows.count - 1) * COMPACT_TABLE_CARD_GAP_PX) /
        rows.count,
    ),
    COMPACT_PLAN_MIN_CARD_HEIGHT_PX,
  );

  const columnPitchPx =
    columns.count > 1
      ? (canvasSize.width - cardWidthPx) / (columns.count - 1)
      : 0;
  const rowPitchPx = cardHeightPx + COMPACT_TABLE_CARD_GAP_PX;
  const singleColumnLeftPx =
    columns.count > 1 ? 0 : Math.max((canvasSize.width - cardWidthPx) / 2, 0);

  // Two tables the manager stacked on the same spot would land in the same
  // cell; the second one moves to the next free cell instead of hiding under
  // the first. Walking the plan in reading order keeps that stable.
  const takenCells = new Set();
  const cellByTableId = new Map();
  const readingOrder = [...positioned].sort((first, second) => {
    const rowDifference =
      rows.indexByValue.get(first.table.positionY) -
      rows.indexByValue.get(second.table.positionY);

    if (rowDifference !== 0) {
      return rowDifference;
    }

    return (
      columns.indexByValue.get(first.table.positionX) -
      columns.indexByValue.get(second.table.positionX)
    );
  });

  readingOrder.forEach(({ table }) => {
    let row = rows.indexByValue.get(table.positionY);
    let column = columns.indexByValue.get(table.positionX);

    while (takenCells.has(`${row}:${column}`)) {
      column += 1;

      if (column >= columns.count) {
        column = 0;
        row += 1;
      }
    }

    takenCells.add(`${row}:${column}`);
    cellByTableId.set(table.id, { row, column });
  });

  const size = {
    width: (cardWidthPx / canvasSize.width) * 100,
    height: (cardHeightPx / canvasSize.height) * 100,
  };

  return bindings.map((binding, index) => {
    const cell = cellByTableId.get(binding.table.id);

    if (!cell) {
      return {
        ...binding,
        slot: getMonitorSlot(index, layout),
      };
    }

    const leftPx =
      columns.count > 1 ? cell.column * columnPitchPx : singleColumnLeftPx;
    const topPx = COMPACT_TABLE_CARD_TOP_PX + cell.row * rowPitchPx;

    return {
      ...binding,
      slot: {
        left: (leftPx / canvasSize.width) * 100,
        top: (topPx / canvasSize.height) * 100,
        ...size,
      },
    };
  });
};

const compactBindingsToMonitorSlots = (
  bindings,
  layout,
  useCustomPositions = true,
) =>
  bindings.map((binding, index) => ({
    ...binding,
    slot: resolveTableSlot(binding.table, index, layout, useCustomPositions),
  }));

const buildTableBindings = (tables) =>
  [...tables]
    .sort((left, right) => left.number - right.number)
    .map((table, index) => ({
      table,
      visualId: index + 1,
      slot: resolveTableSlot(table, index, TABLE_GRID_LAYOUTS[6]),
    }));

const getTableCardTheme = (status, isOpening) => {
  if (isOpening) {
    return {
      label: "Hapet...",
      className:
        "border-[#f0d9b0] bg-[#fdf3e0] shadow-[0_4px_10px_rgba(196,143,62,0.14)]",
      stripeClass: "bg-[#d6923a]",
      metaTextClass: "text-[#a15c1f]",
    };
  }

  const normalized = normalizeStatus(status);

  if (normalized === "pending_payment") {
    return {
      label: "Pagese",
      className:
        "border-[#bfe6cf] bg-[#e7f7ed] shadow-[0_4px_10px_rgba(21,115,71,0.1)]",
      stripeClass: "bg-[#2f8f45]",
      metaTextClass: "text-[#157347]",
    };
  }

  if (normalized === "reserved") {
    return {
      label: "Rezervuar",
      className:
        "border-[#dcd0f5] bg-[#f3eefd] shadow-[0_4px_10px_rgba(106,76,194,0.1)]",
      stripeClass: "bg-[#8a6fd0]",
      metaTextClass: "text-[#6a4cc2]",
    };
  }

  if (["occupied", "pending", "preparing", "served"].includes(normalized)) {
    return {
      label: "Aktive",
      className:
        "border-[#f3c3c9] bg-[#fdedef] shadow-[0_4px_10px_rgba(179,54,74,0.1)]",
      stripeClass: "bg-[#d9576f]",
      metaTextClass: "text-[#b3364a]",
    };
  }

  return {
    label: "Lire",
    className:
      "border-[#d3e3fa] bg-white shadow-[0_4px_10px_rgba(20,55,110,0.06)]",
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
  // Default to a single section (never the combined "all" view) — showing
  // every table from every section on one canvas at once makes tables from
  // different sections collide on the same fallback grid slots.
  const [selectedLocation, setSelectedLocation] = useState(
    MONITOR_SECTIONS[0].key,
  );
  const [openingTableId, setOpeningTableId] = useState(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isArrangeMode, setIsArrangeMode] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [savingPositionTableId, setSavingPositionTableId] = useState(null);
  const [barName, setBarName] = useState(DEFAULT_BAR_NAME);
  const routeAttemptRef = useRef("");
  const canvasRef = useRef(null);
  const canManageLayout = isManagerRole(session.user?.role);

  useEffect(() => {
    const controller = new AbortController();

    getBranding(controller.signal)
      .then((branding) => {
        if (branding?.barName) {
          setBarName(branding.barName);
        }
      })
      .catch(() => {
        // Keep the default bar name if the branding fetch fails.
      });

    return () => {
      controller.abort();
    };
  }, []);

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
    setData: setTableData,
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
      filterAssignedTables(tables).sort(
        (left, right) => left.number - right.number,
      ),
    [tables],
  );
  const tableBindings = useMemo(
    () => buildTableBindings(visibleTables),
    [visibleTables],
  );

  const tableColumns = useMemo(
    () => getTableColumnCount(viewport.width),
    [viewport.width],
  );
  // A phone or narrow tablet portrait gets fewer, bigger table cards — reuse
  // that same threshold to bump up the tiny kiosk-monitor font sizes on the
  // table cards themselves so the table number stays readable.
  const isCompactTableLayout = tableColumns <= 4;

  // On phone/small-tablet, replace the row height/pitch that came from the
  // monitor layout (a % of the canvas height, which blows up huge once the
  // canvas is tall instead of wide) with a fixed, comfortable pixel height
  // converted to a % of the *actual measured* canvas height. Desktop/kiosk
  // (5-6 columns) keeps the original numbers untouched.
  const effectiveTableLayout = useMemo(() => {
    const baseLayout = getTableGridLayout(tableColumns);

    if (!isCompactTableLayout || !canvasSize.height) {
      return baseLayout;
    }

    return {
      ...baseLayout,
      rowTopStart: (COMPACT_TABLE_CARD_TOP_PX / canvasSize.height) * 100,
      rowHeight: (COMPACT_TABLE_CARD_HEIGHT_PX / canvasSize.height) * 100,
      rowPitch:
        ((COMPACT_TABLE_CARD_HEIGHT_PX + COMPACT_TABLE_CARD_GAP_PX) /
          canvasSize.height) *
        100,
    };
  }, [canvasSize.height, isCompactTableLayout, tableColumns]);

  const displayedBindings = useMemo(() => {
    const filteredBindings =
      selectedLocation === "all"
        ? tableBindings
        : tableBindings.filter(
            ({ table }) => table.location === selectedLocation,
          );

    // On phone/small tablet the manager's saved floor plan is kept, but scaled
    // down to fit the screen instead of replayed at its monitor coordinates
    // (which scattered the cards and pushed a whole column off the right
    // edge). Falls through to the plain grid when there's no plan to fit.
    if (isCompactTableLayout) {
      const fittedPlan = fitSavedPlanToCanvas(
        filteredBindings,
        effectiveTableLayout,
        canvasSize,
      );

      if (fittedPlan) {
        return fittedPlan;
      }
    }

    return compactBindingsToMonitorSlots(
      filteredBindings,
      effectiveTableLayout,
      !isCompactTableLayout,
    );
  }, [
    selectedLocation,
    tableBindings,
    effectiveTableLayout,
    isCompactTableLayout,
    canvasSize,
  ]);

  // Measures the actual table canvas (not just the window) so the compact
  // row height above can be based on real available space instead of a
  // guessed percentage. Re-runs whenever the canvas element appears/
  // disappears (loading finishes, section changes to one with/without
  // tables), since the canvas is only mounted when there's something to
  // show.
  useEffect(() => {
    const node = canvasRef.current;

    if (!node || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const applySize = (width, height) => {
      setCanvasSize((current) =>
        Math.round(current.width) === Math.round(width) &&
        Math.round(current.height) === Math.round(height)
          ? current
          : { width, height },
      );
    };

    const rect = node.getBoundingClientRect();
    applySize(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry) {
        applySize(entry.contentRect.width, entry.contentRect.height);
      }
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, [isLoading, displayedBindings.length]);

  const latestGuestOrderTable = useMemo(() => {
    const guestOrderBindings = tableBindings
      .filter(({ table }) => table.activeGuestOrder)
      .sort((left, right) => {
        const leftTime = new Date(
          left.table.activeGuestOrder?.updatedAt ||
            left.table.activeGuestOrder?.createdAt ||
            0,
        ).getTime();
        const rightTime = new Date(
          right.table.activeGuestOrder?.updatedAt ||
            right.table.activeGuestOrder?.createdAt ||
            0,
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
      activeGuestOrder.updatedAt ||
      activeGuestOrder.createdAt ||
      latestGuestOrderTable.table.id
    }`;
  }, [latestGuestOrderTable]);

  const summary = useMemo(
    () => buildTableSummary(visibleTables),
    [visibleTables],
  );
  const openTablesCount = summary.openOrder + summary.pendingPayment;
  const isTabletLayout = useMemo(() => {
    if (!viewport.width || !viewport.height) {
      return false;
    }

    const shortestSide = Math.min(viewport.width, viewport.height);
    const longestSide = Math.max(viewport.width, viewport.height);
    const hasTouchViewport =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)")?.matches ||
        navigator.maxTouchPoints > 0);

    return (
      viewport.width <= 1024 ||
      (hasTouchViewport && shortestSide <= 1024 && longestSide <= 1400)
    );
  }, [viewport]);

  const openOrderStatuses = useMemo(
    () =>
      new Set([
        "occupied",
        "pending",
        "preparing",
        "served",
        "pending_payment",
      ]),
    [],
  );

  // Note: selectedLocation is only ever set to "all" or one of the fixed
  // MONITOR_SECTIONS keys via the section buttons below, so no reset effect
  // is needed here. (A previous version reset the selection back to "all"
  // whenever the current waiter had no assigned tables in that section,
  // which made the location tabs look broken — switching to a section with
  // zero of *this waiter's* tables silently snapped back to "all" instead
  // of showing an empty section.)

  const handleTableSelect = useCallback(
    async (table, visualTableId = table.number) => {
      const tableStatus = normalizeStatus(table.status);
      const nextPathname = buildTablePath(visualTableId, table.number);
      setOpeningTableId(table.id);

      try {
        pushPathname(nextPathname);

        if (openOrderStatuses.has(tableStatus)) {
          const activeOrder = await getActiveOrderByTable(
            session.token,
            table.id,
          );

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
            requestError.message ||
            `Unable to open table ${visualTableId}. Please try again.`,
        });
      } finally {
        setOpeningTableId(null);
      }
    },
    [logout, openOrderStatuses, selectTable, session.token, showNotice],
  );

  // Manager-only floor arrangement: drag a table card anywhere on the
  // canvas and its position (as a % of the canvas) is saved to the table.
  const clampPercent = useCallback(
    (value, max) => Math.min(Math.max(value, 0), Math.max(max, 0)),
    [],
  );

  const handleTablePointerDown = useCallback(
    (event, binding) => {
      if (!isArrangeMode || !canManageLayout) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (captureError) {
        // Pointer capture can fail in rare edge cases (e.g. already-released
        // pointer) — dragging still works without it, just less smoothly.
      }

      setDragState({
        tableId: binding.table.id,
        pointerId: event.pointerId,
        left: binding.slot.left,
        top: binding.slot.top,
        width: binding.slot.width,
        height: binding.slot.height,
      });
    },
    [canManageLayout, isArrangeMode],
  );

  const handleCanvasPointerMove = useCallback(
    (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();

      if (!rect.width || !rect.height) {
        return;
      }

      const rawLeft = ((event.clientX - rect.left) / rect.width) * 100;
      const rawTop = ((event.clientY - rect.top) / rect.height) * 100;

      setDragState((current) => {
        if (!current || current.pointerId !== event.pointerId) {
          return current;
        }

        return {
          ...current,
          left: clampPercent(rawLeft - current.width / 2, 100 - current.width),
          top: clampPercent(rawTop - current.height / 2, 100 - current.height),
        };
      });
    },
    [clampPercent, dragState],
  );

  const handleCanvasPointerUp = useCallback(
    async (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      const finishedDrag = dragState;
      setDragState(null);

      const nextPositionX = Number(finishedDrag.left.toFixed(2));
      const nextPositionY = Number(finishedDrag.top.toFixed(2));

      setTableData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          tables: current.tables.map((table) =>
            table.id === finishedDrag.tableId
              ? { ...table, positionX: nextPositionX, positionY: nextPositionY }
              : table,
          ),
        };
      });

      setSavingPositionTableId(finishedDrag.tableId);

      try {
        await updateTablePosition(session.token, finishedDrag.tableId, {
          positionX: nextPositionX,
          positionY: nextPositionY,
        });
      } catch (requestError) {
        if (requestError.status === 401) {
          logout();
          return;
        }

        showNotice({
          type: "error",
          message:
            requestError.message ||
            "Nuk u ruajt pozicioni i tavolines. Provo perseri.",
        });
      } finally {
        setSavingPositionTableId(null);
      }
    },
    [dragState, logout, session.token, setTableData, showNotice],
  );

  // Arranging the floor plan is a big-screen feature: the dragged positions
  // are saved as a % of a wide monitor canvas and are not used on phone/small
  // tablet (see resolveTableSlot), so letting someone drag there would look
  // like the card "snaps back" for no reason.
  useEffect(() => {
    if ((!canManageLayout || isCompactTableLayout) && isArrangeMode) {
      setIsArrangeMode(false);
    }
  }, [canManageLayout, isArrangeMode, isCompactTableLayout]);

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
    const matchedBinding = tableBindings.find(
      (binding) => binding.visualId === visualTableId,
    );

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
        activeGuestOrder.updatedAt ||
        activeGuestOrder.createdAt ||
        new Date().toISOString(),
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
          className={`grid min-h-full w-full min-w-0 rounded-none border-0 bg-[#d3e3fa] p-0 ${
            isTabletLayout
              ? "grid-cols-1 grid-rows-[minmax(0,1fr)_auto] gap-px"
              : "grid-cols-[minmax(0,1fr)_84px] gap-px sm:grid-cols-[minmax(0,1fr)_104px] sm:gap-px"
          }`}
        >
          <div className="relative min-h-0 min-w-0 overflow-hidden rounded-none border-0 bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_48%,#f3f8ff_100%)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_21%_18%,rgba(31,162,255,0.05)_0%,transparent_22%),radial-gradient(circle_at_70%_48%,rgba(31,162,255,0.07)_0%,transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.5)_0%,transparent_24%,transparent_100%)]" />

            <div className="relative z-10 flex h-full min-h-0 flex-col">
              <div className="flex items-center justify-between border-b border-[#e1ecfb] px-[5px] py-[4px] text-[9px] font-medium tracking-[0.08em] text-[#5c7093] sm:px-[6px] sm:text-[10px]">
                <span>{getLocationLabel(selectedLocation)}</span>
                {canManageLayout && !isCompactTableLayout ? (
                  <button
                    type="button"
                    onClick={() => setIsArrangeMode((current) => !current)}
                    className={`rounded-[2px] border px-[6px] py-[2px] text-[8px] font-semibold uppercase tracking-[0.08em] transition sm:text-[9px] ${
                      isArrangeMode
                        ? "border-[#0f6bb8] bg-[#0f6bb8] text-white"
                        : "border-[#8fb8ee] bg-white text-[#0f6bb8] hover:bg-[#eef5ff]"
                    }`}
                  >
                    {isArrangeMode
                      ? "Mbylle Rregullimin"
                      : "Rregullo Tavolinat"}
                  </button>
                ) : (
                  <span>POS</span>
                )}
              </div>

              {isArrangeMode ? (
                <div className="mx-[6px] mt-[6px] rounded-[2px] border border-[#8fb8ee] bg-[#eef5ff] px-2 py-1 text-[9px] text-[#0f6bb8] sm:text-[10px]">
                  Terhiqe nje tavoline kudo don. Ruhet vet automatikisht.
                </div>
              ) : null}

              {error ? (
                <div className="mx-[6px] mt-[6px] rounded-[2px] border border-[#f3c3c9] bg-[#fdedef] px-2 py-1 text-[10px] text-[#b3364a] sm:text-[11px]">
                  {error}
                </div>
              ) : null}

              <div className="relative min-h-0 flex-1 overflow-hidden">
                {isLoading ? (
                  <div className="flex h-full items-center justify-center px-3 py-4">
                    <PosScreenLoader label="Loading tables..." />
                  </div>
                ) : visibleTables.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 py-4 text-center text-[11px] text-[#5c7093] sm:text-[12px]">
                    Nuk ka asnje tavoline te krijuar ende.
                  </div>
                ) : displayedBindings.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 py-4 text-center text-[11px] text-[#5c7093] sm:text-[12px]">
                    Nuk ka tavolina ne kete seksion.
                  </div>
                ) : (
                  <div className="relative h-full">
                    <div
                      ref={canvasRef}
                      className="absolute inset-[6px_6px_18px_6px]"
                      onPointerMove={handleCanvasPointerMove}
                      onPointerUp={handleCanvasPointerUp}
                      onPointerCancel={handleCanvasPointerUp}
                    >
                      {displayedBindings.map(({ table, visualId, slot }) => {
                        const isOpening = openingTableId === table.id;
                        const isGuestHighlighted =
                          highlightedGuestTableId === table.id;
                        const theme = getTableCardTheme(
                          table.status,
                          isOpening,
                        );
                        const showMeta =
                          normalizeStatus(table.status) !== "available";
                        const isDraggingThis = dragState?.tableId === table.id;
                        const isSavingPosition =
                          savingPositionTableId === table.id;
                        const activeSlot = isDraggingThis
                          ? {
                              left: dragState.left,
                              top: dragState.top,
                              width: dragState.width,
                              height: dragState.height,
                            }
                          : slot;
                        // A dense saved floor plan can squeeze the cards
                        // narrower than the full "Tavolina - 12" fits; those
                        // show just the number instead of a clipped name.
                        const showShortLabel =
                          isCompactTableLayout &&
                          canvasSize.width > 0 &&
                          (activeSlot.width / 100) * canvasSize.width <
                            COMPACT_PLAN_NAME_MIN_CARD_WIDTH_PX;

                        return (
                          <button
                            key={table.id}
                            type="button"
                            onClick={() => {
                              if (isArrangeMode) {
                                return;
                              }

                              handleTableSelect(table, visualId);
                            }}
                            onPointerDown={(event) =>
                              handleTablePointerDown(event, { table, slot })
                            }
                            disabled={isOpening}
                            className={`absolute select-none flex flex-col justify-start overflow-hidden rounded-[2px] border px-[6px] py-[5px] text-left outline-none transition duration-150 disabled:cursor-progress disabled:opacity-90 ${theme.className} ${
                              isGuestHighlighted
                                ? "ring-2 ring-[#ffd977] ring-offset-0 shadow-[0_0_0_1px_rgba(255,219,119,0.55),0_0_16px_rgba(255,211,97,0.36)]"
                                : ""
                            } ${
                              isArrangeMode
                                ? "touch-none cursor-grab ring-1 ring-dashed ring-[#8fb8ee] active:cursor-grabbing"
                                : "hover:brightness-105 focus-visible:brightness-105 active:scale-[0.99]"
                            } ${isDraggingThis ? "z-30 shadow-[0_6px_16px_rgba(15,107,184,0.35)] ring-2 ring-[#0f6bb8]" : ""}`}
                            style={{
                              left: `${activeSlot.left}%`,
                              top: `${activeSlot.top}%`,
                              width: `${activeSlot.width}%`,
                              height: `${activeSlot.height}%`,
                            }}
                            aria-label={`Open Table ${visualId}`}
                            title={`Table ${visualId}`}
                          >
                            {isGuestHighlighted ? (
                              <span className="absolute right-[5px] top-[5px] rounded-full border border-[#fff1bf] bg-[#f1bd58] px-[5px] py-[1px] text-[7px] font-bold uppercase tracking-[0.12em] text-[#392306]">
                                QR
                              </span>
                            ) : null}
                            {isSavingPosition ? (
                              <span className="absolute right-[5px] top-[5px] h-[6px] w-[6px] animate-pulse rounded-full bg-[#0f6bb8]" />
                            ) : null}
                            <span
                              className={`absolute inset-y-0 left-0 w-[3px] ${theme.stripeClass}`}
                            />
                            <span
                              className={`pl-[5px] font-medium tracking-[0.01em] text-[#12213d] ${
                                showShortLabel
                                  ? "text-[15px] font-semibold"
                                  : isCompactTableLayout
                                    ? "text-[12px]"
                                    : "text-[9px]"
                              }`}
                            >
                              {showShortLabel
                                ? visualId
                                : `Tavolina - ${visualId}`}
                            </span>
                            <span
                              className={`mt-[3px] pl-[5px] font-medium leading-tight ${theme.metaTextClass} ${
                                isCompactTableLayout
                                  ? "text-[10px]"
                                  : "text-[8px]"
                              }`}
                            >
                              {showMeta ? theme.label : "\u00A0"}
                            </span>
                          </button>
                        );
                      })}
                    </div>

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
                    onClick={() => setSelectedLocation(section.key)}
                    className={`min-h-[56px] border px-1 text-center text-[9px] font-medium tracking-[0.04em] transition ${
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
                <span className="text-[8px] uppercase tracking-[0.16em]">
                  Totali
                </span>
                <span className="mt-1 text-[10px] font-semibold">
                  {formatPrice(dailyPaidTotals.totalPaid)}
                </span>
              </div>

              <button
                type="button"
                className="min-h-[54px] border border-[#e3607a] bg-[linear-gradient(180deg,#eb5a6b_0%,#c23a52_100%)] px-1 text-center text-[8px] font-semibold tracking-[0.06em] text-white transition hover:brightness-105 active:scale-[0.99]"
                onClick={logout}
              >
                Logout
              </button>

              <div className="flex min-h-[54px] flex-col items-center justify-center border border-[#e6b657] bg-[linear-gradient(180deg,#f2c977_0%,#c48f3e_100%)] px-1 text-center text-white">
                <span className="text-[8px] uppercase tracking-[0.16em]">
                  Open
                </span>
                <span className="mt-1 text-[10px] font-bold">
                  {openTablesCount}
                </span>
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
                    onClick={() => setSelectedLocation(section.key)}
                    className={`flex-1 rounded-[2px] border px-1 text-center text-[9px] font-medium tracking-[0.04em] transition min-h-[82px] sm:min-h-[98px] sm:text-[10px] ${
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
                  <p className="m-0 text-[8px] uppercase tracking-[0.24em] text-[#5c7093]">
                    Terminal
                  </p>
                  <p className="m-0 mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0f6bb8] sm:text-[12px]">
                    {barName}
                  </p>
                  <p className="m-0 mt-2 text-[8px] uppercase tracking-[0.18em] text-[#5c7093]">
                    Table Control
                  </p>
                </div>
              </div>

              <div className="rounded-[2px] border border-[#5fb46a] bg-[linear-gradient(180deg,#5fc26c_0%,#2f8f45_100%)] px-1 py-3 text-center text-white sm:py-4">
                <p className="m-0 text-[8px] uppercase tracking-[0.16em]">
                  Totali
                </p>
                <p className="m-0 mt-1 text-[10px] font-semibold sm:text-[11px]">
                  {formatPrice(dailyPaidTotals.totalPaid)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-[4px]">
                <button
                  type="button"
                  className="min-h-[58px] rounded-[2px] border border-[#e3607a] bg-[linear-gradient(180deg,#eb5a6b_0%,#c23a52_100%)] px-1 text-center text-[8px] font-semibold tracking-[0.06em] text-white transition hover:brightness-105 active:scale-[0.99] sm:min-h-[64px] sm:text-[9px]"
                  onClick={logout}
                >
                  Logout
                </button>

                <div className="flex min-h-[58px] flex-col items-center justify-center rounded-[2px] border border-[#e6b657] bg-[linear-gradient(180deg,#f2c977_0%,#c48f3e_100%)] px-1 text-center text-white sm:min-h-[64px]">
                  <span className="text-[8px] uppercase tracking-[0.16em]">
                    Open
                  </span>
                  <span className="mt-1 text-[10px] font-bold sm:text-[11px]">
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
