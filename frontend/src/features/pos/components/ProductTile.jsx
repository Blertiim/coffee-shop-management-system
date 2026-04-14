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
      className={`touch-tile group relative flex min-h-[164px] flex-col justify-between overflow-hidden rounded-[8px] border p-4 text-left transition duration-150 ${
        disabled
          ? "cursor-not-allowed border-[#25434b] bg-[rgba(10,24,31,0.76)] opacity-55"
          : "border-[#2a5152] bg-[linear-gradient(180deg,rgba(12,31,38,0.98)_0%,rgba(9,24,29,0.99)_100%)] shadow-[0_14px_30px_rgba(0,0,0,0.22)] hover:-translate-y-0.5 hover:border-[#42d17b] hover:shadow-[0_18px_38px_rgba(0,0,0,0.3)] active:scale-[0.99]"
      }`}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#1b7f59_0%,#46d77f_52%,#1aa7a0_100%)]" />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#7fb2a0]">
            {product.category?.name || "Menu Item"}
          </p>
          <h3 className="m-0 mt-2 line-clamp-2 text-[19px] font-semibold leading-tight text-[#eff8f6] transition group-hover:text-white">
            {product.name}
          </h3>
        </div>

        <span className="shrink-0 rounded-[8px] border border-[#2f5f53] bg-[#0c1d22] px-2.5 py-1 text-[11px] font-semibold text-[#d7f4e5]">
          {product.stock} left
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.16em] text-[#8fb6b2]">
          Tap to add
        </span>
        <span className="text-[1.55rem] font-semibold tracking-[-0.02em] text-[#d8ffe3]">
          {formatPrice(product.price)} EUR
        </span>
      </div>
    </button>
  );
}
