import { useState, useMemo } from 'react';
import StatsCard from '../components/StatsCard';
import FilterBar from '../components/FilterBar';
import BorrowerCard from '../components/BorrowerCard';
import { filterBorrowersBySearch, filterBorrowersByStatus } from '../utils/factoryHelpers';

const BorrowedTab = ({ data, stats, enabledSizes, canEditDelete, onReturn, onViewHistory, products, filters, onFilterChange }) => {
  const [expandedBorrower, setExpandedBorrower] = useState(null);

  // Apply filters
  const filteredData = useMemo(() => {
    let filtered = data;

    // Search filter
    if (filters.search.trim()) {
      filtered = filterBorrowersBySearch(filtered, filters.search);
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filterBorrowersByStatus(filtered, filters.status);
    }

    return filtered;
  }, [data, filters]);

  // Calculate stats based on filtered data
  const filteredStats = useMemo(() => {
    const totalBorrowed = filteredData.reduce((sum, b) => sum + b.totalBorrowed, 0);
    const totalReturned = filteredData.reduce((sum, b) => sum + b.totalReturned, 0);
    const outstanding = filteredData.reduce((sum, b) => sum + b.outstanding, 0);
    const activeBorrowers = filteredData.filter(b => b.outstanding > 0).length;

    return {
      totalBorrowed,
      totalReturned,
      outstanding,
      activeBorrowers,
    };
  }, [filteredData]);

  const handleToggleBorrower = (sourceName) => {
    setExpandedBorrower(expandedBorrower === sourceName ? null : sourceName);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total Borrowed"
          value={filteredStats.totalBorrowed}
          subtitle="units"
          icon="📤"
          gradient="from-orange-500 to-orange-600"
        />
        <StatsCard
          title="Total Returned"
          value={filteredStats.totalReturned}
          subtitle="units"
          icon="↩️"
          gradient="from-green-500 to-green-600"
        />
        <StatsCard
          title="Outstanding"
          value={filteredStats.outstanding}
          subtitle="units"
          icon="🔥"
          gradient="from-red-500 to-red-600"
        />
        <StatsCard
          title="Active Borrowers"
          value={filteredStats.activeBorrowers}
          subtitle="borrowers"
          icon="👥"
          gradient="from-purple-500 to-purple-600"
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFilterChange={onFilterChange}
        showExport={false}
        showStatusFilter={true}
      />

      {/* Borrower Cards */}
      {filteredData.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No borrowed stock found
          </h3>
          <p className="text-gray-500">
            {filters.search || filters.status !== 'all'
              ? 'Try adjusting your filters'
              : 'No stock has been borrowed yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredData.map((borrower) => (
            <BorrowerCard
              key={borrower.sourceName}
              borrower={borrower}
              enabledSizes={enabledSizes}
              canEditDelete={canEditDelete}
              onReturn={onReturn}
              onViewHistory={onViewHistory}
              products={products}
              isExpanded={expandedBorrower === borrower.sourceName}
              onToggle={() => handleToggleBorrower(borrower.sourceName)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BorrowedTab;
