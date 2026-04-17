import { useEffect, useMemo, useState } from "react";

import PosQrCode from "../../components/PosQrCode";
import PosScreenLoader from "../../components/PosScreenLoader";
import {
  assignTableToWaiter,
  buildRealtimeStreamUrl,
  createCategory,
  createProduct,
  createWaiter,
  deleteCategory,
  deleteProduct,
  deleteWaiter,
  downloadAdvancedReportCsv,
  downloadAdvancedReportPdf,
  downloadInvoicePdf,
  getAdvancedReport,
  getAuditLogs,
  getCategories,
  getDailySummary,
  getDashboardInvoices,
  getDashboardOrders,
  getGuestQrAccess,
  getLowStockProducts,
  getManagerStats,
  getProducts,
  getSystemAlerts,
  getTables,
  getTopProducts,
  getRevenueTrend,
  getWaiters,
  getWaiterPerformance,
  rotateGuestQrAccess,
  setWaiterTableAssignments,
  updateCategory,
  updateProduct,
  updateProductStock,
  updateWaiter,
  updateWaiterStatus,
} from "./managerApi";

const SECTIONS = [
  { key: "overview", label: "Dashboard" },
  { key: "products", label: "Products" },
  { key: "categories", label: "Categories" },
  { key: "stock", label: "Stock" },
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
  stock: "",
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

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const buildGuestOrderUrl = (token) => {
  if (!token || typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}/guest/table/${token}`;
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

function BarRows({ rows, labelKey, valueKey, colorClass }) {
  const maxValue = Math.max(...rows.map((entry) => Number(entry[valueKey] || 0)), 1);

  if (rows.length === 0) {
    return <p className="text-sm text-pos-muted">No data found.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((entry) => {
        const value = Number(entry[valueKey] || 0);
        const width = Math.max(8, Math.round((value / maxValue) * 100));

        return (
          <div key={entry[labelKey]} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-pos-muted">
              <span>{entry[labelKey]}</span>
              <span>{formatMoney(value)} EUR</span>
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

  const refreshAll = () => setRefreshTick((value) => value + 1);

  const runAction = async (action, successMessage) => {
    setIsSaving(true);
    setError("");
    setFeedback("");
    try {
      await action();
      setFeedback(successMessage);
      refreshAll();
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
        const [
          nextStats,
          nextTopProducts,
          nextTrend,
          nextWaiter,
          nextOrders,
          nextInvoices,
          nextSummary,
          nextLowStock,
          nextAdvancedReport,
          nextAlerts,
          nextAuditTrail,
          nextProducts,
          nextCategories,
          nextWaiters,
          nextTables,
        ] = await Promise.all([
          getManagerStats(session.token, filters, controller.signal),
          getTopProducts(session.token, controller.signal),
          getRevenueTrend(session.token, { days: 7 }, controller.signal),
          getWaiterPerformance(session.token, filters, controller.signal),
          getDashboardOrders(session.token, { ...filters, limit: 120 }, controller.signal),
          getDashboardInvoices(session.token, { ...filters, limit: 120 }, controller.signal),
          getDailySummary(session.token, { date: filters.from }, controller.signal),
          getLowStockProducts(session.token, { threshold: 5 }, controller.signal),
          getAdvancedReport(session.token, filters, controller.signal),
          getSystemAlerts(session.token, { status: "open", limit: 20 }, controller.signal),
          getAuditLogs(session.token, { limit: 16 }, controller.signal),
          getProducts(session.token, controller.signal),
          getCategories(session.token, controller.signal),
          getWaiters(session.token, controller.signal),
          getTables(session.token, controller.signal),
        ]);

        if (!mounted) {
          return;
        }

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
        setWaiters(ensureArray(nextWaiters));
        setTables(ensureArray(nextTables));
      } catch (requestError) {
        if (!mounted || requestError.name === "AbortError") {
          return;
        }
        if (requestError.status === 401 || requestError.status === 403) {
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
    () => buildGuestOrderUrl(guestAccess?.token),
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
      buildRealtimeStreamUrl(session.token, ["dashboard", "orders", "alerts", "tables", "inventory"])
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
      categoryId: String(product.categoryId || ""),
      price: String(product.price ?? ""),
      stock: String(product.stock ?? ""),
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

  const onProductSubmit = async (event) => {
    event.preventDefault();
    const normalizedStock =
      productForm.stock === "" ? undefined : Number(productForm.stock);
    const payload = {
      name: productForm.name.trim(),
      categoryId: Number(productForm.categoryId),
      price: Number(productForm.price),
      imageUrl: productForm.imageUrl || null,
      description: productForm.description || null,
      isAvailable: Boolean(productForm.isAvailable),
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

  const onCategorySubmit = async (event) => {
    event.preventDefault();
    const payload = { name: categoryForm.name.trim() };

    await runAction(async () => {
      if (editingCategoryId) {
        await updateCategory(session.token, editingCategoryId, payload);
      } else {
        await createCategory(session.token, payload);
      }
      resetCategoryForm();
    }, editingCategoryId ? "Category updated." : "Category created.");
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
                    required
                    value={productForm.categoryId}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, categoryId: event.target.value }))
                    }
                    className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
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
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Stock (optional)"
                      value={productForm.stock}
                      onChange={(event) =>
                        setProductForm((current) => ({ ...current, stock: event.target.value }))
                      }
                      className="rounded-lg border border-white/15 bg-pos-panelSoft px-3 py-2 text-sm text-white"
                    />
                  </div>
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
                          <td className="px-3 py-2 text-pos-muted">{product.stock}</td>
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
                                onClick={() => {
                                  if (!window.confirm(`Delete ${product.name}?`)) {
                                    return;
                                  }
                                  runAction(
                                    () => deleteProduct(session.token, product.id),
                                    "Product deleted."
                                  );
                                }}
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
                                    className="rounded-lg border border-red-300/40 bg-red-500/15 px-2 py-1 text-xs text-red-200 hover:bg-red-500/25"
                                    type="button"
                                    onClick={() => {
                                      if (!window.confirm(`Delete category ${category.name}?`)) {
                                        return;
                                      }
                                      runAction(
                                        () => deleteCategory(session.token, category.id),
                                        "Category deleted."
                                      );
                                    }}
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
                        <th className="px-3 py-2 text-right">Adjust</th>
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
                              {product.stock}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                className="rounded-md border border-white/20 px-2 py-1 text-xs text-pos-text hover:bg-white/10"
                                onClick={() =>
                                  runAction(
                                    () =>
                                      updateProductStock(session.token, product.id, { delta: -1 }),
                                    `${product.name} stock decreased by 1.`
                                  )
                                }
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-white/20 px-2 py-1 text-xs text-pos-text hover:bg-white/10"
                                onClick={() =>
                                  runAction(
                                    () =>
                                      updateProductStock(session.token, product.id, { delta: 1 }),
                                    `${product.name} stock increased by 1.`
                                  )
                                }
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-white/20 px-2 py-1 text-xs text-pos-text hover:bg-white/10"
                                onClick={() =>
                                  runAction(
                                    () =>
                                      updateProductStock(session.token, product.id, { delta: 10 }),
                                    `${product.name} stock increased by 10.`
                                  )
                                }
                              >
                                +10
                              </button>
                            </div>
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
                          Stock: {product.stock} | Category: {product.category?.name || "N/A"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>
          ) : null}

          {activeSection === "employees" ? (
            <section className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
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
                      editingWaiterId
                        ? "New PIN (optional)"
                        : "PIN (4-8 digits)"
                    }
                    value={waiterForm.pin}
                    onChange={(event) =>
                      setWaiterForm((current) => ({
                        ...current,
                        pin: event.target.value.replace(/\D/g, "").slice(0, 8),
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
                    <button className="pos-button pos-button-primary" type="submit" disabled={isSaving}>
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
                                    onClick={() => {
                                      if (!window.confirm(`Delete waiter ${waiter.fullName}?`)) {
                                        return;
                                      }

                                      runAction(
                                        () => deleteWaiter(session.token, waiter.id),
                                        "Waiter deleted."
                                      );
                                    }}
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
