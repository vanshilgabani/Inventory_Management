import Card from '../common/Card';

const MEDAL = ['🥇', '🥈', '🥉'];

const TopSellersCard = ({ topSellersData, mode, period, onModeChange, onPeriodChange }) => {
  const data = topSellersData?.[mode]?.[period] || [];
  const max  = data.length > 0 ? Math.max(...data.map(([, q]) => q)) : 1;

  const barColor = mode === 'marketplace'
    ? 'bg-blue-500'
    : 'bg-purple-500';

  const badgeColor = mode === 'marketplace'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-purple-50 text-purple-700 border-purple-200';

  return (
    <Card className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Top Sellers</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Units sold · design · color · size</p>
        </div>
        {/* Period toggle */}
        <div className="bg-gray-100 rounded-lg p-0.5 flex gap-0.5">
          {['7d', '30d'].map(p => (
            <button key={p}
              onClick={() => onPeriodChange(p)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                period === p ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
            >{p}</button>
          ))}
        </div>
      </div>

      {/* Channel toggle */}
      <div className="flex gap-2 mb-3">
        {[
          { id: 'marketplace', label: '🛒 Marketplace' },
          { id: 'wd',          label: '🏪 W & D' },
        ].map(ch => (
          <button key={ch.id}
            onClick={() => onModeChange(ch.id)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
              mode === ch.id
                ? (ch.id === 'marketplace' ? 'bg-blue-600 text-white border-blue-600' : 'bg-purple-600 text-white border-purple-600')
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >{ch.label}</button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
        {data.length === 0
          ? <div className="h-full flex items-center justify-center">
              <p className="text-gray-400 text-xs text-center py-8">No data for this period</p>
            </div>
          : data.slice(0, 10).map(([label, qty], idx) => {
              const pct       = Math.round((qty / max) * 100);
              const [design, ...rest] = label.split(' · ');
              const subtitle  = rest.join(' · ');
              return (
                <div key={idx} className="group">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm flex-shrink-0 w-5 text-center">
                        {idx < 3 ? MEDAL[idx] : <span className="text-[10px] font-bold text-gray-400">#{idx + 1}</span>}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{design}</p>
                        {subtitle && <p className="text-[9px] text-gray-400 truncate">{subtitle}</p>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex-shrink-0 ml-2 ${badgeColor}`}>
                      {qty} pcs
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="ml-6 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
      </div>
    </Card>
  );
};

export default TopSellersCard;
