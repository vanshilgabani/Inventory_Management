import { format, parseISO } from 'date-fns';
import { useColorPalette } from '../../../hooks/useColorPalette';

const FlatTableView = ({ data, enabledSizes, dateFrom, dateTo }) => {
  const { getColorCode } = useColorPalette();

  // Group all receivings by design, then merge same colors
  const groupByDesign = () => {
    const designMap = {};

    data.forEach((dateGroup) => {
      dateGroup.designs.forEach((design) => {
        if (!designMap[design.design]) {
          designMap[design.design] = {
            design: design.design,
            colorMap: {}, // Use a map to merge same colors
            totalQuantity: 0,
          };
        }

        design.colors.forEach((color) => {
          const colorName = color.color;

          // If color already exists, merge quantities
          if (!designMap[design.design].colorMap[colorName]) {
            designMap[design.design].colorMap[colorName] = {
              color: colorName,
              quantities: {},
              totalQuantity: 0,
            };
          }

          const colorEntry = designMap[design.design].colorMap[colorName];

          // Merge quantities for each size
          enabledSizes.forEach((size) => {
            if (!colorEntry.quantities[size]) {
              colorEntry.quantities[size] = 0;
            }
            colorEntry.quantities[size] += color.quantities[size] || 0;
          });

          // Add to total
          colorEntry.totalQuantity += color.totalQuantity;
        });

        designMap[design.design].totalQuantity += design.totalQuantity;
      });
    });

    // Convert map to array and format
    return Object.values(designMap).map((designGroup) => ({
      design: designGroup.design,
      colors: Object.values(designGroup.colorMap).map((color) => ({
        color: color.color,
        quantities: color.quantities,
        totalQuantity: color.totalQuantity,
      })),
      totalQuantity: designGroup.totalQuantity,
    }));
  };

  const designGroups = groupByDesign();
  const grandTotal = designGroups.reduce((sum, d) => sum + d.totalQuantity, 0);

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          📊 Factory Receiving Report
        </h2>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            {dateFrom && dateTo ? (
              <span>
                📅 Date Range: <strong>{format(parseISO(dateFrom), 'dd MMM yyyy')}</strong> to{' '}
                <strong>{format(parseISO(dateTo), 'dd MMM yyyy')}</strong>
              </span>
            ) : dateFrom ? (
              <span>
                📅 From: <strong>{format(parseISO(dateFrom), 'dd MMM yyyy')}</strong>
              </span>
            ) : dateTo ? (
              <span>
                📅 Until: <strong>{format(parseISO(dateTo), 'dd MMM yyyy')}</strong>
              </span>
            ) : (
              <span>📅 All Time</span>
            )}
          </div>
          <div className="flex items-center space-x-6">
            <span>
              Total Designs: <strong className="text-blue-600">{designGroups.length}</strong>
            </span>
            <span>
              Total Units: <strong className="text-blue-600">{grandTotal}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Design Tables - 2 per row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {designGroups.map((designGroup, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Design Header */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                  <span>🏷️</span>
                  <span>{designGroup.design}</span>
                </h3>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-bold text-blue-600">
                    {designGroup.totalQuantity} units
                  </p>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase w-16">
                      Color
                    </th>
                    {enabledSizes.map((size) => (
                      <th
                        key={size}
                        className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase"
                      >
                        {size}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {designGroup.colors.map((colorData, idx) => {
                    const colorCode = getColorCode(colorData.color);
                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center">
                            <div
                              className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-sm hover:scale-110 transition-transform cursor-pointer"
                              style={{ backgroundColor: colorCode }}
                              title={colorData.color}
                            />
                          </div>
                        </td>
                        {enabledSizes.map((size) => {
                          const qty = colorData.quantities[size] || 0;
                          return (
                            <td key={size} className="px-3 py-3 text-center">
                              <span
                                className={`inline-block px-3 py-1 rounded text-sm font-medium ${
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
                        <td className="px-3 py-3 text-center">
                          <span className="inline-block px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-bold">
                            {colorData.totalQuantity}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Grand Total */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">📦 Grand Total</h3>
          <p className="text-3xl font-bold text-green-600">{grandTotal} units</p>
        </div>
      </div>
    </div>
  );
};

export default FlatTableView;
