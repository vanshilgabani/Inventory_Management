// src/components/sync/SyncRequestTray.jsx
import { FiPackage, FiEdit2 } from 'react-icons/fi';

const SyncRequestTray = ({ requests, minimizedIds, onExpand }) => {
  return (
    <div className="flex items-center gap-2">
      {requests.map(req => {
        const isEdit = req.syncType === 'edit';
        const isNew  = (Date.now() - new Date(req.syncedAt).getTime()) < 5 * 60 * 1000;

        return (
          <button
            key={req._id}
            onClick={() => onExpand(req._id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all hover:shadow-md ${
              isEdit
                ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                : 'bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100'
            }`}
          >
            {/* Pulsing dot for recent requests */}
            {isNew && (
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isEdit ? 'bg-amber-400' : 'bg-blue-400'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isEdit ? 'bg-amber-500' : 'bg-blue-500'}`} />
              </span>
            )}

            {isEdit ? <FiEdit2 size={13} /> : <FiPackage size={13} />}

            <span className="max-w-[100px] truncate">
              {req.metadata?.orderChallanNumber || req.wholesaleOrderId?.toString().slice(-6)}
            </span>

            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
              isEdit ? 'bg-amber-200 text-amber-900' : 'bg-blue-200 text-blue-900'
            }`}>
              {isEdit ? 'EDIT' : 'NEW'}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default SyncRequestTray;
