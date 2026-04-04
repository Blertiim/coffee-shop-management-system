import { useCallback, useEffect, useMemo, useState } from "react";

import PosScreenLoader from "../../components/PosScreenLoader";
import { usePosApp } from "../../context/PosAppContext";
import useApiResource from "../../hooks/useApiResource";
import CartItemRow from "./components/CartItemRow";
import CategoryRail from "./components/CategoryRail";
import ProductTile from "./components/ProductTile";
import StatusChip from "./components/StatusChip";
import {
  appendItemsToOrder,
  completeOrderPayment,
  createOrder,
  downloadOrderReceipt,
  generateOrderInvoice,
  getCategories,
  getProducts,
} from "./posApi";
import useOrderCart from "./useOrderCart";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
];

const QUICK_ACTIONS = [
  { key: "to-go", label: "To Go", enabled: false },
  { key: "coupon", label: "Coupon", enabled: false },
  { key: "notes", label: "Notes", enabled: false },
];

const ORDER_EDITABLE_STATUSES = new Set(["pending", "preparing", "served"]);

const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const normalizeStatus = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const getUiStatusLabel = (status) => {
  const normalized = normalizeStatus(status);

  if (normalized === "pending_payment") {
    return "Pending Payment";
  }

  if (normalized === "paid") {
    return "Paid";
  }

  if (["pending", "preparing", "served", "occupied"].includes(normalized)) {
    return "Open Order";
  }

  if (normalized === "available") {
    return "Available";
  }

  return "Open Order";
};

