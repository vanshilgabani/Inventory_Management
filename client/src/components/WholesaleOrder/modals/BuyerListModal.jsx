import { useState } from 'react';
import Modal from '../../common/Modal';
import { FiSearch } from 'react-icons/fi';

export default function BuyerListModal({ show, buyers, onSelect, onClose }) {
  const [q, setQ] = useState('');
  if (!show) return null;

  const filtered = buyers.filter(b =>
    b.name?.toLowerCase().includes(q.toLowerCase()) ||
    b.mobile?.includes(q) ||
    b.businessName?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Modal isOpen={true} onClose={onClose} title="Select Buyer" size="md">
      <div className="p-4">
        {/* Search */}
        <div className="relative mb-3">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by name, mobile..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Buyer list */}
        <div className="max-h-80 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-gray-400 text-sm">No buyers found</p>
          ) : filtered.map(buyer => (
            <button
              key={buyer._id}
              onClick={() => { onSelect(buyer); onClose(); }}
              className="w-full flex items-center justify-between p-3 rounded-xl text-left
                         hover:bg-indigo-50 hover:border-indigo-200 border border-transparent transition-all"
            >
              <div>
                <p className="font-semibold text-gray-900 text-sm">{buyer.businessName || buyer.name}</p>
                <p className="text-xs text-gray-400">{buyer.mobile}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{buyer.totalOrders || 0} orders</p>
                {buyer.totalDue > 0 && (
                  <p className="text-xs text-red-500 font-medium">₹{buyer.totalDue?.toLocaleString()} due</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
