import { useState, useRef, useEffect } from 'react';
import Card from '../common/Card';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { FiChevronDown, FiLoader } from 'react-icons/fi';
import { analyticsService } from '../../services/analyticsService';

// Per-type color thresholds
const issueBadge = (pct, type = 'ret') => {
  if (type === 'wr') {
    if (pct > 7)  return 'text-red-600 font-bold';
    if (pct >= 3) return 'text-orange-500 font-bold';
    return 'text-green-600 font-semibold';
  }
  if (type === 'rto') {
    if (pct > 30)  return 'text-red-600 font-bold';
    if (pct >= 20) return 'text-orange-500 font-bold';
    return 'text-green-600 font-semibold';
  }
  // returned
  if (pct > 35)  return 'text-red-600 font-bold';
  if (pct >= 25) return 'text-orange-500 font-bold';
  return 'text-green-600 font-semibold';
};

const buildMonths = () =>
  [0, 1, 2, 3].map(i => {
    const date = subMonths(new Date(), i);
    return {
      offset:    i,
      label:     format(date, 'MMM yyyy'),
      startDate: format(startOfMonth(date), 'yyyy-MM-dd'),
      endDate:   format(endOfMonth(date),   'yyyy-MM-dd'),
    };
  });

const AccountPerformanceCard = ({ accountStats = [] }) => {
  const months = buildMonths();

  const [selectedMonth, setSelectedMonth] = useState(months[0]);
  const [monthData,     setMonthData]     = useState(null);
  const [loadingMonth,  setLoadingMonth]  = useState(false);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMonthSelect = async (month) => {
    setShowDropdown(false);
    setSelectedMonth(month);
    if (month.offset === 0) { setMonthData(null); return; }

    setLoadingMonth(true);
    try {
      const res = await analyticsService.getMarketplaceAccountStats({
        startDate: month.startDate,
        endDate:   month.endDate,
      });
      const data = Array.isArray(res) ? res : (res?.data || res?.accounts || []);
      setMonthData(data);
    } catch {
      setMonthData([]);
    } finally {
      setLoadingMonth(false);
    }
  };

  const displayData = selectedMonth.offset === 0 ? accountStats : (monthData || []);

  const totals = displayData.reduce((acc, a) => ({
    dispatched:  acc.dispatched  + Number(a.dispatchedCount  || 0),
    returned:    acc.returned    + Number(a.returnedCount    || 0),
    rto:         acc.rto         + Number(a.RTOCount         || 0),
    wrongReturn: acc.wrongReturn + Number(a.wrongReturnCount || 0),
    settled:     acc.settled     + Number(a.totalSettlement  || 0),
  }), { dispatched: 0, returned: 0, rto: 0, wrongReturn: 0, settled: 0 });

  const grandTotal = totals.dispatched + totals.returned + totals.rto + totals.wrongReturn;
  const retPct  = grandTotal > 0 ? +((totals.returned    / grandTotal) * 100).toFixed(1) : 0;
  const rtoPct  = grandTotal > 0 ? +((totals.rto         / grandTotal) * 100).toFixed(1) : 0;
  const wrPct   = grandTotal > 0 ? +((totals.wrongReturn / grandTotal) * 100).toFixed(1) : 0;

  return (
    <Card className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Account Performance</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Per Flipkart account · {selectedMonth.label}</p>
        </div>

        {/* Month selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(v => !v)}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-semibold border border-blue-100 hover:bg-blue-100 transition-colors"
          >
            {loadingMonth
              ? <FiLoader className="w-3 h-3 animate-spin" />
              : selectedMonth.label
            }
            <FiChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[120px]">
              {months.map(m => (
                <button
                  key={m.offset}
                  onClick={() => handleMonthSelect(m)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-blue-50
                    ${selectedMonth.offset === m.offset
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-gray-700'
                    }`}
                >
                  {m.label}
                  {m.offset === 0 && (
                    <span className="ml-1 text-[9px] text-blue-400">(current)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loadingMonth
        ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <FiLoader className="w-6 h-6 text-blue-400 animate-spin" />
              <p className="text-xs text-gray-400">Loading {selectedMonth.label}…</p>
            </div>
          </div>
        )
        : displayData.length === 0
        ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400 text-xs py-8">No account data for {selectedMonth.label}</p>
          </div>
        )
        : (
          <div className="flex-1 overflow-hidden flex flex-col">

            {/* Summary KPI row — 6 tiles */}
            <div className="grid grid-cols-6 gap-2 mb-3">
              {[
                { label: 'Total Orders', value: grandTotal,                                    color: 'bg-gray-50    text-gray-700    border-gray-200'   },
                { label: 'Dispatched',   value: totals.dispatched,                             color: 'bg-green-50   text-green-700   border-green-200'  },
                { label: 'Returned',     value: `${totals.returned} (${retPct}%)`,             color: 'bg-red-50     text-red-600     border-red-200'    },
                { label: 'RTO',          value: `${totals.rto} (${rtoPct}%)`,                  color: 'bg-orange-50  text-orange-600  border-orange-200' },
                { label: 'W.Return',     value: `${totals.wrongReturn} (${wrPct}%)`,           color: 'bg-yellow-50  text-yellow-700  border-yellow-200' },
                { label: 'Settled',      value: `₹${Math.round(totals.settled / 1000)}k`,      color: 'bg-blue-50    text-blue-700    border-blue-200'   },
              ].map((kpi, i) => (
                <div key={i} className={`rounded-xl p-2 text-center border ${kpi.color}`}>
                  <p className="text-sm font-extrabold leading-tight">{kpi.value}</p>
                  <p className="text-[9px] font-semibold mt-0.5 opacity-80">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Per-account table */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr>
                    <th className="text-left   px-3 py-2.5 text-gray-500   font-semibold">Account</th>
                    <th className="text-center  px-2 py-2.5 text-gray-500   font-semibold">Total</th>
                    <th className="text-center  px-2 py-2.5 text-green-600  font-semibold">Disp.</th>
                    <th className="text-center  px-3 py-2.5 text-red-500    font-semibold">Returned</th>
                    <th className="text-center  px-3 py-2.5 text-orange-500 font-semibold">RTO</th>
                    <th className="text-center  px-3 py-2.5 text-yellow-600 font-semibold">W.Return</th>
                    <th className="text-right   px-3 py-2.5 text-blue-600   font-semibold">Settled</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((a, i) => {
                    const disp  = Number(a.dispatchedCount  || 0);
                    const ret   = Number(a.returnedCount    || 0);
                    const rto   = Number(a.RTOCount         || 0);
                    const wr    = Number(a.wrongReturnCount || 0);
                    const setl  = Number(a.totalSettlement  || 0);
                    const total = disp + ret + rto + wr;

                    const rPct  = total > 0 ? +((ret / total) * 100).toFixed(1) : 0;
                    const rtPct = total > 0 ? +((rto / total) * 100).toFixed(1) : 0;
                    const wPct  = total > 0 ? +((wr  / total) * 100).toFixed(1) : 0;

                    return (
                      <tr key={i} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-gray-800 truncate max-w-[110px]">{a.accountName}</p>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className="font-bold text-gray-700">{total}</span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className="font-bold text-green-700">{disp}</span>
                        </td>

                        {/* Returned */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {ret > 0
                            ? <span className="font-bold text-red-500">
                                {ret} <span className={`text-[8px] ${issueBadge(rPct, 'ret')}`}>({rPct}%)</span>
                              </span>
                            : <span className="text-gray-300">0</span>
                          }
                        </td>

                        {/* RTO */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {rto > 0
                            ? <span className="font-bold text-orange-500">
                                {rto} <span className={`text-[8px] ${issueBadge(rtPct, 'rto')}`}>({rtPct}%)</span>
                              </span>
                            : <span className="text-gray-300">0</span>
                          }
                        </td>

                        {/* Wrong Return */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {wr > 0
                            ? <span className="font-bold text-yellow-600">
                                {wr} <span className={`text-[8px] ${issueBadge(wPct, 'wr')}`}>({wPct}%)</span>
                              </span>
                            : <span className="text-gray-300">0</span>
                          }
                        </td>

                        <td className="px-3 py-2.5 text-right">
                          <span className={setl > 0 ? 'font-bold text-blue-600' : 'text-gray-300'}>
                            {setl > 0 ? `₹${setl.toLocaleString('en-IN')}` : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="px-3 py-2 font-extrabold text-gray-900 text-xs">Total</td>
                    <td className="px-2 py-2 text-center font-extrabold text-gray-700">{grandTotal}</td>
                    <td className="px-2 py-2 text-center font-extrabold text-green-700">{totals.dispatched}</td>

                    {/* Returned footer */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span className="font-extrabold text-red-500">
                        {totals.returned}
                        {totals.returned > 0 && (
                          <span className={`text-[10px] ml-0.5 ${issueBadge(retPct, 'ret')}`}></span>
                        )}
                      </span>
                    </td>

                    {/* RTO footer */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span className="font-extrabold text-orange-500">
                        {totals.rto}
                        {totals.rto > 0 && (
                          <span className={`text-[10px] ml-0.5 ${issueBadge(rtoPct, 'rto')}`}></span>
                        )}
                      </span>
                    </td>

                    {/* Wrong Return footer */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span className="font-extrabold text-yellow-600">
                        {totals.wrongReturn}
                        {totals.wrongReturn > 0 && (
                          <span className={`text-[10px] ml-0.5 ${issueBadge(wrPct, 'wr')}`}></span>
                        )}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right font-extrabold text-blue-600">
                      {totals.settled > 0 ? `₹${totals.settled.toLocaleString('en-IN')}` : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
    </Card>
  );
};

export default AccountPerformanceCard;
