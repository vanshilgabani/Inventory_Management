import { FiX, FiCheckCircle } from 'react-icons/fi';

const PatternDetectionModal = ({ 
  isOpen, 
  onClose, 
  patternData,
  onEnable,
  onSkip 
}) => {
  if (!isOpen || !patternData) return null;

  const { pattern, mappings, sizeMappings } = patternData;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-5000 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FiCheckCircle className="text-purple-600" size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">✨ Smart Pattern Detected!</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Celebration Message */}
          <div className="text-center py-2">
            <p className="text-lg text-gray-700">
              🎉 Great! Based on your <strong>{mappings?.length || 0} mappings</strong>, we detected a pattern:
            </p>
          </div>

          {/* Pattern Display */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
            <div className="font-mono text-xl text-center text-indigo-900 font-bold mb-4">
              {pattern}
            </div>
            
            <div className="space-y-2 text-sm text-gray-700">
              <p><strong>Where:</strong></p>
              <ul className="ml-6 space-y-1">
                <li>• <code className="bg-white px-2 py-1 rounded">{'{'} XX {'}'}</code> = Design number (09, 11, 13...)</li>
                <li>• <code className="bg-white px-2 py-1 rounded">{'{'} COLOR {'}'}</code> = Product color</li>
                <li>• <code className="bg-white px-2 py-1 rounded">{'{'} SIZE {'}'}</code> = Waist size in inches</li>
              </ul>
            </div>
          </div>

          {/* Size Conversions */}
          {sizeMappings && Object.keys(sizeMappings).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3">📏 Size conversions learned:</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(sizeMappings).map(([numeric, letter]) => (
                  <div 
                    key={numeric}
                    className="bg-white px-4 py-2 rounded-lg border border-blue-200"
                  >
                    <span className="font-mono text-blue-900">
                      {numeric}" → {letter}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Benefits */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-3">🚀 Future benefits:</h3>
            <ul className="space-y-2 text-sm text-green-800">
              <li className="flex items-center gap-2">
                <FiCheckCircle className="text-green-600 flex-shrink-0" size={16} />
                <span>Automatic SKU parsing</span>
              </li>
              <li className="flex items-center gap-2">
                <FiCheckCircle className="text-green-600 flex-shrink-0" size={16} />
                <span>No manual mapping for known patterns</span>
              </li>
              <li className="flex items-center gap-2">
                <FiCheckCircle className="text-green-600 flex-shrink-0" size={16} />
                <span>Faster imports (bulk processing)</span>
              </li>
            </ul>
          </div>

          {/* Info Note */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              💡 <strong>Note:</strong> You can always add more mappings or edit patterns later 
              in <strong>Settings → SKU Mappings</strong>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <p className="text-center text-sm text-gray-600 mb-4">
            Enable automatic pattern-based imports?
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onSkip}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              No, Keep Manual Mapping
            </button>
            <button
              onClick={onEnable}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <FiCheckCircle /> Enable Auto-Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatternDetectionModal;
