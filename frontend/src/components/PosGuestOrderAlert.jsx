const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export default function PosGuestOrderAlert({
  alert,
  isViewingSameTable = false,
  onDismiss,
  onShowTables,
}) {
  if (!alert?.tableId) {
    return null;
  }

  const primaryLabel = isViewingSameTable ? "Keep Working" : "Show Table Board";
  const summaryLine = alert.appendedToExistingOrder
    ? `Guest added ${alert.itemCount} item${alert.itemCount === 1 ? "" : "s"} to the active ticket.`
    : `Guest opened a new ticket with ${alert.itemCount} item${alert.itemCount === 1 ? "" : "s"}.`;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(3,8,12,0.72)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-[680px] overflow-hidden rounded-[18px] border border-[#e6b95d] bg-[linear-gradient(180deg,#36230a_0%,#20150a_100%)] shadow-[0_32px_90px_rgba(0,0,0,0.48)]">
        <div className="border-b border-[#e6b95d]/30 bg-[linear-gradient(90deg,rgba(226,166,65,0.26)_0%,rgba(226,166,65,0.08)_100%)] px-5 py-4">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.26em] text-[#ffe6b0]">
            Guest Order Incoming
          </p>
          <h2 className="m-0 mt-2 text-[1.7rem] font-semibold text-white">
            Table {alert.tableNumber || alert.tableId}
          </h2>
        </div>

        <div className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1fr)_180px]">
          <div>
            <p className="m-0 text-base font-semibold text-[#fff7e8]">{summaryLine}</p>
            <p className="m-0 mt-2 text-sm text-[#f5deb1]">
              {alert.location || "Guest QR order"} | Total ticket: {formatCurrency(alert.total)} EUR
            </p>
            <p className="m-0 mt-4 text-sm text-[#e7cfaa]">
              This alert stays loud on purpose so QR orders do not get missed.
            </p>
          </div>

          <div className="rounded-[14px] border border-[#d7b06c]/35 bg-[rgba(255,237,205,0.06)] px-4 py-4 text-center">
            <p className="m-0 text-[11px] uppercase tracking-[0.2em] text-[#ffe3ae]">
              Items Added
            </p>
            <p className="m-0 mt-2 text-4xl font-bold text-white">{alert.itemCount}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#e6b95d]/20 px-5 py-4 sm:flex-row">
          <button
            type="button"
            onClick={onShowTables}
            className="inline-flex min-h-[56px] flex-1 items-center justify-center rounded-[10px] border border-[#ffe09b] bg-[linear-gradient(180deg,#f1c46e_0%,#d59b33_100%)] px-4 text-sm font-bold text-[#291705] transition hover:brightness-105 active:scale-[0.99]"
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-[56px] items-center justify-center rounded-[10px] border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15 active:scale-[0.99]"
          >
            Dismiss Alert
          </button>
        </div>
      </div>
    </div>
  );
}
