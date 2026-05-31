import { useEffect, useMemo, useState } from "react";

import PosQrCode from "../../components/PosQrCode";
import PosScreenLoader from "../../components/PosScreenLoader";
import {
  assignTableToWaiter,
  buildRealtimeStreamUrl,
  createCategory,
  createIngredient,
  createProduct,
  createSupplier,
  createSupplierOrder,
  createStockIntake,
  createTable,
  createWaiter,
  deleteCategory,
  deleteProduct,
  deleteTable,
  deleteWaiter,
  downloadAdvancedReportCsv,
  downloadAdvancedReportPdf,
  downloadInvoicePdf,
  downloadSupplierInvoicePdf,
  getAdvancedReport,
  getAuditLogs,
  getCategories,
  getDailySummary,
  getDashboardInvoices,
  getDashboardOrders,
  getGuestQrAccess,
  getIngredients,
  getLowStockProducts,
  getManagerStats,
  getProducts,
  getRecipes,
  getStockIntakes,
  getStockMovements,
  getSupplierOrders,
  getSuppliers,
  getSystemAlerts,
  getTables,
  getTopProducts,
  getRevenueTrend,
  getWaiters,
  getWaiterPerformance,
  rotateGuestQrAccess,
  saveRecipe,
  setWaiterTableAssignments,
  updateCategory,
  updateProduct,
  updateSupplierOrder,
  updateWaiter,
  updateWaiterStatus,
} from "./managerApi";

const STOCK_INTAKE_ENABLED = true;

const SECTIONS = [
  { key: "overview", label: "Dashboard" },
  { key: "products", label: "Products" },
  { key: "categories", label: "Categories" },
  { key: "stock", label: "Stock" },
  ...(STOCK_INTAKE_ENABLED ? [{ key: "incoming", label: "Stock In" }] : []),
  { key: "employees", label: "Staff & Tables" },
  { key: "orders", label: "Orders" },
  { key: "reports", label: "Reports" },
];

const todayDate = new Date().toISOString().slice(0, 10);
const yesterdayDate = (() => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
})();

const getStartOfWeekDate = () => {
  const date = new Date();
  const day = date.getDay();
  const mondayDistance = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - mondayDistance);
  return date.toISOString().slice(0, 10);
};

const REPORT_FILTER_PRESETS = [
  { key: "today", label: "Today", from: todayDate, to: todayDate },
  { key: "yesterday", label: "Yesterday", from: yesterdayDate, to: yesterdayDate },
  { key: "week", label: "This Week", from: getStartOfWeekDate(), to: todayDate },
  { key: "custom", label: "Custom", from: todayDate, to: todayDate },
];

const defaultProductForm = {
  name: "",
  categoryId: "",
  price: "",
  stock: "1",
  stockUnit: "cope",
  unitsPerPackage: "",
  directStockIngredientId: "",
  imageUrl: "",
  description: "",
  isAvailable: true,
};

const defaultCategoryForm = { name: "" };

const defaultWaiterForm = {
  fullName: "",
  pin: "",
  status: "active",
};

const defaultTableForm = {
  number: "",
  capacity: "4",
  location: "Main Hall",
};

const defaultSupplierInvoiceForm = {
  supplierId: "",
  invoiceNumber: "",
  orderDate: todayDate,
  expectedDate: "",
  status: "delivered",
  notes: "",
  items: [
    {
      productId: "",
      quantity: "1",
      unit: "",
      stockQuantity: "",
      unitPrice: "",
    },
  ],
};

const defaultIngredientForm = {
  name: "",
  sku: "",
  baseUnit: "g",
  minimumQuantity: "0",
};

const defaultRecipeForm = {
  productId: "",
  notes: "",
  items: [
    {
      ingredientId: "",
      quantity: "",
      unit: "g",
    },
  ],
};

const defaultStockIntakeForm = {
  supplierId: "",
  invoiceNumber: "",
  notes: "",
  confirm: true,
  items: [
    {
      sourceType: "product",
      productId: "",
      ingredientId: "",
      purchasedQuantity: "",
      purchasedUnit: "paketa",
      unitCost: "",
    },
  ],
};

const defaultSupplierForm = {
  companyName: "",
  contactName: "",
  phone: "",
  email: "",
  productType: "",
};

const STOCK_UNITS = [
  { value: "cope", label: "cope" },
  { value: "shishe", label: "shishe" },
  { value: "litra", label: "litra" },
  { value: "kg", label: "kg" },
];

const PURCHASE_UNITS = [
  ...STOCK_UNITS,
  { value: "paketa", label: "paketa" },
];

const LEDGER_UNITS = [
  { value: "g", label: "grams" },
  { value: "kg", label: "kilograms" },
  { value: "ml", label: "milliliters" },
  { value: "l", label: "liters" },
  { value: "pcs", label: "pieces" },
  { value: "paketa", label: "paketa" },
];

const BASE_UNITS = LEDGER_UNITS.filter((unit) => ["g", "ml", "pcs"].includes(unit.value));

const formatMoney = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDateTime = (value) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));

const formatShortDay = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value || "");
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
};

const formatMonthLabel = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value.trim())) {
    return String(value || "");
  }

  const [year, month] = value.trim().split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const formatProductOption = (product) => {
  const categoryName = product.category?.name || "Uncategorized";
  const stockUnit = product.stockUnit || "cope";
  const packageText = product.unitsPerPackage
    ? ` | 1 paketa = ${product.unitsPerPackage} ${stockUnit}`
    : "";

  return `${product.name} #${product.id} | ${categoryName} | Stock ${product.stock} ${stockUnit}${packageText}`;
};

const formatStock = (product) => `${product.stock} ${product.stockUnit || "cope"}`;

const getProductStockUnit = (product) => product?.stockUnit || "cope";

const getDefaultPurchaseUnitForProduct = (product) =>
  product?.unitsPerPackage && ["cope", "shishe"].includes(getProductStockUnit(product))
    ? "paketa"
    : getProductStockUnit(product);

const getDefaultStockUnitsPerPurchaseUnit = (product, purchaseUnit) =>
  purchaseUnit === "paketa" ? String(product?.unitsPerPackage || "") : "1";

const getDefaultStockQuantity = (product, purchaseUnit, quantity = "1") =>
  String(
    Number(quantity || 0) *
      Number(getDefaultStockUnitsPerPurchaseUnit(product, purchaseUnit) || 1)
  );

const calculateInvoiceItemStockQuantity = (item) =>
  Number(
    item.stockQuantity ||
      Number(item.quantity || 0) * Number(item.stockUnitsPerPurchaseUnit || 0)
  );

const formatInvoiceItemStockImpact = (item, product) => {
  const stockQuantity = Number(
    item.stockQuantity || calculateInvoiceItemStockQuantity(item)
  );
  const stockUnit = item.stockUnit || getProductStockUnit(product);

  return stockQuantity > 0 ? `${stockQuantity} ${stockUnit}` : `0 ${stockUnit}`;
};

const calculateInvoiceItemLineTotal = (item) =>
  item.id || item.supplierOrderId
    ? Number(item.quantity || 0) * Number(item.unitPrice || 0)
    : Number(item.unitPrice || 0);

const calculateInvoiceItemStockAfter = (item, product) =>
  Number(product?.stock || 0) + calculateInvoiceItemStockQuantity(item);

const formatQuantity = (quantity, unit) =>
  `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(Number(quantity || 0))} ${unit || ""}`.trim();

const calculateStockIntakeLineTotal = (item) =>
  Number(item.purchasedQuantity || 0) * Number(item.unitCost || 0);

const getDirectStockProducts = (productsList) =>
  productsList.filter((product) => product.directStockIngredientId);

const resolveStockIntakeItem = (item, productsList, ingredientsList) => {
  const selectedProduct =
    item.sourceType === "product"
      ? productsList.find((product) => String(product.id) === String(item.productId)) || null
      : null;
  const selectedIngredient =
    selectedProduct?.directStockIngredient ||
    ingredientsList.find((ingredient) => String(ingredient.id) === String(item.ingredientId)) ||
    null;
  const packageSize = Number(selectedProduct?.unitsPerPackage || 0);
  const boughtQuantity = Number(item.purchasedQuantity || 0);
  const unitCost = Number(item.unitCost || 0);
  const isPackagePurchase = item.purchasedUnit === "paketa";
  const baseQuantity =
    isPackagePurchase && packageSize > 0 ? boughtQuantity * packageSize : boughtQuantity;
  const lineTotal = boughtQuantity * unitCost;
  const backendUnitCost = baseQuantity > 0 ? lineTotal / baseQuantity : unitCost;

  return {
    baseQuantity,
    backendUnitCost,
    lineTotal,
    packageSize,
    selectedIngredient,
    selectedProduct,
  };
};

const isAuthError = (error) => error?.status === 401 || error?.status === 403;

const isAbortError = (error) => error?.name === "AbortError";

const sortCategoriesByNewest = (rows) =>
  [...ensureArray(rows)].sort((left, right) => {
    const rightTime = new Date(right?.createdAt || 0).getTime();
    const leftTime = new Date(left?.createdAt || 0).getTime();
    return rightTime - leftTime;
  });

