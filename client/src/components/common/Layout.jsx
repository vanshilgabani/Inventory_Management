import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationDropdown from '../NotificationDropdown';
import SyncRequestModal from '../sync/SyncRequestModal';
import { authService } from '../../services/authService';
import { FiMenu, FiX, FiPackage, FiMaximize2 } from 'react-icons/fi';

const Layout = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const user = authService.getCurrentUser();

  // 🆕 NEW: Sync request state with localStorage persistence
  const [pendingSyncRequests, setPendingSyncRequests] = useState([]);
  const [activeSyncRequest, setActiveSyncRequest] = useState(null);
  
  // ✅ Load minimized state from localStorage
  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem('sync-modal-minimized');
    return saved === 'true';
  });

  // 🆕 Fetch pending sync requests on mount and every 30 seconds
  useEffect(() => {
    fetchPendingSyncRequests();
    
    const interval = setInterval(() => {
      fetchPendingSyncRequests();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchPendingSyncRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/supplier-sync/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('Pending sync endpoint returned non-JSON response');
        return;
      }

      if (response.ok) {
        const result = await response.json();
        const requests = result.data || [];
        setPendingSyncRequests(requests);

        // Only auto-show if NO active request and NOT previously minimized
        if (requests.length > 0 && !activeSyncRequest) {
          setActiveSyncRequest(requests[0]);
          
          // Don't auto-show if user previously minimized it
          const wasMinimized = localStorage.getItem('sync-modal-minimized') === 'true';
          if (!wasMinimized) {
            setIsMinimized(false);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch pending sync requests:', error);
    }
  };

  const handleAcceptSync = async (syncId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/supplier-sync/${syncId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Remove from pending list
        setPendingSyncRequests(prev => prev.filter(r => r._id !== syncId));
        
        // Show next pending request if available
        const nextRequest = pendingSyncRequests.find(r => r._id !== syncId);
        if (nextRequest) {
          setActiveSyncRequest(nextRequest);
          setIsMinimized(false);
          localStorage.setItem('sync-modal-minimized', 'false');
        } else {
          setActiveSyncRequest(null);
          localStorage.removeItem('sync-modal-minimized');
        }

        // Refresh to get updated data
        await fetchPendingSyncRequests();
      }
    } catch (error) {
      console.error('Failed to accept sync:', error);
      throw error;
    }
  };

  const handleRejectSync = async (syncId, reason) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/supplier-sync/${syncId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        // Remove from pending list
        setPendingSyncRequests(prev => prev.filter(r => r._id !== syncId));
        
        // Show next pending request if available
        const nextRequest = pendingSyncRequests.find(r => r._id !== syncId);
        if (nextRequest) {
          setActiveSyncRequest(nextRequest);
          setIsMinimized(false);
          localStorage.setItem('sync-modal-minimized', 'false');
        } else {
          setActiveSyncRequest(null);
          localStorage.removeItem('sync-modal-minimized');
        }

        await fetchPendingSyncRequests();
      }
    } catch (error) {
      console.error('Failed to reject sync:', error);
      throw error;
    }
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    localStorage.setItem('sync-modal-minimized', 'true');
  };

  const handleMaximize = () => {
    setIsMinimized(false);
    localStorage.setItem('sync-modal-minimized', 'false');
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
            
            {/* ✨ NEW: Show minimized sync badge OR regular title */}
            {activeSyncRequest && isMinimized ? (
              <button
                onClick={handleMaximize}
                className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 animate-pulse-gentle"
              >
                <FiPackage className="text-xl" />
                <div className="text-left">
                  <div className="text-sm font-bold">Sync Request Pending</div>
                  <div className="text-xs opacity-90">{activeSyncRequest.order.challanNumber} - Click to review</div>
                </div>
                <FiMaximize2 className="text-lg ml-2" />
              </button>
            ) : (
              <h1 className="text-xl font-bold text-gray-800">Cargo Inventory System</h1>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <NotificationDropdown />
            
            {/* User Info */}
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-800">{user?.name}</div>
              <div className="text-xs text-gray-500">{user?.email}</div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all font-semibold text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* 🆕 NEW: Global Sync Request Modal (only when NOT minimized) */}
      {activeSyncRequest && !isMinimized && (
        <SyncRequestModal
          syncRequest={activeSyncRequest}
          onAccept={handleAcceptSync}
          onReject={handleRejectSync}
          onMinimize={handleMinimize}
        />
      )}
    </div>
  );
};

export default Layout;
