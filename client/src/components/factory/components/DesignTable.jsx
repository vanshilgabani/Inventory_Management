import { FiEdit, FiTrash2, FiPackage } from 'react-icons/fi';
import { useColorPalette } from '../../../hooks/useColorPalette';

const DesignTable = ({ design, enabledSizes, canEditDelete, onEdit, onDelete }) => {
  const { getColorCode } = useColorPalette();

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Design Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FiPackage className="text-gray-600 text-xl" />
            <div>
              <h4 className="text-lg font-semibold text-gray-800">{design.design}</h4>
              {design.notes && (
                <p className="text-sm text-gray-500">📝 {design.notes}</p>
              )}
              {design.batchIds && design.batchIds.length > 0 && (
                <p className="text-sm text-gray-500">
                  🏷️ Batch: {design.batchIds.join(', ')}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-lg font-bold text-gray-800">{design.totalQuantity} units</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                Color
              </th>
              {enabledSizes.map((size) => (
                <th
                  key={size}
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  {size}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Total
              </th>
              {canEditDelete && (
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {design.colors.map((colorData, idx) => {
              const colorCode = getColorCode(colorData.color);
              return (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center">
                      <div
                        className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-md hover:scale-110 transition-transform cursor-pointer"
                        style={{ backgroundColor: colorCode }}
                        title={colorData.color}
                      />
                    </div>
                  </td>
                  {enabledSizes.map((size) => {
                    const qty = colorData.quantities[size] || 0;
                    return (
                      <td key={size} className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                            qty > 0
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {qty || '-'}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-4 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-bold">
                      {colorData.totalQuantity}
                    </span>
                  </td>
                  {canEditDelete && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => onEdit(colorData.receivingIds)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Edit"
                        >
                          <FiEdit />
                        </button>
                        <button
                          onClick={() => onDelete(colorData.receivingIds)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DesignTable;
