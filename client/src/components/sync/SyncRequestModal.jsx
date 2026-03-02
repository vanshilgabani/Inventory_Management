import { useState } from 'react';
import { FiX, FiCheck, FiMinus, FiPackage, FiCalendar, FiDollarSign, FiUser, FiEdit2, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const SyncRequestModal = ({ syncRequest, onAccept, onReject, onMinimize }) => {
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [accepting, setAccepting] = useState(false);

  if (!syncRequest) return null;

  const isEdit = syncRequest.syncType === 'edit';

  // ── Normalize data — backend sends fields in metadata, not order/supplier directly ──
  const supplierName = syncRequest.supplier?.name
    || syncRequest.metadata?.supplierCompanyName
    || 'Supplier';

  const orderChallanNumber = syncRequest.order?.challanNumber
    || syncRequest.metadata?.orderChallanNumber
    || 'N/A';

  const orderDate = syncRequest.order?.date
    || syncRequest.metadata?.orderDate
    || null;

  const orderTotalAmount = syncRequest.order?.totalAmount
    || syncRequest.metadata?.orderTotalAmount
    || 0;

  const { itemsSynced = [], changesMade } = syncRequest;

  const handleAccept = async () => {
    try {
      setAccepting(true);
      await onAccept(syncRequest._id);
      toast.success(isEdit ? 'Edit accepted! Stock updated.' : 'Sync request accepted!');
    } catch (error) {
      toast.error('Failed to accept sync request');
      console.error(error);
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    try {
      setRejecting(true);
      await onReject(syncRequest._id, rejectionReason);
      toast.success(isEdit ? 'Edit rejected.' : 'Sync request rejected');
      setRejectionReason('');
    } catch (error) {
      toast.error('Failed to reject sync request');
      console.error(error);
    } finally {
      setRejecting(false);
    }
  };

  const totalQuantity = itemsSynced.reduce((sum, item) => {
    return sum + Object.values(item.quantities || {}).reduce((s, qty) => s + qty, 0);
  }, 0);

  // ── Render diff table for edit mode ──
  const renderDiffTable = () => {
    const diff = changesMade?.diff || [];
    if (!diff.length) {
      // Fallback: no diff data, just show new items table normally
      return null;
    }

    return (
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
          <FiEdit2 className="text-amber-600" />
          Changes from previously accepted order
        </h3>
        {changesMade?.previouslySyncedAt && (
          <p className="text-xs text-gray-500 mb-3">
            Previously accepted on: {format(new Date(changesMade.previouslySyncedAt), 'dd MMM yyyy, HH:mm')}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-amber-50">
                <th className="text-left p-3 font-semibold text-amber-800 border">Design</th>
                <th className="text-left p-3 font-semibold text-amber-800 border">Color</th>
                <th className="text-left p-3 font-semibold text-amber-800 border">Size</th>
                <th className="text-center p-3 font-semibold text-amber-800 border">Before</th>
                <th className="text-center p-3 font-semibold text-amber-800 border">After</th>
                <th className="text-center p-3 font-semibold text-amber-800 border">Change</th>
              </tr>
            </thead>
            <tbody>
              {diff.map((entry, i) => {
                const allSizes = new Set([
                  ...Object.keys(entry.before || {}),
                  ...Object.keys(entry.after  || {})
                ]);
                return [...allSizes].map(size => {
                  const before    = entry.before?.[size] || 0;
                  const after     = entry.after?.[size]  || 0;
                  const delta     = after - before;
                  const isNew     = !entry.before || before === 0;
                  const isRemoved = !entry.after  || after  === 0;

                  return (
                    <tr
                      key={`${i}-${size}`}
                      className={`hover:bg-gray-50 ${
                        isNew     ? 'bg-blue-50'  :
                        isRemoved ? 'bg-red-50'   : ''
                      }`}
                    >
                      <td className="p-3 border font-medium text-gray-800">{entry.design}</td>
                      <td className="p-3 border">
                        <span className="px-2 py-1 bg-gray-100 rounded text-sm">{entry.color}</span>
                      </td>
                      <td className="p-3 border text-gray-700">{size}</td>
                      <td className="p-3 border text-center text-gray-500">
                        {isNew ? '—' : before}
                      </td>
                      <td className="p-3 border text-center font-bold text-gray-800">
                        {isRemoved
                          ? <span className="line-through text-red-400">{before}</span>
                          : after
                        }
                      </td>
                      <td className="p-3 border text-center">
                        {isNew ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">NEW</span>
                        ) : isRemoved ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">REMOVED</span>
                        ) : delta > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-green-600 font-semibold">
                            <FiArrowUp size={12} /> +{delta}
                          </span>
                        ) : delta < 0 ? (
                          <span className="flex items-center justify-center gap-1 text-red-600 font-semibold">
                            <FiArrowDown size={12} /> {delta}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Render normal items table for create mode (or edit fallback) ──
  const renderItemsTable = () => {
    if (!itemsSynced.length) return null;

    // Get all unique sizes across all items for consistent columns
    const allSizes = [...new Set(
      itemsSynced.flatMap(item => Object.keys(item.quantities || {}))
    )];

    return (
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <FiPackage className="text-blue-600" />
          Items Details ({totalQuantity} pieces)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-3 font-semibold text-gray-700 border">Design</th>
                <th className="text-left p-3 font-semibold text-gray-700 border">Color</th>
                {allSizes.map(size => (
                  <th key={size} className="text-center p-3 font-semibold text-gray-700 border">{size}</th>
                ))}
                <th className="text-center p-3 font-semibold text-gray-700 border">Total</th>
                <th className="text-right p-3 font-semibold text-gray-700 border">Price/Unit</th>
              </tr>
            </thead>
            <tbody>
              {itemsSynced.map((item, index) => {
                const itemTotal = Object.values(item.quantities || {}).reduce((s, qty) => s + qty, 0);
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-3 border font-medium text-gray-800">{item.design}</td>
                    <td className="p-3 border">
                      <span className="px-2 py-1 bg-gray-100 rounded text-sm">{item.color}</span>
                    </td>
                    {allSizes.map(size => (
                      <td key={size} className="p-3 border text-center">
                        {(item.quantities?.[size] || 0) > 0 ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-semibold">
                            {item.quantities[size]}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    ))}
                    <td className="p-3 border text-center font-bold text-gray-800">{itemTotal}</td>
                    <td className="p-3 border text-right text-gray-600">
                      ₹{(item.pricePerUnit || 0).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-slideInDown">

        {/* Header — blue for create, amber for edit */}
        <div className={`p-6 text-white relative ${
          isEdit
            ? 'bg-gradient-to-r from-amber-500 to-orange-500'
            : 'bg-gradient-to-r from-blue-600 to-purple-600'
        }`}>
          <button
            onClick={onMinimize}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
            title="Minimize"
          >
            <FiMinus className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/20 rounded-xl">
              {isEdit ? <FiEdit2 className="w-6 h-6" /> : <FiPackage className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {isEdit ? '✏️ Edit Request — Stock Update' : 'Stock Sync Request'}
              </h2>
              <p className={`text-sm ${isEdit ? 'text-orange-100' : 'text-blue-100'}`}>
                {isEdit
                  ? 'Supplier made changes to a previously synced order'
                  : 'Review and approve inventory sync'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-250px)]">

          {/* Order Info Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <FiUser className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">From</span>
              </div>
              <p className="text-lg font-bold text-gray-800">{supplierName}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <FiCalendar className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Order Date</span>
              </div>
              <p className="text-lg font-bold text-gray-800">
                {orderDate ? format(new Date(orderDate), 'dd MMM yyyy') : 'N/A'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <FiPackage className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Challan Number</span>
              </div>
              <p className="text-lg font-bold text-gray-800">{orderChallanNumber}</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-yellow-600 mb-2">
                <FiDollarSign className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Total Amount</span>
              </div>
              <p className="text-lg font-bold text-gray-800">
                ₹{orderTotalAmount.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          {syncRequest.metadata?.lastEditedAt && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-amber-500 text-lg">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">This request was updated by supplier</p>
                <p className="text-xs text-amber-600">
                  Last updated: {format(new Date(syncRequest.metadata.lastEditedAt), 'dd MMM yyyy, HH:mm')}
                  {' '}— You are reviewing the latest version.
                </p>
              </div>
            </div>
          )}

          {/* EDIT MODE: diff table first, then full items as reference */}
          {isEdit && renderDiffTable()}

          {/* CREATE MODE: always show items table. EDIT MODE: show as "Full Order Reference" */}
          {(!isEdit || !changesMade?.diff?.length) && renderItemsTable()}

          {/* For edit mode, show collapsed full items as reference */}
          {isEdit && changesMade?.diff?.length > 0 && (
            <details className="mb-4">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 font-medium py-2">
                View full updated order ({totalQuantity} pieces)
              </summary>
              <div className="mt-2">
                {renderItemsTable()}
              </div>
            </details>
          )}

          {/* Rejection Reason */}
          {rejecting && (
            <div className="mb-4 animate-slideInDown">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reason for rejection (optional)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none resize-none"
                rows="3"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              <span className={`font-semibold ${isEdit ? 'text-amber-600' : 'text-blue-600'}`}>
                {totalQuantity}
              </span>
              {isEdit
                ? ' pieces will be adjusted in your inventory'
                : ' pieces will be added to your inventory'
              }
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={accepting}
                className="px-6 py-3 bg-white border-2 border-red-300 text-red-600 font-semibold rounded-xl hover:bg-red-50 transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiX className="w-5 h-5" />
                {rejecting ? 'Rejecting...' : isEdit ? 'Reject Changes' : 'Reject'}
              </button>

              <button
                onClick={handleAccept}
                disabled={rejecting}
                className={`px-6 py-3 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isEdit
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                    : 'bg-gradient-to-r from-green-600 to-green-700'
                }`}
              >
                <FiCheck className="w-5 h-5" />
                {accepting ? 'Processing...' : isEdit ? 'Accept Changes' : 'Accept & Sync'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideInDown { animation: slideInDown 0.4s ease-out; }
      `}</style>
    </div>
  );
};

export default SyncRequestModal;
