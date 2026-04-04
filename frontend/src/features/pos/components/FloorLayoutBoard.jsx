import { useMemo } from "react";

const normalizeStatus = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const ZONE_PRESETS = {
  1: [{ x: 3, y: 6, w: 94, h: 88 }],
  2: [
    { x: 3, y: 6, w: 46, h: 88 },
    { x: 51, y: 6, w: 46, h: 88 },
  ],
  3: [
    { x: 2.5, y: 6, w: 30.5, h: 88 },
    { x: 34.8, y: 6, w: 30.5, h: 88 },
    { x: 67.1, y: 6, w: 30.5, h: 88 },
  ],
  4: [
    { x: 3, y: 6, w: 46, h: 42 },
    { x: 51, y: 6, w: 46, h: 42 },
    { x: 3, y: 52, w: 46, h: 42 },
    { x: 51, y: 52, w: 46, h: 42 },
  ],
};

const getStatusConfig = (status) => {
  const normalized = normalizeStatus(status);

  if (normalized === "pending_payment") {
    return {
      label: "Pending",
      surfaceClass:
        "border-orange-300/70 bg-gradient-to-b from-orange-300/25 to-orange-500/15 text-orange-50",
    };
  }

  if (normalized === "occupied" || ["pending", "preparing", "served"].includes(normalized)) {
    return {
      label: "Open",
      surfaceClass:
        "border-amber-300/70 bg-gradient-to-b from-amber-300/25 to-amber-500/15 text-amber-50",
    };
  }

  if (normalized === "reserved") {
    return {
      label: "Reserved",
      surfaceClass:
        "border-indigo-300/70 bg-gradient-to-b from-indigo-300/25 to-indigo-500/15 text-indigo-50",
    };
  }

  return {
    label: "Available",
    surfaceClass:
      "border-emerald-300/70 bg-gradient-to-b from-emerald-300/25 to-emerald-500/15 text-emerald-50",
  };
};

const buildTablePosition = (index, total) => {
  if (total <= 1) {
    return { x: 50, y: 50 };
  }

  const columns = Math.max(2, Math.ceil(Math.sqrt(total)));
  const rows = Math.ceil(total / columns);
  const columnIndex = index % columns;
  const rowIndex = Math.floor(index / columns);
  const xOffset = rowIndex % 2 === 0 ? 0 : 50 / columns;

  return {
    x: Math.min(92, ((columnIndex + 0.5) / columns) * 100 + xOffset),
    y: ((rowIndex + 0.5) / rows) * 100,
  };
};

const buildZoneRects = (count) => {
  if (ZONE_PRESETS[count]) {
    return ZONE_PRESETS[count];
  }

  const columns = count <= 6 ? 3 : 4;
  const rows = Math.ceil(count / columns);
  const cellWidth = 94 / columns;
  const cellHeight = 88 / rows;
  const rects = [];

  for (let index = 0; index < count; index += 1) {
    const col = index % columns;
    const row = Math.floor(index / columns);

    rects.push({
      x: 3 + col * cellWidth,
      y: 6 + row * cellHeight,
      w: cellWidth - 1.2,
      h: cellHeight - 1.2,
    });
  }

  return rects;
};

export default function FloorLayoutBoard({
  tables,
  selectedLocation,
  onTableSelect,
  openingTableId,
}) {
  const zones = useMemo(() => {
    const grouped = tables.reduce((accumulator, table) => {
      const key = table.location || "Main Hall";
      if (!accumulator[key]) {
        accumulator[key] = [];
      }
      accumulator[key].push(table);
      return accumulator;
    }, {});

    const entries = Object.entries(grouped).map(([location, zoneTables]) => ({
      location,
      tables: zoneTables.slice().sort((left, right) => left.number - right.number),
    }));

    const filteredEntries =
      selectedLocation === "all"
        ? entries
        : entries.filter((entry) => entry.location === selectedLocation);

    return filteredEntries.sort((left, right) => left.location.localeCompare(right.location));
  }, [selectedLocation, tables]);

  const zoneRects = useMemo(() => buildZoneRects(zones.length), [zones.length]);

  if (zones.length === 0) {
    return (
      <div className="pos-panel-soft flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-white/20 p-6 text-center">
        <p className="m-0 max-w-md text-sm text-pos-muted">No tables for this area yet.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(180deg,rgba(22,48,88,0.82)_0%,rgba(15,35,67,0.94)_100%)] shadow-pos md:min-h-[500px] lg:min-h-[540px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,rgba(31,162,255,0.18)_0%,transparent_30%),radial-gradient(circle_at_88%_92%,rgba(44,201,167,0.16)_0%,transparent_34%)]" />

      {zones.map((zone, zoneIndex) => {
        const rect = zoneRects[zoneIndex] || { x: 3, y: 6, w: 94, h: 88 };

        return (
          <section
            key={zone.location}
            className="absolute rounded-2xl border border-white/20 bg-white/5 p-2 backdrop-blur-[1px]"
            style={{
              left: `${rect.x}%`,
              top: `${rect.y}%`,
              width: `${rect.w}%`,
              height: `${rect.h}%`,
            }}
          >
            <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-white/20 bg-slate-900/40 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-pos-muted">
              {zone.location}
            </div>

            <div className="relative h-full w-full">
              {zone.tables.map((table, tableIndex) => {
                const position = buildTablePosition(tableIndex, zone.tables.length);
                const status = getStatusConfig(table.status);
                const isLarge = Number(table.capacity || 4) > 4;
                const isLoading = openingTableId === table.id;

                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => onTableSelect(table)}
                    disabled={isLoading}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 border text-center shadow-[0_12px_18px_rgba(0,0,0,0.28)] transition duration-200 ${
                      isLarge ? "h-[74px] w-[112px] rounded-2xl" : "h-[82px] w-[82px] rounded-full"
                    } ${status.surfaceClass} ${
                      isLoading
                        ? "cursor-progress opacity-70"
                        : "hover:-translate-y-[54%] hover:scale-[1.04] active:scale-[0.98]"
                    }`}
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                    }}
                  >
                    <span className="block text-[15px] font-extrabold leading-tight text-white drop-shadow">
                      T{table.number}
                    </span>
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/90">
                      {status.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
