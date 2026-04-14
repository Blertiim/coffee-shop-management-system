export default function CategoryRail({
  categories,
  selectedCategoryKey,
  onSelectCategory,
}) {
  return (
    <aside className="flex min-h-0 flex-col rounded-[8px] border border-[#21434a] bg-[linear-gradient(180deg,rgba(7,23,29,0.98)_0%,rgba(7,29,34,0.98)_100%)] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.24)] xl:h-full">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#80a0a7]">
            Left Sidebar
          </p>
          <h2 className="m-0 mt-2 text-lg font-semibold tracking-[-0.02em] text-[#eff8f6]">
            Categories
          </h2>
        </div>

        <span className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-[#2c5552] bg-[#0e2228] px-2 text-xs font-semibold text-[#e3f2ee]">
          {categories.length}
        </span>
      </div>

      <div className="scroll-y grid flex-1 auto-rows-[minmax(82px,auto)] gap-2 overflow-y-auto pr-1">
        {categories.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-[#2c5552] bg-[#0c1b20] px-3 py-4 text-xs text-[#8fa2b2]">
            No categories
          </div>
        ) : (
          categories.map((category) => {
            const isActive = selectedCategoryKey === category.key;

            return (
              <button
                key={category.key}
                type="button"
                onClick={() => onSelectCategory(category.key)}
                className={`touch-tile min-h-[88px] rounded-[8px] border px-3 py-3 text-left transition ${
                  isActive
                    ? "border-[#3cc574] bg-[linear-gradient(180deg,rgba(34,120,84,0.98)_0%,rgba(24,88,63,0.99)_100%)] text-white shadow-[0_14px_30px_rgba(17,72,55,0.28)]"
                    : "border-[#274852] bg-[linear-gradient(180deg,rgba(12,30,38,0.98)_0%,rgba(10,23,30,0.99)_100%)] text-[#e4f0f2] hover:border-[#3cc574] hover:bg-[linear-gradient(180deg,rgba(14,36,44,0.98)_0%,rgba(11,28,34,0.99)_100%)]"
                }`}
              >
                <div className="flex h-full flex-col justify-between gap-2">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug sm:text-[15px]">
                    {category.label}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-[0.16em] ${
                      isActive ? "text-[#d8ffea]" : "text-[#8faab0]"
                    }`}
                  >
                    {category.count} items
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
