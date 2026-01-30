import { FiCheck, FiClock, FiRefreshCw, FiMinus, FiX } from 'react-icons/fi';
import { useState } from 'react';

const SyncStatusBadge = ({ order, onResend, loading = false }) => {
  const [isResending, setIsResending] = useState(false);

  const handleResend = async (e) => {
    e.stopPropagation(); // Prevent triggering parent onClick
    if (isResending || loading) return;
    
    console.log('🔄 Resending sync for order:', order._id); // DEBUG
    
    setIsResending(true);
    try {
      await onResend(order._id);
    } catch (error) {
      console.error('Resend failed:', error);
    } finally {
      setTimeout(() => setIsResending(false), 1000); // Add small delay
    }
  };

  // If buyer doesn't have customer account
  if (!order.customerTenantId && !order.syncStatus) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-semibold rounded-lg">
        <FiMinus className="w-3.5 h-3.5" />
        No Sync
      </span>
    );
  }

  const syncStatus = order.syncStatus || 'none';

  // Synced or Accepted - Green badge (non-clickable)
  if (syncStatus === 'synced' || syncStatus === 'accepted') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-semibold rounded-lg shadow-sm">
        <FiCheck className="w-3.5 h-3.5" />
        Synced
      </span>
    );
  }

  // Pending - Yellow badge (clickable to resend)
  if (syncStatus === 'pending') {
    return (
      <button
        type="button"
        onClick={handleResend}
        disabled={isResending || loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow-md hover:from-yellow-600 hover:to-yellow-700 transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        title="Click to resend sync request"
      >
        <FiClock className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
        {isResending ? 'Resending...' : 'Sync Pending'}
      </button>
    );
  }

  // Rejected - Red badge (clickable button to resend)
  if (syncStatus === 'rejected') {
    return (
      <button
        type="button"
        onClick={handleResend}
        disabled={isResending || loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow-md hover:from-red-600 hover:to-red-700 transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        title="Rejected - Click to resend"
      >
        {isResending ? (
          <>
            <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
            Resending...
          </>
        ) : (
          <>
            <FiX className="w-3.5 h-3.5" />
            Rejected - Resend
          </>
        )}
      </button>
    );
  }

  // Default - No sync status (allow first sync)
  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={isResending || loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow-md hover:from-blue-600 hover:to-blue-700 transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      title="Click to send sync request"
    >
      {isResending ? (
        <>
          <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
          Sending...
        </>
      ) : (
        <>
          <FiRefreshCw className="w-3.5 h-3.5" />
          Send Sync
        </>
      )}
    </button>
  );
};

export default SyncStatusBadge;
