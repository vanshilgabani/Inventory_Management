import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay ,startOfMonth, endOfMonth } from 'date-fns';
import {
  FiArrowRight, FiPackage, FiTrendingUp,
  FiAlertCircle, FiLayers,
  FiShoppingCart, FiShoppingBag, FiDollarSign
} from 'react-icons/fi';

import { useAuth }         from '../context/AuthContext';
import { useEnabledSizes } from '../hooks/useEnabledSizes';

import { settingsService } from '../services/settingsService';
import { inventoryService }   from '../services/inventoryService';
import { salesService }       from '../services/salesService';
import { wholesaleService }   from '../services/wholesaleService';
import { directSalesService } from '../services/directSalesService';
import { settlementService }  from '../services/settlementService';
import { factoryService }     from '../services/factoryService';
import { analyticsService }   from '../services/analyticsService';

import Loader     from '../components/common/Loader';
import Modal      from '../components/common/Modal';
import Card       from '../components/common/Card';
import ScrollToTop from '../components/common/ScrollToTop';
import MarketplaceProfitCalculator from '../components/MarketplaceProfitCalculator';

import StatCard               from '../components/dashboard/StatCard';
import TodaySummary           from '../components/dashboard/TodaySummary';
import TopSellersCard         from '../components/dashboard/TopSellersCard';
import AccountPerformanceCard from '../components/dashboard/AccountPerformanceCard';
import SellThroughDohCard     from '../components/dashboard/SellThroughDohCard';
import ReorderPlannerCard     from '../components/dashboard/ReorderPlannerCard';
import FactoryReceivingCard   from '../components/dashboard/FactoryReceivingCard';

