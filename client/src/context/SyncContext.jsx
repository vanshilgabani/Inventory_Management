import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

const SyncContext = createContext();

export const useSyncContext = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncContext must be used within SyncProvider');
  }
  return context;
};

export const SyncProvider = ({ children }) => {
  const [pendingSyncRequests, setPendingSyncRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [minimizedRequests, setMinimizedRequests] = useState(new Set());

  // Fetch pending sync requests
  const fetchPendingRequests = useCallback(async () => {
    try {
      const response = await fetch('/api/sync/pending', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setPendingSyncRequests(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch pending sync requests:', error);
    }
  }, []);

  // Accept sync request
  const acceptSyncRequest = async (syncId) => {
    try {
      const response = await fetch(`/api/sync/${syncId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        // Remove from pending list
        setPendingSyncRequests(prev => prev.filter(req => req._id !== syncId));
        
        // Remove from minimized list
        setMinimizedRequests(prev => {
          const newSet = new Set(prev);
          newSet.delete(syncId);
          return newSet;
        });

        toast.success('Sync request accepted! Stock added to inventory.');
        
        // Refresh the page data if needed
        window.dispatchEvent(new CustomEvent('syncAccepted', { detail: { syncId } }));
        
        return data;
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Failed to accept sync:', error);
      toast.error('Failed to accept sync request');
      throw error;
    }
  };

  // Reject sync request
  const rejectSyncRequest = async (syncId, reason) => {
    try {
      const response = await fetch(`/api/sync/${syncId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();

      if (data.success) {
        // Remove from pending list
        setPendingSyncRequests(prev => prev.filter(req => req._id !== syncId));
        
        // Remove from minimized list
        setMinimizedRequests(prev => {
          const newSet = new Set(prev);
          newSet.delete(syncId);
          return newSet;
        });

        toast.success('Sync request rejected');
        
        // Notify parent
        window.dispatchEvent(new CustomEvent('syncRejected', { detail: { syncId } }));
        
        return data;
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Failed to reject sync:', error);
      toast.error('Failed to reject sync request');
      throw error;
    }
  };

  // Minimize sync request
  const minimizeSyncRequest = (syncId) => {
    setMinimizedRequests(prev => new Set(prev).add(syncId));
  };

  // Maximize sync request
  const maximizeSyncRequest = (syncId) => {
    setMinimizedRequests(prev => {
      const newSet = new Set(prev);
      newSet.delete(syncId);
      return newSet;
    });
  };

  // Poll for new sync requests every 15 seconds
  useEffect(() => {
    fetchPendingRequests();

    const interval = setInterval(() => {
      fetchPendingRequests();
    }, 15000); // Poll every 15 seconds

    return () => clearInterval(interval);
  }, [fetchPendingRequests]);

  // Listen for real-time updates (if using WebSocket in future)
  useEffect(() => {
    const handleNewSyncRequest = () => {
      fetchPendingRequests();
      toast.success('New sync request received!');
    };

    window.addEventListener('newSyncRequest', handleNewSyncRequest);
    
    return () => {
      window.removeEventListener('newSyncRequest', handleNewSyncRequest);
    };
  }, [fetchPendingRequests]);

  const value = {
    pendingSyncRequests,
    loading,
    minimizedRequests,
    acceptSyncRequest,
    rejectSyncRequest,
    minimizeSyncRequest,
    maximizeSyncRequest,
    refreshPendingRequests: fetchPendingRequests
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};
