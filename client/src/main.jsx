import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Edit3,
  Layers,
  LogOut,
  PackagePlus,
  Plus,
  PlusCircle,
  Printer,
  ReceiptText,
  Save,
  Search,
  Trash2,
  UserRound,
  Wallet,
  X
} from 'lucide-react';
import logo from './assets/koolits-logo.png';
import './styles.css';

const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : `${window.location.protocol}//${window.location.hostname}:4010/api`);
const money = (value) => `₱${Number(value || 0).toFixed(2)}`;
const signedMoney = (value) => `${Number(value || 0) < 0 ? '-' : ''}₱${Math.abs(Number(value || 0)).toFixed(2)}`;
const receiptMoney = (value) => `P${Number(value || 0).toFixed(2)}`;
const paymentLabels = { cash: 'Cash', gcash: 'GCash', maya: 'Maya' };

const sortWithOthersLast = (items) =>
  [...items].sort((a, b) => {
    const first = typeof a === 'string' ? a : a.name;
    const second = typeof b === 'string' ? b : b.name;
    if (first.toLowerCase() === 'others') return 1;
    if (second.toLowerCase() === 'others') return -1;
    return first.localeCompare(second);
  });

const productIcon = (product) => {
  const text = `${product.name} ${product.category_name}`.toLowerCase();
  if (text.includes('lemon')) return '🍋';
  if (text.includes('soft') || text.includes('ice cream')) return '🍦';
  if (text.includes('waffle')) return '🧇';
  if (text.includes('fries') || text.includes('fry')) return '🍟';
  if (text.includes('drink') || text.includes('tea') || text.includes('soda') || text.includes('juice')) return '🥤';
  if (text.includes('others')) return '✨';
  return '🧋';
};

const categoryIcon = (name) => {
  const text = name.toLowerCase();
  if (text === 'all') return '★';
  if (text.includes('lemon')) return '🍋';
  if (text.includes('ice')) return '🍦';
  if (text.includes('waffle')) return '🧇';
  if (text.includes('fries')) return '🍟';
  if (text.includes('drink')) return '🥤';
  if (text.includes('others')) return '✨';
  return '•';
};

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || 'Request failed.');
  return data;
}

function Login({ onLogin, setMessage, message }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLogin = async (event) => {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setMessage('');
      const user = await api('/auth/login', { method: 'POST', body: JSON.stringify(form) });
      onLogin(user);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-card">
        <img src={logo} alt="KoolITs" />
        <h1>KoolITs POS</h1>
        <p>Sign in with your admin or seller account.</p>
        {message && <div className="toast login-toast">{message}</div>}
        <form onSubmit={submitLogin}>
          <label className="form-field">
            <span>Username</span>
            <input required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="admin or seller" />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Password" />
          </label>
          <button disabled={isSubmitting}><UserRound size={18} /> {isSubmitting ? 'Signing in...' : 'Sign In'}</button>
        </form>
      </section>
    </main>
  );
}

