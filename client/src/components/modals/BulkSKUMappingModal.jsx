import { useState, useEffect } from 'react';
import { FiX, FiCheckCircle, FiAlertCircle, FiZap, FiArrowLeft, FiSave, FiInfo } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { skuMappingService } from '../../services/skuMappingService';
import toast from 'react-hot-toast';

const BulkSKUMappingModal = ({ 
  isOpen, 
  onClose, 
  unmappedSKUs, 
  products, 
  accountName,
  onMappingsComplete,
  onBack 
}) => {
  
  const [mappings, setMappings] = useState([]);
  const [validationStatus, setValidationStatus] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [patternDetected, setPatternDetected] = useState(null);
  const [showPatternBanner, setShowPatternBanner] = useState(true);

  // Initialize mappings when modal opens
  useEffect(() => {
    if (isOpen && unmappedSKUs && unmappedSKUs.length > 0) {
      initializeMappings();
      detectPattern();
    }
  }, [isOpen, unmappedSKUs]);

  const initializeMappings = () => {
    const initialMappings = unmappedSKUs.map(skuData => {
      const rawDesign = skuData.parsed?.design || '';
      const rawColor  = skuData.parsed?.color  || '';
      const rawSize   = skuData.parsed?.size   || '';

      // ── STEP 1: Match Design (case-insensitive exact) ──
      const matchedDesign =
        products.find(p => p.design.toLowerCase() === rawDesign.toLowerCase())?.design || rawDesign;

      // ── STEP 2: Fuzzy match Color against this design's inventory colors ──
      const product = products.find(p => p.design === matchedDesign);
      const colorVariants = product?.colors || [];

      let matchedColor = '';
      if (rawColor && colorVariants.length) {
        const clean = s => s.toLowerCase().replace(/[\.\-_\s]/g, '');
        const cleanRaw = clean(rawColor);

        // Priority: exact → clean-match → partial-contains → word-overlap
        const exactMatch   = colorVariants.find(c => c.color.toLowerCase() === rawColor.toLowerCase());
        const cleanMatch   = colorVariants.find(c => clean(c.color) === cleanRaw);
        const partialMatch = colorVariants.find(c =>
          clean(c.color).includes(cleanRaw) || cleanRaw.includes(clean(c.color))
        );
        const rawWords = rawColor.toLowerCase().split(/[\s\.\-_]+/).filter(w => w.length > 1);
        const wordMatch = colorVariants.find(c => {
          const cWords = c.color.toLowerCase().split(/[\s\.\-_]+/);
          return rawWords.some(w => cWords.some(cw => cw.includes(w) || w.includes(cw)));
        });

        matchedColor =
          exactMatch?.color || cleanMatch?.color || partialMatch?.color || wordMatch?.color || '';
      }

      // ── STEP 3: Fuzzy match Size ──
      const colorVariant = colorVariants.find(c => c.color === matchedColor);
      const sizeVariants = colorVariant?.sizes || [];

      // Also try with the raw color string if matched color failed
      const fallbackColorVariant = colorVariants.find(c =>
        c.color.toLowerCase() === rawColor.toLowerCase()
      );
      const fallbackSizes = fallbackColorVariant?.sizes || [];
      const sizesToSearch = sizeVariants.length ? sizeVariants : fallbackSizes;

      let matchedSize = '';
      if (rawSize && sizesToSearch.length) {
        // Numeric waist → letter size mapping (common for garments)
        const sizeNumMap = { '28': 'S', '30': 'M', '32': 'L', '34': 'XL', '36': 'XXL', '38': 'XXXL' };
        const exactSize  = sizesToSearch.find(s => s.size.toLowerCase() === rawSize.toLowerCase());
        const numMapped  = sizeNumMap[rawSize]
          ? sizesToSearch.find(s => s.size === sizeNumMap[rawSize])
          : null;
        matchedSize = exactSize?.size || numMapped?.size || '';
      }

      return {
        sku:    skuData.sku,
        count:  skuData.count,
        design: matchedDesign || '',
        color:  matchedColor  || '',
        size:   matchedSize   || '',
        isValid: false,
      };
    });

    setMappings(initialMappings);
    // Trigger validation on all pre-filled cards immediately
    initialMappings.forEach((mapping, index) => validateMapping(mapping, index));
  };

const detectPattern = () => {
  if (!unmappedSKUs || unmappedSKUs.length === 0) return;

  const allSKUs = unmappedSKUs.map(s => s.sku).filter(Boolean);
  if (!allSKUs.length) return;

  const firstSKU = allSKUs[0];

  // ── Detect separator ──
  const separators = ['-', '_', '/', '.'];
  let sep = null;
  for (const s of separators) {
    if (allSKUs.every(sku => sku.replace(/[#@]/g, '').includes(s))) {
      sep = s;
      break;
    }
  }
  if (!sep) return; // Unsupported format — no banner

  const prefix  = firstSKU.startsWith('#') ? '#' : firstSKU.startsWith('@') ? '@' : '';
  const cleaned = firstSKU.replace(/^[#@]/, '');
  const parts   = cleaned.split(sep);

  if (parts.length < 3) return;

  let pattern     = null;
  let description = null;
  let confidence  = 'medium';

  const p0 = parts[0];

  if (p0 === 'D' && !isNaN(parts[1])) {
    // D-11-COLOR-SIZE
    pattern     = `${prefix}D${sep}{NUMBER}${sep}{COLOR}${sep}{SIZE}`;
    description = `Format: Design-Color-Size`;
    confidence  = 'high';
  } else if (p0.match(/^D\d+$/i)) {
    // D9-COLOR-SIZE  or  #D1-COLOR-SIZE
    pattern     = `${prefix}{D{NUMBER}}${sep}{COLOR}${sep}{SIZE}`;
    description = `Format: Design-Color-Size`;
    confidence  = 'high';
  } else if (p0.match(/^[A-Z]{1,4}\d+$/i)) {
    // ITEM123-COLOR-SIZE  or  SKU001-COLOR-SIZE
    pattern     = `${prefix}{PREFIX+NUMBER}${sep}{COLOR}${sep}{SIZE}`;
    description = `Format: Code-Color-Size`;
    confidence  = 'high';
  } else {
    // Try to identify positions by matching against inventory
    const allInventoryDesigns = products.map(p => p.design.toLowerCase());
    const allInventoryColors  = [...new Set(
      products.flatMap(p => p.colors.map(c => c.color.toLowerCase()))
    )];
    const allInventorySizes   = [...new Set(
      products.flatMap(p => p.colors.flatMap(c => c.sizes.map(s => s.size.toLowerCase())))
    )];

    const slots = parts.map((part, idx) => {
      const clean = part.toLowerCase().replace(/[\.\-_]/g, '');
      if (allInventoryDesigns.some(d => d.replace(/[\.\-_]/g, '') === clean))  return 'DESIGN';
      if (allInventorySizes.some(s => s === part.toLowerCase()))                return 'SIZE';
      if (allInventoryColors.some(c => c.replace(/[\.\-_]/g, '') === clean))   return 'COLOR';
      if (/^\d+$/.test(part) && part.length <= 2)                               return 'SIZE';
      return 'UNKNOWN';
    });

    if (!slots.includes('UNKNOWN') || slots.filter(s => s !== 'UNKNOWN').length >= 2) {
      pattern     = `${prefix}` + slots.map(s => `{${s}}`).join(sep);
      description = 'Auto-detected format';
      confidence  = slots.includes('UNKNOWN') ? 'medium' : 'high';
    }
  }

  if (pattern) {
    setPatternDetected({ pattern, description, confidence });
  }
};

  // Validate individual mapping
  const validateMapping = (mapping, index) => {
    const { design, color, size } = mapping;

    if (!design || !color || !size) {
      setValidationStatus(prev => ({
        ...prev,
        [index]: {
          valid: false,
          message: 'All fields required'
        }
      }));
      return false;
    }

    // Check if design exists
    const product = products.find(p => p.design === design);
    if (!product) {
      setValidationStatus(prev => ({
        ...prev,
        [index]: {
          valid: false,
          message: `Design "${design}" not found in inventory`
        }
      }));
      return false;
    }

    // Check if color exists in design
    const colorVariant = product.colors.find(c => c.color === color);
    if (!colorVariant) {
      const availableColors = product.colors.map(c => c.color).join(', ');
      setValidationStatus(prev => ({
        ...prev,
        [index]: {
          valid: false,
          message: `Color "${color}" not found. Available: ${availableColors}`
        }
      }));
      return false;
    }

    // Check if size exists in color
    const sizeVariant = colorVariant.sizes.find(s => s.size === size);
    if (!sizeVariant) {
      const availableSizes = colorVariant.sizes.map(s => s.size).join(', ');
      setValidationStatus(prev => ({
        ...prev,
        [index]: {
          valid: false,
          message: `Size "${size}" not found. Available: ${availableSizes}`
        }
      }));
      return false;
    }

    // All valid
    setValidationStatus(prev => ({
      ...prev,
      [index]: {
        valid: true,
        message: `✓ Valid mapping (Stock: ${sizeVariant.currentStock || 0})`
      }
    }));

    return true;
  };

const handleFieldChange = (index, field, value) => {
  const newMappings = [...mappings];
  newMappings[index][field] = value;

  if (field === 'design') {
    const product = products.find(p => p.design === value);
    if (product && product.colors.length > 0) {
      const existingColor = newMappings[index].color;
      const existingSize  = newMappings[index].size;

      // ── Try to preserve already-parsed color ──
      // Check if the existing color exists in this design's inventory
      const clean = s => s?.toLowerCase().replace(/[\.\-_\s]/g, '') || '';

      const colorMatch = product.colors.find(c =>
        c.color === existingColor ||                           // exact match
        clean(c.color) === clean(existingColor) ||            // clean match (dots/spaces)
        clean(c.color).includes(clean(existingColor)) ||      // partial contains
        clean(existingColor).includes(clean(c.color))
      );

      if (colorMatch) {
        // Parsed color is valid for this design — keep it (use inventory's exact casing)
        newMappings[index].color = colorMatch.color;

        // ── Try to preserve already-parsed size under matched color ──
        const sizeMatch = colorMatch.sizes.find(s =>
          s.size === existingSize ||
          s.size.toLowerCase() === existingSize?.toLowerCase()
        );

        if (sizeMatch) {
          // Parsed size is valid — keep it
          newMappings[index].size = sizeMatch.size;
        } else {
          // Parsed size not found under this color — fall back to first size
          newMappings[index].size = colorMatch.sizes[0]?.size || '';
        }

      } else {
        // Parsed color not found in this design — fall back to first color + first size
        newMappings[index].color = product.colors[0].color;
        newMappings[index].size  = product.colors[0].sizes[0]?.size || '';
      }
    }
  }

  // ── When color changes, try to preserve size ──
  if (field === 'color') {
    const product      = products.find(p => p.design === newMappings[index].design);
    const colorVariant = product?.colors.find(c => c.color === value);
    const existingSize = newMappings[index].size;

    if (colorVariant) {
      const sizeMatch = colorVariant.sizes.find(s =>
        s.size === existingSize ||
        s.size.toLowerCase() === existingSize?.toLowerCase()
      );
      // Only overwrite size if existing size doesn't exist in new color
      if (!sizeMatch) {
        newMappings[index].size = colorVariant.sizes[0]?.size || '';
      }
    }
  }

  setMappings(newMappings);
  validateMapping(newMappings[index], index);
};

  // Get available colors for a design
  const getAvailableColors = (design) => {
    const product = products.find(p => p.design === design);
    return product?.colors || [];
  };

  // Get available sizes for a design and color
  const getAvailableSizes = (design, color) => {
    const product = products.find(p => p.design === design);
    const colorVariant = product?.colors.find(c => c.color === color);
    return colorVariant?.sizes || [];
  };

  // Check if all mappings are valid
  const allMappingsValid = () => {
    return mappings.every((_, index) => validationStatus[index]?.valid === true);
  };

  // Get validation progress
  const getProgress = () => {
    const validCount = Object.values(validationStatus).filter(v => v.valid).length;
    return {
      valid: validCount,
      total: mappings.length,
      percentage: Math.round((validCount / mappings.length) * 100)
    };
  };

  // Handle save mappings
  const handleSaveMappings = async () => {
    if (!allMappingsValid()) {
      toast.error('Please fix all validation errors before saving');
      return;
    }

    setIsSaving(true);

    try {
      // Save each mapping to backend
      const savePromises = mappings.map(mapping =>
        skuMappingService.createMapping({
          marketplaceSKU: mapping.sku,
          design: mapping.design,
          color: mapping.color,
          size: mapping.size,
          accountName: accountName
        })
      );

      await Promise.all(savePromises);

      toast.success(
        `✨ Saved ${mappings.length} SKU mapping(s) successfully!`,
        { duration: 4000 }
      );

      // Pass mappings to parent
      onMappingsComplete(mappings);

    } catch (error) {
      console.error('Failed to save mappings:', error);
      toast.error(error.response?.data?.message || 'Failed to save mappings');
    } finally {
      setIsSaving(false);
    }
  };

  const progress = getProgress();
  const allDesigns = [...new Set(products.map(p => p.design))].sort();

  if (!isOpen) return null;

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
              className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-white opacity-10">
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '20px 20px'
                  }}></div>
                </div>
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-white bg-opacity-20 p-3 rounded-xl backdrop-blur-sm">
                        <FiZap className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">Smart SKU Mapping</h2>
                        <p className="text-amber-100 text-sm mt-1">
                          Map {mappings.length} SKU{mappings.length !== 1 ? 's' : ''} to your inventory
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

                  {/* Progress Bar */}
                  <div className="bg-white bg-opacity-20 rounded-full h-3 overflow-hidden backdrop-blur-sm">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.percentage}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full bg-white rounded-full shadow-lg"
                    />
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-amber-100">
                      {progress.valid} of {progress.total} validated
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {progress.percentage}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Pattern Detection Banner */}
              {patternDetected && showPatternBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b-2 border-purple-200 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="bg-purple-500 p-2 rounded-lg flex-shrink-0">
                      <FiZap className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-purple-900 flex items-center gap-2">
                        Pattern Detected
                        <span className="px-2 py-0.5 bg-purple-200 text-purple-700 text-xs rounded-full">
                          {patternDetected.confidence}
                        </span>
                      </h3>
                      <p className="text-sm text-purple-700 mt-1">
                        <span className="font-mono bg-purple-100 px-2 py-0.5 rounded">
                          {patternDetected.pattern}
                        </span>
                        {' '}- {patternDetected.description}
                      </p>
                      <p className="text-xs text-purple-600 mt-1">
                        ✨ Auto-detected values filled in. Please verify before saving.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPatternBanner(false)}
                      className="text-purple-400 hover:text-purple-600 p-1"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  {mappings.map((mapping, index) => {
                    const isValid = validationStatus[index]?.valid;
                    const validationMessage = validationStatus[index]?.message;
                    const availableColors = getAvailableColors(mapping.design);
                    const availableSizes = getAvailableSizes(mapping.design, mapping.color);

                    return (
                      <motion.div
                        key={mapping.sku}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`border-2 rounded-xl p-5 transition-all ${
                          isValid
                            ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50'
                            : 'border-gray-300 bg-white hover:border-amber-300'
                        }`}
                      >
                        {/* SKU Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-lg text-gray-800">
                                {mapping.sku}
                              </span>
                              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-semibold">
                                {mapping.count} {mapping.count === 1 ? 'order' : 'orders'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Validation Status Icon */}
                          <div className={`p-2 rounded-lg ${
                            isValid ? 'bg-green-500' : 'bg-gray-300'
                          }`}>
                            {isValid ? (
                              <FiCheckCircle className="w-5 h-5 text-white" />
                            ) : (
                              <FiAlertCircle className="w-5 h-5 text-white" />
                            )}
                          </div>
                        </div>

                        {/* Mapping Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          
                          {/* Design Dropdown */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Design
                            </label>
                            <select
                              value={mapping.design}
                              onChange={(e) => handleFieldChange(index, 'design', e.target.value)}
                              className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all ${
                                mapping.design ? 'border-gray-300' : 'border-red-300 bg-red-50'
                              }`}
                            >
                              <option value="">Select Design</option>
                              {allDesigns.map(design => (
                                <option key={design} value={design}>
                                  {design}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Color Dropdown */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Color
                            </label>
                            <select
                              value={mapping.color}
                              onChange={(e) => handleFieldChange(index, 'color', e.target.value)}
                              disabled={!mapping.design}
                              className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed ${
                                mapping.color ? 'border-gray-300' : 'border-red-300 bg-red-50'
                              }`}
                            >
                              <option value="">Select Color</option>
                              {availableColors.map(colorVariant => (
                                <option key={colorVariant.color} value={colorVariant.color}>
                                  {colorVariant.color}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Size Dropdown */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Size
                            </label>
                            <select
                              value={mapping.size}
                              onChange={(e) => handleFieldChange(index, 'size', e.target.value)}
                              disabled={!mapping.design || !mapping.color}
                              className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed ${
                                mapping.size ? 'border-gray-300' : 'border-red-300 bg-red-50'
                              }`}
                            >
                              <option value="">Select Size</option>
                              {availableSizes.map(sizeVariant => (
                                <option key={sizeVariant.size} value={sizeVariant.size}>
                                  {sizeVariant.size}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Validation Message */}
                        <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium ${
                          isValid
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-amber-100 text-amber-700 border border-amber-300'
                        }`}>
                          {validationMessage || 'Waiting for mapping...'}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Info Box */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4"
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="bg-blue-500 p-2 rounded-lg">
                        <FiInfo className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-1">
                        💡 These mappings will be saved
                      </h4>
                      <p className="text-sm text-blue-700">
                        Once saved, future CSV imports will automatically recognize these SKUs. 
                        You can view and manage all mappings in Settings → SKU Mappings.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Footer Actions */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 px-6 py-2.5 text-gray-600 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <FiArrowLeft className="w-4 h-4" />
                  Back
                </button>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">
                    {progress.valid === progress.total ? (
                      <span className="text-green-600 font-semibold">
                        ✓ All mappings valid
                      </span>
                    ) : (
                      <span>
                        {progress.total - progress.valid} remaining
                      </span>
                    )}
                  </span>

                  <button
                    onClick={handleSaveMappings}
                    disabled={!allMappingsValid() || isSaving}
                    className={`group relative px-8 py-2.5 font-semibold rounded-lg transition-all shadow-lg flex items-center gap-2 ${
                      allMappingsValid() && !isSaving
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 hover:shadow-xl transform hover:scale-105'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <FiSave className="w-4 h-4" />
                        Save All Mappings
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BulkSKUMappingModal;
