import { useState, useEffect } from 'react';
import { FiRefreshCw, FiCheckCircle, FiXCircle, FiClock, FiAlertCircle } from 'react-icons/fi';
import axios from 'axios';

const SyncLogViewer = () => {
  const [syncLogs, setSyncLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, success, failed
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSyncLogs();
  }, []);

  const fetchSyncLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/sync/logs`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Sync logs response:', response.data);
      
      // ✅ FIX: Handle different response formats
      const logs = response.data.logs || response.data.data || response.data || [];
      setSyncLogs(Array.isArray(logs) ? logs : []);
    } catch (error) {
      console.error('Failed to fetch sync logs:', error);
      setSyncLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSyncLogs();
    setRefreshing(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <FiCheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <FiXCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <FiClock className="w-5 h-5 text-yellow-500" />;
      default:
        return <FiAlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredLogs = syncLogs.filter(log => {
    if (filter === 'all') return true;
    return log.status === filter;
  });

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-3">
          <FiRefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-gray-600">Loading sync logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sync Logs</h1>
            <p className="text-gray-600 mt-1">
              View Flipkart marketplace synchronization history
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-2 mb-6">
        {['all', 'success', 'failed', 'pending'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === status
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <span className="ml-2 text-xs">
                ({syncLogs.filter(log => log.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Logs List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <FiAlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No sync logs found</p>
          <p className="text-sm text-gray-500 mt-1">
            {filter === 'all' 
              ? 'Sync logs will appear here once marketplace sync runs'
              : `No ${filter} logs found`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <div
              key={log._id}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  {getStatusIcon(log.status)}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {log.syncType || 'Marketplace Sync'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(log.status)}`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {log.message || 'Sync completed'}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>{formatDate(log.createdAt)}</span>
                      {log.ordersProcessed !== undefined && (
                        <span>Orders: {log.ordersProcessed}</span>
                      )}
                      {log.duration && (
                        <span>Duration: {log.duration}s</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Details */}
              {log.status === 'failed' && log.error && (
                <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
                  <p className="text-sm text-red-800 font-mono">
                    {log.error}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SyncLogViewer;
