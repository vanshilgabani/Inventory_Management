import { FiSearch, FiX } from 'react-icons/fi';

const OrderFilters = ({ filters, onChange, onClear }) => {
  const hasActive = filters.search || filters.dateFrom || filters.dateTo;

  return (
    <div className="flex flex-wrap gap-3 mb-4 items-end">

      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
        <input
          type="text"
          placeholder="Search supplier or challan no..."
          value={filters.search}
          onChange={e => onChange('search', e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Date From */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500 font-medium">From</label>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={e => onChange('dateFrom', e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Date To */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500 font-medium">To</label>
        <input
          type="date"
          value={filters.dateTo}
          onChange={e => onChange('dateTo', e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Clear */}
      {hasActive && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition"
        >
          <FiX size={14} /> Clear
        </button>
      )}
    </div>
  );
};

export default OrderFilters;