const STATUS_MAP = {
  available: {
    label: "Available",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  },
  occupied: {
    label: "Open Order",
    className: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  },
  reserved: {
    label: "Reserved",
    className: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  },
  pending: {
    label: "Open Order",
    className: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  },
  preparing: {
    label: "Open Order",
    className: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  },
  served: {
    label: "Open Order",
    className: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
  },
  pending_payment: {
    label: "Pending Payment",
    className: "bg-orange-500/15 text-orange-300 border-orange-400/30",
  },
  paid: {
    label: "Paid",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-500/15 text-red-300 border-red-400/30",
  },
};

export default function StatusChip({ status }) {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
  const config = STATUS_MAP[normalized] || {
    label: status || "Unknown",
    className: "bg-white/10 text-slate-200 border-white/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${config.className}`}
    >
      {config.label}
    </span>
  );
}
