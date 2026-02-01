const StatsCard = ({ title, value, subtitle, icon, gradient }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            {title}
          </p>
          <div className="mt-2 flex items-baseline">
            <p className={`text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
              {value || 0}
            </p>
            {subtitle && (
              <span className="ml-2 text-sm text-gray-500">{subtitle}</span>
            )}
          </div>
        </div>
        <div className={`text-4xl bg-gradient-to-r ${gradient} bg-clip-text`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
