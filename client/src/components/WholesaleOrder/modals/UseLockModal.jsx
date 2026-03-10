import Modal from '../../common/Modal';
import { FiAlertTriangle } from 'react-icons/fi';

export default function UseLockModal({ show, data, onConfirm, onCancel }) {
  if (!show || !data) return null;
  return (
    <Modal onClose={onCancel} title="Use Locked Stock?" size="sm">
      <div className="p-5">
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5">
          <FiAlertTriangle className="text-amber-500 text-xl flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Some items exceed available stock</p>
            <p className="text-amber-700 text-xs mt-1">
              Locked stock is available to fulfill this order.
              Using it will reduce your safety buffer.
            </p>
          </div>
        </div>

        {data.insufficientItems?.length > 0 && (
          <div className="space-y-2 mb-5">
            {data.insufficientItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded-lg">
                <span className="font-medium text-gray-700">
                  {item.design} · {item.color} · {item.size}
                </span>
                <span className="text-xs text-red-600 font-semibold">
                  Need {item.neededFromReserved} from reserved
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm
                       font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white
                       rounded-xl text-sm font-semibold transition-colors">
            Yes, Use Locked Stock
          </button>
        </div>
      </div>
    </Modal>
  );
}
