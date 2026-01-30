import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  FiRefreshCw,
  FiCheckCircle,
  FiXCircle,
  FiEdit,
  FiTrash2,
  FiPackage,
  FiFilter,
  FiCalendar,
  FiUser,
  FiAlertCircle,
  FiDownload
} from 'react-icons/fi';
import Card from '../components/common/Card';
import { format } from 'date-fns';

const SupplierSyncLogs = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterType, setFilterType] = useState('all'); // all, create, edit, delete
  const [filterStatus, setFilterStatus] = useState('all'); // all, success, failed
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [dateRange, setDateRange] = useState('7days'); // today, 7days, 30days, all
  const [searchQuery, setSearchQuery] = useState('');
  
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    if (isAdmin) {
      fetchSyncLogs();
      fetchCustomers();
    }
  }, [isAdmin, dateRange]);

  const fetchSyncLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sync/supplier-logs?dateRange=${dateRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setLogs(data.data.logs || []);
        setStats(data.data.stats || {});
      }
    } catch (error) {
      toast.error('Failed to load sync logs');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/admin/customers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setCustomers(data.data.customers || []);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const getFilteredLogs = () => {
    let filtered = [...logs];

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(log => log.syncType === filterType);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(log => 
        filterStatus === 'success' ? log.success : !log.success
      );
    }

    // Customer filter
    if (filterCustomer !== 'all') {
      filtered = filtered.filter(log => log.customerTenantId === filterCustomer);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.orderChallanNumber?.toLowerCase().includes(query) ||
        log.customerName?.toLowerCase().includes(query) ||
        log.buyerName?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const exportToCSV = () => {
    const filtered = getFilteredLogs();
    const headers = ['Date', 'Type', 'Status', 'Customer', 'Challan', 'Buyer', 'Items', 'Amount', 'Message'];
    
    const rows = filtered.map(log => [
      format(new Date(log.syncedAt), 'yyyy-MM-dd HH:mm:ss'),
      log.syncType,
      log.success ? 'Success' : 'Failed',
      log.customerName || '-',
      log.orderChallanNumber || '-',
      log.buyerName || '-',
      log.itemsCount || 0,
      log.totalAmount || 0,
      log.errorMessage || 'Success'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplier-sync-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('CSV exported successfully');
  };

  const getSyncIcon = (type) => {
    switch (type) {
      case 'create':
        return <FiPackage className="text-green-600" />;
      case 'edit':
        return <FiEdit className="text-blue-600" />;
      case 'delete':
        return <FiTrash2 className="text-red-600" />;
      default:
        return <FiRefreshCw className="text-gray-600" />;
    }
  };

  const getSyncColor = (type) => {
    switch (type) {
      case 'create':
        return 'bg-green-100 text-green-700';
      case 'edit':
        return 'bg-blue-100 text-blue-700';
      case 'delete':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredLogs = getFilteredLogs();

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <FiXCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
          <p className="text-gray-600 mt-2">Only admins can access sync logs</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <FiRefreshCw className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <FiRefreshCw className="text-indigo-600" />
          Supplier Sync Logs
        </h1>
        <p className="text-gray-600 mt-1">Track all order syncs to customer accounts</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Syncs</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.totalSyncs || 0}</p>
            </div>
            <div className="bg-indigo-100 p-3 rounded-lg">
              <FiRefreshCw className="text-indigo-600" size={24} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Successful</p>
              <p className="text-3xl font-bold text-green-600">{stats?.successfulSyncs || 0}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <FiCheckCircle className="text-green-600" size={24} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Failed</p>
              <p className="text-3xl font-bold text-red-600">{stats?.failedSyncs || 0}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <FiXCircle className="text-red-600" size={24} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Creates</p>
              <p className="text-3xl font-bold text-green-600">{stats?.createSyncs || 0}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <FiPackage className="text-green-600" size={24} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Edits/Deletes</p>
              <p className="text-3xl font-bold text-blue-600">
                {(stats?.editSyncs || 0) + (stats?.deleteSyncs || 0)}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <FiEdit className="text-blue-600" size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FiCalendar className="inline mr-1" size={14} />
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Sync Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FiFilter className="inline mr-1" size={14} />
              Sync Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="create">Create</option>
              <option value="edit">Edit</option>
              <option value="delete">Delete</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Customer Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FiUser className="inline mr-1" size={14} />
              Customer
            </label>
            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Customers</option>
              {customers.map(customer => (
                <option key={customer._id} value={customer._id}>
                  {customer.name || customer.email}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Challan number, buyer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4 pt-4 border-t">
          <button
            onClick={fetchSyncLogs}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <FiRefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <FiDownload size={16} />
            Export CSV
          </button>
          <div className="flex-1 text-right text-sm text-gray-600 flex items-center justify-end">
            Showing {filteredLogs.length} of {logs.length} logs
          </div>
        </div>
      </Card>

      {/* Logs List */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <FiAlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600">No sync logs found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          </Card>
        ) : (
          filteredLogs.map((log) => (
            <Card key={log._id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`p-3 rounded-lg ${getSyncColor(log.syncType).split(' ')[0]}`}>
                  {getSyncIcon(log.syncType)}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSyncColor(log.syncType)}`}>
                          {log.syncType.toUpperCase()}
                        </span>
                        {log.success ? (
                          <FiCheckCircle className="text-green-600" size={16} />
                        ) : (
                          <FiXCircle className="text-red-600" size={16} />
                        )}
                        <span className="text-sm text-gray-500">
                          {format(new Date(log.syncedAt), 'PPp')}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900">
                        Order #{log.orderChallanNumber}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Customer: <span className="font-medium">{log.customerName || 'Unknown'}</span>
                        {log.buyerName && (
                          <> • Buyer: <span className="font-medium">{log.buyerName}</span></>
                        )}
                      </p>
                    </div>

                    {/* Amount */}
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        ₹{(log.totalAmount || 0).toLocaleString('en-IN')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {log.itemsCount || 0} items
                      </p>
                    </div>
                  </div>

                  {/* Error Message */}
                  {!log.success && log.errorMessage && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      <FiAlertCircle className="inline mr-1" size={14} />
                      {log.errorMessage}
                    </div>
                  )}

                  {/* Success Details */}
                  {log.success && log.syncType === 'create' && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                      <FiCheckCircle className="inline mr-1" size={14} />
                      Successfully created receiving record for customer
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default SupplierSyncLogs;
