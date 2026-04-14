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
            ? "border-[#42d17b] bg-[linear-gradient(180deg,rgba(18,49,42,0.98)_0%,rgba(13,39,33,0.99)_100%)] shadow-[0_10px_24px_rgba(0,0,0,0.2)]"
            : "border-[#284951] bg-[linear-gradient(180deg,rgba(12,28,35,0.98)_0%,rgba(10,22,29,0.99)_100%)]"
          : "border-[#203740] bg-[linear-gradient(180deg,rgba(9,21,27,0.98)_0%,rgba(8,18,24,0.99)_100%)]"
      }`}
      onClick={canSelect ? () => onSelect(item.productId) : undefined}
      onKeyDown={canSelect ? handleKeyDown : undefined}
      role={canSelect ? "button" : undefined}
      tabIndex={canSelect ? 0 : undefined}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="m-0 line-clamp-2 text-[15px] font-semibold leading-snug text-[#eef8f4]">
            {item.name}
          </h3>
          <span
            className={`inline-flex min-h-[24px] items-center rounded-[999px] border px-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${
              isPending
                ? "border-[#356553] bg-[#143329] text-[#c9f6db]"
                : "border-[#335062] bg-[#122531] text-[#c9dfef]"
            }`}
          >
            {isPending ? "Ready" : "Sent"}
          </span>
        </div>
        <p className="m-0 mt-1 text-xs text-[#86a7ad]">
          {formatPrice(item.price)} EUR each
        </p>
      </div>

      <div className="flex justify-center">
        {isPending ? (
          <div
            className={`inline-flex items-center rounded-[8px] border ${
              selected ? "border-[#42d17b] bg-[#0a1a16]" : "border-[#2c5058] bg-[#09161c]"
            }`}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChangeQuantity(item.productId, -1);
              }}
              disabled={disabled}
              className="inline-flex h-11 min-w-11 items-center justify-center text-xl font-semibold text-[#e7f5f2] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
            >
              -
            </button>

            <span className="inline-flex min-w-[38px] items-center justify-center px-2 text-base font-semibold text-[#f3faf8]">
              {item.quantity}
            </span>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChangeQuantity(item.productId, 1);
              }}
              disabled={disabled}
              className="inline-flex h-11 min-w-11 items-center justify-center text-xl font-semibold text-[#e7f5f2] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
            >
              +
            </button>
          </div>
        ) : (
          <span className="inline-flex min-h-[44px] min-w-[74px] items-center justify-center rounded-[8px] border border-[#294550] bg-[#0b171d] px-3 text-sm font-semibold text-[#e7f2f3]">
            x{item.quantity}
          </span>
        )}
      </div>

      <div className="text-right">
        <p className="m-0 text-base font-semibold tracking-[-0.01em] text-[#d8ffe3]">
          {formatPrice(lineTotal)} EUR
        </p>
        <p className="m-0 mt-1 text-[11px] uppercase tracking-[0.14em] text-[#7e9aa1]">
          {isPending ? (selected ? "Selected" : "Tap to edit") : "On ticket"}
        </p>
      </div>
    </article>
  );
}
