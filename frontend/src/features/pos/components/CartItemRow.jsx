const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function CartItemRow({ item, onRemove, onChangeQuantity }) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="m-0 line-clamp-2 text-sm font-semibold text-white">{item.name}</h3>
        <button
          type="button"
          onClick={() => onRemove(item.productId)}
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-red-500/15 text-sm font-bold text-red-300 hover:bg-red-500/25"
        >
          X
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-lg border border-white/15 bg-black/20">
          <button
            type="button"
            onClick={() => onChangeQuantity(item.productId, -1)}
            className="inline-flex h-9 min-w-9 items-center justify-center text-lg font-semibold text-pos-text hover:bg-white/10"
          >
            -
          </button>

          <span className="inline-flex min-w-8 items-center justify-center px-2 text-sm font-semibold text-white">
            {item.quantity}
          </span>

          <button
            type="button"
            onClick={() => onChangeQuantity(item.productId, 1)}
            className="inline-flex h-9 min-w-9 items-center justify-center text-lg font-semibold text-pos-text hover:bg-white/10"
          >
            +
          </button>
        </div>

        <span className="text-sm font-semibold text-pos-accent">
          {formatPrice(item.quantity * item.price)} EUR
        </span>
      </div>
    </article>
  );
}