function App() {
  const [tab, setTab] = useState('pos');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('koolits-user') || 'null');
    } catch {
      return null;
    }
  });
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [cart, setCart] = useState([]);
  const [category, setCategory] = useState('All');
  const [productSearch, setProductSearch] = useState('');
  const [payments, setPayments] = useState({ cash: '', gcash: '', maya: '' });
  const [shouldPrint, setShouldPrint] = useState(true);
  const [showRecentOrders, setShowRecentOrders] = useState(false);
  const [recentOrders, setRecentOrders] = useState([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [lastReceipt, setLastReceipt] = useState(null);
  const [sellerSalesTotal, setSellerSalesTotal] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  const loadData = async () => {
    const [categoryData, productData, stockData] = await Promise.all([
      api('/categories'),
      api('/products'),
      api('/stocks')
    ]);
    setCategories(categoryData);
    setProducts(productData);
    setStocks(stockData);
  };

  useEffect(() => {
    if (currentUser) loadData().catch((error) => setMessage(error.message));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const allowedTabs = currentUser.role === 'admin' ? ['pos', 'dashboard', 'manage'] : ['pos', 'expenses'];
    if (!allowedTabs.includes(tab)) setTab('pos');
  }, [currentUser, tab]);

  const orderedCategories = useMemo(() => sortWithOthersLast(categories), [categories]);

  const visibleProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesCategory = search || category === 'All' || product.category_name === category;
      const text = `${product.name} ${product.category_name}`.toLowerCase();
      return matchesCategory && text.includes(search);
    });
    return sortWithOthersLast(filtered);
  }, [products, category, productSearch]);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const paidTotal = Object.values(payments).reduce((sum, value) => sum + Number(value || 0), 0);
  const remaining = Math.max(0, total - paidTotal);
  const changeDue = paidTotal - total;

  const loadSellerSalesTotal = async () => {
    const data = await api(`/dashboard?period=day&date=${today}`);
    setSellerSalesTotal(Number(data?.summary?.sales_total || 0));
  };

  const loadRecentOrders = async () => {
    const orders = await api('/sales/recent');
    setRecentOrders(orders);
  };

  useEffect(() => {
    if (currentUser?.role === 'seller' && tab === 'pos') {
      loadSellerSalesTotal().catch((error) => setMessage(error.message));
    }
  }, [currentUser, tab]);

  const addToCart = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) return current.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      return [...current, { ...product, quantity: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart((current) =>
      current
        .map((item) => (item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const checkout = async () => {
    try {
      setMessage('');
      if (paidTotal < total) {
        setMessage(`Payment is less than payable. Remaining ${money(total - paidTotal)}.`);
        return;
      }
      const receipt = await api('/sales', {
        method: 'POST',
        body: JSON.stringify({
          payments: {
            cash: Number(payments.cash || 0),
            gcash: Number(payments.gcash || 0),
            maya: Number(payments.maya || 0)
          },
          items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity }))
        })
      });
      setLastReceipt(receipt);
      setCart([]);
      setPayments({ cash: '', gcash: '', maya: '' });
      await loadData();
      if (currentUser?.role === 'seller') await loadSellerSalesTotal();
      if (showRecentOrders) await loadRecentOrders();
      setMessage(`Sale recorded. Receipt ${receipt.receipt_no} saved.`);
      if (shouldPrint) setTimeout(() => window.print(), 250);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleLogin = (user) => {
    localStorage.setItem('koolits-user', JSON.stringify(user));
    setCurrentUser(user);
    setTab('pos');
    setMessage('');
  };

  const logout = () => {
    localStorage.removeItem('koolits-user');
    setCurrentUser(null);
    setCart([]);
    setPayments({ cash: '', gcash: '', maya: '' });
    setShowPasswordModal(false);
    setNewPassword('');
    setTab('pos');
  };

  const changeOwnPassword = async (event) => {
    event.preventDefault();
    try {
      await api(`/users/${currentUser.id}/password`, { method: 'PATCH', body: JSON.stringify({ password: newPassword }) });
      setNewPassword('');
      setShowPasswordModal(false);
      setMessage('Password changed.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (!currentUser) return <Login onLogin={handleLogin} setMessage={setMessage} message={message} />;

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src={logo} alt="KoolITs" />
          <div>
            <strong>KoolITs POS</strong>
            <span>Tablet sales and stock control</span>
          </div>
        </div>
        <nav>
          <button className={tab === 'pos' ? 'active' : ''} onClick={() => setTab('pos')}>
            <ReceiptText size={20} /> POS
          </button>
          {isAdmin ? (
            <>
              <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
                <BarChart3 size={20} /> Dashboard
              </button>
              <button className={tab === 'manage' ? 'active' : ''} onClick={() => setTab('manage')}>
                <Boxes size={20} /> Manage
              </button>
            </>
          ) : (
            <button className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}>
              <Wallet size={20} /> Expenses
            </button>
          )}
        </nav>
        <div className="user-menu">
          <span><UserRound size={16} /> {currentUser.display_name} · {currentUser.role}</span>
          <button className="password-button" onClick={() => setShowPasswordModal(true)} title="Change password"><Save size={18} /> Password</button>
          <button onClick={logout} title="Log out"><LogOut size={18} /></button>
        </div>
      </header>

      {message && <div className="toast">{message}</div>}

      {tab === 'pos' ? (
        <main className="pos-layout">
          <section className="catalog">
            <div className="pos-hero">
              <div>
                <span className="seller-chip">Seller POS</span>
                <h1>KoolITs</h1>
              </div>
              {currentUser.role === 'seller' && (
                <div className="seller-sales-total">
                  <span>Today's Sales</span>
                  <strong>{money(sellerSalesTotal)}</strong>
                </div>
              )}
            </div>
            <div className="category-row">
              {['All', ...orderedCategories.map((item) => item.name)].map((name) => (
                <button key={name} className={category === name ? 'selected' : ''} onClick={() => setCategory(name)}>
                  <span>{categoryIcon(name)}</span> {name}
                </button>
              ))}
            </div>
            <label className="pos-search">
              <Search size={20} />
              <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search lemonade, waffles, fries..." />
            </label>
            <div className="product-grid">
              {visibleProducts.map((product) => (
                <button className="product-tile" key={product.id} onClick={() => addToCart(product)}>
                  <span className="product-icon">{productIcon(product)}</span>
                  <strong>{product.name}</strong>
                  <span className="product-price">{money(product.price)}</span>
                  <small>
                    {product.recipe.length ? `${product.recipe.length} stock item${product.recipe.length > 1 ? 's' : ''}` : 'No stock recipe'}
                  </small>
                </button>
              ))}
            </div>
          </section>

          <aside className="cart-panel">
            <div className="panel-title">
              <h2>Current Order</h2>
              <div className="cart-actions">
                <button
                  className="recent-button"
                  onClick={async () => {
                    setShowRecentOrders(true);
                    try {
                      await loadRecentOrders();
                    } catch (error) {
                      setMessage(error.message);
                    }
                  }}
                >
                  <ReceiptText size={18} /> Last 5
                </button>
                <button className="icon-button" onClick={() => setCart([])} title="Clear cart">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
            <div className="cart-list">
              {cart.length === 0 && <p className="empty">Tap products to start an order.</p>}
              {cart.map((item) => (
                <div className="cart-item" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{money(item.price)} each</span>
                  </div>
                  <div className="cart-item-controls">
                    <div className="qty">
                      <button onClick={() => updateQty(item.id, -1)}>-</button>
                      <b>{item.quantity}</b>
                      <button onClick={() => updateQty(item.id, 1)}>+</button>
                    </div>
                    <b>{money(item.price * item.quantity)}</b>
                  </div>
                </div>
              ))}
            </div>
            <div className="payment-box">
              <div className="total-line">
                <span>Total</span>
                <strong>{money(total)}</strong>
              </div>
              <div className={`change-line ${changeDue < 0 ? 'negative' : ''}`}>
                <span>Change</span>
                <strong>{signedMoney(changeDue)}</strong>
              </div>
              <div className="split-payments">
                {Object.entries(paymentLabels).map(([method, label]) => (
                  <label className="field" key={method}>
                    {label}
                    <span className="payment-input">
                      <CreditCard size={18} />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payments[method]}
                        onChange={(event) => setPayments({ ...payments, [method]: event.target.value })}
                        placeholder="0.00"
                      />
                    </span>
                  </label>
                ))}
              </div>
              <div className="payment-summary">
                <div><span>Paid</span><strong>{money(paidTotal)}</strong></div>
                <div><span>Remaining</span><strong>{money(remaining)}</strong></div>
              </div>
              <label className="print-toggle">
                <input type="checkbox" checked={shouldPrint} onChange={(event) => setShouldPrint(event.target.checked)} />
                Print thermal receipt
              </label>
              <button className="checkout" disabled={!cart.length || total <= 0 || paidTotal < total} onClick={checkout}>
                <Printer size={22} /> {shouldPrint ? 'Pay and Print' : 'Pay Only'}
              </button>
            </div>
          </aside>
          {showRecentOrders && (
            <div className="modal-backdrop" role="presentation">
              <section className="recent-modal" role="dialog" aria-modal="true" aria-labelledby="recent-orders-title">
                <div className="modal-header">
                  <div>
                    <h2 id="recent-orders-title">Last 5 Orders</h2>
                    <span>Latest completed sales for quick seller tracking.</span>
                  </div>
                  <button className="icon-button modal-close" onClick={() => setShowRecentOrders(false)} title="Close recent orders">
                    <X size={20} />
                  </button>
                </div>
                <div className="recent-order-list">
                  {recentOrders.length === 0 && <p className="empty">No orders yet.</p>}
                  {recentOrders.map((order) => (
                    <article className="recent-order-card" key={order.id}>
                      <div className="recent-order-items">
                        {order.items.map((item) => (
                          <strong key={item.id}>{item.quantity}x {item.product_name}</strong>
                        ))}
                      </div>
                      <div className="recent-order-meta">
                        <span>{order.receipt_no}</span>
                        <span>{new Date(order.created_at).toLocaleString()}</span>
                        <b>{money(order.total)}</b>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      ) : tab === 'dashboard' && isAdmin ? (
        <Dashboard setMessage={setMessage} currentUser={currentUser} />
      ) : tab === 'expenses' ? (
        <Expenses setMessage={setMessage} currentUser={currentUser} />
      ) : (
        <Manage categories={categories} products={products} stocks={stocks} reload={loadData} setMessage={setMessage} currentUser={currentUser} />
      )}

      {showPasswordModal && (
        <div className="modal-backdrop" role="presentation">
          <section className="password-modal" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
            <div className="modal-header">
              <div>
                <h2 id="password-modal-title">Change Password</h2>
                <span>Update the password for {currentUser.display_name}.</span>
              </div>
              <button className="icon-button modal-close" onClick={() => setShowPasswordModal(false)} title="Close password modal">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={changeOwnPassword}>
              <label className="form-field">
                <span>New Password</span>
                <input
                  autoFocus
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 4 characters"
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={() => setShowPasswordModal(false)}><X size={18} /> Cancel</button>
                <button type="submit" disabled={newPassword.length < 4}><Save size={18} /> Change Password</button>
              </div>
            </form>
          </section>
        </div>
      )}

      <Receipt receipt={lastReceipt} />
    </div>
  );
}

function Dashboard({ setMessage, currentUser }) {
  const today = new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState('day');
  const [dashboardDate, setDashboardDate] = useState(today);
  const [rangeStart, setRangeStart] = useState(today);
  const [rangeEnd, setRangeEnd] = useState(today);
  const [financeSearch, setFinanceSearch] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [showRemittanceModal, setShowRemittanceModal] = useState(false);
  const [selectedRemittanceDays, setSelectedRemittanceDays] = useState([]);
  const [expenseForm, setExpenseForm] = useState({
    expense_date: today,
    category: '',
    description: '',
    amount: '',
    payment_method: 'cash'
  });
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [remittanceNote, setRemittanceNote] = useState('');

  const currentPeriodLabel = period === 'month' ? 'month' : period === 'range' ? 'range' : 'day';
  const selectedMonth = dashboardDate.slice(0, 7);

  const loadDashboard = async () => {
    const params = new URLSearchParams({
      period,
      date: dashboardDate,
      search: financeSearch,
      start_date: rangeStart,
      end_date: rangeEnd
    });
    const data = await api(`/dashboard?${params.toString()}`);
    setDashboard(data);
  };

  useEffect(() => {
    loadDashboard().catch((error) => setMessage(error.message));
  }, [period, dashboardDate, rangeStart, rangeEnd, financeSearch]);

  useEffect(() => {
    if (!editingExpenseId) {
      setExpenseForm((current) => ({ ...current, expense_date: period === 'range' ? rangeStart : dashboardDate }));
    }
  }, [dashboardDate, rangeStart, period, editingExpenseId]);

  const resetExpenseForm = () => {
    setExpenseForm({ expense_date: period === 'range' ? rangeStart : dashboardDate, category: '', description: '', amount: '', payment_method: 'cash' });
    setEditingExpenseId(null);
  };

  const submitExpense = async (event) => {
    event.preventDefault();
    try {
      const method = editingExpenseId ? 'PATCH' : 'POST';
      const path = editingExpenseId ? `/expenses/${editingExpenseId}` : '/expenses';
      await api(path, { method, body: JSON.stringify({ ...expenseForm, created_by_user_id: currentUser?.id }) });
      resetExpenseForm();
      await loadDashboard();
      setMessage(editingExpenseId ? 'Expense updated.' : 'Expense added.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const deleteExpense = async (expense) => {
    if (!window.confirm(`Delete expense "${expense.description}"?`)) return;
    try {
      await api(`/expenses/${expense.id}`, { method: 'DELETE' });
      await loadDashboard();
      setMessage('Expense deleted.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const openRemittanceModal = () => {
    const daysInView = dashboard?.daily_sales || [];
    const activeDays = daysInView.filter((day) => day.sales_total || day.expense_total).map((day) => day.business_date);
    const defaultDays = period === 'day' ? [dashboardDate] : activeDays;
    setSelectedRemittanceDays(defaultDays.length ? defaultDays : daysInView.slice(0, 1).map((day) => day.business_date));
    setShowRemittanceModal(true);
  };

  const toggleRemittanceDay = (businessDate) => {
    setSelectedRemittanceDays((current) =>
      current.includes(businessDate) ? current.filter((date) => date !== businessDate) : [...current, businessDate]
    );
  };

  const submitRemittance = async () => {
    try {
      const dailyTotals = (dashboard?.daily_sales || []).map((day) => ({ business_date: day.business_date, amount: day.net_total }));
      await api('/remittances/bulk', {
        method: 'POST',
        body: JSON.stringify({ dates: selectedRemittanceDays, daily_totals: dailyTotals, note: remittanceNote })
      });
      setRemittanceNote('');
      setShowRemittanceModal(false);
      await loadDashboard();
      setMessage(`${selectedRemittanceDays.length} day${selectedRemittanceDays.length === 1 ? '' : 's'} marked as remitted.`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const summary = dashboard?.summary || { sales_total: 0, sales_count: 0, expense_total: 0, expense_count: 0, net_total: 0 };
  const dailyChart = dashboard?.daily_sales || [];
  const monthlyChart = dashboard?.monthly_sales || [];
  const showingDailyTotals = period !== 'day';
  const remittedDays = new Set((dashboard?.remittances || []).map((item) => item.business_date));
  const activeSalesDays = dailyChart.filter((day) => day.sales_total || day.expense_total);
  const remittanceDaysInView = period === 'day'
    ? dailyChart.filter((day) => day.business_date === dashboardDate)
    : dailyChart;

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <h1>Dashboard</h1>
          <p>Sales, expenses, and remittance overview for the selected {currentPeriodLabel}.</p>
        </div>
        <div className="dashboard-controls">
          <button className="top-remittance-button" onClick={openRemittanceModal}><CheckCircle2 size={18} /> Remittance</button>
          <div className="segmented">
            <button className={period === 'day' ? 'active' : ''} onClick={() => setPeriod('day')}>Day</button>
            <button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>Month</button>
            <button className={period === 'range' ? 'active' : ''} onClick={() => setPeriod('range')}>Range</button>
          </div>
          {period === 'range' ? (
            <div className="range-controls">
              <label className="form-field">
                <span>Start Date</span>
                <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
              </label>
              <label className="form-field">
                <span>End Date</span>
                <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
              </label>
            </div>
          ) : (
            <label className="form-field">
              <span>{period === 'day' ? 'Business Date' : 'Month View'}</span>
              <input
                type={period === 'month' ? 'month' : 'date'}
                value={period === 'month' ? dashboardDate.slice(0, 7) : dashboardDate}
                onChange={(event) => setDashboardDate(period === 'month' ? `${event.target.value}-01` : event.target.value)}
              />
            </label>
          )}
        </div>
      </section>

      <section className="overview-grid">
        <article className="overview-card sales-card">
          <span>{period === 'month' ? 'Monthly Sales' : period === 'range' ? 'Range Sales' : 'Daily Sales'}</span>
          <strong>{money(summary.sales_total)}</strong>
          <small>{summary.sales_count} order{summary.sales_count === 1 ? '' : 's'}</small>
        </article>
        <article className="overview-card expense-card">
          <span>{period === 'month' ? 'Monthly Expenses' : period === 'range' ? 'Range Expenses' : 'Daily Expenses'}</span>
          <strong>{money(summary.expense_total)}</strong>
          <small>{summary.expense_count} record{summary.expense_count === 1 ? '' : 's'}</small>
        </article>
        <article className={`overview-card ${summary.net_total >= 0 ? 'net-card' : 'expense-card'}`}>
          <span>{period === 'month' ? 'Monthly Net' : period === 'range' ? 'Net In Range' : 'Daily Net'}</span>
          <strong>{money(summary.net_total)}</strong>
          <small>Sales minus expenses</small>
        </article>
      </section>

      <section className="chart-grid">
        <SalesLineChart
          title={period === 'month' ? `Sales Per Day (${selectedMonth})` : 'Daily Sales Graph'}
          items={dailyChart}
          labelKey="business_date"
          valueKey="sales_total"
          emptyText="No daily sales for this view."
        />
        <SalesLineChart title="Monthly Sales Graph" items={monthlyChart} labelKey="business_month" valueKey="sales_total" emptyText="No monthly sales yet." />
      </section>

      <section className="dashboard-panel">
        <div className="toolbar single">
          <label className="search-field"><span>Search Sales and Expenses</span><div><Search size={18} /><input value={financeSearch} onChange={(event) => setFinanceSearch(event.target.value)} placeholder="Search receipt, payment, category, description" /></div></label>
        </div>
      </section>

      <section className="finance-columns">
        <section className="dashboard-panel sales-list-panel">
          <div className="panel-heading">
            <div>
              <h2>Sales List</h2>
              <span>
                {showingDailyTotals
                  ? `${activeSalesDays.length} day${activeSalesDays.length === 1 ? '' : 's'}`
                  : `${dashboard?.sales?.length || 0} sale${dashboard?.sales?.length === 1 ? '' : 's'}`}
              </span>
            </div>
          </div>
          <div className="finance-list">
            {showingDailyTotals ? (
              <>
                {activeSalesDays.length === 0 && <p className="empty">No sales for this view.</p>}
                {activeSalesDays.map((day) => (
                  <article className="finance-row sale-row daily-sale-row" key={day.business_date}>
                    <div>
                      <strong>{day.business_date}</strong>
                      <span>{day.sales_count} order{day.sales_count === 1 ? '' : 's'} · Expenses {money(day.expense_total)} · {day.remittance ? 'Remitted' : 'Not remitted'}</span>
                    </div>
                    <b>{money(day.sales_total)}</b>
                  </article>
                ))}
              </>
            ) : (
              <>
                {dashboard?.sales?.length === 0 && <p className="empty">No sales for this filter.</p>}
                {dashboard?.sales?.map((sale) => {
                  const saleDate = new Date(sale.created_at).toISOString().slice(0, 10);
                  const isSaleRemitted = remittedDays.has(saleDate);
                  return (
                    <article className="finance-row sale-row sale-detail-row" key={sale.id}>
                      <div>
                        <strong>{sale.items.map((item) => `${item.quantity}x ${item.product_name}`).join(', ')}</strong>
                        <span>{sale.receipt_no} · {new Date(sale.created_at).toLocaleString()} · {sale.payment_method.toUpperCase()}</span>
                      </div>
                      <span className={`status-pill ${isSaleRemitted ? 'remitted' : 'pending'}`}>
                        {isSaleRemitted ? 'Remitted' : 'Not remitted'}
                      </span>
                      <b>{money(sale.total)}</b>
                    </article>
                  );
                })}
              </>
            )}
          </div>
        </section>

        <section className="dashboard-panel expenses-list-panel">
          <div className="panel-heading">
            <div>
              <h2>Expenses List</h2>
              <span>{dashboard?.expenses?.length || 0} expense{dashboard?.expenses?.length === 1 ? '' : 's'} with staff tracking</span>
            </div>
          </div>

          <form className="expense-form" onSubmit={submitExpense}>
            <label className="form-field">
              <span>Category</span>
              <input required value={expenseForm.category} onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value })} placeholder="Rent, supplies, delivery" />
            </label>
            <label className="form-field">
              <span>Description</span>
              <input value={expenseForm.description} onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })} placeholder="Optional note" />
            </label>
            <label className="form-field">
              <span>Amount</span>
              <input required type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })} placeholder="0.00" />
            </label>
            <label className="form-field">
              <span>Payment</span>
              <select value={expenseForm.payment_method} onChange={(event) => setExpenseForm({ ...expenseForm, payment_method: event.target.value })}>
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="maya">Maya</option>
                <option value="bank">Bank</option>
                <option value="other">Other</option>
              </select>
            </label>
            <button><Wallet size={18} /> {editingExpenseId ? 'Update Expense' : 'Add Expense'}</button>
            {editingExpenseId && <button type="button" className="ghost-btn" onClick={resetExpenseForm}><X size={18} /> Cancel</button>}
          </form>

          <div className="finance-list">
            {dashboard?.expenses?.length === 0 && <p className="empty">No expenses for this filter.</p>}
            {dashboard?.expenses?.map((expense) => (
              <article className="finance-row expense-row" key={expense.id}>
                <div>
                  <strong>{expense.description || expense.category}</strong>
                  <span>
                    {expense.category} · {expense.expense_date} · {expense.payment_method.toUpperCase()} · Added by {expense.created_by_name || 'Unknown'}
                  </span>
                </div>
                <b>{money(expense.amount)}</b>
                <div className="row-actions">
                  <button title="Edit expense" onClick={() => {
                    setEditingExpenseId(expense.id);
                    setExpenseForm({
                      expense_date: expense.expense_date.slice(0, 10),
                      category: expense.category,
                      description: expense.description,
                      amount: expense.amount,
                      payment_method: expense.payment_method
                    });
                  }}><Edit3 size={17} /></button>
                  <button title="Delete expense" className="danger-btn" onClick={() => deleteExpense(expense)}><Archive size={17} /></button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      {showRemittanceModal && (
        <div className="modal-backdrop" role="presentation">
          <section className="remittance-modal" role="dialog" aria-modal="true" aria-labelledby="remittance-title">
            <div className="modal-header">
              <div>
                <h2 id="remittance-title">Select Days to Remit</h2>
                <span>Choose one day or multiple days from the selected {currentPeriodLabel}.</span>
              </div>
              <button className="icon-button modal-close" onClick={() => setShowRemittanceModal(false)} title="Close remittance modal">
                <X size={20} />
              </button>
            </div>
            <label className="form-field">
              <span>Remittance Note</span>
              <input value={remittanceNote} onChange={(event) => setRemittanceNote(event.target.value)} placeholder="Cash picked up, sent via bank, etc." />
            </label>
            <div className="remittance-day-list">
              {remittanceDaysInView.length === 0 && <p className="empty">No days available for this view.</p>}
              {remittanceDaysInView.map((day) => (
                <label className={`remittance-day ${day.remittance ? 'remitted' : ''}`} key={day.business_date}>
                  <input
                    type="checkbox"
                    checked={selectedRemittanceDays.includes(day.business_date)}
                    onChange={() => toggleRemittanceDay(day.business_date)}
                  />
                  <span>
                    <strong>{day.business_date}</strong>
                    <small>Sales {money(day.sales_total)} · Expenses {money(day.expense_total)} · Net {money(day.net_total)}</small>
                  </span>
                  <b>{day.remittance ? 'Remitted' : 'Pending'}</b>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setShowRemittanceModal(false)}><X size={18} /> Cancel</button>
              <button type="button" onClick={submitRemittance}><CheckCircle2 size={18} /> Mark Selected</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Expenses({ setMessage, currentUser }) {
  const today = new Date().toISOString().slice(0, 10);
  const expenseDate = today;
  const [expenseSearch, setExpenseSearch] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    expense_date: today,
    category: '',
    description: '',
    amount: '',
    payment_method: 'cash'
  });
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const loadExpenses = async () => {
    const params = new URLSearchParams({
      period: 'day',
      date: expenseDate,
      search: expenseSearch,
      start_date: expenseDate,
      end_date: expenseDate
    });
    const data = await api(`/dashboard?${params.toString()}`);
    setDashboard(data);
  };

  useEffect(() => {
    loadExpenses().catch((error) => setMessage(error.message));
  }, [expenseDate, expenseSearch]);

  useEffect(() => {
    if (!editingExpenseId) setExpenseForm((current) => ({ ...current, expense_date: expenseDate }));
  }, [editingExpenseId, expenseDate]);

  const resetExpenseForm = () => {
    setExpenseForm({ expense_date: expenseDate, category: '', description: '', amount: '', payment_method: 'cash' });
    setEditingExpenseId(null);
  };

  const submitExpense = async (event) => {
    event.preventDefault();
    try {
      const method = editingExpenseId ? 'PATCH' : 'POST';
      const path = editingExpenseId ? `/expenses/${editingExpenseId}` : '/expenses';
      await api(path, { method, body: JSON.stringify({ ...expenseForm, expense_date: expenseDate, created_by_user_id: currentUser?.id }) });
      resetExpenseForm();
      await loadExpenses();
      setMessage(editingExpenseId ? 'Expense updated.' : 'Expense added.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const deleteExpense = async (expense) => {
    if (!window.confirm(`Delete expense "${expense.description}"?`)) return;
    try {
      await api(`/expenses/${expense.id}`, { method: 'DELETE' });
      await loadExpenses();
      setMessage('Expense deleted.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const summary = dashboard?.summary || { expense_total: 0, expense_count: 0 };

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <h1>Expenses</h1>
          <p>Add and review expenses for today only.</p>
        </div>
        <div className="dashboard-controls">
          <span className="date-chip">{expenseDate}</span>
        </div>
      </section>

      <section className="overview-grid seller-expense-summary">
        <article className="overview-card expense-card">
          <span>Daily Expenses</span>
          <strong>{money(summary.expense_total)}</strong>
          <small>{summary.expense_count} record{summary.expense_count === 1 ? '' : 's'}</small>
        </article>
      </section>

      <section className="dashboard-panel expenses-list-panel">
        <div className="panel-heading">
          <div>
            <h2>Expenses List</h2>
            <span>{dashboard?.expenses?.length || 0} expense{dashboard?.expenses?.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="toolbar single">
          <label className="search-field">
            <span>Search Expenses</span>
            <div><Search size={18} /><input value={expenseSearch} onChange={(event) => setExpenseSearch(event.target.value)} placeholder="Search category, description, payment" /></div>
          </label>
        </div>

        <form className="expense-form" onSubmit={submitExpense}>
          <label className="form-field">
            <span>Category</span>
            <input required value={expenseForm.category} onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value })} placeholder="Rent, supplies, delivery" />
          </label>
          <label className="form-field">
            <span>Description</span>
            <input value={expenseForm.description} onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })} placeholder="Optional note" />
          </label>
          <label className="form-field">
            <span>Amount</span>
            <input required type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })} placeholder="0.00" />
          </label>
          <label className="form-field">
            <span>Payment</span>
            <select value={expenseForm.payment_method} onChange={(event) => setExpenseForm({ ...expenseForm, payment_method: event.target.value })}>
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
              <option value="maya">Maya</option>
              <option value="bank">Bank</option>
              <option value="other">Other</option>
            </select>
          </label>
          <button><Wallet size={18} /> {editingExpenseId ? 'Update Expense' : 'Add Expense'}</button>
          {editingExpenseId && <button type="button" className="ghost-btn" onClick={resetExpenseForm}><X size={18} /> Cancel</button>}
        </form>

        <div className="finance-list">
          {dashboard?.expenses?.length === 0 && <p className="empty">No expenses for this date.</p>}
          {dashboard?.expenses?.map((expense) => (
            <article className="finance-row expense-row" key={expense.id}>
              <div>
                <strong>{expense.description || expense.category}</strong>
                <span>{expense.category} · {expense.expense_date} · {expense.payment_method.toUpperCase()} · Added by {expense.created_by_name || 'Unknown'}</span>
              </div>
              <b>{money(expense.amount)}</b>
              <div className="row-actions">
                <button title="Edit expense" onClick={() => {
                  setEditingExpenseId(expense.id);
                  setExpenseForm({
                    expense_date: expense.expense_date.slice(0, 10),
                    category: expense.category,
                    description: expense.description,
                    amount: expense.amount,
                    payment_method: expense.payment_method
                  });
                }}><Edit3 size={17} /></button>
                <button title="Delete expense" className="danger-btn" onClick={() => deleteExpense(expense)}><Archive size={17} /></button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function SalesLineChart({ title, items, labelKey, valueKey, emptyText }) {
  const maxValue = Math.max(1, ...items.map((item) => Number(item[valueKey] || 0)));
  const visibleItems = items.filter((item) => Number(item[valueKey] || 0) > 0);
  const chartItems = items.length ? items : [];
  const points = chartItems.map((item, index) => {
    const x = chartItems.length === 1 ? 50 : 8 + (index / (chartItems.length - 1)) * 84;
    const y = 88 - (Number(item[valueKey] || 0) / maxValue) * 76;
    return { item, value: Number(item[valueKey] || 0), x, y };
  });
  const linePath = points.map((point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;

    const previous = points[index - 1];
    const controlX = previous.x + (point.x - previous.x) / 2;
    return `C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }).join(' ');
  const fillPath = points.length ? `${linePath} L ${points[points.length - 1].x} 92 L ${points[0].x} 92 Z` : '';
  const labelPoints = points.filter((_, index) => index === 0 || index === points.length - 1 || points.length <= 8 || index % Math.ceil(points.length / 6) === 0);

  return (
    <section className="dashboard-panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <span>{visibleItems.length} point{visibleItems.length === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div className="line-chart">
        {visibleItems.length === 0 && <p className="empty">{emptyText}</p>}
        {visibleItems.length > 0 && (
          <>
            <svg className="line-chart-svg" viewBox="0 0 100 100" role="img" aria-label={title}>
              <path className="line-chart-grid" d="M 8 8 H 92 M 8 19 H 92 M 8 30 H 92 M 8 41 H 92 M 8 52 H 92 M 8 63 H 92 M 8 74 H 92 M 8 85 H 92" />
              <path className="line-chart-fill" d={fillPath} />
              <path className="line-chart-line" d={linePath} />
              {points.map((point) => (
                <circle className="line-chart-point" cx={point.x} cy={point.y} r="1.8" key={point.item[labelKey]} />
              ))}
            </svg>
            <div className="line-chart-labels">
              {labelPoints.map((point) => (
                <span key={point.item[labelKey]}>
                  <b>{point.item[labelKey]}</b>
                  <small>{money(point.value)}</small>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Manage({ categories, products, stocks, reload, setMessage }) {
  const unitOptions = ['pcs', 'grams', 'ml', 'liters', 'gallon', 'kg', 'packs', 'boxes', 'others'];
  const [manageTab, setManageTab] = useState('products');
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('All');
  const [stockSearch, setStockSearch] = useState('');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [categoryForm, setCategoryForm] = useState({ name: '', color: '#275266' });
  const [stockForm, setStockForm] = useState({ name: '', unit: 'pcs', quantity_on_hand: 0, reorder_level: 0 });
  const [productForm, setProductForm] = useState({ name: '', price: '', category_id: '' });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [editingStockId, setEditingStockId] = useState(null);
  const [recipeModal, setRecipeModal] = useState(null);
  const [restock, setRestock] = useState({ stock_item_id: '', quantity: '', movement_date: new Date().toISOString().slice(0, 10), note: '' });
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({ username: '', display_name: '', password: '', role: 'seller' });
  const [passwordForms, setPasswordForms] = useState({});

  const loadUsers = async () => {
    const data = await api('/users');
    setUsers(data);
  };

  const loadOrders = async () => {
    const data = await api('/sales?limit=100');
    setOrders(data);
  };

  useEffect(() => {
    if (manageTab === 'accounts') loadUsers().catch((error) => setMessage(error.message));
    if (manageTab === 'orders') loadOrders().catch((error) => setMessage(error.message));
  }, [manageTab]);

  const save = async (path, form, reset) => {
    try {
      await api(path, { method: 'POST', body: JSON.stringify(form) });
      reset();
      await reload();
      setMessage('Saved.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const resetProduct = () => {
    setProductForm({ name: '', price: '', category_id: '' });
    setEditingProductId(null);
  };

  const resetCategory = () => {
    setCategoryForm({ name: '', color: '#275266' });
    setEditingCategoryId(null);
  };

  const resetStock = () => {
    setStockForm({ name: '', unit: 'pcs', quantity_on_hand: 0, reorder_level: 0 });
    setEditingStockId(null);
  };

  const submitCategory = async (event) => {
    event.preventDefault();
    try {
      const method = editingCategoryId ? 'PATCH' : 'POST';
      const path = editingCategoryId ? `/categories/${editingCategoryId}` : '/categories';
      await api(path, { method, body: JSON.stringify(categoryForm) });
      resetCategory();
      await reload();
      setMessage(editingCategoryId ? 'Category updated.' : 'Category added.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const submitProduct = async (event) => {
    event.preventDefault();
    try {
      const method = editingProductId ? 'PATCH' : 'POST';
      const path = editingProductId ? `/products/${editingProductId}` : '/products';
      await api(path, { method, body: JSON.stringify(productForm) });
      resetProduct();
      await reload();
      setMessage(editingProductId ? 'Product updated.' : 'Product added.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const submitStock = async (event) => {
    event.preventDefault();
    try {
      const method = editingStockId ? 'PATCH' : 'POST';
      const path = editingStockId ? `/stocks/${editingStockId}` : '/stocks';
      await api(path, { method, body: JSON.stringify(stockForm) });
      resetStock();
      await reload();
      setMessage(editingStockId ? 'Stock updated.' : 'Stock added.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const openRecipeModal = (product) => {
    const lines = product.recipe.length
      ? product.recipe.map((recipe) => ({
          row_id: `${recipe.id}`,
          stock_item_id: String(recipe.stock_item_id),
          quantity_per_unit: String(recipe.quantity_per_unit)
        }))
      : [{ row_id: `${Date.now()}`, stock_item_id: '', quantity_per_unit: '' }];
    setRecipeModal({ product, lines });
  };

  const updateRecipeLine = (rowId, key, value) => {
    setRecipeModal((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.row_id === rowId ? { ...line, [key]: value } : line))
    }));
  };

  const addRecipeLine = () => {
    setRecipeModal((current) => ({
      ...current,
      lines: [...current.lines, { row_id: `${Date.now()}-${current.lines.length}`, stock_item_id: '', quantity_per_unit: '' }]
    }));
  };

  const removeRecipeLine = (rowId) => {
    setRecipeModal((current) => ({
      ...current,
      lines: current.lines.length === 1
        ? [{ row_id: `${Date.now()}`, stock_item_id: '', quantity_per_unit: '' }]
        : current.lines.filter((line) => line.row_id !== rowId)
    }));
  };

  const submitRecipeModal = async (event) => {
    event.preventDefault();
    try {
      const items = recipeModal.lines.map((line) => ({
        stock_item_id: Number(line.stock_item_id),
        quantity_per_unit: Number(line.quantity_per_unit)
      }));
      if (items.some((item) => !item.stock_item_id || !item.quantity_per_unit || item.quantity_per_unit <= 0)) {
        setMessage('Each recipe row needs a stock item and quantity greater than zero.');
        return;
      }
      await api(`/products/${recipeModal.product.id}/recipes`, {
        method: 'PUT',
        body: JSON.stringify({ items })
      });
      setRecipeModal(null);
      await reload();
      setMessage(`${recipeModal.product.name} recipe saved.`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const remove = async (path, label) => {
    if (!window.confirm(`Delete ${label}?`)) return;
    try {
      await api(path, { method: 'DELETE' });
      await reload();
      setMessage(`${label} deleted.`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const submitRestock = async (event) => {
    event.preventDefault();
    try {
      await api(`/stocks/${restock.stock_item_id}/restock`, { method: 'POST', body: JSON.stringify(restock) });
      setRestock({ stock_item_id: '', quantity: '', movement_date: new Date().toISOString().slice(0, 10), note: '' });
      await reload();
      setMessage('Stock quantity added and recorded.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const submitUser = async (event) => {
    event.preventDefault();
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(userForm) });
      setUserForm({ username: '', display_name: '', password: '', role: 'seller' });
      await loadUsers();
      setMessage('Account added.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const changeUserPassword = async (user) => {
    try {
      const password = passwordForms[user.id] || '';
      await api(`/users/${user.id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) });
      setPasswordForms((current) => ({ ...current, [user.id]: '' }));
      setMessage(`${user.display_name} password changed.`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const cancelOrder = async (order) => {
    if (!window.confirm(`Cancel ${order.receipt_no}? This will remove it from sales totals and restore deducted stocks.`)) return;
    try {
      await api(`/sales/${order.id}/cancel`, { method: 'PATCH', body: JSON.stringify({ note: 'Cancelled by admin' }) });
      await loadOrders();
      await reload();
      setMessage(`${order.receipt_no} cancelled.`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesCategory = productCategory === 'All' || product.category_name === productCategory;
    const text = `${product.name} ${product.category_name}`.toLowerCase();
    return matchesCategory && text.includes(productSearch.toLowerCase());
  });

  const filteredStocks = stocks.filter((stock) => `${stock.name} ${stock.unit}`.toLowerCase().includes(stockSearch.toLowerCase()));

  const filteredRecipeProducts = products.filter((product) =>
    `${product.name} ${product.category_name} ${product.recipe.map((recipe) => recipe.name).join(' ')}`.toLowerCase().includes(recipeSearch.toLowerCase())
  );

  const filteredOrders = orders.filter((order) => {
    const text = `${order.receipt_no} ${order.payment_method} ${order.status || 'completed'} ${(order.items || []).map((item) => item.product_name).join(' ')}`.toLowerCase();
    return text.includes(orderSearch.toLowerCase());
  });

  return (
    <main className="manage-shell">
      <section className="manage-hero">
        <div>
          <h1>Manage</h1>
          <p>Products, stocks, and product recipes for automatic deductions.</p>
        </div>
        <div className="manage-tabs">
          <button className={manageTab === 'products' ? 'active' : ''} onClick={() => setManageTab('products')}><PackagePlus size={20} /> Products</button>
          <button className={manageTab === 'stocks' ? 'active' : ''} onClick={() => setManageTab('stocks')}><Boxes size={20} /> Stocks</button>
          <button className={manageTab === 'recipes' ? 'active' : ''} onClick={() => setManageTab('recipes')}><ClipboardList size={20} /> Product Stock Recipe</button>
          <button className={manageTab === 'orders' ? 'active' : ''} onClick={() => setManageTab('orders')}><ReceiptText size={20} /> Manage Order</button>
          <button className={manageTab === 'accounts' ? 'active' : ''} onClick={() => setManageTab('accounts')}><UserRound size={20} /> Accounts</button>
        </div>
      </section>

      {manageTab === 'products' && (
        <section className="manage-panel full">
          <div className="panel-heading">
            <div>
              <h2>Products</h2>
              <span>{filteredProducts.length} active product{filteredProducts.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          <form className="inline-form" onSubmit={submitProduct}>
            <label className="form-field">
              <span>Category</span>
              <select value={productForm.category_id} onChange={(event) => setProductForm({ ...productForm, category_id: event.target.value })}>
                <option value="">Select category</option>
                {categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Product Name</span>
              <input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="Classic Lemonade" />
            </label>
            <label className="form-field">
              <span>Price</span>
              <input type="number" step="0.01" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} placeholder="0.00" />
            </label>
            <button><Save size={18} /> {editingProductId ? 'Update' : 'Add Product'}</button>
            {editingProductId && <button type="button" className="ghost-btn" onClick={resetProduct}><X size={18} /> Cancel</button>}
          </form>

          <form className="inline-form category-form" onSubmit={submitCategory}>
            <label className="form-field">
              <span>Category Name</span>
              <input value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} placeholder="Drinks" />
            </label>
            <label className="form-field">
              <span>Color</span>
              <input type="color" value={categoryForm.color} onChange={(event) => setCategoryForm({ ...categoryForm, color: event.target.value })} />
            </label>
            <button><Layers size={18} /> {editingCategoryId ? 'Update Category' : 'Add Category'}</button>
            <button type="button" className="ghost-btn" onClick={() => setShowCategoryModal(true)}><ClipboardList size={18} /> View Category</button>
            {editingCategoryId && <button type="button" className="ghost-btn" onClick={resetCategory}><X size={18} /> Cancel</button>}
          </form>

          <section className="list-section">
            <div className="toolbar">
              <label className="search-field"><span>Search Products</span><div><Search size={18} /><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search product or category" /></div></label>
              <label className="form-field">
                <span>Filter Category</span>
                <select value={productCategory} onChange={(event) => setProductCategory(event.target.value)}>
                  <option>All</option>
                  {categories.map((item) => <option key={item.id}>{item.name}</option>)}
                </select>
              </label>
            </div>

            <div className="data-table product-table">
              <div className="table-head"><span>Product</span><span>Category</span><span>Price</span><span>Recipe Items</span><span>Actions</span></div>
              {filteredProducts.map((product) => (
                <div className="table-row" key={product.id}>
                  <strong>{product.name}</strong>
                  <span>{product.category_name}</span>
                  <span>{money(product.price)}</span>
                  <span>{product.recipe.length}</span>
                  <div className="row-actions">
                    <button title="Edit product" onClick={() => {
                      setEditingProductId(product.id);
                      setProductForm({ name: product.name, price: product.price, category_id: product.category_id });
                    }}><Edit3 size={17} /></button>
                    <button title="Delete product" className="danger-btn" onClick={() => remove(`/products/${product.id}`, product.name)}><Archive size={17} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      )}

      {showCategoryModal && (
        <div className="modal-backdrop" role="presentation">
          <section className="category-modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title">
            <div className="modal-header">
              <div>
                <h2 id="category-modal-title">Categories</h2>
                <span>Edit a category, or delete it after moving/deleting its products.</span>
              </div>
              <button className="icon-button modal-close" onClick={() => setShowCategoryModal(false)} title="Close categories">
                <X size={20} />
              </button>
            </div>
            <div className="data-table category-data-table modal-table">
              <div className="table-head"><span>Category</span><span>Color</span><span>Products</span><span>Actions</span></div>
              {categories.map((item) => {
                const productCount = products.filter((product) => product.category_id === item.id).length;
                return (
                  <div className="table-row" key={item.id}>
                    <strong>{item.name}</strong>
                    <span className="color-swatch-line"><i style={{ backgroundColor: item.color }} /> {item.color}</span>
                    <span>{productCount ? `${productCount} product${productCount === 1 ? '' : 's'}` : 'No products'}</span>
                    <div className="row-actions">
                      <button title="Edit category" onClick={() => {
                        setEditingCategoryId(item.id);
                        setCategoryForm({ name: item.name, color: item.color });
                        setShowCategoryModal(false);
                      }}><Edit3 size={17} /></button>
                      <button
                        title={productCount ? 'Move or delete products in this category first.' : 'Delete category'}
                        className="danger-btn"
                        disabled={productCount > 0}
                        onClick={() => remove(`/categories/${item.id}`, item.name)}
                      ><Archive size={17} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {manageTab === 'stocks' && (
        <section className="manage-panel full">
          <div className="panel-heading">
            <div>
              <h2>Stocks</h2>
              <span>{filteredStocks.length} stock item{filteredStocks.length === 1 ? '' : 's'}</span>
            </div>
            <button className="primary-pill" onClick={() => document.getElementById('stock-name-input')?.focus()}><PlusCircle size={18} /> Add Stock</button>
          </div>

          <form className="inline-form" onSubmit={submitStock}>
            <label className="form-field">
              <span>Stock Name</span>
              <input id="stock-name-input" value={stockForm.name} onChange={(event) => setStockForm({ ...stockForm, name: event.target.value })} placeholder="Sugar" />
            </label>
            <label className="form-field">
              <span>Stock Quantity</span>
              <input type="number" step="0.001" value={stockForm.quantity_on_hand} onChange={(event) => setStockForm({ ...stockForm, quantity_on_hand: event.target.value })} placeholder="0" />
            </label>
            <label className="form-field">
              <span>Unit of Measure</span>
              <select value={stockForm.unit} onChange={(event) => setStockForm({ ...stockForm, unit: event.target.value })}>
                {unitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Reorder Level</span>
              <input type="number" step="0.001" value={stockForm.reorder_level} onChange={(event) => setStockForm({ ...stockForm, reorder_level: event.target.value })} placeholder="0" />
            </label>
            <button><Save size={18} /> {editingStockId ? 'Update' : 'Add Stock'}</button>
            {editingStockId && <button type="button" className="ghost-btn" onClick={resetStock}><X size={18} /> Cancel</button>}
          </form>

          <form className="inline-form restock-form" onSubmit={submitRestock}>
            <label className="form-field">
              <span>Stock Item</span>
              <select value={restock.stock_item_id} onChange={(event) => setRestock({ ...restock, stock_item_id: event.target.value })}>
                <option value="">Select stock item</option>
                {stocks.map((stock) => <option value={stock.id} key={stock.id}>{stock.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Quantity to Add</span>
              <input type="number" step="0.001" value={restock.quantity} onChange={(event) => setRestock({ ...restock, quantity: event.target.value })} placeholder="0" />
            </label>
            <label className="form-field">
              <span>Date Recorded</span>
              <input type="date" value={restock.movement_date} onChange={(event) => setRestock({ ...restock, movement_date: event.target.value })} />
            </label>
            <label className="form-field">
              <span>Note</span>
              <input value={restock.note} onChange={(event) => setRestock({ ...restock, note: event.target.value })} placeholder="Delivery, manual count, etc." />
            </label>
            <button><PlusCircle size={18} /> Add Quantity</button>
          </form>

          <section className="list-section">
            <div className="toolbar single">
              <label className="search-field"><span>Search Stocks</span><div><Search size={18} /><input value={stockSearch} onChange={(event) => setStockSearch(event.target.value)} placeholder="Search stock item or unit" /></div></label>
            </div>

            <div className="data-table stock-data-table">
              <div className="table-head"><span>Stock Item</span><span>Stock Quantity</span><span>Unit of Measure</span><span>Reorder</span><span>Actions</span></div>
              {filteredStocks.map((stock) => (
                <div className={`table-row ${stock.quantity_on_hand <= stock.reorder_level ? 'low' : ''}`} key={stock.id}>
                  <strong>{stock.name}</strong>
                  <span>{Number(stock.quantity_on_hand).toLocaleString()}</span>
                  <span>{stock.unit}</span>
                  <span>{Number(stock.reorder_level).toLocaleString()}</span>
                  <div className="row-actions">
                    <button title="Add quantity" onClick={() => setRestock({ ...restock, stock_item_id: String(stock.id) })}><PlusCircle size={17} /></button>
                    <button title="Edit stock" onClick={() => {
                      setEditingStockId(stock.id);
                      setStockForm({ name: stock.name, unit: stock.unit, quantity_on_hand: stock.quantity_on_hand, reorder_level: stock.reorder_level });
                    }}><Edit3 size={17} /></button>
                    <button title="Delete stock" className="danger-btn" onClick={() => remove(`/stocks/${stock.id}`, stock.name)}><Archive size={17} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      )}

      {manageTab === 'recipes' && (
        <section className="manage-panel full">
          <div className="panel-heading">
            <div>
              <h2>Product Stock Recipe</h2>
              <span>{filteredRecipeProducts.length} product recipe{filteredRecipeProducts.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          <section className="list-section">
            <div className="toolbar single">
              <label className="search-field"><span>Search Product Recipes</span><div><Search size={18} /><input value={recipeSearch} onChange={(event) => setRecipeSearch(event.target.value)} placeholder="Search product or stock item" /></div></label>
            </div>

            <div className="data-table recipe-data-table">
              <div className="table-head"><span>Product</span><span>Category</span><span>Recipe Items</span><span>Deduction Summary</span><span>Actions</span></div>
              {filteredRecipeProducts.map((product) => (
                <div className="table-row" key={product.id}>
                  <strong>{product.name}</strong>
                  <span>{product.category_name}</span>
                  <span>{product.recipe.length}</span>
                  <span>{product.recipe.length ? product.recipe.map((recipe) => `${recipe.quantity_per_unit} ${recipe.unit} ${recipe.name}`).join(', ') : 'No stock recipe yet'}</span>
                  <div className="row-actions">
                    <button title="Add or update recipe" onClick={() => openRecipeModal(product)}>
                      {product.recipe.length ? <Edit3 size={17} /> : <Plus size={17} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      )}

      {manageTab === 'orders' && (
        <section className="manage-panel full">
          <div className="panel-heading">
            <div>
              <h2>Manage Order</h2>
              <span>{filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          <div className="toolbar single">
            <label className="search-field order-search"><span>Search Orders</span><div><Search size={18} /><input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Search receipt, item, payment, status" /></div></label>
          </div>

          <div className="data-table orders-table">
            <div className="table-head"><span>Receipt</span><span>Date</span><span>Items</span><span>Payment</span><span>Total</span><span>Status</span><span>Actions</span></div>
            {filteredOrders.length === 0 && <p className="empty">No orders found.</p>}
            {filteredOrders.map((order) => {
              const isCancelled = order.status === 'cancelled';
              return (
                <div className={`table-row ${isCancelled ? 'cancelled' : ''}`} key={order.id}>
                  <strong>{order.receipt_no}</strong>
                  <span>{new Date(order.created_at).toLocaleString()}</span>
                  <span>{(order.items || []).map((item) => `${item.quantity}x ${item.product_name}`).join(', ')}</span>
                  <span>{String(order.payment_method || '').toUpperCase()}</span>
                  <span>{money(order.total)}</span>
                  <span className={`status-pill ${isCancelled ? 'cancelled' : 'remitted'}`}>{isCancelled ? 'Cancelled' : 'Completed'}</span>
                  <div className="row-actions">
                    <button
                      className="status-pill cancelled cancel-order-button"
                      disabled={isCancelled}
                      title={isCancelled ? 'Order already cancelled' : 'Cancel order'}
                      onClick={() => cancelOrder(order)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {manageTab === 'accounts' && (
        <section className="manage-panel full">
          <div className="panel-heading">
            <div>
              <h2>Accounts</h2>
              <span>{users.length} account{users.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          <form className="inline-form account-form" onSubmit={submitUser}>
            <label className="form-field">
              <span>Username</span>
              <input required value={userForm.username} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} placeholder="seller2" />
            </label>
            <label className="form-field">
              <span>Display Name</span>
              <input required value={userForm.display_name} onChange={(event) => setUserForm({ ...userForm, display_name: event.target.value })} placeholder="Seller Name" />
            </label>
            <label className="form-field">
              <span>Password</span>
              <input required type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} placeholder="At least 4 characters" />
            </label>
            <label className="form-field">
              <span>Role</span>
              <select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}>
                <option value="seller">Seller</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button><UserRound size={18} /> Add Account</button>
          </form>

          <div className="data-table accounts-table">
            <div className="table-head"><span>Name</span><span>Username</span><span>Role</span><span>New Password</span><span>Actions</span></div>
            {users.map((user) => (
              <div className="table-row" key={user.id}>
                <strong>{user.display_name}</strong>
                <span>{user.username}</span>
                <span className="status-pill remitted">{user.role}</span>
                <span>
                  <input
                    type="password"
                    value={passwordForms[user.id] || ''}
                    onChange={(event) => setPasswordForms({ ...passwordForms, [user.id]: event.target.value })}
                    placeholder="New password"
                  />
                </span>
                <div className="row-actions">
                  <button
                    title="Change password"
                    disabled={(passwordForms[user.id] || '').length < 4}
                    onClick={() => changeUserPassword(user)}
                  >
                    <Save size={17} /> Change
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {recipeModal && (
        <div className="modal-backdrop" role="presentation">
          <section className="recipe-modal" role="dialog" aria-modal="true" aria-labelledby="recipe-modal-title">
            <div className="modal-header">
              <div>
                <h2 id="recipe-modal-title">{recipeModal.product.name}</h2>
                <span>Set all stock items deducted when this product is sold.</span>
              </div>
              <button className="icon-button modal-close" onClick={() => setRecipeModal(null)} title="Close recipe modal">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitRecipeModal}>
              <div className="recipe-line-list">
                {recipeModal.lines.map((line, index) => {
                  const selectedStock = stocks.find((stock) => String(stock.id) === line.stock_item_id);
                  return (
                    <div className="recipe-line" key={line.row_id}>
                      <span className="line-number">{index + 1}</span>
                      <label className="form-field">
                        <span>Stock Item</span>
                        <select required value={line.stock_item_id} onChange={(event) => updateRecipeLine(line.row_id, 'stock_item_id', event.target.value)}>
                          <option value="">Select stock item</option>
                          {stocks.map((stock) => <option value={String(stock.id)} key={stock.id}>{stock.name} ({stock.unit})</option>)}
                        </select>
                      </label>
                      <label className="form-field">
                        <span>Qty Per Sale</span>
                        <input required min="0.001" type="number" step="0.001" value={line.quantity_per_unit} onChange={(event) => updateRecipeLine(line.row_id, 'quantity_per_unit', event.target.value)} placeholder="0" />
                      </label>
                      <label className="form-field">
                        <span>Unit</span>
                        <span className="unit-chip">{selectedStock?.unit || 'unit'}</span>
                      </label>
                      <button type="button" className="icon-button danger-icon" onClick={() => removeRecipeLine(line.row_id)} title="Remove stock row">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={addRecipeLine}><Plus size={18} /> Add Stock Row</button>
                <button type="submit"><Save size={18} /> Save Recipe</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function Receipt({ receipt }) {
  if (!receipt) return null;
  return (
    <section className="receipt-print">
      <h1>KoolITs</h1>
      <p className="receipt-subtitle">POS Receipt</p>
      <p>{receipt.receipt_no}</p>
      <p>{new Date().toLocaleString()}</p>
      <div className="receipt-rule" />
      {receipt.items.map((item) => (
        <div className="receipt-row" key={item.product_id}>
          <span>{item.quantity}x {item.product_name}</span>
          <span>{receiptMoney(item.line_total)}</span>
        </div>
      ))}
      <div className="receipt-rule" />
      <div className="receipt-row strong"><span>Total</span><span>{receiptMoney(receipt.total)}</span></div>
      <div className="receipt-row"><span>Payment</span><span>{receipt.payment_method.toUpperCase()}</span></div>
      {receipt.payment_breakdown &&
        Object.entries(paymentLabels).map(([method, label]) =>
          Number(receipt.payment_breakdown[method] || 0) > 0 ? (
            <div className="receipt-row" key={method}><span>{label}</span><span>{receiptMoney(receipt.payment_breakdown[method])}</span></div>
          ) : null
        )}
      <div className="receipt-row"><span>Received</span><span>{receiptMoney(receipt.amount_tendered)}</span></div>
      <div className="receipt-row"><span>Change</span><span>{receiptMoney(receipt.change_due)}</span></div>
      <div className="receipt-rule" />
      <p>Thank you!</p>
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