export default function PosOrderScreen() {
  const { session, selectedTable: table, logout, returnToTables, showNotice } = usePosApp();
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0].value);
  const [currentOrder, setCurrentOrder] = useState(table?.activeOrder || null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isCompletingPayment, setIsCompletingPayment] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
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

  useEffect(() => {
    setCurrentOrder(table?.activeOrder || null);
    setSubmitError("");
  }, [table]);

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
  const employeeId =
    session.staffProfile?.employeeId || session.user?.employee?.id || null;
  const waiterName = session.staffProfile?.name || session.user?.fullName || "Waiter";

  useEffect(() => {
    if (!backendCategories.length) {
      setSelectedCategoryId("");
      return;
    }

    setSelectedCategoryId((current) => {
      if (current && backendCategories.some((category) => String(category.id) === current)) {
        return current;
      }

      return String(backendCategories[0].id);
    });
  }, [backendCategories]);

  const hasActiveOrder = Boolean(currentOrder);
  const orderStatus = normalizeStatus(currentOrder?.status);
  const canEditOrderItems = !hasActiveOrder || ORDER_EDITABLE_STATUSES.has(orderStatus);
  const canGenerateInvoice = hasActiveOrder && ORDER_EDITABLE_STATUSES.has(orderStatus);
  const canCompletePayment = hasActiveOrder && orderStatus === "pending_payment";
  const canDownloadInvoice =
    hasActiveOrder && (orderStatus === "pending_payment" || orderStatus === "paid");
  const isBusy =
    isSavingOrder || isGeneratingInvoice || isCompletingPayment || isDownloadingInvoice;

  const categoryRailItems = useMemo(
    () =>
      backendCategories.map((category) => ({
        key: String(category.id),
        label: category.name,
      })),
    [backendCategories]
  );

  const selectedCategoryName = useMemo(() => {
    const selectedCategory = backendCategories.find(
      (category) => String(category.id) === selectedCategoryId
    );

    return selectedCategory?.name || "Menu";
  }, [backendCategories, selectedCategoryId]);

  const visibleProducts = useMemo(() => {
    if (!selectedCategoryId) {
      return [];
    }

    return products
      .filter((product) => product.isAvailable && product.stock > 0)
      .filter((product) => String(product.categoryId) === selectedCategoryId)
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [products, selectedCategoryId]);

  const submitItemsToOrder = async () => {
    if (!canEditOrderItems) {
      throw new Error("This order is in payment phase. Create a new order after payment.");
    }

    if (cart.length === 0) {
      throw new Error("Add products before saving order.");
    }

    const payloadItems = cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));

    const order = hasActiveOrder
      ? await appendItemsToOrder(session.token, currentOrder.id, {
          items: payloadItems,
        })
      : await createOrder(session.token, {
          tableId: table.id,
          paymentMethod,
          items: payloadItems,
          ...(employeeId ? { employeeId } : {}),
        });

    setCurrentOrder(order);
    clearCart();
    return order;
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    setSubmitError("");

    try {
      const order = await submitItemsToOrder();
      showNotice({
        type: "success",
        message: hasActiveOrder
          ? `Items added to Order #${order.id}. Order stays open.`
          : `Order #${order.id} saved and kept open.`,
      });
    } catch (requestError) {
      if (requestError.status === 401) {
        logout();
        return;
      }

      setSubmitError(requestError.message || "Cannot save order.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleGenerateInvoice = async () => {
    setIsGeneratingInvoice(true);
    setSubmitError("");

    try {
      if (!currentOrder) {
        throw new Error("No active order found.");
      }

      if (cart.length > 0) {
        throw new Error("Save order items first, then generate invoice.");
      }

      const invoicedOrder = await generateOrderInvoice(session.token, currentOrder.id);
      setCurrentOrder(invoicedOrder);
      await downloadOrderReceipt(session.token, invoicedOrder.id);

      showNotice({
        type: "success",
        message: `Invoice generated for Order #${invoicedOrder.id}. Table is pending payment.`,
      });
    } catch (requestError) {
      if (requestError.status === 401) {
        logout();
        return;
      }

      setSubmitError(requestError.message || "Cannot generate invoice.");
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleDownloadInvoice = async () => {
    setIsDownloadingInvoice(true);
    setSubmitError("");

    try {
      if (!currentOrder) {
        throw new Error("No order selected for invoice download.");
      }

      await downloadOrderReceipt(session.token, currentOrder.id);
      showNotice({
        type: "success",
        message: `Invoice downloaded for Order #${currentOrder.id}.`,
      });
    } catch (requestError) {
      if (requestError.status === 401) {
        logout();
        return;
      }

      setSubmitError(requestError.message || "Cannot download invoice.");
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  const handleCompletePayment = async () => {
    setIsCompletingPayment(true);
    setSubmitError("");

    try {
      if (!currentOrder) {
        throw new Error("No active order found.");
      }

      if (cart.length > 0) {
        throw new Error("Clear pending cart items before completing payment.");
      }

      if (normalizeStatus(currentOrder.status) !== "pending_payment") {
        throw new Error("Generate invoice first before completing payment.");
      }

      const paidOrder = await completeOrderPayment(session.token, currentOrder.id);
      setCurrentOrder(paidOrder);

      returnToTables({
        refresh: true,
        notice: {
          type: "success",
          message: `Payment completed (${formatPrice(
            paidOrder.total
          )} EUR) for Order #${paidOrder.id}. Table ${table.number} is available.`,
        },
      });
    } catch (requestError) {
      if (requestError.status === 401) {
        logout();
        return;
      }

      setSubmitError(requestError.message || "Cannot complete payment.");
    } finally {
      setIsCompletingPayment(false);
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
              {hasActiveOrder
                ? `Order #${currentOrder.id} (${getUiStatusLabel(orderStatus)})`
                : `${paymentMethod.toUpperCase()} payment`}
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

        <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[120px_minmax(0,1fr)_330px] xl:grid-cols-[140px_minmax(0,58%)_minmax(320px,28%)]">
          <CategoryRail
            categories={categoryRailItems}
            selectedCategoryKey={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
          />

          <section className="pos-panel-soft flex min-h-0 flex-col p-3 lg:h-[calc(100vh-210px)]">
            <div className="mb-3 flex items-center justify-between">
              <span className="pos-badge">{selectedCategoryName}</span>
              <p className="m-0 text-xs uppercase tracking-[0.14em] text-pos-muted">
                {visibleProducts.length} products
              </p>
            </div>

            {isLoading ? (
              <PosScreenLoader label="Loading menu..." />
            ) : categoryRailItems.length === 0 ? (
              <div className="pos-panel flex min-h-[280px] flex-1 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/20 p-6 text-center">
                <div>
                  <p className="m-0 text-base font-semibold text-white">
                    No categories available
                  </p>
                  <p className="mt-2 text-sm text-pos-muted">
                    Manager should add categories first.
                  </p>
                </div>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="pos-panel flex min-h-[280px] flex-1 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/20 p-6 text-center">
                <div>
                  <p className="m-0 text-base font-semibold text-white">No products found</p>
                  <p className="mt-2 text-sm text-pos-muted">
                    This category is empty or all products are out of stock.
                  </p>
                </div>
              </div>
            ) : (
              <div className="scroll-y grid max-h-[calc(100vh-300px)] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 2xl:grid-cols-3">
                {visibleProducts.map((product) => (
                  <ProductTile
                    key={product.id}
                    product={product}
                    disabled={!canEditOrderItems || isBusy}
                    onAdd={(value) => {
                      if (!canEditOrderItems) {
                        setSubmitError(
                          "Order is pending payment. Complete payment before adding new items."
                        );
                        return;
                      }

                      addProduct(value);
                      setSubmitError("");
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="pos-panel flex min-h-0 flex-col p-3 lg:sticky lg:top-3 lg:h-[calc(100vh-40px)]">
            <div className="mb-3 rounded-xl border border-white/10 bg-pos-panelSoft p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="m-0 text-xs uppercase tracking-[0.14em] text-pos-muted">Order</p>
                <p className="m-0 text-xs font-semibold text-pos-muted">{table.location}</p>
              </div>
              {hasActiveOrder ? (
                <div className="mb-2 flex items-center justify-between">
                  <p className="m-0 text-sm font-semibold text-white">Order #{currentOrder.id}</p>
                  <StatusChip status={currentOrder.status} />
                </div>
              ) : (
                <div className="mb-2">
                  <p className="m-0 text-sm font-semibold text-white">No active order yet</p>
                </div>
              )}
              <div className="flex items-end justify-between gap-2">
                <p className="m-0 text-sm font-semibold text-white">
                  {itemCount} new items selected
                </p>
                <p className="m-0 text-2xl font-bold text-pos-accent">
                  {formatPrice(total)} EUR
                </p>
              </div>
            </div>

            {hasActiveOrder ? (
              <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="m-0 text-xs uppercase tracking-[0.14em] text-pos-muted">
                  Active ticket total
                </p>
                <p className="m-0 mt-1 text-lg font-semibold text-white">
                  {formatPrice(currentOrder.total)} EUR
                </p>
                <p className="m-0 mt-1 text-xs text-pos-muted">
                  {orderStatus === "pending_payment"
                    ? "Invoice generated. Awaiting payment confirmation."
                    : "Order remains open. You can add more items anytime."}
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
              disabled={isBusy || cart.length === 0}
            >
              Clear Cart
            </button>

            <div className="scroll-y min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {hasActiveOrder &&
              Array.isArray(currentOrder.items) &&
              currentOrder.items.length > 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="m-0 text-xs uppercase tracking-[0.14em] text-pos-muted">
                    Existing items
                  </p>
                  <div className="mt-2 space-y-1">
                    {currentOrder.items.slice(0, 6).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs text-pos-muted"
                      >
                        <span>{item.product?.name || "Product"} x{item.quantity}</span>
                        <span>{formatPrice(item.price * item.quantity)} EUR</span>
                      </div>
                    ))}
                    {currentOrder.items.length > 6 ? (
                      <p className="m-0 text-xs text-pos-muted">
                        +{currentOrder.items.length - 6} more item lines
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
                  <span className="text-sm text-pos-muted">New Items Total</span>
                  <strong className="text-2xl font-bold text-white">
                    {formatPrice(total)} EUR
                  </strong>
                </div>
              </div>

              <button
                type="button"
                className="pos-button pos-button-primary w-full min-h-[62px] rounded-xl text-base font-bold"
                disabled={isBusy || !canEditOrderItems || cart.length === 0}
                onClick={handleSaveOrder}
              >
                {isSavingOrder
                  ? "Saving..."
                  : hasActiveOrder
                    ? "Add Items"
                    : "Save Order"}
              </button>

              {canGenerateInvoice || isGeneratingInvoice ? (
                <button
                  type="button"
                  className="pos-button w-full min-h-[56px] rounded-xl bg-pos-warn text-slate-950 text-sm font-semibold hover:bg-amber-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy || cart.length > 0}
                  onClick={handleGenerateInvoice}
                >
                  {isGeneratingInvoice ? "Generating Invoice..." : "Generate Invoice"}
                </button>
              ) : null}

              {canDownloadInvoice || isDownloadingInvoice ? (
                <button
                  type="button"
                  className="pos-button pos-button-muted w-full min-h-[52px] rounded-xl text-sm font-semibold"
                  disabled={isBusy}
                  onClick={handleDownloadInvoice}
                >
                  {isDownloadingInvoice ? "Downloading..." : "Invoice PDF"}
                </button>
              ) : null}

              {canCompletePayment || isCompletingPayment ? (
                <button
                  type="button"
                  className="pos-button w-full min-h-[58px] rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold hover:bg-emerald-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy}
                  onClick={handleCompletePayment}
                >
                  {isCompletingPayment ? "Completing Payment..." : "Complete Payment"}
                </button>
              ) : null}
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
