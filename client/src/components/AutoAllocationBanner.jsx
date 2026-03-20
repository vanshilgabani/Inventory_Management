import { useState, useEffect, useRef, useCallback } from 'react';
import { FiAlertTriangle, FiX, FiChevronDown, FiChevronUp, FiPackage } from 'react-icons/fi';
import axios from 'axios';

const AutoAllocationBanner = () => {
  const [notifications, setNotifications] = useState([]);
  const [expanded, setExpanded]           = useState(false);
  const [dismissing, setDismissing]       = useState({});
  const [newIds, setNewIds]               = useState(new Set()); // ids to animate in
  const dropdownRef                       = useRef(null);
  const eventSourceRef                    = useRef(null);
  const reconnectTimerRef                 = useRef(null);

  // ── Connect to SSE ────────────────────────────────────────────────────────
  const connectSSE = useCallback(() => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    // EventSource doesn't support custom headers natively
    // so we pass token as query param — make sure your protect middleware supports this
    const url = `/api/auto-allocation/stream?token=${token}`;
    const es  = new EventSource(url);

    // ── On connect: receive current notifications immediately ────────────
    es.addEventListener('init', (e) => {
      try {
        const { notifications: existing } = JSON.parse(e.data);
        setNotifications(existing || []);
      } catch (_) {}
    });

    // ── Real-time push: new allocation just ran ──────────────────────────
    es.addEventListener('new_allocation', (e) => {
      try {
        const { notification } = JSON.parse(e.data);
        setNotifications(prev => {
          // Avoid duplicates
          if (prev.some(n => n._id === notification._id)) return prev;
          return [notification, ...prev];
        });
        // Mark as new for animation
        setNewIds(prev => new Set([...prev, notification._id]));
        // Remove animation class after it completes
        setTimeout(() => {
          setNewIds(prev => {
            const next = new Set(prev);
            next.delete(notification._id);
            return next;
          });
        }, 600);
        // Auto-expand banner when new notification arrives
        setExpanded(true);
      } catch (_) {}
    });

    // ── On error: reconnect after 5s ─────────────────────────────────────
    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      // Reconnect after 5 seconds
      reconnectTimerRef.current = setTimeout(connectSSE, 5000);
    };

    eventSourceRef.current = es;
  }, []);

  // ── Mount: connect SSE. Unmount: cleanup ─────────────────────────────────
  useEffect(() => {
    connectSSE();
    return () => {
      eventSourceRef.current?.close();
      clearTimeout(reconnectTimerRef.current);
    };
  }, [connectSSE]);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setExpanded(false);
      }
    };
    if (expanded) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded]);

  // ── Dismiss single ────────────────────────────────────────────────────────
  const handleDismiss = async (e, notifId) => {
    e.stopPropagation();
    setDismissing(prev => ({ ...prev, [notifId]: true }));
    try {
      await axios.patch(`/api/auto-allocation/notifications/${notifId}/dismiss`);
      // Animate out: wait for CSS transition then remove
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n._id !== notifId));
        if (notifications.length === 1) setExpanded(false);
      }, 300);
    } catch (_) {
      setDismissing(prev => ({ ...prev, [notifId]: false }));
    }
  };

  // ── Dismiss all ───────────────────────────────────────────────────────────
  const handleDismissAll = async (e) => {
    e.stopPropagation();
    try {
      await axios.patch('/api/auto-allocation/notifications/dismiss-all');
      setNotifications([]);
      setExpanded(false);
    } catch (_) {}
  };

  if (notifications.length === 0) return null;

  const count = notifications.length;

  const getTriggerLabel = (triggeredBy, triggeredByAccount) => {
    if (triggeredBy === 'account_empty') return `${triggeredByAccount} hit 0`;
    if (triggeredBy === 'transfer')      return 'After restock';
    return 'Manual run';
  };

  return (
    <div className="relative" ref={dropdownRef}>

      {/* ── Pill button ───────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold
                   bg-amber-50 border border-amber-400 text-amber-800
                   hover:bg-amber-100 transition-all shadow-sm"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
        </span>
        <FiAlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        <span>
          {count === 1 ? '1 reallocation ran' : `${count} reallocations ran`}
          {' '}— update Flipkart
        </span>
        {expanded
          ? <FiChevronUp  className="w-3.5 h-3.5 ml-1" />
          : <FiChevronDown className="w-3.5 h-3.5 ml-1" />
        }
      </button>

      {/* ── Dropdown ──────────────────────────────────────────────────── */}
      <div
        className={`absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl
                    border border-amber-200 z-50 overflow-hidden
                    transition-all duration-300 origin-top-right
                    ${expanded
                      ? 'opacity-100 scale-100 pointer-events-auto'
                      : 'opacity-0 scale-95 pointer-events-none'
                    }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3
                        bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <FiAlertTriangle className="text-amber-600 w-4 h-4" />
            <span className="font-bold text-amber-900 text-sm">
              Stock Reallocated — Update Flipkart
            </span>
          </div>
          {count > 1 && (
            <button
              onClick={handleDismissAll}
              className="text-xs text-amber-700 hover:text-amber-900 font-semibold
                         px-2 py-1 rounded hover:bg-amber-100 transition-colors"
            >
              Dismiss All
            </button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
          {notifications.map(notif => (
            <div
              key={notif._id}
              className={`p-4 transition-all duration-300
                ${dismissing[notif._id]
                  ? 'opacity-0 max-h-0 overflow-hidden py-0'
                  : 'opacity-100 max-h-96'
                }
                ${newIds.has(notif._id)
                  ? 'animate-[slideIn_0.4s_ease-out]'
                  : ''
                }
                hover:bg-gray-50`}
            >
              {/* Notif header row */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs font-semibold text-amber-700 bg-amber-100
                                   px-2 py-0.5 rounded-full">
                    {getTriggerLabel(notif.triggeredBy, notif.triggeredByAccount)}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(notif.createdAt).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit'
                    })}
                    {' '}· Analysis: last {notif.periodDaysUsed}d
                  </p>
                </div>
                <button
                  onClick={(e) => handleDismiss(e, notif._id)}
                  disabled={dismissing[notif._id]}
                  className="p-1 hover:bg-gray-200 rounded-full transition-colors
                             text-gray-400 hover:text-gray-700 flex-shrink-0 ml-2"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Variants */}
              {notif.variants?.map((variant, vi) => (
                <div key={vi} className="mt-2 bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                  <div className="flex items-center gap-1.5 mb-2">
                    <FiPackage className="w-3 h-3 text-gray-500" />
                    <span className="text-xs font-bold text-gray-800">
                      {variant.design} · {variant.color} · {variant.size}
                    </span>
                    <span className="text-xs text-gray-500 ml-auto">
                      Total: {variant.totalReservedStock} units
                    </span>
                  </div>
                  <div className="space-y-1">
                    {variant.accounts?.map((acc, ai) => {
                      const diff = acc.newAllocation - acc.previousAllocation;
                      return (
                        <div key={ai} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-700 truncate max-w-28">
                              {acc.accountName}
                            </span>
                            {acc.isNewAccount && (
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700
                                               rounded text-[10px] font-semibold">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 line-through">{acc.previousAllocation}</span>
                            <span className="text-gray-400">→</span>
                            <span className="font-bold text-gray-900">{acc.newAllocation}</span>
                            <span className={`font-semibold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {diff >= 0 ? `+${diff}` : diff}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Update stock on Flipkart dashboard to match above allocations
          </p>
        </div>
      </div>

      {/* ── Slide-in keyframe (add to your global CSS or tailwind config) ── */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default AutoAllocationBanner;
