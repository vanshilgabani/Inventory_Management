import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  FiPackage, FiTrendingUp, FiPercent, FiDollarSign,
  FiInfo, FiAlertCircle, FiActivity, FiRefreshCw,
  FiCheck, FiDatabase, FiZap
} from 'react-icons/fi';
import { analyticsService } from '../services/analyticsService';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) =>
  `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n) => `${Number(n).toFixed(2)}%`;
const fmtNum = (n) => Number(n).toLocaleString('en-IN');

const PERIODS = [
  { label: '30d',     days: 30  },
  { label: '60d',     days: 60  },
  { label: '90d',     days: 90  },
  { label: '6 months',days: 180 },
];

// ─── InputField ──────────────────────────────────────────────────────────────
const InputField = ({
  label, value, onChange,
  prefix = '₹', tooltip = '', step = '0.01', min = '0', synced = false,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-1.5 flex-wrap">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {synced && (
        <span className="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
          <FiCheck className="w-2.5 h-2.5" /> from system
        </span>
      )}
      {tooltip && (
        <div className="group relative ml-auto">
          <FiInfo className="w-3 h-3 text-slate-400 cursor-help" />
          <div className="absolute right-0 bottom-6 hidden group-hover:block bg-slate-900 text-white text-xs rounded-lg px-3 py-2 w-60 z-20 shadow-xl leading-relaxed">
            {tooltip}
          </div>
        </div>
      )}
    </div>
    <div className={`flex items-center rounded-xl overflow-hidden border transition-all
      ${synced
        ? 'border-emerald-300 ring-1 ring-emerald-100'
        : 'border-slate-200'}
      focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100`}
    >
      {prefix && (
        <span className={`px-3 py-2.5 text-sm font-medium border-r select-none
          ${synced ? 'bg-emerald-50 text-emerald-500 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
          {prefix}
        </span>
      )}
      <input
        type="number" value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min} step={step}
        className={`flex-1 px-3 py-2.5 text-sm font-medium outline-none placeholder-slate-300
          ${synced ? 'bg-emerald-50/40 text-emerald-800' : 'bg-white text-slate-800'}`}
        placeholder="0"
      />
    </div>
  </div>
);

// ─── SectionCard ──────────────────────────────────────────────────────────────
const SectionCard = ({ title, icon: Icon, accent, children }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
    <div className={`flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 ${accent}`}>
      <Icon className="w-4 h-4" />
      <h3 className="text-sm font-bold tracking-wide">{title}</h3>
    </div>
    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  </div>
);

