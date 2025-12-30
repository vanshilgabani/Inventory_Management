import { useState, useEffect, useRef } from 'react';
import { notificationService } from '../services/notificationService';
import { FiBell, FiX, FiAlertTriangle, FiCreditCard } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDropdownData();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchCount = async () => {
    try {
      const data = await notificationService.getNotificationCount();
      setCount(data.count);
    } catch (error) {
      console.error('Error fetching count:', error);
    }
  };

  const fetchDropdownData = async () => {
    setLoading(true);
    try {
      const [summaryData, notifData] = await Promise.all([
        notificationService.getNotificationSummary(),
        notificationService.getAllNotifications({ status: 'active' })
      ]);
      setSummary(summaryData);
      setNotifications(notifData.slice(0, 10)); // Top 10 notifications
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'text-red-600 bg-red-50 border-red-200',
      urgent: 'text-orange-600 bg-orange-50 border-orange-200',
      moderate: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      warning: 'text-blue-600 bg-blue-50 border-blue-200'
    };
    return colors[severity] || 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      critical: '🔴',
      urgent: '🟠',
      moderate: '🟡',
      warning: '⚠️'
    };
    return icons[severity] || '📌';
  };

  const getNotificationTypeLabel = (type) => {
    const labels = {
      overdue_payment: 'Overdue Payment',
      credit_limit_80: 'Credit Limit Warning',
      credit_exceeded: 'Credit Exceeded',
      large_amount: 'Large Amount Due'
    };
    return labels[type] || type;
  };

  const getNotificationIcon = (type) => {
    const icons = {
      overdue_payment: <FiAlertTriangle className="text-red-600" />,
      credit_limit_80: <FiCreditCard className="text-orange-600" />,
      credit_exceeded: <FiCreditCard className="text-red-600" />,
      large_amount: <FiAlertTriangle className="text-orange-600" />
    };
    return icons[type] || <FiBell />;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <FiBell size={20} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-[600px] overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FiBell className="text-blue-600" />
              Notifications
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <FiX size={20} />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading...</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              {summary && (summary.critical.count > 0 || summary.urgent.count > 0) && (
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <div className="grid grid-cols-2 gap-2">
                    {summary.critical.count > 0 && (
                      <div className="bg-white p-3 rounded-lg border border-red-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">Critical</span>
                          <span className="text-red-600 font-bold">🔴 {summary.critical.count}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          ₹{summary.critical.amount.toLocaleString('en-IN')}
                        </p>
                      </div>
                    )}
                    {summary.urgent.count > 0 && (
                      <div className="bg-white p-3 rounded-lg border border-orange-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">Urgent</span>
                          <span className="text-orange-600 font-bold">🟠 {summary.urgent.count}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          ₹{summary.urgent.amount.toLocaleString('en-IN')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="text-5xl mb-3">🎉</div>
                    <p className="text-gray-600 font-medium">No active notifications</p>
                    <p className="text-sm text-gray-500 mt-1">All payments are up to date!</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification._id}
                      className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/notifications');
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-xl mt-1">{getNotificationIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          {/* Buyer Name & Type */}
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-gray-900 truncate">
                              {notification.businessName || notification.buyerName}
                            </p>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSeverityColor(notification.severity)} border`}>
                              {notification.severity}
                            </span>
                          </div>
                          
                          {/* Contact */}
                          <p className="text-xs text-gray-600 mb-2">
                            {notification.buyerContact}
                          </p>
                          
                          {/* Type Label */}
                          <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                            {getSeverityIcon(notification.severity)} {getNotificationTypeLabel(notification.type)}
                          </p>
                          
                          {/* Details based on type */}
                          {notification.type === 'overdue_payment' ? (
                            <div className="flex items-center justify-between text-sm">
                              <div>
                                <p className="text-red-600 font-semibold">
                                  ₹{notification.amountDue?.toLocaleString('en-IN')} due
                                </p>
                                <p className="text-xs text-gray-500">
                                  {notification.pendingOrdersCount || 0} orders • {notification.daysOverdue} days
                                </p>
                              </div>
                            </div>
                          ) : notification.type === 'credit_limit_80' ? (
                            <div className="flex items-center justify-between text-sm">
                              <div>
                                <p className="text-orange-600 font-semibold">
                                  {notification.creditUsagePercent}% credit used
                                </p>
                                <p className="text-xs text-gray-500">
                                  ₹{notification.amountDue?.toLocaleString('en-IN')} outstanding
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm">
                              <p className="text-red-600 font-semibold">
                                ₹{notification.amountDue?.toLocaleString('en-IN')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="p-3 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/notifications');
                    }}
                    className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 py-2 hover:bg-blue-50 rounded transition-colors"
                  >
                    View All Notifications →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
