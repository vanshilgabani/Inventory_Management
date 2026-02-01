import { FiChevronDown, FiChevronUp, FiUser, FiCalendar } from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { useColorPalette } from '../../../hooks/useColorPalette';

const BorrowerCard = ({ borrower, enabledSizes, canEditDelete, onReturn, onViewHistory, products, isExpanded, onToggle }) => {
  const { getColorCode } = useColorPalette();

  const getStatusBadge = (status) => {
    const configs = {
      active: {
        label: 'ACTIVE',
        bg: 'bg-orange-100',
        text: 'text-orange-800',
        icon: '🟠',
      },
      partial: {
        label: 'PARTIAL',
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        icon: '⚠️',
      },
      completed: {
        label: 'COMPLETED',
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: '✅',
      },
    };

    const config = configs[status] || configs.active;

    return (
      <span
        className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-semibold ${config.bg} ${config.text}`}
      >
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
      {/* Borrower Header */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-red-50 cursor-pointer hover:from-orange-100 hover:to-red-100 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
            {borrower.sourceName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
              <FiUser className="text-gray-600" />
              <span>{borrower.sourceName}</span>
            </h3>
            <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
              <span>📤 Borrowed: <strong>{borrower.totalBorrowed}</strong></span>
              <span>↩️ Returned: <strong>{borrower.totalReturned}</strong></span>
              <span className="text-orange-600 font-semibold">
                ⚠️ Outstanding: <strong>{borrower.outstanding}</strong>
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {getStatusBadge(borrower.status)}
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            {isExpanded ? (
              <FiChevronUp className="text-2xl" />
            ) : (
              <FiChevronDown className="text-2xl" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Borrowed Items Section */}
          <div>
            <h4 className="text-md font-semibold text-gray-700 mb-3 flex items-center space-x-2 border-b pb-2">
              <span>📦</span>
              <span>Borrowed Items</span>
            </h4>
            {borrower.borrowedItems.length === 0 ? (
              <p className="text-gray-500 text-sm">No active borrowed items</p>
            ) : (
              <div className="space-y-4">
                {borrower.borrowedItems.map((item, index) => {
                  const borrowed = Object.values(item.quantities).reduce((sum, q) => sum + q, 0);
                  const returned = item.returnedQuantity || 0;
                  const outstanding = borrowed - returned;

                  return (
                    <div
                      key={index}
                      className="border border-orange-200 rounded-lg p-4 bg-orange-50"
                    >
                      {/* Item Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-8 h-8 rounded-full border-2 border-white shadow-md"
                            style={{ backgroundColor: getColorCode(item.color) }}
                          />
                          <div>
                            <h5 className="font-semibold text-gray-800">
                              {item.design} - {item.color}
                            </h5>
                            <p className="text-sm text-gray-600">
                              <FiCalendar className="inline mr-1" />
                              Borrowed: {format(parseISO(item.borrowedDate), 'dd MMM yyyy, hh:mm a')}
                            </p>
                            {item.returnDueDate && (
                              <p className="text-sm text-orange-700 font-medium">
                                📅 Due: {format(parseISO(item.returnDueDate), 'dd MMM yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Status</div>
                          <div className="font-semibold text-orange-700">
                            {item.borrowStatus === 'active' && '🔥 Active'}
                            {item.borrowStatus === 'partial' && '⚠️ Partial'}
                            {item.borrowStatus === 'returned' && '✅ Returned'}
                          </div>
                        </div>
                      </div>

                      {/* Size-wise breakdown */}
                      <div className="bg-white rounded-lg p-3 mb-3">
                        <div className="text-xs font-semibold text-gray-600 mb-2">SIZE BREAKDOWN:</div>
                        <div className="flex flex-wrap gap-2">
                          {enabledSizes.map((size) => {
                            const borrowedQty = item.quantities[size] || 0;
                            const returnedQty = item.returnedQuantities?.[size] || 0;
                            const remainingQty = borrowedQty - returnedQty;

                            if (borrowedQty === 0) return null;

                            return (
                              <div
                                key={size}
                                className={`px-3 py-2 rounded-md text-sm border-2 ${
                                  remainingQty > 0
                                    ? 'bg-orange-100 border-orange-300 text-orange-800'
                                    : 'bg-green-100 border-green-300 text-green-800'
                                }`}
                              >
                                <div className="font-bold">{size}</div>
                                <div className="text-xs">Borrowed: {borrowedQty}</div>
                                {returnedQty > 0 && (
                                  <div className="text-xs text-green-700">Returned: {returnedQty}</div>
                                )}
                                {remainingQty > 0 && (
                                  <div className="text-xs font-bold text-orange-700">
                                    Due: {remainingQty}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="bg-gradient-to-r from-orange-100 to-red-100 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center space-x-6">
                          <div>
                            <div className="text-xs text-gray-600">Total Borrowed</div>
                            <div className="text-lg font-bold text-orange-700">{borrowed} units</div>
                          </div>
                          {returned > 0 && (
                            <div>
                              <div className="text-xs text-gray-600">Returned</div>
                              <div className="text-lg font-bold text-green-700">{returned} units</div>
                            </div>
                          )}
                          {outstanding > 0 && (
                            <div>
                              <div className="text-xs text-gray-600">Outstanding</div>
                              <div className="text-lg font-bold text-red-700">{outstanding} units</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Return History Section */}
          {borrower.returns && borrower.returns.length > 0 && (
            <div>
              <h4 className="text-md font-semibold text-gray-700 mb-3 flex items-center space-x-2 border-b pb-2">
                <span>↩️</span>
                <span>Return History</span>
              </h4>
              <div className="space-y-4">
                {borrower.returns.map((returnItem, index) => {
                  // Find the original borrow item
                  const originalBorrow = borrower.borrowedItems.find(
                    b => b.design === returnItem.design && b.color === returnItem.color
                  );

                  return (
                    <div
                      key={index}
                      className="border border-green-200 rounded-lg p-4 bg-green-50"
                    >
                      {/* Return Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-8 h-8 rounded-full border-2 border-white shadow-md"
                            style={{ backgroundColor: getColorCode(returnItem.color) }}
                          />
                          <div>
                            <h5 className="font-semibold text-gray-800">
                              {returnItem.design} - {returnItem.color}
                            </h5>
                            <p className="text-sm text-gray-600">
                              <FiCalendar className="inline mr-1" />
                              Returned: {format(parseISO(returnItem.returnedDate), 'dd MMM yyyy, hh:mm a')}
                            </p>
                            {originalBorrow && (
                              <p className="text-xs text-gray-500">
                                📦 From borrow on: {format(parseISO(originalBorrow.borrowedDate), 'dd MMM yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div>
                          {returnItem.returnType === 'same' ? (
                            <span className="text-xs bg-green-600 text-white px-3 py-1 rounded-full font-semibold">
                              ✅ Same Items
                            </span>
                          ) : (
                            <span className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full font-semibold">
                              🔀 Exchange
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Size-wise returned breakdown */}
                      <div className="bg-white rounded-lg p-3 mb-3">
                        <div className="text-xs font-semibold text-gray-600 mb-2">RETURNED QUANTITIES:</div>
                        <div className="flex flex-wrap gap-2">
                          {enabledSizes.map((size) => {
                            const returnedQty = returnItem.quantities?.[size] || 0;
                            if (returnedQty === 0) return null;

                            return (
                              <div
                                key={size}
                                className="px-3 py-2 rounded-md text-sm bg-green-100 border-2 border-green-300 text-green-800"
                              >
                                <div className="font-bold">{size}</div>
                                <div className="text-xs">{returnedQty} units</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Total Returned */}
                      <div className="bg-green-100 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Total Returned:</span>
                          <span className="text-lg font-bold text-green-700">
                            {returnItem.totalQuantity} units
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => onViewHistory(borrower.sourceName)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
            >
              📊 View Full History
            </button>
            {borrower.status !== 'completed' && canEditDelete && (
              <button
                onClick={() => {
                  const activeItem = borrower.borrowedItems.find(
                    (item) => item.totalQuantity - item.returnedQuantity > 0
                  );
                  if (activeItem) {
                    onReturn(activeItem.receipt);
                  }
                }}
                className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-md hover:from-orange-700 hover:to-red-700 transition-colors font-medium"
              >
                📤 Mark as Returned
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BorrowerCard;
