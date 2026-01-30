import { FiX, FiCheckCircle, FiPackage, FiCalendar, FiShoppingBag, FiArrowLeft, FiUpload } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const FinalImportPreviewModal = ({ 
  isOpen, 
  onClose, 
  previewData, 
  onConfirm, 
  onBack,
  isImporting 
}) => {
  
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!isOpen || !previewData) return null;

  const { totalOrders, accountName, dispatchDate, productBreakdown, skippedOrders } = previewData;

  // Convert Map to Array for rendering
  const breakdownArray = productBreakdown instanceof Map 
    ? Array.from(productBreakdown.values())
    : [];

  const totalUnits = breakdownArray.reduce((sum, item) => sum + item.quantity, 0);

  // Format date nicely
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

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
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-white opacity-10">
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '20px 20px'
                  }}></div>
                </div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: 'spring' }}
                      className="bg-white bg-opacity-20 p-3 rounded-xl backdrop-blur-sm"
                    >
                      <FiCheckCircle className="w-7 h-7" />
                    </motion.div>
                    <div>
                      <h2 className="text-2xl font-bold">Ready to Import</h2>
                      <p className="text-green-100 text-sm mt-1">
                        All validations passed • Ready to proceed
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
              <div className="flex-1 overflow-y-auto p-6">
                
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  
                  {/* Total Orders Card */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-blue-500 p-2 rounded-lg">
                        <FiPackage className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-blue-800">Orders</h3>
                    </div>
                    <p className="text-3xl font-bold text-blue-600">{totalOrders}</p>
                    <p className="text-xs text-blue-600 mt-1">To be imported</p>
                  </motion.div>

                  {/* Total Units Card */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-purple-500 p-2 rounded-lg">
                        <FiShoppingBag className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-purple-800">Total Units</h3>
                    </div>
                    <p className="text-3xl font-bold text-purple-600">{totalUnits}</p>
                    <p className="text-xs text-purple-600 mt-1">{breakdownArray.length} variants</p>
                  </motion.div>

                  {/* Skipped Card */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-gray-200 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-gray-500 p-2 rounded-lg">
                        <FiPackage className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-gray-800">Skipped</h3>
                    </div>
                    <p className="text-3xl font-bold text-gray-600">{skippedOrders || 0}</p>
                    <p className="text-xs text-gray-600 mt-1">Returns/Cancelled</p>
                  </motion.div>
                </div>

                {/* Import Details */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5 mb-6"
                >
                  <h3 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                    <FiCheckCircle className="w-5 h-5" />
                    Import Details
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white bg-opacity-60 rounded-lg border border-green-200">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-500 p-2 rounded-lg">
                          <FiShoppingBag className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Account</p>
                          <p className="text-sm font-bold text-gray-800">{accountName}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white bg-opacity-60 rounded-lg border border-green-200">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-500 p-2 rounded-lg">
                          <FiCalendar className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Dispatch Date</p>
                          <p className="text-sm font-bold text-gray-800">{formatDate(dispatchDate)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Product Breakdown */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setShowBreakdown(!showBreakdown)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-500 p-2 rounded-lg">
                        <FiPackage className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-gray-800">Product Breakdown</h3>
                        <p className="text-xs text-gray-500">{breakdownArray.length} variants • Click to {showBreakdown ? 'hide' : 'view'}</p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: showBreakdown ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {showBreakdown && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t-2 border-gray-200"
                      >
                        <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                          {breakdownArray.map((item, index) => (
                            <motion.div
                              key={`${item.design}-${item.color}-${item.size}`}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="bg-indigo-100 px-2 py-1 rounded">
                                  <span className="text-xs font-bold text-indigo-700">{item.design}</span>
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">
                                    {item.color} • {item.size}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {item.orderCount} {item.orderCount === 1 ? 'order' : 'orders'}
                                  </p>
                                </div>
                              </div>
                              <div className="bg-indigo-500 px-3 py-1 rounded-full">
                                <span className="text-sm font-bold text-white">{item.quantity} units</span>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Success Message */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-6 bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-300 rounded-xl p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500 p-2 rounded-full">
                      <FiCheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-900">✨ All SKUs Mapped & Validated</p>
                      <p className="text-sm text-green-700 mt-0.5">
                        Inventory will be updated automatically after import
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Footer Actions */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
                <button
                  onClick={onBack}
                  disabled={isImporting}
                  className="flex items-center gap-2 px-6 py-2.5 text-gray-600 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiArrowLeft className="w-4 h-4" />
                  Back to Mappings
                </button>

                <button
                  onClick={onConfirm}
                  disabled={isImporting}
                  className="group relative px-10 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-3 overflow-hidden"
                >
                  {/* Animated background shine */}
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-30 transform -skew-x-12 group-hover:translate-x-full transition-all duration-1000"></span>
                  
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <FiUpload className="w-5 h-5 group-hover:translate-y-[-2px] transition-transform" />
                      <span>Confirm & Import</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FinalImportPreviewModal;
