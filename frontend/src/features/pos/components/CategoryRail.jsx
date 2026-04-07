export default function CategoryRail({
  categories,
  selectedCategoryKey,
  onSelectCategory,
}) {
  return (
    <aside className="flex h-full flex-col rounded-[28px] border border-[#2c4555] bg-[linear-gradient(180deg,rgba(12,25,34,0.98)_0%,rgba(14,35,41,0.98)_100%)] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="m-0 text-[10px] uppercase tracking-[0.2em] text-[#8da3af]">
            Menu
          </p>
          <h2 className="m-0 mt-2 text-lg font-semibold tracking-[-0.03em] text-[#f7f3ea]">
            Categories
          </h2>
        </div>

        <span className="inline-flex min-h-[30px] min-w-[30px] items-center justify-center rounded-full border border-[#3b5565] bg-[rgba(15,26,38,0.82)] px-2 text-xs font-semibold text-[#d8e1eb]">
          {categories.length}
        </span>
      </div>

      <div className="scroll-y grid flex-1 auto-rows-[minmax(78px,auto)] gap-2 overflow-y-auto pr-1">
        {categories.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#405f6d] bg-[rgba(11,20,28,0.48)] px-3 py-4 text-xs text-[#8fa2b2]">
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
                className={`touch-tile min-h-[88px] rounded-[20px] border px-3 py-3 text-left transition ${
                  isActive
                    ? "border-[#4ca59e] bg-[linear-gradient(180deg,rgba(55,143,135,0.98)_0%,rgba(27,87,84,0.99)_100%)] text-[#071311] shadow-[0_10px_26px_rgba(22,85,81,0.24)]"
                    : "border-[#35505f] bg-[linear-gradient(180deg,rgba(18,35,46,0.98)_0%,rgba(16,27,37,0.99)_100%)] text-[#e6edf5] hover:border-[#4a6a7c] hover:bg-[linear-gradient(180deg,rgba(23,42,55,0.98)_0%,rgba(19,32,42,0.99)_100%)]"
                }`}
              >
                <div className="flex h-full flex-col justify-between gap-2">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug sm:text-[15px]">
                    {category.label}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-[0.16em] ${
                      isActive ? "text-[#093631]" : "text-[#8fa2b2]"
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
