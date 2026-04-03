import { useCallback, useMemo, useState } from "react";

import PosScreenLoader from "../../components/PosScreenLoader";
import { usePosApp } from "../../context/PosAppContext";
import useApiResource from "../../hooks/useApiResource";
import CartItemRow from "./components/CartItemRow";
import CategoryRail from "./components/CategoryRail";
import ProductTile from "./components/ProductTile";
import StatusChip from "./components/StatusChip";
import {
  appendItemsToOrder,
  createOrder,
  getCategories,
  getProducts,
} from "./posApi";
import useOrderCart from "./useOrderCart";

const SIMPLE_CATEGORIES = [
  {
    key: "kafe",
    label: "Kafe",
    keywords: [
      "kafe",
      "coffee",
      "espresso",
      "machiato",
      "latte",
      "cappuccino",
      "americano",
    ],
  },
  {
    key: "birra",
    label: "Birra",
    keywords: ["birra", "beer", "heineken", "peja", "corona", "stella"],
  },
  {
    key: "pije",
    label: "Pije",
    keywords: [
      "pije",
      "drink",
      "juice",
      "cola",
      "fanta",
      "water",
      "tea",
      "red bull",
    ],
  },
  {
    key: "alkool",
    label: "Alkool",
    keywords: [
      "alkool",
      "alcohol",
      "vodka",
      "whiskey",
      "whisky",
      "rak",
      "wine",
      "gin",
    ],
  },
  {
    key: "akullore",
    label: "Akullore",
    keywords: ["akullore", "ice cream", "gelato"],
  },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
];

const QUICK_ACTIONS = [
  { key: "to-go", label: "To Go", enabled: false },
  { key: "coupon", label: "Coupon", enabled: false },
  { key: "notes", label: "Notes", enabled: false },
];

