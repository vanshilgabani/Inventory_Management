import { useState } from 'react';
import Card from '../common/Card';
import { FiShoppingCart, FiDollarSign } from 'react-icons/fi';
import { startOfDay, endOfDay } from 'date-fns';

const TABS = [
  { id: 'overall',     label: 'Overall'     },
  { id: 'wholesale',   label: 'Wholesale'   },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'direct',      label: 'Direct'      },
];

const paymentBadge = (status = '') => {
  const s = String(status).toLowerCase();
  if (s === 'paid')    return 'bg-green-100 text-green-700';
  if (s === 'partial') return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-600';
};

const TodaySummary = ({
  todayStats,
  settlements = [],
  todayMarketSummary = { accountMap: {}, totals: {} },
}) => {
  const [activeTab, setActiveTab] = useState('overall');

  const ms = todayStats?.ms || [];
  const ws = todayStats?.ws || [];
  const ds = todayStats?.ds || [];

  const wsRevenue = ws.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
  const dsRevenue = ds.reduce((s, o) => s + Number(o.totalAmount || 0), 0);

  // ── Today's settlements ──
  const start   = startOfDay(new Date());
  const end     = endOfDay(new Date());
  const isToday = (d) => d >= start && d <= end;

  const todaySettlements = settlements.filter(s =>
    isToday(new Date(s.settlementDate || s.createdAt))
  );

  const settlementByAccount = {};
  todaySettlements.forEach(s => {
    const acc = s.accountName || 'Unknown';
    settlementByAccount[acc] = (settlementByAccount[acc] || 0) + Number(s.settlementAmount || 0);
  });

  const totalSettlementToday = Object.values(settlementByAccount).reduce((a, b) => a + b, 0);

  // ── Today marketplace counts from backend (accurate) ──
  const { accountMap: msAccountMap, totals: msTotals } = todayMarketSummary;
  const dispatched  = msTotals?.dispatched  || 0;
  const returned    = msTotals?.returned    || 0;
  const rto         = msTotals?.rto         || 0;
  const wrongReturn = msTotals?.wrongReturn || 0;

  // ── Merge account names from counts + settlements ──
  const allAccounts = [...new Set([
    ...Object.keys(msAccountMap || {}),
    ...Object.keys(settlementByAccount),
  ])];

  return (
    <Card className="p-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-indigo-500 rounded-full" />
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">What Happened Today</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-semibold border border-green-100">
            ● Live
          </span>
        </div>
        <div className="bg-gray-100 rounded-lg p-0.5 flex gap-0.5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERALL ── */}
      {activeTab === 'overall' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-indigo-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-500 font-semibold uppercase">Total Revenue</p>
            <p className="text-2xl font-extrabold text-indigo-600 mt-1">
              ₹{(totalSettlementToday + wsRevenue + dsRevenue).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-500 font-semibold uppercase">Marketplace</p>
            <p className="text-2xl font-extrabold text-blue-600 mt-1">
              ₹{totalSettlementToday.toLocaleString('en-IN')}
            </p>
            <p className="text-[9px] text-black mt-0.5">
              {dispatched} disp · {returned + rto + wrongReturn} returned
            </p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-500 font-semibold uppercase">Wholesale</p>
            <p className="text-2xl font-extrabold text-purple-600 mt-1">
              ₹{wsRevenue.toLocaleString('en-IN')}
            </p>
            <p className="text-[9px] text-gray-400 mt-0.5">{ws.length} orders</p>
          </div>
          <div className="bg-teal-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-500 font-semibold uppercase">Direct</p>
            <p className="text-2xl font-extrabold text-teal-600 mt-1">
              ₹{dsRevenue.toLocaleString('en-IN')}
            </p>
            <p className="text-[9px] text-gray-400 mt-0.5">{ds.length} orders</p>
          </div>
        </div>
      )}

      {/* ── WHOLESALE ── */}
      {activeTab === 'wholesale' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <FiShoppingCart className="w-3 h-3" /> {ws.length} orders today
            </p>
            <span className="text-[10px] px-2 py-1 rounded-full bg-purple-50 text-purple-600 font-semibold">
              ₹{wsRevenue.toLocaleString('en-IN')}
            </span>
          </div>
          {ws.length === 0
            ? <p className="text-center text-gray-400 text-sm py-6">No wholesale orders today</p>
            : (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {ws.map((o, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-purple-50 rounded-xl border border-purple-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center text-purple-700 font-bold text-xs flex-shrink-0">
                        {(o.businessName || o.buyerName || 'B').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-800">
                          {o.businessName || o.buyerName || 'Buyer'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {o.items?.reduce((a, b) => a + Number(b.quantity || 0), 0) || 0} pcs
                          {/* · {o.items?.length || 0} designs */}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-800">
                        ₹{Number(o.totalAmount || 0).toLocaleString('en-IN')}
                      </p>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${paymentBadge(o.paymentStatus)}`}>
                        {o.paymentStatus || 'Unpaid'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* ── MARKETPLACE ── */}
      {activeTab === 'marketplace' && (
        <div>
          {/* 4 KPI tiles */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="bg-green-50 rounded-xl p-2.5 text-center border border-green-100">
              <p className="text-xl font-extrabold text-green-700">{dispatched}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Dispatched</p>
            </div>
            <div className="bg-red-50 rounded-xl p-2.5 text-center border border-red-100">
              <p className="text-xl font-extrabold text-red-600">{returned}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Returned</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-2.5 text-center border border-orange-100">
              <p className="text-xl font-extrabold text-orange-600">{rto}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">RTO</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-2.5 text-center border border-yellow-100">
              <p className="text-xl font-extrabold text-yellow-600">{wrongReturn}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Wrong Returns</p>
            </div>
          </div>

          {/* Per-account table */}
          {allAccounts.length === 0
            ? <p className="text-center text-gray-400 text-sm py-4">No marketplace activity today</p>
            : (
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left px-3 py-2 text-gray-500">Account</th>
                      <th className="text-center px-2 py-2 text-green-600">Dispatched</th>
                      <th className="text-center px-2 py-2 text-red-500">Returned</th>
                      <th className="text-center px-2 py-2 text-orange-500">RTO</th>
                      <th className="text-center px-2 py-2 text-yellow-600">Wrong Returns</th>
                      <th className="text-right px-3 py-2 text-blue-600">Settlement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allAccounts.map((acc, i) => {
                      const data    = (msAccountMap || {})[acc] || {};
                      const settled = settlementByAccount[acc] || 0;
                      return (
                        <tr key={i} className="border-t hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2 font-semibold text-gray-800">{acc}</td>
                          <td className="px-2 py-2 text-center text-green-700 font-bold">{data.dispatched  || 0}</td>
                          <td className="px-2 py-2 text-center text-red-500 font-bold">{data.returned    || 0}</td>
                          <td className="px-2 py-2 text-center text-orange-500 font-bold">{data.rto         || 0}</td>
                          <td className="px-2 py-2 text-center text-yellow-600 font-bold">{data.wrongReturn || 0}</td>
                          <td className={`px-3 py-2 text-right font-bold ${settled > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                            {settled > 0 ? `₹${settled.toLocaleString('en-IN')}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="px-3 py-1.5 font-bold text-gray-900">Total</td>
                      <td className="px-2 py-1.5 text-center font-bold text-gray-900">{dispatched}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-gray-900">{returned}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-gray-900">{rto}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-gray-900">{wrongReturn}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-blue-600">
                        {totalSettlementToday > 0
                          ? `₹${totalSettlementToday.toLocaleString('en-IN')}`
                          : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
        </div>
      )}

      {/* ── DIRECT ── */}
      {activeTab === 'direct' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <FiDollarSign className="w-3 h-3" /> {ds.length} orders today
            </p>
            <span className="text-[10px] px-2 py-1 rounded-full bg-teal-50 text-teal-600 font-semibold">
              ₹{dsRevenue.toLocaleString('en-IN')}
            </span>
          </div>
          {ds.length === 0
            ? <p className="text-center text-gray-400 text-sm py-6">No direct sales today</p>
            : (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {ds.map((o, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-teal-50 rounded-xl border border-teal-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-teal-200 rounded-full flex items-center justify-center text-teal-700 font-bold text-xs flex-shrink-0">
                        {(o.customerName || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-800">
                          {o.customerName || 'Customer'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {o.items?.reduce((a, b) => a + Number(b.quantity || 0), 0) || 0} pcs
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-gray-800">
                      ₹{Number(o.totalAmount || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

    </Card>
  );
};

export default TodaySummary;
