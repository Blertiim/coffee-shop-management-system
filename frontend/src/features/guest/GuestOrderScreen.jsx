import { useEffect, useMemo, useState } from "react";

import PosScreenLoader from "../../components/PosScreenLoader";
import { getGuestMenu, submitGuestOrder } from "./guestApi";

const GUEST_ROUTE_PATTERN = /^\/guest\/table\/([^/]+)\/?$/;

const formatMoney = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const extractGuestToken = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const match = window.location.pathname.match(GUEST_ROUTE_PATTERN);
  return match?.[1] || "";
};

export default function GuestOrderScreen() {
  const [token] = useState(() => extractGuestToken());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [menu, setMenu] = useState({
    table: null,
    categories: [],
    products: [],
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [cart, setCart] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const loadMenu = async () => {
      setIsLoading(true);
      setError("");

      try {
        const payload = await getGuestMenu(token, controller.signal);

        if (!mounted) {
          return;
        }

        setMenu(payload || { table: null, categories: [], products: [] });
      } catch (requestError) {
        if (!mounted || requestError.name === "AbortError") {
          return;
        }

        setError(requestError.message || "Unable to load table menu.");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadMenu();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [token]);

  const orderableProducts = useMemo(
    () =>
      (menu.products || [])
        .filter((product) => product.isAvailable && product.stock > 0)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [menu.products],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map();

    orderableProducts.forEach((product) => {
      const key = String(product.categoryId);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return counts;
  }, [orderableProducts]);

  const categories = useMemo(
    () => (menu.categories || []).filter((category) => categoryCounts.has(String(category.id))),
    [categoryCounts, menu.categories],
  );

  useEffect(() => {
    if (!categories.length) {
      setSelectedCategoryId("");
      return;
    }

    setSelectedCategoryId((current) => {
      if (current && categories.some((category) => String(category.id) === current)) {
        return current;
      }

      return String(categories[0].id);
    });
  }, [categories]);

  const visibleProducts = useMemo(() => {
    if (!selectedCategoryId) {
      return orderableProducts;
    }

    return orderableProducts.filter((product) => String(product.categoryId) === selectedCategoryId);
  }, [orderableProducts, selectedCategoryId]);

  const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [cart],
  );

  const addProduct = (product) => {
    setSuccessMessage("");
    setCart((current) => {
      const existing = current.find((entry) => entry.productId === product.id);

      if (existing) {
        return current.map((entry) =>
          entry.productId === product.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ];
    });
  };

  const changeQuantity = (productId, delta) => {
    setCart((current) =>
      current
        .map((entry) =>
          entry.productId === productId ? { ...entry, quantity: entry.quantity + delta } : entry,
        )
        .filter((entry) => entry.quantity > 0),
    );
  };

  const handleSubmitOrder = async () => {
    if (!cart.length) {
      setError("Choose at least one item before sending the order.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      await submitGuestOrder(token, {
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      });

      setCart([]);
      setSuccessMessage(
        "Your order was sent to the bar successfully. Staff will see it immediately.",
      );
    } catch (requestError) {
      setError(requestError.message || "Unable to send the order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="pos-shell">
        <PosScreenLoader label="Preparing guest menu..." />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5f9ff_0%,#eef5ff_48%,#e8f1fd_100%)] px-4 py-5 text-[#12213d] sm:px-6 lg:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="rounded-[28px] border border-[#d3e3fa] bg-[linear-gradient(135deg,#ffffff_0%,#f7faff_52%,#eaf5ff_100%)] p-5 shadow-[0_18px_40px_rgba(20,55,110,0.1)]">
          <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-[#5c7093]">
            QR Guest Ordering
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="m-0 text-[clamp(2rem,5vw,3.2rem)] font-semibold tracking-[-0.05em] text-[#12213d]">
                {menu.table ? `Table ${menu.table.number}` : "Guest Menu"}
              </h1>
              <p className="m-0 mt-2 text-sm text-[#5c7093]">
                {menu.table?.location || "Scan the QR code on your table"} • Add items and send them
                straight to the live ticket.
              </p>
            </div>

            <div className="rounded-[20px] border border-[#c7dcf7] bg-[#eaf2fb] px-4 py-3">
              <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#5c7093]">Cart</p>
              <p className="m-0 mt-2 text-2xl font-semibold text-[#1554a3]">
                {formatMoney(cartTotal)} EUR
              </p>
              <p className="m-0 mt-1 text-xs text-[#5c7093]">{cartItemCount} items selected</p>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-[18px] border border-[#f3c3c9] bg-[#fdedef] px-4 py-3 text-sm font-medium text-[#b3364a]">
            {error}
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded-[18px] border border-[#bfe6cf] bg-[#e7f7ed] px-4 py-3 text-sm font-medium text-[#157347]">
            {successMessage}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
          <aside className="rounded-[28px] border border-[#d3e3fa] bg-white p-4 shadow-[0_10px_24px_rgba(20,55,110,0.06)]">
            <p className="m-0 text-[11px] uppercase tracking-[0.2em] text-[#5c7093]">Categories</p>
            <div className="mt-4 grid gap-2">
              {categories.map((category) => {
                const isActive = selectedCategoryId === String(category.id);

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(String(category.id))}
                    className={`rounded-[18px] border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-[#1fa2ff] bg-[linear-gradient(180deg,#4f9dff_0%,#1a86e0_100%)] text-white"
                        : "border-[#d3e3fa] bg-[#f7faff] text-[#12213d] hover:bg-[#eef5ff]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{category.name}</span>
                      <span className={`text-xs ${isActive ? "text-[#eaf5ff]" : "text-[#5c7093]"}`}>
                        {categoryCounts.get(String(category.id)) || 0}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-[28px] border border-[#d3e3fa] bg-white p-4 shadow-[0_10px_24px_rgba(20,55,110,0.06)]">
            <p className="m-0 text-[11px] uppercase tracking-[0.2em] text-[#5c7093]">Menu</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#c7dcf7] bg-[#f7faff] p-6 text-sm text-[#5c7093]">
                  No products are ready in this group right now.
                </div>
              ) : (
                visibleProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    className="rounded-[22px] border border-[#d3e3fa] bg-white p-4 text-left shadow-[0_10px_24px_rgba(20,55,110,0.08)] transition hover:border-[#1fa2ff] hover:translate-y-[-1px]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="m-0 text-base font-semibold text-[#12213d]">{product.name}</p>
                        <p className="m-0 mt-2 text-xs text-[#5c7093]">
                          {product.category?.name || "Menu"}
                        </p>
                      </div>
                      <span className="rounded-full border border-[#c7dcf7] bg-[#eaf2fb] px-2 py-1 text-[11px] text-[#0f6bb8]">
                        Stock {product.stock} {product.stockUnit || "cope"}
                      </span>
                    </div>
                    <p className="m-0 mt-4 text-xl font-semibold text-[#1554a3]">
                      {formatMoney(product.price)} EUR
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>

          <aside className="rounded-[28px] border border-[#d3e3fa] bg-white p-4 shadow-[0_10px_24px_rgba(20,55,110,0.06)]">
            <p className="m-0 text-[11px] uppercase tracking-[0.2em] text-[#5c7093]">Your Order</p>
            <div className="mt-4 space-y-3">
              {cart.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#c7dcf7] bg-[#f7faff] px-4 py-8 text-center text-sm text-[#5c7093]">
                  Tap menu cards to add items.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.productId}
                    className="rounded-[20px] border border-[#e1ecfb] bg-[#f7faff] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="m-0 text-sm font-semibold text-[#12213d]">{item.name}</p>
                        <p className="m-0 mt-1 text-xs text-[#5c7093]">
                          {formatMoney(item.price)} EUR each
                        </p>
                      </div>
                      <p className="m-0 text-sm font-semibold text-[#1554a3]">
                        {formatMoney(item.price * item.quantity)} EUR
                      </p>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.productId, -1)}
                        className="h-9 w-9 rounded-full border border-[#d3e3fa] bg-white text-lg text-[#12213d] hover:bg-[#eef5ff]"
                      >
                        -
                      </button>
                      <span className="min-w-[32px] text-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.productId, 1)}
                        className="h-9 w-9 rounded-full border border-[#d3e3fa] bg-white text-lg text-[#12213d] hover:bg-[#eef5ff]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 rounded-[22px] border border-[#c7dcf7] bg-[#eaf2fb] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#5c7093]">
                    Total
                  </p>
                  <p className="m-0 mt-1 text-sm text-[#5c7093]">
                    Sent directly to the live table ticket
                  </p>
                </div>
                <p className="m-0 text-2xl font-semibold text-[#1554a3]">
                  {formatMoney(cartTotal)} EUR
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmitOrder}
              disabled={isSubmitting || cart.length === 0}
              className="mt-4 inline-flex min-h-[56px] w-full items-center justify-center rounded-[18px] border border-[#34b26a] bg-[linear-gradient(180deg,#3ecf7e_0%,#1f9d5c_100%)] px-4 text-base font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Sending Order..." : "Send To Table"}
            </button>
          </aside>
        </section>
      </section>
    </main>
  );
}
