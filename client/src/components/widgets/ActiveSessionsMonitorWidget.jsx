import React, { useState, useEffect, useRef } from 'react';
import { FiUsers, FiClock, FiEdit3, FiChevronDown, FiChevronUp, FiAlertCircle, FiTrash2, FiMove } from 'react-icons/fi';
import toast from 'react-hot-toast';

const ActiveSessionsMonitorWidget = () => {
  const [sessions, setSessions] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());
  
  // ✅ Draggable state
  const [position, setPosition] = useState({ x: 24, y: window.innerHeight - 650 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const widgetRef = useRef(null);

  // Fetch active sessions
  const fetchSessions = async () => {
    try {
      const data = await getAllActiveSessions();
      setSessions(Array.isArray(data?.sessions) ? data.sessions : (Array.isArray(data) ? data : []));
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  // Real-time updates every 3 seconds
  useEffect(() => {
    fetchSessions();
    const interval = setInterval(() => {
      fetchSessions();
      setNow(Date.now());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Dragging handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('.no-drag')) return;
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

  // Handle extension approval
  const handleExtensionResponse = async (sessionId, extensionId, status, minutes) => {
    try {
      await respondToExtension(sessionId, extensionId, {
        status,
        grantedMinutes: minutes
      });
      toast.success(status === 'approved' ? '✅ Extension Approved' : '❌ Extension Rejected');
      fetchSessions();
    } catch (error) {
      toast.error('Failed to process extension');
    }
  };

  const pendingExtensions = sessions.filter(s => 
    s.extensionLog?.some(ext => ext.status === 'pending')
  );

  if (sessions.length === 0) return null;

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
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 px-4 py-3 rounded-full shadow-2xl hover:scale-105 transition-all duration-300">
              <div className="flex items-center gap-2">
                <FiUsers className="text-white" size={20} />
                <span className="text-white font-bold text-sm">{sessions.length}</span>
              </div>
            </div>
            {pendingExtensions.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                {pendingExtensions.length}
              </span>
            )}
            <div className="absolute bottom-full left-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl">
                {sessions.length} Active Session{sessions.length !== 1 && 's'}
                {pendingExtensions.length > 0 && ` · ${pendingExtensions.length} Extension Request${pendingExtensions.length !== 1 ? 's' : ''}`}
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
          className="w-[400px] max-h-[600px] bg-white rounded-2xl shadow-2xl border-2 border-indigo-200 overflow-hidden animate-scaleIn"
        >
          {/* Header - Draggable */}
          <div 
            className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                  <FiMove className="text-white" size={16} />
                </div>
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                  <FiUsers className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Active Sessions</h3>
                  <p className="text-white/80 text-xs">{sessions.length} salesperson{sessions.length !== 1 && 's'} editing</p>
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

          {/* Sessions List */}
          <div className="max-h-[520px] overflow-y-auto no-drag">
            {sessions.map((session, index) => (
              <SessionCard
                key={session._id || index}
                session={session}
                now={now}
                onExtensionResponse={handleExtensionResponse}
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

// SessionCard component remains the same...
const SessionCard = ({ session, now, onExtensionResponse }) => {
  const timeLeft = Math.max(0, Math.floor((new Date(session.expiresAt) - now) / 1000));
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  const changesUsed = (session.maxChanges || 0) - (session.remainingChanges || 0);
  const isLowTime = timeLeft <= 120;
  const isLowChanges = !session.isInfinite && session.remainingChanges <= 1;

  const pendingExtension = session.extensionLog?.find(ext => ext.status === 'pending');

  return (
    <div className="border-b border-gray-200 p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-900">{session.userName || 'Salesperson'}</p>
          <p className="text-xs text-gray-500">{session.userEmail}</p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold tabular-nums ${isLowTime ? 'text-red-600 animate-pulse' : 'text-green-600'}`}>
            {minutes}:{String(seconds).padStart(2, '0')}
          </p>
          <p className="text-xs text-gray-500">remaining</p>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Time</span>
            <span>{session.timeWindowMinutes}m total</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${isLowTime ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${(timeLeft / (session.timeWindowMinutes * 60)) * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Edits</span>
            <span>{session.isInfinite ? '∞' : `${session.remainingChanges}/${session.maxChanges}`}</span>
          </div>
          {!session.isInfinite && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${isLowChanges ? 'bg-orange-500' : 'bg-blue-500'}`}
                style={{ width: `${(session.remainingChanges / session.maxChanges) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div className="bg-indigo-50 p-2 rounded text-center">
          <p className="text-gray-600">Used</p>
          <p className="font-bold text-indigo-600">{changesUsed}</p>
        </div>
        <div className="bg-purple-50 p-2 rounded text-center">
          <p className="text-gray-600">Level</p>
          <p className="font-bold text-purple-600">
            {session.permissionLevel === 'level1' ? 'Edit' :
             session.permissionLevel === 'level2' ? 'E+D' : 'Full'}
          </p>
        </div>
        <div className="bg-green-50 p-2 rounded text-center">
          <p className="text-gray-600">Session</p>
          <p className="font-bold text-green-600">
            {session.isInfinite ? '∞' : session.maxChanges}
          </p>
        </div>
      </div>

      {pendingExtension && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-2">
          <div className="flex items-start gap-2 mb-2">
            <FiAlertCircle className="text-yellow-600 mt-0.5" size={16} />
            <div className="flex-1">
              <p className="text-xs font-semibold text-yellow-900">Extension Requested</p>
              <p className="text-xs text-yellow-700 italic">"{pendingExtension.reason}"</p>
              <p className="text-xs text-yellow-600 mt-1">Wants +{pendingExtension.requestedMinutes} minutes</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onExtensionResponse(session._id, pendingExtension._id, 'approved', pendingExtension.requestedMinutes)}
              className="flex-1 bg-green-500 text-white text-xs px-3 py-1.5 rounded hover:bg-green-600 transition-all"
            >
              Approve
            </button>
            <button
              onClick={() => onExtensionResponse(session._id, pendingExtension._id, 'rejected')}
              className="flex-1 bg-red-500 text-white text-xs px-3 py-1.5 rounded hover:bg-red-600 transition-all"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {(isLowTime || isLowChanges) && (
        <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
          <FiAlertCircle size={14} />
          <span>
            {isLowTime && 'Time running out'}
            {isLowTime && isLowChanges && ' · '}
            {isLowChanges && 'Low edits remaining'}
          </span>
        </div>
      )}
    </div>
  );
};

export default ActiveSessionsMonitorWidget;
