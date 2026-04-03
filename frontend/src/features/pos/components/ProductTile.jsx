const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function ProductTile({ product, onAdd }) {
  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      className="touch-tile group flex min-h-[112px] flex-col justify-between rounded-2xl border border-white/15 bg-pos-card p-4 text-left shadow-pos transition duration-150 hover:border-pos-accent/70 hover:bg-[#243760] active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="m-0 text-base font-semibold text-white transition group-hover:text-sky-100">
          {product.name}
        </h3>
        <span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-pos-muted">
          Stock {product.stock}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <span className="text-sm text-pos-muted">{product.category?.name || "Drink"}</span>
        <span className="text-lg font-semibold text-pos-accent">
          {formatPrice(product.price)} EUR
        </span>
      </div>
    </button>
  );
}
