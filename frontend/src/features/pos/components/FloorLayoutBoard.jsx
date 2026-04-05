import { useMemo, useState } from "react";

const FLOOR_PLAN_IMAGE_WIDTH = 650;
const FLOOR_PLAN_IMAGE_HEIGHT = 459;
const FLOOR_PLAN_ASPECT_RATIO = `${FLOOR_PLAN_IMAGE_WIDTH} / ${FLOOR_PLAN_IMAGE_HEIGHT}`;

const resolveFloorPlanImageCandidates = () =>
  [
    "/floor-plan-removebg.png",
    "/floor-plan-removebg.webp",
    "/floor-plan-removebg.jpg",
    "/floor-plan-removebg.jpeg",
    "/floor-plan.jpg",
    "/floor-plan.jpeg",
    "/floor-plan.png",
    "/floor-plan.jfif",
    "/plan.jfif",
    "/plan.jpg",
    "/plan.jpeg",
    "/plan.png",
    "/testpos.jfif",
    "/testpost.jfif",
  ].filter((value, index, collection) => collection.indexOf(value) === index);

const FLOOR_PLAN_IMAGE_CANDIDATES = resolveFloorPlanImageCandidates();

const SHOW_TABLE_OVERLAY_DEBUG =
  String(import.meta.env.VITE_POS_SHOW_TABLE_OVERLAYS || "").trim().toLowerCase() ===
  "true";

const normalizeStatus = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizeLocation = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

// Normalized hotspot centers detected for the current 650x459 floor-plan image.
const DETECTED_TABLE_CENTERS = [
  [24.09, 26.01],
  [16.15, 26.27],
  [64.34, 31.24],
  [44.4, 31.76],
  [58.62, 33.86],
  [12.83, 39.35],
  [20.22, 39.35],
  [28.34, 39.35],
  [59.91, 39.35],
  [56.22, 39.61],
  [87.6, 42.22],
  [67.29, 44.58],
  [64.71, 48.76],
  [81.32, 48.76],
  [20.4, 52.16],
  [13.38, 52.42],
  [37.94, 52.42],
  [64.71, 61.57],
  [59.91, 64.18],
  [67.85, 64.44],
  [27.6, 65.23],
  [20.4, 65.49],
  [63.23, 66.8],
  [79.11, 76.99],
  [87.97, 80.65],
  [19.48, 81.18],
  [23.17, 81.18],
  [38.86, 81.18],
  [47.72, 81.18],
  [34.25, 82.48],
  [42.37, 82.48],
  [14.68, 83.27],
];

const DETECTED_TABLE_HOTSPOTS = DETECTED_TABLE_CENTERS.map(([x, y]) => ({
  x,
  y,
  w: 6.4,
  h: 8.4,
  shape: "circle",
}));

const LOCATION_SPECIFIC_HOTSPOTS = {
  "terrace 1": [
    { x: 15.15, y: 80.72, w: 4.8, h: 11.6, shape: "rect" },
    { x: 24.08, y: 80.72, w: 4.8, h: 11.6, shape: "rect" },
    { x: 33.92, y: 80.72, w: 4.8, h: 11.6, shape: "rect" },
    { x: 43.23, y: 80.72, w: 4.8, h: 11.6, shape: "rect" },
    { x: 52.38, y: 80.72, w: 4.8, h: 11.6, shape: "rect" },
    { x: 61.62, y: 80.72, w: 4.8, h: 11.6, shape: "rect" },
  ],
};

const buildFallbackHotspot = (index, total) => {
  const columns = Math.max(2, Math.ceil(Math.sqrt(total)));
  const rows = Math.ceil(total / columns);
  const columnIndex = index % columns;
  const rowIndex = Math.floor(index / columns);

  return {
    x: 10 + ((columnIndex + 0.5) / columns) * 80,
    y: 18 + ((rowIndex + 0.5) / rows) * 66,
    w: 7.2,
    h: 9.2,
    shape: "rect",
  };
};

