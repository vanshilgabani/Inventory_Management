import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const SyncContext = createContext();

export const useSyncContext = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSyncContext must be used within SyncProvider');
  return context;
};

export const SyncProvider = ({ children }) => {
  const [pendingSyncRequests, setPendingSyncRequests] = useState([]);
  const [activeSyncRequest, setActiveSyncRequest]     = useState(null);
  const [minimizedIds, setMinimizedIds]               = useState(new Set());
  const [loading, setLoading]                         = useState(false);

  // ── FIXED: no state dependencies → stable reference → no re-registration loop ──
  const fetchPendingRequests = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch(`${API}/supplier-sync/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.success) {
        setPendingSyncRequests(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch pending sync requests:', error);
    }
  }, []); // ← empty deps — stable, never recreated

  // ── Auto-promote: runs whenever pendingSyncRequests changes ──
  useEffect(() => {
  setActiveSyncRequest(current => {
    if (current) {
      // Always sync active request with latest data from poll
      const freshVersion = pendingSyncRequests.find(r => r._id === current._id);
      if (freshVersion) return freshVersion;  // ← replace stale with fresh ✅
      // Active request no longer pending (accepted/rejected elsewhere) → promote next
    }
    const firstNew = pendingSyncRequests.find(r => !minimizedIds.has(r._id));
    return firstNew || null;
  });
}, [pendingSyncRequests]);

  // ── Poll every 15 seconds ──
  useEffect(() => {
    fetchPendingRequests();
    const interval = setInterval(fetchPendingRequests, 15000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  // ── Listen for manual trigger ──
  useEffect(() => {
    const handler = () => { fetchPendingRequests(); toast.success('New sync request received!'); };
    window.addEventListener('newSyncRequest', handler);
    return () => window.removeEventListener('newSyncRequest', handler);
  }, [fetchPendingRequests]);

  const acceptSyncRequest = async (syncId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/supplier-sync/${syncId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      setPendingSyncRequests(prev => prev.filter(r => r._id !== syncId));
      setMinimizedIds(prev => { const s = new Set(prev); s.delete(syncId); return s; });
      setActiveSyncRequest(prev => prev?._id === syncId ? null : prev);

      toast.success('Sync accepted! Stock added to inventory.');
      window.dispatchEvent(new CustomEvent('syncAccepted', { detail: { syncId } }));
      await fetchPendingRequests();
      return data;
    } catch (error) {
      toast.error('Failed to accept sync request');
      throw error;
    }
  };

  const rejectSyncRequest = async (syncId, reason) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/supplier-sync/${syncId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      setPendingSyncRequests(prev => prev.filter(r => r._id !== syncId));
      setMinimizedIds(prev => { const s = new Set(prev); s.delete(syncId); return s; });
      setActiveSyncRequest(prev => prev?._id === syncId ? null : prev);

      toast.success('Sync request rejected.');
      window.dispatchEvent(new CustomEvent('syncRejected', { detail: { syncId } }));
      await fetchPendingRequests();
      return data;
    } catch (error) {
      toast.error('Failed to reject sync request');
      throw error;
    }
  };

  const minimizeSyncRequest = (syncId) => {
    setMinimizedIds(prev => new Set(prev).add(syncId));
    // Promote next non-minimized request after this one is minimized
    setActiveSyncRequest(() => {
      const next = pendingSyncRequests.find(r => r._id !== syncId && !minimizedIds.has(r._id));
      return next || null;
    });
  };

  const expandSyncRequest = (syncId) => {
    const request = pendingSyncRequests.find(r => r._id === syncId);
    if (!request) return;
    setMinimizedIds(prev => { const s = new Set(prev); s.delete(syncId); return s; });
    setActiveSyncRequest(request);
  };

  return (
    <SyncContext.Provider value={{
      pendingSyncRequests,
      activeSyncRequest,
      minimizedIds,
      loading,
      acceptSyncRequest,
      rejectSyncRequest,
      minimizeSyncRequest,
      expandSyncRequest,
      refreshPendingRequests: fetchPendingRequests
    }}>
      {children}
    </SyncContext.Provider>
  );
};
