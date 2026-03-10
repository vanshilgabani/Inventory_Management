import SkeletonCard from '../common/SkeletonCard';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function OrderList({ orders, loading, pagination, onPageChange, renderCard }) {
  const { page, totalPages, total, hasNext, hasPrev, limit = 15 } = pagination;

  const start = Math.min((page - 1) * limit + 1, total);
  const end   = Math.min(page * limit, total);

  // Build page numbers (max 5 visible)
  const pageNums = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3)               return [1, 2, 3, 4, 5];
    if (page >= totalPages - 2)  return [totalPages-4, totalPages-3, totalPages-2, totalPages-1, totalPages];
    return [page-2, page-1, page, page+1, page+2];
  })();

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── Cards grid ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : !orders.length ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-lg font-semibold text-gray-600">No orders found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {orders.map(order => renderCard(order))}
          </div>
        )}
      </div>

      {/* ── Pagination bar (sticky bottom) ── */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200 flex-shrink-0">

          <span className="text-sm text-gray-500">
            Showing{' '}
            <span className="font-semibold text-gray-800">{start}–{end}</span>
            {' '}of{' '}
            <span className="font-semibold text-gray-800">{total}</span> orders
          </span>

          <div className="flex items-center gap-1.5">
            {/* Prev */}
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={!hasPrev}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300
                         text-sm font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed
                         enabled:hover:bg-gray-50 transition-colors"
            >
              <FiChevronLeft /> Prev
            </button>

            {/* Page numbers */}
            {pageNums.map(p => (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                  p === page
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            ))}

            {/* Next */}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={!hasNext}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300
                         text-sm font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed
                         enabled:hover:bg-gray-50 transition-colors"
            >
              Next <FiChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
