import { useState, useEffect, useMemo } from 'react';
import { factoryService } from '../services/factoryService';
import { inventoryService } from '../services/inventoryService';
import { settingsService } from '../services/settingsService';
import { useEnabledSizes } from '../hooks/useEnabledSizes';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Loader from '../components/common/Loader';
import ScrollToTop from '../components/common/ScrollToTop';

// Import Tabs
import FactoryTab from '../components/factory/tabs/FactoryTab';
import BorrowedTab from '../components/factory/tabs/BorrowedTab';

// Import Modals
import AddReceivingModal from '../components/factory/modals/AddReceivingModal';
import EditReceivingModal from '../components/factory/modals/EditReceivingModal';
import ReturnStockModal from '../components/factory/modals/ReturnStockModal';
import BorrowHistoryModal from '../components/factory/modals/BorrowHistoryModal';

// Import Utils
import { groupByDate, groupByBorrower, calculateStats } from '../components/factory/utils/factoryHelpers';

const FactoryReceiving = () => {
  const { user } = useAuth();
  const { enabledSizes, loading: sizesLoading } = useEnabledSizes();

  // ===== STATE MANAGEMENT =====
  const [activeTab, setActiveTab] = useState('factory');
  const [receivings, setReceivings] = useState([]);
  const [products, setProducts] = useState([]);
  const [permissions, setPermissions] = useState({ allowSalesEdit: false });
  const [loading, setLoading] = useState(true);

  // Filter States
  const [factoryFilters, setFactoryFilters] = useState({
    dateFrom: null,
    dateTo: null,
    search: '',
  });

  const [borrowedFilters, setBorrowedFilters] = useState({
    search: '',
    status: 'all',
  });

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Edit Modal Data
  const [editingReceivings, setEditingReceivings] = useState([]);

  // Return Modal Data
  const [returningReceipt, setReturningReceipt] = useState(null);

  // History Modal Data
  const [historyData, setHistoryData] = useState({
    sourceName: '',
    loading: false,
    borrows: [],
    returns: [],
  });

  // ===== DATA FETCHING =====
  useEffect(() => {
    fetchPermissions();
    fetchData();
  }, []);

  const fetchPermissions = async () => {
    try {
      const settings = await settingsService.getSettings();
      setPermissions(settings.permissions || { allowSalesEdit: false });
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [receivingsData, productsData] = await Promise.all([
        factoryService.getAllReceivings(),
        inventoryService.getAllProducts(),
      ]);
      setReceivings(receivingsData);
      setProducts(
        Array.isArray(productsData)
          ? productsData
          : productsData?.products || productsData?.data || []
      );
    } catch (error) {
      toast.error('Failed to fetch data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ===== COMPUTED DATA =====
  const groupedByDate = useMemo(() => {
    const factoryReceivings = receivings.filter(
      (r) => r.sourceType === 'factory' || !r.sourceType
    );
    return groupByDate(factoryReceivings, enabledSizes);
  }, [receivings, enabledSizes]);

  const borrowerData = useMemo(() => {
    return groupByBorrower(receivings, enabledSizes);
  }, [receivings, enabledSizes]);

  const stats = useMemo(() => {
    return calculateStats(receivings, factoryFilters, borrowedFilters);
  }, [receivings, factoryFilters, borrowedFilters]);

  // ===== PERMISSION CHECK =====
  const canEditDelete = () => {
    return user?.role === 'admin' || permissions.allowSalesEdit;
  };

const handleAddReceiving = async (receivingData) => {
  try {
    const isNewProduct = receivingData.skipStockUpdate;
    const design = receivingData.design;
    const color = receivingData.color;

    if (isNewProduct) {
      // Check if product already exists
      const existingProduct = products.find((p) => p.design === design);

      if (!existingProduct) {
        // Create new product with this color
        const newProductPayload = {
          design: design,
          description: receivingData.description || '',
          colors: [
            {
              color: color,
              wholesalePrice: receivingData.wholesalePrice || 0,
              retailPrice: receivingData.retailPrice || 0,
              sizes: enabledSizes.map((size) => ({
                size: size,
                currentStock: receivingData.quantities[size] || 0,
                reorderPoint: 20,
              })),
            },
          ],
        };

        await inventoryService.createProduct(newProductPayload);
        console.log('✅ Created new product:', design);
      } else {
        // Product exists, check if color exists
        const colorExists = existingProduct.colors.some((c) => c.color === color);

        if (!colorExists) {
          // Add new color to existing product
          const updatedColors = [
            ...existingProduct.colors,
            {
              color: color,
              wholesalePrice: receivingData.wholesalePrice || 0,
              retailPrice: receivingData.retailPrice || 0,
              sizes: enabledSizes.map((size) => ({
                size: size,
                currentStock: receivingData.quantities[size] || 0,
                reorderPoint: 20,
              })),
            },
          ];

          await inventoryService.updateProduct(existingProduct._id, {
            colors: updatedColors,
          });
          console.log('✅ Added new color to existing product:', color);
        } else {
          // Color exists, just update stock
          const colorIndex = existingProduct.colors.findIndex((c) => c.color === color);
          const updatedColors = [...existingProduct.colors];
          
          updatedColors[colorIndex].sizes = enabledSizes.map((size) => {
            const existingSize = updatedColors[colorIndex].sizes.find((s) => s.size === size);
            const currentStock = existingSize?.currentStock || 0;
            const addingQty = receivingData.quantities[size] || 0;

            return {
              size: size,
              currentStock: currentStock + addingQty,
              reorderPoint: existingSize?.reorderPoint || 20,
            };
          });

          await inventoryService.updateProduct(existingProduct._id, {
            colors: updatedColors,
          });
          console.log('✅ Updated stock for existing color');
        }
      }

      // Refresh products list
      const productsData = await inventoryService.getAllProducts();
      setProducts(
        Array.isArray(productsData)
          ? productsData
          : productsData?.products || productsData?.data || []
      );
    }

    // Create factory receiving record (for tracking)
    await factoryService.createReceiving(receivingData);

    toast.success(
      isNewProduct
        ? '✅ New product created with stock!'
        : '✅ Stock received successfully!'
    );
    setShowAddModal(false);
    fetchData();
  } catch (error) {
    console.error('Error adding receiving:', error);
    toast.error(error.response?.data?.message || 'Failed to add receiving');
    throw error;
  }
};

  const handleEditReceiving = async (receivingIds) => {
    try {
      const toEdit = receivings.filter((r) => receivingIds.includes(r._id));
      setEditingReceivings(toEdit);
      setShowEditModal(true);
    } catch (error) {
      console.error('Error opening edit modal:', error);
      toast.error('Failed to open edit modal');
    }
  };

  const handleUpdateReceiving = async (id, data) => {
    try {
      await factoryService.updateReceiving(id, data);
      toast.success('Receiving updated successfully!');
      setShowEditModal(false);
      setEditingReceivings([]);
      fetchData();
    } catch (error) {
      console.error('Error updating receiving:', error);
      toast.error(error.response?.data?.message || 'Failed to update receiving');
      throw error;
    }
  };

  const handleDeleteReceiving = async (receivingIds) => {
    if (!window.confirm('Are you sure you want to delete this receiving?')) {
      return;
    }

    try {
      await Promise.all(receivingIds.map((id) => factoryService.deleteReceiving(id)));
      toast.success('Receiving deleted successfully!');
      fetchData();
    } catch (error) {
      console.error('Error deleting receiving:', error);
      toast.error(error.response?.data?.message || 'Failed to delete receiving');
    }
  };

  const handleOpenReturnModal = (receipt) => {
    setReturningReceipt(receipt);
    setShowReturnModal(true);
  };

  const handleReturnStock = async (data) => {
    try {
      await factoryService.returnBorrowedStock(returningReceipt._id, data);
      toast.success('Stock returned successfully!');
      setShowReturnModal(false);
      setReturningReceipt(null);
      fetchData();
    } catch (error) {
      console.error('Error returning stock:', error);
      toast.error(error.response?.data?.message || 'Failed to return stock');
      throw error;
    }
  };

  const handleOpenHistory = async (sourceName) => {
    setHistoryData({
      sourceName,
      loading: true,
      borrows: [],
      returns: [],
    });
    setShowHistoryModal(true);

    try {
      const data = await factoryService.getBorrowHistoryBySource(sourceName);
      setHistoryData({
        sourceName,
        loading: false,
        borrows: data.borrows || [],
        returns: data.returns || [],
      });
    } catch (error) {
      console.error('History load error:', error);
      toast.error('Failed to load history');
      setHistoryData((prev) => ({ ...prev, loading: false }));
    }
  };

  // ===== LOADING STATE =====
  if (loading || sizesLoading) {
    return <Loader />;
  }

  // ===== RENDER =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <ScrollToTop />
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                📦 Factory Receiving
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage factory receivings and borrowed stock
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium"
            >
              + Receive Stock
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white rounded-lg shadow-sm p-1 inline-flex space-x-1">
          <button
            onClick={() => setActiveTab('factory')}
            className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
              activeTab === 'factory'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            🏭 Factory Receivings
          </button>
          <button
            onClick={() => setActiveTab('borrowed')}
            className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
              activeTab === 'borrowed'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            📦 Borrowed Stock
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'factory' && (
          <FactoryTab
            data={groupedByDate}
            stats={stats.factory}
            enabledSizes={enabledSizes}
            canEditDelete={canEditDelete()}
            onEdit={handleEditReceiving}
            onDelete={handleDeleteReceiving}
            filters={factoryFilters}
            onFilterChange={setFactoryFilters}
          />
        )}

        {activeTab === 'borrowed' && (
          <BorrowedTab
            data={borrowerData}
            stats={stats.borrowed}
            enabledSizes={enabledSizes}
            canEditDelete={canEditDelete()}
            onReturn={handleOpenReturnModal}
            onViewHistory={handleOpenHistory}
            products={products}
            filters={borrowedFilters}
            onFilterChange={setBorrowedFilters}
          />
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddReceivingModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddReceiving}
          products={products}
          enabledSizes={enabledSizes}
        />
      )}

      {showEditModal && (
        <EditReceivingModal
          receivings={editingReceivings}
          onClose={() => {
            setShowEditModal(false);
            setEditingReceivings([]);
          }}
          onSubmit={handleUpdateReceiving}
          enabledSizes={enabledSizes}
        />
      )}

      {showReturnModal && (
        <ReturnStockModal
          receipt={returningReceipt}
          onClose={() => {
            setShowReturnModal(false);
            setReturningReceipt(null);
          }}
          onSubmit={handleReturnStock}
          products={products}
          enabledSizes={enabledSizes}
        />
      )}

      {showHistoryModal && (
        <BorrowHistoryModal
          data={historyData}
          onClose={() => {
            setShowHistoryModal(false);
            setHistoryData({ sourceName: '', loading: false, borrows: [], returns: [] });
          }}
          enabledSizes={enabledSizes}
        />
      )}
    </div>
  );
};

export default FactoryReceiving;
