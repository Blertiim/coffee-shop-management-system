const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function CartItemRow({ item, onRemove, onChangeQuantity }) {
  return (
    <article className="rounded-[20px] border border-[#35505f] bg-[linear-gradient(180deg,rgba(17,31,41,0.98)_0%,rgba(13,24,33,0.99)_100%)] p-3.5 shadow-[0_12px_24px_rgba(0,0,0,0.16)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="m-0 line-clamp-2 text-[15px] font-semibold leading-snug text-[#f7f3ea]">
          {item.name}
        </h3>
        <button
          type="button"
          onClick={() => onRemove(item.productId)}
          className="inline-flex min-h-[34px] items-center justify-center rounded-[12px] border border-[#7f4557] bg-[rgba(89,31,46,0.82)] px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ffdce3] transition hover:brightness-110"
        >
          Remove
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-[14px] border border-[#395360] bg-[rgba(10,18,25,0.72)]">
          <button
            type="button"
            onClick={() => onChangeQuantity(item.productId, -1)}
            className="inline-flex h-10 min-w-10 items-center justify-center text-lg font-semibold text-[#e6edf5] transition hover:bg-white/10"
          >
            -
          </button>

          <span className="inline-flex min-w-[38px] items-center justify-center px-2 text-sm font-semibold text-[#f7f3ea]">
            {item.quantity}
          </span>

          <button
            type="button"
            onClick={() => onChangeQuantity(item.productId, 1)}
            className="inline-flex h-10 min-w-10 items-center justify-center text-lg font-semibold text-[#e6edf5] transition hover:bg-white/10"
          >
            +
          </button>
        </div>

        <span className="text-lg font-semibold tracking-[-0.02em] text-[#f0d6a2]">
          {formatPrice(item.quantity * item.price)} EUR
        </span>
      </div>
    </article>
  );
}