// safely extract array from any API response shape
const toArray = (res, ...keys) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  for (const k of keys) { if (Array.isArray(res[k])) return res[k]; }
  return [];
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { enabledSizes, loading: sizesLoading } = useEnabledSizes();

  const [loading, setLoading]             = useState(true);
  const [products, setProducts]           = useState([]);
  const [marketplaceSales, setMarketSales]= useState([]);
  const [wholesaleOrders, setWholesale]   = useState([]);
  const [directSales, setDirect]          = useState([]);
  const [factoryReceivings, setFactory]   = useState([]);
  const [settlements, setSettlements]     = useState([]);

  const [topSellersWD7d,  setTopSellersWD7d]  = useState([]);
  const [topSellersWD30d, setTopSellersWD30d] = useState([]);

  const [accountStats, setAccountStats]   = useState([]);
  const [topSellers7d, setTopSellers7d]   = useState([]);
  const [topSellers30d, setTopSellers30d] = useState([]);
  const [sellThroughData, setSTR]         = useState([]);
  const [dohData, setDoh]                 = useState({ marketplace: [], wd: [] });
  const [todayMarketSummary, setTodayMarketSummary] = useState({ accountMap: {}, totals: {} });
  const [reorderItemsMS, setReorderItemsMS] = useState([]);
  const [reorderItemsWD, setReorderItemsWD] = useState([]);

  const [topSellersMode, setTopSellersMode]       = useState('marketplace');
  const [topSellersPeriod, setTopSellersPeriod]   = useState('7d');
  const [analyticsMode, setAnalyticsMode]         = useState('str');
  const [dohMode, setDohMode]                     = useState('marketplace');
  const [inventoryMode,    setInventoryMode]    = useState('reserved');

  useEffect(() => { fetchData(); }, []);

  // ✅ REPLACE your existing fetchReorderData with this
  const fetchReorderData = async (mode) => {
    try {
      const [msRes, wdRes] = await Promise.allSettled([
        analyticsService.getReorderPlannerData({ channel: 'marketplace', inventoryMode: mode }),
        analyticsService.getReorderPlannerData({ channel: 'wd',          inventoryMode: mode }),
      ]);
      if (msRes.status === 'fulfilled') setReorderItemsMS(toArray(msRes.value, 'data'));
      if (wdRes.status === 'fulfilled') setReorderItemsWD(toArray(wdRes.value, 'data'));
    } catch (err) {
      console.error('Reorder fetch error:', err);
    }
  };

  const fetchData = async () => {
    try {
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const monthEnd   = format(endOfMonth(new Date()),   'yyyy-MM-dd');

      const [
        productsRes,           // 1
        salesRes,              // 2
        wholesaleRes,          // 3
        settlementsRes,        // 4
        todayMarketSummaryRes, // 5
        directRes,             // 6
        factoryRes,            // 7
        accountStatsRes,       // 8
        topSellers7dRes,       // 9
        topSellers30dRes,      // 10
        topSellersWD7dRes,     // 11
        topSellersWD30dRes,    // 12
        strRes,                // 13
        settingsRes,
      ] = await Promise.allSettled([
        inventoryService.getAllProducts(),                                    // 1
        salesService.getAllSales('all', 'all',
          format(new Date(), 'yyyy-MM-dd'),
          format(new Date(), 'yyyy-MM-dd'), 1, 200, ''),
        wholesaleService.getAllOrders('all=true'),                            // 3
        settlementService.getAllSettlements('all'),                           // 4
        analyticsService.getTodayMarketplaceSummary(),                       // 5
        directSalesService.getAllDirectSales(),                               // 6
        factoryService.getAllReceivings(),                                    // 7
        analyticsService.getMarketplaceAccountStats({                        // 8 ✅ current month
          startDate: monthStart, endDate: monthEnd,
        }),
        analyticsService.getBestSellingMarketplaceProducts({                 // 9
          startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
        }),
        analyticsService.getBestSellingMarketplaceProducts({                 // 10
          startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        }),
        analyticsService.getBestSellingWDProducts({                          // 11 ✅ W&D 7d
          startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
        }),
        analyticsService.getBestSellingWDProducts({                          // 12 ✅ W&D 30d
          startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        }),
        analyticsService.getStockTurnoverRate({
          startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
          endDate:   format(new Date(), 'yyyy-MM-dd'),
        }),
        settingsService.getTenantSettings(), 
      ]);

      if (productsRes.status === 'fulfilled')
        setProducts(toArray(productsRes.value, 'products', 'data'));

      if (salesRes.status === 'fulfilled')
        setMarketSales(toArray(salesRes.value, 'data', 'orders'));

      if (wholesaleRes.status === 'fulfilled')
        setWholesale(toArray(wholesaleRes.value, 'orders', 'data'));

      if (settlementsRes.status === 'fulfilled')
        setSettlements(toArray(settlementsRes.value, 'data', 'settlements'));

      if (todayMarketSummaryRes.status === 'fulfilled')
        setTodayMarketSummary(todayMarketSummaryRes.value?.data || { accountMap: {}, totals: {} });

      if (directRes.status === 'fulfilled')
        setDirect(toArray(directRes.value, 'data', 'sales'));

      if (factoryRes.status === 'fulfilled')
        setFactory(toArray(factoryRes.value, 'data', 'receivings'));

      if (accountStatsRes.status === 'fulfilled')
        setAccountStats(toArray(accountStatsRes.value, 'data', 'accounts'));

      let resolvedMode = 'reserved';
      if (settingsRes.status === 'fulfilled') {
        const raw = settingsRes.value;
        resolvedMode = raw?.data?.inventoryMode || raw?.inventoryMode || 'reserved';
        setInventoryMode(resolvedMode);
      }

      // ✅ Call immediately with the resolved mode — don't wait for state update
      await fetchReorderData(resolvedMode);

      const normaliseTopSellers = (res) =>
        toArray(res, 'data').map(i => [
          `${i.design}${i.color ? ' · ' + i.color : ''}${i.size ? ' · ' + i.size : ''}`,
          Number(i.totalQuantity || 0),
        ]);

      if (topSellers7dRes.status  === 'fulfilled') setTopSellers7d(normaliseTopSellers(topSellers7dRes.value));
      if (topSellers30dRes.status === 'fulfilled') setTopSellers30d(normaliseTopSellers(topSellers30dRes.value));
      if (topSellersWD7dRes.status  === 'fulfilled') setTopSellersWD7d(normaliseTopSellers(topSellersWD7dRes.value));
      if (topSellersWD30dRes.status === 'fulfilled') setTopSellersWD30d(normaliseTopSellers(topSellersWD30dRes.value));

      // ✅ STR + DOH — both from getStockTurnoverRate
      if (strRes.status === 'fulfilled') {
        const raw = toArray(strRes.value, 'data', 'designs');

        // STR — group by design, average turnoverRate
        const strMap = {};
        raw.forEach(i => {
          const d = i.design || 'Item';
          if (!strMap[d]) strMap[d] = { design: d, total: 0, count: 0 };
          strMap[d].total += Number(i.turnoverRate || 0);
          strMap[d].count += 1;
        });
        setSTR(
          Object.values(strMap)
            .map(d => ({ design: d.design, rate: +(d.total / d.count).toFixed(2) }))
            .sort((a, b) => b.rate - a.rate)
            .slice(0, 10)
        );

        // DOH — group by design, take minimum daysToSell (most urgent variant)
        const dohMap = {};
        raw.forEach(i => {
          const d    = i.design || 'Item';
          const days = Number(i.daysToSell || 0);
          if (days > 0) {
            if (!dohMap[d] || days < dohMap[d]) dohMap[d] = days;
          }
        });
        const dohList = Object.entries(dohMap)
          .map(([label, doh]) => ({ label, doh }))
          .sort((a, b) => a.doh - b.doh)
          .slice(0, 10);
        setDoh({ marketplace: dohList, wd: [] });
      }

    } catch (err) {
      console.error('Dashboard fetchData error:', err);
    } finally {
      setLoading(false);
    }
  };

  const flatInventory = useMemo(() => {
    const list = [];
    products.forEach(p =>
      p.colors?.forEach(c =>
        c.sizes?.forEach(s => {
          if (!enabledSizes.includes(s.size)) return;
          list.push({
            design:         p.design,
            color:          c.color,
            size:           s.size,
            stock:          Number(s.currentStock   || 0),
            reserved:       Number(s.reservedStock  || 0),
            reorderPoint:   Number(s.reorderPoint   || 10),
            wholesalePrice: Number(c.wholesalePrice || 0),
          });
        })
      )
    );
    return list;
  }, [products, enabledSizes]);

  // ✅ Separate useMemo — same as old working dashboard
