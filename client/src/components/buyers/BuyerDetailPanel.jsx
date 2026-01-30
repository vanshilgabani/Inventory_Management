import React from 'react';
import { FiUsers, FiPhone, FiMail, FiCalendar, FiDollarSign, FiFileText, FiBarChart2, FiSend, FiCheckCircle } from 'react-icons/fi'; // ✅ ADD FiCheckCircle
import { format } from 'date-fns';

const BuyerDetailPanel = ({ 
  buyer, 
  onRecordPayment, 
  onViewHistory, 
  onViewMonthlyHistory, 
  onSendReminder,
  onLinkToTenant  // ✅ ADD THIS PROP
}) => {
  if (!buyer) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <FiUsers size={48} className="mx-auto mb-4 opacity-50" />
          <p>Choose a buyer from the list to view detailed information</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{buyer.name}</h2>
        {buyer.businessName && (
          <p className="text-gray-600 mt-1">{buyer.businessName}</p>
        )}
      </div>

      {/* Contact Info */}
      <div className="space-y-3 mb-6">
        {buyer.mobile && (
          <div className="flex items-center gap-3 text-gray-700">
            <FiPhone className="text-blue-600" size={16} />
            <span>{buyer.mobile}</span>
          </div>
        )}
        {buyer.email && (
          <div className="flex items-center gap-3 text-gray-700">
            <FiMail className="text-purple-600" size={16} />
            <span>{buyer.email}</span>
          </div>
        )}
        {buyer.lastOrderDate && (
          <div className="flex items-center gap-3 text-gray-700">
            <FiCalendar className="text-green-600" size={16} />
            <span>Last order: {format(new Date(buyer.lastOrderDate), 'PPP')}</span>
          </div>
        )}
      </div>

      {/* ✅ ADD TENANT SYNC STATUS HERE - AFTER CONTACT INFO, BEFORE STATS */}
      {buyer.syncEnabled && buyer.customerTenantId && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <FiCheckCircle className="text-green-600" size={16} />
            <span className="text-sm font-semibold text-green-800">Auto-Sync Enabled</span>
          </div>
          {buyer.lastSyncedAt && (
            <p className="text-xs text-green-600">
              Last synced: {format(new Date(buyer.lastSyncedAt), 'PPp')}
            </p>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-blue-600">{buyer.totalOrders || 0}</p>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Total Spent</p>
          <p className="text-2xl font-bold text-purple-600">
            ₹{(buyer.totalSpent || 0).toFixed(2)}
          </p>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Amount Paid</p>
          <p className="text-2xl font-bold text-green-600">
            ₹{(buyer.totalPaid || 0).toFixed(2)}
          </p>
        </div>
        
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Pending</p>
          <p className="text-2xl font-bold text-red-600">
            ₹{(buyer.totalDue || 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={() => onRecordPayment(buyer)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <FiDollarSign size={18} />
          Record Payment
        </button>

        <button
          onClick={() => onViewHistory(buyer)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          <FiFileText size={18} />
          View Payment History
        </button>

        <button
          onClick={() => onViewMonthlyHistory(buyer)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium"
        >
          <FiBarChart2 size={18} />
          Monthly Report
        </button>

        {/* ✅ ADD LINK TO TENANT BUTTON */}
        <button
          onClick={() => onLinkToTenant(buyer)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium"
        >
          <FiUsers size={18} />
          {buyer.syncEnabled ? 'Manage Tenant Link' : 'Link to Tenant'}
        </button>

        {buyer.totalDue > 0 && buyer.email && (
          <button
            onClick={() => onSendReminder(buyer)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium"
          >
            <FiSend size={18} />
            Send Payment Reminder
          </button>
        )}
      </div>
    </div>
  );
};

export default BuyerDetailPanel;
