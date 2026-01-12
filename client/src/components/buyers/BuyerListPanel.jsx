import React from 'react';
import { FiSearch } from 'react-icons/fi';

const BuyerListPanel = ({
  buyers,
  selectedBuyer,
  onSelectBuyer,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  timeFilter,
  setTimeFilter,
  sortBy,
  setSortBy
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Search & Filters */}
      <div className="p-6 border-b border-gray-200 space-y-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, mobile, business..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="all">All Status</option>
            <option value="due">Due Only</option>
            <option value="clear">Clear Only</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="dueDesc">Highest Due</option>
            <option value="dueAsc">Lowest Due</option>
            <option value="nameAsc">Name (A-Z)</option>
            <option value="dateDesc">Recent Orders</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <p className="text-sm text-gray-600">
          Showing {buyers.length} buyer{buyers.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Buyer List */}
      <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
        {buyers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiSearch className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No buyers found</h3>
            <p className="text-gray-600">Try adjusting your filters</p>
          </div>
        ) : (
          buyers.map((buyer) => (
            <div
              key={buyer._id}
              onClick={() => onSelectBuyer(buyer)}
              className={`p-5 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                selectedBuyer?._id === buyer._id
                  ? 'bg-blue-50 border-l-4 border-blue-500'
                  : 'border-l-4 border-transparent'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{buyer.name}</h3>
                  <p className="text-sm text-gray-600">{buyer.businessName || 'No business name'}</p>
                </div>
                {buyer.totalDue > 0 ? (
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                    DUE
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    CLEAR
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {buyer.mobile}
                </span>
                <span className={`text-lg font-bold ${buyer.totalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{(buyer.totalDue || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BuyerListPanel;
