const STATUS_MAP = {
  available: {
    label: "Available",
    className: "border-[#bfe6cf] bg-[#e7f7ed] text-[#157347]",
  },
  occupied: {
    label: "Open Order",
    className: "border-[#f0d9b0] bg-[#fdf3e0] text-[#a15c1f]",
  },
  reserved: {
    label: "Reserved",
    className: "border-[#dcd0f5] bg-[#f3eefd] text-[#6a4cc2]",
  },
  pending: {
    label: "Open Order",
    className: "border-[#f0d9b0] bg-[#fdf3e0] text-[#a15c1f]",
  },
  preparing: {
    label: "Open Order",
    className: "border-[#c7dcf7] bg-[#eaf2fb] text-[#0f6bb8]",
  },
  served: {
    label: "Open Order",
    className: "border-[#c7dcf7] bg-[#eef3fd] text-[#1554a3]",
  },
  pending_payment: {
    label: "Pending Payment",
    className: "border-[#f3cba3] bg-[#fdedd9] text-[#a15c1f]",
  },
  paid: {
    label: "Paid",
    className: "border-[#bfe6cf] bg-[#e7f7ed] text-[#157347]",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-[#f3c3c9] bg-[#fdedef] text-[#b3364a]",
  },
};

export default function StatusChip({ status }) {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
  const config = STATUS_MAP[normalized] || {
    label: status || "Unknown",
    className: "bg-slate-900/5 text-[#47536b] border-slate-900/10",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${config.className}`}
    >
      {config.label}
    </span>
  );
}
