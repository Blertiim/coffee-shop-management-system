import StatusChip from "./StatusChip";

const normalizeStatus = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const resolveActionConfig = (status) => {
  if (status === "available") {
    return {
      primaryLabel: "Open Table",
      primaryAction: "open",
      secondaryLabel: null,
      secondaryAction: null,
      primaryDisabled: false,
    };
  }

  if (status === "occupied") {
    return {
      primaryLabel: "Resume Order",
      primaryAction: "resume",
      secondaryLabel: "Generate Invoice",
      secondaryAction: "generate_invoice",
      primaryDisabled: false,
    };
  }

  if (status === "pending_payment") {
    return {
      primaryLabel: "Complete Payment",
      primaryAction: "complete_payment",
      secondaryLabel: "Invoice PDF",
      secondaryAction: "invoice_pdf",
      primaryDisabled: false,
    };
  }

  if (status === "paid") {
    return {
      primaryLabel: "Paid",
      primaryAction: "paid",
      secondaryLabel: null,
      secondaryAction: null,
      primaryDisabled: true,
    };
  }

  return {
    primaryLabel: "Open Table",
    primaryAction: "open",
    secondaryLabel: null,
    secondaryAction: null,
    primaryDisabled: false,
  };
};

export default function TableTile({
  table,
  actionState,
  onPrimaryAction,
  onSecondaryAction,
}) {
  const normalizedStatus = normalizeStatus(table.status);
  const config = resolveActionConfig(normalizedStatus);
  const isPrimaryLoading = actionState === config.primaryAction;
  const isSecondaryLoading = actionState === config.secondaryAction;
  const isBusy = Boolean(actionState);

  return (
    <article className="touch-tile flex min-h-[152px] flex-col justify-between rounded-2xl border border-white/15 bg-pos-card p-4 text-left shadow-pos">
      <div className="flex items-start justify-between gap-3">
        <h3 className="m-0 text-lg font-semibold text-white">Table {table.number}</h3>
        <StatusChip status={table.status} />
      </div>

      <div className="mt-2 space-y-1 text-sm text-pos-muted">
        <p className="m-0">{table.location || "Main Floor"}</p>
        <p className="m-0 text-xs">
          {table.assignedWaiter?.fullName
            ? `Waiter: ${table.assignedWaiter.fullName}`
            : "Waiter: Unassigned"}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="pos-button pos-button-primary min-h-[44px] rounded-xl px-3 text-xs font-bold uppercase tracking-wide"
          disabled={isBusy || config.primaryDisabled}
          onClick={() => onPrimaryAction(table, config.primaryAction)}
        >
          {isPrimaryLoading ? "Working..." : config.primaryLabel}
        </button>

        {config.secondaryLabel ? (
          <button
            type="button"
            className="pos-button pos-button-muted min-h-[44px] rounded-xl px-3 text-xs font-semibold uppercase tracking-wide"
            disabled={isBusy}
            onClick={() => onSecondaryAction(table, config.secondaryAction)}
          >
            {isSecondaryLoading ? "Working..." : config.secondaryLabel}
          </button>
        ) : (
          <div />
        )}
      </div>
    </article>
  );
}
