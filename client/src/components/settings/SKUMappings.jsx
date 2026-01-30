import { useState, useEffect } from 'react';
import { skuMappingService } from '../../services/skuMappingService';
import toast from 'react-hot-toast';
import { 
  FiTrash2, 
  FiRefreshCw, 
  FiPackage, 
  FiFilter,
  FiSearch,
  FiAlertCircle
} from 'react-icons/fi';
import Card from '../common/Card';

const SKUMappings = ({ settings }) => {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState(null);

  const accounts = settings?.marketplaceAccounts || [];

  useEffect(() => {
    fetchMappings();
  }, [selectedAccount]);

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const data = await skuMappingService.getAllMappings(selectedAccount);
      setMappings(data);
    } catch (error) {
      toast.error('Failed to load mappings');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, sku) => {
    if (!window.confirm(`Delete mapping for "${sku}"?\n\nFuture imports will ask to map this SKU again.`)) {
      return;
    }

    try {
      setDeleting(id);
      await skuMappingService.deleteMapping(id);
      toast.success('Mapping deleted');
      fetchMappings();
    } catch (error) {
      toast.error('Failed to delete mapping');
    } finally {
      setDeleting(null);
    }
  };

  // Filter mappings by search query
  const filteredMappings = mappings.filter(m => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      m.marketplaceSKU.toLowerCase().includes(query) ||
      m.design.toLowerCase().includes(query) ||
      m.color.toLowerCase().includes(query) ||
      m.size.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: mappings.length,
    byAccount: {}
  };

  mappings.forEach(m => {
    stats.byAccount[m.accountName] = (stats.byAccount[m.accountName] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            🗺️ SKU Mappings
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage marketplace SKU to inventory mappings for faster imports
          </p>
        </div>
        <button
          onClick={fetchMappings}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-300"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <FiPackage className="text-indigo-600 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Mappings</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            </div>
          </div>
        </Card>

        {Object.entries(stats.byAccount).slice(0, 2).map(([account, count]) => (
          <Card key={account} className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-xl">
                <FiPackage className="text-green-600 text-xl" />
              </div>
              <div>
                <p className="text-sm text-gray-500 truncate">{account}</p>
                <p className="text-2xl font-bold text-gray-800">{count}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Info Box */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <FiAlertCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">💡 How SKU Mappings Work:</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li>Created automatically when you map SKUs during CSV import</li>
              <li><strong>Mappings are shared across ALL marketplace accounts</strong> in your organization (Ignore Account Filters and Account displayed per mapping...)</li>
              <li>Future imports use these mappings for instant recognition</li>
              <li>Deleting a mapping requires re-mapping on next import</li>
              <li>Size conversions are hardcoded: 28=S, 30=M, 32=L, 34=XL, 36=XXL</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Filters & Search */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Account Filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiFilter className="inline mr-1" />
              Filter by Account
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Accounts</option>
              {accounts.map(acc => (
                <option key={acc._id} value={acc.accountName}>
                  {acc.accountName}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiSearch className="inline mr-1" />
              Search
            </label>
            <input
              type="text"
              placeholder="Search SKU, design, color, size..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      </Card>

      {/* Mappings Table */}
      <Card>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading mappings...</p>
          </div>
        ) : filteredMappings.length === 0 ? (
          <div className="text-center py-12">
            {mappings.length === 0 ? (
              <>
                <FiPackage className="mx-auto text-6xl text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  No SKU Mappings Yet
                </h3>
                <p className="text-gray-500 mb-4">
                  Mappings will appear here after your first CSV import with unknown SKUs
                </p>
                <div className="inline-block px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                  Go to <strong>Marketplace Sales → Import CSV</strong> to create mappings
                </div>
              </>
            ) : (
              <>
                <FiSearch className="mx-auto text-6xl text-gray-300 mb-4" />
                <p className="text-gray-500">No mappings match your search</p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Marketplace SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Design
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Color
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMappings.map((mapping) => (
                  <tr key={mapping._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-gray-900">
                        {mapping.marketplaceSKU}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{mapping.accountName}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{mapping.design}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{mapping.color}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded">
                        {mapping.size}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{mapping.usageCount || 0}×</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {new Date(mapping.lastUsedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleDelete(mapping._id, mapping.marketplaceSKU)}
                        disabled={deleting === mapping._id}
                        className="text-red-600 hover:text-red-800 disabled:text-gray-400 transition-colors"
                        title="Delete mapping"
                      >
                        {deleting === mapping._id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <FiTrash2 size={18} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Results Count */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing <strong>{filteredMappings.length}</strong> of <strong>{mappings.length}</strong> mappings
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SKUMappings;
