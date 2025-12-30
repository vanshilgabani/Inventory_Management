const StatsCard = ({ title, value, icon, color = '#3b82f6', trend }) => {
  const colorMap = {
    '#3b82f6': 'bg-blue-100 text-blue-500',
    '#10b981': 'bg-green-100 text-green-500',
    '#8b5cf6': 'bg-purple-100 text-purple-500',
    '#ef4444': 'bg-red-100 text-red-500',
    '#f59e0b': 'bg-orange-100 text-orange-500',
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex items-center gap-4 transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl ${colorMap[color] || 'bg-blue-100 text-blue-500'}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-600 mb-2 font-medium">{title}</p>
        <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
        {trend && (
          <p className={`text-sm mt-2 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.text}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
