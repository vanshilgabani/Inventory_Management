import { useState } from 'react';
import { FiSearch, FiDownload, FiCalendar } from 'react-icons/fi';

const FilterBar = ({ filters, onFilterChange, showExport, onExport, showStatusFilter, viewMode, onViewModeChange }) => {
  const [localFilters, setLocalFilters] = useState(filters);

  const handleQuickFilter = (type) => {
    const today = new Date();
    let dateFrom = null;

    switch (type) {
      case 'today':
        dateFrom = today.toISOString().split('T')[0];
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        dateFrom = yesterday.toISOString().split('T')[0];
        break;
      case 'last7':
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 7);
        dateFrom = last7.toISOString().split('T')[0];
        break;
      case 'last30':
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        dateFrom = last30.toISOString().split('T')[0];
        break;
      default:
        dateFrom = null;
    }

    const newFilters = {
      ...localFilters,
      dateFrom,
      dateTo: type !== 'all' ? today.toISOString().split('T')[0] : null,
    };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleApply = () => {
    onFilterChange(localFilters);
  };

  const handleReset = () => {
    const resetFilters = {
      dateFrom: null,
      dateTo: null,
      search: '',
      status: 'all',
    };
    setLocalFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
      {/* Quick Filters */}
      {!showStatusFilter && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleQuickFilter('today')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => handleQuickFilter('yesterday')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Yesterday
          </button>
          <button
            onClick={() => handleQuickFilter('last7')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => handleQuickFilter('last30')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Last 30 Days
          </button>
          <button
            onClick={() => handleQuickFilter('all')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            All Time
          </button>
        </div>
      )}

      {/* Detailed Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Date Filters */}
        {!showStatusFilter && (
          <>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FiCalendar className="inline mr-1" />
                From Date
              </label>
              <input
                type="date"
                value={localFilters.dateFrom || ''}
                onChange={(e) =>
                  setLocalFilters({ ...localFilters, dateFrom: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FiCalendar className="inline mr-1" />
                To Date
              </label>
              <input
                type="date"
                value={localFilters.dateTo || ''}
                onChange={(e) =>
                  setLocalFilters({ ...localFilters, dateTo: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </>
        )}

        {/* Status Filter */}
        {showStatusFilter && (
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={localFilters.status || 'all'}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, status: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="partial">Partial Return</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        )}

        {/* Search */}
        <div className={showStatusFilter ? 'md:col-span-6' : 'md:col-span-4'}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <FiSearch className="inline mr-1" />
            Search
          </label>
          <input
            type="text"
            placeholder={showStatusFilter ? 'Search by borrower name...' : 'Search by design, batch, notes...'}
            value={localFilters.search || ''}
            onChange={(e) =>
              setLocalFilters({ ...localFilters, search: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Action Buttons */}
        <div className={`${showStatusFilter ? 'md:col-span-3' : 'md:col-span-2'} flex items-end gap-2`}>
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Apply
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
          >
            Reset
          </button>
          {showExport && (
            <button
              onClick={onExport}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
              title="Export to Excel"
            >
              <FiDownload />
            </button>
          )}
        </div>
      </div>

      {/* View Mode Toggle (only for Factory tab) */}
      {viewMode !== undefined && onViewModeChange && (
        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            👁️ View Mode
          </label>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              onClick={() => onViewModeChange('grouped')}
              className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                viewMode === 'grouped'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📅 Grouped View
            </button>
            <button
              onClick={() => onViewModeChange('table')}
              className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📊 Table View
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
