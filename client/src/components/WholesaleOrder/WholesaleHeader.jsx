import { FiPlus, FiShoppingCart } from 'react-icons/fi';

export default function WholesaleHeader({ draftsCount, onNewOrder, onShowDrafts }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-100 p-2 rounded-xl">
          <FiShoppingCart className="text-indigo-600 text-xl" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Wholesale Orders</h1>
          <p className="text-xs text-gray-500">Manage your B2B orders</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Draft badge */}
        {draftsCount > 0 && (
          <button
            onClick={onShowDrafts}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200
                      text-amber-700 rounded-full text-xs font-semibold hover:bg-amber-100 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {draftsCount} draft{draftsCount > 1 ? 's' : ''} saved
          </button>
        )}
        <button
          onClick={onNewOrder}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700
                    text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
        >
          <FiPlus className="text-base" />
          New Order
        </button>
      </div>
    </div>
  );
}
