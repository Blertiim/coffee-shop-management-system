const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function ProductTile({ product, onAdd, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      disabled={disabled}
      className={`touch-tile group flex min-h-[128px] flex-col justify-between rounded-2xl border p-4 text-left shadow-pos transition duration-150 ${
        disabled
          ? "cursor-not-allowed border-white/10 bg-white/5 opacity-60"
          : "border-white/15 bg-pos-card hover:border-pos-accent/70 hover:bg-[#25518a] active:scale-[0.99]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="m-0 text-[17px] font-semibold text-white transition group-hover:text-sky-100">
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
