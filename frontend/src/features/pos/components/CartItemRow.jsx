const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function CartItemRow({
  item,
  variant = "pending",
  selected = false,
  onSelect,
  onChangeQuantity,
  disabled = false,
}) {
  const isPending = variant === "pending";
  const lineTotal = item.quantity * item.price;
  const canSelect = isPending && typeof onSelect === "function";

  const handleKeyDown = (event) => {
    if (!canSelect) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(item.productId);
    }
  };

  return (
    <article
      className={`grid grid-cols-[minmax(0,1fr)_110px_96px] items-center gap-3 rounded-[8px] border px-3 py-3 transition ${
        isPending
          ? selected
            ? "border-[#1fa2ff] bg-[#eaf5ff] shadow-[0_10px_24px_rgba(20,55,110,0.14)]"
            : "border-[#d3e3fa] bg-white"
          : "border-[#e1ecfb] bg-[#f7faff]"
      }`}
      onClick={canSelect ? () => onSelect(item.productId) : undefined}
      onKeyDown={canSelect ? handleKeyDown : undefined}
      role={canSelect ? "button" : undefined}
      tabIndex={canSelect ? 0 : undefined}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="m-0 line-clamp-2 text-[15px] font-semibold leading-snug text-[#12213d]">
            {item.name}
          </h3>
          <span
            className={`inline-flex min-h-[24px] items-center rounded-[999px] border px-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${
              isPending
                ? "border-[#bfe6cf] bg-[#e7f7ed] text-[#157347]"
                : "border-[#c7dcf7] bg-[#eaf2fb] text-[#0f6bb8]"
            }`}
          >
            {isPending ? "Ready" : "Sent"}
          </span>
        </div>
        <p className="m-0 mt-1 text-xs text-[#5c7093]">{formatPrice(item.price)} EUR each</p>
      </div>

      <div className="flex justify-center">
        {isPending ? (
          <div
            className={`inline-flex items-center rounded-[8px] border ${
              selected ? "border-[#1fa2ff] bg-white" : "border-[#d3e3fa] bg-[#f7faff]"
            }`}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChangeQuantity(item.productId, -1);
              }}
              disabled={disabled}
              className="inline-flex h-11 min-w-11 items-center justify-center text-xl font-semibold text-[#12213d] transition hover:bg-slate-900/5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              -
            </button>

            <span className="inline-flex min-w-[38px] items-center justify-center px-2 text-base font-semibold text-[#12213d]">
              {item.quantity}
            </span>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChangeQuantity(item.productId, 1);
              }}
              disabled={disabled}
              className="inline-flex h-11 min-w-11 items-center justify-center text-xl font-semibold text-[#12213d] transition hover:bg-slate-900/5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              +
            </button>
          </div>
        ) : (
          <span className="inline-flex min-h-[44px] min-w-[74px] items-center justify-center rounded-[8px] border border-[#e1ecfb] bg-white px-3 text-sm font-semibold text-[#12213d]">
            x{item.quantity}
          </span>
        )}
      </div>

      <div className="text-right">
        <p className="m-0 text-base font-semibold tracking-[-0.01em] text-[#1554a3]">
          {formatPrice(lineTotal)} EUR
        </p>
        <p className="m-0 mt-1 text-[11px] uppercase tracking-[0.14em] text-[#5c7093]">
          {isPending ? (selected ? "Selected" : "Tap to edit") : "On ticket"}
        </p>
      </div>
    </article>
  );
}
