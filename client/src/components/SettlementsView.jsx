import { useState } from 'react';
import { FiDollarSign, FiTrash2, FiCalendar, FiUser, FiFileText } from 'react-icons/fi';
import Card from './common/Card';
import { formatCurrency } from '../utils/dateUtils';

const SettlementsView = ({ 
  settlements, 
  marketplaceAccounts,
  onDeleteSettlement,
  isAdmin 
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Calculate stats
  const stats = {
    total: settlements.length,
    totalAmount: settlements.reduce((sum, s) => sum + (s.settlementAmount || 0), 0),
    byAccount: {}
  };

  settlements.forEach(settlement => {
    const account = settlement.accountName;
    if (!stats.byAccount[account]) {
      stats.byAccount[account] = { count: 0, amount: 0 };
    }
    stats.byAccount[account].count += 1;
    stats.byAccount[account].amount += settlement.settlementAmount || 0;
  });

  // Filter settlements
  const filteredSettlements = settlements.filter(settlement => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      settlement.accountName?.toLowerCase().includes(query) ||
      settlement.notes?.toLowerCase().includes(query) ||
      formatCurrency(settlement.settlementAmount).toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">

      {/* Settlements List */}
      <Card>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FiFileText className="text-2xl text-indigo-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-800">All Settlements</h2>
                <p className="text-sm text-gray-500">
                  {filteredSettlements.length} of {settlements.length} settlements
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search settlements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
              />
              <FiDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* Empty State */}
          {settlements.length === 0 ? (
            <div className="text-center py-12">
              <FiDollarSign className="mx-auto text-6xl mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg">No settlements recorded</p>
              <p className="text-gray-400 text-sm mt-2">Settlements will appear here once recorded</p>
            </div>
          ) : filteredSettlements.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No settlements match your search</p>
            </div>
          ) : (
            /* Settlements Table */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Account
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Notes
                    </th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredSettlements.map((settlement) => (
                    <tr
                      key={settlement._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <FiCalendar className="text-gray-400" />
                          {formatDate(settlement.settlementDate)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-700">
                          {settlement.accountName}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-lg font-bold text-green-600">
                          {formatCurrency(settlement.settlementAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-600">
                          {settlement.notes || '-'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => onDeleteSettlement(settlement._id)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50"
                            title="Delete Settlement"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SettlementsView;
