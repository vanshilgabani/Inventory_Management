import { FiTruck, FiPackage, FiCalendar } from 'react-icons/fi';
import { format } from 'date-fns';

const StatsCards = ({ stats, loading }) => {
  const cards = [
    {
      icon  : <FiTruck size={20} />,
      label : 'Total Orders',
      value : loading ? '—' : stats.totalOrders,
      color : 'text-blue-600 bg-blue-50'
    },
    {
      icon  : <FiPackage size={20} />,
      label : 'Total Units Received',
      value : loading ? '—' : stats.totalUnits,
      color : 'text-green-600 bg-green-50'
    },
    {
      icon  : <FiCalendar size={20} />,
      label : 'Last Sync',
      value : loading ? '—' : stats.lastSync
        ? format(new Date(stats.lastSync), 'dd MMM, HH:mm')
        : 'Never',
      color : 'text-purple-600 bg-purple-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {cards.map((card, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className={`p-3 rounded-lg ${card.color}`}>{card.icon}</div>
          <div>
            <p className="text-xs text-slate-500 font-medium">{card.label}</p>
            <p className="text-xl font-bold text-slate-800">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;