import { FiChevronDown, FiChevronUp, FiCalendar } from 'react-icons/fi';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import DesignTable from './DesignTable';

const DateGroup = ({ dateGroup, enabledSizes, canEditDelete, onEdit, onDelete, isExpanded, onToggle }) => {
  const getDateLabel = (dateStr) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM dd, yyyy');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
      {/* Date Header */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <FiCalendar className="text-blue-600 text-xl" />
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              {getDateLabel(dateGroup.date)}
            </h3>
            <p className="text-sm text-gray-500">
              {format(parseISO(dateGroup.date), 'dd MMM yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Quantity</p>
            <p className="text-xl font-bold text-blue-600">
              {dateGroup.totalQuantity} units
            </p>
          </div>
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            {isExpanded ? (
              <FiChevronUp className="text-2xl" />
            ) : (
              <FiChevronDown className="text-2xl" />
            )}
          </button>
        </div>
      </div>

      {/* Design Tables - Side by Side */}
      {isExpanded && (
        <div className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {dateGroup.designs.map((design, index) => (
              <DesignTable
                key={index}
                design={design}
                enabledSizes={enabledSizes}
                canEditDelete={canEditDelete}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DateGroup;
