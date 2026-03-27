import Card from '../common/Card';

const STR_COLORS = [
  { min: 2,    label: 'Fast',   bar: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border-green-200'   },
  { min: 0.5,  label: 'Normal', bar: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border-blue-200'     },
  { min: 0,    label: 'Slow',   bar: 'bg-red-400',    badge: 'bg-red-50 text-red-600 border-red-200'        },
];

const DOH_COLORS = [
  { max: 15,  label: 'Critical', bar: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200'         },
  { max: 30,  label: 'Low',      bar: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  { max: 999, label: 'Healthy',  bar: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border-green-200'   },
];

const getSTRColor  = (rate) => STR_COLORS.find(c => rate >= c.min)  || STR_COLORS[2];
const getDOHColor  = (days) => DOH_COLORS.find(c => days <= c.max)  || DOH_COLORS[2];

const SellThroughDohCard = ({ sellThroughData = [], dohData = {}, mode, onModeChange }) => {
  const isSTR      = mode === 'str';
  const strList    = sellThroughData.slice(0, 8);
  const dohList    = (dohData.marketplace || []).slice(0, 8);
  const maxSTR     = strList.length  > 0 ? Math.max(...strList.map(i => i.rate), 0.01) : 1;
  const maxDOH     = dohList.length  > 0 ? Math.max(...dohList.map(i => i.doh),  0.01) : 1;

  return (
    <Card className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-bold text-gray-800">
            {isSTR ? 'Sell-Through Rate' : 'Days of Inventory'}
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {isSTR
              ? 'Units sold ÷ opening stock · last 30d · higher = faster selling'
              : 'Current stock ÷ daily sales · lower = reorder sooner'}
          </p>
        </div>
        {/* Mode toggle */}
        <div className="bg-gray-100 rounded-lg p-0.5 flex gap-0.5 flex-shrink-0 ml-2">
          <button onClick={() => onModeChange('str')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
              isSTR ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}>STR</button>
          <button onClick={() => onModeChange('doh')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
              !isSTR ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}>DOH</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-3 mt-1">
        {(isSTR ? STR_COLORS : DOH_COLORS).map((c, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${c.bar}`} />
            <span className="text-[9px] text-gray-500">{c.label}</span>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="max-h-[150px] overflow-y-auto space-y-2 pr-1">
        {isSTR
          ? strList.length === 0
            ? <p className="text-center text-gray-400 text-xs py-8">No sell-through data</p>
            : strList.map((item, idx) => {
                const c   = getSTRColor(item.rate);
                const pct = Math.round((item.rate / maxSTR) * 100);
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-800">{item.design}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>
                        {item.rate}x
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
          : dohList.length === 0
            ? <p className="text-center text-gray-400 text-xs py-8">No inventory velocity data</p>
            : dohList.map((item, idx) => {
                const c   = getDOHColor(item.doh);
                // Invert bar — fewer days = longer bar (more urgent = more prominent)
                const pct = Math.round((1 - (item.doh / maxDOH)) * 100);
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-800">{item.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>
                        {item.doh}d
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
                        style={{ width: `${Math.max(pct, 10)}%` }} />
                    </div>
                  </div>
                );
              })}
      </div>
    </Card>
  );
};

export default SellThroughDohCard;
