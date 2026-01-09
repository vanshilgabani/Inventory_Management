import React, { useState, useEffect } from 'react';
import { FiBell, FiCheck, FiX, FiClock, FiUser } from 'react-icons/fi';
import toast from 'react-hot-toast';

const AdminPermissionRequestModal = ({ request, onClose, onApprove, onDeny }) => {
  const [countdown, setCountdown] = useState(3);
  const [customizing, setCustomizing] = useState(false);
  const [maxChanges, setMaxChanges] = useState(request?.suggestedMaxChanges || 2);
  const [timeWindowMinutes, setTimeWindowMinutes] = useState(request?.suggestedTimeWindowMinutes || 5);
  const [permissionLevel, setPermissionLevel] = useState(request?.suggestedPermissionLevel || 'level2');
  const [loading, setLoading] = useState(false);
  const [isInfinite, setIsInfinite] = useState(false);

  useEffect(() => {
    if (!customizing && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (!customizing && countdown === 0) {
      handleApprove();
    }
  }, [countdown, customizing]);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await respondToRequest(request._id, {
        status: 'approved',
        maxChanges: isInfinite ? null : maxChanges,
        timeWindowMinutes,
        permissionLevel
      });
      toast.success('Access granted!');
      onApprove();
      onClose();
    } catch (error) {
      toast.error('Failed to approve request');
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    setLoading(true);
    try {
      await respondToRequest(request._id, { status: 'denied' });
      toast.success('Request denied');
      onDeny();
      onClose();
    } catch (error) {
      toast.error('Failed to deny request');
    } finally {
      setLoading(false);
    }
  };

  if (!request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-yellow-100 rounded-xl animate-pulse">
            <FiBell className="text-2xl text-yellow-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800">Permission Request</h2>
            <p className="text-sm text-gray-500">A salesperson needs edit access</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX className="text-xl text-gray-600" />
          </button>
        </div>

        {/* Request Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
          <div className="flex items-center gap-2">
            <FiUser className="text-gray-600" />
            <div>
              <p className="text-sm text-gray-500">From</p>
              <p className="font-semibold text-gray-800">{request.requesterName}</p>
              <p className="text-xs text-gray-500">{request.requesterEmail}</p>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-sm text-gray-500 mb-1">Reason</p>
            <p className="text-gray-800 italic">"{request.reason || 'No reason provided'}"</p>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <FiClock />
            <span>Requested {new Date(request.requestedAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Configuration */}
        {customizing ? (
          <div className="bg-indigo-50 rounded-lg p-4 mb-4 space-y-3">
            <h3 className="font-semibold text-gray-800 mb-3">Grant Access</h3>
            
            {/* Changes Limit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Changes Allowed
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={maxChanges}
                  onChange={(e) => setMaxChanges(parseInt(e.target.value))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  min="1"
                  max="50"
                  disabled={isInfinite}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isInfinite}
                    onChange={(e) => setIsInfinite(e.target.checked)}
                    className="rounded"
                  />
                  Infinite
                </label>
              </div>
            </div>

            {/* Time Window */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={timeWindowMinutes}
                onChange={(e) => setTimeWindowMinutes(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                min="1"
                max="120"
              />
            </div>

            {/* Permission Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Permission Level
              </label>
              <select
                value={permissionLevel}
                onChange={(e) => setPermissionLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="level1">Level 1: Edit Only</option>
                <option value="level2">Level 2: Edit + Delete</option>
                <option value="level3">Level 3: Full Access (with Bulk)</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-800">
              ⚡ <strong>Quick Approve:</strong> {isInfinite ? 'Infinite' : maxChanges} changes for {timeWindowMinutes} minutes
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDeny}
            disabled={loading}
            className="flex-1 px-4 py-3 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors font-medium disabled:opacity-50"
          >
            Deny
          </button>

          {!customizing && (
            <button
              onClick={() => {
                setCustomizing(true);
                setCountdown(0);
              }}
              className="flex-1 px-4 py-3 border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
            >
              Custom Setup
            </button>
          )}

          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <FiCheck />
                {!customizing && countdown > 0 ? `Approve (${countdown}s)` : 'Approve'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPermissionRequestModal;
