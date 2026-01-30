import { FiX, FiAlertTriangle, FiCheckCircle, FiArrowRight, FiPackage } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const ImportPreviewModal = ({ isOpen, onClose, previewData, onMapSKUs }) => {
  if (!isOpen || !previewData) return null;

  const { totalOrders, validOrders, unmappedSKUs, skippedOrders, accountName } = previewData;
  const hasUnmappedSKUs = unmappedSKUs && unmappedSKUs.length > 0;
  const totalUnmappedOrders = unmappedSKUs?.reduce((sum, sku) => sum + sku.count, 0) || 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-white opacity-10">
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '20px 20px'
                  }}></div>
                </div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white bg-opacity-20 p-3 rounded-xl backdrop-blur-sm">
                      <FiPackage className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Import Preview</h2>
                      <p className="text-indigo-100 text-sm mt-1">
                        Found {totalOrders} orders from {accountName}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={onClose}
                    className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto">
                
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Valid Orders Card */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-green-500 p-2 rounded-lg">
                        <FiCheckCircle className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-green-800">Valid Orders</h3>
                    </div>
                    <p className="text-3xl font-bold text-green-600">{validOrders}</p>
                    <p className="text-xs text-green-600 mt-1">Ready to import</p>
                  </motion.div>

                  {/* Unmapped SKUs Card */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className={`${
                      hasUnmappedSKUs
                        ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 animate-pulse-slow'
                        : 'bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-gray-200'
                    } rounded-xl p-4`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`${hasUnmappedSKUs ? 'bg-amber-500' : 'bg-gray-400'} p-2 rounded-lg`}>
                        <FiAlertTriangle className="w-5 h-5 text-white" />
                      </div>
                      <h3 className={`font-semibold ${hasUnmappedSKUs ? 'text-amber-800' : 'text-gray-600'}`}>
                        Unmapped SKUs
                      </h3>
                    </div>
                    <p className={`text-3xl font-bold ${hasUnmappedSKUs ? 'text-amber-600' : 'text-gray-500'}`}>
                      {unmappedSKUs?.length || 0}
                    </p>
                    <p className={`text-xs mt-1 ${hasUnmappedSKUs ? 'text-amber-600' : 'text-gray-500'}`}>
                      {totalUnmappedOrders} orders affected
                    </p>
                  </motion.div>

                  {/* Skipped Orders Card */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-blue-500 p-2 rounded-lg">
                        <FiPackage className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-blue-800">Skipped</h3>
                    </div>
                    <p className="text-3xl font-bold text-blue-600">{skippedOrders || 0}</p>
                    <p className="text-xs text-blue-600 mt-1">Returns/Cancelled</p>
                  </motion.div>
                </div>

                {/* Unmapped SKUs List */}
                {hasUnmappedSKUs && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-5"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <FiAlertTriangle className="w-5 h-5 text-amber-600" />
                      <h3 className="font-bold text-amber-900">SKUs Need Mapping</h3>
                    </div>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                      {unmappedSKUs.map((skuData, index) => (
                        <motion.div
                          key={skuData.sku}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + index * 0.05 }}
                          className="bg-white border border-amber-200 rounded-lg p-3 flex items-center justify-between hover:shadow-md transition-shadow"
                        >
                          <div className="flex-1">
                            <p className="font-mono font-semibold text-gray-800">
                              {skuData.sku}
                            </p>
                            {skuData.parsed && (
                              <p className="text-xs text-gray-500 mt-1">
                                Detected: {skuData.parsed.design} • {skuData.parsed.color} • {skuData.parsed.size}
                              </p>
                            )}
                          </div>
                          <div className="bg-amber-100 px-3 py-1 rounded-full">
                            <span className="text-sm font-semibold text-amber-700">
                              {skuData.count} {skuData.count === 1 ? 'order' : 'orders'}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Info Box */}
                    <div className="mt-4 bg-white bg-opacity-60 border border-amber-200 rounded-lg p-4">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0">
                          <div className="bg-amber-100 p-2 rounded-lg">
                            <FiAlertTriangle className="w-5 h-5 text-amber-600" />
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold text-amber-900 mb-1">Quick Mapping</h4>
                          <p className="text-sm text-amber-800">
                            Map these SKUs to your inventory once. Future imports will automatically recognize them!
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Success Message - No Unmapped SKUs */}
                {!hasUnmappedSKUs && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-6 text-center"
                  >
                    <div className="inline-block bg-green-500 p-4 rounded-full mb-4">
                      <FiCheckCircle className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-green-800 mb-2">
                      ✨ All SKUs Recognized!
                    </h3>
                    <p className="text-green-700">
                      Ready to import {validOrders} orders
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 text-gray-600 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>

                {hasUnmappedSKUs ? (
                  <button
                    onClick={onMapSKUs}
                    className="group relative px-8 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2 overflow-hidden"
                  >
                    <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></span>
                    <span className="relative flex items-center gap-2">
                      Map SKUs
                      <FiArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={onMapSKUs}
                    className="px-8 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2"
                  >
                    <FiCheckCircle className="w-4 h-4" />
                    Proceed to Import
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ImportPreviewModal;