const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const matchesSimpleCategory = (product, backendCategories, categoryConfig) => {
  const backendCategory = backendCategories.find(
    (category) => category.id === product.categoryId
  );

  const haystack = [product.name, backendCategory?.name, product.category?.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return categoryConfig.keywords.some((keyword) => haystack.includes(keyword));
};

export default function PosOrderScreen() {
  const { session, selectedTable: table, logout, returnToTables, showNotice } = usePosApp();
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(
    SIMPLE_CATEGORIES[0].key
  );
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0].value);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const {
    cart,
    total,
    itemCount,
    addProduct,
    changeQuantity,
    removeProduct,
    clearCart,
  } = useOrderCart();

  const loadMenu = useCallback(
    async (signal) => {
      const [categoriesResponse, productsResponse] = await Promise.all([
        getCategories(session.token, signal),
        getProducts(session.token, signal),
      ]);

      return {
        categories: categoriesResponse || [],
        products: productsResponse || [],
      };
    },
    [session.token]
  );

  const {
    data: menuData,
    isLoading,
    error,
  } = useApiResource(loadMenu, {
    initialData: {
      categories: [],
      products: [],
    },
    errorMessage: "Cannot load products.",
    onUnauthorized: logout,
  });

  const backendCategories = menuData?.categories || [];
  const products = menuData?.products || [];
  const activeOrder = table?.activeOrder || null;
  const isResumeMode = Boolean(activeOrder);
  const employeeId =
    session.staffProfile?.employeeId || session.user?.employee?.id || null;
  const waiterName = session.staffProfile?.name || session.user?.fullName || "Waiter";

  const visibleProducts = useMemo(() => {
    const categoryConfig = SIMPLE_CATEGORIES.find(
      (category) => category.key === selectedCategoryKey
    );

    if (!categoryConfig) {
      return [];
    }

    return products
      .filter((product) => product.isAvailable && product.stock > 0)
      .filter((product) =>
        matchesSimpleCategory(product, backendCategories, categoryConfig)
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [backendCategories, products, selectedCategoryKey]);

  const handleSubmitOrder = async () => {
    if (!employeeId) {
      setSubmitError("This waiter is not linked to an employee profile.");
      return;
    }

    if (cart.length === 0) {
      setSubmitError("Add products before sending the order.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const payloadItems = cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));
      const order = isResumeMode
        ? await appendItemsToOrder(session.token, activeOrder.id, {
            items: payloadItems,
          })
        : await createOrder(session.token, {
            tableId: table.id,
            employeeId,
            paymentMethod,
            items: payloadItems,
          });

      clearCart();
      returnToTables({
        refresh: true,
        notice: {
          type: "success",
          message: isResumeMode
            ? `Items added to Order #${order.id} on Table ${table.number}.`
            : `Order #${order.id} sent for Table ${table.number}.`,
        },
      });
    } catch (requestError) {
      if (requestError.status === 401) {
        logout();
        return;
      }

      setSubmitError(requestError.message || "Cannot send order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!table) {
    return (
      <main className="pos-shell">
        <PosScreenLoader label="Returning to tables..." />
      </main>
    );
  }

  return (
    <main className="pos-shell">
      <section className="flex min-h-[calc(100vh-24px)] flex-col gap-4">
        <header className="pos-panel flex flex-wrap items-start justify-between gap-4 px-4 py-4">
          <div>
            <span className="pos-badge">Live Order</span>
            <h1 className="pos-title mt-3">
              Table {table.number} | {waiterName}
            </h1>
            <p className="pos-subtitle mt-2">
              {itemCount} new items in cart |{" "}
              {isResumeMode ? "Resume active order" : `${paymentMethod.toUpperCase()} payment`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.key}
                type="button"
                disabled={!action.enabled}
                onClick={() =>
                  showNotice({
                    type: "info",
                    message: `${action.label} flow will be enabled in the next POS update.`,
                  })
                }
                className="pos-button pos-button-muted min-h-[44px] rounded-xl px-4 text-xs uppercase tracking-wide"
              >
                {action.label}
              </button>
            ))}

            <button
              type="button"
              className="pos-button pos-button-muted min-h-[52px] rounded-xl px-4"
              onClick={() => returnToTables()}
            >
              Tables
            </button>
            <button
              type="button"
              className="pos-button pos-button-danger min-h-[52px] rounded-xl px-4"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
            {error}
          </div>
        ) : null}
        {submitError ? (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
            {submitError}
          </div>
        ) : null}

        <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(140px,14%)_minmax(0,58%)_minmax(300px,28%)]">
          <CategoryRail
            categories={SIMPLE_CATEGORIES}
            selectedCategoryKey={selectedCategoryKey}
            onSelectCategory={setSelectedCategoryKey}
          />

          <section className="pos-panel-soft flex min-h-0 flex-col p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="pos-badge">
                {SIMPLE_CATEGORIES.find((category) => category.key === selectedCategoryKey)
                  ?.label || "Menu"}
              </span>
              <p className="m-0 text-xs uppercase tracking-[0.14em] text-pos-muted">
                {visibleProducts.length} products
              </p>
            </div>

            {isLoading ? (
              <PosScreenLoader label="Loading menu..." />
            ) : visibleProducts.length === 0 ? (
              <div className="pos-panel flex min-h-[280px] flex-1 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/20 p-6 text-center">
                <div>
                  <p className="m-0 text-base font-semibold text-white">No products found</p>
                  <p className="mt-2 text-sm text-pos-muted">
                    This category is empty or products are out of stock.
                  </p>
                </div>
              </div>
            ) : (
              <div className="scroll-y grid max-h-[calc(100vh-280px)] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 2xl:grid-cols-3">
                {visibleProducts.map((product) => (
                  <ProductTile
                    key={product.id}
                    product={product}
                    onAdd={(value) => {
                      addProduct(value);
                      setSubmitError("");
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="pos-panel flex min-h-0 flex-col p-3">
            <div className="mb-3 rounded-xl border border-white/10 bg-pos-panelSoft p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="m-0 text-xs uppercase tracking-[0.14em] text-pos-muted">Order</p>
                <p className="m-0 text-xs font-semibold text-pos-muted">{table.location}</p>
              </div>
              {isResumeMode ? (
                <div className="mb-2 flex items-center justify-between">
                  <p className="m-0 text-sm font-semibold text-white">Order #{activeOrder.id}</p>
                  <StatusChip status={activeOrder.status} />
                </div>
              ) : null}
              <div className="flex items-end justify-between gap-2">
                <p className="m-0 text-sm font-semibold text-white">
                  {itemCount} new items selected
                </p>
                <p className="m-0 text-2xl font-bold text-pos-accent">
                  {formatPrice(total)} EUR
                </p>
              </div>
            </div>

            {isResumeMode ? (
              <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="m-0 text-xs uppercase tracking-[0.14em] text-pos-muted">
                  Active ticket total
                </p>
                <p className="m-0 mt-1 text-lg font-semibold text-white">
                  {formatPrice(activeOrder.total)} EUR
                </p>
                <p className="m-0 mt-1 text-xs text-pos-muted">
                  You are adding new items to this order.
                </p>
              </div>
            ) : (
              <div className="mb-3 grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setPaymentMethod(method.value)}
                    className={`pos-button min-h-[46px] rounded-xl border px-2 text-xs uppercase tracking-wide ${
                      paymentMethod === method.value
                        ? "border-pos-accent bg-pos-accent text-slate-950"
                        : "border-white/10 bg-white/5 text-pos-text hover:bg-white/10"
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className="pos-button pos-button-muted mb-3 min-h-[44px] rounded-xl text-xs uppercase tracking-wide"
              onClick={clearCart}
            >
              Clear Cart
            </button>

            <div className="scroll-y min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {isResumeMode && Array.isArray(activeOrder.items) && activeOrder.items.length > 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="m-0 text-xs uppercase tracking-[0.14em] text-pos-muted">
                    Existing items
                  </p>
                  <div className="mt-2 space-y-1">
                    {activeOrder.items.slice(0, 6).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs text-pos-muted"
                      >
                        <span>{item.product?.name || "Product"} x{item.quantity}</span>
                        <span>{formatPrice(item.price * item.quantity)} EUR</span>
                      </div>
                    ))}
                    {activeOrder.items.length > 6 ? (
                      <p className="m-0 text-xs text-pos-muted">
                        +{activeOrder.items.length - 6} more item lines
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {cart.length === 0 ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 px-4 text-center">
                  <p className="m-0 text-base font-semibold text-white">Cart is empty</p>
                  <p className="mt-2 text-sm text-pos-muted">
                    Tap product tiles to add items to the order.
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <CartItemRow
                    key={item.productId}
                    item={item}
                    onRemove={removeProduct}
                    onChangeQuantity={changeQuantity}
                  />
                ))
              )}
            </div>

            <div className="mt-3 space-y-2">
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-pos-muted">Total</span>
                  <strong className="text-2xl font-bold text-white">
                    {formatPrice(total)} EUR
                  </strong>
                </div>
              </div>

              <button
                type="button"
                className="pos-button pos-button-primary w-full min-h-[64px] rounded-xl text-base font-bold"
                disabled={isSubmitting || cart.length === 0}
                onClick={handleSubmitOrder}
              >
                {isSubmitting
                  ? isResumeMode
                    ? "Updating..."
                    : "Sending..."
                  : isResumeMode
                    ? "Add Items"
                    : paymentMethod === "card"
                      ? "Pay Now"
                      : "Send Order"}
              </button>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
