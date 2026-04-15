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
  getTables,
  transferOrderToTable,
} from "./posApi";
import useOrderCart from "./useOrderCart";
const ORDER_EDITABLE_STATUSES = new Set(["pending", "preparing", "served"]);
const TRANSFERABLE_ORDER_STATUSES = new Set([
  "pending",
  "preparing",
  "served",
  "pending_payment",
]);
const TABLES_PATH = "/tables";

const isHiddenPosCategory = (name) => {
  const normalizedName =
    typeof name === "string" ? name.trim().toLowerCase() : "";

  return (
    normalizedName.includes("orders category 2026") ||
    normalizedName.includes("improved orders category 2026") ||
    normalizedName.includes("admin role category 2026")
  );
};

const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const normalizeStatus = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

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

  return "Ready";
};

const buildTicketSummaryItems = (items) => {
  const groupedItems = new Map();

  items.forEach((item, index) => {
    const productId = item.productId || item.product?.id || `ticket-item-${index}`;
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    const key = `${productId}:${price}`;
    const lineTotal = Number((price * quantity).toFixed(2));
    const existingItem = groupedItems.get(key);

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.lineTotal = Number((existingItem.lineTotal + lineTotal).toFixed(2));
      return;
    }

    groupedItems.set(key, {
      key,
      productId,
      name: item.product?.name || "Product",
      quantity,
      price,
      lineTotal,
    });
  });

  return Array.from(groupedItems.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
};

const getFlowHint = ({
  canCompletePayment,
  canGenerateInvoice,
  cartCount,
  hasActiveOrder,
  isToGo,
}) => {
  if (canCompletePayment) {
    return "Complete payment to close this ticket.";
  }

  if (canGenerateInvoice) {
    if (cartCount > 0) {
      return "Confirm the pending items before sending the order to payment.";
    }

    return "Send the ticket to payment when the guest is ready.";
  }

  if (cartCount > 0) {
    return hasActiveOrder
      ? "Confirm the pending items to append them to the open ticket."
      : `Confirm the order to open a ${isToGo ? "to-go" : "table"} ticket.`;
  }

  return "Tap products to build the order.";
};