const topUnpaidBuyers = useMemo(() => {
  if (!Array.isArray(wholesaleOrders)) return [];
  const buyerDues = {};
  wholesaleOrders.forEach(order => {
    const due = Number(order.amountDue || 0);
    if (due > 0) {
      const name = order.businessName || order.buyerName || 'Unknown';
      if (!buyerDues[name]) buyerDues[name] = 0;
      buyerDues[name] += due;
    }
  });
  return Object.entries(buyerDues)
    .map(([name, totalDue]) => ({ name, totalDue }))
    .sort((a, b) => b.totalDue - a.totalDue)
    .slice(0, 3);
}, [wholesaleOrders]);

  const totals = useMemo(() => {
    const totalStock    = flatInventory.reduce((s, i) => s + i.stock,    0);
    const reservedStock = flatInventory.reduce((s, i) => s + i.reserved, 0);
    const totalValue    = flatInventory.reduce((s, i) => s + i.stock    * i.wholesalePrice, 0);
    const reservedValue = flatInventory.reduce((s, i) => s + i.reserved * i.wholesalePrice, 0);

    const pendingPayment = wholesaleOrders.reduce((s, o) => s + Number(o.amountDue || 0), 0);

    const mktTotal = settlements.reduce((s, o) => s + Number(o.settlementAmount || 0), 0);
    const wsTotal  = wholesaleOrders.reduce( (s, o) => s + Number(o.totalAmount || 0), 0);
    const dirTotal = directSales.reduce(    (s, o) => s + Number(o.totalAmount || 0), 0);

    return {
      totalStock, reservedStock, totalValue, reservedValue,
      pendingPayment,       mktTotal, wsTotal, dirTotal,
      totalSales: mktTotal + wsTotal + dirTotal,
    };
  }, [flatInventory, marketplaceSales, wholesaleOrders, directSales, settlements]);

