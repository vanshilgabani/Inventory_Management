import Modal from '../../common/Modal';
import { FiTrash2, FiClock, FiFolder, FiPackage } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';

// ── Helper: total pieces across all items in a draft ──
const getDraftSummary = (orderItems = []) => {
  const designs = orderItems
    .filter(i => i.design)
    .map(i => i.design);

  const totalPcs = orderItems.reduce((sum, item) => {
    return sum + item.selectedColors.reduce((s, color) => {
      const cd = item.colorData?.[color];
      if (!cd) return s;
      if (cd.mode === 'sets') {
        return s + (Number(cd.sets) || 0) * Object.keys(cd.pieces || {}).length;
      }
      return s + Object.values(cd.pieces || {}).reduce((p, q) => p + (Number(q) || 0), 0);
    }, 0);
  }, 0);

  return { designs, totalPcs };
};

export default function DraftsListModal({ show, drafts, onLoad, onDelete, onClearAll, onClose }) {
  if (!show) return null;

  return (
    <Modal isOpen={true} onClose={onClose} title="Saved Drafts" size="md">
      <div className="p-4">
        {!drafts.length ? (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <FiFolder className="text-4xl mb-3" />
            <p className="font-medium">No saved drafts</p>
            <p className="text-sm mt-1">Drafts auto-save every 30 seconds</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {drafts.map(draft => {
                const { designs, totalPcs } = getDraftSummary(draft.orderItems);
                return (
                  <div
                    key={draft.id}
                    className="p-3 bg-gray-50 rounded-xl border border-gray-200
                               hover:border-indigo-300 transition-colors"
                  >
                    {/* Top row — name + actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">

                        {/* Business / buyer name */}
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {draft.formData?.businessName || draft.formData?.buyerName || 'Unnamed Draft'}
                        </p>

                        {/* Time ago */}
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                          <FiClock size={10} />
                          {formatDistanceToNow(new Date(draft.timestamp), { addSuffix: true })}
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => onLoad(draft)}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold
                                     rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => onDelete(draft.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50
                                     rounded-lg transition-colors"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Bottom row — designs + pcs */}
                    {designs.length > 0 && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <FiPackage size={11} className="text-gray-400 flex-shrink-0" />
                        <div className="flex flex-wrap gap-1">
                          {designs.slice(0, 4).map(d => (
                            <span
                              key={d}
                              className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600
                                         border border-indigo-100 rounded-full font-medium"
                            >
                              {d}
                            </span>
                          ))}
                          {designs.length > 4 && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                              +{designs.length - 4} more
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                          {totalPcs} pcs
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <span className="text-xs text-gray-400">
                {drafts.length} of 10 drafts • Auto-saves every 30s
              </span>
              <button
                onClick={onClearAll}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Clear all
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
