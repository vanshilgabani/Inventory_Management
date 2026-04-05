import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { format } from 'date-fns';

const OrderList = ({ records, pagination, onPageChange, onSelectOrder, selectedId, loading }) => {

  // Extract unique designs from a record
  const getDesigns = (record) => {
    // supplier-sync records store items array OR single design field
    if (record.items?.length) {
      const designs = [...new Set(record.items.map(i => i.design).filter(Boolean))];
      return designs;
    }
    return record.design ? [record.design] : [];
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!records.length) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg font-medium">No orders found</p>
        <p className="text-sm mt-1">Try adjusting your search or date filter</p>
      </div>
    );
  }

  return (
    <div>
      {/* List */}
      <div className="space-y-2 mb-4">
        {records.map(record => {
          const designs = getDesigns(record);
          const isSelected = selectedId === record._id;

          return (
            <div
              key={record._id}
              onClick={() => onSelectOrder(record._id)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all
                ${isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                }`}
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                {/* Challan + Supplier */}
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-800 truncate">
                    {record.batchId || '—'}
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-500 truncate">{record.sourceName}</span>
                </div>

                {/* Designs chips */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {designs.length > 0
                    ? designs.slice(0, 5).map(d => (
                        <span key={d} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                          {d}
                        </span>
                      ))
                    : <span className="text-xs text-slate-400 italic">No designs</span>
                  }
                  {designs.length > 5 && (
                    <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
                      +{designs.length - 5}
                    </span>
                  )}
                </div>
              </div>

              {/* Right side */}
              <div className="flex flex-col items-end gap-0.5 ml-4 shrink-0">
                <span className="text-sm font-bold text-slate-700">{record.totalQuantity} pcs</span>
                <span className="text-xs text-slate-400">
                  {record.receivedDate ? format(new Date(record.receivedDate), 'dd MMM yyyy') : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page === 1}
              onClick={() => onPageChange(pagination.page - 1)}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition"
            >
              <FiChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-slate-700">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page === pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition"
            >
              <FiChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderList;