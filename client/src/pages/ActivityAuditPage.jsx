import React, { useState, useEffect } from 'react';
import { 
  FiSearch, 
  FiFilter, 
  FiDownload, 
  FiEye,
  FiClock,
  FiUser,
  FiEdit,
  FiTrash2,
  FiRotateCcw
} from 'react-icons/fi';
import { getActionLogs, getActionLogById } from '../services/actionLogService';
import toast from 'react-hot-toast';

const ActivityAuditPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    module: '',
    actionType: '',
    startDate: '',
    endDate: '',
    search: ''
  });
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });

  useEffect(() => {
    fetchLogs();
  }, [filters, pagination.page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getActionLogs({
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      });
      setLogs(data.logs);
      setPagination(prev => ({ ...prev, total: data.pagination.total }));
    } catch (error) {
      toast.error('Failed to fetch activity logs');
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = async (logId) => {
    try {
      const data = await getActionLogById(logId);
      setSelectedLog(data.log);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Failed to fetch log details');
    }
  };

  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'edit': return <FiEdit className="text-blue-600" />;
      case 'delete': return <FiTrash2 className="text-red-600" />;
      default: return <FiClock className="text-gray-600" />;
    }
  };

  const getModuleBadge = (module) => {
    const colors = {
      sales: 'bg-purple-100 text-purple-700',
      directSales: 'bg-green-100 text-green-700',
      inventory: 'bg-blue-100 text-blue-700',
      factory: 'bg-orange-100 text-orange-700'
    };
    return colors[module] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Activity Audit Trail</h1>
          <p className="text-gray-600">Track all edit and delete actions with screenshots</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by user, item name..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Module Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Module
              </label>
              <select
                value={filters.module}
                onChange={(e) => setFilters({ ...filters, module: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Modules</option>
                <option value="sales">Marketplace Sales</option>
                <option value="directSales">Direct Sales</option>
                <option value="inventory">Inventory</option>
                <option value="factory">Factory</option>
              </select>
            </div>

            {/* Action Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action Type
              </label>
              <select
                value={filters.actionType}
                onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Actions</option>
                <option value="edit">Edit</option>
                <option value="delete">Delete</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Actions */}
            <div className="md:col-span-2 flex items-end gap-2">
              <button
                onClick={fetchLogs}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <FiFilter />
                Apply Filters
              </button>
              <button
                onClick={() => {
                  setFilters({ module: '', actionType: '', startDate: '', endDate: '', search: '' });
                  setPagination({ ...pagination, page: 1 });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-600 mb-1">Total Actions</p>
            <p className="text-2xl font-bold text-gray-800">{pagination.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-600 mb-1">Edits</p>
            <p className="text-2xl font-bold text-blue-600">
              {logs.filter(l => l.actionType === 'edit').length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-600 mb-1">Deletes</p>
            <p className="text-2xl font-bold text-red-600">
              {logs.filter(l => l.actionType === 'delete').length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-600 mb-1">Undone</p>
            <p className="text-2xl font-bold text-orange-600">
              {logs.filter(l => l.undone).length}
            </p>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FiClock className="text-6xl mb-4" />
              <p>No activity logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Module</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <FiUser className="text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-800">{log.userName}</p>
                            <p className="text-xs text-gray-500">{log.userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.actionType)}
                          <span className="text-sm font-medium capitalize">{log.actionType}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getModuleBadge(log.module)}`}>
                          {log.module}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                        {log.itemName || log.itemId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.undone ? (
                          <span className="flex items-center gap-1 text-xs text-orange-600">
                            <FiRotateCcw />
                            Undone
                          </span>
                        ) : (
                          <span className="text-xs text-green-600">Active</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => viewDetails(log._id)}
                          className="flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm"
                        >
                          <FiEye />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {logs.length > 0 && (
            <div className="px-6 py-4 border-t flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page * pagination.limit >= pagination.total}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedLog && (
          <LogDetailModal
            log={selectedLog}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedLog(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

// Detail Modal Component
const LogDetailModal = ({ log, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Action Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">User</p>
              <p className="font-semibold text-gray-800">{log.userName}</p>
              <p className="text-xs text-gray-500">{log.userEmail}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Timestamp</p>
              <p className="font-semibold text-gray-800">
                {new Date(log.timestamp).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Module</p>
              <p className="font-semibold text-gray-800 capitalize">{log.module}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Action Type</p>
              <p className="font-semibold text-gray-800 capitalize">{log.actionType}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Item</p>
              <p className="font-semibold text-gray-800">{log.itemName || log.itemId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">IP Address</p>
              <p className="font-semibold text-gray-800">{log.ipAddress || 'N/A'}</p>
            </div>
          </div>

          {/* Device Info */}
          {log.deviceInfo && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Device Information</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Browser</p>
                  <p className="font-semibold">{log.deviceInfo.browser}</p>
                </div>
                <div>
                  <p className="text-gray-600">OS</p>
                  <p className="font-semibold">{log.deviceInfo.os}</p>
                </div>
                <div>
                  <p className="text-gray-600">Device</p>
                  <p className="font-semibold">{log.deviceInfo.device}</p>
                </div>
              </div>
            </div>
          )}

          {/* Screenshots */}
          {(log.screenshotBefore || log.screenshotAfter) && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Screenshots</p>
              <div className="grid grid-cols-2 gap-4">
                {log.screenshotBefore && (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">Before</p>
                    <img
                      src={log.screenshotBefore}
                      alt="Before"
                      className="w-full border rounded-lg"
                    />
                  </div>
                )}
                {log.screenshotAfter && (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">After</p>
                    <img
                      src={log.screenshotAfter}
                      alt="After"
                      className="w-full border rounded-lg"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Changed Fields */}
          {log.changedFields && log.changedFields.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Changed Fields</p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                {log.changedFields.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-4 text-sm">
                    <span className="font-medium text-gray-700 min-w-[120px]">{field.field}:</span>
                    <span className="text-red-600 line-through">{field.oldValue}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-green-600">{field.newValue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reason */}
          {log.reason && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 mb-1">Reason</p>
              <p className="text-sm text-blue-800">{log.reason}</p>
            </div>
          )}

          {/* Undone Status */}
          {log.undone && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm font-medium text-orange-900">
                ⚠️ This action was undone on {new Date(log.undoneAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityAuditPage;
