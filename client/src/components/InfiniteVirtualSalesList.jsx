import { useRef, useEffect } from 'react';
import { 
  FiEdit2, 
  FiTrash2, 
  FiShoppingBag, 
  FiCalendar, 
  FiFileText,
  FiCopy
} from 'react-icons/fi';

const InfiniteVirtualSalesList = ({ 
  sales, 
  loadMore, 
  hasMore, 
  loading,
  onEdit,
  onDelete,
  onCopyOrderId,
  getStatusBadge,
  formatDateCustom
}) => {
  const scrollRef = useRef();

  // Infinite scroll detector
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current || loading || !hasMore) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      
      // Load more when user is 200px from bottom
      if (scrollHeight - scrollTop - clientHeight < 200) {
        loadMore();
      }
    };

    const currentRef = scrollRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('scroll', handleScroll);
      }
    };
  }, [loading, hasMore, loadMore]);

  return (
    <div 
      ref={scrollRef}
      className="border border-gray-200 rounded-lg overflow-y-auto"
      style={{ maxHeight: '600px' }}
    >
      <div className="space-y-3 p-4">
        {sales.map((sale) => (
          <div 
            key={sale._id} 
            className="border-2 border-indigo-100 rounded-xl p-4 hover:shadow-lg transition-all duration-200 bg-white"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-indigo-600">
                    {sale.design}
                  </span>
                  {getStatusBadge(sale.status)}
                </div>
                <p className="text-sm text-gray-500">
                  {sale.color} • {sale.size} • Qty: {sale.quantity}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onCopyOrderId(sale.orderItemId)}
                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Copy Order Item ID"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onEdit(sale)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit Order"
                >
                  <FiEdit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(sale._id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Order"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <FiShoppingBag className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{sale.accountName}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <FiCalendar className="w-4 h-4 flex-shrink-0" />
                <span>{formatDateCustom(sale.saleDate)}</span>
              </div>
              {sale.orderItemId && (
                <div className="flex items-center gap-2 text-gray-600">
                  <FiFileText className="w-4 h-4 flex-shrink-0" />
                  <span className="font-mono text-xs break-all">{sale.orderItemId}</span>
                </div>
              )}
              {sale.notes && (
                <p className="text-gray-500 italic text-xs mt-2 line-clamp-2">
                  {sale.notes}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
            <p className="text-gray-500 mt-2 text-sm">Loading more orders...</p>
          </div>
        )}

        {/* End of list */}
        {!hasMore && sales.length > 0 && (
          <div className="text-center py-4 text-gray-400 text-sm">
            End of list
          </div>
        )}
      </div>
    </div>
  );
};

export default InfiniteVirtualSalesList;
