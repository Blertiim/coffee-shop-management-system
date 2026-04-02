import { useEffect, useState } from "react";
import {
  getDashboardStats,
  getRecentOrders,
  getTopProducts,
} from "./dashboardApi";

const formatMoney = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const buildStatsCards = (stats) => [
  { label: "Products", value: stats.totalProducts, accent: "sage" },
  { label: "Categories", value: stats.totalCategories, accent: "amber" },
  { label: "Orders", value: stats.totalOrders, accent: "clay" },
  { label: "Revenue", value: formatMoney(stats.totalRevenue), accent: "forest" },
  { label: "Pending Orders", value: stats.totalPendingOrders, accent: "amber" },
  {
    label: "Completed Orders",
    value: stats.totalCompletedOrders,
    accent: "ocean",
  },
];

const getStatusClassName = (status) => `status-pill status-pill--${status}`;

export default function DashboardPage({ session, onLogout }) {
  const [stats, setStats] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      setError("");

      try {
        const [statsResponse, topProductsResponse, recentOrdersResponse] =
          await Promise.all([
            getDashboardStats(session.token, controller.signal),
            getTopProducts(session.token, controller.signal),
            getRecentOrders(session.token, controller.signal),
          ]);

        if (!isMounted) {
          return;
        }

        setStats(statsResponse.stats);
        setTopProducts(topProductsResponse.topProducts || []);
        setRecentOrders(recentOrdersResponse.recentOrders || []);
      } catch (requestError) {
        if (!isMounted || requestError.name === "AbortError") {
          return;
        }

        if (requestError.status === 401) {
          onLogout();
          return;
        }

        setError(
          requestError.message || "Failed to load dashboard. Please try again."
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [onLogout, refreshTick, session.token]);

  const statsCards = stats ? buildStatsCards(stats) : [];

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">Admin Dashboard</span>
          <h1>Track inventory, orders, and revenue from one place.</h1>
          <p>
            Connected as <strong>{session.user.fullName}</strong> ({session.user.email}
            ).
          </p>
        </div>

        <div className="hero-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setRefreshTick((value) => value + 1)}
          >
            Refresh data
          </button>
          <button className="ghost-button" type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </section>

      {error ? (
        <section className="alert-banner">
          <p>{error}</p>
        </section>
      ) : null}

      <section className="stats-grid">
        {statsCards.map((card) => (
          <article
            key={card.label}
            className={`stat-card stat-card--${card.accent}`}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      {isLoading ? (
        <section className="loading-panel">
          <p>Loading dashboard data...</p>
        </section>
      ) : null}

      {!isLoading ? (
        <section className="dashboard-grid">
          <article className="panel-card">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Top Products</span>
                <h2>Most ordered items</h2>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.length > 0 ? (
                    topProducts.map((entry, index) => (
                      <tr key={entry.product.id}>
                        <td>{index + 1}</td>
                        <td>{entry.product.name}</td>
                        <td>{entry.product.category?.name || "Uncategorized"}</td>
                        <td>{formatMoney(entry.product.price)}</td>
                        <td>{entry.totalQuantitySold}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="empty-cell">
                        No product sales yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel-card panel-card--wide">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Recent Orders</span>
                <h2>Latest activity</h2>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>User</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length > 0 ? (
                    recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td>#{order.id}</td>
                        <td>
                          <div className="user-cell">
                            <strong>{order.user?.fullName || "Unknown user"}</strong>
                            <span>{order.user?.email || "No email"}</span>
                          </div>
                        </td>
                        <td>
                          <span className={getStatusClassName(order.status)}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          <div className="order-items-preview">
                            {order.items.map((item) => (
                              <span key={item.id}>
                                {item.product?.name || "Unknown product"} x{item.quantity}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>{formatMoney(order.total)}</td>
                        <td>{formatDate(order.createdAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="empty-cell">
                        No recent orders found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}
