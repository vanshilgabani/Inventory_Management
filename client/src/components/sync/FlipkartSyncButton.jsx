import { useState, useEffect } from 'react';
import { flipkartService } from '../../services/flipkartService';
import toast from 'react-hot-toast';
import { FiRefreshCw, FiCheck, FiX, FiClock, FiPackage, FiAlertCircle } from 'react-icons/fi';

const FlipkartSyncButton = () => {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    fetchStatus();
    // Refresh status every 60 seconds
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const data = await flipkartService.getSyncStatus();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  };

  const handleSync = async () => {
    if (!status?.isConfigured) {
      toast.error('Please configure Flipkart integration in Settings first');
      return;
    }

    if (status?.productsEnabledCount === 0) {
      toast.error('No products are enabled for sync. Enable products in Settings.');
      return;
    }

    setSyncing(true);
    try {
      const result = await flipkartService.manualSync();
      
      if (result.success) {
        toast.success(`✅ ${result.message}`, { duration: 4000 });
        fetchStatus();
      } else {
        toast.error(`❌ ${result.message}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Never';
    const now = new Date();
    const date = new Date(dateString);
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const formatNextSync = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (!status?.enabled) {
    return null; // Hide button if Flipkart is not enabled
  }

  const buttonDisabled = syncing || !status?.isConfigured || status?.productsEnabledCount === 0;

  return (
    <div className="relative">
      <button
        onClick={handleSync}
        disabled={buttonDisabled}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
          syncing
            ? 'bg-blue-100 text-blue-700 cursor-wait'
            : buttonDisabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
        }`}
      >
        <FiRefreshCw 
          className={syncing ? 'animate-spin' : ''} 
          size={18} 
        />
        <span>
          {syncing ? 'Syncing...' : 'Sync to Flipkart'}
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && !status?.isConfigured && (
        <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
          <div className="flex items-start gap-2">
            <FiAlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Not Configured</p>
              <p>Go to Settings → Flipkart Sync to configure API credentials</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlipkartSyncButton;