const getHotspotHoverClass = (status) => {
  const normalized = normalizeStatus(status);

  if (normalized === "pending_payment") {
    return "hover:border-orange-400 hover:bg-orange-500/10 hover:shadow-[0_0_0_2px_rgba(251,146,60,0.45),0_0_18px_rgba(251,146,60,0.32)] focus-visible:border-orange-400 focus-visible:bg-orange-500/10 focus-visible:shadow-[0_0_0_2px_rgba(251,146,60,0.45),0_0_18px_rgba(251,146,60,0.32)]";
  }

  if (normalized === "occupied" || ["pending", "preparing", "served"].includes(normalized)) {
    return "hover:border-red-400 hover:bg-red-500/10 hover:shadow-[0_0_0_2px_rgba(248,113,113,0.45),0_0_18px_rgba(248,113,113,0.32)] focus-visible:border-red-400 focus-visible:bg-red-500/10 focus-visible:shadow-[0_0_0_2px_rgba(248,113,113,0.45),0_0_18px_rgba(248,113,113,0.32)]";
  }

  if (normalized === "reserved") {
    return "hover:border-indigo-400 hover:bg-indigo-500/10 hover:shadow-[0_0_0_2px_rgba(129,140,248,0.45),0_0_18px_rgba(129,140,248,0.3)] focus-visible:border-indigo-400 focus-visible:bg-indigo-500/10 focus-visible:shadow-[0_0_0_2px_rgba(129,140,248,0.45),0_0_18px_rgba(129,140,248,0.3)]";
  }

  return "hover:border-emerald-400 hover:bg-emerald-500/10 hover:shadow-[0_0_0_2px_rgba(52,211,153,0.45),0_0_18px_rgba(52,211,153,0.32)] focus-visible:border-emerald-400 focus-visible:bg-emerald-500/10 focus-visible:shadow-[0_0_0_2px_rgba(52,211,153,0.45),0_0_18px_rgba(52,211,153,0.32)]";
};

const getHotspotDebugClass = (status) => {
  const normalized = normalizeStatus(status);

  if (normalized === "pending_payment") {
    return "border-orange-400/70 bg-orange-500/20";
  }

  if (normalized === "occupied" || ["pending", "preparing", "served"].includes(normalized)) {
    return "border-red-400/70 bg-red-500/20";
  }

  if (normalized === "reserved") {
    return "border-indigo-400/70 bg-indigo-500/20";
  }

  return "border-emerald-400/70 bg-emerald-500/20";
};

export const getFloorPlanBindings = (tables) => {
  const sortedTables = [...tables].sort((left, right) => left.number - right.number);
  const locationUsage = new Map();
  let genericHotspotIndex = 0;

  const bindings = sortedTables.map((table, index) => {
    const locationKey = normalizeLocation(table.location);
    const manualHotspots = LOCATION_SPECIFIC_HOTSPOTS[locationKey] || null;
    const locationIndex = locationUsage.get(locationKey) || 0;

    locationUsage.set(locationKey, locationIndex + 1);

    if (manualHotspots && locationIndex < manualHotspots.length) {
      return {
        table,
        hotspot: manualHotspots[locationIndex],
      };
    }

    const fallbackHotspot =
      DETECTED_TABLE_HOTSPOTS[genericHotspotIndex] ||
      buildFallbackHotspot(index, sortedTables.length);

    genericHotspotIndex += 1;

    return {
      table,
      hotspot: fallbackHotspot,
    };
  });

  const leftToRightOrder = [...bindings].sort((left, right) => {
    const deltaX = left.hotspot.x - right.hotspot.x;
    return Math.abs(deltaX) > 0.2 ? deltaX : left.hotspot.y - right.hotspot.y;
  });

  const visualIdByTableId = new Map(
    leftToRightOrder.map((binding, index) => [binding.table.id, index + 1])
  );

  return bindings.map((binding) => ({
    ...binding,
    visualId: visualIdByTableId.get(binding.table.id) || binding.table.number,
  }));
};