export default function PosOrderScreen() {
  const {
    session,
    selectedTable: table,
    logout,
    returnToTables,
    selectTable,
    showNotice,
  } = usePosApp();
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [currentOrder, setCurrentOrder] = useState(table?.activeOrder || null);
  const [selectedCartProductId, setSelectedCartProductId] = useState(null);
  const [isToGo, setIsToGo] = useState(false);
  const [hasDiscountRequest, setHasDiscountRequest] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isCompletingPayment, setIsCompletingPayment] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedTransferTableId, setSelectedTransferTableId] = useState(null);
  const [isTransferringOrder, setIsTransferringOrder] = useState(false);
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
    setSelectedCartProductId(null);
    setIsToGo(false);
    setHasDiscountRequest(false);
    setIsTransferDialogOpen(false);
    setSelectedTransferTableId(null);
    setSubmitError("");
  }, [table]);

  useEffect(() => {
    if (!cart.length) {
      setSelectedCartProductId(null);
      return;
    }

    setSelectedCartProductId((current) =>
      cart.some((item) => item.productId === current) ? current : cart[0].productId
    );
  }, [cart]);

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

  const loadTransferTables = useCallback(
    async (signal) => getTables(session.token, signal),
    [session.token]
  );

  const {
    data: transferTablesData,
    isLoading: isLoadingTransferTables,
    error: transferTablesError,
    reload: reloadTransferTables,
  } = useApiResource(loadTransferTables, {
    deps: [table?.id],
    initialData: [],
    errorMessage: "Cannot load tables for transfer.",
    onUnauthorized: logout,
  });

  const backendCategories = menuData?.categories || [];
  const products = menuData?.products || [];
  const transferTables = Array.isArray(transferTablesData) ? transferTablesData : [];
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

  const sortedTransferTables = useMemo(
    () => [...transferTables].sort((left, right) => left.number - right.number),
    [transferTables]
  );

  const tableVisualIdsById = useMemo(
    () =>
      new Map(
        sortedTransferTables.map((transferTable, index) => [transferTable.id, index + 1])
      ),
    [sortedTransferTables]
  );

  const transferCandidates = useMemo(
    () =>
      sortedTransferTables.filter(
        (transferTable) =>
          transferTable.id !== table?.id &&
          normalizeStatus(transferTable.status) === "available"
      ),
    [sortedTransferTables, table]
  );

  const hasActiveOrder = Boolean(currentOrder);
  const orderStatus = normalizeStatus(currentOrder?.status);
  const canEditOrderItems = !hasActiveOrder || ORDER_EDITABLE_STATUSES.has(orderStatus);
  const canGenerateInvoice = hasActiveOrder && ORDER_EDITABLE_STATUSES.has(orderStatus);
  const canCompletePayment = hasActiveOrder && orderStatus === "pending_payment";
  const canTransferOrder = hasActiveOrder && TRANSFERABLE_ORDER_STATUSES.has(orderStatus);
  const canDownloadInvoice =
    hasActiveOrder && (orderStatus === "pending_payment" || orderStatus === "paid");
  const isBusy =
    isSavingOrder ||
    isGeneratingInvoice ||
    isCompletingPayment ||
    isDownloadingInvoice ||
    isTransferringOrder;

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

  const ticketItems = useMemo(
    () => buildTicketSummaryItems(Array.isArray(currentOrder?.items) ? currentOrder.items : []),
    [currentOrder]
  );

  const activeOrderItemCount = useMemo(
    () => ticketItems.reduce((sum, item) => sum + item.quantity, 0),
    [ticketItems]
  );

  const displayLocation = table?.location || "Floor";
  const selectedMenuHint =
    categoryRailItems.length > 0
      ? "Tap a category once, then hit products as fast as the guest calls them."
      : "No ready-to-order products are available right now.";
  const projectedTotal = Number(((currentOrder?.total || 0) + total).toFixed(2));
  const serviceLabel = isToGo ? "To Go" : "Table Service";
  const selectedCartItem =
    cart.find((item) => item.productId === selectedCartProductId) || null;
  const flowHint = getFlowHint({
    canCompletePayment,
    canGenerateInvoice,
    cartCount: cart.length,
    hasActiveOrder,
    isToGo,
  });

  useEffect(() => {
    if (!isTransferDialogOpen) {
      return;
    }

    setSelectedTransferTableId((current) => {
      if (current && transferCandidates.some((candidate) => candidate.id === current)) {
        return current;
      }

      return transferCandidates[0]?.id || null;
    });
  }, [isTransferDialogOpen, transferCandidates]);

  const submitItemsToOrder = async () => {
    if (!canEditOrderItems) {
      throw new Error("This order is in payment phase. Create a new order after payment.");
    }

    if (cart.length === 0) {
      throw new Error("Add products before confirming the order.");
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
          ? `Items added to Order #${order.id}.`
          : `Order #${order.id} opened as ${serviceLabel.toLowerCase()}.`,
      });
    } catch (requestError) {
      if (requestError.status === 401) {
        logout();
        return;
      }

      setSubmitError(requestError.message || "Cannot confirm order.");
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
        throw new Error("Confirm pending items first, then move the ticket to payment.");
      }

      const invoicedOrder = await generateOrderInvoice(session.token, currentOrder.id);
      setCurrentOrder(invoicedOrder);
      await downloadOrderReceipt(session.token, invoicedOrder.id);

      showNotice({
        type: "success",
        message: `Order #${invoicedOrder.id} is ready for payment.`,
      });
    } catch (requestError) {
      if (requestError.status === 401) {
        logout();
        return;
      }

      setSubmitError(requestError.message || "Cannot move ticket to payment.");
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleDownloadInvoice = async () => {
    setIsDownloadingInvoice(true);
    setSubmitError("");

    try {
      if (!currentOrder) {
        throw new Error("No order selected for receipt download.");
      }

      await downloadOrderReceipt(session.token, currentOrder.id);
      showNotice({
        type: "success",
        message: `Receipt downloaded for Order #${currentOrder.id}.`,
      });
    } catch (requestError) {
      if (requestError.status === 401) {
        logout();
        return;
      }

      setSubmitError(requestError.message || "Cannot download receipt.");
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
        throw new Error("Send the ticket to payment before completing payment.");
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

  const handleAddProduct = (product) => {
    if (!canEditOrderItems) {
      setSubmitError(
        "This ticket is waiting for payment. Complete payment before adding new items."
      );
      return;
    }

    addProduct(product);
    setSelectedCartProductId(product.id);
    setSubmitError("");
  };

  const handleDeleteSelectedItem = () => {
    if (!selectedCartItem) {
      setSubmitError("Tap a pending item in the order panel first.");
      return;
    }

    removeProduct(selectedCartItem.productId);
    setSubmitError("");
  };

  const handleDiscountToggle = () => {
    setHasDiscountRequest((current) => {
      const next = !current;

      showNotice({
        type: "info",
        message: next
          ? "Discount or coupon flagged for checkout review."
          : "Discount or coupon flag cleared.",
      });

      return next;
    });
  };

  const handleOpenTransferDialog = () => {
    if (!canTransferOrder || !currentOrder) {
      setSubmitError("Only active table orders can be transferred.");
      return;
    }

    if (cart.length > 0) {
      setSubmitError("Confirm or clear pending cart items before transferring the order.");
      return;
    }

    setIsTransferDialogOpen(true);
    setSubmitError("");
  };

  const handleTransferOrder = async () => {
    if (!currentOrder) {
      setSubmitError("No active order found.");
      return;
    }

    if (!selectedTransferTableId) {
      setSubmitError("Choose a destination table first.");
      return;
    }

    setIsTransferringOrder(true);
    setSubmitError("");

    try {
      const transferredOrder = await transferOrderToTable(
        session.token,
        currentOrder.id,
        selectedTransferTableId
      );
      const transferredTableId = transferredOrder.tableId || transferredOrder.table?.id;
      const transferredTable =
        sortedTransferTables.find((candidate) => candidate.id === transferredTableId) ||
        transferredOrder.table;
      const nextVisualId =
        tableVisualIdsById.get(transferredTableId) ||
        transferredTable?.visualId ||
        transferredTable?.number;

      if (!transferredTable || !nextVisualId) {
        throw new Error("Order moved, but the new table could not be opened.");
      }

      setIsTransferDialogOpen(false);
      setSelectedTransferTableId(null);
      setCurrentOrder(transferredOrder);
      reloadTransferTables();

      selectTable({
        ...transferredTable,
        ...transferredOrder.table,
        activeOrder: transferredOrder,
        visualId: nextVisualId,
      });

      showNotice({
        type: "success",
        message: `Order #${transferredOrder.id} moved to Table ${nextVisualId}.`,
      });
    } catch (requestError) {
      if (requestError.status === 401) {
        logout();
        return;
      }

      setSubmitError(requestError.message || "Cannot transfer order.");
    } finally {
      setIsTransferringOrder(false);
    }
  };

  const handleFutureAction = (label) => {
    showNotice({
      type: "info",
      message: `${label} is staged in the POS flow and ready for backend wiring.`,
    });
  };

  const headerStats = [
    { label: "Categories", value: categoryRailItems.length, accent: "text-[#eff8f6]" },
    { label: "Products Ready", value: visibleProducts.length, accent: "text-[#eff8f6]" },
    { label: "Pending Cart", value: itemCount, accent: "text-[#eff8f6]" },
    {
      label: "Ticket Status",
      value: hasActiveOrder ? getUiStatusLabel(orderStatus) : "Ready",
      accent: "text-[#eff8f6]",
    },
  ];

  const orderStats = [
    { label: "Pending", value: itemCount, accent: "text-[#eff8f6]" },
    {
      label: "Pending Total",
      value: `${formatPrice(total)} EUR`,
      accent: "text-[#d8ffe3]",
      align: "text-right",
    },
    { label: "Ticket Items", value: activeOrderItemCount, accent: "text-[#eff8f6]" },
    {
      label: "Projected Total",
      value: `${formatPrice(projectedTotal)} EUR`,
      accent: "text-[#eff8f6]",
      align: "text-right",
    },
  ];

  if (!table) {
    return (
      <main className="pos-shell">
        <PosScreenLoader label="Returning to tables..." />
      </main>
    );
  }

  return (
    <main className="pos-shell bg-[radial-gradient(circle_at_top_left,rgba(39,102,95,0.16)_0%,transparent_26%),radial-gradient(circle_at_bottom_right,rgba(22,116,176,0.16)_0%,transparent_30%),linear-gradient(180deg,#051217_0%,#061920_52%,#08151a_100%)]">
      <section className="flex min-h-[calc(100vh-24px)] flex-col gap-4">
        <header className="rounded-[8px] border border-[#21434a] bg-[linear-gradient(180deg,rgba(7,23,29,0.98)_0%,rgba(8,29,35,0.98)_100%)] p-4 shadow-[0_22px_48px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex min-h-[36px] items-center rounded-full border border-[#31595a] bg-[#0c1f24] px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d7f4e7]">
                  Table {getDisplayTableId(table)}
                </span>
                <span className="inline-flex min-h-[36px] items-center rounded-full border border-[#31595a] bg-[#0c1f24] px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d7eef3]">
                  {displayLocation}
                </span>
                <span className="inline-flex min-h-[36px] items-center rounded-full border border-[#31595a] bg-[#0c1f24] px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#dce7ea]">
                  {waiterName}
                </span>
                <span className="inline-flex min-h-[36px] items-center rounded-full border border-[#31595a] bg-[#0c1f24] px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a6e8c3]">
                  {serviceLabel}
                </span>
              </div>

              <div className="mt-4">
                <h1 className="m-0 text-[clamp(1.6rem,3.4vw,2.35rem)] font-semibold tracking-[-0.03em] text-[#eff8f6]">
                  Order Terminal
                </h1>
                <p className="m-0 mt-2 max-w-3xl text-sm text-[#95b0b4] sm:text-[15px]">
                  Categories on the left, products in the middle, checkout on the
                  right.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <button
                type="button"
                className="inline-flex min-h-[56px] items-center justify-center rounded-[8px] border border-[#2d5960] bg-[#0c1f25] px-4 text-sm font-semibold text-[#dcf0f2] transition hover:border-[#43c67c] hover:text-white active:scale-[0.99]"
                onClick={() => handleReturnToTables()}
              >
                Back To Tables
              </button>
              <button
                type="button"
                className="inline-flex min-h-[56px] items-center justify-center rounded-[8px] border border-[#7b4255] bg-[linear-gradient(180deg,rgba(118,47,69,0.96)_0%,rgba(80,29,45,0.99)_100%)] px-4 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.99]"
                onClick={logout}
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {headerStats.map((item) => (
              <div
                key={item.label}
                className="rounded-[8px] border border-[#284952] bg-[#0a1a20] px-3 py-3"
              >
                <p className="m-0 text-[10px] uppercase tracking-[0.16em] text-[#7f9ea4]">
                  {item.label}
                </p>
                <p className={`m-0 mt-2 text-xl font-semibold ${item.accent}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </header>

        {error ? (
          <div className="rounded-[8px] border border-[#8f4958] bg-[rgba(71,24,35,0.72)] px-4 py-3 text-sm font-medium text-[#ffd9dd]">
            {error}
          </div>
        ) : null}
        {submitError ? (
          <div className="rounded-[8px] border border-[#8f4958] bg-[rgba(71,24,35,0.72)] px-4 py-3 text-sm font-medium text-[#ffd9dd]">
            {submitError}
          </div>
        ) : null}

        <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:h-[calc(100vh-228px)] xl:grid-cols-[212px_minmax(0,1fr)_420px] 2xl:grid-cols-[220px_minmax(0,1fr)_440px]">
          <CategoryRail
            categories={categoryRailItems}
            selectedCategoryKey={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
          />

          <section className="flex min-h-0 flex-col rounded-[8px] border border-[#21434a] bg-[linear-gradient(180deg,rgba(7,23,29,0.98)_0%,rgba(7,28,33,0.98)_100%)] p-4 shadow-[0_22px_48px_rgba(0,0,0,0.26)] xl:h-full">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-[#7ea0a7]">
                  Products
                </p>
                <h2 className="m-0 mt-2 text-[1.55rem] font-semibold tracking-[-0.02em] text-[#eff8f6]">
                  {selectedCategoryName}
                </h2>
                <p className="m-0 mt-2 text-sm text-[#8eaab0]">{selectedMenuHint}</p>
              </div>

              <div className="rounded-[8px] border border-[#2b5055] bg-[#0b1c22] px-3 py-3 text-right">
                <p className="m-0 text-[10px] uppercase tracking-[0.18em] text-[#7ea0a7]">
                  Selected Group
                </p>
                <p className="m-0 mt-2 text-lg font-semibold text-[#d8ffe3]">
                  {visibleProducts.length} items
                </p>
              </div>
            </div>

            {isLoading ? (
              <PosScreenLoader label="Loading menu..." />
            ) : categoryRailItems.length === 0 ? (
              <div className="flex min-h-[280px] flex-1 items-center justify-center rounded-[8px] border border-dashed border-[#2c5552] bg-[#0c1b20] p-6 text-center">
                <div>
                  <p className="m-0 text-base font-semibold text-[#eff8f6]">
                    No orderable categories
                  </p>
                  <p className="mt-2 text-sm text-[#90a3b2]">
                    Add products with stock and availability from the manager panel first.
                  </p>
                </div>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="flex min-h-[280px] flex-1 items-center justify-center rounded-[8px] border border-dashed border-[#2c5552] bg-[#0c1b20] p-6 text-center">
                <div>
                  <p className="m-0 text-base font-semibold text-[#eff8f6]">
                    No products in this category
                  </p>
                  <p className="mt-2 text-sm text-[#90a3b2]">
                    Choose another category or restock products from the manager side.
                  </p>
                </div>
              </div>
            ) : (
              <div className="scroll-y grid min-h-0 flex-1 auto-rows-max grid-cols-1 content-start items-start gap-3 overflow-y-auto pr-1 sm:grid-cols-2 2xl:grid-cols-3">
                {visibleProducts.map((product) => (
                  <ProductTile
                    key={product.id}
                    product={product}
                    disabled={!canEditOrderItems || isBusy}
                    onAdd={handleAddProduct}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="flex min-h-0 flex-col rounded-[8px] border border-[#21434a] bg-[linear-gradient(180deg,rgba(7,23,29,0.98)_0%,rgba(7,28,33,0.98)_100%)] p-4 shadow-[0_22px_48px_rgba(0,0,0,0.28)] xl:h-full">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-[#7ea0a7]">
                  Order Summary
                </p>
                <h3 className="m-0 mt-2 text-[1.5rem] font-semibold tracking-[-0.02em] text-[#eff8f6]">
                  {hasActiveOrder ? `Order #${currentOrder.id}` : `Table ${getDisplayTableId(table)}`}
                </h3>
                <p className="m-0 mt-1 text-sm text-[#8eaab0]">
                  {displayLocation} | {waiterName}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                {hasActiveOrder ? (
                  <StatusChip status={currentOrder.status} />
                ) : (
                  <span className="inline-flex items-center rounded-full border border-[#3cc574]/35 bg-[#123126] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c8f9da]">
                    New Ticket
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {orderStats.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-[8px] border border-[#274852] bg-[#0a1a20] px-3 py-3 ${
                    item.align || ""
                  }`}
                >
                  <p className="m-0 text-[10px] uppercase tracking-[0.16em] text-[#7f9ea4]">
                    {item.label}
                  </p>
                  <p className={`m-0 mt-2 text-lg font-semibold ${item.accent}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <p className="m-0 text-[10px] uppercase tracking-[0.16em] text-[#7f9ea4]">
                Top Actions
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  aria-pressed={isToGo}
                  className={`inline-flex min-h-[62px] items-center justify-center rounded-[8px] border px-3 text-sm font-semibold transition active:scale-[0.99] ${
                    isToGo
                      ? "border-[#3cc574] bg-[linear-gradient(180deg,rgba(33,122,83,0.98)_0%,rgba(22,89,61,0.99)_100%)] text-white"
                      : "border-[#2b5055] bg-[#0b1c22] text-[#dceef1] hover:border-[#3cc574]"
                  }`}
                  onClick={() => setIsToGo((current) => !current)}
                >
                  To Go
                </button>
                <button
                  type="button"
                  className={`inline-flex min-h-[62px] items-center justify-center rounded-[8px] border px-3 text-sm font-semibold transition active:scale-[0.99] ${
                    hasDiscountRequest
                      ? "border-[#e6b657] bg-[linear-gradient(180deg,rgba(158,118,44,0.98)_0%,rgba(120,86,28,0.99)_100%)] text-white"
                      : "border-[#5b4a26] bg-[rgba(53,39,14,0.78)] text-[#f3ddb0] hover:brightness-110"
                  }`}
                  onClick={handleDiscountToggle}
                >
                  Discount / Coupon
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-[62px] items-center justify-center rounded-[8px] border border-[#3cc574] bg-[linear-gradient(180deg,rgba(38,130,82,0.98)_0%,rgba(25,96,59,0.99)_100%)] px-3 text-sm font-bold text-white transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isBusy || !canEditOrderItems || cart.length === 0}
                  onClick={handleSaveOrder}
                >
                  {isSavingOrder ? "Confirming..." : hasActiveOrder ? "Confirm Order" : "Open Order"}
                </button>
              </div>
            </div>
            <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-[8px] border border-[#284952] bg-[#08171d]">
              <div className="grid grid-cols-[minmax(0,1fr)_110px_96px] gap-3 border-b border-[#183139] px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7f9ea4]">
                <span>Name</span>
                <span className="text-center">Quantity</span>
                <span className="text-right">Price</span>
              </div>

              <div className="scroll-y min-h-0 flex-1 overflow-y-auto p-3">
                {ticketItems.length === 0 && cart.length === 0 ? (
                  <div className="flex h-full min-h-[260px] items-center justify-center rounded-[8px] border border-dashed border-[#2c5552] bg-[#0c1b20] px-4 text-center">
                    <div>
                      <p className="m-0 text-base font-semibold text-[#eff8f6]">
                        No items yet
                      </p>
                      <p className="mt-2 text-sm text-[#92a6b6]">
                        Tap product tiles to fill the order summary.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ticketItems.length > 0 ? (
                      <section>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7f9ea4]">
                            On Ticket
                          </p>
                          <span className="text-[11px] font-semibold text-[#dbe8eb]">
                            {activeOrderItemCount} pcs
                          </span>
                        </div>
                        <div className="space-y-2">
                          {ticketItems.map((item) => (
                            <CartItemRow
                              key={item.key}
                              item={item}
                              variant="ticket"
                            />
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {cart.length > 0 ? (
                      <section
                        className={ticketItems.length > 0 ? "border-t border-[#183139] pt-4" : ""}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div>
                            <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7f9ea4]">
                              Ready To Confirm
                            </p>
                            <p className="m-0 mt-1 text-xs text-[#8eaab0]">
                              {selectedCartItem
                                ? `${selectedCartItem.name} selected`
                                : "Tap a pending line to edit or delete"}
                            </p>
                          </div>
                          <span className="text-[11px] font-semibold text-[#dbe8eb]">
                            {itemCount} pcs
                          </span>
                        </div>
                        <div className="space-y-2">
                          {cart.map((item) => (
                            <CartItemRow
                              key={item.productId}
                              item={item}
                              selected={selectedCartProductId === item.productId}
                              onSelect={setSelectedCartProductId}
                              onChangeQuantity={changeQuantity}
                              disabled={isBusy}
                            />
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-[8px] border border-[#284952] bg-[#0a1a20] p-4">
              <div className="space-y-2 text-sm text-[#dcebef]">
                <div className="flex items-center justify-between gap-3">
                  <span>Pending Cart</span>
                  <strong>{formatPrice(total)} EUR</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Current Ticket</span>
                  <strong>{formatPrice(currentOrder?.total || 0)} EUR</strong>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[#183139] pt-2 text-base">
                  <span>Total Due</span>
                  <strong className="text-[#d8ffe3]">{formatPrice(projectedTotal)} EUR</strong>
                </div>
              </div>

              <p className="m-0 mt-3 text-sm text-[#8eaab0]">{flowHint}</p>
              {hasDiscountRequest ? (
                <p className="m-0 mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#f3ddb0]">
                  Discount or coupon review flagged
                </p>
              ) : null}

              <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <button
                  type="button"
                  className="inline-flex min-h-[56px] items-center justify-center rounded-[8px] border border-[#d09b3c] bg-[linear-gradient(180deg,rgba(173,127,42,0.98)_0%,rgba(123,87,24,0.99)_100%)] px-4 text-sm font-semibold text-white transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isBusy || !canGenerateInvoice || cart.length > 0}
                  onClick={handleGenerateInvoice}
                >
                  {isGeneratingInvoice ? "Sending..." : "Send To Payment"}
                </button>

                {canDownloadInvoice || isDownloadingInvoice ? (
                  <button
                    type="button"
                    className="inline-flex min-h-[56px] items-center justify-center rounded-[8px] border border-[#2d5960] bg-[#0c1f25] px-4 text-sm font-semibold text-[#dcf0f2] transition hover:border-[#3d8ccf] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={isBusy}
                    onClick={handleDownloadInvoice}
                  >
                    {isDownloadingInvoice ? "Downloading..." : "Receipt"}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="m-0 text-[10px] uppercase tracking-[0.16em] text-[#7f9ea4]">
                  Bottom Actions
                </p>
                <span className="text-xs text-[#8eaab0]">
                  {selectedCartItem ? `Selected: ${selectedCartItem.name}` : "Select a pending item"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-[58px] items-center justify-center rounded-[8px] border border-[#9a4c62] bg-[linear-gradient(180deg,rgba(126,47,67,0.96)_0%,rgba(91,33,48,0.99)_100%)] px-3 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isBusy || !selectedCartItem}
                  onClick={handleDeleteSelectedItem}
                >
                  Delete Item
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-[58px] items-center justify-center rounded-[8px] border border-[#466b8f] bg-[linear-gradient(180deg,rgba(41,77,117,0.96)_0%,rgba(28,55,86,0.99)_100%)] px-3 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!hasActiveOrder}
                  onClick={() => handleFutureAction("Split bill")}
                >
                  Split Bill
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-[58px] items-center justify-center rounded-[8px] border border-[#3e7484] bg-[linear-gradient(180deg,rgba(29,104,116,0.96)_0%,rgba(20,72,82,0.99)_100%)] px-3 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!canTransferOrder || cart.length > 0}
                  onClick={handleOpenTransferDialog}
                >
                  Transfer Order
                </button>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-[62px] items-center justify-center rounded-[8px] border border-[#3cc574] bg-[linear-gradient(180deg,rgba(38,130,82,0.98)_0%,rgba(25,96,59,0.99)_100%)] px-4 text-sm font-bold text-white transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isBusy || !canCompletePayment}
                  onClick={handleCompletePayment}
                >
                  {isCompletingPayment ? "Processing..." : "Complete Payment"}
                </button>
              </div>
            </div>
          </aside>
        </section>
      </section>

      {isTransferDialogOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(2,10,14,0.72)] p-3 sm:items-center">
          <div className="w-full max-w-[720px] rounded-[8px] border border-[#29525a] bg-[linear-gradient(180deg,rgba(7,23,29,0.99)_0%,rgba(8,28,34,0.99)_100%)] p-4 shadow-[0_28px_60px_rgba(0,0,0,0.42)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-[#7ea0a7]">
                  Transfer Order
                </p>
                <h2 className="m-0 mt-2 text-[1.45rem] font-semibold tracking-[-0.02em] text-[#eff8f6]">
                  Move Order #{currentOrder?.id}
                </h2>
                <p className="m-0 mt-2 text-sm text-[#8eaab0]">
                  Pick an available table for this active ticket.
                </p>
              </div>

              <button
                type="button"
                className="inline-flex min-h-[48px] items-center justify-center rounded-[8px] border border-[#2d5960] bg-[#0c1f25] px-4 text-sm font-semibold text-[#dcf0f2] transition hover:border-[#43c67c] active:scale-[0.99]"
                onClick={() => setIsTransferDialogOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-[8px] border border-[#284952] bg-[#0a1a20] px-4 py-3 text-sm text-[#d9e7ea]">
              <div className="flex items-center justify-between gap-3">
                <span>Current table</span>
                <strong>Table {getDisplayTableId(table)}</strong>
              </div>
            </div>

            <div className="mt-4">
              {transferTablesError ? (
                <div className="rounded-[8px] border border-[#8f4958] bg-[rgba(71,24,35,0.72)] px-4 py-3 text-sm font-medium text-[#ffd9dd]">
                  {transferTablesError}
                </div>
              ) : isLoadingTransferTables ? (
                <div className="flex min-h-[180px] items-center justify-center rounded-[8px] border border-dashed border-[#2c5552] bg-[#0c1b20] p-6">
                  <PosScreenLoader label="Loading tables..." />
                </div>
              ) : transferCandidates.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-[#2c5552] bg-[#0c1b20] px-4 py-8 text-center">
                  <p className="m-0 text-base font-semibold text-[#eff8f6]">
                    No free tables right now
                  </p>
                  <p className="m-0 mt-2 text-sm text-[#8eaab0]">
                    Free up another table, then try the transfer again.
                  </p>
                </div>
              ) : (
                <div className="grid max-h-[320px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {transferCandidates.map((candidate) => {
                    const isSelected = selectedTransferTableId === candidate.id;
                    const candidateVisualId =
                      tableVisualIdsById.get(candidate.id) || candidate.number;

                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        className={`rounded-[8px] border px-4 py-4 text-left transition active:scale-[0.99] ${
                          isSelected
                            ? "border-[#3cc574] bg-[linear-gradient(180deg,rgba(21,79,57,0.98)_0%,rgba(15,58,41,0.99)_100%)] text-white"
                            : "border-[#284952] bg-[#0a1a20] text-[#e2eff2] hover:border-[#3cc574]"
                        }`}
                        onClick={() => setSelectedTransferTableId(candidate.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="m-0 text-lg font-semibold">
                              Table {candidateVisualId}
                            </p>
                            <p className="m-0 mt-1 text-sm opacity-80">
                              {candidate.location || "Floor"}
                            </p>
                          </div>
                          <span className="rounded-full border border-current/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                            Available
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="inline-flex min-h-[58px] flex-1 items-center justify-center rounded-[8px] border border-[#3cc574] bg-[linear-gradient(180deg,rgba(38,130,82,0.98)_0%,rgba(25,96,59,0.99)_100%)] px-4 text-sm font-bold text-white transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={
                  isTransferringOrder ||
                  isLoadingTransferTables ||
                  !selectedTransferTableId ||
                  transferCandidates.length === 0
                }
                onClick={handleTransferOrder}
              >
                {isTransferringOrder ? "Transferring..." : "Confirm Transfer"}
              </button>
              <button
                type="button"
                className="inline-flex min-h-[58px] items-center justify-center rounded-[8px] border border-[#2d5960] bg-[#0c1f25] px-4 text-sm font-semibold text-[#dcf0f2] transition hover:border-[#43c67c] active:scale-[0.99]"
                onClick={() => setIsTransferDialogOpen(false)}
              >
                Keep Table
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
