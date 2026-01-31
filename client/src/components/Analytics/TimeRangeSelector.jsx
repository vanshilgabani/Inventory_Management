import { useState } from 'react';
import { FiCalendar, FiChevronDown } from 'react-icons/fi';

const TimeRangeSelector = ({ onRangeChange, showComparison = true }) => {
  const [selectedRange, setSelectedRange] = useState('This Month');
  const [showDropdown, setShowDropdown] = useState(false);
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [showCustom, setShowCustom] = useState(false);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareWith, setCompareWith] = useState('Previous Period');

  const predefinedRanges = [
    'Today',
    'Yesterday',
    'This Week',
    'Last Week',
    'This Month',
    'Last Month',
    'This Quarter',
    'Last Quarter',
    'This Year',
    'Last Year',
    'Custom Range'
  ];

  const compareOptions = [
    'Previous Period',
    'Same Period Last Year'
  ];

  const calculateDateRange = (range) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDate, endDate;

    switch (range) {
      case 'Today':
        startDate = new Date(today);
        endDate = new Date(today);
        break;
        
      case 'Yesterday':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 1);
        endDate = new Date(startDate);
        break;
        
      case 'This Week':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay()); // Sunday
        endDate = new Date(today);
        break;
        
      case 'Last Week':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay() - 7);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        break;
        
      case 'This Month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today);
        break;
        
      case 'Last Month':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
        
      case 'This Quarter':
        const currentQuarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), currentQuarter * 3, 1);
        endDate = new Date(today);
        break;
        
      case 'Last Quarter':
        const lastQuarter = Math.floor(today.getMonth() / 3) - 1;
        const year = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear();
        const quarter = lastQuarter < 0 ? 3 : lastQuarter;
        startDate = new Date(year, quarter * 3, 1);
        endDate = new Date(year, quarter * 3 + 3, 0);
        break;
        
      case 'This Year':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today);
        break;
        
      case 'Last Year':
        startDate = new Date(today.getFullYear() - 1, 0, 1);
        endDate = new Date(today.getFullYear() - 1, 11, 31);
        break;
        
      default:
        return null;
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  const handleRangeSelect = (range) => {
    setSelectedRange(range);
    setShowDropdown(false);
    
    if (range === 'Custom Range') {
      setShowCustom(true);
      return;
    }

    setShowCustom(false);
    const dates = calculateDateRange(range);
    if (dates && onRangeChange) {
      onRangeChange({ 
        ...dates, 
        compareEnabled, 
        compareWith,
        rangeName: range 
      });
    }
  };

  const handleCustomApply = () => {
    if (customDates.start && customDates.end && onRangeChange) {
      onRangeChange({
        startDate: customDates.start,
        endDate: customDates.end,
        compareEnabled,
        compareWith,
        rangeName: 'Custom Range'
      });
      setShowCustom(false);
    }
  };

  const handleCompareToggle = () => {
    const newValue = !compareEnabled;
    setCompareEnabled(newValue);
    
    const dates = selectedRange === 'Custom Range' 
      ? { startDate: customDates.start, endDate: customDates.end }
      : calculateDateRange(selectedRange);
    
    if (dates && onRangeChange) {
      onRangeChange({ 
        ...dates, 
        compareEnabled: newValue, 
        compareWith,
        rangeName: selectedRange 
      });
    }
  };

  const handleCompareWithChange = (value) => {
    setCompareWith(value);
    
    const dates = selectedRange === 'Custom Range' 
      ? { startDate: customDates.start, endDate: customDates.end }
      : calculateDateRange(selectedRange);
    
    if (dates && onRangeChange) {
      onRangeChange({ 
        ...dates, 
        compareEnabled, 
        compareWith: value,
        rangeName: selectedRange 
      });
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Time Range Selector */}
      <div className="relative">
        <button
        type='button'
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
        >
          <FiCalendar className="text-gray-500" />
          <span className="font-medium text-gray-700">{selectedRange}</span>
          <FiChevronDown className={`text-gray-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-50 animate-fadeIn max-h-96 overflow-y-auto">
              {predefinedRanges.map((range) => (
                <button
                type='button'
                  key={range}
                  onClick={() => handleRangeSelect(range)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    selectedRange === range ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Custom Date Picker */}
      {showCustom && (
        <div className="flex items-center gap-2 animate-fadeIn">
          <input
            type="date"
            value={customDates.start}
            onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
          <span className="text-gray-500 font-medium">to</span>
          <input
            type="date"
            value={customDates.end}
            onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
          <button
          type='button'
            onClick={handleCustomApply}
            disabled={!customDates.start || !customDates.end}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Apply
          </button>
          <button
          type='button'
            onClick={() => {
              setShowCustom(false);
              setSelectedRange('This Month');
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Comparison Toggle */}
      {showComparison && !showCustom && (
        <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-300">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={handleCompareToggle}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition-colors">
              Compare with
            </span>
          </label>
          
          {compareEnabled && (
            <select
              value={compareWith}
              onChange={(e) => handleCompareWithChange(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              {compareOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
};

export default TimeRangeSelector;
