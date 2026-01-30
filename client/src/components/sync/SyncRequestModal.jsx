import { useState } from 'react';
import { FiX, FiCheck, FiMinus, FiPackage, FiCalendar, FiDollarSign, FiUser } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const SyncRequestModal = ({ syncRequest, onAccept, onReject, onMinimize }) => {
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [accepting, setAccepting] = useState(false);

  if (!syncRequest) return null;

  const { order, supplier, itemsSynced, metadata } = syncRequest;

  const handleAccept = async () => {
    try {
      setAccepting(true);
      await onAccept(syncRequest._id);
      toast.success('Sync request accepted!');
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
      toast.success('Sync request rejected');
      setRejectionReason('');
    } catch (error) {
      toast.error('Failed to reject sync request');
      console.error(error);
    } finally {
      setRejecting(false);
    }
  };

  // Calculate total quantity
  const totalQuantity = itemsSynced.reduce((sum, item) => {
    const itemTotal = Object.values(item.quantities).reduce((s, qty) => s + qty, 0);
    return sum + itemTotal;
  }, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-slideInDown">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white relative">
          <button
            onClick={onMinimize}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
            title="Minimize"
          >
            <FiMinus className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/20 rounded-xl">
              <FiPackage className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Stock Sync Request</h2>
              <p className="text-blue-100 text-sm">Review and approve inventory sync</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-250px)]">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <FiUser className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">From</span>
              </div>
              <p className="text-lg font-bold text-gray-800">{supplier.name}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <FiCalendar className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Order Date</span>
              </div>
              <p className="text-lg font-bold text-gray-800">
                {order.date ? format(new Date(order.date), 'dd MMM yyyy') : 'N/A'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <FiPackage className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Challan Number</span>
              </div>
              <p className="text-lg font-bold text-gray-800">{order.challanNumber}</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-yellow-600 mb-2">
                <FiDollarSign className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Total Amount</span>
              </div>
              <p className="text-lg font-bold text-gray-800">
                ₹{(order.totalAmount || 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Items Table */}
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
                    {/* Dynamic size columns */}
                    {itemsSynced.length > 0 && Object.keys(itemsSynced[0].quantities).map(size => (
                      <th key={size} className="text-center p-3 font-semibold text-gray-700 border">{size}</th>
                    ))}
                    <th className="text-center p-3 font-semibold text-gray-700 border">Total</th>
                    <th className="text-right p-3 font-semibold text-gray-700 border">Price/Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsSynced.map((item, index) => {
                    const itemTotal = Object.values(item.quantities).reduce((s, qty) => s + qty, 0);
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="p-3 border font-medium text-gray-800">{item.design}</td>
                        <td className="p-3 border">
                          <span className="px-2 py-1 bg-gray-100 rounded text-sm">{item.color}</span>
                        </td>
                        {Object.entries(item.quantities).map(([size, qty]) => (
                          <td key={size} className="p-3 border text-center">
                            {qty > 0 ? (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-semibold">
                                {qty}
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

          {/* Rejection Reason (if rejecting) */}
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
              <span className="font-semibold text-blue-600">{totalQuantity}</span> pieces will be added to your inventory
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={accepting}
                className="px-6 py-3 bg-white border-2 border-red-300 text-red-600 font-semibold rounded-xl hover:bg-red-50 transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiX className="w-5 h-5" />
                {rejecting ? 'Rejecting...' : 'Reject'}
              </button>
              
              <button
                onClick={handleAccept}
                disabled={rejecting}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiCheck className="w-5 h-5" />
                {accepting ? 'Accepting...' : 'Accept & Sync'}
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
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slideInDown {
          animation: slideInDown 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

export default SyncRequestModal;
