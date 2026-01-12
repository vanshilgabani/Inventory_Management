import React from 'react';
import Card from '../common/Card';
import { FiPhone, FiMail, FiBriefcase, FiAlertCircle, FiCheckCircle, FiCalendar, FiCreditCard, FiEye, FiDollarSign, FiSend, FiBarChart2 } from 'react-icons/fi';

const BuyerCard = ({
  buyer,
  getCreditUsage,
  getCreditStatusColor,
  getCreditStatusText,
  getCardBorderColor,
  getTimeAgo,
  onPayment,
  onViewHistory,
  onUpdateCredit,
  onSendWarning,
  onViewMonthlyHistory
}) => {
  const creditUsage = getCreditUsage(buyer);
  const creditStatusColor = getCreditStatusColor(creditUsage);
  const creditStatusText = getCreditStatusText(creditUsage);
  const cardBorderColor = getCardBorderColor(creditUsage);

  return (
    <Card className={`hover:shadow-lg transition-shadow ${cardBorderColor}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{buyer.name}</h3>
            {buyer.businessName && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FiBriefcase className="w-4 h-4" />
                <span>{buyer.businessName}</span>
              </div>
            )}
          </div>
          {buyer.totalDue > 0 ? (
            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
              <FiAlertCircle className="w-3 h-3" />
              Due
            </span>
          ) : (
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
              <FiCheckCircle className="w-3 h-3" />
              Clear
            </span>
          )}
        </div>

        {/* Contact Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FiPhone className="w-4 h-4" />
            <span>{buyer.mobile}</span>
          </div>
          {buyer.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FiMail className="w-4 h-4" />
              <span className="truncate">{buyer.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FiCalendar className="w-4 h-4" />
            <span>Last order: {getTimeAgo(buyer.lastOrderDate)}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-600 mb-1">Total Orders</p>
            <p className="text-lg font-semibold text-gray-900">{buyer.totalOrders || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Total Spent</p>
            <p className="text-lg font-semibold text-gray-900">
              ₹{((buyer.totalSpent || 0)).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Amount Paid</p>
            <p className="text-lg font-semibold text-green-600">
              ₹{((buyer.totalPaid || 0)).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Pending</p>
            <p className="text-lg font-semibold text-red-600">
              ₹{((buyer.totalDue || 0)).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Credit Limit Section */}
        {buyer.creditLimit > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 flex items-center gap-1">
                <FiCreditCard className="w-4 h-4" />
                Credit Used
              </span>
              <span className={`font-semibold ${creditUsage >= 80 ? 'text-red-600' : 'text-gray-900'}`}>
                {creditUsage.toFixed(0)}%
              </span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${creditStatusColor} transition-all duration-300`}
                style={{ width: `${creditUsage}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>₹{buyer.totalDue.toLocaleString('en-IN')}</span>
              <span>Limit: ₹{buyer.creditLimit.toLocaleString('en-IN')}</span>
            </div>

            {creditUsage >= 80 && (
              <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                <FiAlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <span className="text-xs text-orange-800 font-medium">
                  {creditStatusText}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
          <button
            onClick={() => onPayment(buyer)}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <FiDollarSign className="w-4 h-4" />
            Record Payment
          </button>

          <button
            onClick={() => onViewHistory(buyer)}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <FiEye className="w-4 h-4" />
            View Payments
          </button>

          <button
            onClick={() => onViewMonthlyHistory(buyer)}
            className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <FiBarChart2 className="w-4 h-4" />
            Monthly Report
          </button>

          <button
            onClick={() => onUpdateCredit(buyer)}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <FiCreditCard className="w-4 h-4" />
            Credit Limit
          </button>
        </div>

        {buyer.totalDue > 0 && buyer.email && (
          <button
            onClick={() => onSendWarning(buyer)}
            className="w-full px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <FiSend className="w-4 h-4" />
            Send Payment Reminder
          </button>
        )}
      </div>
    </Card>
  );
};

export default BuyerCard;