// ─── StatTile ─────────────────────────────────────────────────────────────────
const StatTile = ({ label, value, sub, accent = 'bg-white border-slate-200', textColor = 'text-slate-800' }) => (
  <div className={`rounded-2xl border p-4 ${accent}`}>
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
    <p className={`text-2xl font-extrabold mt-1.5 ${textColor}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{sub}</p>}
  </div>
);

// ─── BreakdownRow ─────────────────────────────────────────────────────────────
const BreakdownRow = ({ label, sub, value, color, sign, highlight }) => (
  <div className={`flex items-center justify-between px-5 py-3 ${highlight || ''}`}>
    <div className="flex-1 pr-4">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{sub}</p>}
    </div>
    <span className={`text-sm font-bold whitespace-nowrap ${color}`}>
      {sign} {fmt(Math.abs(value))}
    </span>
  </div>
);

// ─── Main Calculator ──────────────────────────────────────────────────────────
const MarketplaceProfitCalculator = () => {
  const [inputs, setInputs] = useState({
    bankSettlement: '', costPrice: '', packagingCost: '', repackagingCost: '',
    extraCost: '', returnFee: '', rtoFee: '',
    customerReturnPct: '', rtoPct: '', wrongReturnPct: '',
    rent: '', salary: '', otherExpenses: '', avgOrdersPerMonth: '',
  });
  const [syncedFields, setSyncedFields] = useState({});
  const [wrongReturnIncludesReturnFee, setWrongReturnIncludesReturnFee] = useState(true);
  const [showInventoryView, setShowInventoryView] = useState(false);

  // System sync
  const [selectedPeriodDays, setSelectedPeriodDays] = useState(30);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [systemStats, setSystemStats] = useState(null);
  const [loadingSync, setLoadingSync] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);

  const [periodMode, setPeriodMode] = useState('preset'); // 'preset' | 'month' | 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // When user manually edits, remove "synced" badge for that field
  const set = (key) => (val) => {
    setInputs((prev) => ({ ...prev, [key]: val }));
    setSyncedFields((prev) => ({ ...prev, [key]: false }));
  };

  // ── Fetch & Auto-fill from system ─────────────────────────────────────────
  const fetchSystemData = useCallback(async (
    periodDays    = selectedPeriodDays,
    account       = selectedAccount,
    mode          = periodMode,
    monthVal      = selectedMonth,
    custStart     = customStart,
    custEnd       = customEnd,
  ) => {
    setLoadingSync(true);
    setSyncError(null);
    try {
      let startDate, endDate, days;

      if (mode === 'preset') {
        endDate   = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);
        days = periodDays;

      } else if (mode === 'month') {
        const [year, month] = monthVal.split('-').map(Number);
        startDate = new Date(year, month - 1, 1);
        endDate   = new Date(year, month, 0, 23, 59, 59); // last day of month
        days = endDate.getDate(); // days in that month

      } else if (mode === 'custom') {
        if (!custStart || !custEnd) {
          setSyncError('Please select both start and end dates.');
          setLoadingSync(false);
          return;
        }
        startDate = new Date(custStart);
        endDate   = new Date(custEnd);
        endDate.setHours(23, 59, 59);
        days = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
      }

      const response = await analyticsService.getMarketplaceAccountStats({
        startDate: startDate.toISOString().split('T')[0],
        endDate  : endDate.toISOString().split('T')[0],
      });

      if (!response.success || !response.data)
        throw new Error('Server returned no data');

      const allData = response.data;
      const names = [...new Set(allData.map((a) => a.accountName).filter(Boolean))].sort();
      setAccounts(names);

      const filtered =
        account === 'all' ? allData : allData.filter((a) => a.accountName === account);

      const totals = filtered.reduce(
        (acc, a) => ({
          orderCount      : acc.orderCount       + (a.orderCount       || 0),
          dispatchedCount : acc.dispatchedCount  + (a.dispatchedCount  || 0),
          returnedCount   : acc.returnedCount    + (a.returnedCount    || 0),
          RTOCount        : acc.RTOCount         + (a.RTOCount         || 0),
          wrongReturnCount: acc.wrongReturnCount + (a.wrongReturnCount || 0),
          totalSettlement : acc.totalSettlement  + (a.totalSettlement  || 0),
        }),
        { orderCount: 0, dispatchedCount: 0, returnedCount: 0, RTOCount: 0, wrongReturnCount: 0, totalSettlement: 0 }
      );

      if (totals.orderCount === 0) {
        setSyncError('No orders found for this period / account.');
        setLoadingSync(false);
        return;
      }

      const customerReturnPct = ((totals.returnedCount    / totals.orderCount) * 100).toFixed(2);
      const rtoPct            = ((totals.RTOCount         / totals.orderCount) * 100).toFixed(2);
      const wrongReturnPct    = ((totals.wrongReturnCount  / totals.orderCount) * 100).toFixed(2);
      const avgOrdersPerMonth = Math.round((totals.orderCount / days) * 30);
      const avgSettlement     =
        totals.dispatchedCount > 0
          ? (totals.totalSettlement / totals.dispatchedCount).toFixed(2)
          : null;

      setSystemStats({
        ...totals,
        customerReturnPct : parseFloat(customerReturnPct),
        rtoPct            : parseFloat(rtoPct),
        wrongReturnPct    : parseFloat(wrongReturnPct),
        keptRate          : totals.dispatchedCount / totals.orderCount,
        avgOrdersPerMonth,
        avgSettlement     : avgSettlement ? parseFloat(avgSettlement) : null,
        periodDays        : days,
      });

      const updates    = { customerReturnPct, rtoPct, wrongReturnPct, avgOrdersPerMonth: String(avgOrdersPerMonth) };
      const newSynced  = { customerReturnPct: true, rtoPct: true, wrongReturnPct: true, avgOrdersPerMonth: true };
      if (avgSettlement) { updates.bankSettlement = avgSettlement; newSynced.bankSettlement = true; }

      setInputs((prev) => ({ ...prev, ...updates }));
      setSyncedFields((prev) => ({ ...prev, ...newSynced }));
      setLastSynced(new Date());
    } catch (err) {
      setSyncError(err.message || 'Failed to sync from system');
    } finally {
      setLoadingSync(false);
    }
  }, [selectedPeriodDays, selectedAccount, periodMode, selectedMonth, customStart, customEnd]);

  // Auto-fetch on mount
  useEffect(() => { fetchSystemData(); }, []); // eslint-disable-line

  // Re-fetch when period changes
  const handlePeriodChange = (days) => {
    setSelectedPeriodDays(days);
    fetchSystemData(days, selectedAccount);
  };

  // Re-fetch when account changes
  const handleAccountChange = (acc) => {
    setSelectedAccount(acc);
    fetchSystemData(selectedPeriodDays, acc);
  };

  // ── Core Calculation ───────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const num = (key) => Math.max(0, parseFloat(inputs[key]) || 0);

    const bankSettlement  = num('bankSettlement');
    const costPrice       = num('costPrice');
    const packagingCost   = num('packagingCost');
    const repackagingCost = num('repackagingCost');
    const extraCost       = num('extraCost');
    const returnFee       = num('returnFee');
    const rtoFee          = num('rtoFee');

    const customerReturnRate = num('customerReturnPct') / 100;
    const rtoRate            = num('rtoPct') / 100;
    const wrongReturnRate    = num('wrongReturnPct') / 100;

    const rent            = num('rent');
    const salary          = num('salary');
    const otherExpenses   = num('otherExpenses');
    const avgOrders       = num('avgOrdersPerMonth');

    const monthlyOverhead = rent + salary + otherExpenses;
    const totalNonKeepRate = customerReturnRate + rtoRate + wrongReturnRate;
    const ratesValid       = totalNonKeepRate <= 1;
    const keptRate         = ratesValid ? Math.max(0, 1 - totalNonKeepRate) : 0;

    // Pants that physically come back (can repack & resell)
    const sellableReturnRate = customerReturnRate + rtoRate;
    // Pants lost forever (wrong/damaged — can't resell)
    const lostReturnRate     = wrongReturnRate;

    const overheadPerOrder      = avgOrders > 0 ? monthlyOverhead / avgOrders : 0;
    const overheadMissingOrders = monthlyOverhead > 0 && avgOrders === 0;

    // ── MONEY OUT per order dispatched ──────────────────────────────────────
    // Cost of pants actually consumed (kept + lost forever)
    const cogsConsumed         = (keptRate + lostReturnRate) * costPrice;
    // Pants that come back are NOT consumed — their cost is recovered as inventory
    const inventoryRecovered   = sellableReturnRate * costPrice;

    const packagingTotal       = packagingCost; // paid on every outgoing order
    const repackagingTotal     = sellableReturnRate * repackagingCost; // only on returned pants

    const returnFeeTotal =
      customerReturnRate * returnFee +
      rtoRate            * rtoFee +
      wrongReturnRate    * (wrongReturnIncludesReturnFee ? returnFee : 0);

    const totalMoneyOut =
      cogsConsumed + packagingTotal + repackagingTotal +
      returnFeeTotal + extraCost + overheadPerOrder;

    // ── MONEY IN per order dispatched ───────────────────────────────────────
    const moneyIn = keptRate * bankSettlement;

    // ── CASH PROFIT (pure money: what you received minus what you spent) ────
    // This is what hits your bank account — does NOT count inventory
    const cashProfitPerOrder = moneyIn - totalMoneyOut;

    // ── REAL PROFIT (cash + inventory value of returned pants) ─────────────
    // Returned pants sitting in godown = real asset, will become cash when resold
    const realProfitPerOrder = cashProfitPerOrder + inventoryRecovered;

    // ── Monthly figures ─────────────────────────────────────────────────────
    const monthlyCashProfit        = avgOrders > 0 ? cashProfitPerOrder  * avgOrders : null;
    const monthlyRealProfit        = avgOrders > 0 ? realProfitPerOrder  * avgOrders : null;
    const monthlyInventoryRecovered= avgOrders > 0 ? inventoryRecovered  * avgOrders : null;
    const keptOrdersPerMonth       = avgOrders > 0 ? keptRate            * avgOrders : null;
    const returnedPantsPerMonth    = avgOrders > 0 ? sellableReturnRate  * avgOrders : null;
    const lostPantsPerMonth        = avgOrders > 0 ? lostReturnRate      * avgOrders : null;

    // ── Break-even & margin ─────────────────────────────────────────────────
    const breakEvenSettlement      = keptRate > 0 ? totalMoneyOut / keptRate : 0;
    const cashMarginPct            = moneyIn > 0 ? (cashProfitPerOrder / moneyIn) * 100 : 0;
    const effectiveProfitPerKept   = keptRate > 0 ? cashProfitPerOrder / keptRate : null;

    return {
      // inputs
      bankSettlement, costPrice, packagingCost, repackagingCost, extraCost,
      returnFee, rtoFee,
      // rates
      customerReturnRate, rtoRate, wrongReturnRate, lostReturnRate,
      sellableReturnRate, keptRate, totalNonKeepRate, ratesValid,
      // overhead
      monthlyOverhead, overheadPerOrder, overheadMissingOrders, avgOrders,
      // per order
      moneyIn, cogsConsumed, inventoryRecovered,
      packagingTotal, repackagingTotal, returnFeeTotal,
      totalMoneyOut, cashProfitPerOrder, realProfitPerOrder,
      // monthly
      monthlyCashProfit, monthlyRealProfit,
      monthlyInventoryRecovered, keptOrdersPerMonth,
      returnedPantsPerMonth, lostPantsPerMonth,
      // metrics
      breakEvenSettlement, cashMarginPct, effectiveProfitPerKept,
      // flags
      isCashProfit  : cashProfitPerOrder  >= 0,
      isRealProfit  : realProfitPerOrder  >= 0,
      hasData       : bankSettlement > 0 && costPrice > 0,
    };
  }, [inputs, wrongReturnIncludesReturnFee]);

  // ── Breakdown rows ─────────────────────────────────────────────────────────
  const salesBreakdownRows = calc.hasData && calc.ratesValid ? [
    { label: 'Expected Revenue per Order', value: calc.expectedRevenuePerOrder, color: 'text-emerald-600', sign: '+',
      sub: `${fmtPct(calc.keptRate * 100)} kept rate × ${fmt(calc.bankSettlement)} settlement` },
    { label: 'Cost of Goods (COGS)', value: -calc.expectedCogsPerOrder, color: 'text-rose-500', sign: '−',
      sub: `(${fmtPct(calc.keptRate * 100)} kept + ${fmtPct(calc.wrongReturnRate * 100)} wrong returns) × ${fmt(calc.costPrice)} — returns & RTO come back, no COGS loss on those` },
    { label: 'Initial Packaging', value: -calc.initialPackagingPerOrder, color: 'text-rose-500', sign: '−',
      sub: 'Every outgoing shipment (100% of orders)' },
    calc.repackagingCost > 0 ? { label: 'Repackaging Cost', value: -calc.expectedRepackagingPerOrder, color: 'text-orange-500', sign: '−',
      sub: `${fmtPct(calc.sellableReturnRate * 100)} sellable returns × ${fmt(calc.repackagingCost)}` } : null,
    calc.expectedReturnFeePerOrder > 0 ? {
      label: 'Return & RTO Fees', value: -calc.expectedReturnFeePerOrder, color: 'text-orange-500', sign: '−',
      sub: (() => {
        const p = [];
        if (calc.customerReturnRate > 0) p.push(`${fmtPct(calc.customerReturnRate * 100)} cust × ${fmt(calc.returnFee)}`);
        if (calc.wrongReturnRate > 0 && wrongReturnIncludesReturnFee) p.push(`${fmtPct(calc.wrongReturnRate * 100)} wrong × ${fmt(calc.returnFee)}`);
        if (calc.rtoRate > 0 && calc.rtoFee > 0) p.push(`${fmtPct(calc.rtoRate * 100)} RTO × ${fmt(calc.rtoFee)}`);
        return p.join('  +  ') || '—';
      })()
    } : null,
    calc.overheadPerOrder > 0 ? { label: 'Overhead per Order', value: -calc.overheadPerOrder, color: 'text-violet-500', sign: '−',
      sub: `(${fmt(calc.rent)} rent + ${fmt(calc.salary)} salary + ${fmt(calc.otherExpenses)} other) ÷ ${fmtNum(calc.avgOrders)} orders` } : null,
    calc.extraCost > 0 ? { label: 'Extra Cost per Order', value: -calc.extraCost, color: 'text-slate-400', sign: '−',
      sub: 'Ads, inserts, QC, handling, etc.' } : null,
  ].filter(Boolean) : [];

  // ── Last synced label ──────────────────────────────────────────────────────
  const syncedAgo = lastSynced
    ? (() => {
        const mins = Math.floor((Date.now() - lastSynced) / 60000);
        return mins < 1 ? 'just now' : `${mins}m ago`;
      })()
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 p-4 pb-12">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            Marketplace Profit Calculator
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Flipkart · Expected profit model — auto-synced from your live order data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncedAgo && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              <FiCheck className="w-3 h-3" /> Synced {syncedAgo}
            </span>
          )}
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center gap-1.5">
            <FiZap className="w-3 h-3" /> Live Data
          </span>
        </div>
      </div>

      {/* ── System Sync Panel ── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <FiDatabase className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold">Live System Sync</h3>
          <span className="text-xs text-slate-400 ml-auto">Return rates, orders & settlement are fetched automatically</span>
        </div>

        {/* Controls */}
        <div className="space-y-3">

          {/* Mode tabs */}
          <div className="flex items-center gap-1 bg-slate-700/60 rounded-xl p-1 w-fit">
            {[
              { id: 'preset', label: '⚡ Quick' },
              { id: 'month',  label: '📅 Month' },
              { id: 'custom', label: '🗓 Custom' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setPeriodMode(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  periodMode === id
                    ? 'bg-indigo-500 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-end">

            {/* Preset mode */}
            {periodMode === 'preset' && (
              <div className="flex items-center gap-1 bg-slate-700/60 rounded-xl p-1">
                {PERIODS.map(({ label, days }) => (
                  <button
                    key={days}
                    onClick={() => { setSelectedPeriodDays(days); fetchSystemData(days, selectedAccount, 'preset'); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedPeriodDays === days
                        ? 'bg-white text-slate-800 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Month picker mode */}
            {periodMode === 'month' && (
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={selectedMonth}
                  max={new Date().toISOString().slice(0, 7)} // can't go beyond current month
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    fetchSystemData(selectedPeriodDays, selectedAccount, 'month', e.target.value);
                  }}
                  className="bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-600 outline-none focus:border-indigo-400 cursor-pointer"
                />
                <span className="text-xs text-slate-400">
                  {selectedMonth
                    ? new Date(selectedMonth + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })
                    : ''}
                </span>
              </div>
            )}

            {/* Custom date range mode */}
            {periodMode === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-slate-400 font-medium">From</label>
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-600 outline-none focus:border-indigo-400 cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-slate-400 font-medium">To</label>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-600 outline-none focus:border-indigo-400 cursor-pointer"
                  />
                </div>
                {customStart && customEnd && (
                  <span className="text-xs text-slate-400">
                    {Math.ceil((new Date(customEnd) - new Date(customStart)) / (1000 * 60 * 60 * 24)) + 1} days
                  </span>
                )}
                {/* Apply button for custom — only fetch when both dates are picked */}
                <button
                  onClick={() => fetchSystemData(selectedPeriodDays, selectedAccount, 'custom', selectedMonth, customStart, customEnd)}
                  disabled={!customStart || !customEnd || loadingSync}
                  className="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white text-xs font-bold transition-all"
                >
                  Apply
                </button>
              </div>
            )}

            {/* Account selector — always visible */}
            {accounts.length > 0 && (
              <select
                value={selectedAccount}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-600 outline-none focus:border-indigo-400 cursor-pointer"
              >
                <option value="all">All Accounts</option>
                {accounts.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            )}

            {/* Sync button — always visible */}
            <button
              onClick={() => fetchSystemData()}
              disabled={loadingSync}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-bold transition-all ml-auto"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${loadingSync ? 'animate-spin' : ''}`} />
              {loadingSync ? 'Syncing…' : 'Sync Now'}
            </button>

          </div>
        </div>

        {/* Error */}
        {syncError && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-300 bg-red-900/30 border border-red-700/40 rounded-xl px-3 py-2">
            <FiAlertCircle className="w-3.5 h-3.5 shrink-0" /> {syncError}
          </div>
        )}

        {/* Stats from system */}
        {systemStats && !loadingSync && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Orders',    value: fmtNum(systemStats.orderCount),    color: 'text-white' },
              { label: 'Kept Rate',       value: fmtPct(systemStats.keptRate * 100), color: 'text-emerald-400' },
              { label: 'Return Rate',     value: fmtPct(systemStats.customerReturnPct + systemStats.rtoPct), color: 'text-orange-400' },
              { label: 'Avg Settlement',  value: systemStats.avgSettlement ? fmt(systemStats.avgSettlement) : '—', color: 'text-indigo-300' },
            ].map((s, i) => (
              <div key={i} className="bg-slate-700/50 rounded-xl px-3 py-2.5">
                <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                <p className={`text-base font-extrabold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Loading skeleton */}
        {loadingSync && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-700/50 rounded-xl px-3 py-2.5 animate-pulse">
                <div className="h-3 bg-slate-600 rounded w-2/3 mb-2" />
                <div className="h-5 bg-slate-600 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-500 mt-3">
          🟢 Green fields below = auto-filled from system data · Edit any field to override manually
        </p>
      </div>

      {/* ── Assumptions ── */}
      <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-4 text-sm text-sky-800">
        <p className="font-bold mb-2">📌 Assumptions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {[
            'Bank Settlement = received only on kept orders',
            'Return %, RTO %, Wrong % = % of total orders dispatched',
            'Customer return & RTO come back → COGS not consumed',
            'Wrong return = total inventory loss (COGS consumed)',
            'RTO reverse fee = ₹0 for Flipkart (configurable)',
            'Wrong return fee = same as return fee (configurable)',
          ].map((a, i) => (
            <p key={i} className="flex items-start gap-1.5">
              <span className="mt-0.5 text-sky-400">›</span>{a}
            </p>
          ))}
        </div>
      </div>

      {/* ── Section 1: Product & Settlement ── */}
      <SectionCard title="Product & Settlement" icon={FiPackage} accent="bg-blue-50 text-blue-700">
        <InputField
          label="Bank Settlement per Kept Order"
          value={inputs.bankSettlement} onChange={set('bankSettlement')}
          synced={syncedFields.bankSettlement}
          tooltip="Net amount credited only when order is delivered & kept. Auto-filled from your settlement data ÷ kept orders."
        />
        <InputField
          label="Cost Price per Piece"
          value={inputs.costPrice} onChange={set('costPrice')}
          tooltip="Manufacturing or purchase cost per unit"
        />
        <InputField
          label="Initial Packaging Cost"
          value={inputs.packagingCost} onChange={set('packagingCost')}
          tooltip="Packing cost for every outgoing shipment (100% of orders)"
        />
        <InputField
          label="Repackaging Cost (Optional)"
          value={inputs.repackagingCost} onChange={set('repackagingCost')}
          tooltip="Cost to repack returned / RTO item before relisting. Leave 0 if not applicable."
        />
        <InputField
          label="Extra Cost per Order"
          value={inputs.extraCost} onChange={set('extraCost')}
          tooltip="Ads, inserts, QC, handling, or any other per-order cost"
        />
      </SectionCard>

      {/* ── Section 2: Returns & RTO ── */}
      <SectionCard title="Returns & RTO" icon={FiPercent} accent="bg-orange-50 text-orange-700">
        <InputField
          label="Customer Return Fee"
          value={inputs.returnFee} onChange={set('returnFee')}
          tooltip="Marketplace fee charged on customer-initiated returns"
        />
        <InputField
          label="RTO Reverse Shipping Fee"
          value={inputs.rtoFee} onChange={set('rtoFee')}
          tooltip="Fee for undelivered return. Leave 0 for Flipkart."
        />
        <InputField
          label="Customer Return %"
          value={inputs.customerReturnPct} onChange={set('customerReturnPct')}
          prefix="%" synced={syncedFields.customerReturnPct}
          tooltip={`Auto-synced from your last ${selectedPeriodDays} days of marketplace data. Item comes back sellable.`}
          step="0.1"
        />
        <InputField
          label="RTO %"
          value={inputs.rtoPct} onChange={set('rtoPct')}
          prefix="%" synced={syncedFields.rtoPct}
          tooltip={`Auto-synced from your last ${selectedPeriodDays} days. Item comes back undelivered.`}
          step="0.1"
        />
        <InputField
          label="Wrong / Damaged Return %"
          value={inputs.wrongReturnPct} onChange={set('wrongReturnPct')}
          prefix="%" synced={syncedFields.wrongReturnPct}
          tooltip={`Auto-synced from your last ${selectedPeriodDays} days. Total inventory loss — cannot resell.`}
          step="0.1"
        />
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl bg-orange-50 border border-orange-100 hover:border-orange-300 transition-colors">
            <input
              type="checkbox"
              checked={wrongReturnIncludesReturnFee}
              onChange={(e) => setWrongReturnIncludesReturnFee(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-orange-500 rounded"
            />
            <div>
              <span className="text-xs font-semibold text-slate-700">
                Charge return fee on wrong / damaged returns too
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                Uncheck if marketplace waives the fee for wrong returns.
              </p>
            </div>
          </label>
        </div>
      </SectionCard>

      {/* ── Section 3: Monthly Overhead ── */}
      <SectionCard title="Monthly Overhead" icon={FiDollarSign} accent="bg-violet-50 text-violet-700">
        <InputField
          label="Office / Godown Rent"
          value={inputs.rent} onChange={set('rent')}
          tooltip="Monthly rent"
        />
        <InputField
          label="Staff / Helper Salary"
          value={inputs.salary} onChange={set('salary')}
          tooltip="Total monthly salary for all helpers and staff"
        />
        <InputField
          label="Other Expenses"
          value={inputs.otherExpenses} onChange={set('otherExpenses')}
          tooltip="Electricity, internet, miscellaneous monthly expenses"
        />
        <InputField
          label="Avg Orders per Month"
          value={inputs.avgOrdersPerMonth} onChange={set('avgOrdersPerMonth')}
          prefix="#" synced={syncedFields.avgOrdersPerMonth}
          tooltip={`Auto-synced: your actual order volume normalised to 30 days from the last ${selectedPeriodDays}-day period.`}
          step="1"
        />
      </SectionCard>

      {/* ── Validation Alerts ── */}
      {calc.hasData && !calc.ratesValid && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          <FiAlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>
            Return % + RTO % + Wrong Return % cannot exceed 100%.
            Currently: <strong>{fmtPct(calc.totalNonKeepRate * 100)}</strong>
          </span>
        </div>
      )}
      {calc.hasData && calc.ratesValid && calc.overheadMissingOrders && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          <FiAlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>
            Monthly overhead <strong>{fmt(calc.monthlyOverhead)}</strong> entered but
            <strong> Avg Orders per Month</strong> is empty — overhead excluded until filled.
          </span>
        </div>
      )}

      {/* ── Results ── */}
      {calc.hasData && calc.ratesValid && (
        <div className="space-y-5">

          {/* View toggle */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
            {[
              { id: false, label: '💵 Cash Profit',   sub: 'Money in your bank' },
              { id: true,  label: '📦 Real Profit',   sub: 'Cash + stock in godown' },
            ].map(({ id, label, sub }) => (
              <button
                key={String(id)}
                onClick={() => setShowInventoryView(id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  showInventoryView === id
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
                <span className="block text-xs font-normal opacity-60">{sub}</span>
              </button>
            ))}
          </div>

          {/* What does this view mean — plain English */}
          <div className={`rounded-2xl px-5 py-3.5 text-sm border ${
            !showInventoryView
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-violet-50 border-violet-200 text-violet-800'
          }`}>
            {!showInventoryView ? (
              <p>
                💵 <strong>Cash Profit</strong> — actual money received in your bank minus everything you spent.
                Returned &amp; RTO pants are <strong>not counted</strong> here — they're sitting in your godown, not yet cash.
              </p>
            ) : (
              <p>
                📦 <strong>Real Profit</strong> — cash profit <strong>plus</strong> the value of pants that came back to your godown.
                Those returned pants are a real asset — they'll become cash when you sell them again.
              </p>
            )}
          </div>

          {/* Main result banner */}
          {!showInventoryView ? (
            /* ── CASH PROFIT VIEW ── */
            <div className={`rounded-2xl p-6 text-white shadow-lg ${
              calc.isCashProfit
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                : 'bg-gradient-to-br from-rose-500 to-red-600'
            }`}>
              <div className="flex items-start justify-between flex-wrap gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-75 mb-1">
                    {calc.isCashProfit ? '✅ Cash Profit per Order' : '❌ Cash Loss per Order'}
                  </p>
                  <p className="text-5xl font-extrabold tracking-tight">{fmt(calc.cashProfitPerOrder)}</p>
                  <p className="text-sm opacity-75 mt-2">
                    You receive {fmt(calc.moneyIn)} · You spend {fmt(calc.totalMoneyOut)} · per order sent
                  </p>
                  <p className="text-xs opacity-60 mt-1">
                    Cash margin: {fmtPct(calc.cashMarginPct)} · Break-even settlement: {fmt(calc.breakEvenSettlement)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-75 mb-1">Monthly Cash</p>
                  {calc.monthlyCashProfit !== null
                    ? <p className="text-3xl font-extrabold">{fmt(calc.monthlyCashProfit)}</p>
                    : <p className="text-sm opacity-60 italic mt-1">Enter avg orders/month ↑</p>}
                  {calc.keptOrdersPerMonth !== null && (
                    <p className="text-xs opacity-60 mt-1">
                      {fmtNum(Math.round(calc.keptOrdersPerMonth))} orders kept · {fmtNum(Math.round(calc.returnedPantsPerMonth || 0))} pants back in godown
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ── REAL PROFIT VIEW ── */
            <div className="rounded-2xl overflow-hidden shadow-lg border border-violet-200">
              <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-6 text-white">
                <p className="text-xs font-bold uppercase tracking-widest opacity-75 mb-1">
                  {calc.isRealProfit ? '✅ Real Profit per Order' : '❌ Real Loss per Order'}
                </p>
                <div className="flex items-start justify-between flex-wrap gap-5">
                  <div>
                    <p className="text-5xl font-extrabold tracking-tight">{fmt(calc.realProfitPerOrder)}</p>
                    <p className="text-sm opacity-75 mt-2">Cash profit + returned pants value</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-widest opacity-75 mb-1">Monthly Real</p>
                    {calc.monthlyRealProfit !== null
                      ? <p className="text-3xl font-extrabold">{fmt(calc.monthlyRealProfit)}</p>
                      : <p className="text-sm opacity-60 italic mt-1">Enter avg orders/month ↑</p>}
                  </div>
                </div>
              </div>
              {/* Breakdown of real profit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-white">
                <div className="p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                    💵 Cash part
                  </p>
                  <p className={`text-2xl font-extrabold ${calc.isCashProfit ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {fmt(calc.cashProfitPerOrder)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Actual money received minus all expenses</p>
                  {calc.monthlyCashProfit !== null && (
                    <p className="text-sm font-bold text-slate-600 mt-2">
                      Monthly: {fmt(calc.monthlyCashProfit)}
                    </p>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                    📦 Stock in godown
                  </p>
                  <p className="text-2xl font-extrabold text-indigo-600">
                    {fmt(calc.inventoryRecovered)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {fmtPct(calc.sellableReturnRate * 100)} returned pants × ₹{calc.costPrice} cost — ready to resell
                  </p>
                  {calc.monthlyInventoryRecovered !== null && (
                    <>
                      <p className="text-sm font-bold text-slate-600 mt-2">
                        Monthly: {fmt(calc.monthlyInventoryRecovered)}
                      </p>
                      {calc.returnedPantsPerMonth !== null && (
                        <p className="text-xs text-indigo-400 mt-1">
                          ≈ {fmtNum(Math.round(calc.returnedPantsPerMonth))} pants back in godown/month
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="bg-amber-50 border-t border-amber-100 px-5 py-3 text-xs text-amber-700 flex items-start gap-2">
                <FiAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Godown stock is a <strong>real asset</strong>, not cash yet.
                  It becomes cash profit in the <strong>next selling cycle</strong> when those pants are resold.
                </span>
              </div>
            </div>
          )}

          {/* ── Key numbers ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label="Kept Order Rate"
              value={fmtPct(calc.keptRate * 100)}
              sub={`${fmtNum(calc.keptOrdersPerMonth !== null ? Math.round(calc.keptOrdersPerMonth) : 0)} orders kept/month`}
            />
            <StatTile
              label="Cash Profit per Kept Sale"
              value={calc.effectiveProfitPerKept !== null ? fmt(calc.effectiveProfitPerKept) : '—'}
              sub="After absorbing all return costs"
            />
            <StatTile
              label="You Need This Settlement"
              value={fmt(calc.breakEvenSettlement)}
              sub="Minimum per kept order to not lose cash"
              accent="bg-yellow-50 border-yellow-200"
              textColor="text-yellow-700"
            />
          </div>

          {/* ── Full money flow breakdown ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50">
              <FiActivity className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-700">Where Does Your Money Go? (per order sent)</h3>
            </div>

            {/* MONEY IN */}
            <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-2">💰 Money You Receive</p>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Bank Settlement ({fmtPct(calc.keptRate * 100)} of orders kept × {fmt(calc.bankSettlement)})
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Only delivered &amp; kept orders generate settlement
                  </p>
                </div>
                <span className="text-sm font-bold text-emerald-600">+ {fmt(calc.moneyIn)}</span>
              </div>
            </div>

            {/* MONEY OUT — breakdown */}
            <div className="px-5 py-3 bg-rose-50 border-b border-rose-100">
              <p className="text-xs font-bold text-rose-500 uppercase tracking-wide mb-3">💸 Money You Spend</p>
              <div className="space-y-2.5">
                {[
                  {
                    label: `Pants cost consumed`,
                    sub  : `(${fmtPct(calc.keptRate * 100)} kept + ${fmtPct(calc.lostReturnRate * 100)} wrong returns) × ${fmt(calc.costPrice)} — returned & RTO pants cost comes back with the pants`,
                    value: calc.cogsConsumed,
                    show : true,
                  },
                  {
                    label: `Packaging (every order)`,
                    sub  : `You pack and ship every order regardless of outcome`,
                    value: calc.packagingTotal,
                    show : calc.packagingTotal > 0,
                  },
                  {
                    label: `Repackaging returned pants`,
                    sub  : `${fmtPct(calc.sellableReturnRate * 100)} returned × ${fmt(calc.repackagingCost)} to repack before relisting`,
                    value: calc.repackagingTotal,
                    show : calc.repackagingTotal > 0,
                  },
                  {
                    label: `Return & RTO fees`,
                    sub  : (() => {
                      const p = [];
                      if (calc.customerReturnRate > 0) p.push(`${fmtPct(calc.customerReturnRate * 100)} × ${fmt(calc.returnFee)}`);
                      if (calc.rtoRate > 0 && calc.rtoFee > 0) p.push(`RTO ${fmtPct(calc.rtoRate * 100)} × ${fmt(calc.rtoFee)}`);
                      if (calc.wrongReturnRate > 0 && wrongReturnIncludesReturnFee) p.push(`wrong ${fmtPct(calc.wrongReturnRate * 100)} × ${fmt(calc.returnFee)}`);
                      return p.join('  +  ') || '—';
                    })(),
                    value: calc.returnFeeTotal,
                    show : calc.returnFeeTotal > 0,
                  },
                  {
                    label: `Extra costs (ads, QC, etc.)`,
                    sub  : `Per order`,
                    value: calc.extraCost,
                    show : calc.extraCost > 0,
                  },
                  {
                    label: `Overhead per order`,
                    sub  : `${fmt(calc.monthlyOverhead)}/month ÷ ${fmtNum(calc.avgOrders)} orders`,
                    value: calc.overheadPerOrder,
                    show : calc.overheadPerOrder > 0,
                  },
                ].filter(r => r.show).map((row, i) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">{row.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{row.sub}</p>
                    </div>
                    <span className="text-sm font-bold text-rose-500 whitespace-nowrap">− {fmt(row.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total out */}
            <div className="flex justify-between px-5 py-3 bg-rose-50 border-b border-rose-200">
              <p className="text-sm font-bold text-slate-700">Total Money Spent per Order</p>
              <span className="text-sm font-extrabold text-rose-600">− {fmt(calc.totalMoneyOut)}</span>
            </div>

            {/* Cash profit line */}
            <div className={`flex justify-between px-5 py-4 border-b ${
              calc.isCashProfit ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
            }`}>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {calc.isCashProfit ? '✅ Cash Profit per Order' : '❌ Cash Loss per Order'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Money received − money spent</p>
              </div>
              <span className={`text-base font-extrabold ${calc.isCashProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                {fmt(calc.cashProfitPerOrder)}
              </span>
            </div>

            {/* Inventory recovered line */}
            <div className="flex justify-between px-5 py-4 bg-indigo-50 border-b border-indigo-100">
              <div>
                <p className="text-sm font-bold text-slate-800">📦 Pants back in your godown</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {fmtPct(calc.sellableReturnRate * 100)} returned &amp; RTO pants × {fmt(calc.costPrice)} — asset, not cash yet
                </p>
              </div>
              <span className="text-base font-extrabold text-indigo-600">+ {fmt(calc.inventoryRecovered)}</span>
            </div>

            {/* Real profit line */}
            <div className={`flex justify-between px-5 py-4 ${
              calc.isRealProfit ? 'bg-violet-50' : 'bg-rose-50'
            }`}>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {calc.isRealProfit ? '✅ Real Profit per Order' : '❌ Real Loss per Order'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Cash profit + godown stock value</p>
              </div>
              <span className={`text-base font-extrabold ${calc.isRealProfit ? 'text-violet-600' : 'text-rose-600'}`}>
                {fmt(calc.realProfitPerOrder)}
              </span>
            </div>
          </div>

          {/* ── Monthly summary ── */}
          {calc.avgOrders > 0 && (
            <div className="bg-slate-800 text-white rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                Monthly Picture — {fmtNum(calc.avgOrders)} Orders Sent
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Orders Kept',       value: fmtNum(Math.round(calc.keptOrdersPerMonth || 0)),    color: 'text-emerald-400' },
                  { label: 'Pants to Godown',   value: fmtNum(Math.round(calc.returnedPantsPerMonth || 0)), color: 'text-indigo-400' },
                  { label: 'Pants Lost Forever',value: fmtNum(Math.round(calc.lostPantsPerMonth || 0)),     color: 'text-rose-400' },
                  { label: 'Cash Profit',        value: fmt(calc.monthlyCashProfit || 0),                   color: calc.isCashProfit ? 'text-emerald-400' : 'text-rose-400' },
                ].map((item, i) => (
                  <div key={i}>
                    <p className="text-xs text-slate-500 font-medium">{item.label}</p>
                    <p className={`text-lg font-extrabold mt-1 ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              {calc.monthlyRealProfit !== null && (
                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Monthly Real Profit (cash + godown stock)</p>
                    <p className="text-xs text-slate-500 mt-0.5">Includes {fmt(calc.monthlyInventoryRecovered || 0)} worth of pants back in your godown</p>
                  </div>
                  <p className={`text-2xl font-extrabold ${calc.isRealProfit ? 'text-violet-400' : 'text-rose-400'}`}>
                    {fmt(calc.monthlyRealProfit)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Lost pants warning ── */}
          {calc.lostReturnRate > 0 && (
            <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-700">
              <FiAlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>
                <strong>{fmtPct(calc.lostReturnRate * 100)}</strong> of your orders result in wrong/damaged returns —
                those pants are <strong>gone forever</strong> (cost: {fmt(calc.lostReturnRate * calc.costPrice)} per order).
                {calc.lostPantsPerMonth !== null && (
                  <> That's <strong>{fmtNum(Math.round(calc.lostPantsPerMonth))} pants lost per month.</strong></>
                )}
              </span>
            </div>
          )}

        </div>
      )}

      {/* Empty state */}
      {!calc.hasData && (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <FiTrendingUp className="w-12 h-12 mx-auto text-slate-200 mb-4" />
          <p className="text-base font-semibold text-slate-400">Enter Cost Price to see your profit</p>
          <p className="text-sm text-slate-300 mt-1">
            Return rates &amp; orders are already synced from your system ↑
          </p>
        </div>
      )}
    </div>
  );
};

export default MarketplaceProfitCalculator;