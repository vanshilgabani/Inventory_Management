import { useState } from 'react';
import Card from '../common/Card';

const accentStyles = {
  indigo: { icon: 'bg-indigo-50 text-indigo-600', label: 'text-indigo-600' },
  orange: { icon: 'bg-orange-50 text-orange-500', label: 'text-orange-500' },
  blue:   { icon: 'bg-blue-50 text-blue-600',     label: 'text-blue-600'   },
  purple: { icon: 'bg-purple-50 text-purple-600', label: 'text-purple-600' },
};

const StatCard = ({
  title, value, icon: Icon, accent = 'indigo',
  // List-style hover (Total Sales, Pending Payment)
  hoverLabel, hoverItems = [],
  // Mirror-style hover (Total Stock, Inv. Value)
  hoverTitle, hoverValue,
}) => {
  const [hovered, setHovered] = useState(false);
  const styles = accentStyles[accent] || accentStyles.indigo;
  const isMirror = !!hoverTitle && !!hoverValue;

  return (
    <div
      className="relative overflow-hidden min-h-[110px] cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Card className="p-4 h-full">

        {/* ── FRONT FACE ── */}
        <div className={`transition-opacity duration-300 ${hovered ? 'opacity-0' : 'opacity-100'}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{title}</p>
              <p className="text-xl font-extrabold text-gray-900 mt-0.5">{value}</p>
            </div>
            <div className={`p-1.5 rounded-lg ${styles.icon}`}>
              <Icon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[9px] text-gray-400 mt-2">Hover for details</p>
        </div>

        {/* ── HOVER FACE — MIRROR style (same layout, different data) ── */}
        {isMirror && (
          <div className={`absolute inset-0 p-4 bg-white rounded-xl flex flex-col justify-between transition-opacity duration-300 pointer-events-none ${hovered ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{hoverTitle}</p>
                <p className="text-xl font-extrabold text-gray-900 mt-0.5">{hoverValue}</p>
              </div>
              <div className={`p-1.5 rounded-lg ${styles.icon}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
          </div>
        )}

        {/* ── HOVER FACE — LIST style (breakdown items) ── */}
        {!isMirror && (
          <div className={`absolute inset-0 p-4 bg-white rounded-xl flex flex-col justify-center transition-opacity duration-300 pointer-events-none ${hovered ? 'opacity-100' : 'opacity-0'}`}>
            <p className={`text-[9px] font-bold uppercase tracking-wider mb-2 ${styles.label}`}>{hoverLabel}</p>
            <div className="space-y-1.5">
              {hoverItems.length > 0
                ? hoverItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-500 truncate pr-2">{item[0]}</span>
                      <span className="text-[10px] font-semibold text-gray-800 whitespace-nowrap">{item[1]}</span>
                    </div>
                  ))
                : <p className="text-[10px] text-gray-400">No data yet</p>}
            </div>
          </div>
        )}

      </Card>
    </div>
  );
};

export default StatCard;
