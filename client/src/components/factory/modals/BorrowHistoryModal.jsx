import { useState } from 'react';
import Modal from '../../common/Modal';
import { FiChevronDown, FiChevronUp, FiCalendar } from 'react-icons/fi';
import { format } from 'date-fns';
import { useColorPalette } from '../../../hooks/useColorPalette';

const BorrowHistoryModal = ({ data, onClose, enabledSizes }) => {
  const [expandedItems, setExpandedItems] = useState({});
  const { getColorCode } = useColorPalette();

  const toggleExpand = (id) => {
    setExpandedItems({
      ...expandedItems,
      [id]: !expandedItems[id],
    });
  };

  const calculateTotals = () => {
    const totalBorrowed = data.borrows.reduce((sum, borrow) => {
      const quantities = borrow.quantities instanceof Map ? Object.fromEntries(borrow.quantities) : borrow.quantities;
      return sum + Object.values(quantities).reduce((s, q) => s + (q || 0), 0);
    }, 0);

    const totalReturned = data.borrows.reduce(
      (sum, borrow) => sum + (borrow.returnedQuantity || 0),
      0
    );

    const outstanding = totalBorrowed - totalReturned;

    return { totalBorrowed, totalReturned, outstanding };
  };

  const totals = calculateTotals();

  return (
    <Modal isOpen={true} onClose={onClose} title={`📊 Borrow History - ${data.sourceName}`} size="xl">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-orange-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-orange-600">{totals.totalBorrowed}</div>
            <div className="text-sm text-gray-600">📥 Total Borrowed</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">{totals.totalReturned}</div>
            <div className="text-sm text-gray-600">📤 Total Returned</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-red-600">{totals.outstanding}</div>
            <div className="text-sm text-gray-600">🟠 Still With You</div>
          </div>
        </div>

        {/* Loading */}
        {data.loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading history...</p>
          </div>
        )}

        {/* No Data */}
        {!data.loading && data.borrows.length === 0 && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-gray-600">No borrow history found</p>
          </div>
        )}

        {/* Borrowed Items */}
        {!data.loading && data.borrows.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-700 mb-3">📤 Borrowed Items</h3>
            <div className="space-y-3">
              {data.borrows.map((borrow) => {
                const quantities = borrow.quantities instanceof Map ? Object.fromEntries(borrow.quantities) : borrow.quantities;
                const totalQty = Object.values(quantities).reduce((s, q) => s + (q || 0), 0);
                const returnedQty = borrow.returnedQuantity || 0;
                const remainingQty = totalQty - returnedQty;
                const isExpanded = expandedItems[borrow._id];

                return (
                  <div key={borrow._id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div
                      onClick={() => toggleExpand(borrow._id)}
                      className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <h4 className="font-semibold text-gray-800">
                          {borrow.design} - {borrow.color}
                        </h4>
                        <p className="text-sm text-gray-600">
                          <FiCalendar className="inline mr-1" />
                          {format(new Date(borrow.receivedDate), 'dd MMM yyyy, hh:mm a')}
                        </p>
                        <div className="flex items-center space-x-4 mt-1 text-sm">
                          <span className="text-orange-600 font-medium">
                            Borrowed: {totalQty}
                          </span>
                          {returnedQty > 0 && (
                            <span className="text-green-600 font-medium">
                              Returned: {returnedQty}
                            </span>
                          )}
                          {remainingQty > 0 && (
                            <span className="text-red-600 font-bold">
                              ⚠️ Due: {remainingQty}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600">
                        {isExpanded ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="p-4 bg-white">
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                                Color
                              </th>
                              {enabledSizes.map((size) => (
                                <th key={size} className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">
                                  {size}
                                </th>
                              ))}
                              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  <div
                                    className="w-6 h-6 rounded-full border-2 border-gray-300"
                                    style={{ backgroundColor: getColorCode(borrow.color) }}
                                  />
                                  <span className="font-medium">{borrow.color}</span>
                                </div>
                              </td>
                              {enabledSizes.map((size) => {
                                const qty = quantities[size] || 0;
                                const returnedSizeQty = borrow.returnedQuantities?.[size] || 0;
                                return (
                                  <td key={size} className="px-4 py-3 text-center">
                                    {qty > 0 ? (
                                      <div className="text-xs">
                                        <div className="font-medium text-gray-700">{qty}</div>
                                        {returnedSizeQty > 0 && (
                                          <div className="text-green-600">-{returnedSizeQty}</div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-center">
                                <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-bold">
                                  {totalQty}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-end pt-4 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default BorrowHistoryModal;
