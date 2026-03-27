import { useState, useMemo } from 'react';
import Card from '../common/Card';
import { FiDownload, FiChevronDown } from 'react-icons/fi';
import { format } from 'date-fns';

const getDOHStatus = (doh) => {
  if (doh === null || doh === undefined || doh === 0)
    return { label: 'Critical', dot: 'bg-red-500 animate-pulse', header: 'bg-red-50 border-red-100', badge: 'bg-red-100 text-red-700', bar: 'border-l-2 border-red-300', text: 'text-red-600 font-black', display: '0d' };
  if (doh <= 7)
    return { label: 'Critical', dot: 'bg-red-500 animate-pulse', header: 'bg-red-50 border-red-100', badge: 'bg-red-100 text-red-700', bar: 'border-l-2 border-red-300', text: 'text-red-600 font-black', display: `${doh}d` };
  if (doh <= 20)
    return { label: 'Warning', dot: 'bg-orange-400', header: 'bg-orange-50 border-orange-100', badge: 'bg-orange-100 text-orange-700', bar: 'border-l-2 border-orange-300', text: 'text-orange-600 font-bold', display: `${doh}d` };
  return { label: 'OK', dot: 'bg-green-500', header: 'bg-green-50 border-green-100', badge: 'bg-green-100 text-green-700', bar: '', text: 'text-green-600 font-semibold', display: `${doh}d` };
  if (doh <= 30)           return { label: 'Watch',    dot: 'bg-yellow-400', header: 'bg-yellow-50 border-yellow-100', badge: 'bg-yellow-100 text-yellow-700', text: 'text-yellow-600 font-semibold', display: `${doh}d` };
  return                          { label: 'Healthy',  dot: 'bg-green-500',  header: 'bg-green-50 border-green-100',   badge: 'bg-green-100 text-green-700',   text: 'text-green-600 font-semibold', display: `${doh}d` };
};

