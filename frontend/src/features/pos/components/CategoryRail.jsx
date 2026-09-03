export default function CategoryRail({ categories, selectedCategoryKey, onSelectCategory }) {
  return (
    <aside className="flex min-h-0 flex-col rounded-[8px] border border-[#d3e3fa] bg-white p-3 shadow-[0_10px_24px_rgba(20,55,110,0.08)] xl:h-full">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#5c7093]">Left Sidebar</p>
          <h2 className="m-0 mt-2 text-lg font-semibold tracking-[-0.02em] text-[#12213d]">
            Categories
          </h2>
        </div>

        <span className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-[#c7dcf7] bg-[#eaf2fb] px-2 text-xs font-semibold text-[#0f6bb8]">
          {categories.length}
        </span>
      </div>

      <div className="scroll-y grid flex-1 auto-rows-max content-start items-start gap-2 overflow-y-auto pr-1">
        {categories.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-[#c7dcf7] bg-[#f3f8ff] px-3 py-4 text-xs text-[#5c7093]">
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
                className={`touch-tile min-h-[88px] w-full self-start rounded-[8px] border px-3 py-3 text-left transition ${
                  isActive
                    ? "border-[#1fa2ff] bg-[linear-gradient(180deg,#4f9dff_0%,#1a86e0_100%)] text-white shadow-[0_14px_30px_rgba(20,55,110,0.22)]"
                    : "border-[#d3e3fa] bg-[#f7faff] text-[#12213d] hover:border-[#8fb8ee] hover:bg-[#eef5ff]"
                }`}
              >
                <div className="flex h-full flex-col justify-between gap-2">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug sm:text-[15px]">
                    {category.label}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-[0.16em] ${
                      isActive ? "text-[#eaf5ff]" : "text-[#5c7093]"
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
