import { useState, useEffect, useRef, useCallback } from 'react';
import { FiAlertTriangle, FiX, FiChevronDown, FiChevronUp, FiPackage } from 'react-icons/fi';
import axios from 'axios'; // or your existing api service

const POLL_INTERVAL_MS = 30000; // 30 seconds

const AutoAllocationBanner = () => {
  const [notifications, setNotifications]   = useState([]);
  const [expanded, setExpanded]             = useState(false);
  const [dismissing, setDismissing]         = useState({}); // { [id]: true }
  const dropdownRef                         = useRef(null);
  const pollRef                             = useRef(null);

  // ── Fetch active (undismissed) notifications ────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get('/api/auto-allocation/notifications?dismissed=false');
      if (res.data?.success) {
        setNotifications(res.data.data || []);
      }
    } catch (err) {
      // Silent fail — banner should never break the UI
    }
  }, []);

  // ── Start polling on mount, clear on unmount ────────────────────────────
  useEffect(() => {
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetchNotifications]);

  // ── Close dropdown when clicking outside ───────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setExpanded(false);
      }
    };
    if (expanded) document.addEventListener('mousedown', handleClickOutside);
    return ()  => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded]);

  // ── Dismiss single notification ─────────────────────────────────────────
  const handleDismiss = async (e, notifId) => {
    e.stopPropagation(); // don't toggle dropdown
    setDismissing(prev => ({ ...prev, [notifId]: true }));
    try {
      await axios.patch(`/api/auto-allocation/notifications/${notifId}/dismiss`);
      setNotifications(prev => prev.filter(n => n._id !== notifId));
      if (notifications.length === 1) setExpanded(false);
    } catch (err) {
      // Silent fail
    } finally {
      setDismissing(prev => ({ ...prev, [notifId]: false }));
    }
  };

  // ── Dismiss all ─────────────────────────────────────────────────────────
  const handleDismissAll = async (e) => {
    e.stopPropagation();
    try {
      await axios.patch('/api/auto-allocation/notifications/dismiss-all');
      setNotifications([]);
      setExpanded(false);
    } catch (err) {
      // Silent fail
    }
  };

  // ── Nothing to show ─────────────────────────────────────────────────────
  if (notifications.length === 0) return null;

  const count = notifications.length;

  // ── Trigger label ───────────────────────────────────────────────────────
  const getTriggerLabel = (triggeredBy, triggeredByAccount) => {
    if (triggeredBy === 'account_empty') return `${triggeredByAccount} hit 0`;
    if (triggeredBy === 'transfer')      return 'After restock transfer';
    return 'Manual run';
  };

  return (
    <div className="relative" ref={dropdownRef}>

      {/* ── Pill button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold
                   bg-amber-50 border border-amber-400 text-amber-800
                   hover:bg-amber-100 transition-all shadow-sm"
      >
        {/* Pulsing dot */}
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
        </span>

        <FiAlertTriangle className="w-3.5 h-3.5 text-amber-600" />

        <span>
          {count === 1
            ? '1 reallocation ran'
            : `${count} reallocations ran`}
          {' '}— update Flipkart
        </span>

        {expanded
          ? <FiChevronUp  className="w-3.5 h-3.5 ml-1" />
          : <FiChevronDown className="w-3.5 h-3.5 ml-1" />
        }
      </button>

      {/* ── Dropdown ────────────────────────────────────────────────────── */}
      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl
                        border border-amber-200 z-50 overflow-hidden">

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
              <div key={notif._id} className="p-4 hover:bg-gray-50 transition-colors">

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
                    title="Dismiss"
                  >
                    <FiX className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Variants table */}
                {notif.variants?.map((variant, vi) => (
                  <div key={vi} className="mt-2 bg-gray-50 rounded-lg p-2.5 border border-gray-200">

                    {/* Variant label */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <FiPackage className="w-3 h-3 text-gray-500" />
                      <span className="text-xs font-bold text-gray-800">
                        {variant.design} · {variant.color} · {variant.size}
                      </span>
                      <span className="text-xs text-gray-500 ml-auto">
                        Total: {variant.totalReservedStock} units
                      </span>
                    </div>

                    {/* Per account changes */}
                    <div className="space-y-1">
                      {variant.accounts?.map((acc, ai) => {
                        const diff = acc.newAllocation - acc.previousAllocation;
                        return (
                          <div key={ai}
                               className="flex items-center justify-between text-xs">
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
                              <span className="text-gray-400 line-through">
                                {acc.previousAllocation}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="font-bold text-gray-900">
                                {acc.newAllocation}
                              </span>
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

          {/* Footer hint */}
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Update stock on Flipkart dashboard to match above allocations
            </p>
          </div>

        </div>
      )}
    </div>
  );
};

export default AutoAllocationBanner;
