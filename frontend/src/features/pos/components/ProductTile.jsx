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
      className={`touch-tile group relative flex min-h-[172px] w-full self-start flex-col overflow-hidden rounded-[8px] border p-4 text-left transition duration-150 ${
        disabled
          ? "cursor-not-allowed border-[#e1ecfb] bg-[#f3f8ff] opacity-55"
          : "border-[#d3e3fa] bg-white shadow-[0_10px_24px_rgba(20,55,110,0.08)] hover:-translate-y-0.5 hover:border-[#1fa2ff] hover:shadow-[0_16px_32px_rgba(20,55,110,0.14)] active:scale-[0.99]"
      }`}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#1554a3_0%,#1fa2ff_52%,#5cb4ff_100%)]" />

      <div className="flex min-w-0 items-start justify-between gap-2.5">
        <div className="min-w-0 pr-1">
          <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#5c7093]">
            {product.category?.name || "Menu Item"}
          </p>
          <h3 className="m-0 mt-2 line-clamp-2 text-[19px] font-semibold leading-tight text-[#12213d] transition group-hover:text-[#0a2547]">
            {product.name}
          </h3>
        </div>

        <span className="shrink-0 whitespace-nowrap rounded-[8px] border border-[#c7dcf7] bg-[#eaf2fb] px-2.5 py-1 text-[11px] font-semibold text-[#0f6bb8]">
          {product.stock} {product.stockUnit || "cope"} left
        </span>
      </div>

      <div className="mt-auto pt-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-2">
          <span className="min-w-0 text-xs uppercase leading-tight tracking-[0.16em] text-[#5c7093]">
            Tap to add
          </span>
          <span className="shrink-0 whitespace-nowrap text-right text-[1.55rem] font-semibold leading-none tracking-[-0.02em] text-[#1554a3]">
            {formatPrice(product.price)} EUR
          </span>
        </div>
      </div>
    </button>
  );
}
