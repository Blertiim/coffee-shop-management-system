const STATUS_MAP = {
  available: {
    label: "Available",
    className: "border-[#4ca59e]/40 bg-[#163736]/78 text-[#9ce7d4]",
  },
  occupied: {
    label: "Open Order",
    className: "border-[#b58a4b]/40 bg-[#322512]/78 text-[#f0d6a2]",
  },
  reserved: {
    label: "Reserved",
    className: "border-[#7a67af]/40 bg-[#241c39]/78 text-[#d9d0f8]",
  },
  pending: {
    label: "Open Order",
    className: "border-[#b58a4b]/40 bg-[#322512]/78 text-[#f0d6a2]",
  },
  preparing: {
    label: "Open Order",
    className: "border-[#5489a5]/40 bg-[#162d3b]/78 text-[#c9e6f4]",
  },
  served: {
    label: "Open Order",
    className: "border-[#5f7fb6]/40 bg-[#1b2943]/78 text-[#d5e0fb]",
  },
  pending_payment: {
    label: "Pending Payment",
    className: "border-[#c0794e]/40 bg-[#392116]/78 text-[#ffd9bb]",
  },
  paid: {
    label: "Paid",
    className: "border-[#67b26f]/40 bg-[#16311b]/78 text-[#d5f3d8]",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-[#a95d72]/40 bg-[#33171f]/78 text-[#ffd7de]",
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
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${config.className}`}
    >
      {config.label}
    </span>
  );
}
