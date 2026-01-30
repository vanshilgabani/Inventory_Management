import { FiX, FiCheckCircle, FiAlertTriangle, FiXCircle, FiDownload, FiTrendingUp } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

const ImportResultModal = ({ isOpen, onClose, resultData }) => {
  
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFailedDetails, setShowFailedDetails] = useState(false);

  useEffect(() => {
    if (isOpen && resultData?.totalSuccess > 0) {
      setShowConfetti(true);
      // Stop confetti after 3 seconds
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [isOpen, resultData]);

  if (!isOpen || !resultData) return null;

  const { success, failed, duplicates, totalSuccess, totalFailed, totalDuplicates, mappedSKUs } = resultData;

  const hasFailures = totalFailed > 0 || totalDuplicates > 0;
  const isFullSuccess = totalSuccess > 0 && !hasFailures;

  // Download failed orders as CSV
  const downloadFailedOrders = () => {
    if (failed.length === 0) return;

    const csvContent = [
      ['Order ID', 'SKU', 'Reason'],
      ...failed.map(f => [f.orderId || 'N/A', f.sku || 'N/A', f.reason || 'Unknown error'])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `failed-orders-${Date.now()}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
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
            {/* Confetti Effect */}
            {showConfetti && isFullSuccess && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(50)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ 
                      x: Math.random() * window.innerWidth, 
                      y: -20,
                      rotate: 0 
                    }}
                    animate={{ 
                      y: window.innerHeight + 20,
                      rotate: 360,
                      transition: {
                        duration: 2 + Math.random() * 2,
                        ease: 'linear'
                      }
                    }}
                    className="absolute w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][Math.floor(Math.random() * 5)],
                      left: `${Math.random() * 100}%`
                    }}
                  />
                ))}
              </div>
            )}

            {/* Modal */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: 'spring', duration: 0.6 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`${
                isFullSuccess 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
              } text-white p-6 relative overflow-hidden`}>
                <div className="absolute inset-0 bg-white opacity-10">
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '20px 20px'
                  }}></div>
                </div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                      className="bg-white bg-opacity-20 p-3 rounded-xl backdrop-blur-sm"
                    >
                      {isFullSuccess ? (
                        <FiCheckCircle className="w-8 h-8" />
                      ) : (
                        <FiAlertTriangle className="w-8 h-8" />
                      )}
                    </motion.div>
                    <div>
                      <motion.h2 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-2xl font-bold"
                      >
                        {isFullSuccess ? '✨ Import Complete!' : '⚠️ Import Partially Complete'}
                      </motion.h2>
                      <motion.p 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className={`text-sm mt-1 ${
                          isFullSuccess ? 'text-green-100' : 'text-amber-100'
                        }`}
                      >
                        {isFullSuccess 
                          ? 'All orders imported successfully' 
                          : 'Some orders need attention'}
                      </motion.p>
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
                  
                  {/* Success Card */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, type: 'spring' }}
                    className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-green-500 p-2.5 rounded-lg shadow-lg">
                        <FiCheckCircle className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="font-semibold text-green-800">Success</h3>
                    </div>
                    <p className="text-4xl font-bold text-green-600 mb-1">{totalSuccess}</p>
                    <p className="text-xs text-green-600">Orders imported</p>
                  </motion.div>

                  {/* Duplicates Card */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, type: 'spring' }}
                    className={`rounded-xl p-5 border-2 ${
                      totalDuplicates > 0
                        ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300'
                        : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2.5 rounded-lg shadow-lg ${
                        totalDuplicates > 0 ? 'bg-amber-500' : 'bg-gray-400'
                      }`}>
                        <FiAlertTriangle className="w-6 h-6 text-white" />
                      </div>
                      <h3 className={`font-semibold ${
                        totalDuplicates > 0 ? 'text-amber-800' : 'text-gray-600'
                      }`}>Duplicates</h3>
                    </div>
                    <p className={`text-4xl font-bold mb-1 ${
                      totalDuplicates > 0 ? 'text-amber-600' : 'text-gray-500'
                    }`}>{totalDuplicates}</p>
                    <p className={`text-xs ${
                      totalDuplicates > 0 ? 'text-amber-600' : 'text-gray-500'
                    }`}>Already existed</p>
                  </motion.div>

                  {/* Failed Card */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, type: 'spring' }}
                    className={`rounded-xl p-5 border-2 ${
                      totalFailed > 0
                        ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300'
                        : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2.5 rounded-lg shadow-lg ${
                        totalFailed > 0 ? 'bg-red-500' : 'bg-gray-400'
                      }`}>
                        <FiXCircle className="w-6 h-6 text-white" />
                      </div>
                      <h3 className={`font-semibold ${
                        totalFailed > 0 ? 'text-red-800' : 'text-gray-600'
                      }`}>Failed</h3>
                    </div>
                    <p className={`text-4xl font-bold mb-1 ${
                      totalFailed > 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>{totalFailed}</p>
                    <p className={`text-xs ${
                      totalFailed > 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>Import errors</p>
                  </motion.div>
                </div>

                {/* Inventory Updated Section */}
                {totalSuccess > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-blue-500 p-2.5 rounded-lg">
                        <FiTrendingUp className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-bold text-blue-900">📈 Inventory Updated</h3>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-white bg-opacity-60 rounded-lg">
                        <span className="text-sm text-blue-800 font-medium">Reserved Stock</span>
                        <span className="text-lg font-bold text-blue-600">-{totalSuccess} units</span>
                      </div>
                      
                      {mappedSKUs > 0 && (
                        <div className="flex items-center justify-between p-3 bg-white bg-opacity-60 rounded-lg">
                          <span className="text-sm text-blue-800 font-medium">SKU Mappings Saved</span>
                          <span className="text-lg font-bold text-blue-600">{mappedSKUs} new</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Failed Orders Details */}
                {totalFailed > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-200 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setShowFailedDetails(!showFailedDetails)}
                      className="w-full p-4 flex items-center justify-between hover:bg-red-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-red-500 p-2 rounded-lg">
                          <FiXCircle className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-red-900">Failed Orders ({totalFailed})</h3>
                          <p className="text-xs text-red-600">Click to {showFailedDetails ? 'hide' : 'view'} details</p>
                        </div>
                      </div>
                      <motion.div
                        animate={{ rotate: showFailedDetails ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </motion.div>
                    </button>

                    <AnimatePresence>
                      {showFailedDetails && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t-2 border-red-200"
                        >
                          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                            {failed.map((failedOrder, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white p-3 rounded-lg border border-red-200"
                              >
                                <p className="font-mono text-sm font-semibold text-gray-800">
                                  {failedOrder.sku || failedOrder.orderId || 'N/A'}
                                </p>
                                <p className="text-xs text-red-600 mt-1">{failedOrder.reason}</p>
                              </motion.div>
                            ))}
                          </div>
                          
                          <div className="p-4 bg-red-100 border-t-2 border-red-200">
                            <button
                              onClick={downloadFailedOrders}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors"
                            >
                              <FiDownload className="w-4 h-4" />
                              Download Failed Orders CSV
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Success Message */}
                {isFullSuccess && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1 }}
                    className="bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-300 rounded-xl p-5 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 1.1, type: 'spring', stiffness: 200 }}
                      className="inline-block bg-green-500 p-4 rounded-full mb-3"
                    >
                      <FiCheckCircle className="w-8 h-8 text-white" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-green-900 mb-2">
                      🎉 Perfect Import!
                    </h3>
                    <p className="text-green-700">
                      All {totalSuccess} orders imported successfully. Your inventory has been updated.
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-center border-t">
                <button
                  onClick={onClose}
                  className="px-10 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ImportResultModal;