export default function FloorLayoutBoard({
  tables,
  selectedLocation,
  onTableSelect,
  openingTableId,
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const [isImageMissing, setIsImageMissing] = useState(
    FLOOR_PLAN_IMAGE_CANDIDATES.length === 0
  );

  const imageSrc = FLOOR_PLAN_IMAGE_CANDIDATES[imageIndex] || null;
  const tableBindings = useMemo(() => getFloorPlanBindings(tables), [tables]);
  const displayedBindings = useMemo(
    () =>
      selectedLocation === "all"
        ? tableBindings
        : tableBindings.filter(({ table }) => table.location === selectedLocation),
    [selectedLocation, tableBindings]
  );

  if (displayedBindings.length === 0) {
    return (
      <div className="pos-panel-soft flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-white/20 p-6 text-center">
        <p className="m-0 max-w-md text-sm text-pos-muted">No tables for this area yet.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div
        className="relative w-full max-w-[1120px] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-pos"
        style={{ aspectRatio: FLOOR_PLAN_ASPECT_RATIO }}
      >
        <div className="absolute inset-0 z-0 bg-white" />

        {!isImageMissing && imageSrc ? (
          <img
            src={imageSrc}
            alt="Restaurant floor plan"
            className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-fill"
            draggable={false}
            onError={() => {
              if (imageIndex < FLOOR_PLAN_IMAGE_CANDIDATES.length - 1) {
                setImageIndex((currentIndex) => currentIndex + 1);
                return;
              }

              setIsImageMissing(true);
            }}
          />
        ) : null}

        {isImageMissing ? (
          <>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,rgba(31,162,255,0.18)_0%,transparent_30%),radial-gradient(circle_at_88%_92%,rgba(44,201,167,0.16)_0%,transparent_34%)]" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-orange-300/40 bg-slate-900/70 px-4 py-3 text-center text-xs text-orange-100">
              <p className="m-0 font-semibold">Floor image not found</p>
              <p className="m-0 mt-1">
                Add the plan image in <span className="font-semibold">frontend/public/</span>
                <span className="ml-1">for example:</span>
                <span className="ml-1 font-semibold">floor-plan-removebg.png</span>
              </p>
            </div>
          </>
        ) : null}

        <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-lg border border-white/20 bg-slate-900/50 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-pos-muted">
          {selectedLocation === "all" ? "All Sections" : selectedLocation}
        </div>

        <div className="absolute inset-0 z-20">
          {displayedBindings.map(({ table, hotspot, visualId }) => {
            const isLoading = openingTableId === table.id;
            const idleSurfaceClass = SHOW_TABLE_OVERLAY_DEBUG
              ? getHotspotDebugClass(table.status)
              : "border-transparent bg-transparent";

            return (
              <button
                key={table.id}
                type="button"
                onClick={() => onTableSelect(table, visualId)}
                disabled={isLoading}
                data-table-id={`table-${visualId}`}
                aria-label={`Open Table ${visualId}`}
                title={`Table ${visualId}`}
                className={`absolute min-h-[42px] min-w-[42px] -translate-x-1/2 -translate-y-1/2 border outline-none transition duration-150 ${
                  hotspot.shape === "circle" ? "rounded-full" : "rounded-xl"
                } ${
                  isLoading
                    ? "cursor-progress border-amber-300/50 bg-amber-300/20 shadow-[0_0_0_2px_rgba(251,191,36,0.25)]"
                    : `cursor-pointer touch-manipulation active:scale-[0.98] hover:scale-[1.03] focus-visible:scale-[1.03] ${idleSurfaceClass} ${getHotspotHoverClass(table.status)}`
                }`}
                style={{
                  left: `${hotspot.x}%`,
                  top: `${hotspot.y}%`,
                  width: `${hotspot.w}%`,
                  height: `${hotspot.h}%`,
                }}
              >
                <span className="sr-only">{`table-${visualId}`}</span>
                {SHOW_TABLE_OVERLAY_DEBUG ? (
                  <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {visualId}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
