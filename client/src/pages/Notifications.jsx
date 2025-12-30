import { useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';
import GroupedNotificationCard from '../components/common/GroupedNotificationCard';
import Card from '../components/common/Card';
import Loader from '../components/common/Loader';
import { FiBell, FiFilter, FiDownload } from 'react-icons/fi';
import toast from 'react-hot-toast';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'active',
    severity: '',
    isTrusted: '',
    hasEmail: ''
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchNotifications();
  }, [filters]);
const fetchNotifications = async () => {
  setLoading(true);
  try {
    const [notifData, summaryData] = await Promise.all([
      notificationService.getAllNotifications(filters),
      notificationService.getNotificationSummary()
    ]);
    
    console.log('📊 Fetched notifications:', notifData); // ADD THIS
    console.log('📊 Applied filters:', filters); // ADD THIS
    console.log('📊 Summary:', summaryData); // ADD THIS
    
    setNotifications(notifData);
    setSummary(summaryData);
  } catch (error) {
    toast.error('Failed to fetch notifications');
    console.error('Error fetching notifications:', error);
  } finally {
    setLoading(false);
  }
};

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    // TODO: Implement CSV export
    toast.success('Export feature coming soon!');
  };

  // Filter by search query
  const filteredNotifications = notifications.filter(notif => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      notif.buyerName?.toLowerCase().includes(query) ||
      notif.businessName?.toLowerCase().includes(query) ||
      notif.buyerContact?.includes(query)
    );
  });

  // Group notifications by buyer
  const groupedNotifications = {};

  filteredNotifications.forEach(notif => {
    const buyerId = notif.buyerId?._id || notif.buyerId;
    
    if (!groupedNotifications[buyerId]) {
      groupedNotifications[buyerId] = {
        buyer: notif.buyerId,
        buyerName: notif.buyerName,
        businessName: notif.businessName,
        buyerContact: notif.buyerContact,
        buyerEmail: notif.buyerEmail,
        isTrusted: notif.isTrusted,
        notifications: []
      };
    }
    
    groupedNotifications[buyerId].notifications.push(notif);
  });

  // Convert to array and sort by highest severity
  const groupedArray = Object.values(groupedNotifications).sort((a, b) => {
    const severityOrder = { critical: 4, urgent: 3, moderate: 2, warning: 1 };
    const maxSeverityA = Math.max(...a.notifications.map(n => severityOrder[n.severity] || 0));
    const maxSeverityB = Math.max(...b.notifications.map(n => severityOrder[n.severity] || 0));
    return maxSeverityB - maxSeverityA;
  });

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FiBell className="text-blue-600" size={32} />
            Payment Notifications
          </h1>
          <p className="text-gray-600 mt-2">Track overdue payments and credit limits</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiDownload />
          Export Report
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Critical</span>
                <span className="text-3xl">🔴</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{summary.critical.count}</p>
              <p className="text-sm text-red-600 mt-2">
                ₹{summary.critical.amount.toLocaleString('en-IN')}
              </p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Urgent</span>
                <span className="text-3xl">🟠</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{summary.urgent.count}</p>
              <p className="text-sm text-orange-600 mt-2">
                ₹{summary.urgent.amount.toLocaleString('en-IN')}
              </p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Moderate</span>
                <span className="text-3xl">🟡</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{summary.moderate.count}</p>
              <p className="text-sm text-yellow-600 mt-2">
                ₹{summary.moderate.amount.toLocaleString('en-IN')}
              </p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Warning</span>
                <span className="text-3xl">⚠️</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{summary.warning.count}</p>
              <p className="text-sm text-blue-600 mt-2">
                ₹{summary.warning.amount.toLocaleString('en-IN')}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by buyer name, business, or mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => handleFilterChange('status', 'all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filters.status === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleFilterChange('status', 'active')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filters.status === 'active'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => handleFilterChange('status', 'resolved')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filters.status === 'resolved'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Resolved
              </button>
              <button
                onClick={() => handleFilterChange('status', 'dismissed')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filters.status === 'dismissed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Dismissed
              </button>
              <button
                onClick={() => handleFilterChange('status', 'snoozed')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filters.status === 'snoozed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Snoozed
              </button>
            </div>
          </div>

          {/* Severity Filters */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => handleFilterChange('severity', '')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filters.severity === ''
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleFilterChange('severity', 'critical')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filters.severity === 'critical'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              🔴 Critical
            </button>
            <button
              onClick={() => handleFilterChange('severity', 'urgent')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filters.severity === 'urgent'
                  ? 'bg-orange-600 text-white'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
              }`}
            >
              🟠 Urgent
            </button>
            <button
              onClick={() => handleFilterChange('severity', 'moderate')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filters.severity === 'moderate'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
              }`}
            >
              🟡 Moderate
            </button>
            <button
              onClick={() => handleFilterChange('severity', 'warning')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filters.severity === 'warning'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              ⚠️ Warning
            </button>
          </div>
        </div>
      </Card>

      {/* Notifications List */}
      <div>
        {groupedArray.length === 0 ? (
          <Card>
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No notifications found</h3>
              <p className="text-gray-600">All payments are up to date or no matches for your filters.</p>
            </div>
          </Card>
        ) : (
          groupedArray.map((group, idx) => (
            <GroupedNotificationCard 
              key={idx} 
              group={group} 
              onUpdate={fetchNotifications}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
