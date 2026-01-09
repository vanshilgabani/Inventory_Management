import React, { useState, useEffect, useRef } from 'react';
import { FiBell, FiX, FiClock, FiUser, FiCheckCircle, FiXCircle, FiChevronDown, FiChevronUp, FiMove } from 'react-icons/fi';
import toast from 'react-hot-toast';

const AdminRequestNotificationWidget = () => {
  const [requests, setRequests] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  
  // ✅ Draggable state
  const [position, setPosition] = useState({ x: window.innerWidth - 480, y: window.innerHeight - 650 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const widgetRef = useRef(null);

  // Fetch requests
  const fetchRequests = async () => {
    try {
      const data = await getPendingRequests();
      setRequests(Array.isArray(data?.requests) ? data.requests : (Array.isArray(data) ? data : []));
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  };

  // Real-time polling every 5 seconds
  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Dragging handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('.no-drag')) return; // Don't drag when clicking buttons
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Handle approve/reject
  const handleRespond = async (requestId, status, customSettings = {}) => {
    setProcessingId(requestId);
    try {
      // ✅ FIX: For rejection, only send status
      const payload = status === 'rejected' 
        ? { status } 
        : { status, ...customSettings };
      
      await respondToRequest(requestId, payload);
      
      toast.success(status === 'approved' ? '✅ Request Approved!' : '❌ Request Rejected');
      fetchRequests();
    } catch (error) {
      console.error('Failed to process request:', error);
      toast.error(error.response?.data?.message || 'Failed to process request');
    } finally {
      setProcessingId(null);
    }
  };

  if (requests.length === 0) return null;

  return (
    <>
      {/* Minimized State */}
      {!isExpanded && (
        <div
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: 9999,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleMouseDown}
          onClick={() => !isDragging && setIsExpanded(true)}
          className="group"
        >
          <div className="relative">
            <div className="bg-gradient-to-br from-red-500 to-red-600 p-4 rounded-full shadow-2xl hover:scale-110 transition-transform duration-300 animate-bounce">
              <FiBell className="text-white" size={28} />
            </div>
            <span className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 font-bold text-xs w-7 h-7 rounded-full flex items-center justify-center shadow-lg animate-pulse">
              {requests.length}
            </span>
            <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl">
                {requests.length} Pending {requests.length === 1 ? 'Request' : 'Requests'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded State */}
      {isExpanded && (
        <div
          ref={widgetRef}
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: 9999,
            cursor: isDragging ? 'grabbing' : 'default'
          }}
          className="w-[450px] max-h-[600px] bg-white rounded-2xl shadow-2xl border-2 border-red-200 overflow-hidden animate-scaleIn"
        >
          {/* Header - Draggable */}
          <div 
            className="bg-gradient-to-r from-red-500 to-red-600 p-4 cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                  <FiMove className="text-white" size={16} />
                </div>
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                  <FiBell className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Permission Requests</h3>
                  <p className="text-white/80 text-xs">{requests.length} pending approval{requests.length !== 1 && 's'}</p>
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="no-drag bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all"
              >
                <FiChevronDown size={20} />
              </button>
            </div>
          </div>

          {/* Requests List */}
          <div className="max-h-[500px] overflow-y-auto no-drag">
            {requests.map((request, index) => (
              <RequestCard
                key={request._id || index}
                request={request}
                onApprove={(settings) => handleRespond(request._id, 'approved', settings)}
                onReject={() => handleRespond(request._id, 'denied', {})}
                isProcessing={processingId === request._id}
              />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scaleIn { animation: scaleIn 0.3s ease-out; }
      `}</style>
    </>
  );
};

// RequestCard component remains the same...
const RequestCard = ({ request, onApprove, onReject, isProcessing }) => {
  const [showCustomize, setShowCustomize] = useState(false);
  const [settings, setSettings] = useState({
    maxChanges: request.suggestedMaxChanges || 5,
    timeWindowMinutes: request.suggestedTimeWindowMinutes || 30,
    permissionLevel: request.suggestedPermissionLevel || 'level2'
  });

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className="border-b border-gray-200 p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-full">
            <FiUser className="text-indigo-600" size={18} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{request.requesterName}</p>
            <p className="text-xs text-gray-500">{request.requesterEmail}</p>
          </div>
        </div>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <FiClock size={12} />
          {timeAgo(request.requestedAt)}
        </span>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
        <p className="text-sm text-gray-700 italic">"{request.reason || 'No reason provided'}"</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div className="bg-blue-50 p-2 rounded text-center">
          <p className="text-gray-600">Changes</p>
          <p className="font-bold text-blue-600">{request.suggestedMaxChanges || '∞'}</p>
        </div>
        <div className="bg-green-50 p-2 rounded text-center">
          <p className="text-gray-600">Time</p>
          <p className="font-bold text-green-600">{request.suggestedTimeWindowMinutes}m</p>
        </div>
        <div className="bg-purple-50 p-2 rounded text-center">
          <p className="text-gray-600">Level</p>
          <p className="font-bold text-purple-600">
            {request.suggestedPermissionLevel === 'level1' ? 'Edit' : 
             request.suggestedPermissionLevel === 'level2' ? 'Edit+Del' : 'Full'}
          </p>
        </div>
      </div>

      {showCustomize && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 space-y-2">
          <div>
            <label className="text-xs font-medium text-gray-700">Max Changes</label>
            <input
              type="number"
              min="1"
              value={settings.maxChanges}
              onChange={(e) => setSettings({...settings, maxChanges: parseInt(e.target.value)})}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700">Time Window (minutes)</label>
            <input
              type="number"
              min="5"
              value={settings.timeWindowMinutes}
              onChange={(e) => setSettings({...settings, timeWindowMinutes: parseInt(e.target.value)})}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700">Permission Level</label>
            <select
              value={settings.permissionLevel}
              onChange={(e) => setSettings({...settings, permissionLevel: e.target.value})}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="level1">Level 1 (Edit Only)</option>
              <option value="level2">Level 2 (Edit + Delete)</option>
              <option value="level3">Level 3 (Full Access)</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onApprove(showCustomize ? settings : {})}
          disabled={isProcessing}
          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-green-700 font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <FiCheckCircle size={16} />
          Approve
        </button>
        <button
          onClick={() => setShowCustomize(!showCustomize)}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
        >
          {showCustomize ? <FiChevronUp size={16} /> : 'Modify'}
        </button>
        <button
          onClick={onReject}
          disabled={isProcessing}
          className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg hover:from-red-600 hover:to-red-700 font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <FiXCircle size={16} />
          Reject
        </button>
      </div>
    </div>
  );
};

export default AdminRequestNotificationWidget;
