import { useState, useEffect } from 'react';
import { SketchPicker } from 'react-color';
import { settingsService } from '../../services/settingsService';
import { inventoryService } from '../../services/inventoryService';
import toast from 'react-hot-toast';
import { 
  FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiEye, FiEyeOff, 
  FiChevronUp, FiChevronDown, FiDroplet, FiGrid, FiList, 
  FiPackage, FiZap, FiStar 
} from 'react-icons/fi';
import Modal from '../common/Modal';
import Card from '../common/Card';

const ColorPaletteManager = () => {
  const [colorPalette, setColorPalette] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingColor, setEditingColor] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [filterActive, setFilterActive] = useState('all'); // 'all', 'active', 'inactive'
  const [hoveredColor, setHoveredColor] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    colorName: '',
    colorCode: '#000000',
    availableForDesigns: [],
  });
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paletteData, productsData] = await Promise.all([
        settingsService.getColorPalette(),
        inventoryService.getAllProducts()
      ]);
      setColorPalette(paletteData.sort((a, b) => a.displayOrder - b.displayOrder));
      setProducts(Array.isArray(productsData) ? productsData : productsData?.products || []);
    } catch (error) {
      toast.error('Failed to load color palette');
    } finally {
      setLoading(false);
    }
  };

  const handleAddColor = async () => {
    if (!formData.colorName.trim()) {
      toast.error('Color name is required');
      return;
    }

    try {
      await settingsService.addColorToPalette(formData);
      toast.success('✨ Color added successfully');
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add color');
    }
  };

  const handleUpdateColor = async () => {
    if (!formData.colorName.trim()) {
      toast.error('Color name is required');
      return;
    }

    try {
      await settingsService.updateColorInPalette(editingColor._id, formData);
      toast.success('✨ Color updated successfully');
      setEditingColor(null);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update color');
    }
  };

  const handleDeleteColor = async (colorId, colorName) => {
    if (!window.confirm(`Delete color "${colorName}"? This cannot be undone.`)) return;

    try {
      await settingsService.deleteColorFromPalette(colorId);
      toast.success('🗑️ Color deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete color');
    }
  };

  const handleToggleActive = async (color) => {
    try {
      await settingsService.updateColorInPalette(color._id, {
        ...color,
        isActive: !color.isActive
      });
      toast.success(`${!color.isActive ? '✅' : '⏸️'} Color ${!color.isActive ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update color status');
    }
  };

  const handleMoveColor = async (index, direction) => {
    const newPalette = [...colorPalette];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newPalette.length) return;

    [newPalette[index], newPalette[targetIndex]] = [newPalette[targetIndex], newPalette[index]];

    try {
      const orderedIds = newPalette.map(c => c._id);
      await settingsService.reorderColors(orderedIds);
      setColorPalette(newPalette);
      toast.success('🔄 Color order updated');
    } catch (error) {
      toast.error('Failed to reorder colors');
      fetchData();
    }
  };

  const handleEditClick = (color) => {
    setEditingColor(color);
    setFormData({
      colorName: color.colorName,
      colorCode: color.colorCode,
      availableForDesigns: color.availableForDesigns || [],
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      colorName: '',
      colorCode: '#000000',
      availableForDesigns: [],
    });
    setEditingColor(null);
    setShowColorPicker(false);
  };

  const handleDesignToggle = (design) => {
    setFormData(prev => ({
      ...prev,
      availableForDesigns: prev.availableForDesigns.includes(design)
        ? prev.availableForDesigns.filter(d => d !== design)
        : [...prev.availableForDesigns, design]
    }));
  };

  // Filter colors
  const filteredColors = colorPalette.filter(color => {
    if (filterActive === 'active') return color.isActive;
    if (filterActive === 'inactive') return !color.isActive;
    return true;
  });

  const stats = {
    total: colorPalette.length,
    active: colorPalette.filter(c => c.isActive).length,
    inactive: colorPalette.filter(c => !c.isActive).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Color Palette...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-4 rounded-2xl shadow-lg">
              <FiDroplet className="text-3xl text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-1">Color Palette Manager</h1>
              <p className="text-gray-600">Manage colors and design assignments</p>
            </div>
          </div>
          
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="group relative px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 overflow-hidden"
          >
            <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></span>
            <span className="flex items-center gap-2">
              <FiPlus className="text-xl" />
              Add New Color
            </span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-700 text-sm mb-1">Total Colors</p>
                <p className="text-4xl font-bold">{stats.total}</p>
              </div>
              <FiDroplet className="text-5xl text-blue-800" />
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-700 text-sm mb-1">Active Colors</p>
                <p className="text-4xl font-bold">{stats.active}</p>
              </div>
              <FiEye className="text-5xl text-green-700" />
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white border-0 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-700 text-sm mb-1">Inactive Colors</p>
                <p className="text-4xl font-bold">{stats.inactive}</p>
              </div>
              <FiEyeOff className="text-5xl text-orange-700" />
            </div>
          </Card>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Filter:</span>
            <button
              onClick={() => setFilterActive('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                filterActive === 'all'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setFilterActive('active')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                filterActive === 'active'
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active ({stats.active})
            </button>
            <button
              onClick={() => setFilterActive('inactive')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                filterActive === 'inactive'
                  ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Inactive ({stats.inactive})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">View:</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all duration-200 ${
                  viewMode === 'grid'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-indigo-600'
                }`}
              >
                <FiGrid className="text-xl" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all duration-200 ${
                  viewMode === 'list'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-indigo-600'
                }`}
              >
                <FiList className="text-xl" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Colors Display */}
      {filteredColors.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <FiDroplet className="mx-auto text-6xl text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No colors found</h3>
            <p className="text-gray-600 mb-6">
              {filterActive !== 'all' 
                ? `No ${filterActive} colors available` 
                : 'Start by adding your first color to the palette'}
            </p>
            {filterActive === 'all' && (
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300"
              >
                <FiPlus /> Add Your First Color
              </button>
            )}
          </div>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredColors.map((color, index) => (
            <div
              key={color._id}
              onMouseEnter={() => setHoveredColor(color._id)}
              onMouseLeave={() => setHoveredColor(null)}
              className="group relative"
            >
              <Card className={`overflow-hidden transition-all duration-300 ${
                color.isActive 
                  ? 'hover:shadow-2xl hover:-translate-y-2' 
                  : 'opacity-60 hover:opacity-100'
              }`}>
                {/* Color Preview */}
                <div
                  className="h-40 relative overflow-hidden transition-transform duration-300 group-hover:scale-105"
                  style={{ 
                    background: `linear-gradient(135deg, ${color.colorCode} 0%, ${color.colorCode}dd 100%)`
                  }}
                >
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${
                      color.isActive 
                        ? 'bg-green-500/80 text-white' 
                        : 'bg-gray-500/80 text-white'
                    }`}>
                      {color.isActive ? '● Active' : '○ Inactive'}
                    </span>
                  </div>

                  {/* Reorder Buttons */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {index > 0 && (
                      <button
                        onClick={() => handleMoveColor(index, 'up')}
                        className="p-1.5 bg-white/90 rounded-lg shadow-md hover:bg-white transition-colors"
                      >
                        <FiChevronUp className="text-gray-700" />
                      </button>
                    )}
                    {index < filteredColors.length - 1 && (
                      <button
                        onClick={() => handleMoveColor(index, 'down')}
                        className="p-1.5 bg-white/90 rounded-lg shadow-md hover:bg-white transition-colors"
                      >
                        <FiChevronDown className="text-gray-700" />
                      </button>
                    )}
                  </div>

                  {/* Hex Code Overlay */}
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
                      <p className="text-xs text-gray-600 font-mono font-bold">
                        {color.colorCode.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Color Info */}
                <div className="p-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                    {color.colorName}
                    {color.availableForDesigns?.length === 0 && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                        ALL
                      </span>
                    )}
                  </h3>

                  {/* Design Tags */}
                  {color.availableForDesigns && color.availableForDesigns.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                        <FiPackage className="text-sm" /> Available for:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {color.availableForDesigns.slice(0, 3).map((design) => (
                          <span
                            key={design}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium"
                          >
                            {design}
                          </span>
                        ))}
                        {color.availableForDesigns.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">
                            +{color.availableForDesigns.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleToggleActive(color)}
                      className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                        color.isActive
                          ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {color.isActive ? (
                        <>
                          <FiEyeOff /> Hide
                        </>
                      ) : (
                        <>
                          <FiEye /> Show
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleEditClick(color)}
                      className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium text-sm hover:bg-indigo-200 transition-colors"
                    >
                      <FiEdit2 />
                    </button>
                    {/* Delete 
                    <button
                      onClick={() => handleDeleteColor(color._id, color.colorName)}
                      className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      <FiTrash2 />
                    </button>
                    */}
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        // List View
        <div className="space-y-3">
          {filteredColors.map((color, index) => (
            <Card
              key={color._id}
              className={`hover:shadow-lg transition-all duration-200 ${
                !color.isActive && 'opacity-60'
              }`}
            >
              <div className="flex items-center gap-4 p-4">
                {/* Color Preview */}
                <div
                  className="w-16 h-16 rounded-xl shadow-md flex-shrink-0 border-4 border-white"
                  style={{ backgroundColor: color.colorCode }}
                />

                {/* Color Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold text-gray-900">{color.colorName}</h3>
                    <span className="font-mono text-sm text-gray-500">{color.colorCode.toUpperCase()}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      color.isActive 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {color.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  {color.availableForDesigns && color.availableForDesigns.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {color.availableForDesigns.map((design) => (
                        <span
                          key={design}
                          className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium"
                        >
                          {design}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Available for all designs</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Reorder */}
                  <div className="flex flex-col">
                    {index > 0 && (
                      <button
                        onClick={() => handleMoveColor(index, 'up')}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <FiChevronUp />
                      </button>
                    )}
                    {index < filteredColors.length - 1 && (
                      <button
                        onClick={() => handleMoveColor(index, 'down')}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <FiChevronDown />
                      </button>
                    )}
                  </div>

                  {/* Toggle Active */}
                  <button
                    onClick={() => handleToggleActive(color)}
                    className={`p-2 rounded-lg transition-colors ${
                      color.isActive
                        ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    {color.isActive ? <FiEyeOff /> : <FiEye />}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleEditClick(color)}
                    className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                  >
                    <FiEdit2 />
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteColor(color._id, color.colorName)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title={
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
              <FiDroplet className="text-white text-xl" />
            </div>
            {editingColor ? 'Edit Color' : 'Add New Color'}
          </div>
        }
        size="lg"
      >
        <div className="space-y-6">
          {/* Color Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Color Name *
            </label>
            <input
              type="text"
              value={formData.colorName}
              onChange={(e) => setFormData({ ...formData, colorName: e.target.value })}
              placeholder="e.g., Navy Blue"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Color Code *
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-24 h-12 rounded-xl border-4 border-gray-200 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                style={{ backgroundColor: formData.colorCode }}
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={formData.colorCode}
                  onChange={(e) => setFormData({ ...formData, colorCode: e.target.value })}
                  placeholder="#000000"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all outline-none font-mono"
                />
              </div>
            </div>

            {showColorPicker && (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                <SketchPicker
                  color={formData.colorCode}
                  onChangeComplete={(color) => setFormData({ ...formData, colorCode: color.hex })}
                  className="mx-auto shadow-xl"
                />
              </div>
            )}
          </div>

          {/* Design Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Available for Designs
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Select specific designs or leave empty to allow all designs
            </p>

            {products.length > 0 ? (
              <div className="max-h-64 overflow-y-auto border-2 border-gray-200 rounded-xl p-4 space-y-2">
                {products.map((product) => (
                  <label
                    key={product.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-indigo-50 cursor-pointer transition-colors group"
                  >
                    <input
                      type="checkbox"
                      checked={formData.availableForDesigns.includes(product.design)}
                      onChange={() => handleDesignToggle(product.design)}
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-700 transition-colors">
                      {product.design}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <FiPackage className="mx-auto text-4xl text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No products found</p>
              </div>
            )}

            {formData.availableForDesigns.length > 0 && (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, availableForDesigns: [] })}
                className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Clear all ({formData.availableForDesigns.length} selected)
              </button>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={editingColor ? handleUpdateColor : handleAddColor}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <FiCheck />
              {editingColor ? 'Update Color' : 'Add Color'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ColorPaletteManager;
