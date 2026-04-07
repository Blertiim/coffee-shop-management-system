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

const DEFAULT_PAYMENT_METHOD = "cash";

const isHiddenPosCategory = (name) => {
  const normalizedName =
    typeof name === "string" ? name.trim().toLowerCase() : "";

  return (
    normalizedName.includes("orders category 2026") ||
    normalizedName.includes("improved orders category 2026") ||
    normalizedName.includes("admin role category 2026")
  );
};

const ORDER_EDITABLE_STATUSES = new Set(["pending", "preparing", "served"]);

const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const normalizeStatus = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const TABLES_PATH = "/tables";

const buildTablePath = (visualTableId, fallbackTableNumber) => {
  const parsedVisualId = Number(visualTableId);

  if (Number.isFinite(parsedVisualId) && parsedVisualId > 0) {
    return `/table/${parsedVisualId}`;
  }

  return `/table/${fallbackTableNumber}`;
};

const replacePathname = (pathname) => {
  if (typeof window === "undefined" || window.location.pathname === pathname) {
    return;
  }

  window.history.replaceState({}, "", pathname);
};

const getDisplayTableId = (table) => table?.visualId || table?.number || "-";

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

  useEffect(() => {
    if (!table) {
      return;
    }

    replacePathname(buildTablePath(table.visualId, table.number));
  }, [table]);

  const handleReturnToTables = useCallback(
    (options = {}) => {
      replacePathname(TABLES_PATH);
      returnToTables(options);
    },
    [returnToTables]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handlePopState = () => {
      if (window.location.pathname === TABLES_PATH) {
        returnToTables();
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [returnToTables]);

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
  const orderableProducts = useMemo(
    () =>
      products
        .filter((product) => product.isAvailable && product.stock > 0)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [products]
  );
  const categoryCounts = useMemo(() => {
    const counts = new Map();

    orderableProducts.forEach((product) => {
      const key = String(product.categoryId);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return counts;
  }, [orderableProducts]);
  const menuCategories = useMemo(
    () =>
      backendCategories
        .filter((category) => categoryCounts.has(String(category.id)))
        .filter((category) => !isHiddenPosCategory(category.name))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [backendCategories, categoryCounts]
  );

  useEffect(() => {
    if (!menuCategories.length) {
      setSelectedCategoryId("");
      return;
    }

    setSelectedCategoryId((current) => {
      if (current && menuCategories.some((category) => String(category.id) === current)) {
        return current;
      }

      return String(menuCategories[0].id);
    });
  }, [menuCategories]);

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
      menuCategories.map((category) => ({
        key: String(category.id),
        label: category.name,
        count: categoryCounts.get(String(category.id)) || 0,
      })),
    [categoryCounts, menuCategories]
  );

  const selectedCategoryName = useMemo(() => {
    const selectedCategory = categoryRailItems.find(
      (category) => category.key === selectedCategoryId
    );

    return selectedCategory?.label || "Available Menu";
  }, [categoryRailItems, selectedCategoryId]);

  const visibleProducts = useMemo(() => {
    const allowedCategoryIds = new Set(
      menuCategories.map((category) => String(category.id))
    );

    return orderableProducts.filter((product) => {
      const productCategoryId = String(product.categoryId);

      if (!allowedCategoryIds.has(productCategoryId)) {
        return false;
      }

      if (!selectedCategoryId) {
        return true;
      }

      return productCategoryId === selectedCategoryId;
    });
  }, [menuCategories, orderableProducts, selectedCategoryId]);
  const activeOrderItemCount = useMemo(
    () =>
      Array.isArray(currentOrder?.items)
        ? currentOrder.items.reduce((sum, item) => sum + item.quantity, 0)
        : 0,
    [currentOrder]
  );
  const displayLocation = table?.location || "Floor";
  const selectedMenuHint =
    categoryRailItems.length > 0
      ? "Only categories with ready-to-order products are shown."
      : "No ready-to-order products are available right now.";

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
          paymentMethod: DEFAULT_PAYMENT_METHOD,
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

      handleReturnToTables({
        refresh: true,
        notice: {
          type: "success",
          message: `Payment completed (${formatPrice(
            paidOrder.total
          )} EUR) for Order #${paidOrder.id}. Table ${getDisplayTableId(
            table
          )} is available.`,
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
        <header className="relative overflow-hidden rounded-[28px] border border-[#2b4151] bg-[linear-gradient(135deg,rgba(10,16,25,0.98)_0%,rgba(17,30,44,0.98)_52%,rgba(14,53,58,0.96)_100%)] px-4 py-4 shadow-[0_26px_60px_rgba(0,0,0,0.28)] sm:px-5 sm:py-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(207,166,109,0.14)_0%,transparent_26%),radial-gradient(circle_at_88%_24%,rgba(91,177,167,0.16)_0%,transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_42%)]" />

          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-[#4ca59e]/45 bg-[#163736]/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ce7d4]">
                  Table {getDisplayTableId(table)}
                </span>
                <span className="inline-flex items-center rounded-full border border-[#82643d]/55 bg-[#2a2116]/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f0d6a2]">
                  {displayLocation}
                </span>
                <span className="inline-flex items-center rounded-full border border-[#3e516b]/75 bg-[#182230]/82 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c9d4e4]">
                  {waiterName}
                </span>
              </div>

              <h1 className="m-0 mt-4 text-[clamp(1.75rem,4vw,2.7rem)] font-semibold tracking-[-0.05em] text-[#f7f3ea]">
                Order Terminal
              </h1>
              <p className="m-0 mt-2 max-w-3xl text-sm text-[#b9c5d3] sm:text-[15px]">
                Add products fast, keep the ticket clean, and move this table from
                ordering to payment without the old admin-screen clutter.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-[18px] border border-[#33485f] bg-[rgba(12,20,31,0.55)] px-3 py-3">
                  <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#8395aa]">
                    Cart Items
                  </p>
                  <p className="m-0 mt-2 text-xl font-semibold text-[#f6f1e8]">
                    {itemCount}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[#33485f] bg-[rgba(12,20,31,0.55)] px-3 py-3">
                  <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#8395aa]">
                    Menu Groups
                  </p>
                  <p className="m-0 mt-2 text-xl font-semibold text-[#f6f1e8]">
                    {categoryRailItems.length}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[#33485f] bg-[rgba(12,20,31,0.55)] px-3 py-3">
                  <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#8395aa]">
                    Ticket Status
                  </p>
                  <p className="m-0 mt-2 text-base font-semibold text-[#f6f1e8]">
                    {hasActiveOrder ? getUiStatusLabel(orderStatus) : "Ready to start"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[#33485f] bg-[rgba(12,20,31,0.55)] px-3 py-3">
                  <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#8395aa]">
                    Service
                  </p>
                  <p className="m-0 mt-2 text-base font-semibold text-[#f6f1e8]">
                    Table Order
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
              <button
                type="button"
                className="inline-flex min-h-[52px] items-center justify-center rounded-[18px] border border-[#39526a] bg-[rgba(16,26,39,0.84)] px-4 text-sm font-semibold text-[#d3deec] transition hover:border-[#5d798f] hover:bg-[rgba(22,36,53,0.92)] active:scale-[0.99]"
                onClick={() => handleReturnToTables()}
              >
                Back To Tables
              </button>
              <button
                type="button"
                className="inline-flex min-h-[52px] items-center justify-center rounded-[18px] border border-[#7c4154] bg-[linear-gradient(180deg,rgba(126,49,70,0.96)_0%,rgba(82,28,44,0.98)_100%)] px-4 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.99]"
                onClick={logout}
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-[18px] border border-[#8f4958] bg-[rgba(71,24,35,0.72)] px-4 py-3 text-sm font-medium text-[#ffd9dd]">
            {error}
          </div>
        ) : null}
        {submitError ? (
          <div className="rounded-[18px] border border-[#8f4958] bg-[rgba(71,24,35,0.72)] px-4 py-3 text-sm font-medium text-[#ffd9dd]">
            {submitError}
          </div>
        ) : null}

        <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:h-[calc(100vh-232px)] lg:grid-cols-[188px_minmax(0,1fr)_380px] 2xl:grid-cols-[204px_minmax(0,1fr)_408px]">
          <CategoryRail
            categories={categoryRailItems}
            selectedCategoryKey={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
          />

          <section className="flex min-h-0 flex-col rounded-[28px] border border-[#2c4555] bg-[linear-gradient(180deg,rgba(14,28,37,0.98)_0%,rgba(15,35,43,0.98)_100%)] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.22)] lg:h-full">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-[#8da3af]">
                  Menu
                </p>
                <h2 className="m-0 mt-2 text-[1.55rem] font-semibold tracking-[-0.03em] text-[#f7f3ea]">
                  {selectedCategoryName}
                </h2>
                <p className="m-0 mt-2 text-sm text-[#8fa1ae]">{selectedMenuHint}</p>
              </div>

              <div className="rounded-full border border-[#3a5565] bg-[rgba(16,28,39,0.84)] px-3 py-2 text-center">
                <p className="m-0 text-[10px] uppercase tracking-[0.2em] text-[#8da3af]">
                  Ready Items
                </p>
                <p className="m-0 mt-1 text-sm font-semibold text-[#f7f3ea]">
                  {visibleProducts.length} products
                </p>
              </div>
            </div>

            {isLoading ? (
              <PosScreenLoader label="Loading menu..." />
            ) : categoryRailItems.length === 0 ? (
              <div className="flex min-h-[280px] flex-1 items-center justify-center rounded-[24px] border border-dashed border-[#41606e] bg-[rgba(9,16,23,0.48)] p-6 text-center">
                <div>
                  <p className="m-0 text-base font-semibold text-[#f7f3ea]">
                    No orderable categories
                  </p>
                  <p className="mt-2 text-sm text-[#90a3b2]">
                    Add products with stock and availability from the manager panel first.
                  </p>
                </div>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="flex min-h-[280px] flex-1 items-center justify-center rounded-[24px] border border-dashed border-[#41606e] bg-[rgba(9,16,23,0.48)] p-6 text-center">
                <div>
                  <p className="m-0 text-base font-semibold text-[#f7f3ea]">
                    No products in this group
                  </p>
                  <p className="mt-2 text-sm text-[#90a3b2]">
                    Choose another category or restock products from the manager side.
                  </p>
                </div>
              </div>
            ) : (
              <div className="scroll-y grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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

          <aside className="flex min-h-0 flex-col rounded-[28px] border border-[#2c4555] bg-[linear-gradient(180deg,rgba(11,22,31,0.98)_0%,rgba(11,28,36,0.98)_100%)] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.24)] lg:h-full">
            <div className="rounded-[24px] border border-[#335263] bg-[linear-gradient(180deg,rgba(21,39,53,0.98)_0%,rgba(15,27,38,0.98)_100%)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-[#8da3af]">
                    Order Summary
                  </p>
                  <h3 className="m-0 mt-2 text-[1.45rem] font-semibold tracking-[-0.03em] text-[#f7f3ea]">
                    {hasActiveOrder ? `Order #${currentOrder.id}` : `Table ${getDisplayTableId(table)}`}
                  </h3>
                  <p className="m-0 mt-1 text-sm text-[#95a8b7]">
                    {displayLocation} | {waiterName}
                  </p>
                </div>

                {hasActiveOrder ? (
                  <StatusChip status={currentOrder.status} />
                ) : (
                  <span className="inline-flex items-center rounded-full border border-[#4ca59e]/45 bg-[#163736]/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ce7d4]">
                    New Ticket
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-[18px] border border-[#304958] bg-[rgba(10,19,29,0.58)] px-3 py-3">
                  <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#8da3af]">
                    New Items
                  </p>
                  <p className="m-0 mt-2 text-lg font-semibold text-[#f7f3ea]">{itemCount}</p>
                </div>
                <div className="rounded-[18px] border border-[#304958] bg-[rgba(10,19,29,0.58)] px-3 py-3 text-right">
                  <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#8da3af]">
                    New Total
                  </p>
                  <p className="m-0 mt-2 text-lg font-semibold text-[#f0d6a2]">
                    {formatPrice(total)} EUR
                  </p>
                </div>
                <div className="rounded-[18px] border border-[#304958] bg-[rgba(10,19,29,0.58)] px-3 py-3">
                  <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#8da3af]">
                    Active Items
                  </p>
                  <p className="m-0 mt-2 text-lg font-semibold text-[#f7f3ea]">
                    {activeOrderItemCount}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[#304958] bg-[rgba(10,19,29,0.58)] px-3 py-3 text-right">
                  <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#8da3af]">
                    Ticket Total
                  </p>
                  <p className="m-0 mt-2 text-lg font-semibold text-[#f7f3ea]">
                    {formatPrice(currentOrder?.total || 0)} EUR
                  </p>
                </div>
              </div>
            </div>

            {hasActiveOrder ? (
              <div className="mt-3 rounded-[20px] border border-[#344b5b] bg-[rgba(17,30,40,0.86)] px-4 py-3">
                <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#8da3af]">
                  Active Ticket
                </p>
                <p className="m-0 mt-2 text-lg font-semibold text-[#f7f3ea]">
                  {formatPrice(currentOrder.total)} EUR
                </p>
                <p className="m-0 mt-2 text-sm text-[#93a8b6]">
                  {orderStatus === "pending_payment"
                    ? "Invoice is ready. Confirm payment after collecting the bill."
                    : "This table already has an open ticket. New items will be appended."}
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-[20px] border border-[#344b5b] bg-[rgba(17,30,40,0.86)] px-4 py-3">
                <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#8da3af]">
                  Order Flow
                </p>
                <p className="m-0 mt-2 text-lg font-semibold text-[#f7f3ea]">
                  Add items first
                </p>
                <p className="m-0 mt-2 text-sm text-[#93a8b6]">
                  Payment choice is hidden here. The ticket stays open until you generate the invoice.
                </p>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-[#8da3af]">
                  Pending Cart
                </p>
                <p className="m-0 mt-1 text-sm text-[#93a8b6]">
                  Items waiting to be added to the ticket.
                </p>
              </div>

              <button
                type="button"
                className="inline-flex min-h-[40px] items-center justify-center rounded-[14px] border border-[#32495a] bg-[rgba(14,24,34,0.78)] px-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#d5deeb] transition hover:border-[#5a7488] hover:bg-[rgba(21,35,49,0.92)] disabled:cursor-not-allowed disabled:opacity-45"
                onClick={clearCart}
                disabled={isBusy || cart.length === 0}
              >
                Clear
              </button>
            </div>

            <div className="mt-3 flex min-h-0 flex-1 flex-col">
              <div className="scroll-y min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {hasActiveOrder &&
                Array.isArray(currentOrder.items) &&
                currentOrder.items.length > 0 ? (
                  <div className="rounded-[20px] border border-[#334958] bg-[rgba(15,25,35,0.74)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#8da3af]">
                        Existing Ticket Items
                      </p>
                      <span className="text-xs font-semibold text-[#c7d3df]">
                        {activeOrderItemCount} pcs
                      </span>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {currentOrder.items.slice(0, 6).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 text-sm text-[#d7e1eb]"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {item.product?.name || "Product"} x{item.quantity}
                          </span>
                          <span className="shrink-0 text-[#f0d6a2]">
                            {formatPrice(item.price * item.quantity)} EUR
                          </span>
                        </div>
                      ))}
                      {currentOrder.items.length > 6 ? (
                        <p className="m-0 pt-1 text-xs text-[#8da3af]">
                          +{currentOrder.items.length - 6} more item lines
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {cart.length === 0 ? (
                  <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#425f6c] bg-[rgba(11,20,28,0.5)] px-4 text-center">
                    <p className="m-0 text-base font-semibold text-[#f7f3ea]">Cart is empty</p>
                    <p className="mt-2 text-sm text-[#92a6b6]">
                      Tap product cards to prepare the next items for this ticket.
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
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="rounded-[22px] border border-[#385161] bg-[linear-gradient(180deg,rgba(15,26,37,0.94)_0%,rgba(12,21,30,0.98)_100%)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#8da3af]">
                      New Items Total
                    </p>
                    <p className="m-0 mt-1 text-sm text-[#92a6b6]">
                      Ready to save on this ticket
                    </p>
                  </div>
                  <strong className="text-[2rem] font-semibold tracking-[-0.04em] text-[#f7f3ea]">
                    {formatPrice(total)} EUR
                  </strong>
                </div>
              </div>

              <button
                type="button"
                className="inline-flex min-h-[62px] w-full items-center justify-center rounded-[20px] border border-[#4ca59e] bg-[linear-gradient(180deg,rgba(75,176,161,0.96)_0%,rgba(34,118,110,0.99)_100%)] px-4 text-base font-bold text-[#071311] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isBusy || !canEditOrderItems || cart.length === 0}
                onClick={handleSaveOrder}
              >
                {isSavingOrder
                  ? "Saving..."
                  : hasActiveOrder
                    ? "Add Items To Order"
                    : "Save Order"}
              </button>

              {canGenerateInvoice || isGeneratingInvoice ? (
                <button
                  type="button"
                  className="inline-flex min-h-[56px] w-full items-center justify-center rounded-[18px] border border-[#b58a4b] bg-[linear-gradient(180deg,rgba(197,160,95,0.98)_0%,rgba(139,107,51,0.99)_100%)] px-4 text-sm font-semibold text-[#161109] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBusy || cart.length > 0}
                  onClick={handleGenerateInvoice}
                >
                  {isGeneratingInvoice ? "Generating Invoice..." : "Generate Invoice"}
                </button>
              ) : null}

              {canDownloadInvoice || isDownloadingInvoice ? (
                <button
                  type="button"
                  className="inline-flex min-h-[52px] w-full items-center justify-center rounded-[18px] border border-[#39526a] bg-[rgba(16,26,39,0.84)] px-4 text-sm font-semibold text-[#d3deec] transition hover:border-[#5d798f] hover:bg-[rgba(22,36,53,0.92)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBusy}
                  onClick={handleDownloadInvoice}
                >
                  {isDownloadingInvoice ? "Downloading..." : "Invoice PDF"}
                </button>
              ) : null}

              {canCompletePayment || isCompletingPayment ? (
                <button
                  type="button"
                  className="inline-flex min-h-[58px] w-full items-center justify-center rounded-[18px] border border-[#67b26f] bg-[linear-gradient(180deg,rgba(87,175,98,0.98)_0%,rgba(49,112,60,0.99)_100%)] px-4 text-sm font-bold text-[#081207] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
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
