import { useState, useMemo } from 'react';
import StatsCard from '../components/StatsCard';
import FilterBar from '../components/FilterBar';
import DateGroup from '../components/DateGroup';
import FlatTableView from '../components/FlatTableView';
import { filterByDateRange, filterBySearch, exportToExcel } from '../utils/factoryHelpers';

const FactoryTab = ({ data, stats, enabledSizes, canEditDelete, onEdit, onDelete, filters, onFilterChange }) => {
  const [expandedDate, setExpandedDate] = useState(null);
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'table'

  // Apply filters
  const filteredData = useMemo(() => {
    let filtered = data;

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      filtered = filterByDateRange(filtered, filters.dateFrom, filters.dateTo);
    }

    // Search filter
    if (filters.search.trim()) {
      filtered = filterBySearch(filtered, filters.search);
    }

    return filtered;
  }, [data, filters]);

  // Calculate stats based on filtered data
  const filteredStats = useMemo(() => {
    const totalReceived = filteredData.reduce((sum, day) => sum + day.totalQuantity, 0);
    const uniqueDesigns = new Set();
    filteredData.forEach(day => {
      day.designs.forEach(design => {
        uniqueDesigns.add(design.design);
      });
    });

    return {
      totalReceived,
      uniqueDesigns: uniqueDesigns.size,
      lastReceived: stats.lastReceived,
    };
  }, [filteredData, stats.lastReceived]);

  const handleExport = () => {
    exportToExcel(filteredData, 'Factory_Receivings');
  };

  const handleToggleDate = (date) => {
    setExpandedDate(expandedDate === date ? null : date);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Total Received"
          value={filteredStats.totalReceived}
          subtitle="units"
          icon="📥"
          gradient="from-blue-500 to-blue-600"
        />
        <StatsCard
          title="Total Designs"
          value={filteredStats.uniqueDesigns}
          subtitle="designs"
          icon="📦"
          gradient="from-indigo-500 to-indigo-600"
        />
        <StatsCard
          title="Last Received"
          value={filteredStats.lastReceived}
          subtitle=""
          icon="📅"
          gradient="from-purple-500 to-purple-600"
        />
      </div>

      {/* Filter Bar with View Toggle */}
      <FilterBar
        filters={filters}
        onFilterChange={onFilterChange}
        onExport={handleExport}
        showExport={true}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Content - Conditional Rendering based on View Mode */}
      {filteredData.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No receivings found
          </h3>
          <p className="text-gray-500">
            {filters.search || filters.dateFrom || filters.dateTo
              ? 'Try adjusting your filters'
              : 'Click "Receive Stock" to add your first receiving'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <FlatTableView
          data={filteredData}
          enabledSizes={enabledSizes}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
        />
      ) : (
        <div className="space-y-4">
          {filteredData.map((dateGroup) => (
            <DateGroup
              key={dateGroup.date}
              dateGroup={dateGroup}
              enabledSizes={enabledSizes}
              canEditDelete={canEditDelete}
              onEdit={onEdit}
              onDelete={onDelete}
              isExpanded={expandedDate === dateGroup.date}
              onToggle={() => handleToggleDate(dateGroup.date)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FactoryTab;