const ReorderPlannerCard = ({
  reorderItemsMS  = [],
  reorderItemsWD  = [],
  inventoryMode   = 'reserved',
}) => {
  const [channel,         setChannel]         = useState('marketplace');
  const [selectedDesign,  setSelectedDesign]  = useState(null);
  const [dropdownOpen,    setDropdownOpen]    = useState(false);

  const items        = channel === 'marketplace' ? reorderItemsMS : reorderItemsWD;
  const stockLabel   = channel === 'marketplace'
    ? (inventoryMode === 'reserved' ? 'Reserved Stock' : 'Main Stock')
    : 'Main Stock';
  const channelColor = channel === 'marketplace' ? 'bg-blue-500' : 'bg-purple-500';

  // Group by design sorted by worst DOH
  const grouped = useMemo(() => {
    const g = {};
    items.forEach(item => {
      if (!g[item.design]) g[item.design] = [];
      g[item.design].push(item);
    });
    return Object.entries(g).sort(([, a], [, b]) => {
      const minA = Math.min(...a.map(i => i.doh ?? 9999));
      const minB = Math.min(...b.map(i => i.doh ?? 9999));
      return minA - minB;
    });
  }, [items]);

  // Always default to most urgent design
  const activeDesign   = selectedDesign && grouped.find(([d]) => d === selectedDesign)
    ? selectedDesign
    : grouped[0]?.[0] ?? null;

  const activeVariants = grouped.find(([d]) => d === activeDesign)?.[1] ?? [];

  const criticalCount  = items.filter(i => (i.doh ?? 0) <= 7).length;
  const warningCount   = items.filter(i => i.doh > 7 && i.doh <= 20).length;
  const totalSuggest   = activeVariants.reduce((s, v) => s + (v.suggested || 0), 0);
  const minDOH         = activeVariants.length
    ? Math.min(...activeVariants.map(v => v.doh ?? 9999))
    : null;

  const worstDOH   = activeVariants.length ? Math.min(...activeVariants.map(v => v.doh ?? 9999)) : 9999;
  const isCritical = worstDOH <= 7;
  const isWarning  = !isCritical && worstDOH <= 20;
  const isWatch    = !isCritical && !isWarning && worstDOH <= 30;

  const headerStyle = isCritical
    ? { bg: 'bg-red-50 border-red-100',      dot: 'bg-red-500 animate-pulse', badge: 'bg-red-100 text-red-700',       dohText: 'text-red-600 font-black'    }
    : isWarning
    ? { bg: 'bg-orange-50 border-orange-100', dot: 'bg-orange-400',           badge: 'bg-orange-100 text-orange-700', dohText: 'text-orange-600 font-bold'  }
    : isWatch
    ? { bg: 'bg-yellow-50 border-yellow-100', dot: 'bg-yellow-400',           badge: 'bg-yellow-100 text-yellow-700', dohText: 'text-yellow-600 font-semibold' }
    :   { bg: 'bg-green-50 border-green-100',  dot: 'bg-green-500',            badge: 'bg-green-100 text-green-700',   dohText: 'text-green-600 font-semibold'  };

  // When channel changes, reset selected design so it defaults to most urgent again
  const handleChannelChange = (ch) => {
    setChannel(ch);
    setDropdownOpen(false);
  };

  const handleExport = () => {
    if (!items.length) return;
    const rows = [['Design', 'Color', 'Size', 'Stock', 'Daily Rate', 'DOH', 'Suggested Qty', 'Status']];
    grouped.forEach(([, variants]) =>
      variants.forEach(v => rows.push([
        v.design, v.color, v.size,
        v.currentStock, v.dailyRate,
        v.doh ?? 'N/A', v.suggested,
        getDOHStatus(v.doh).label,
      ]))
    );
    const csv = rows.map(r => r.join(',')).join('\n');
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `reorder-${channel}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <Card className="p-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h3 className="text-sm font-bold text-gray-800">Reorder Planner</h3>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Showing most urgent design first</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {criticalCount > 0 && (
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-bold border border-red-200 animate-pulse">
              🔴 {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 font-bold border border-orange-200">
              🟠 {warningCount} Warning
            </span>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-700 transition-colors"
          >
            <FiDownload className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>

      {/* ── Channel Toggle + Inventory Mode ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => handleChannelChange('marketplace')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
              channel === 'marketplace'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >🛒 Marketplace</button>
          <button
            onClick={() => handleChannelChange('wd')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
              channel === 'wd'
                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >🏪 W &amp; D</button>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg border">
          <span className={`w-2 h-2 rounded-full ${channelColor} inline-block`}></span>
          Using: <span className={`font-bold ml-0.5 ${channel === 'marketplace' ? 'text-blue-600' : 'text-purple-600'}`}>{stockLabel}</span>
        </div>
      </div>

      {/* ── Empty State ── */}
      {grouped.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-sm font-semibold text-gray-700">All stock levels are healthy</p>
          <p className="text-xs text-gray-400 mt-1">No items below reorder point for {channel === 'marketplace' ? 'Marketplace' : 'W&D'}</p>
        </div>
      ) : (
        <>
          {/* ── Design Selector Row ── */}
          <div className="flex items-center justify-between mb-3">

            {/* Left — active design pill */}
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${headerStyle.dot}`}></span>
              <span className="text-sm font-black text-gray-900">{activeDesign}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${headerStyle.badge}`}>
                {isCritical ? 'Critical' : 'Warning'}
              </span>
              <span className="text-[9px] text-gray-400">{activeVariants.length} variants</span>
            </div>

            {/* Right — dropdown picker */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(o => !o)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-all text-gray-600"
              >
                Switch Design
                <FiChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-100 rounded-xl shadow-xl z-20 overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                      {grouped.length} designs need attention
                    </p>
                  </div>
                  <div className="max-h-52 overflow-y-auto py-1">
                    {grouped.map(([design, variants]) => {
                      const minD    = Math.min(...variants.map(v => v.doh ?? 9999));
                      const critV   = variants.filter(v => (v.doh ?? 0) <= 7).length;
                      const warnV   = variants.filter(v => v.doh > 7 && v.doh <= 20).length;
                      const isCrit  = critV > 0;
                      const isActive = design === activeDesign;
                      return (
                        <button
                          key={design}
                          onClick={() => { setSelectedDesign(design); setDropdownOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                            isActive ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCrit ? 'bg-red-500' : 'bg-orange-400'}`}></span>
                            <span className={`text-xs font-bold ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>{design}</span>
                            {isActive && <span className="text-[9px] text-blue-500 font-semibold">current</span>}
                          </div>
                          <div className="flex items-center gap-1.5 text-right">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              isCrit ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {isCrit ? `${critV} crit` : `${warnV} warn`}
                            </span>
                            <span className={`text-[10px] font-black ${isCrit ? 'text-red-600' : 'text-orange-600'}`}>
                              {minD === 9999 ? 'N/A' : `${minD}d`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Info Bar ── */}
          <div className={`flex items-center justify-between px-3 py-2 rounded-xl border mb-3 ${headerStyle.bg}`}>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide font-semibold">Min DOH</p>
                <p className={`text-sm font-black ${headerStyle.dohText}`}>
                  {minDOH === 9999 || minDOH === null ? 'N/A' : `${minDOH}d`}
                </p>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide font-semibold">Total Order</p>
                <p className="text-sm font-black text-gray-900">{totalSuggest} pcs</p>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide font-semibold">Variants</p>
                <p className="text-sm font-black text-gray-900">{activeVariants.length}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-gray-400">
                {grouped.findIndex(([d]) => d === activeDesign) + 1} of {grouped.length} designs
              </p>
            </div>
          </div>

          {/* ── Variants Table ── */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            {/* Column Headers */}
            <div className="grid grid-cols-6 px-3 py-2 bg-gray-50 border-b border-gray-100">
              <span className="col-span-2 text-[9px] font-bold uppercase text-gray-400 tracking-wide">Color · Size</span>
              <span className="text-[9px] font-bold uppercase text-gray-400 tracking-wide text-center">Stock</span>
              <span className="text-[9px] font-bold uppercase text-gray-400 tracking-wide text-center">Daily</span>
              <span className="text-[9px] font-bold uppercase text-gray-400 tracking-wide text-center">DOH</span>
              <span className="text-[9px] font-bold uppercase text-gray-400 tracking-wide text-center">Order</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {activeVariants.map((v, idx) => {
                const st = getDOHStatus(v.doh);
                return (
                  <div key={idx} className={`grid grid-cols-6 px-3 py-2.5 text-xs items-center hover:bg-gray-50 transition-colors ${st.bar}`}>
                    <span className="col-span-2 text-gray-700 font-medium truncate">{v.color} · {v.size}</span>
                    <span className="text-center font-semibold text-gray-800">{v.currentStock}</span>
                    <span className="text-center text-gray-400">{v.dailyRate}/d</span>
                    <span className={`text-center ${st.text}`}>{st.display}</span>
                    <span className="text-center">
                      {v.suggested > 0
                        ? <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{v.suggested}</span>
                        : <span className="text-gray-300 text-[10px]">—</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Footer navigation hint ── */}
          <div className="flex items-center justify-between mt-2.5 px-1">
            <p className="text-[10px] text-gray-400">
              💡 Most urgent design shown by default
            </p>
            <div className="flex gap-1">
              {grouped.slice(0, 5).map(([design]) => (
                <button
                  key={design}
                  onClick={() => setSelectedDesign(design)}
                  title={design}
                  className={`w-2 h-2 rounded-full transition-all ${
                    design === activeDesign
                      ? 'bg-gray-700 scale-125'
                      : grouped.find(([d]) => d === design)?.[1].some(v => (v.doh ?? 0) <= 7)
                        ? 'bg-red-300 hover:bg-red-500'
                        : 'bg-orange-300 hover:bg-orange-500'
                  }`}
                />
              ))}
              {grouped.length > 5 && (
                <span className="text-[9px] text-gray-400 ml-1">+{grouped.length - 5}</span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Close dropdown on outside click */}
      {dropdownOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
      )}
    </Card>
  );
};

export default ReorderPlannerCard;
