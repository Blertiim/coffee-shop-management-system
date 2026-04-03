import StatusChip from "./StatusChip";

export default function TableTile({ table, isOpening, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(table)}
      disabled={isOpening}
      className={`touch-tile flex min-h-[118px] flex-col justify-between rounded-2xl border p-4 text-left shadow-pos transition duration-150 ${
        isOpening
          ? "cursor-not-allowed border-white/10 bg-white/5 opacity-65"
          : "border-white/15 bg-pos-card hover:border-pos-accent/60 hover:bg-[#223458]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="m-0 text-lg font-semibold text-white">Table {table.number}</h3>
        <StatusChip status={table.status} />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-pos-muted">
        <span>{table.location || "Main Floor"}</span>
        <span>{isOpening ? "Opening..." : "Open"}</span>
      </div>
    </button>
  );
}
