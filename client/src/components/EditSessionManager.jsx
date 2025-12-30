import React from 'react';
import { useEditSession } from '../hooks/useEditSession';

const EditSessionManager = () => {
  const {
    session,
    loading,
    timeLeft,
    needsEditSession,
    hasActiveSession,
    remainingChanges,
    startSession,
    endSession,
  } = useEditSession();

  // Don't show for admins
  if (!needsEditSession) return null;

  const handleStart = async () => {
    const result = await startSession();
    if (!result.success) {
      alert(result.error);
    }
  };

  const handleEnd = async () => {
    if (window.confirm('Are you sure you want to end this session?')) {
      await endSession();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <h3 className="text-lg font-semibold mb-3 flex items-center">
        <span className="mr-2">✏️</span>
        Edit Session
      </h3>

      {!hasActiveSession ? (
        <div>
          <p className="text-sm text-gray-600 mb-3">
            Start a session to edit or delete records
          </p>
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Starting...' : '▶️ Start Edit Session'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Remaining Changes */}
          <div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
            <span className="text-sm font-medium text-blue-900">
              Remaining Edits
            </span>
            <span className="text-2xl font-bold text-blue-600">
              {remainingChanges}
            </span>
          </div>

          {/* Time Left */}
          {timeLeft && (
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded border border-orange-200">
              <span className="text-sm font-medium text-orange-900">
                Time Left
              </span>
              <span className={`text-2xl font-bold ${
                timeLeft.totalSeconds < 60 ? 'text-red-600 animate-pulse' : 'text-orange-600'
              }`}>
                {timeLeft.minutes}:{String(timeLeft.seconds).padStart(2, '0')}
              </span>
            </div>
          )}

          {/* Warning if running low */}
          {remainingChanges === 1 && (
            <div className="p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">
              ⚠️ Last edit remaining!
            </div>
          )}

          {timeLeft && timeLeft.totalSeconds < 60 && (
            <div className="p-2 bg-red-50 border border-red-300 rounded text-xs text-red-800">
              ⏰ Less than 1 minute left!
            </div>
          )}

          {/* End Session Button */}
          <button
            onClick={handleEnd}
            disabled={loading}
            className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Ending...' : '⏹️ End Session'}
          </button>
        </div>
      )}
    </div>
  );
};

export default EditSessionManager;
