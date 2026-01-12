import React, { useState } from 'react';
import Modal from '../common/Modal';
import { FiCalendar, FiPackage, FiDollarSign, FiShoppingCart, FiCheckCircle, FiAlertCircle, FiArrowRight } from 'react-icons/fi';
import { format } from 'date-fns';

const MonthlyHistoryModal = ({ isOpen, onClose, selectedBuyer, monthlyHistory }) => {
  const [selectedMonth, setSelectedMonth] = useState('all');

  if (!selectedBuyer) return null;

  // Get unique months from history
  const availableMonths = monthlyHistory.map(item => `${item.month}-${item.year}`);
  const uniqueMonths = ['all', ...new Set(availableMonths)];

  // Filter data based on selected month
  const filteredData = selectedMonth === 'all'
    ? monthlyHistory
    : monthlyHistory.filter(item => `${item.month}-${item.year}` === selectedMonth);

  // Handle "View Details" button click
  const handleViewDetails = (month, year) => {
    setSelectedMonth(`${month}-${year}`);
  };

  // Get status badge for a month
  const getStatusBadge = (monthData) => {
    const pending = monthData.totalAmount - monthData.totalPaid;
    
    if (pending === 0) {
      return {
        text: 'Paid',
        icon: FiCheckCircle,
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
        iconColor: 'text-green-600'
      };
    } else if (monthData.totalPaid > 0) {
      return {
        text: 'Due',
        icon: FiAlertCircle,
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-700',
        iconColor: 'text-orange-600'
      };
    } else {
      return {
        text: 'Pending',
        icon: FiAlertCircle,
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
        iconColor: 'text-red-600'
      };
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Monthly Purchase History" size="large">
      <div className="space-y-4">
        <div className="p-4 bg-purple-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-1">{selectedBuyer.name}</h3>
          <p className="text-sm text-gray-600">
            Detailed month-wise purchase breakdown
          </p>
        </div>

        {/* Month Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FiCalendar className="inline w-4 h-4 mr-1" />
            Filter by Month
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Months</option>
            {uniqueMonths.slice(1).map(month => (
              <option key={month} value={month}>
                {month.replace('-', ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Content Area */}
        {filteredData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FiPackage className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No purchase history found</p>
          </div>
        ) : selectedMonth === 'all' ? (
          /* GRID VIEW - All Months */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
            {filteredData.map((monthData, index) => {
              const status = getStatusBadge(monthData);
              const StatusIcon = status.icon;
              const pending = monthData.totalAmount - monthData.totalPaid;

              return (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg hover:shadow-lg transition-all duration-200 overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FiCalendar className="w-4 h-4 text-purple-600" />
                        <h4 className="font-semibold text-gray-900">
                          {monthData.month} {monthData.year}
                        </h4>
                      </div>
                      <span className={`px-2 py-1 ${status.bgColor} ${status.textColor} text-xs font-medium rounded-full flex items-center gap-1`}>
                        <StatusIcon className={`w-3 h-3 ${status.iconColor}`} />
                        {status.text}
                      </span>
                    </div>
                    {monthData.billGenerated && (
                      <span className="inline-flex px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                        📄 Bill Generated
                      </span>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    {/* Total Units */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-600">
                        <FiPackage className="w-4 h-4" />
                        <span className="text-sm">Total Units</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">{monthData.totalUnits}</span>
                    </div>

                    {/* Total Amount */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-600">
                        <FiDollarSign className="w-4 h-4" />
                        <span className="text-sm">Total Amount</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">
                        ₹{monthData.totalAmount.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Orders */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-600">
                        <FiShoppingCart className="w-4 h-4" />
                        <span className="text-sm">Orders</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">{monthData.totalOrders}</span>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-200 my-2"></div>

                    {/* Paid Amount */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">✅ Paid</span>
                      <span className="font-semibold text-green-600">
                        ₹{monthData.totalPaid.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Pending Amount */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">⚠️ Due</span>
                      <span className={`font-semibold ${pending > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₹{pending.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-3 bg-gray-50 border-t border-gray-200">
                    <button
                      onClick={() => handleViewDetails(monthData.month, monthData.year)}
                      className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      View Details
                      <FiArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* DETAILED VIEW - Single Month */
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {filteredData.map((monthData, index) => {
              const status = getStatusBadge(monthData);
              const StatusIcon = status.icon;

              return (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg"
                >
                  {/* Month Header */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <FiCalendar className="w-5 h-5 text-purple-600" />
                      <h4 className="font-semibold text-gray-900 text-lg">
                        {monthData.month} {monthData.year}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {monthData.billGenerated && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          📄 Bill Generated
                        </span>
                      )}
                      <span className={`px-2 py-1 ${status.bgColor} ${status.textColor} text-xs font-medium rounded-full flex items-center gap-1`}>
                        <StatusIcon className={`w-3 h-3 ${status.iconColor}`} />
                        {status.text}
                      </span>
                    </div>
                  </div>

                  {/* Month Stats Grid */}
                  <div className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <FiPackage className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                        <p className="text-xs text-gray-600 mb-1">Total Units</p>
                        <p className="text-xl font-bold text-gray-900">{monthData.totalUnits}</p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <FiDollarSign className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                        <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                        <p className="text-xl font-bold text-gray-900">
                          ₹{monthData.totalAmount.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <FiShoppingCart className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                        <p className="text-xs text-gray-600 mb-1">Orders</p>
                        <p className="text-xl font-bold text-gray-900">{monthData.totalOrders}</p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <FiCheckCircle className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                        <p className="text-xs text-gray-600 mb-1">Paid</p>
                        <p className="text-xl font-bold text-green-600">
                          ₹{monthData.totalPaid.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    {/* Pending Amount */}
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg mb-4">
                      <span className="text-sm font-medium text-gray-700">Pending Amount</span>
                      <span className="text-lg font-bold text-red-600">
                        ₹{(monthData.totalAmount - monthData.totalPaid).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Orders List */}
                    {monthData.orders && monthData.orders.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-gray-700 mb-3">Orders:</h5>
                        <div className="space-y-2">
                          {monthData.orders.map((order, orderIndex) => (
                            <div
                              key={orderIndex}
                              className="p-3 bg-gray-50 rounded-lg text-sm flex items-center justify-between hover:bg-gray-100 transition-colors"
                            >
                              <div>
                                <span className="font-medium text-gray-900">{order.challanNumber}</span>
                                <span className="text-gray-500 ml-3">
                                  {format(new Date(order.date), 'dd MMM yyyy')}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-gray-900">
                                  {order.totalUnits} units
                                </p>
                                <p className="text-gray-600">
                                  ₹{order.totalAmount.toLocaleString('en-IN')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Close Button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default MonthlyHistoryModal;