const buildGuestOrderUrl = (guestAccess) => {
  if (!guestAccess) {
    return "";
  }

  if (typeof guestAccess.guestOrderUrl === "string" && guestAccess.guestOrderUrl.trim()) {
    return guestAccess.guestOrderUrl.trim();
  }

  if (
    typeof guestAccess.localGuestOrderUrl === "string" &&
    guestAccess.localGuestOrderUrl.trim()
  ) {
    return guestAccess.localGuestOrderUrl.trim();
  }

  if (!guestAccess.token || typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}/guest/table/${guestAccess.token}`;
};

const statusClass = (status) => {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (normalized === "paid") {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
  }
  if (normalized === "pending_payment") {
    return "border-orange-400/30 bg-orange-500/15 text-orange-300";
  }
  if (normalized === "cancelled") {
    return "border-red-400/30 bg-red-500/15 text-red-300";
  }
  return "border-sky-400/30 bg-sky-500/15 text-sky-300";
};

function BarRows({
  rows,
  labelKey,
  valueKey,
  colorClass,
  formatLabel = (value) => String(value || ""),
  formatValue = (value) => `${formatMoney(value)} EUR`,
  getMetaText = null,
}) {
  const maxValue = Math.max(...rows.map((entry) => Number(entry[valueKey] || 0)), 1);

  if (rows.length === 0) {
    return <p className="text-sm text-pos-muted">No data found.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((entry) => {
        const value = Number(entry[valueKey] || 0);
        const width = value <= 0 ? 0 : Math.max(8, Math.round((value / maxValue) * 100));
        const metaText = typeof getMetaText === "function" ? getMetaText(entry) : "";

        return (
          <div key={entry[labelKey]} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-sm font-medium text-white">{formatLabel(entry[labelKey], entry)}</p>
                {metaText ? <p className="m-0 mt-1 text-[11px] text-pos-muted">{metaText}</p> : null}
              </div>
              <span className="shrink-0 text-xs font-medium text-pos-text">
                {formatValue(value, entry)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ManagerDashboard({ session, onLogout }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [filters, setFilters] = useState({ from: todayDate, to: todayDate });
  const [reportPreset, setReportPreset] = useState("today");
  const [refreshTick, setRefreshTick] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const [stats, setStats] = useState(null);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [waiterPerformance, setWaiterPerformance] = useState([]);
  const [ordersData, setOrdersData] = useState({ orders: [], summary: null });
  const [invoicesData, setInvoicesData] = useState({ invoices: [], count: 0 });
  const [dailySummary, setDailySummary] = useState(null);
  const [lowStock, setLowStock] = useState({ products: [], threshold: 5 });
  const [advancedReport, setAdvancedReport] = useState(null);
  const [systemAlerts, setSystemAlerts] = useState({ alerts: [], count: 0 });
  const [auditTrail, setAuditTrail] = useState({ logs: [], count: 0 });
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierOrders, setSupplierOrders] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [stockIntakes, setStockIntakes] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [waiters, setWaiters] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedWaiterForTables, setSelectedWaiterForTables] = useState(null);
  const [assignedTableIds, setAssignedTableIds] = useState([]);
  const [selectedQrTableId, setSelectedQrTableId] = useState(null);
  const [guestAccess, setGuestAccess] = useState(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isQrLoading, setIsQrLoading] = useState(false);

  const [editingProductId, setEditingProductId] = useState(null);
  const [productForm, setProductForm] = useState(defaultProductForm);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryForm, setCategoryForm] = useState(defaultCategoryForm);
  const [editingWaiterId, setEditingWaiterId] = useState(null);
  const [waiterForm, setWaiterForm] = useState(defaultWaiterForm);
  const [tableForm, setTableForm] = useState(defaultTableForm);
  const [supplierInvoiceForm, setSupplierInvoiceForm] = useState(defaultSupplierInvoiceForm);
  const [ingredientForm, setIngredientForm] = useState(defaultIngredientForm);
  const [recipeForm, setRecipeForm] = useState(defaultRecipeForm);
  const [stockIntakeForm, setStockIntakeForm] = useState(defaultStockIntakeForm);
  const [supplierForm, setSupplierForm] = useState(defaultSupplierForm);

  const refreshAll = () => setRefreshTick((value) => value + 1);

  const runAction = async (action, successMessage) => {
    setIsSaving(true);
    setError("");
    setFeedback("");
    try {
      const result = await action();
      setFeedback(successMessage);
      refreshAll();
      return result;
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) {
        onLogout();
        return;
      }
      setError(requestError.message || "Action failed.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const loadAll = async () => {
      setIsLoading(true);
      setError("");

      try {
        const requests = [
          {
            key: "stats",
            label: "dashboard stats",
            load: () => getManagerStats(session.token, filters, controller.signal),
          },
          {
            key: "topProducts",
            label: "top products",
            load: () => getTopProducts(session.token, controller.signal),
          },
          {
            key: "revenueTrend",
            label: "revenue trend",
            load: () => getRevenueTrend(session.token, { days: 7 }, controller.signal),
          },
          {
            key: "waiterPerformance",
            label: "waiter ranking",
            load: () => getWaiterPerformance(session.token, filters, controller.signal),
          },
          {
            key: "orders",
            label: "orders",
            load: () =>
              getDashboardOrders(session.token, { ...filters, limit: 120 }, controller.signal),
          },
          {
            key: "invoices",
            label: "invoices",
            load: () =>
              getDashboardInvoices(session.token, { ...filters, limit: 120 }, controller.signal),
          },
          {
            key: "summary",
            label: "daily summary",
            load: () => getDailySummary(session.token, { date: filters.from }, controller.signal),
          },
          {
            key: "lowStock",
            label: "stock alerts",
            load: () => getLowStockProducts(session.token, { threshold: 5 }, controller.signal),
          },
          {
            key: "advancedReport",
            label: "advanced report",
            load: () => getAdvancedReport(session.token, filters, controller.signal),
          },
          {
            key: "alerts",
            label: "system alerts",
            load: () =>
              getSystemAlerts(session.token, { status: "open", limit: 20 }, controller.signal),
          },
          {
            key: "auditTrail",
            label: "audit trail",
            load: () => getAuditLogs(session.token, { limit: 16 }, controller.signal),
          },
          {
            key: "products",
            label: "products",
            load: () => getProducts(session.token, controller.signal),
          },
          {
            key: "categories",
            label: "categories",
            load: () => getCategories(session.token, controller.signal),
          },
          {
            key: "suppliers",
            label: "suppliers",
            load: () => getSuppliers(session.token, controller.signal),
          },
          ...(STOCK_INTAKE_ENABLED
            ? [
                {
                  key: "supplierOrders",
                  label: "incoming invoices",
                  load: () => getSupplierOrders(session.token, controller.signal),
                },
                {
                  key: "ingredients",
                  label: "ingredients",
                  load: () =>
                    getIngredients(session.token, { pageSize: 100 }, controller.signal),
                },
                {
                  key: "recipes",
                  label: "recipes",
                  load: () => getRecipes(session.token, { pageSize: 100 }, controller.signal),
                },
                {
                  key: "stockIntakes",
                  label: "stock intakes",
                  load: () =>
                    getStockIntakes(session.token, { pageSize: 50 }, controller.signal),
                },
                {
                  key: "stockMovements",
                  label: "stock movements",
                  load: () =>
                    getStockMovements(session.token, { pageSize: 50 }, controller.signal),
                },
              ]
            : []),
          {
            key: "waiters",
            label: "waiters",
            load: () => getWaiters(session.token, controller.signal),
          },
          {
            key: "tables",
            label: "tables",
            load: () => getTables(session.token, controller.signal),
          },
        ];
        const results = await Promise.allSettled(requests.map((request) => request.load()));

        if (!mounted) {
          return;
        }

        const authFailure = results.find(
          (result) => result.status === "rejected" && isAuthError(result.reason)
        );

        if (authFailure) {
          onLogout();
          return;
        }

        const getResultValue = (key, fallbackValue) => {
          const requestIndex = requests.findIndex((request) => request.key === key);
          const result = results[requestIndex];
          return result?.status === "fulfilled" ? result.value : fallbackValue;
        };

        const failedRequests = results
          .map((result, index) => ({ result, request: requests[index] }))
          .filter(
            ({ result }) => result.status === "rejected" && !isAbortError(result.reason)
          );

        const nextStats = getResultValue("stats", null);
        const nextTopProducts = getResultValue("topProducts", []);
        const nextTrend = getResultValue("revenueTrend", []);
        const nextWaiter = getResultValue("waiterPerformance", null);
        const nextOrders = getResultValue("orders", null);
        const nextInvoices = getResultValue("invoices", null);
        const nextSummary = getResultValue("summary", null);
        const nextLowStock = getResultValue("lowStock", { products: [], threshold: 5 });
        const nextAdvancedReport = getResultValue("advancedReport", null);
        const nextAlerts = getResultValue("alerts", { alerts: [], count: 0 });
        const nextAuditTrail = getResultValue("auditTrail", { logs: [], count: 0 });
        const nextProducts = getResultValue("products", []);
        const nextCategories = getResultValue("categories", []);
        const nextSuppliers = getResultValue("suppliers", []);
        const nextSupplierOrders = getResultValue("supplierOrders", []);
        const nextIngredients = getResultValue("ingredients", { items: [] });
        const nextRecipes = getResultValue("recipes", { items: [] });
        const nextStockIntakes = getResultValue("stockIntakes", { items: [] });
        const nextStockMovements = getResultValue("stockMovements", { items: [] });
        const nextWaiters = getResultValue("waiters", []);
        const nextTables = getResultValue("tables", []);

        setStats(nextStats || null);
        setTopProducts(ensureArray(nextTopProducts));
        setRevenueTrend(ensureArray(nextTrend));
        setWaiterPerformance(ensureArray(nextWaiter?.ranking || []));
        setOrdersData({
          orders: ensureArray(nextOrders?.orders || []),
          summary: nextOrders?.summary || null,
        });
        setInvoicesData({
          invoices: ensureArray(nextInvoices?.invoices || []),
          count: Number(nextInvoices?.count || 0),
        });
        setDailySummary(nextSummary || null);
        setLowStock(nextLowStock || { products: [], threshold: 5 });
        setAdvancedReport(nextAdvancedReport || null);
        setSystemAlerts(nextAlerts || { alerts: [], count: 0 });
        setAuditTrail(nextAuditTrail || { logs: [], count: 0 });
        setProducts(ensureArray(nextProducts));
        setCategories(ensureArray(nextCategories));
        setSuppliers(ensureArray(nextSuppliers));
        setSupplierOrders(ensureArray(nextSupplierOrders));
        setIngredients(ensureArray(nextIngredients?.items || nextIngredients));
        setRecipes(ensureArray(nextRecipes?.items || nextRecipes));
        setStockIntakes(ensureArray(nextStockIntakes?.items || nextStockIntakes));
        setStockMovements(ensureArray(nextStockMovements?.items || nextStockMovements));
        setWaiters(ensureArray(nextWaiters));
        setTables(ensureArray(nextTables));

        if (failedRequests.length) {
          const visibleLabels = failedRequests
            .slice(0, 3)
            .map(({ request }) => request.label);
          const extraCount = failedRequests.length - visibleLabels.length;
          const suffix = extraCount > 0 ? ` and ${extraCount} more` : "";

          setError(`Some manager data could not load: ${visibleLabels.join(", ")}${suffix}.`);
        }
      } catch (requestError) {
        if (!mounted || isAbortError(requestError)) {
          return;
        }

        if (isAuthError(requestError)) {
          onLogout();
          return;
        }

        setError(requestError.message || "Failed to load manager data.");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadAll();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [filters, onLogout, refreshTick, session.token]);

  const overviewCards = useMemo(
    () => [
      { label: "Total Revenue", value: `${formatMoney(stats?.totalRevenue)} EUR` },
      { label: "Today Revenue", value: `${formatMoney(stats?.todayRevenue)} EUR` },
      { label: "Orders Today", value: stats?.todayOrders || 0 },
      { label: "Avg Order", value: `${formatMoney(stats?.averageOrderValue)} EUR` },
      { label: "Open Orders", value: stats?.totalPendingOrders || 0 },
      { label: "Active Tables", value: stats?.activeTables || 0 },
      { label: "Open Alerts", value: systemAlerts?.count || 0 },
      { label: "Realtime", value: isRealtimeConnected ? "Live" : "Offline" },
    ],
    [isRealtimeConnected, stats, systemAlerts?.count]
  );

  const productCountByCategoryId = useMemo(() => {
    const counts = new Map();

    products.forEach((product) => {
      const currentCount = counts.get(product.categoryId) || 0;
      counts.set(product.categoryId, currentCount + 1);
    });

    return counts;
  }, [products]);

  const supplierInvoiceTotal = useMemo(
    () =>
      supplierInvoiceForm.items.reduce(
        (sum, item) => sum + calculateInvoiceItemLineTotal(item),
        0
      ),
    [supplierInvoiceForm.items]
  );

  const editingCategoryProducts = useMemo(() => {
    if (!editingCategoryId) {
      return [];
    }

    return products
      .filter((product) => product.categoryId === editingCategoryId)
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [editingCategoryId, products]);

  const currentDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        dateStyle: "full",
      }).format(new Date()),
    []
  );

  const tablesByWaiter = useMemo(() => {
    const byWaiter = new Map();

    tables.forEach((table) => {
      if (!table.assignedWaiterId) {
        return;
      }

      const current = byWaiter.get(table.assignedWaiterId) || [];
      byWaiter.set(table.assignedWaiterId, [...current, table.id]);
    });

    return byWaiter;
  }, [tables]);

  const selectedQrTable = useMemo(
    () => tables.find((table) => table.id === selectedQrTableId) || null,
    [selectedQrTableId, tables]
  );

  const guestOrderUrl = useMemo(
    () => buildGuestOrderUrl(guestAccess),
    [guestAccess]
  );

  useEffect(() => {
    if (!waiters.length) {
      setSelectedWaiterForTables(null);
      setAssignedTableIds([]);
      return;
    }

    setSelectedWaiterForTables((current) => {
      if (current && waiters.some((waiter) => waiter.id === current)) {
        return current;
      }

      return waiters[0].id;
    });
  }, [waiters]);

  useEffect(() => {
    if (!selectedWaiterForTables) {
      setAssignedTableIds([]);
      return;
    }

    setAssignedTableIds(tablesByWaiter.get(selectedWaiterForTables) || []);
  }, [selectedWaiterForTables, tablesByWaiter]);

  useEffect(() => {
    setSupplierInvoiceForm((current) => {
      const nextSupplierId =
        current.supplierId || (suppliers[0]?.id ? String(suppliers[0].id) : "");

      let didChangeItem = false;
      const nextItems = current.items.map((item) => {
        const nextProductId = item.productId || (products[0]?.id ? String(products[0].id) : "");
        const selectedProduct =
          products.find((product) => String(product.id) === String(nextProductId)) || null;
        const nextUnit = item.unit || getDefaultPurchaseUnitForProduct(selectedProduct);
        const nextStockQuantity =
          item.stockQuantity || getDefaultStockQuantity(selectedProduct, nextUnit, item.quantity);

        if (
          nextProductId !== item.productId ||
          nextUnit !== item.unit ||
          nextStockQuantity !== item.stockQuantity
        ) {
          didChangeItem = true;
        }

        return {
          ...item,
          productId: nextProductId,
          unit: nextUnit,
          stockQuantity: nextStockQuantity,
        };
      });

      if (nextSupplierId === current.supplierId && !didChangeItem) {
        return current;
      }

      return {
        ...current,
        supplierId: nextSupplierId,
        items: nextItems,
      };
    });
  }, [products, suppliers]);

  useEffect(() => {
    setStockIntakeForm((current) => {
      const nextSupplierId =
        current.supplierId || (suppliers[0]?.id ? String(suppliers[0].id) : "");
      let didChangeItem = false;
      const directProducts = getDirectStockProducts(products);
      const nextItems = current.items.map((item) => {
        const nextSourceType = item.sourceType || (directProducts.length ? "product" : "ingredient");
        const nextProductId =
          nextSourceType === "product"
            ? item.productId || (directProducts[0]?.id ? String(directProducts[0].id) : "")
            : "";
        const selectedProduct =
          directProducts.find((product) => String(product.id) === String(nextProductId)) ||
          null;
        const nextIngredientId =
          nextSourceType === "product"
            ? selectedProduct?.directStockIngredientId
              ? String(selectedProduct.directStockIngredientId)
              : ""
            : item.ingredientId || (ingredients[0]?.id ? String(ingredients[0].id) : "");
        const selectedIngredient =
          ingredients.find((ingredient) => String(ingredient.id) === String(nextIngredientId)) ||
          null;
        const nextUnit =
          item.purchasedUnit ||
          (nextSourceType === "product" && selectedProduct?.unitsPerPackage ? "paketa" : null) ||
          (selectedIngredient?.baseUnit === "pcs" ? "pcs" : "kg");

        if (
          nextSourceType !== item.sourceType ||
          nextProductId !== item.productId ||
          nextIngredientId !== item.ingredientId ||
          nextUnit !== item.purchasedUnit
        ) {
          didChangeItem = true;
        }

        return {
          ...item,
          sourceType: nextSourceType,
          productId: nextProductId,
          ingredientId: nextIngredientId,
          purchasedUnit: nextUnit,
        };
      });

      if (nextSupplierId === current.supplierId && !didChangeItem) {
        return current;
      }

      return {
        ...current,
        supplierId: nextSupplierId,
        items: nextItems,
      };
    });

    setRecipeForm((current) => {
      let didChangeItem = false;
      const nextItems = current.items.map((item) => {
        const nextIngredientId =
          item.ingredientId || (ingredients[0]?.id ? String(ingredients[0].id) : "");
        const selectedIngredient =
          ingredients.find((ingredient) => String(ingredient.id) === String(nextIngredientId)) ||
          null;
        const nextUnit = item.unit || selectedIngredient?.baseUnit || "g";

        if (nextIngredientId !== item.ingredientId || nextUnit !== item.unit) {
          didChangeItem = true;
        }

        return {
          ...item,
          ingredientId: nextIngredientId,
          unit: nextUnit,
        };
      });

      const nextProductId =
        current.productId || (products[0]?.id ? String(products[0].id) : "");

      if (nextProductId === current.productId && !didChangeItem) {
        return current;
      }

      return {
        ...current,
        productId: nextProductId,
        items: nextItems,
      };
    });
  }, [ingredients, products, suppliers]);

  useEffect(() => {
    if (!tables.length) {
      setSelectedQrTableId(null);
      setGuestAccess(null);
      return;
    }

    setSelectedQrTableId((current) => {
      if (current && tables.some((table) => table.id === current)) {
        return current;
      }

      return tables[0].id;
    });
  }, [tables]);

  useEffect(() => {
    if (!selectedQrTableId) {
      setGuestAccess(null);
      return undefined;
    }

    let cancelled = false;
    setIsQrLoading(true);

    getGuestQrAccess(session.token, selectedQrTableId)
      .then((payload) => {
        if (!cancelled) {
          setGuestAccess(payload);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          if (requestError.status === 401 || requestError.status === 403) {
            onLogout();
            return;
          }

          setError(requestError.message || "Failed to prepare guest QR access.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsQrLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [onLogout, selectedQrTableId, session.token]);

  useEffect(() => {
    if (typeof window === "undefined" || !session?.token) {
      return undefined;
    }

    const source = new EventSource(
      buildRealtimeStreamUrl(session.token, [
        "dashboard",
        "orders",
        "alerts",
        "tables",
        "inventory",
        "categories",
        "products",
      ])
    );
    let refreshTimeout = 0;

    source.addEventListener("connected", () => {
      setIsRealtimeConnected(true);
    });

    source.addEventListener("update", () => {
      setIsRealtimeConnected(true);
      window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(() => {
        refreshAll();
      }, 250);
    });

    source.onerror = () => {
      setIsRealtimeConnected(false);
    };

    return () => {
      window.clearTimeout(refreshTimeout);
      source.close();
      setIsRealtimeConnected(false);
    };
  }, [session?.token]);

  const onSelectReportPreset = (presetKey) => {
    const preset = REPORT_FILTER_PRESETS.find((item) => item.key === presetKey);

    if (!preset) {
      return;
    }

    setReportPreset(presetKey);

    if (presetKey !== "custom") {
      setFilters({
        from: preset.from,
        to: preset.to,
      });
    }
  };

  const onChangeCustomFilterDate = (field, value) => {
    setReportPreset("custom");
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const toggleAssignedTable = (tableId) => {
    setAssignedTableIds((current) =>
      current.includes(tableId)
        ? current.filter((id) => id !== tableId)
        : [...current, tableId]
    );
  };

  const beginEditProduct = (product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name || "",
      categoryId:
        product.categoryId === null || product.categoryId === undefined
          ? "uncategorized"
          : String(product.categoryId),
      price: String(product.price ?? ""),
      stock: String(product.stock ?? ""),
      stockUnit: product.stockUnit || "cope",
      unitsPerPackage: product.unitsPerPackage ? String(product.unitsPerPackage) : "",
      directStockIngredientId: product.directStockIngredientId
        ? String(product.directStockIngredientId)
        : "",
      imageUrl: product.imageUrl || "",
      description: product.description || "",
      isAvailable: Boolean(product.isAvailable),
    });
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProductForm(defaultProductForm);
  };

  const beginEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setCategoryForm({ name: category.name || "" });
  };

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryForm(defaultCategoryForm);
  };

  const beginEditWaiter = (waiter) => {
    setEditingWaiterId(waiter.id);
    setWaiterForm({
      fullName: waiter.fullName || "",
      pin: "",
      status: waiter.status || "active",
    });
  };

  const resetWaiterForm = () => {
    setEditingWaiterId(null);
    setWaiterForm(defaultWaiterForm);
  };

  const resetTableForm = () => {
    setTableForm(defaultTableForm);
  };

  const resetSupplierInvoiceForm = () => {
    const product = products[0] || null;
    const unit = getDefaultPurchaseUnitForProduct(product);

    setSupplierInvoiceForm({
      ...defaultSupplierInvoiceForm,
      supplierId: suppliers[0]?.id ? String(suppliers[0].id) : "",
      items: [
        {
          productId: product?.id ? String(product.id) : "",
          quantity: "1",
          unit,
          stockQuantity: getDefaultStockQuantity(product, unit),
          unitPrice: "",
        },
      ],
    });
  };

  const resetSupplierForm = () => {
    setSupplierForm(defaultSupplierForm);
  };

  const updateSupplierInvoiceItem = (index, field, value) => {
    setSupplierInvoiceForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addSupplierInvoiceItem = () => {
    const product = products[0] || null;
    const unit = getDefaultPurchaseUnitForProduct(product);

    setSupplierInvoiceForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          productId: product?.id ? String(product.id) : "",
          quantity: "1",
          unit,
          stockQuantity: getDefaultStockQuantity(product, unit),
          unitPrice: "",
        },
      ],
    }));
  };

  const removeSupplierInvoiceItem = (index) => {
    setSupplierInvoiceForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const startIncomingInvoiceForProduct = (product) => {
    const unit = getDefaultPurchaseUnitForProduct(product);

    setSupplierInvoiceForm({
      ...defaultSupplierInvoiceForm,
      supplierId: suppliers[0]?.id ? String(suppliers[0].id) : "",
      items: [
        {
          productId: String(product.id),
          quantity: "1",
          unit,
          stockQuantity: getDefaultStockQuantity(product, unit),
          unitPrice: "",
        },
      ],
    });
    setActiveSection("incoming");
  };

  const resetIngredientForm = () => {
    setIngredientForm(defaultIngredientForm);
  };

  const resetRecipeForm = () => {
    const ingredient = ingredients[0] || null;
    setRecipeForm({
      ...defaultRecipeForm,
      productId: products[0]?.id ? String(products[0].id) : "",
      items: [
        {
          ingredientId: ingredient?.id ? String(ingredient.id) : "",
          quantity: "",
          unit: ingredient?.baseUnit || "g",
        },
      ],
    });
  };

  const resetStockIntakeForm = () => {
    const product = getDirectStockProducts(products)[0] || null;
    const ingredient =
      product?.directStockIngredient ||
      ingredients.find((entry) => entry.id === product?.directStockIngredientId) ||
      ingredients[0] ||
      null;
    setStockIntakeForm({
      ...defaultStockIntakeForm,
      supplierId: suppliers[0]?.id ? String(suppliers[0].id) : "",
      items: [
        {
          sourceType: product ? "product" : "ingredient",
          productId: product?.id ? String(product.id) : "",
          ingredientId: ingredient?.id ? String(ingredient.id) : "",
          purchasedQuantity: "",
          purchasedUnit: product?.unitsPerPackage ? "paketa" : ingredient?.baseUnit === "pcs" ? "pcs" : "kg",
          unitCost: "",
        },
      ],
    });
  };

  const updateStockIntakeItem = (index, field, value) => {
    setStockIntakeForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addStockIntakeItem = () => {
    const product = getDirectStockProducts(products)[0] || null;
    const ingredient =
      product?.directStockIngredient ||
      ingredients.find((entry) => entry.id === product?.directStockIngredientId) ||
      ingredients[0] ||
      null;
    setStockIntakeForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          sourceType: product ? "product" : "ingredient",
          productId: product?.id ? String(product.id) : "",
          ingredientId: ingredient?.id ? String(ingredient.id) : "",
          purchasedQuantity: "",
          purchasedUnit: product?.unitsPerPackage ? "paketa" : ingredient?.baseUnit === "pcs" ? "pcs" : "kg",
          unitCost: "",
        },
      ],
    }));
  };

  const removeStockIntakeItem = (index) => {
    setStockIntakeForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateRecipeItem = (index, field, value) => {
    setRecipeForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addRecipeItem = () => {
    const ingredient = ingredients[0] || null;
    setRecipeForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          ingredientId: ingredient?.id ? String(ingredient.id) : "",
          quantity: "",
          unit: ingredient?.baseUnit || "g",
        },
      ],
    }));
  };

  const removeRecipeItem = (index) => {
    setRecipeForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const onProductSubmit = async (event) => {
    event.preventDefault();
    const normalizedStock =
      productForm.stock === "" ? undefined : Number(productForm.stock);
    const normalizedUnitsPerPackage =
      productForm.unitsPerPackage === "" ? null : Number(productForm.unitsPerPackage);
    const normalizedCategoryId =
      productForm.categoryId === "uncategorized"
        ? null
        : productForm.categoryId === ""
          ? undefined
          : Number(productForm.categoryId);
    const normalizedDirectStockIngredientId =
      productForm.directStockIngredientId === ""
        ? null
        : Number(productForm.directStockIngredientId);
    const payload = {
      name: productForm.name.trim(),
      price: Number(productForm.price),
      stockUnit: productForm.stockUnit || "cope",
      unitsPerPackage: normalizedUnitsPerPackage,
      directStockIngredientId: normalizedDirectStockIngredientId,
      imageUrl: productForm.imageUrl || null,
      description: productForm.description || null,
      isAvailable: Boolean(productForm.isAvailable),
      ...(normalizedCategoryId !== undefined ? { categoryId: normalizedCategoryId } : {}),
      ...(normalizedStock !== undefined ? { stock: normalizedStock } : {}),
    };

    await runAction(async () => {
      if (editingProductId) {
        await updateProduct(session.token, editingProductId, payload);
      } else {
        await createProduct(session.token, payload);
      }
      resetProductForm();
    }, editingProductId ? "Product updated." : "Product created.");
  };

  const onIngredientSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      name: ingredientForm.name.trim(),
      sku: ingredientForm.sku || null,
      baseUnit: ingredientForm.baseUnit,
      minimumQuantity: Number(ingredientForm.minimumQuantity || 0),
    };

    await runAction(async () => {
      const ingredient = await createIngredient(session.token, payload);
      setIngredients((current) =>
        [...current, ingredient].sort((left, right) => left.name.localeCompare(right.name))
      );
      resetIngredientForm();
    }, "Ingredient created.");
  };

  const onRecipeSubmit = async (event) => {
    event.preventDefault();

    if (!recipeForm.productId) {
      setError("Choose a product for the recipe.");
      return;
    }

    if (
      recipeForm.items.some(
        (item) => !item.ingredientId || Number(item.quantity || 0) <= 0 || !item.unit
      )
    ) {
      setError("Every recipe item needs an ingredient, quantity, and unit.");
      return;
    }

    const payload = {
      productId: Number(recipeForm.productId),
      notes: recipeForm.notes || null,
      items: recipeForm.items.map((item) => ({
        ingredientId: Number(item.ingredientId),
        quantity: Number(item.quantity),
        unit: item.unit,
      })),
    };

    await runAction(async () => {
      const recipe = await saveRecipe(session.token, payload);
      setRecipes((current) => {
        const next = current.filter((entry) => entry.id !== recipe.id);
        return [recipe, ...next];
      });
      resetRecipeForm();
    }, "Recipe saved. Future sales will deduct ingredients.");
  };

  const onStockIntakeSubmit = async (event) => {
    event.preventDefault();

    if (!stockIntakeForm.supplierId) {
      setError("Choose a supplier before saving stock intake.");
      return;
    }

    if (
      stockIntakeForm.items.some(
        (item) => {
          const resolved = resolveStockIntakeItem(item, products, ingredients);
          return (
            !resolved.selectedIngredient ||
            Number(item.purchasedQuantity || 0) <= 0 ||
            Number(item.unitCost || 0) <= 0 ||
            !item.purchasedUnit ||
            (item.purchasedUnit === "paketa" && resolved.packageSize <= 0)
          );
        }
      )
    ) {
      setError("Every stock intake item needs a product/ingredient, quantity, unit, and cost. Package purchases need units per package.");
      return;
    }

    const payload = {
      supplierId: Number(stockIntakeForm.supplierId),
      invoiceNumber: stockIntakeForm.invoiceNumber || null,
      notes: stockIntakeForm.notes || null,
      confirm: Boolean(stockIntakeForm.confirm),
      items: stockIntakeForm.items.map((item) => {
        const resolved = resolveStockIntakeItem(item, products, ingredients);

        return {
          ingredientId: Number(resolved.selectedIngredient.id),
          purchasedQuantity:
            item.purchasedUnit === "paketa"
              ? Number(resolved.baseQuantity.toFixed(3))
              : Number(item.purchasedQuantity),
          purchasedUnit:
            item.purchasedUnit === "paketa"
              ? resolved.selectedIngredient.baseUnit
              : item.purchasedUnit,
          unitCost: Number(resolved.backendUnitCost.toFixed(4)),
        };
      }),
    };

    await runAction(async () => {
      const stockIntake = await createStockIntake(session.token, payload);
      setStockIntakes((current) => [stockIntake, ...current]);
      resetStockIntakeForm();
    }, payload.confirm ? "Stock intake confirmed and ingredient stock updated." : "Stock intake saved as draft.");
  };

  const onSupplierInvoiceSubmit = async (event) => {
    event.preventDefault();

    if (!supplierInvoiceForm.supplierId) {
      setError("Choose a supplier before saving the incoming invoice.");
      return;
    }

    if (supplierInvoiceForm.items.some((item) => !item.productId)) {
      setError("Choose a product for every incoming invoice item.");
      return;
    }

    if (
      supplierInvoiceForm.items.some(
        (item) =>
          Number(item.quantity) <= 0 ||
          Number(item.unitPrice) <= 0 ||
          Number(item.stockQuantity) <= 0
      )
    ) {
      setError("Every item needs a purchase quantity, total stock to add, and total paid greater than 0.");
      return;
    }

    if (
      supplierInvoiceForm.items.some(
        (item) =>
          !Number.isInteger(Number(item.quantity)) ||
          !Number.isInteger(Number(item.stockQuantity))
      )
    ) {
      setError("Purchase quantity and stock quantity must be whole numbers.");
      return;
    }

    const payload = {
      supplierId: Number(supplierInvoiceForm.supplierId),
      invoiceNumber: supplierInvoiceForm.invoiceNumber || null,
      orderDate: supplierInvoiceForm.orderDate,
      expectedDate: supplierInvoiceForm.expectedDate || null,
      status: supplierInvoiceForm.status,
      total: Number(supplierInvoiceTotal.toFixed(2)),
      notes: supplierInvoiceForm.notes || null,
      items: supplierInvoiceForm.items.map((item) => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity),
        unitPrice: Number((Number(item.unitPrice) / Number(item.quantity)).toFixed(4)),
        unit: item.unit || "cope",
        stockQuantity: calculateInvoiceItemStockQuantity(item),
      })),
    };

    await runAction(async () => {
      const supplierOrder = await createSupplierOrder(session.token, payload);
      setSupplierOrders((current) => [supplierOrder, ...current]);
      setProducts((current) =>
        current.map((product) => {
          const receivedItem =
            supplierOrder.status === "delivered"
              ? ensureArray(supplierOrder.items).find((item) => item.productId === product.id)
              : null;

          return receivedItem
            ? {
                ...product,
                stock: Number(product.stock || 0) + Number(receivedItem.stockQuantity || 0),
              }
            : product;
        })
      );
      resetSupplierInvoiceForm();
      try {
        await downloadSupplierInvoicePdf(session.token, supplierOrder.id);
      } catch (pdfError) {
        setError(`Invoice saved, but PDF could not download: ${pdfError.message || "PDF failed."}`);
      }
    }, payload.status === "delivered" ? "Incoming invoice saved, stock increased, and PDF downloaded." : "Incoming invoice saved as a draft and PDF downloaded.");
  };

  const markSupplierInvoiceDelivered = async (supplierOrder) => {
    await runAction(
      async () => {
        const updatedSupplierOrder = await updateSupplierOrder(session.token, supplierOrder.id, {
          status: "delivered",
        });

        setSupplierOrders((current) =>
          current.map((entry) =>
            entry.id === updatedSupplierOrder.id ? updatedSupplierOrder : entry
          )
        );
        setProducts((current) =>
          current.map((product) => {
            const receivedItem = ensureArray(updatedSupplierOrder.items).find(
              (item) => item.productId === product.id
            );

            return receivedItem
              ? {
                  ...product,
                  stock: Number(product.stock || 0) + Number(receivedItem.stockQuantity || 0),
                }
              : product;
          })
        );

        return updatedSupplierOrder;
      },
      "Incoming invoice delivered. Stock increased from invoice items."
    );
  };

  const onSupplierSubmit = async (event) => {
    event.preventDefault();

    if (!supplierForm.companyName.trim() || !supplierForm.contactName.trim() || !supplierForm.phone.trim()) {
      setError("Company, contact, and phone are required to add a supplier.");
      return;
    }

    const payload = {
      companyName: supplierForm.companyName.trim(),
      contactName: supplierForm.contactName.trim(),
      phone: supplierForm.phone.trim(),
      email: supplierForm.email || null,
      productType: supplierForm.productType || null,
    };

    await runAction(async () => {
      const supplier = await createSupplier(session.token, payload);
      setSuppliers((current) =>
        [...current, supplier].sort((left, right) =>
          left.companyName.localeCompare(right.companyName)
        )
      );
      setSupplierInvoiceForm((current) => ({
        ...current,
        supplierId: String(supplier.id),
      }));
      resetSupplierForm();
    }, "Supplier created.");
  };

  const onCategorySubmit = async (event) => {
    event.preventDefault();
    const payload = { name: categoryForm.name.trim() };

    await runAction(async () => {
      if (editingCategoryId) {
        const response = await updateCategory(session.token, editingCategoryId, payload);
        setCategories((current) =>
          sortCategoriesByNewest(
            current.map((entry) =>
              entry.id === editingCategoryId ? response.category || entry : entry
            )
          )
        );
      } else {
        const response = await createCategory(session.token, payload);
        setCategories((current) =>
          sortCategoriesByNewest([response.category, ...current].filter(Boolean))
        );
      }
      resetCategoryForm();
    }, editingCategoryId ? "Category updated." : "Category created.");
  };

  const handleDeleteCategory = async (category, productCount) => {
    await runAction(async () => {
      const response = await deleteCategory(session.token, category.id);
      setCategories((current) => current.filter((entry) => entry.id !== category.id));
      setProducts((current) =>
        current.map((product) =>
          product.categoryId === category.id
            ? {
                ...product,
                categoryId: null,
                category: null,
              }
            : product
        )
      );

      if (editingCategoryId === category.id) {
        resetCategoryForm();
      }
    }, productCount > 0 ? "Category deleted. Products moved to Uncategorized." : "Category deleted.");
  };

  const handleDeleteProduct = async (product) => {
    await runAction(async () => {
      await deleteProduct(session.token, product.id);
      setProducts((current) => current.filter((entry) => entry.id !== product.id));

      if (editingProductId === product.id) {
        resetProductForm();
      }
    }, "Product deleted.");
  };

  const onWaiterSubmit = async (event) => {
    event.preventDefault();

    if (!editingWaiterId && !waiterForm.pin.trim()) {
      setError("PIN is required when creating a waiter.");
      return;
    }

    const payload = {
      fullName: waiterForm.fullName.trim(),
      status: waiterForm.status,
      ...(waiterForm.pin ? { pin: waiterForm.pin.trim() } : {}),
    };

    await runAction(async () => {
      if (editingWaiterId) {
        await updateWaiter(session.token, editingWaiterId, payload);
      } else {
        await createWaiter(session.token, payload);
      }
      resetWaiterForm();
    }, editingWaiterId ? "Waiter updated." : "Waiter created.");
  };

  const onTableSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      number: Number(tableForm.number),
      capacity: Number(tableForm.capacity),
      location: tableForm.location.trim(),
    };

    await runAction(async () => {
      const createdTable = await createTable(session.token, payload);
      setTables((current) =>
        [...current, createdTable].sort((left, right) => left.number - right.number)
      );
      resetTableForm();
    }, "Table created.");
  };

  const saveWaiterTableAssignments = async () => {
    if (!selectedWaiterForTables) {
      setError("Select a waiter first.");
      return;
    }

    await runAction(
      () =>
        setWaiterTableAssignments(session.token, {
          waiterId: selectedWaiterForTables,
          tableIds: assignedTableIds,
        }),
      "Table assignments updated."
    );
  };

  const quickAssignSingleTable = async (tableId, waiterId) => {
    await runAction(
      () => assignTableToWaiter(session.token, tableId, waiterId),
      waiterId ? "Table assigned." : "Table unassigned."
    );
  };

  const handleDeleteWaiter = async (waiter) => {
    if (!window.confirm(`Delete waiter ${waiter.fullName}?`)) {
      return;
    }

    await runAction(async () => {
      const response = await deleteWaiter(session.token, waiter.id);

      setWaiters((current) => current.filter((entry) => entry.id !== waiter.id));
      setTables((current) =>
        current.map((table) =>
          table.assignedWaiterId === waiter.id
            ? {
                ...table,
                assignedWaiterId: null,
                assignedWaiter: null,
              }
            : table
        )
      );

      setSelectedWaiterForTables((current) => (current === waiter.id ? null : current));
      setAssignedTableIds((current) =>
        current.filter(
          (tableId) => !response?.unassignedTableIds || !response.unassignedTableIds.includes(tableId)
        )
      );
      resetWaiterForm();
    }, "Waiter deleted.");
  };

  const handleDeleteTable = async (table) => {
    await runAction(async () => {
      await deleteTable(session.token, table.id);
      setTables((current) => current.filter((entry) => entry.id !== table.id));
      setAssignedTableIds((current) => current.filter((tableId) => tableId !== table.id));
      setSelectedQrTableId((current) => (current === table.id ? null : current));
    }, `Table ${table.number} removed.`);
  };

  const handleDownloadReportCsv = async () => {
    await runAction(
      () => downloadAdvancedReportCsv(session.token, filters),
      "Advanced report CSV downloaded."
    );
  };

  const handleDownloadReportPdf = async () => {
    await runAction(
      () => downloadAdvancedReportPdf(session.token, filters),
      "Advanced report PDF downloaded."
    );
  };

  const handleRotateGuestQr = async () => {
    if (!selectedQrTableId) {
      setError("Select a table first.");
      return;
    }

    await runAction(async () => {
      const payload = await rotateGuestQrAccess(session.token, selectedQrTableId);
      setGuestAccess(payload);
    }, "Guest QR token rotated.");
  };

  const handleCopyGuestUrl = async () => {
    if (!guestOrderUrl) {
      setError("Guest QR link is not ready yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(guestOrderUrl);
      setFeedback("Guest ordering link copied.");
    } catch (copyError) {
      setError("Unable to copy the guest ordering link.");
    }
  };

  const startAddProductFromCategory = (categoryId) => {
    setActiveSection("products");
    setEditingProductId(null);
    setProductForm({
      ...defaultProductForm,
      categoryId: String(categoryId),
    });
  };

  const onUploadProductImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    setProductForm((current) => ({
      ...current,
      imageUrl: dataUrl,
    }));
  };

  if (isLoading) {
    return (
      <main className="pos-shell manager-shell">
        <PosScreenLoader label="Loading manager dashboard..." />
      </main>
    );
  }

  return (
    <main className="pos-shell manager-shell">
      <section className="grid min-h-[calc(100vh-24px)] grid-cols-1 gap-4 xl:grid-cols-[230px_1fr]">
        <aside className="pos-panel-soft flex flex-col gap-3 p-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <span className="pos-badge">Manager</span>
            <h2 className="mt-3 text-lg font-bold text-white">{session.user?.fullName}</h2>
            <p className="mt-1 text-xs uppercase tracking-wide text-pos-muted">
              {String(session.user?.role || "").toUpperCase()}
            </p>
          </div>

          <nav className="grid gap-2">
            {SECTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveSection(item.key)}
                className={`pos-button justify-start rounded-xl border px-3 ${
                  activeSection === item.key
                    ? "border-pos-accent bg-pos-accent text-slate-950"
                    : "border-white/10 bg-white/5 text-pos-text hover:bg-white/10"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto grid gap-2">
            <button className="pos-button pos-button-muted" type="button" onClick={refreshAll}>
              Refresh
            </button>
            <button className="pos-button pos-button-danger" type="button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col gap-4">
          <header className="pos-panel flex flex-wrap items-end justify-between gap-3 px-4 py-4">
            <div>
              <h1 className="pos-title">Manager Dashboard</h1>
              <p className="pos-subtitle mt-2">
                Full control over operations, products, staff, tables, and date-based sales.
              </p>
              <p className="mt-1 text-xs font-medium text-pos-muted">
                Today: {currentDateLabel}
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-wrap gap-2">
                {REPORT_FILTER_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => onSelectReportPreset(preset.key)}
                    className={`pos-button min-h-[42px] rounded-lg border px-3 text-xs ${
                      reportPreset === preset.key
                        ? "border-pos-accent bg-pos-accent text-slate-950"
                        : "border-white/15 bg-white/5 text-pos-text hover:bg-white/10"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <label className="text-xs text-pos-muted">
                From
                <input
                  type="date"
                  value={filters.from}
                  onChange={(event) => onChangeCustomFilterDate("from", event.target.value)}
                  className="mt-1 block rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-xs text-pos-muted">
                To
                <input
                  type="date"
                  value={filters.to}
                  onChange={(event) => onChangeCustomFilterDate("to", event.target.value)}
                  className="mt-1 block rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
          </header>

          {error ? (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
              {error}
            </div>
          ) : null}

          {feedback ? (
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
              {feedback}
            </div>
          ) : null}

          {activeSection === "overview" ? (
            <section className="grid min-h-0 grid-cols-1 gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {overviewCards.map((card) => (
                  <article key={card.label} className="pos-panel rounded-xl p-4">
                    <p className="m-0 text-xs uppercase tracking-wide text-pos-muted">
                      {card.label}
                    </p>
                    <p className="m-0 mt-2 text-2xl font-bold text-white">{card.value}</p>
                  </article>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <article className="pos-panel rounded-xl p-4">
                  <h3 className="m-0 text-base font-semibold text-white">Daily Revenue (7 days)</h3>
                  <p className="mb-3 mt-1 text-xs text-pos-muted">Paid orders trend</p>
                  <BarRows
                    rows={revenueTrend}
                    labelKey="date"
                    valueKey="revenue"
                    colorClass="bg-sky-400"
                    formatLabel={formatShortDay}
                    getMetaText={(entry) =>
                      `${entry.orders || 0} paid order${Number(entry.orders || 0) === 1 ? "" : "s"}`
                    }
                  />
                </article>

                <article className="pos-panel rounded-xl p-4">
                  <h3 className="m-0 text-base font-semibold text-white">Sales Per Waiter</h3>
                  <p className="mb-3 mt-1 text-xs text-pos-muted">Ranking by sales</p>
                  <BarRows
                    rows={waiterPerformance}
                    labelKey="waiterName"
                    valueKey="totalSales"
                    colorClass="bg-emerald-400"
                    getMetaText={(entry) =>
                      `${entry.ordersHandled || 0} order${Number(entry.ordersHandled || 0) === 1 ? "" : "s"}`
                    }
                  />
                </article>

                <article className="pos-panel rounded-xl p-4">
                  <h3 className="m-0 text-base font-semibold text-white">Top Selling Products</h3>
                  <p className="mb-3 mt-1 text-xs text-pos-muted">Based on paid orders</p>
                  {topProducts.length === 0 ? (
                    <p className="text-sm text-pos-muted">No paid sales yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {topProducts.slice(0, 5).map((entry, index) => (
                        <div
                          key={entry.product?.id || `${entry.product?.name}-${index}`}
                          className="rounded-xl border border-white/10 bg-black/20 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="m-0 text-sm font-semibold text-white">
                              {index + 1}. {entry.product?.name || "Product"}
                            </p>
                            <p className="m-0 text-xs text-pos-muted">
                              Qty {entry.totalQuantitySold || 0}
                            </p>
                          </div>
                          <p className="m-0 mt-1 text-xs text-pos-muted">
                            {entry.product?.category?.name || "No category"} |{" "}
                            {formatMoney(entry.product?.price)} EUR
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <article className="pos-panel rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="m-0 text-base font-semibold text-white">System Alerts</h3>
                      <p className="mb-3 mt-1 text-xs text-pos-muted">
                        Automatic inventory alerts when stock drops below minimum.
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs ${
                        (systemAlerts?.count || 0) > 0
                          ? "border-orange-400/30 bg-orange-500/15 text-orange-300"
                          : "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      {systemAlerts?.count || 0} open
                    </span>
                  </div>

                  <div className="space-y-2">
                    {ensureArray(systemAlerts?.alerts).length === 0 ? (
                      <p className="text-sm text-pos-muted">No active system alerts.</p>
                    ) : (
                      ensureArray(systemAlerts?.alerts).slice(0, 6).map((alert) => (
                        <div
                          key={alert.id}
                          className="rounded-xl border border-orange-300/25 bg-orange-500/10 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="m-0 text-sm font-semibold text-white">{alert.title}</p>
                            <span className="text-xs uppercase tracking-wide text-orange-200">
                              {alert.severity}
                            </span>
                          </div>
                          <p className="m-0 mt-1 text-xs text-orange-100/85">{alert.message}</p>
                          <p className="m-0 mt-2 text-[11px] text-orange-100/70">
                            {formatDateTime(alert.createdAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </article>

                <article className="pos-panel rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="m-0 text-base font-semibold text-white">Audit Trail</h3>
                      <p className="mb-3 mt-1 text-xs text-pos-muted">
                        Secure log of staff actions, edits, and POS activity.
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs ${
                        isRealtimeConnected
                          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                          : "border-slate-400/30 bg-slate-500/15 text-slate-300"
                      }`}
                    >
                      {isRealtimeConnected ? "Live" : "Waiting"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {ensureArray(auditTrail?.logs).length === 0 ? (
                      <p className="text-sm text-pos-muted">No audit events captured yet.</p>
                    ) : (
                      ensureArray(auditTrail?.logs).slice(0, 8).map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-xl border border-white/10 bg-black/20 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="m-0 text-sm font-semibold text-white">
                              {entry.actorName || "System"}
                            </p>
                            <span className="text-[11px] uppercase tracking-wide text-pos-muted">
                              {entry.statusCode}
                            </span>
                          </div>
                          <p className="m-0 mt-1 text-xs text-pos-muted">{entry.action}</p>
                          <p className="m-0 mt-2 text-[11px] text-pos-muted">
                            {formatDateTime(entry.createdAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {activeSection === "products" ? (
            <section className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[350px_1fr]">
              <article className="pos-panel rounded-xl p-4">
                <h3 className="m-0 text-base font-semibold text-white">
                  {editingProductId ? "Edit Product" : "Add Product"}
                </h3>
                <form className="mt-3 grid gap-2" onSubmit={onProductSubmit}>
                  <input
                    required
                    placeholder="Name"
                    value={productForm.name}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                  />
                  <select
                    value={productForm.categoryId}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, categoryId: event.target.value }))
                    }
                    className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select category</option>
                    <option value="uncategorized">Uncategorized</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Price"
                      value={productForm.price}
                      onChange={(event) =>
                        setProductForm((current) => ({ ...current, price: event.target.value }))
                      }
                      className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                    />
                    <input
                      required
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Stock"
                      value={productForm.stock}
                      onChange={(event) =>
                        setProductForm((current) => ({ ...current, stock: event.target.value }))
                      }
                      className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                    />
                    <select
                      value={productForm.stockUnit}
                      onChange={(event) =>
                        setProductForm((current) => ({ ...current, stockUnit: event.target.value }))
                      }
                      className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                    >
                      {productForm.stockUnit &&
                      !STOCK_UNITS.some((unit) => unit.value === productForm.stockUnit) ? (
                        <option value={productForm.stockUnit}>{productForm.stockUnit}</option>
                      ) : null}
                      {STOCK_UNITS.map((unit) => (
                        <option key={unit.value} value={unit.value}>
                          {unit.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Units per package"
                    value={productForm.unitsPerPackage}
                    onChange={(event) =>
                      setProductForm((current) => ({
                        ...current,
                        unitsPerPackage: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                  />
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                    Direct stock ingredient
                    <select
                      value={productForm.directStockIngredientId}
                      onChange={(event) =>
                        setProductForm((current) => ({
                          ...current,
                          directStockIngredientId: event.target.value,
                        }))
                      }
                      className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                    >
                      <option value="">None - use recipe or product stock</option>
                      {ingredients
                        .filter((ingredient) => ingredient.baseUnit === "pcs")
                        .map((ingredient) => (
                          <option key={ingredient.id} value={ingredient.id}>
                            {ingredient.name} | {formatQuantity(ingredient.currentQuantity, ingredient.baseUnit)}
                          </option>
                        ))}
                    </select>
                    <span className="text-[11px] normal-case tracking-normal text-pos-muted">
                      For direct sale items like orange juice, cola, water, cans, and snacks.
                    </span>
                  </label>
                  <input
                    placeholder="Image URL"
                    value={productForm.imageUrl}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, imageUrl: event.target.value }))
                    }
                    className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onUploadProductImage}
                    className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-xs text-pos-muted file:mr-3 file:rounded-md file:border-0 file:bg-pos-accent file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-950"
                  />
                  <textarea
                    placeholder="Description"
                    value={productForm.description}
                    onChange={(event) =>
                      setProductForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className="min-h-[78px] rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-pos-muted">
                    <input
                      type="checkbox"
                      checked={productForm.isAvailable}
                      onChange={(event) =>
                        setProductForm((current) => ({
                          ...current,
                          isAvailable: event.target.checked,
                        }))
                      }
                    />
                    Available
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="pos-button pos-button-primary" type="submit" disabled={isSaving}>
                      {editingProductId ? "Update" : "Create"}
                    </button>
                    <button
                      className="pos-button pos-button-muted"
                      type="button"
                      onClick={resetProductForm}
                    >
                      Clear
                    </button>
                  </div>
                </form>
              </article>

              <article className="pos-panel min-h-0 rounded-xl p-4">
                <h3 className="m-0 text-base font-semibold text-white">Products</h3>
                <div className="scroll-y mt-3 max-h-[58vh] overflow-y-auto rounded-xl border border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-black/20 text-xs uppercase tracking-wide text-pos-muted">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Price</th>
                        <th className="px-3 py-2">Stock</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id} className="border-t border-white/10">
                          <td className="px-3 py-2 text-white">{product.name}</td>
                          <td className="px-3 py-2 text-pos-muted">
                            {product.category?.name || "Uncategorized"}
                          </td>
                          <td className="px-3 py-2 text-pos-muted">{formatMoney(product.price)} EUR</td>
                          <td className="px-3 py-2 text-pos-muted">
                            {formatStock(product)}
                            {product.unitsPerPackage ? (
                              <span className="ml-2 text-[11px] text-pos-muted">
                                1 paketa = {product.unitsPerPackage}{" "}
                                {product.stockUnit || "cope"}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full border px-2 py-1 text-xs ${
                                product.isAvailable
                                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                                  : "border-red-400/30 bg-red-500/15 text-red-300"
                              }`}
                            >
                              {product.isAvailable ? "Enabled" : "Disabled"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex gap-2">
                              <button
                                className="rounded-lg border border-white/20 px-2 py-1 text-xs text-pos-text hover:bg-white/10"
                                type="button"
                                onClick={() => beginEditProduct(product)}
                              >
                                Edit
                              </button>
                              <button
                                className="rounded-lg border border-sky-300/40 bg-sky-500/15 px-2 py-1 text-xs text-sky-100 hover:bg-sky-500/25"
                                type="button"
                                onClick={() => {
                                  const nextPrice = window.prompt(
                                    `Set new price for ${product.name}`,
                                    String(product.price)
                                  );

                                  if (nextPrice === null) {
                                    return;
                                  }

                                  const parsedPrice = Number(nextPrice);
                                  if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
                                    setError("Price must be a number greater than or equal to 0.");
                                    return;
                                  }

                                  runAction(
                                    () =>
                                      updateProduct(session.token, product.id, {
                                        price: parsedPrice,
                                      }),
                                    "Product price updated."
                                  );
                                }}
                              >
                                Edit Price
                              </button>
                              <button
                                className="rounded-lg border border-white/20 px-2 py-1 text-xs text-pos-text hover:bg-white/10"
                                type="button"
                                onClick={() =>
                                  runAction(
                                    () =>
                                      updateProduct(session.token, product.id, {
                                        isAvailable: !product.isAvailable,
                                      }),
                                    product.isAvailable ? "Product disabled." : "Product enabled."
                                  )
                                }
                              >
                                {product.isAvailable ? "Disable" : "Enable"}
                              </button>
                              <button
                                className="rounded-lg border border-red-300/40 bg-red-500/15 px-2 py-1 text-xs text-red-200 hover:bg-red-500/25"
                                type="button"
                                disabled={isSaving}
                                onClick={() => handleDeleteProduct(product)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          ) : null}

          {activeSection === "categories" ? (
            <section className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <article className="pos-panel rounded-xl p-4">
                <h3 className="m-0 text-base font-semibold text-white">
                  {editingCategoryId ? "Edit Category" : "Add Category"}
                </h3>
                <form className="mt-3 grid gap-2" onSubmit={onCategorySubmit}>
                  <input
                    required
                    placeholder="Category name"
                    value={categoryForm.name}
                    onChange={(event) =>
                      setCategoryForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button className="pos-button pos-button-primary" type="submit" disabled={isSaving}>
                      {editingCategoryId ? "Update" : "Create"}
                    </button>
                    <button className="pos-button pos-button-muted" type="button" onClick={resetCategoryForm}>
                      Clear
                    </button>
                  </div>
                </form>

                {editingCategoryId ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="m-0 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                        Category Products
                      </p>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-pos-text">
                        {editingCategoryProducts.length}
                      </span>
                    </div>

                    {editingCategoryProducts.length === 0 ? (
                      <p className="m-0 mt-3 text-sm text-pos-muted">
                        No products in this category yet.
                      </p>
                    ) : (
                      <div className="scroll-y mt-3 max-h-[240px] space-y-2 overflow-y-auto pr-1">
                        {editingCategoryProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
                            onClick={() => {
                              setActiveSection("products");
                              beginEditProduct(product);
                            }}
                          >
                            <div className="min-w-0">
                              <p className="m-0 truncate text-sm font-semibold text-white">
                                {product.name}
                              </p>
                              <p className="m-0 mt-1 text-xs text-pos-muted">
                                {formatMoney(product.price)} EUR | Stock {formatStock(product)}
                              </p>
                            </div>
                            <span className="ml-3 shrink-0 text-[11px] font-semibold text-sky-200">
                              Edit Product
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </article>

              <article className="pos-panel min-h-0 rounded-xl p-4">
                <h3 className="m-0 text-base font-semibold text-white">Categories</h3>
                <div className="scroll-y mt-3 max-h-[58vh] overflow-y-auto rounded-xl border border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-black/20 text-xs uppercase tracking-wide text-pos-muted">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Products</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.length === 0 ? (
                        <tr className="border-t border-white/10">
                          <td className="px-3 py-6 text-pos-muted" colSpan={3}>
                            No categories created yet.
                          </td>
                        </tr>
                      ) : (
                        categories.map((category) => {
                          const count = productCountByCategoryId.get(category.id) || 0;

                          return (
                            <tr key={category.id} className="border-t border-white/10">
                              <td className="px-3 py-2 text-white">{category.name}</td>
                              <td className="px-3 py-2 text-pos-muted">
                                {count > 0 ? `${count} product${count > 1 ? "s" : ""}` : "Empty"}
                                {count > 0 ? (
                                  <div className="mt-1 text-[11px] text-orange-200/85">
                                    Products will move to Uncategorized
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="inline-flex gap-2">
                                  <button
                                    className="rounded-lg border border-sky-300/40 bg-sky-500/15 px-2 py-1 text-xs text-sky-200 hover:bg-sky-500/25"
                                    type="button"
                                    onClick={() => startAddProductFromCategory(category.id)}
                                  >
                                    Add Product
                                  </button>
                                  <button
                                    className="rounded-lg border border-white/20 px-2 py-1 text-xs text-pos-text hover:bg-white/10"
                                    type="button"
                                    onClick={() => beginEditCategory(category)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className={`rounded-lg px-2 py-1 text-xs ${
                                      isSaving
                                        ? "cursor-not-allowed border border-white/10 bg-white/5 text-pos-muted opacity-70"
                                        : "border border-red-300/40 bg-red-500/15 text-red-200 hover:bg-red-500/25"
                                    }`}
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => handleDeleteCategory(category, count)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          ) : null}

          {activeSection === "stock" ? (
            <section className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
              <article className="pos-panel min-h-0 rounded-xl p-4">
                <h3 className="m-0 text-base font-semibold text-white">Stock Management</h3>
                <div className="scroll-y mt-3 max-h-[58vh] overflow-y-auto rounded-xl border border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-black/20 text-xs uppercase tracking-wide text-pos-muted">
                      <tr>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Stock</th>
                        <th className="px-3 py-2 text-right">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id} className="border-t border-white/10">
                          <td className="px-3 py-2 text-white">{product.name}</td>
                          <td className="px-3 py-2 text-pos-muted">
                            {product.category?.name || "Uncategorized"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`font-semibold ${
                                product.stock <= Number(lowStock.threshold || 5)
                                  ? "text-red-300"
                                  : "text-pos-text"
                              }`}
                            >
                              {formatStock(product)}
                              <span className="ml-2 text-[11px] font-normal text-pos-muted">
                                #{product.id}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {STOCK_INTAKE_ENABLED ? (
                              <button
                                type="button"
                                className="rounded-md border border-emerald-300/40 bg-emerald-500/15 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-500/25"
                                onClick={() => setActiveSection("incoming")}
                              >
                                Stock In
                              </button>
                            ) : (
                              <span className="text-xs text-pos-muted">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="pos-panel rounded-xl p-4">
                <h3 className="m-0 text-base font-semibold text-white">
                  Low Stock Alerts ({"<="} {lowStock.threshold})
                </h3>
                <div className="mt-3 space-y-2">
                  {ensureArray(lowStock.inventoryAlerts).length > 0 ? (
                    ensureArray(lowStock.inventoryAlerts).map((alert) => (
                      <div
                        key={`inventory-${alert.id}`}
                        className="rounded-xl border border-orange-400/30 bg-orange-500/10 p-3"
                      >
                        <p className="m-0 text-sm font-semibold text-orange-100">{alert.title}</p>
                        <p className="m-0 mt-1 text-xs text-orange-100/85">{alert.message}</p>
                      </div>
                    ))
                  ) : null}

                  {ensureArray(lowStock.products).length === 0 &&
                  ensureArray(lowStock.inventoryAlerts).length === 0 ? (
                    <p className="text-sm text-pos-muted">No low-stock alerts right now.</p>
                  ) : (
                    ensureArray(lowStock.products).map((product) => (
                      <div
                        key={product.id}
                        className="rounded-xl border border-red-400/30 bg-red-500/10 p-3"
                      >
                        <p className="m-0 text-sm font-semibold text-red-200">{product.name}</p>
                        <p className="m-0 mt-1 text-xs text-red-200/90">
                          Stock: {formatStock(product)} | Category: {product.category?.name || "N/A"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>
          ) : null}

          {STOCK_INTAKE_ENABLED && activeSection === "incoming" ? (
            <section className="grid min-h-0 grid-cols-1 gap-4 2xl:grid-cols-[420px_520px_minmax(0,1fr)]">
              <div className="grid min-h-0 gap-4">
                <article className="pos-panel rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="m-0 text-base font-semibold text-white">Ingredients</h3>
                      <p className="m-0 mt-1 text-xs text-pos-muted">
                        Track raw stock in base units: grams, milliliters, or pieces.
                      </p>
                    </div>
                    <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                      {ingredients.length}
                    </span>
                  </div>

                  <form className="mt-4 grid gap-3" onSubmit={onIngredientSubmit}>
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                      Ingredient name
                      <input
                        required
                        placeholder="Coffee Beans"
                        value={ingredientForm.name}
                        onChange={(event) =>
                          setIngredientForm((current) => ({ ...current, name: event.target.value }))
                        }
                        className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                        SKU
                        <input
                          placeholder="Optional"
                          value={ingredientForm.sku}
                          onChange={(event) =>
                            setIngredientForm((current) => ({ ...current, sku: event.target.value }))
                          }
                          className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                        Base unit
                        <select
                          value={ingredientForm.baseUnit}
                          onChange={(event) =>
                            setIngredientForm((current) => ({
                              ...current,
                              baseUnit: event.target.value,
                            }))
                          }
                          className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                        >
                          {BASE_UNITS.map((unit) => (
                            <option key={unit.value} value={unit.value}>
                              {unit.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                      Low stock alert level
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="Example: 2000 for 2kg coffee"
                        value={ingredientForm.minimumQuantity}
                        onChange={(event) =>
                          setIngredientForm((current) => ({
                            ...current,
                            minimumQuantity: event.target.value,
                          }))
                        }
                        className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                      />
                      <span className="text-[11px] normal-case tracking-normal text-pos-muted">
                        Optional. Leave 0 if you do not want low-stock alerts for this ingredient yet.
                      </span>
                    </label>
                    <button className="pos-button pos-button-primary" type="submit" disabled={isSaving}>
                      Add Ingredient
                    </button>
                  </form>

                  <div className="scroll-y mt-4 max-h-[34vh] overflow-y-auto rounded-xl border border-white/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-black/20 text-xs uppercase tracking-wide text-pos-muted">
                        <tr>
                          <th className="px-3 py-2">Ingredient</th>
                          <th className="px-3 py-2 text-right">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ingredients.map((ingredient) => (
                          <tr key={ingredient.id} className="border-t border-white/10">
                            <td className="px-3 py-2 text-white">
                              {ingredient.name}
                              <p className="m-0 text-xs text-pos-muted">
                                #{ingredient.id} {ingredient.sku ? `| ${ingredient.sku}` : ""}
                              </p>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-pos-text">
                              {formatQuantity(ingredient.currentQuantity, ingredient.baseUnit)}
                            </td>
                          </tr>
                        ))}
                        {ingredients.length === 0 ? (
                          <tr>
                            <td colSpan="2" className="px-3 py-6 text-center text-pos-muted">
                              Add Coffee Beans, Milk, cups, bottles, or other ingredients.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="pos-panel rounded-xl p-4">
                  <h3 className="m-0 text-base font-semibold text-white">Recipe Builder</h3>
                  <p className="m-0 mt-1 text-xs text-pos-muted">
                    Connect sale products to ingredient consumption, e.g. Espresso = 8g coffee.
                  </p>
                  <form className="mt-4 grid gap-3" onSubmit={onRecipeSubmit}>
                    <select
                      required
                      value={recipeForm.productId}
                      onChange={(event) =>
                        setRecipeForm((current) => ({ ...current, productId: event.target.value }))
                      }
                      className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} #{product.id}
                        </option>
                      ))}
                    </select>

                    {recipeForm.items.map((item, index) => (
                      <div key={index} className="grid gap-2 rounded-xl border border-white/10 bg-black/15 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                            Recipe item {index + 1}
                          </p>
                          <button
                            type="button"
                            className="rounded-lg border border-red-300/40 bg-red-500/15 px-2 py-1 text-xs text-red-200"
                            disabled={recipeForm.items.length === 1}
                            onClick={() => removeRecipeItem(index)}
                          >
                            Remove
                          </button>
                        </div>
                        <select
                          required
                          value={item.ingredientId}
                          onChange={(event) => {
                            const ingredient = ingredients.find(
                              (entry) => String(entry.id) === String(event.target.value)
                            );
                            updateRecipeItem(index, "ingredientId", event.target.value);
                            updateRecipeItem(index, "unit", ingredient?.baseUnit || "g");
                          }}
                          className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                        >
                          <option value="">Ingredient</option>
                          {ingredients.map((ingredient) => (
                            <option key={ingredient.id} value={ingredient.id}>
                              {ingredient.name} ({ingredient.baseUnit})
                            </option>
                          ))}
                        </select>
                        <div className="grid grid-cols-[1fr_130px] gap-2">
                          <input
                            required
                            type="number"
                            min="0.001"
                            step="0.001"
                            placeholder="Quantity per sale"
                            value={item.quantity}
                            onChange={(event) =>
                              updateRecipeItem(index, "quantity", event.target.value)
                            }
                            className="min-w-0 rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                          />
                          <select
                            value={item.unit}
                            onChange={(event) => updateRecipeItem(index, "unit", event.target.value)}
                            className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                          >
                            {LEDGER_UNITS.map((unit) => (
                              <option key={unit.value} value={unit.value}>
                                {unit.value}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      className="rounded-lg border border-white/20 px-3 py-2 text-sm text-pos-text hover:bg-white/10"
                      onClick={addRecipeItem}
                    >
                      Add recipe item
                    </button>
                    <textarea
                      placeholder="Recipe notes optional"
                      value={recipeForm.notes}
                      onChange={(event) =>
                        setRecipeForm((current) => ({ ...current, notes: event.target.value }))
                      }
                      className="min-h-[64px] rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button className="pos-button pos-button-primary" type="submit" disabled={isSaving}>
                        Save Recipe
                      </button>
                      <button className="pos-button pos-button-muted" type="button" onClick={resetRecipeForm}>
                        Clear
                      </button>
                    </div>
                  </form>
                </article>
              </div>

              <article className="pos-panel rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="m-0 text-base font-semibold text-white">Stock Intake</h3>
                    <p className="m-0 mt-1 text-xs text-pos-muted">
                      Receive ingredients from suppliers. Confirmed intake updates stock and writes movements.
                    </p>
                  </div>
                  <span className="rounded-full border border-sky-300/25 bg-sky-500/10 px-3 py-1 text-xs text-sky-200">
                    Transaction safe
                  </span>
                </div>

                <form className="mt-4 grid gap-4" onSubmit={onStockIntakeSubmit}>
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                    Supplier
                    <select
                      required
                      value={stockIntakeForm.supplierId}
                      onChange={(event) =>
                        setStockIntakeForm((current) => ({
                          ...current,
                          supplierId: event.target.value,
                        }))
                      }
                      className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.companyName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <details className="rounded-lg border border-white/10 bg-black/15 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-pos-text">
                      Add supplier
                    </summary>
                    <div className="mt-3 grid gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          placeholder="Company"
                          value={supplierForm.companyName}
                          onChange={(event) =>
                            setSupplierForm((current) => ({ ...current, companyName: event.target.value }))
                          }
                          className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                        />
                        <input
                          placeholder="Contact"
                          value={supplierForm.contactName}
                          onChange={(event) =>
                            setSupplierForm((current) => ({ ...current, contactName: event.target.value }))
                          }
                          className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          placeholder="Phone"
                          value={supplierForm.phone}
                          onChange={(event) =>
                            setSupplierForm((current) => ({ ...current, phone: event.target.value }))
                          }
                          className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={supplierForm.email}
                          onChange={(event) =>
                            setSupplierForm((current) => ({ ...current, email: event.target.value }))
                          }
                          className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <button
                        type="button"
                        className="pos-button pos-button-muted"
                        disabled={isSaving}
                        onClick={onSupplierSubmit}
                      >
                        Save Supplier
                      </button>
                    </div>
                  </details>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                      Invoice number
                      <input
                        placeholder="INV-2026-001"
                        value={stockIntakeForm.invoiceNumber}
                        onChange={(event) =>
                          setStockIntakeForm((current) => ({
                            ...current,
                            invoiceNumber: event.target.value,
                          }))
                        }
                        className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-sm text-pos-text">
                      <input
                        type="checkbox"
                        checked={stockIntakeForm.confirm}
                        onChange={(event) =>
                          setStockIntakeForm((current) => ({
                            ...current,
                            confirm: event.target.checked,
                          }))
                        }
                      />
                      Confirm and apply stock
                    </label>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="m-0 text-sm font-semibold text-white">Items</p>
                      <button
                        type="button"
                        className="rounded-lg border border-white/20 px-3 py-2 text-sm text-pos-text hover:bg-white/10"
                        onClick={addStockIntakeItem}
                      >
                        Add item
                      </button>
                    </div>

                    {stockIntakeForm.items.map((item, index) => {
                      const {
                        baseQuantity,
                        lineTotal,
                        packageSize,
                        selectedIngredient,
                        selectedProduct,
                      } = resolveStockIntakeItem(item, products, ingredients);

                      return (
                        <div key={index} className="grid gap-3 rounded-xl border border-white/10 bg-black/15 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                              Intake item {index + 1}
                            </p>
                            <button
                              type="button"
                              className="rounded-lg border border-red-300/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-200"
                              onClick={() => removeStockIntakeItem(index)}
                              disabled={stockIntakeForm.items.length === 1}
                            >
                              Remove
                            </button>
                          </div>
                          <select
                            required
                            value={
                              item.sourceType === "ingredient"
                                ? `ingredient:${item.ingredientId}`
                                : `product:${item.productId}`
                            }
                            onChange={(event) => {
                              const [sourceType, sourceId] = event.target.value.split(":");
                              const product =
                                sourceType === "product"
                                  ? products.find((entry) => String(entry.id) === String(sourceId))
                                  : null;
                              const ingredient =
                                sourceType === "product"
                                  ? product?.directStockIngredient ||
                                    ingredients.find(
                                      (entry) =>
                                        String(entry.id) === String(product?.directStockIngredientId)
                                    )
                                  : ingredients.find((entry) => String(entry.id) === String(sourceId));

                              updateStockIntakeItem(index, "sourceType", sourceType);
                              updateStockIntakeItem(index, "productId", product?.id ? String(product.id) : "");
                              updateStockIntakeItem(index, "ingredientId", ingredient?.id ? String(ingredient.id) : "");
                              updateStockIntakeItem(
                                index,
                                "purchasedUnit",
                                sourceType === "product" && product?.unitsPerPackage
                                  ? "paketa"
                                  : ingredient?.baseUnit === "pcs"
                                    ? "pcs"
                                    : "kg"
                              );
                            }}
                            className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                          >
                            <option value="">Product or ingredient</option>
                            {products.map((product) => (
                              <option
                                key={`product-${product.id}`}
                                value={`product:${product.id}`}
                                disabled={!product.directStockIngredientId}
                              >
                                Product: {product.name}
                                {product.unitsPerPackage
                                  ? ` | 1 paketa = ${product.unitsPerPackage} pcs`
                                  : ""}
                                {!product.directStockIngredientId ? " | link direct stock first" : ""}
                              </option>
                            ))}
                            {ingredients.map((ingredient) => (
                              <option key={`ingredient-${ingredient.id}`} value={`ingredient:${ingredient.id}`}>
                                Ingredient: {ingredient.name} | Stock {formatQuantity(ingredient.currentQuantity, ingredient.baseUnit)}
                              </option>
                            ))}
                          </select>

                          <div className="grid gap-3 md:grid-cols-3">
                            <input
                              required
                              type="number"
                              min="0.001"
                              step="0.001"
                              placeholder="Quantity bought"
                              value={item.purchasedQuantity}
                              onChange={(event) =>
                                updateStockIntakeItem(index, "purchasedQuantity", event.target.value)
                              }
                              className="min-w-0 rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                            />
                            <select
                              value={item.purchasedUnit}
                              onChange={(event) =>
                                updateStockIntakeItem(index, "purchasedUnit", event.target.value)
                              }
                              className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                            >
                              {LEDGER_UNITS.map((unit) => (
                                <option key={unit.value} value={unit.value}>
                                  {unit.value}
                                </option>
                              ))}
                            </select>
                            <input
                              required
                              type="number"
                              min="0.01"
                              step="0.01"
                              placeholder="Cost per bought unit"
                              value={item.unitCost}
                              onChange={(event) =>
                                updateStockIntakeItem(index, "unitCost", event.target.value)
                              }
                              className="min-w-0 rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                            />
                          </div>

                          <div className="grid gap-2 text-xs sm:grid-cols-3">
                            <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                              <p className="m-0 text-pos-muted">Line total</p>
                              <p className="m-0 mt-1 font-semibold text-white">{formatMoney(lineTotal)} EUR</p>
                            </div>
                            <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-2">
                              <p className="m-0 text-emerald-100/80">Internal stock</p>
                              <p className="m-0 mt-1 font-semibold text-emerald-200">
                                {selectedIngredient
                                  ? item.purchasedQuantity
                                    ? item.purchasedUnit === "paketa"
                                      ? `${item.purchasedQuantity} paketa x ${packageSize || 0} = ${formatQuantity(baseQuantity, selectedIngredient.baseUnit)}`
                                      : `${item.purchasedQuantity} ${item.purchasedUnit} will be stored as ${selectedIngredient.baseUnit}`
                                    : `Enter quantity; it will be stored as ${selectedIngredient.baseUnit}`
                                  : "Choose ingredient"}
                              </p>
                              {selectedProduct && !selectedProduct.unitsPerPackage ? (
                                <p className="m-0 mt-1 text-[11px] text-orange-100">
                                  Set units per package on this product if you want to buy it as paketa.
                                </p>
                              ) : null}
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                              <p className="m-0 text-pos-muted">Movement</p>
                              <p className="m-0 mt-1 font-semibold text-white">
                                {stockIntakeForm.confirm ? "IN history created" : "Draft only"}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <textarea
                    placeholder="Notes optional"
                    value={stockIntakeForm.notes}
                    onChange={(event) =>
                      setStockIntakeForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    className="min-h-[72px] rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                  />

                  <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-pos-muted">Intake total</span>
                      <span className="text-base font-semibold text-white">
                        {formatMoney(
                          stockIntakeForm.items.reduce(
                            (sum, item) => sum + calculateStockIntakeLineTotal(item),
                            0
                          )
                        )}{" "}
                        EUR
                      </span>
                    </div>
                    <p className="m-0 text-xs text-pos-muted">
                      Confirmed intakes update ingredient stock and create immutable stock movements.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button className="pos-button pos-button-primary" type="submit" disabled={isSaving}>
                      {stockIntakeForm.confirm ? "Save & Apply Stock" : "Save Draft"}
                    </button>
                    <button className="pos-button pos-button-muted" type="button" onClick={resetStockIntakeForm}>
                      Clear
                    </button>
                  </div>
                </form>
              </article>

              <div className="grid min-h-0 gap-4">
                <article className="pos-panel min-h-0 rounded-xl p-4">
                  <h3 className="m-0 text-base font-semibold text-white">Stock Intakes</h3>
                  <div className="scroll-y mt-3 max-h-[34vh] overflow-y-auto rounded-xl border border-white/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-black/20 text-xs uppercase tracking-wide text-pos-muted">
                        <tr>
                          <th className="px-3 py-2">Invoice</th>
                          <th className="px-3 py-2">Supplier</th>
                          <th className="px-3 py-2">Items</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockIntakes.map((intake) => (
                          <tr key={intake.id} className="border-t border-white/10 align-top">
                            <td className="px-3 py-2 text-white">
                              {intake.invoiceNumber || `#${intake.id}`}
                              <p className="m-0 mt-1 text-xs text-pos-muted">{formatDate(intake.createdAt)}</p>
                            </td>
                            <td className="px-3 py-2 text-pos-muted">
                              {intake.supplier?.companyName || "Supplier"}
                            </td>
                            <td className="px-3 py-2 text-pos-muted">
                              {ensureArray(intake.items).map((item) => (
                                <p key={item.id} className="m-0">
                                  {item.ingredient?.name || "Ingredient"} +{" "}
                                  {formatQuantity(item.baseQuantity, item.baseUnit)}
                                </p>
                              ))}
                            </td>
                            <td className="px-3 py-2 text-right text-pos-text">
                              {formatMoney(intake.totalCost)} EUR
                            </td>
                          </tr>
                        ))}
                        {stockIntakes.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="px-3 py-6 text-center text-pos-muted">
                              No stock intakes yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="pos-panel min-h-0 rounded-xl p-4">
                  <h3 className="m-0 text-base font-semibold text-white">Stock Movements</h3>
                  <p className="m-0 mt-1 text-xs text-pos-muted">
                    Every IN or OUT stock change is stored here.
                  </p>
                  <div className="scroll-y mt-3 max-h-[34vh] overflow-y-auto rounded-xl border border-white/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-black/20 text-xs uppercase tracking-wide text-pos-muted">
                        <tr>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Ingredient</th>
                          <th className="px-3 py-2">Change</th>
                          <th className="px-3 py-2">After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockMovements.map((movement) => (
                          <tr key={movement.id} className="border-t border-white/10">
                            <td className="px-3 py-2">
                              <span
                                className={`rounded-full border px-2 py-1 text-xs ${
                                  movement.type === "IN"
                                    ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                                    : "border-orange-400/30 bg-orange-500/15 text-orange-200"
                                }`}
                              >
                                {movement.type}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-white">
                              {movement.ingredient?.name || "Ingredient"}
                              <p className="m-0 text-xs text-pos-muted">{movement.sourceType}</p>
                            </td>
                            <td className="px-3 py-2 text-pos-text">
                              {movement.type === "IN" ? "+" : "-"}
                              {formatQuantity(movement.quantity, movement.unit)}
                            </td>
                            <td className="px-3 py-2 text-pos-muted">
                              {formatQuantity(movement.newStock, movement.unit)}
                            </td>
                          </tr>
                        ))}
                        {stockMovements.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="px-3 py-6 text-center text-pos-muted">
                              No stock movement history yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="pos-panel rounded-xl p-4">
                  <h3 className="m-0 text-base font-semibold text-white">Active Recipes</h3>
                  <div className="mt-3 grid gap-2">
                    {recipes.map((recipe) => (
                      <div key={recipe.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                        <p className="m-0 text-sm font-semibold text-white">
                          {recipe.product?.name || `Product #${recipe.productId}`}
                        </p>
                        <p className="m-0 mt-1 text-xs text-pos-muted">
                          {ensureArray(recipe.items)
                            .map((item) =>
                              `${formatQuantity(item.quantity, item.unit)} ${item.ingredient?.name || "ingredient"}`
                            )
                            .join(" + ")}
                        </p>
                      </div>
                    ))}
                    {recipes.length === 0 ? (
                      <p className="text-sm text-pos-muted">No recipes configured yet.</p>
                    ) : null}
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {false && STOCK_INTAKE_ENABLED && activeSection === "incoming" ? (
            <section className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[520px_minmax(0,1fr)]">
              <article className="pos-panel rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="m-0 text-base font-semibold text-white">Stock Intake</h3>
                    <p className="m-0 mt-1 text-xs text-pos-muted">
                      Enter what arrived from a supplier. Delivered invoices apply stock once.
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      supplierInvoiceForm.status === "delivered"
                        ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-200"
                        : "border-orange-300/30 bg-orange-500/15 text-orange-200"
                    }`}
                  >
                    {supplierInvoiceForm.status === "delivered"
                      ? "Stock will update"
                      : "Draft only"}
                  </span>
                </div>

                <form className="mt-4 grid gap-4" onSubmit={onSupplierInvoiceSubmit}>
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                    Supplier
                    <select
                      required
                      value={supplierInvoiceForm.supplierId}
                      onChange={(event) =>
                        setSupplierInvoiceForm((current) => ({
                          ...current,
                          supplierId: event.target.value,
                        }))
                      }
                      className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.companyName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <details className="rounded-lg border border-white/10 bg-black/15 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-pos-text">
                      Add supplier
                    </summary>
                    <div className="mt-3 grid gap-2" onSubmit={onSupplierSubmit}>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          placeholder="Company"
                          value={supplierForm.companyName}
                          onChange={(event) =>
                            setSupplierForm((current) => ({
                              ...current,
                              companyName: event.target.value,
                            }))
                          }
                          className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                        />
                        <input
                          placeholder="Contact"
                          value={supplierForm.contactName}
                          onChange={(event) =>
                            setSupplierForm((current) => ({
                              ...current,
                              contactName: event.target.value,
                            }))
                          }
                          className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          placeholder="Phone"
                          value={supplierForm.phone}
                          onChange={(event) =>
                            setSupplierForm((current) => ({
                              ...current,
                              phone: event.target.value,
                            }))
                          }
                          className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={supplierForm.email}
                          onChange={(event) =>
                            setSupplierForm((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <input
                        placeholder="Product type"
                        value={supplierForm.productType}
                        onChange={(event) =>
                          setSupplierForm((current) => ({
                            ...current,
                            productType: event.target.value,
                          }))
                        }
                        className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                      />
                      <button
                        type="button"
                        className="pos-button pos-button-muted"
                        disabled={isSaving}
                        onClick={onSupplierSubmit}
                      >
                        Save Supplier
                      </button>
                    </div>
                  </details>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                      Invoice number
                      <input
                        placeholder="Optional"
                        value={supplierInvoiceForm.invoiceNumber}
                        onChange={(event) =>
                          setSupplierInvoiceForm((current) => ({
                            ...current,
                            invoiceNumber: event.target.value,
                          }))
                        }
                        className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                      />
                    </label>

                    <div className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                      Stock action
                      <div className="grid grid-cols-3 gap-2 normal-case tracking-normal">
                        {[
                          { value: "pending", label: "Draft" },
                          { value: "approved", label: "Ordered" },
                          { value: "delivered", label: "Delivered" },
                        ].map((statusOption) => (
                          <button
                            key={statusOption.value}
                            type="button"
                            className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                              supplierInvoiceForm.status === statusOption.value
                                ? "border-emerald-300/40 bg-emerald-400/80 text-[#052016]"
                                : "border-white/15 bg-pos-panelSoft text-pos-text hover:bg-white/10"
                            }`}
                            onClick={() =>
                              setSupplierInvoiceForm((current) => ({
                                ...current,
                                status: statusOption.value,
                              }))
                            }
                          >
                            {statusOption.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                      Invoice date
                      <input
                        type="date"
                        value={supplierInvoiceForm.orderDate}
                        onChange={(event) =>
                          setSupplierInvoiceForm((current) => ({
                            ...current,
                            orderDate: event.target.value,
                          }))
                        }
                        className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                      Expected date
                      <input
                        type="date"
                        value={supplierInvoiceForm.expectedDate}
                        onChange={(event) =>
                          setSupplierInvoiceForm((current) => ({
                            ...current,
                            expectedDate: event.target.value,
                          }))
                        }
                        className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                      />
                    </label>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="m-0 text-sm font-semibold text-white">Items</p>
                      <button
                        type="button"
                        className="rounded-lg border border-white/20 px-3 py-2 text-sm text-pos-text hover:bg-white/10"
                        onClick={addSupplierInvoiceItem}
                      >
                        Add item
                      </button>
                    </div>

                    {supplierInvoiceForm.items.map((item, index) => {
                      const selectedProduct =
                        products.find((product) => String(product.id) === String(item.productId)) ||
                        null;
                      const stockUnit = getProductStockUnit(selectedProduct);
                      const lineTotal = calculateInvoiceItemLineTotal(item);
                      const stockAfter = calculateInvoiceItemStockAfter(item, selectedProduct);

                      return (
                        <div
                          key={index}
                          className="grid gap-3 rounded-xl border border-white/10 bg-black/15 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                              Item {index + 1}
                            </p>
                            <button
                              type="button"
                              className="rounded-lg border border-red-300/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-200"
                              onClick={() => removeSupplierInvoiceItem(index)}
                              disabled={supplierInvoiceForm.items.length === 1}
                            >
                              Remove
                            </button>
                          </div>

                          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                            Product
                            <select
                              required
                              value={item.productId}
                              onChange={(event) =>
                                setSupplierInvoiceForm((current) => ({
                                  ...current,
                                  items: current.items.map((entry, itemIndex) => {
                                    if (itemIndex !== index) {
                                      return entry;
                                    }

                                    const nextProduct = products.find(
                                      (product) => String(product.id) === String(event.target.value)
                                    );
                                    const nextUnit = getDefaultPurchaseUnitForProduct(nextProduct);

                                    return {
                                      ...entry,
                                      productId: event.target.value,
                                      unit: nextUnit,
                                      stockQuantity: getDefaultStockQuantity(
                                        nextProduct,
                                        nextUnit,
                                        entry.quantity
                                      ),
                                    };
                                  }),
                                }))
                              }
                              className="min-w-0 rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                            >
                              <option value="">Product</option>
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {formatProductOption(product)}
                                </option>
                              ))}
                            </select>
                          </label>

                          {selectedProduct ? (
                            <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-pos-muted">
                              Buying as {item.unit || stockUnit}; stock will be added to{" "}
                              {selectedProduct.name} in {stockUnit}. For coffee in kg, enter how
                              many espresso portions that kg purchase should add.
                            </div>
                          ) : null}

                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                              Bought quantity
                              <input
                                required
                                type="number"
                                min="1"
                                step="1"
                                placeholder="Qty"
                                value={item.quantity}
                                onChange={(event) =>
                                  setSupplierInvoiceForm((current) => ({
                                    ...current,
                                    items: current.items.map((entry, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...entry,
                                            quantity: event.target.value,
                                            stockQuantity: getDefaultStockQuantity(
                                              selectedProduct,
                                              entry.unit || stockUnit,
                                              event.target.value
                                            ),
                                          }
                                        : entry
                                    ),
                                  }))
                                }
                                className="min-w-0 rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                              />
                            </label>

                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                              Bought as
                              <select
                                value={item.unit || "cope"}
                                onChange={(event) => {
                                  const nextUnit = event.target.value;

                                  setSupplierInvoiceForm((current) => ({
                                    ...current,
                                    items: current.items.map((entry, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...entry,
                                            unit: nextUnit,
                                            stockQuantity: getDefaultStockQuantity(
                                              selectedProduct,
                                              nextUnit,
                                              entry.quantity
                                            ),
                                          }
                                        : entry
                                    ),
                                  }));
                                }}
                                className="min-w-0 rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                              >
                                {PURCHASE_UNITS.map((unit) => (
                                  <option key={unit.value} value={unit.value}>
                                    {unit.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                              Total stock to add
                              <div className="grid grid-cols-[1fr_auto] overflow-hidden rounded-lg border border-white/15 bg-pos-panelSoft normal-case tracking-normal">
                                <input
                                  required
                                  type="number"
                                  min="1"
                                  step="1"
                                  placeholder="Total"
                                  value={item.stockQuantity}
                                  onChange={(event) =>
                                    updateSupplierInvoiceItem(
                                      index,
                                      "stockQuantity",
                                      event.target.value
                                    )
                                  }
                                  className="min-w-0 border-0 bg-transparent px-3 py-2 text-sm font-medium text-white outline-none"
                                />
                                <span className="flex items-center px-3 text-xs text-pos-muted">
                                  {stockUnit}
                                </span>
                              </div>
                            </label>

                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                              Total paid for this item
                              <input
                                required
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="EUR total"
                                value={item.unitPrice}
                                onChange={(event) =>
                                  updateSupplierInvoiceItem(index, "unitPrice", event.target.value)
                                }
                                className="min-w-0 rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                              />
                            </label>
                          </div>

                          <div className="grid gap-2 text-xs sm:grid-cols-3">
                            <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                              <p className="m-0 text-pos-muted">Line total</p>
                              <p className="m-0 mt-1 font-semibold text-white">
                                {formatMoney(lineTotal)} EUR
                              </p>
                            </div>
                            <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-2">
                              <p className="m-0 text-emerald-100/80">Stock increase</p>
                              <p className="m-0 mt-1 font-semibold text-emerald-200">
                                + {formatInvoiceItemStockImpact(item, selectedProduct)}
                              </p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                              <p className="m-0 text-pos-muted">Stock after save</p>
                              <p className="m-0 mt-1 font-semibold text-white">
                                {supplierInvoiceForm.status === "delivered" && selectedProduct
                                  ? `${stockAfter} ${stockUnit}`
                                  : "No change yet"}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-pos-muted">
                    Notes
                    <textarea
                      placeholder="Optional notes for this invoice"
                      value={supplierInvoiceForm.notes}
                      onChange={(event) =>
                        setSupplierInvoiceForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      className="min-h-[72px] rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
                    />
                  </label>

                  <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-pos-muted">Invoice total</span>
                      <span className="text-base font-semibold text-white">
                        {formatMoney(supplierInvoiceTotal)} EUR
                      </span>
                    </div>
                    <p className="m-0 text-xs text-pos-muted">
                      {supplierInvoiceForm.status === "delivered"
                        ? "Saving will immediately add the stock quantities above."
                        : "Saving keeps this invoice as a draft until you mark it delivered."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button className="pos-button pos-button-primary" type="submit" disabled={isSaving}>
                      {supplierInvoiceForm.status === "delivered"
                        ? "Save & Apply Stock"
                        : "Save Draft"}
                    </button>
                    <button
                      className="pos-button pos-button-muted"
                      type="button"
                      onClick={resetSupplierInvoiceForm}
                    >
                      Clear
                    </button>
                  </div>
                </form>
              </article>

              <article className="pos-panel min-h-0 rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="m-0 text-base font-semibold text-white">Invoice History</h3>
                    <p className="m-0 mt-1 text-xs text-pos-muted">
                      Pending entries do not change stock until delivered.
                    </p>
                  </div>
                </div>
                <div className="scroll-y mt-3 max-h-[64vh] overflow-y-auto rounded-xl border border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-black/20 text-xs uppercase tracking-wide text-pos-muted">
                      <tr>
                        <th className="px-3 py-2">Invoice</th>
                        <th className="px-3 py-2">Supplier</th>
                        <th className="px-3 py-2">Items</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierOrders.map((supplierOrder) => (
                        <tr key={supplierOrder.id} className="border-t border-white/10 align-top">
                          <td className="px-3 py-2 text-white">
                            {supplierOrder.invoiceNumber || `#${supplierOrder.id}`}
                            <p className="m-0 mt-1 text-xs text-pos-muted">
                              {formatDate(supplierOrder.orderDate)}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-pos-muted">
                            {supplierOrder.supplier?.companyName || "Supplier"}
                          </td>
                          <td className="px-3 py-2 text-pos-muted">
                            <div className="grid gap-1">
                              {ensureArray(supplierOrder.items).map((item) => {
                                const itemUnit = item.unit || item.product?.stockUnit || "cope";
                                const itemLineTotal = calculateInvoiceItemLineTotal(item);

                                return (
                                  <div key={item.id || item.productId} className="grid gap-0.5">
                                    <span className="font-medium text-pos-text">
                                      {item.product?.name || "Product"} #{item.productId}
                                    </span>
                                    <span className="text-xs text-pos-muted">
                                      Bought {item.quantity} {itemUnit} | Stock +{" "}
                                      {formatInvoiceItemStockImpact(item, item.product)} |{" "}
                                      {formatMoney(itemLineTotal)} EUR
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-pos-muted">
                            {formatMoney(supplierOrder.total)} EUR
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full border px-2 py-1 text-xs ${
                                supplierOrder.status === "delivered"
                                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                                  : "border-orange-400/30 bg-orange-500/15 text-orange-200"
                              }`}
                            >
                              {supplierOrder.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {supplierOrder.status !== "delivered" ? (
                                <button
                                  type="button"
                                  className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-500/25"
                                  onClick={() => markSupplierInvoiceDelivered(supplierOrder)}
                                >
                                  Mark delivered
                                </button>
                              ) : (
                                <span className="px-2 py-1 text-xs text-pos-muted">Stock applied</span>
                              )}
                              <button
                                type="button"
                                className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/15"
                                onClick={() =>
                                  runAction(
                                    () => downloadSupplierInvoicePdf(session.token, supplierOrder.id),
                                    "Incoming invoice PDF downloaded."
                                  )
                                }
                              >
                                PDF
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {supplierOrders.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-3 py-6 text-center text-pos-muted">
                            No incoming invoices yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          ) : null}

          {activeSection === "employees" ? (
            <section className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
              <div className="grid min-h-0 grid-cols-1 gap-4">
                <article className="pos-panel rounded-xl p-4">
                  <h3 className="m-0 text-base font-semibold text-white">
                    {editingWaiterId ? "Edit Waiter" : "Add Waiter"}
                  </h3>
                  <p className="mt-2 text-xs text-pos-muted">
                    Essential fields only: waiter name + PIN.
                  </p>
                  <form className="mt-3 grid gap-2" onSubmit={onWaiterSubmit}>
                    <input
                      required
                      placeholder="Waiter name"
                      value={waiterForm.fullName}
                      onChange={(event) =>
                        setWaiterForm((current) => ({ ...current, fullName: event.target.value }))
                      }
                      className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                    />
                    <input
                      required={!editingWaiterId}
                      placeholder={
                        editingWaiterId ? "New PIN (optional)" : "PIN (4 digits)"
                      }
                      value={waiterForm.pin}
                      onChange={(event) =>
                        setWaiterForm((current) => ({
                          ...current,
                          pin: event.target.value.replace(/\D/g, "").slice(0, 4),
                        }))
                      }
                      className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                    />
                    <select
                      value={waiterForm.status}
                      onChange={(event) =>
                        setWaiterForm((current) => ({ ...current, status: event.target.value }))
                      }
                      className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="pos-button pos-button-primary"
                        type="submit"
                        disabled={isSaving}
                      >
                        {editingWaiterId ? "Update Waiter" : "Add Waiter"}
                      </button>
                      <button
                        className="pos-button pos-button-muted"
                        type="button"
                        onClick={resetWaiterForm}
                      >
                        Clear
                      </button>
                    </div>
                  </form>
                </article>

                <article className="pos-panel rounded-xl p-4">
                  <h3 className="m-0 text-base font-semibold text-white">Table Management</h3>
                  <p className="mt-2 text-xs text-pos-muted">
                    Add new tables and remove old ones from the same place.
                  </p>
                  <form className="mt-3 grid gap-2" onSubmit={onTableSubmit}>
                    <input
                      required
                      min="1"
                      type="number"
                      placeholder="Table number"
                      value={tableForm.number}
                      onChange={(event) =>
                        setTableForm((current) => ({ ...current, number: event.target.value }))
                      }
                      className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                    />
                    <input
                      required
                      min="1"
                      type="number"
                      placeholder="Capacity"
                      value={tableForm.capacity}
                      onChange={(event) =>
                        setTableForm((current) => ({ ...current, capacity: event.target.value }))
                      }
                      className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                    />
                    <input
                      required
                      placeholder="Location"
                      value={tableForm.location}
                      onChange={(event) =>
                        setTableForm((current) => ({ ...current, location: event.target.value }))
                      }
                      className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="pos-button pos-button-primary"
                        type="submit"
                        disabled={isSaving}
                      >
                        Add Table
                      </button>
                      <button
                        className="pos-button pos-button-muted"
                        type="button"
                        onClick={resetTableForm}
                      >
                        Clear
                      </button>
                    </div>
                  </form>

                  <div className="mt-4 rounded-xl border border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-3">
                      <div>
                        <h4 className="m-0 text-sm font-semibold text-white">Existing Tables</h4>
                        <p className="m-0 mt-1 text-[11px] text-pos-muted">
                          Delete a table here when you no longer need it.
                        </p>
                      </div>
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-pos-muted">
                        {tables.length} total
                      </span>
                    </div>

                    <div className="scroll-y max-h-[28vh] overflow-y-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-black/20 text-xs uppercase tracking-wide text-pos-muted">
                          <tr>
                            <th className="px-3 py-2">Table</th>
                            <th className="px-3 py-2">Cap.</th>
                            <th className="px-3 py-2">Waiter</th>
                            <th className="px-3 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tables.length === 0 ? (
                            <tr className="border-t border-white/10">
                              <td className="px-3 py-6 text-pos-muted" colSpan={4}>
                                No tables yet. Add your first table.
                              </td>
                            </tr>
                          ) : (
                            tables
                              .slice()
                              .sort((left, right) => left.number - right.number)
                              .map((table) => (
                                <tr
                                  key={`manage-table-inline-${table.id}`}
                                  className="border-t border-white/10"
                                >
                                  <td className="px-3 py-2 text-white">Table {table.number}</td>
                                  <td className="px-3 py-2 text-pos-muted">{table.capacity}</td>
                                  <td className="px-3 py-2 text-pos-muted">
                                    {table.assignedWaiter?.fullName || "Unassigned"}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      className="rounded-lg border border-red-300/40 bg-red-500/15 px-2 py-1 text-xs text-red-200 hover:bg-red-500/25"
                                      type="button"
                                      onClick={() => handleDeleteTable(table)}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </article>
              </div>

              <div className="grid min-h-0 grid-cols-1 gap-4">
                <article className="pos-panel min-h-0 rounded-xl p-4">
                  <h3 className="m-0 text-base font-semibold text-white">Waiters</h3>
                  <div className="scroll-y mt-3 max-h-[30vh] overflow-y-auto rounded-xl border border-white/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-black/20 text-xs uppercase tracking-wide text-pos-muted">
                        <tr>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Assigned Tables</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {waiters.length === 0 ? (
                          <tr className="border-t border-white/10">
                            <td className="px-3 py-6 text-pos-muted" colSpan={5}>
                              No waiters yet. Add your first waiter.
                            </td>
                          </tr>
                        ) : (
                          waiters.map((waiter) => (
                            <tr key={waiter.id} className="border-t border-white/10">
                              <td className="px-3 py-2 text-white">{waiter.fullName}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`rounded-full border px-2 py-1 text-xs ${
                                    waiter.status === "active"
                                      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                                      : "border-orange-400/30 bg-orange-500/15 text-orange-300"
                                  }`}
                                >
                                  {waiter.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-pos-muted">{waiter.email}</td>
                              <td className="px-3 py-2 text-pos-muted">
                                {(tablesByWaiter.get(waiter.id) || []).length}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="inline-flex gap-2">
                                  <button
                                    className="rounded-lg border border-white/20 px-2 py-1 text-xs text-pos-text hover:bg-white/10"
                                    type="button"
                                    onClick={() => beginEditWaiter(waiter)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="rounded-lg border border-sky-300/40 bg-sky-500/15 px-2 py-1 text-xs text-sky-100 hover:bg-sky-500/25"
                                    type="button"
                                    onClick={() => setSelectedWaiterForTables(waiter.id)}
                                  >
                                    Assign Tables
                                  </button>
                                  <button
                                    className="rounded-lg border border-orange-300/40 bg-orange-500/15 px-2 py-1 text-xs text-orange-200 hover:bg-orange-500/25"
                                    type="button"
                                    onClick={() =>
                                      runAction(
                                        () =>
                                          updateWaiterStatus(session.token, waiter.id, {
                                            status:
                                              waiter.status === "active"
                                                ? "inactive"
                                                : "active",
                                          }),
                                        waiter.status === "active"
                                          ? "Waiter disabled."
                                          : "Waiter enabled."
                                      )
                                    }
                                  >
                                    {waiter.status === "active" ? "Disable" : "Enable"}
                                  </button>
                                  <button
                                    className="rounded-lg border border-red-300/40 bg-red-500/15 px-2 py-1 text-xs text-red-200 hover:bg-red-500/25"
                                    type="button"
                                    onClick={() => handleDeleteWaiter(waiter)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="pos-panel min-h-0 rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="m-0 text-base font-semibold text-white">
                        Table Assignment
                      </h3>
                      <p className="mt-1 text-xs text-pos-muted">
                        Select a waiter and assign/unassign tables.
                      </p>
                    </div>
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        className="pos-button pos-button-muted min-h-[40px] rounded-lg px-3 text-xs"
                        onClick={() => setAssignedTableIds([])}
                        disabled={!selectedWaiterForTables || isSaving}
                      >
                        Clear Selection
                      </button>
                      <button
                        type="button"
                        className="pos-button pos-button-primary min-h-[40px] rounded-lg px-3 text-xs"
                        onClick={saveWaiterTableAssignments}
                        disabled={!selectedWaiterForTables || isSaving}
                      >
                        Save Assignments
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {waiters.map((waiter) => (
                      <button
                        key={waiter.id}
                        type="button"
                        onClick={() => setSelectedWaiterForTables(waiter.id)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                          selectedWaiterForTables === waiter.id
                            ? "border-pos-accent bg-pos-accent text-slate-950"
                            : "border-white/15 bg-white/5 text-pos-text hover:bg-white/10"
                        }`}
                      >
                        {waiter.fullName}
                      </button>
                    ))}
                  </div>

                  <p className="mt-3 text-xs text-pos-muted">
                    Selected waiter tables: {assignedTableIds.length}
                  </p>

                  <div className="scroll-y mt-3 grid max-h-[32vh] grid-cols-2 gap-2 overflow-y-auto pr-1 xl:grid-cols-4">
                    {tables
                      .slice()
                      .sort((left, right) => left.number - right.number)
                      .map((table) => {
                        const isAssignedToSelected = assignedTableIds.includes(table.id);
                        const isAssignedToAnother =
                          table.assignedWaiterId &&
                          table.assignedWaiterId !== selectedWaiterForTables;

                        return (
                          <button
                            key={table.id}
                            type="button"
                            onClick={() => toggleAssignedTable(table.id)}
                            className={`rounded-xl border p-3 text-left ${
                              isAssignedToSelected
                                ? "border-pos-accent bg-pos-accent/20"
                                : isAssignedToAnother
                                  ? "border-orange-300/40 bg-orange-500/10"
                                  : "border-white/10 bg-white/5 hover:bg-white/10"
                            }`}
                          >
                            <p className="m-0 text-sm font-semibold text-white">
                              Table {table.number}
                            </p>
                            <p className="m-0 mt-1 text-xs text-pos-muted">{table.location}</p>
                            <p className="m-0 mt-1 text-xs text-pos-muted">
                              {table.assignedWaiter?.fullName
                                ? `Assigned: ${table.assignedWaiter.fullName}`
                                : "Unassigned"}
                            </p>
                          </button>
                        );
                      })}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {tables
                      .filter((table) => table.assignedWaiterId)
                      .slice(0, 6)
                      .map((table) => (
                        <button
                          key={`quick-${table.id}`}
                          type="button"
                          className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-pos-muted hover:bg-white/10"
                          onClick={() => quickAssignSingleTable(table.id, null)}
                        >
                          Unassign Table {table.number}
                        </button>
                      ))}
                  </div>
                </article>

                <article className="pos-panel rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="m-0 text-base font-semibold text-white">
                        Customer QR Ordering
                      </h3>
                      <p className="mt-1 text-xs text-pos-muted">
                        Generate a guest order link and QR code for any table.
                      </p>
                    </div>
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        className="pos-button pos-button-muted min-h-[40px] rounded-lg px-3 text-xs"
                        onClick={handleCopyGuestUrl}
                        disabled={!guestOrderUrl || isQrLoading}
                      >
                        Copy Link
                      </button>
                      <button
                        type="button"
                        className="pos-button pos-button-primary min-h-[40px] rounded-lg px-3 text-xs"
                        onClick={handleRotateGuestQr}
                        disabled={!selectedQrTableId || isSaving || isQrLoading}
                      >
                        Rotate QR
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-4 lg:grid-cols-[240px_1fr]">
                    <div className="space-y-2">
                      <label className="block text-xs uppercase tracking-wide text-pos-muted">
                        Table
                      </label>
                      <select
                        value={selectedQrTableId || ""}
                        onChange={(event) => setSelectedQrTableId(Number(event.target.value))}
                        className="w-full rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                      >
                        {tables
                          .slice()
                          .sort((left, right) => left.number - right.number)
                          .map((table) => (
                            <option key={`qr-${table.id}`} value={table.id}>
                              Table {table.number} - {table.location}
                            </option>
                          ))}
                      </select>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="m-0 text-xs uppercase tracking-wide text-pos-muted">
                          Selected Table
                        </p>
                        <p className="m-0 mt-2 text-lg font-semibold text-white">
                          {selectedQrTable ? `Table ${selectedQrTable.number}` : "No table"}
                        </p>
                        <p className="m-0 mt-1 text-xs text-pos-muted">
                          {selectedQrTable?.location || "Select a table to prepare guest ordering."}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                      <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-white/10 bg-black/20 p-3">
                        {guestOrderUrl ? (
                          <PosQrCode
                            value={guestOrderUrl}
                            alt={`QR code for ${selectedQrTable ? `Table ${selectedQrTable.number}` : "guest ordering"}`}
                            size={180}
                            imageClassName="h-[180px] w-[180px] rounded-lg bg-white p-2"
                          />
                        ) : (
                          <p className="text-sm text-pos-muted">
                            {isQrLoading ? "Preparing QR..." : "QR link not ready."}
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <p className="m-0 text-xs uppercase tracking-wide text-pos-muted">
                          Guest Ordering URL
                        </p>
                        <p className="m-0 mt-3 break-all text-sm text-white">
                          {guestOrderUrl || "Preparing guest ordering link..."}
                        </p>
                        <p className="m-0 mt-3 text-xs text-pos-muted">
                          Guests can scan the QR code, browse ready-to-order products, and append
                          items directly to the table ticket without staff refreshing the page.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-pos-text hover:bg-white/10"
                            onClick={() => {
                              if (guestOrderUrl) {
                                window.open(guestOrderUrl, "_blank", "noopener,noreferrer");
                              }
                            }}
                            disabled={!guestOrderUrl}
                          >
                            Open Guest Page
                          </button>
                          <a
                            href="/api/system/docs"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-pos-text hover:bg-white/10"
                          >
                            API Docs
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {activeSection === "orders" ? (
            <section className="pos-panel min-h-0 rounded-xl p-4">
              <h3 className="m-0 text-base font-semibold text-white">Orders ({ordersData.orders.length})</h3>
              <p className="mt-1 text-xs text-pos-muted">
                Paid Revenue: {formatMoney(ordersData.summary?.paidRevenue)} EUR | Average Paid Order:{" "}
                {formatMoney(ordersData.summary?.averagePaidOrder)} EUR
              </p>
              <div className="scroll-y mt-3 max-h-[62vh] overflow-y-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/20 text-xs uppercase tracking-wide text-pos-muted">
                    <tr>
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2">Table</th>
                      <th className="px-3 py-2">Waiter</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2 text-right">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersData.orders.map((order) => (
                      <tr key={order.id} className="border-t border-white/10">
                        <td className="px-3 py-2 text-white">#{order.id}</td>
                        <td className="px-3 py-2 text-pos-muted">
                          {order.table ? `Table ${order.table.number}` : "-"}
                        </td>
                        <td className="px-3 py-2 text-pos-muted">
                          {order.employee
                            ? `${order.employee.firstName} ${order.employee.lastName}`
                            : order.user?.fullName || "-"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-pos-muted">{formatMoney(order.total)} EUR</td>
                        <td className="px-3 py-2 text-pos-muted">{formatDateTime(order.createdAt)}</td>
                        <td className="px-3 py-2 text-right">
                          {order.status === "paid" || order.status === "pending_payment" ? (
                            <button
                              type="button"
                              className="rounded-lg border border-white/20 px-2 py-1 text-xs text-pos-text hover:bg-white/10"
                              onClick={() =>
                                runAction(
                                  () => downloadInvoicePdf(session.token, order.id),
                                  `Invoice PDF downloaded for order #${order.id}.`
                                )
                              }
                            >
                              Invoice PDF
                            </button>
                          ) : (
                            <span className="text-xs text-pos-muted">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeSection === "reports" ? (
            <section className="grid min-h-0 grid-cols-1 gap-4">
              <article className="pos-panel rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="m-0 text-base font-semibold text-white">
                      Advanced Reports
                    </h3>
                    <p className="mt-1 text-xs text-pos-muted">
                      Daily, monthly, product, and employee sales analytics with export support.
                    </p>
                  </div>
                  <div className="inline-flex gap-2">
                    <button
                      type="button"
                      className="pos-button pos-button-muted min-h-[40px] rounded-lg px-3 text-xs"
                      onClick={handleDownloadReportCsv}
                      disabled={isSaving}
                    >
                      Export Excel CSV
                    </button>
                    <button
                      type="button"
                      className="pos-button pos-button-primary min-h-[40px] rounded-lg px-3 text-xs"
                      onClick={handleDownloadReportPdf}
                      disabled={isSaving}
                    >
                      Export PDF
                    </button>
                  </div>
                </div>
              </article>

              <section className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
              <article className="pos-panel rounded-xl p-4">
                <h3 className="m-0 text-base font-semibold text-white">Daily Summary</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="m-0 text-xs text-pos-muted">Revenue</p>
                    <p className="m-0 mt-1 text-xl font-bold text-white">
                      {formatMoney(dailySummary?.totalRevenue)} EUR
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="m-0 text-xs text-pos-muted">Expenses</p>
                    <p className="m-0 mt-1 text-xl font-bold text-white">
                      {formatMoney(dailySummary?.totalExpenses)} EUR
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="m-0 text-xs text-pos-muted">Net Revenue</p>
                    <p className="m-0 mt-1 text-xl font-bold text-white">
                      {formatMoney(dailySummary?.netRevenue)} EUR
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="m-0 text-xs text-pos-muted">Paid Orders</p>
                    <p className="m-0 mt-1 text-xl font-bold text-white">
                      {dailySummary?.paidOrders || 0}
                    </p>
                  </div>
                </div>
              </article>

              <article className="pos-panel min-h-0 rounded-xl p-4">
                <h3 className="m-0 text-base font-semibold text-white">
                  Generated Invoices ({invoicesData.count})
                </h3>
                <div className="scroll-y mt-3 max-h-[44vh] space-y-2 overflow-y-auto pr-1">
                  {invoicesData.invoices.map((invoice) => (
                    <div key={invoice.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="m-0 text-sm font-semibold text-white">Order #{invoice.id}</p>
                          <p className="m-0 mt-1 text-xs text-pos-muted">
                            {invoice.table ? `Table ${invoice.table.number}` : "No table"} |{" "}
                            {formatDateTime(invoice.updatedAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="m-0 text-sm font-bold text-white">
                            {formatMoney(invoice.total)} EUR
                          </p>
                          <button
                            type="button"
                            className="mt-2 rounded-lg border border-white/20 px-2 py-1 text-xs text-pos-text hover:bg-white/10"
                            onClick={() =>
                              runAction(
                                () => downloadInvoicePdf(session.token, invoice.id),
                                `Invoice PDF downloaded for order #${invoice.id}.`
                              )
                            }
                          >
                            Invoice PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="pos-panel rounded-xl p-4">
                <h3 className="m-0 text-base font-semibold text-white">Monthly Sales</h3>
                <p className="mb-3 mt-1 text-xs text-pos-muted">
                  Rolling monthly performance for the selected date range.
                </p>
                <BarRows
                  rows={ensureArray(advancedReport?.monthlySales || [])}
                  labelKey="month"
                  valueKey="revenue"
                  colorClass="bg-amber-400"
                  formatLabel={formatMonthLabel}
                  getMetaText={(entry) =>
                    `${entry.orders || 0} paid order${Number(entry.orders || 0) === 1 ? "" : "s"}`
                  }
                />
              </article>

              <article className="pos-panel rounded-xl p-4">
                <h3 className="m-0 text-base font-semibold text-white">Sales By Product</h3>
                <p className="mb-3 mt-1 text-xs text-pos-muted">
                  Best-performing products in the current report window.
                </p>
                <BarRows
                  rows={ensureArray(advancedReport?.salesByProduct || []).slice(0, 8)}
                  labelKey="productName"
                  valueKey="revenue"
                  colorClass="bg-cyan-400"
                  getMetaText={(entry) =>
                    `${entry.categoryName || "Uncategorized"} | ${entry.quantitySold || 0} sold`
                  }
                />
              </article>

              <article className="pos-panel rounded-xl p-4">
                <h3 className="m-0 text-base font-semibold text-white">Sales By Employee</h3>
                <p className="mb-3 mt-1 text-xs text-pos-muted">
                  Paid order performance by staff member.
                </p>
                <BarRows
                  rows={ensureArray(advancedReport?.salesByEmployee || []).slice(0, 8)}
                  labelKey="employeeName"
                  valueKey="totalSales"
                  colorClass="bg-emerald-400"
                  getMetaText={(entry) =>
                    `${entry.ordersHandled || 0} order${Number(entry.ordersHandled || 0) === 1 ? "" : "s"} handled`
                  }
                />
              </article>
              </section>
            </section>
          ) : null}
        </section>
      </section>
    </main>
  );
}
