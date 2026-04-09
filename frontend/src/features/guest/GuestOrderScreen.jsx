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
    [menu.products]
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
    () =>
      (menu.categories || []).filter((category) => categoryCounts.has(String(category.id))),
    [categoryCounts, menu.categories]
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

    return orderableProducts.filter(
      (product) => String(product.categoryId) === selectedCategoryId
    );
  }, [orderableProducts, selectedCategoryId]);

  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [cart]
  );

  const addProduct = (product) => {
    setSuccessMessage("");
    setCart((current) => {
      const existing = current.find((entry) => entry.productId === product.id);

      if (existing) {
        return current.map((entry) =>
          entry.productId === product.id
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry
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
          entry.productId === productId
            ? { ...entry, quantity: entry.quantity + delta }
            : entry
        )
        .filter((entry) => entry.quantity > 0)
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
        "Your order was sent to the bar successfully. Staff will see it immediately."
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#071016_0%,#0b1820_45%,#081117_100%)] px-4 py-5 text-white sm:px-6 lg:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="rounded-[28px] border border-[#274453] bg-[linear-gradient(135deg,rgba(10,23,31,0.98)_0%,rgba(16,36,48,0.98)_52%,rgba(11,56,63,0.98)_100%)] p-5 shadow-[0_26px_60px_rgba(0,0,0,0.22)]">
          <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-[#9bc8d0]">
            QR Guest Ordering
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="m-0 text-[clamp(2rem,5vw,3.2rem)] font-semibold tracking-[-0.05em] text-[#f7f3ea]">
                {menu.table ? `Table ${menu.table.number}` : "Guest Menu"}
              </h1>
              <p className="m-0 mt-2 text-sm text-[#b6c8d2]">
                {menu.table?.location || "Scan the QR code on your table"} • Add items and send
                them straight to the live ticket.
              </p>
            </div>

            <div className="rounded-[20px] border border-[#355667] bg-[rgba(9,18,27,0.58)] px-4 py-3">
              <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#8eb0bb]">
                Cart
              </p>
              <p className="m-0 mt-2 text-2xl font-semibold text-[#f5dca8]">
                {formatMoney(cartTotal)} EUR
              </p>
              <p className="m-0 mt-1 text-xs text-[#9bb4bf]">{cartItemCount} items selected</p>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-[18px] border border-[#8f4958] bg-[rgba(71,24,35,0.72)] px-4 py-3 text-sm font-medium text-[#ffd9dd]">
            {error}
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded-[18px] border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-100">
            {successMessage}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
          <aside className="rounded-[28px] border border-[#284553] bg-[rgba(10,24,34,0.82)] p-4">
            <p className="m-0 text-[11px] uppercase tracking-[0.2em] text-[#93b4be]">Categories</p>
            <div className="mt-4 grid gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(String(category.id))}
                  className={`rounded-[18px] border px-4 py-3 text-left transition ${
                    selectedCategoryId === String(category.id)
                      ? "border-[#68c8bf] bg-[rgba(69,163,152,0.22)] text-white"
                      : "border-white/10 bg-white/5 text-[#d0d9df] hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{category.name}</span>
                    <span className="text-xs text-[#9db1bc]">
                      {categoryCounts.get(String(category.id)) || 0}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-[28px] border border-[#284553] bg-[rgba(10,24,34,0.82)] p-4">
            <p className="m-0 text-[11px] uppercase tracking-[0.2em] text-[#93b4be]">Menu</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-white/10 bg-white/5 p-6 text-sm text-[#a9bac4]">
                  No products are ready in this group right now.
                </div>
              ) : (
                visibleProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    className="rounded-[22px] border border-[#335060] bg-[linear-gradient(180deg,rgba(24,53,65,0.96)_0%,rgba(17,35,44,0.98)_100%)] p-4 text-left transition hover:border-[#5fc6bb] hover:translate-y-[-1px]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="m-0 text-base font-semibold text-[#f7f3ea]">{product.name}</p>
                        <p className="m-0 mt-2 text-xs text-[#8faab6]">
                          {product.category?.name || "Menu"}
                        </p>
                      </div>
                      <span className="rounded-full border border-[#3d6e71] bg-[#173438] px-2 py-1 text-[11px] text-[#b6efe6]">
                        Stock {product.stock}
                      </span>
                    </div>
                    <p className="m-0 mt-4 text-xl font-semibold text-[#f5dca8]">
                      {formatMoney(product.price)} EUR
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>

          <aside className="rounded-[28px] border border-[#284553] bg-[rgba(10,24,34,0.82)] p-4">
            <p className="m-0 text-[11px] uppercase tracking-[0.2em] text-[#93b4be]">Your Order</p>
            <div className="mt-4 space-y-3">
              {cart.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-[#9eb1bc]">
                  Tap menu cards to add items.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.productId}
                    className="rounded-[20px] border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="m-0 text-sm font-semibold text-white">{item.name}</p>
                        <p className="m-0 mt-1 text-xs text-[#9bb0bc]">
                          {formatMoney(item.price)} EUR each
                        </p>
                      </div>
                      <p className="m-0 text-sm font-semibold text-[#f5dca8]">
                        {formatMoney(item.price * item.quantity)} EUR
                      </p>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.productId, -1)}
                        className="h-9 w-9 rounded-full border border-white/15 bg-white/5 text-lg text-white hover:bg-white/10"
                      >
                        -
                      </button>
                      <span className="min-w-[32px] text-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.productId, 1)}
                        className="h-9 w-9 rounded-full border border-white/15 bg-white/5 text-lg text-white hover:bg-white/10"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 rounded-[22px] border border-[#355667] bg-[rgba(9,18,27,0.58)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#8eb0bb]">
                    Total
                  </p>
                  <p className="m-0 mt-1 text-sm text-[#a8bac4]">Sent directly to the live table ticket</p>
                </div>
                <p className="m-0 text-2xl font-semibold text-[#f5dca8]">
                  {formatMoney(cartTotal)} EUR
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmitOrder}
              disabled={isSubmitting || cart.length === 0}
              className="mt-4 inline-flex min-h-[56px] w-full items-center justify-center rounded-[18px] border border-[#5fc6bb] bg-[linear-gradient(180deg,rgba(79,183,170,0.96)_0%,rgba(31,112,103,0.99)_100%)] px-4 text-base font-bold text-[#071311] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Sending Order..." : "Send To Table"}
            </button>
          </aside>
        </section>
      </section>
    </main>
  );
}
