import { FiSearch, FiX, FiDownload } from 'react-icons/fi';

const FILTERS = [
  { value: 'all',     label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid',    label: 'Paid'   },
];

const ACTIVE_STYLES = {
  all:     'bg-indigo-600 text-white shadow-sm',
  pending: 'bg-red-500    text-white shadow-sm',
  partial: 'bg-yellow-500 text-white shadow-sm',
  paid:    'bg-green-500  text-white shadow-sm',
};

export default function OrderFilters({
  search, onSearchChange,
  paymentFilter, onFilterChange,
  sortBy, setSortBy, sortOrder, setSortOrder,
  totalCount,
  onExport,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">

      {/* Search */}
      <div className="relative flex-1 min-w-52 max-w-sm">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Buyer name, mobile, challan..."
          className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm
                     focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <FiX className="text-sm" />
          </button>
        )}
      </div>

      {/* Payment filter pills */}
      <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              paymentFilter === f.value
                ? ACTIVE_STYLES[f.value]
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <select
        value={`${sortBy}_${sortOrder}`}
        onChange={e => {
          const [by, order] = e.target.value.split('_');
          setSortBy(by);
          setSortOrder(order);
        }}
        className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white
                   focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
      >
        <option value="createdAt_desc">Newest First</option>
        <option value="createdAt_asc">Oldest First</option>
        <option value="totalAmount_desc">Amount: High → Low</option>
        <option value="totalAmount_asc">Amount: Low → High</option>
        <option value="amountDue_desc">Due: High → Low</option>
      </select>

      {/* Total count badge */}
      <span className="text-xs text-gray-400 font-medium ml-auto">
        {totalCount} orders
      </span>

      {/* Export */}
      {onExport && (
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg
                     text-xs text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <FiDownload className="text-sm" />
          Export
        </button>
      )}
    </div>
  );
}