const todayStats = useMemo(() => {
  const start  = startOfDay(new Date());
  const end    = endOfDay(new Date());
  const isToday = (d) => d >= start && d <= end;

  const RETURN_STATUSES = ['returned', 'rto', 'wrongreturn'];

  const msToday = marketplaceSales.filter(o => {
    const saleDate  = new Date(o.saleDate  || o.createdAt);
    const updatedAt = new Date(o.updatedAt || o.saleDate);
    const status    = String(o.status || '').toLowerCase();

    if (isToday(saleDate)) return true;
    if (RETURN_STATUSES.includes(status) && isToday(updatedAt)) return true;
    return false;
  });

  const inToday = (arr, field) =>
    arr.filter(o => { const d = new Date(o[field] || o.createdAt); return isToday(d); });

  return {
    ms: msToday,
    ws: inToday(wholesaleOrders, 'createdAt'),
    ds: inToday(directSales,     'createdAt'),
  };
}, [marketplaceSales, wholesaleOrders, directSales]);

  const topSellersData = useMemo(() => ({
    marketplace: { '7d': topSellers7d,   '30d': topSellers30d   },
    wd:          { '7d': topSellersWD7d, '30d': topSellersWD30d },
  }), [topSellers7d, topSellers30d, topSellersWD7d, topSellersWD30d]);

  const recentActivity = useMemo(() => {
    const items = [];
    todayStats.ws.slice(0, 3).forEach(o => items.push({
      title: o.businessName || o.buyerName || 'Wholesale',
      desc:  `${o.items?.reduce((a, b) => a + Number(b.quantity || 0), 0) || 0} pcs · ₹${Number(o.totalAmount || 0).toLocaleString('en-IN')}`,
      date:  new Date(o.createdAt), link: '/wholesale',
      icon: FiShoppingCart, color: 'text-purple-600 bg-purple-50',
    }));
    todayStats.ms.slice(0, 3).forEach(s => items.push({
      title: s.accountName || 'Marketplace',
      desc:  `${s.design || ''} · ${s.quantity || 0} pcs · ${s.status || ''}`,
      date:  new Date(s.saleDate || s.createdAt), link: '/sales',
      icon: FiShoppingBag, color: 'text-blue-600 bg-blue-50',
    }));
    todayStats.ds.slice(0, 3).forEach(o => items.push({
      title: o.customerName || 'Direct Sale',
      desc:  `${o.items?.reduce((a, b) => a + Number(b.quantity || 0), 0) || 0} pcs · ₹${Number(o.totalAmount || 0).toLocaleString('en-IN')}`,
      date:  new Date(o.createdAt), link: '/direct-sales',
      icon: FiDollarSign, color: 'text-teal-600 bg-teal-50',
    }));
    return items.sort((a, b) => b.date - a.date).slice(0, 6);
  }, [todayStats]);

  if (loading || sizesLoading) return <Loader />;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Command Center</h1>
          <p className="text-gray-500 text-sm">Real-time business overview</p>
        </div>
        <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border shadow-sm">
          {format(new Date(), 'dd MMM yyyy, EEEE')}
        </div>
      </div>

      {/* Row 1 — Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Total Sales"
          value={`₹ ${totals.totalSales.toLocaleString('en-IN')}`}
          icon={FiTrendingUp}
          hoverLabel="Channel Breakdown"
          hoverItems={[
            ['Marketplace', `₹${totals.mktTotal.toLocaleString('en-IN')}`],
            ['Wholesale',   `₹${totals.wsTotal.toLocaleString('en-IN')}`],
            ['Direct',      `₹${totals.dirTotal.toLocaleString('en-IN')}`],
          ]}
          accent="indigo"
        />
        <StatCard
          title="Pending Payment"
          value={`₹ ${totals.pendingPayment.toLocaleString('en-IN')}`}
          icon={FiAlertCircle}
          hoverLabel="Top Buyer Dues"
          hoverItems={
            topUnpaidBuyers.length > 0
              ? topUnpaidBuyers.map(b => [b.name, `₹${b.totalDue.toLocaleString('en-IN')}`])
              : [['No pending dues', '—']]
          }
          accent="orange"
        />
        <StatCard
          title="Total Stock"
          value={`${totals.totalStock.toLocaleString('en-IN')} pcs`}
          icon={FiPackage}
          hoverTitle="Reserved Stock"
          hoverValue={`${totals.reservedStock.toLocaleString('en-IN')} pcs`}
          accent="blue"
        />

        <StatCard
          title="Inv. Value"
          value={`₹ ${totals.totalValue.toLocaleString('en-IN')}`}
          icon={FiLayers}
          hoverTitle="Reserved Inv. Value"
          hoverValue={`₹ ${totals.reservedValue.toLocaleString('en-IN')}`}
          accent="purple"
        />
      </div>

      {/* Row 2 — Today Summary */}
      <TodaySummary todayStats={todayStats} settlements={settlements} todayMarketSummary={todayMarketSummary} />

      {/* Row 3 — Top Sellers | Account Performance + STR/DOH stacked */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 items-start">

        {/* LEFT — Top Sellers (full height) */}
        <div className="xl:col-span-2">
          <TopSellersCard
            topSellersData={topSellersData}
            mode={topSellersMode}
            period={topSellersPeriod}
            onModeChange={setTopSellersMode}
            onPeriodChange={setTopSellersPeriod}
          />
        </div>

        {/* RIGHT — Account Performance + STR/DOH stacked */}
        <div className="xl:col-span-3 flex flex-col gap-3">
          <AccountPerformanceCard accountStats={accountStats} />
          <SellThroughDohCard
            sellThroughData={sellThroughData}
            dohData={dohData}
            mode={analyticsMode}
            dohMode={dohMode}
            onModeChange={setAnalyticsMode}
            onDohModeChange={setDohMode}
          />
        </div>

      </div>

      {/* Row 4 — Reorder + Factory */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <ReorderPlannerCard
            reorderItemsMS={reorderItemsMS}
            reorderItemsWD={reorderItemsWD}
            inventoryMode={inventoryMode}
          />
        </div>
        <FactoryReceivingCard factoryReceivings={factoryReceivings} />
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">Recent Activity</h3>
            <span className="text-xs text-gray-400">Today only</span>
          </div>
          <div className="space-y-2">
            {recentActivity.map((a, i) => (
              <div
                key={i}
                onClick={() => navigate(a.link)}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${a.color}`}>
                  <a.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                  <p className="text-xs text-gray-500 truncate">{a.desc}</p>
                </div>
                <FiArrowRight className="text-gray-300 flex-shrink-0" />
              </div>
            ))}
          </div>
        </Card>
      )}

      <ScrollToTop />
      <MarketplaceProfitCalculator />
    </div>
  );
};

export default Dashboard;
