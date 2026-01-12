import React from 'react';
import { FiUsers, FiPhone, FiMail, FiCalendar, FiDollarSign, FiFileText, FiBarChart2, FiSend } from 'react-icons/fi';
import { format } from 'date-fns';

const BuyerDetailPanel = ({
  buyer,
  onRecordPayment,
  onViewHistory,
  onViewMonthlyHistory,
  onSendReminder
}) => {
  if (!buyer) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center h-full flex items-center justify-center">
        <div>
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiUsers className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a buyer</h3>
          <p className="text-gray-600">Choose a buyer from the list to view detailed information</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-6">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{buyer.name}</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <FiUsers className="w-4 h-4" />
            <span>{buyer.businessName || 'No business name'}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <FiPhone className="w-4 h-4" />
            <span>{buyer.mobile}</span>
          </div>
          {buyer.email && (
            <div className="flex items-center gap-2 text-gray-600">
              <FiMail className="w-4 h-4" />
              <span>{buyer.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600">
            <FiCalendar className="w-4 h-4" />
            <span>
              Last order: {buyer.lastOrderDate ? format(new Date(buyer.lastOrderDate), 'dd MMM yyyy') : 'Never'}
            </span>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Overview</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-600 mb-1">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900">{buyer.totalOrders || 0}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-600 mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-gray-900">₹{(buyer.totalSpent || 0).toFixed(2)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-xs text-green-700 mb-1">Amount Paid</p>
            <p className="text-2xl font-bold text-green-600">₹{(buyer.totalPaid || 0).toFixed(2)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <p className="text-xs text-red-700 mb-1">Pending</p>
            <p className="text-2xl font-bold text-red-600">₹{(buyer.totalDue || 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Actions</h3>
        <div className="space-y-3">
          <button
            onClick={() => onRecordPayment(buyer)}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <FiDollarSign className="w-5 h-5" />
            Record Payment
          </button>

          <button
            onClick={() => onViewHistory(buyer)}
            className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <FiFileText className="w-5 h-5" />
            Payment History
          </button>

          <button
            onClick={() => onViewMonthlyHistory(buyer)}
            className="w-full px-4 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <FiBarChart2 className="w-5 h-5" />
            Monthly Report
          </button>

          {buyer.totalDue > 0 && buyer.email && (
            <button
              onClick={() => onSendReminder(buyer)}
              className="w-full px-4 py-3 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <FiSend className="w-5 h-5" />
              Send Reminder
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuyerDetailPanel;
