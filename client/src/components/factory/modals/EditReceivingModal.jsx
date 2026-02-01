import { useState, useEffect } from 'react';
import Modal from '../../common/Modal';
import toast from 'react-hot-toast';

const EditReceivingModal = ({ receivings, onClose, onSubmit, enabledSizes }) => {
  const [editData, setEditData] = useState({
    quantities: {},
    batchId: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (receivings && receivings.length > 0) {
      // Merge quantities from all receivings
      const mergedQuantities = {};
      receivings.forEach((r) => {
        const quantities = r.quantities instanceof Map ? Object.fromEntries(r.quantities) : r.quantities;
        Object.keys(quantities).forEach((size) => {
          if (!mergedQuantities[size]) {
            mergedQuantities[size] = 0;
          }
          mergedQuantities[size] += quantities[size] || 0;
        });
      });

      setEditData({
        quantities: mergedQuantities,
        batchId: receivings[0].batchId || '',
        notes: receivings[0].notes || '',
      });
    }
  }, [receivings]);

  const handleQuantityChange = (size, value) => {
    setEditData({
      ...editData,
      quantities: {
        ...editData.quantities,
        [size]: parseInt(value) || 0,
      },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // Validation
    const hasQuantity = Object.values(editData.quantities).some((qty) => qty > 0);
    if (!hasQuantity) {
      toast.error('Please enter at least one quantity');
      return;
    }

    setSubmitting(true);

    try {
      // Update all receivings with the same data
      await Promise.all(
        receivings.map((receiving) =>
          onSubmit(receiving._id, {
            quantities: editData.quantities,
            batchId: editData.batchId,
            notes: editData.notes,
          })
        )
      );
      onClose();
    } catch (error) {
      console.error('Edit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!receivings || receivings.length === 0) return null;

  const receiving = receivings[0];

  return (
    <Modal isOpen={true} onClose={onClose} title="✏️ Edit Receiving" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Receiving Info */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">
            {receiving.design} - {receiving.color}
          </h3>
          <p className="text-sm text-gray-600">
            Editing {receivings.length} receiving record(s)
          </p>
        </div>

        {/* Quantities */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Quantities *
          </label>
          <div className="grid grid-cols-5 gap-4">
            {enabledSizes.map((size) => (
              <div key={size}>
                <label className="block text-sm text-gray-600 mb-1 font-medium">
                  {size}
                </label>
                <input
                  type="number"
                  min="0"
                  value={editData.quantities[size] || ''}
                  onChange={(e) => handleQuantityChange(size, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Batch ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Batch ID
          </label>
          <input
            type="text"
            value={editData.batchId}
            onChange={(e) => setEditData({ ...editData, batchId: e.target.value })}
            placeholder="Optional"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={editData.notes}
            onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
            placeholder="Optional notes"
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-md hover:from-blue-700 hover:to-indigo-700 transition-colors font-medium disabled:opacity-50"
          >
            {submitting ? 'Updating...' : 'Update Receiving'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EditReceivingModal;
