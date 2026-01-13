import { useState, useEffect } from 'react';
import {factoryService} from '../services/factoryService';
import {inventoryService} from '../services/inventoryService';
import {useEnabledSizes} from '../hooks/useEnabledSizes';
import Card from '../components/common/Card';
import Modal from '../components/common/Modal';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';
import {
  FiPlus,
  FiTruck,
  FiPackage,
  FiChevronDown,
  FiChevronUp,
  FiCalendar,
  FiTrash2
} from 'react-icons/fi';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import {settingsService} from '../services/settingsService';
import { useColorPalette } from '../hooks/useColorPalette';

const FactoryReceiving = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { enabledSizes, loading: sizesLoading } = useEnabledSizes();
  const { colors, getColorsForDesign, getColorCode } = useColorPalette();

  // Data states
  const [receivings, setReceivings] = useState([]);
  const [selectedItemsToReturn, setSelectedItemsToReturn] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [returnType, setReturnType] = useState('same'); // 'same' or 'exchange'
  const [exchangeStock, setExchangeStock] = useState({ items: [] });
  const [expandedBorrows, setExpandedBorrows] = useState({}); // Track which borrows are expanded

  const [historyModal, setHistoryModal] = useState({
    show: false,
    sourceName: '',
    loading: false,
    borrows: [],
    returns: [],
  });

  // ✅ NEW: Multiple design entries
  const [designEntries, setDesignEntries] = useState([
    {
      id: Date.now(),
      selectedDesign: '',
      isNewProduct: false,
      batchId: '',
      notes: '',
      stockData: {},
      description: '',
      wholesalePrice: '',
      retailPrice: '',
      sourceType: 'factory',
      sourceName: '',
      returnDueDate: ''
    }
  ]);

  const [expandedDates, setExpandedDates] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingReceivings, setEditingReceivings] = useState([]);

  // Return modal states
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returningReceipt, setReturningReceipt] = useState(null);
  const [returnQuantities, setReturnQuantities] = useState({});
  const [returnNotes, setReturnNotes] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [permissions, setPermissions] = useState({ allowSalesEdit: false });

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const settings = await settingsService.getSettings();
        setPermissions(settings.permissions || { allowSalesEdit: false });
      } catch (error) {
        console.error('Failed to fetch permissions:', error);
      }
    };
    fetchPermissions();
  }, []);

  const canEditDelete = () => {
    return user?.role === 'admin' || permissions.allowSalesEdit;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
  try {
    const [receivingsData, productsData] = await Promise.all([
      factoryService.getAllReceivings(),
      inventoryService.getAllProducts(),
    ]);

    setReceivings(receivingsData);
    setProducts(Array.isArray(productsData) ? productsData : (productsData?.products || productsData?.data || []));
  } catch (error) {
    toast.error('Failed to fetch data');
  } finally {
    setLoading(false);
  }
};

const openBorrowHistory = async (sourceName) => {
  setHistoryModal(prev => ({
    ...prev,
    show: true,
    sourceName,
    loading: true,
    borrows: [],
    returns: [],
  }));
  try {
    const data = await factoryService.getBorrowHistoryBySource(sourceName);
    setHistoryModal(prev => ({
      ...prev,
      loading: false,
      borrows: data.borrows || [],
      returns: data.returns || [],
    }));
  } catch (error) {
    console.error('History load error:', error);
    toast.error(error.response?.data?.message || 'Failed to load history');
    setHistoryModal(prev => ({ ...prev, loading: false }));
  }
};

    // Group receivings by date
  const groupByDate = () => {
    const grouped = {};

    receivings.forEach(receiving => {
      const date = format(new Date(receiving.receivedDate), 'yyyy-MM-dd');

      if (!grouped[date]) {
        grouped[date] = {
          date: date,
          designs: {},
          totalQuantity: 0,
          uniqueDesigns: new Set(),
          uniqueColors: new Set()
        };
      }

      const design = receiving.design;
      const notes = receiving.notes || 'No notes';
      const sourceType = receiving.sourceType || 'factory';
      const sourceName = receiving.sourceName || '';
      const borrowStatus = receiving.borrowStatus || 'na';

      const designKey = `${design}-${notes}-${sourceType}-${sourceName}`;

      if (!grouped[date].designs[designKey]) {
        grouped[date].designs[designKey] = {
          design: design,
          notes: notes,
          sourceType: sourceType,
          sourceName: sourceName,
          borrowStatus: borrowStatus,
          returnDueDate: receiving.returnDueDate,
          batchIds: new Set(),
          colors: {},
          totalQuantity: 0,
          receivingIds: []
        };
      }

      const designGroup = grouped[date].designs[designKey];
      const color = receiving.color;

      if (!designGroup.colors[color]) {
        designGroup.colors[color] = {
          color: color,
          quantities: {},
          totalQuantity: 0,
          receivingIds: [],
          sourceType: sourceType,
          sourceName: sourceName,
          borrowStatus: borrowStatus,
          returnDueDate: receiving.returnDueDate,
          returnedQuantity: receiving.returnedQuantity || 0,
          returnedQuantities: receiving.returnedQuantities || {}
        };
      }

      designGroup.colors[color].receivingIds.push(receiving._id);
      designGroup.receivingIds.push(receiving._id);

      const quantities = receiving.quantities instanceof Map
        ? Object.fromEntries(receiving.quantities)
        : receiving.quantities;

      Object.keys(quantities).forEach(size => {
        if (size !== 'undefined' && enabledSizes.includes(size)) {
          if (!designGroup.colors[color].quantities[size]) {
            designGroup.colors[color].quantities[size] = 0;
          }
          designGroup.colors[color].quantities[size] += quantities[size];
        }
      });

      const colorTotal = receiving.totalQuantity || 0;
      designGroup.colors[color].totalQuantity += colorTotal;
      designGroup.totalQuantity += colorTotal;
      grouped[date].totalQuantity += colorTotal;

      if (receiving.batchId) {
        designGroup.batchIds.add(receiving.batchId);
      }

      grouped[date].uniqueDesigns.add(design);
      grouped[date].uniqueColors.add(color);
    });

    const result = Object.values(grouped).map(dayData => ({
      date: dayData.date,
      designs: Object.values(dayData.designs).map(designGroup => ({
        ...designGroup,
        batchIds: Array.from(designGroup.batchIds),
        colors: Object.values(designGroup.colors)
      })),
      totalQuantity: dayData.totalQuantity,
      uniqueDesigns: dayData.uniqueDesigns,
      uniqueColors: dayData.uniqueColors
    }));

    return result.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

const getSearchResults = () => {
  if (!searchQuery.trim()) return null;

  const query = searchQuery.toLowerCase().trim();
  
  const borrowedItems = receivings.filter(r => 
    ['borrowed_buyer', 'borrowed_vendor'].includes(r.sourceType) &&
    r.sourceName && 
    r.sourceName.toLowerCase().includes(query) &&
    r.borrowStatus !== 'returned'
  );

  if (borrowedItems.length === 0) return null;

  const results = [];
  
  borrowedItems.forEach(borrowReceipt => {
    const quantities = borrowReceipt.quantities instanceof Map 
      ? Object.fromEntries(borrowReceipt.quantities) 
      : borrowReceipt.quantities;

    enabledSizes.forEach(size => {
      const qty = quantities[size] || 0;
      const returnedQty = borrowReceipt.returnedQuantities?.[size] || 0;
      const remaining = qty - returnedQty;

      if (remaining > 0) {
        results.push({
          design: borrowReceipt.design,
          color: borrowReceipt.color,
          size: size,
          quantity: remaining,
          sourceName: borrowReceipt.sourceName,
          sourceType: borrowReceipt.sourceType,
          borrowStatus: borrowReceipt.borrowStatus,
          returnDueDate: borrowReceipt.returnDueDate,
          receivingId: borrowReceipt._id,
        });
      }
    });
  });

  const totalUnits = results.reduce((sum, item) => sum + item.quantity, 0);

  return { results, totalUnits };
};

  const toggleDate = (date) => {
    setExpandedDates(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const getDateLabel = (dateStr) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'dd MMM yyyy');
  };

  const getSourceBadge = (sourceType, sourceName) => {
    const configs = {
      factory: { icon: '🏭', label: 'Factory', color: 'bg-blue-100 text-blue-800' },
      borrowed_buyer: { icon: '📦', label: `Borrowed: ${sourceName}`, color: 'bg-orange-100 text-orange-800' },
      borrowed_vendor: { icon: '🔄', label: `Borrowed: ${sourceName}`, color: 'bg-purple-100 text-purple-800' },
      return: { icon: '↩️', label: `Return: ${sourceName}`, color: 'bg-green-100 text-green-800' },
      transfer: { icon: '🔀', label: 'Transfer', color: 'bg-gray-100 text-gray-800' },
      other: { icon: '📋', label: `${sourceName || 'Other'}`, color: 'bg-gray-100 text-gray-800' }
    };

    const config = configs[sourceType] || configs.factory;

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon} {config.label}
      </span>
    );
  };

  const getBorrowStatusBadge = (status) => {
    if (!status || status === 'na') return null;

    const configs = {
      active: { label: 'Active Borrow', color: 'bg-orange-100 text-orange-800', icon: '🔥' },
      partial: { label: 'Partial Return', color: 'bg-yellow-100 text-yellow-800', icon: '⚠️' },
      returned: { label: 'Fully Returned', color: 'bg-green-100 text-green-800', icon: '✅' }
    };

    const config = configs[status] || configs.active;

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${config.color}`}>
        {config.icon} {config.label}
      </span>
    );
  };

    const handleOpenReturnModal = (colorData, designGroup) => {
    const fullReceipt = receivings.find(r => colorData.receivingIds.includes(r._id));

    if (!fullReceipt) {
      toast.error('Could not find receipt details');
      return;
    }

    setReturningReceipt(fullReceipt);

    const initialQuantities = {};
    enabledSizes.forEach(size => {
      initialQuantities[size] = 0;
    });
    setReturnQuantities(initialQuantities);
    setReturnNotes('');
    setShowReturnModal(true);
  };

const handleReturnSubmit = async (e) => {
  e.preventDefault();
  if (submitting) return;

  if (selectedItemsToReturn.length === 0) {
    toast.error('Please select items to return');
    return;
  }

  if (returnType === 'same') {
    const totalReturning = selectedItemsToReturn.reduce((sum, idx) => {
      return sum + Object.values(returnQuantities[idx] || {}).reduce((s, q) => s + (Number(q) || 0), 0);
    }, 0);

    if (totalReturning === 0) {
      toast.error('Please enter quantities to return');
      return;
    }
  }

  if (returnType === 'exchange') {
    if (!exchangeStock.items || exchangeStock.items.length === 0) {
      toast.error('Please add exchange items');
      return;
    }

    const invalidItem = exchangeStock.items.find(item => !item.design || !item.color);
    if (invalidItem) {
      toast.error('Please select design and color for all exchange items');
      return;
    }

    const totalExchangeQty = exchangeStock.items.reduce((sum, item) => {
      return sum + Object.values(item.quantities || {}).reduce((s, q) => s + (Number(q) || 0), 0);
    }, 0);

    if (totalExchangeQty === 0) {
      toast.error('Please enter quantities for exchange items');
      return;
    }

    if (!returnNotes.trim()) {
      toast.error('Return notes required for exchanges');
      return;
    }
  }

  setSubmitting(true);

  try {
    // Calculate values
    const selectedBorrowedValue = selectedItemsToReturn.reduce((sum, idx) => {
      const item = returningReceipt.allBorrowedItems[idx];
      const product = products.find(p => p.design === item.design);
      const color = product?.colors.find(c => c.color === item.color);
      const wholesalePrice = color?.wholesalePrice || 0;
      
      if (returnType === 'same') {
        const returningQty = Object.values(returnQuantities[idx] || {}).reduce((s, q) => s + (Number(q) || 0), 0);
        return sum + (returningQty * wholesalePrice);
      } else {
        return sum + (item.totalQuantity * wholesalePrice);
      }
    }, 0);

    const exchangeValue = returnType === 'exchange' ? exchangeStock.items.reduce((sum, exchItem) => {
      const product = products.find(p => p.design === exchItem.design);
      const color = product?.colors.find(c => c.color === exchItem.color);
      const wholesalePrice = color?.wholesalePrice || 0;
      const totalQty = Object.values(exchItem.quantities || {}).reduce((s, q) => s + (Number(q) || 0), 0);
      return sum + (totalQty * wholesalePrice);
    }, 0) : 0;

    const valueDifference = exchangeValue - selectedBorrowedValue;

    console.log('🔍 Return Debug:', {
      returnType,
      selectedBorrowedValue,
      exchangeValue,
      valueDifference,
      selectedItemsToReturn,
      exchangeStock
    });

    // Process returns
    if (returnType === 'same') {
      // Return same stock for each selected item
      const promises = selectedItemsToReturn.map(idx => {
        const item = returningReceipt.allBorrowedItems[idx];
        const payload = {
          returnType: 'same',
          quantitiesToReturn: returnQuantities[idx],
          returnNotes: returnNotes || ''
        };
        
        console.log('📦 Sending SAME return:', { receivingId: item.receivingId, payload });
        return factoryService.returnBorrowedStock(item.receivingId, payload);
      });
      
      await Promise.all(promises);
      
    } else {
      // ✅ FIXED: Send ONE request with ALL exchange items
      const item = returningReceipt.allBorrowedItems[selectedItemsToReturn[0]];
      
      const payload = {
        returnType: 'exchange',
        exchangeItems: exchangeStock.items, // Send all items at once
        returnNotes: returnNotes || '',
        settlementInfo: {
          borrowedValue: selectedBorrowedValue,
          exchangeValue: exchangeValue,
          difference: valueDifference,
          settlementType: valueDifference > 0 ? 'excess' : valueDifference < 0 ? 'deficit' : 'balanced'
        }
      };
      
      console.log('🔄 Sending EXCHANGE return:', { receivingId: item.receivingId, payload });
      await factoryService.returnBorrowedStock(item.receivingId, payload);
    }

    const totalReturned = returnType === 'same'
      ? selectedItemsToReturn.reduce((sum, idx) => {
          return sum + Object.values(returnQuantities[idx] || {}).reduce((s, q) => s + (Number(q) || 0), 0);
        }, 0)
      : exchangeStock.items.reduce((sum, item) => {
          return sum + Object.values(item.quantities || {}).reduce((s, q) => s + (Number(q) || 0), 0);
        }, 0);

    // Success message
    let successMessage = '';
    if (returnType === 'same') {
      successMessage = `✅ Returned ${totalReturned} units (₹${selectedBorrowedValue.toLocaleString()}) to ${returningReceipt.sourceName}`;
    } else {
      if (Math.abs(valueDifference) < 1) {
        successMessage = `✅ Exchanged stock worth ₹${selectedBorrowedValue.toLocaleString()} - Perfectly balanced!`;
      } else if (valueDifference > 0) {
        successMessage = `✅ Exchanged! You returned ₹${Math.abs(valueDifference).toLocaleString()} EXTRA - Settle with cash or borrow from them`;
      } else {
        successMessage = `✅ Exchanged! You returned ₹${Math.abs(valueDifference).toLocaleString()} LESS - Pay cash or return more later`;
      }
    }

    toast.success(successMessage, { duration: 5000 });

    setShowReturnModal(false);
    setReturnQuantities({});
    setReturnNotes('');
    setReturnType('same');
    setExchangeStock({ items: [] });
    setSelectedItemsToReturn([]);
    fetchData();
    
  } catch (error) {
    console.error('❌ Return error:', error);
    console.error('Error response:', error.response?.data);
    toast.error(error.response?.data?.message || 'Failed to process return');
  } finally {
    setSubmitting(false);
  }
};


    const handleEdit = async (colorData, designGroup) => {
    if (!isAdmin) {
      toast.error('Only admins can edit receivings');
      return;
    }

    const individualReceivings = designGroup.receivingIds
      .map((id) => receivings.find((r) => r._id === id))
      .filter(Boolean);

    const hasCorruptedData = individualReceivings.some((r) => {
      const quantities = r.quantities instanceof Map
        ? Object.fromEntries(r.quantities)
        : r.quantities;
      const hasValidQuantities = Object.keys(quantities).some((key) =>
        key !== 'undefined' && enabledSizes.includes(key) && quantities[key] > 0
      );
      return !r.size && (!hasValidQuantities || quantities.hasOwnProperty('undefined'));
    });

    if (hasCorruptedData) {
      toast.error('This receiving has corrupted data. Please delete and recreate it.', {
        duration: 5000
      });
      return;
    }

    setEditMode(true);
    setEditingReceivings(individualReceivings);

    // Create single entry for edit mode
    const entry = {
      id: Date.now(),
      selectedDesign: designGroup.design,
      isNewProduct: false,
      batchId: designGroup.batchIds?.join(', ') || '',
      notes: designGroup.notes || '',
      stockData: {},
      description: '',
      wholesalePrice: '',
      retailPrice: '',
      sourceType: designGroup.sourceType || 'factory',
      sourceName: designGroup.sourceName || '',
      returnDueDate: designGroup.returnDueDate || ''
    };

    // Build edit stock data
    const editStockData = {};
    const pieces = {};
    enabledSizes.forEach((size) => {
      pieces[size] = colorData.quantities[size] || 0;
    });
    editStockData[colorData.color] = {
      mode: 'pieces',
      sets: 0,
      pieces: pieces
    };

    entry.stockData = editStockData;
    setDesignEntries([entry]);
    setShowModal(true);
  };

  const handleDelete = async (groupedReceiving) => {
    if (!isAdmin) {
      toast.error('Only admins can delete receivings');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete all receivings for ${groupedReceiving.design} - ${groupedReceiving.color}?\n\nThis will:\n- Delete ${groupedReceiving.receivingIds.length} receiving record(s)\n- Reduce stock by ${groupedReceiving.totalQuantity} units\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const deletePromises = groupedReceiving.receivingIds.map((id) =>
        factoryService.deleteReceiving(id)
      );
      await Promise.all(deletePromises);
      toast.success(`Deleted ${groupedReceiving.receivingIds.length} receivings successfully!`);
      fetchData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete receivings');
    }
  };

    // ✅ NEW: Add another design entry
  const handleAddDesignEntry = () => {
    setDesignEntries(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        selectedDesign: '',
        isNewProduct: false,
        batchId: '',
        notes: '',
        stockData: {},
        description: '',
        wholesalePrice: '',
        retailPrice: '',
        sourceType: 'factory',
        sourceName: '',
        returnDueDate: ''
      }
    ]);
  };

  // ✅ NEW: Remove a design entry
  const handleRemoveDesignEntry = (entryId) => {
    if (designEntries.length === 1) {
      toast.error('At least one design entry is required');
      return;
    }
    setDesignEntries(prev => prev.filter(entry => entry.id !== entryId));
  };

// UPDATED Handle design change for specific entry
const handleDesignChange = (entryId, value) => {
  setDesignEntries(prev => prev.map(entry => {
    if (entry.id === entryId) {
      const existingProduct = products.find(p => p.design === value);
      const isNew = value === 'new' || !existingProduct || value === '';
      
      const initialStockData = {};
      
      // For existing products, initialize with their actual colors from products
      if (!isNew) {
        const existingColors = existingProduct?.colors;
        existingColors.forEach(colorObj => {
          const pieces = {};
          enabledSizes.forEach(size => {
            pieces[size] = 0;
          });
          initialStockData[colorObj.color] = {
            mode: 'sets',
            sets: 0,
            pieces: pieces
          };
        });
      }
      // For new products: leave stockData empty - user will select colors from palette
      
      return {
        ...entry,
        selectedDesign: value === 'new' ? 'new' : value,
        isNewProduct: isNew,
        stockData: initialStockData,
        wholesalePrice: isNew ? '' : entry.wholesalePrice,
        retailPrice: isNew ? '' : entry.retailPrice
      };
    }
    return entry;
  }));
};

  // ✅ UPDATED: Handle field changes for specific entry
  const handleEntryFieldChange = (entryId, field, value) => {
    setDesignEntries(prev =>
      prev.map(entry =>
        entry.id === entryId ? { ...entry, [field]: value } : entry
      )
    );
  };

  // ✅ UPDATED: Handle mode change for specific entry and color
  const handleModeChange = (entryId, color, mode) => {
    setDesignEntries(prev =>
      prev.map(entry => {
        if (entry.id === entryId) {
          const pieces = {};
          enabledSizes.forEach(size => {
            pieces[size] = 0;
          });

          return {
            ...entry,
            stockData: {
              ...entry.stockData,
              [color]: {
                ...entry.stockData[color],
                mode: mode,
                sets: 0,
                pieces: pieces
              }
            }
          };
        }
        return entry;
      })
    );
  };

  // ✅ UPDATED: Handle sets change
  const handleSetsChange = (entryId, color, value) => {
    setDesignEntries(prev =>
      prev.map(entry => {
        if (entry.id === entryId) {
          return {
            ...entry,
            stockData: {
              ...entry.stockData,
              [color]: {
                ...entry.stockData[color],
                sets: Number(value) || 0
              }
            }
          };
        }
        return entry;
      })
    );
  };

  // ✅ UPDATED: Handle pieces change
  const handlePiecesChange = (entryId, color, size, value) => {
    const numValue = value ? Number(value) : 0;
    setDesignEntries(prev =>
      prev.map(entry => {
        if (entry.id === entryId) {
          return {
            ...entry,
            stockData: {
              ...entry.stockData,
              [color]: {
                ...entry.stockData[color],
                pieces: {
                  ...entry.stockData[color]?.pieces,
                  [size]: numValue
                }
              }
            }
          };
        }
        return entry;
      })
    );
  };

  // ✅ UPDATED: Get final quantities for specific entry
  const getFinalQuantities = (entry) => {
    const finalData = {};
    Object.keys(entry.stockData).forEach(color => {
      if (entry.stockData[color].mode === 'sets') {
        const setsCount = Number(entry.stockData[color].sets) || 0;
        if (setsCount > 0) {
          const quantities = {};
          enabledSizes.forEach(size => {
            quantities[size] = setsCount;
          });
          finalData[color] = quantities;
        }
      } else {
        const pieces = entry.stockData[color].pieces || {};
        let hasQuantity = false;
        enabledSizes.forEach(size => {
          const qty = Number(pieces[size]) || 0;
          if (qty > 0) {
            if (!finalData[color]) finalData[color] = {};
            finalData[color][size] = qty;
            hasQuantity = true;
          }
        });
      }
    });
    return finalData;
  };

  // ✅ COMPLETELY REWRITTEN: Handle submit for multiple designs
const handleSubmit = async (e) => {
  e.preventDefault();
  if (submitting) return;

  setSubmitting(true);

  try {
    // Edit mode - single entry
    if (editMode && editingReceivings.length > 0) {
      const entry = designEntries[0];
      const color = Object.keys(getFinalQuantities(entry))[0];
      const newQuantities = getFinalQuantities(entry)[color];

      const updatePromises = editingReceivings.map((receiving) =>
        factoryService.updateReceiving(receiving.id, {
          quantities: newQuantities,
          batchId: entry.batchId,
          notes: entry.notes,
        })
      );

      if (updatePromises.length === 0) {
        toast.error('No receivings to update');
        setSubmitting(false);
        return;
      }

      await Promise.all(updatePromises);
      toast.success('Receivings updated successfully!');
      setShowModal(false);
      resetForm();
      fetchData();
      return;
    }

    // Create mode - validate all entries
    for (const entry of designEntries) {
      if (!entry.selectedDesign || (entry.isNewProduct && entry.selectedDesign === 'new')) {
        toast.error('Please select or enter a design for all entries');
        setSubmitting(false);
        return;
      }

      const finalQuantities = getFinalQuantities(entry);

      if (Object.keys(finalQuantities).length === 0) {
        toast.error(`Please enter stock for at least one color in ${entry.selectedDesign}`);
        setSubmitting(false);
        return;
      }

      // ✅ FIXED: Only validate sourceName for borrowed/other types
      if (['borrowed_buyer', 'borrowed_vendor', 'other'].includes(entry.sourceType)) {
        if (!entry.sourceName.trim()) {
          toast.error(`Please enter source name for ${entry.selectedDesign}`);
          setSubmitting(false);
          return;
        }
      }

      if (entry.isNewProduct) {
        if (!entry.wholesalePrice || Number(entry.wholesalePrice) <= 0) {
          toast.error(`Please enter wholesale price for new product ${entry.selectedDesign}`);
          setSubmitting(false);
          return;
        }

        if (!entry.retailPrice || Number(entry.retailPrice) <= 0) {
          toast.error(`Please enter retail price for new product ${entry.selectedDesign}`);
          setSubmitting(false);
          return;
        }
      }
    }

    // Process all entries
    const allPromises = [];

    for (const entry of designEntries) {
      const finalQuantities = getFinalQuantities(entry);

      // Create new product if needed
      if (entry.isNewProduct) {
        const productPayload = {
          design: entry.selectedDesign,
          description: entry.description || '',
          colors: Object.keys(finalQuantities).map((color) => ({
            color: color,
            wholesalePrice: Number(entry.wholesalePrice),
            retailPrice: Number(entry.retailPrice),
            sizes: enabledSizes.map((size) => ({
              size: size,
              currentStock: finalQuantities[color]?.[size] || 0,
              reorderPoint: 20,
            })),
          })),
        };

        allPromises.push(inventoryService.createProduct(productPayload));
      }

      // Create receiving records for each color
      for (const color of Object.keys(finalQuantities)) {
        const quantities = finalQuantities[color];
        
        // ✅ FIXED: Build payload with proper sourceType defaults
        const receivingPayload = {
          design: entry.selectedDesign,
          color: color,
          quantities: quantities,
          batchId: entry.batchId || (entry.isNewProduct ? 'Initial Stock' : ''),
          notes: entry.notes || (entry.isNewProduct ? 'New product creation' : ''),
          skipStockUpdate: entry.isNewProduct,
          sourceType: entry.sourceType || 'factory', // ✅ DEFAULT to 'factory'
        };

        // ✅ Only add sourceName/returnDueDate for borrowed types
        if (['borrowed_buyer', 'borrowed_vendor', 'other'].includes(entry.sourceType)) {
          receivingPayload.sourceName = entry.sourceName.trim().toLowerCase();
          receivingPayload.returnDueDate = entry.returnDueDate || null;
        }

        allPromises.push(factoryService.createReceiving(receivingPayload));
      }
    }

    await Promise.all(allPromises);

    const newProductsCount = designEntries.filter(e => e.isNewProduct).length;
    const totalDesigns = designEntries.length;

    // Success message
    if (newProductsCount > 0) {
      toast.success(`✅ ${newProductsCount} new product(s) created with stock!`);
    } else {
      toast.success(`✅ Stock added successfully for ${totalDesigns} design(s)!`);
    }

    setShowModal(false);
    resetForm();
    fetchData();
  } catch (error) {
    console.error('Error:', error);
    toast.error(error.response?.data?.message || 'Operation failed');
  } finally {
    setSubmitting(false);
  }
};


  // ✅ UPDATED: Reset form
  const resetForm = () => {
    setDesignEntries([
      {
        id: Date.now(),
        selectedDesign: '',
        isNewProduct: false,
        batchId: '',
        notes: '',
        stockData: {},
        description: '',
        wholesalePrice: '',
        retailPrice: '',
        sourceType: 'factory',
        sourceName: '',
        returnDueDate: ''
      }
    ]);
    setEditMode(false);
    setEditingReceivings([]);
  };

  if (loading || sizesLoading) return <Loader />;

  const groupedData = groupByDate();
  const totalReceivings = receivings.length;
  const totalQuantity = receivings.reduce((sum, r) => sum + (r.totalQuantity || 0), 0);

    return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <FiTruck className="text-blue-500" />
          Factory Receiving
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-lg font-semibold text-sm hover:bg-blue-600 transition-all shadow-lg"
        >
          <FiPlus />
          Receive Stock
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
              <FiPackage className="text-2xl text-blue-500" />
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Total Receivings</div>
              <div className="text-3xl font-bold text-gray-900">{totalReceivings}</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
              <FiTruck className="text-2xl text-green-500" />
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Total Units Received</div>
              <div className="text-3xl font-bold text-gray-900">{totalQuantity}</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
              <FiCalendar className="text-2xl text-purple-500" />
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Receiving Days</div>
              <div className="text-3xl font-bold text-gray-900">{groupedData.length}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-2xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search borrowed buyer's name (e.g., Poojan)..."
            className="block w-full pl-12 pr-12 py-4 border-2 border-gray-300 rounded-xl text-base font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ✅ UPDATED SEARCH RESULTS VIEW */}
      {searchQuery && (() => {
        const searchData = getSearchResults();
        if (!searchData || searchData.results.length === 0) {
          return (
            <Card>
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Results Found</h3>
                <p className="text-gray-500">No borrowed items found matching "{searchQuery}"</p>
              </div>
            </Card>
          );
        }

        // Group results by receivingId
        const groupedResults = {};
        searchData.results.forEach(item => {
          const key = `${item.receivingId}-${item.design}-${item.color}`;
          if (!groupedResults[key]) {
            groupedResults[key] = {
              design: item.design,
              color: item.color,
              sourceName: item.sourceName,
              sourceType: item.sourceType,
              borrowStatus: item.borrowStatus,
              returnDueDate: item.returnDueDate,
              receivingId: item.receivingId,
              sizes: {},
              totalQuantity: 0
            };
          }
          groupedResults[key].sizes[item.size] = item.quantity;
          groupedResults[key].totalQuantity += item.quantity;
        });

        // Calculate totals
        const allBorrowReceipts = receivings.filter(r => 
          ['borrowed_buyer', 'borrowed_vendor'].includes(r.sourceType) &&
          r.sourceName &&
          r.sourceName.toLowerCase().includes(searchQuery.toLowerCase().trim())
        );

        let totalBorrowed = 0;
        let totalReturned = 0;

        allBorrowReceipts.forEach(receipt => {
          const quantities = receipt.quantities instanceof Map 
            ? Object.fromEntries(receipt.quantities) 
            : receipt.quantities;
          
          const borrowed = Object.values(quantities).reduce((sum, q) => sum + q || 0, 0);
          const returned = receipt.returnedQuantity || 0;
          
          totalBorrowed += borrowed;
          totalReturned += returned;
        });

        const remainingStock = totalBorrowed - totalReturned;

        return (
          <div className="space-y-4 mb-8">
            {/* Enhanced Search Results Header */}
            <Card>
              <div className="p-5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      📦 Borrowed Stock from "{searchQuery}"
                    </h2>
                    <p className="text-sm text-gray-600">
                      Found {allBorrowReceipts.length} borrow transactions
                    </p>
                  </div>
                  
                  {/* ✅ NEW: Action Buttons */}
                  {isAdmin && remainingStock > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          // Use the actual sourceName from borrow receipts (preserves case)
                          const actualSourceName = allBorrowReceipts[0]?.sourceName || searchQuery;
                          setReturningReceipt({
                            sourceName: actualSourceName,
                            sourceType: searchData.results[0].sourceType,
                            allBorrowedItems: Object.values(groupedResults),
                            totalUnits: searchData.totalUnits
                          });
                          setReturnType('same');
                          setReturnQuantities({});
                          setExchangeStock({ items: [] });
                          setSelectedItemsToReturn([]);
                          setShowReturnModal(true);
                        }}
                        className="px-6 py-3 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-all flex items-center gap-2 text-lg shadow-lg"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Return Stock
                      </button>

                      {/* ✅ NEW: View History Button */}
                      <button
                        onClick={() => {
                          // Get the actual sourceName from the first borrow receipt (case-preserved)
                          const actualSourceName = allBorrowReceipts[0]?.sourceName || searchQuery;
                          openBorrowHistory(actualSourceName);
                        }}
                        className="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-all flex items-center gap-2 text-lg shadow-lg"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        View History
                      </button>
                    </div>
                  )}
                </div>

                {/* Summary Grid */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Total Borrowed */}
                  <div className="bg-white rounded-lg p-3 border-2 border-purple-200">
                    <p className="text-xs text-gray-600 mb-1">📥 Total Borrowed</p>
                    <p className="text-2xl font-bold text-purple-600">{totalBorrowed}</p>
                    <p className="text-xs text-gray-500">units</p>
                  </div>

                  {/* Total Returned */}
                  <div className="bg-white rounded-lg p-3 border-2 border-green-200">
                    <p className="text-xs text-gray-600 mb-1">📤 Total Returned</p>
                    <p className="text-2xl font-bold text-green-600">{totalReturned}</p>
                    <p className="text-xs text-gray-500">units</p>
                  </div>

                  {/* Remaining */}
                  <div className="bg-white rounded-lg p-3 border-2 border-orange-200">
                    <p className="text-xs text-gray-600 mb-1">🟠 Still With You</p>
                    <p className="text-2xl font-bold text-orange-600">{remainingStock}</p>
                    <p className="text-xs text-gray-500">units</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Borrowed Items List */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  📋 Borrowed Stock Details
                </h3>
                <div className="space-y-4">
                  {Object.values(groupedResults).map((item, idx) => (
                    <div
                      key={idx}
                      className="border-2 border-gray-200 rounded-lg p-4 bg-gradient-to-r from-gray-50 to-white hover:shadow-lg transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span 
                            className="w-10 h-10 rounded-full border-2 border-gray-300"
                            style={{ backgroundColor: getColorCode(item.color) }}
                          />
                          <div>
                            <h4 className="font-bold text-lg text-gray-900">
                              {item.design} - {item.color}
                            </h4>
                            <p className="text-sm text-gray-600">
                              From: <strong>{item.sourceName}</strong>
                            </p>
                          </div>
                        </div>
                        {item.returnDueDate && (
                          <p className="text-xs text-red-600 font-semibold">
                            📅 Due: {format(parseISO(item.returnDueDate), 'dd MMM yyyy')}
                          </p>
                        )}
                      </div>

                      {/* Size badges */}
                      <div className="flex gap-2 flex-wrap">
                        {enabledSizes.map(size => {
                          const qty = item.sizes[size] || 0;
                          if (qty === 0) return null;
                          return (
                            <span
                              key={size}
                              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-bold"
                            >
                              {size}: {qty}
                            </span>
                          );
                        })}
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                        <span className="text-sm text-gray-600">Remaining to Return</span>
                        <span className="px-4 py-1 bg-orange-100 text-orange-800 rounded-full font-bold">
                          {item.totalQuantity} units
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        );
      })()}

            {/* Regular View (when not searching) */}
      {!searchQuery && (
        <div className="space-y-4">
          {groupedData.map(dayData => (
            <Card key={dayData.date}>
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-all rounded-lg"
                onClick={() => toggleDate(dayData.date)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FiCalendar className="text-xl text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{getDateLabel(dayData.date)}</h3>
                    <p className="text-sm text-gray-500">{format(parseISO(dayData.date), 'EEEE, MMMM dd, yyyy')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{dayData.totalQuantity}</div>
                    <div className="text-xs text-gray-500">Units Received</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-700">{dayData.uniqueDesigns.size}</div>
                    <div className="text-xs text-gray-500">Designs</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-700">{dayData.uniqueColors.size}</div>
                    <div className="text-xs text-gray-500">Colors</div>
                  </div>
                  <button className="p-2 hover:bg-gray-200 rounded-lg transition-all">
                    {expandedDates[dayData.date] ? (
                      <FiChevronUp size={20} />
                    ) : (
                      <FiChevronDown size={20} />
                    )}
                  </button>
                </div>
              </div>

              {expandedDates[dayData.date] && (
                <div className="border-t border-gray-200 p-4 space-y-6">
                  {dayData.designs.map((designGroup, designIndex) => (
                    <div key={designIndex} className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-300">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                            <FiPackage className="text-xl text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">{designGroup.design}</h3>
                            <p className="text-sm text-gray-600">
                              {designGroup.colors.length} color{designGroup.colors.length > 1 ? 's' : ''} • {designGroup.totalQuantity} units
                            </p>
                            <div className="flex gap-2 mt-1">
                              {getSourceBadge(designGroup.sourceType, designGroup.sourceName)}
                              {getBorrowStatusBadge(designGroup.borrowStatus)}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          {designGroup.batchIds.length > 0 && (
                            <div className="text-xs text-gray-500 mb-1">
                              <span className="font-semibold">Batch:</span> {designGroup.batchIds.join(', ')}
                            </div>
                          )}
                          {designGroup.notes && designGroup.notes !== 'No notes' && (
                            <div className="text-xs text-blue-600 font-medium">{designGroup.notes}</div>
                          )}
                          {designGroup.returnDueDate && (
                            <div className="text-xs text-red-600 font-semibold mt-1">
                              Due: {format(parseISO(designGroup.returnDueDate), 'dd MMM yyyy')}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-white">
                              <th className="text-left p-3 text-xs font-semibold text-gray-600 rounded-tl-lg">Color</th>
                              <th className="text-left p-3 text-xs font-semibold text-gray-600">Sizes & Quantities</th>
                              <th className="text-left p-3 text-xs font-semibold text-gray-600">Total Qty</th>
                              {canEditDelete() && (
                                <th className="text-center p-3 text-xs font-semibold text-gray-600 rounded-tr-lg">Actions</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {designGroup.colors.map((colorData, colorIndex) => (
                              <tr key={colorIndex} className="border-t border-gray-200 bg-white hover:bg-gray-50">
                                <td className="p-3 text-sm">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-6 h-6 rounded-full border-2 border-gray-300"
                                      style={{ backgroundColor: getColorCode(colorData.color) }}
                                    />
                                    <span className="font-semibold">{colorData.color}</span>
                                  </div>
                                </td>
                                <td className="p-3 text-sm">
                                  <div className="flex gap-1 flex-wrap">
                                    {enabledSizes.map(size => {
                                      const qty = colorData.quantities[size] || 0;
                                      return (
                                        <span
                                          key={size}
                                          className={`px-2 py-1 rounded text-xs font-semibold ${
                                            qty > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-400'
                                          }`}
                                        >
                                          {size}:{qty}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td className="p-3 text-sm">
                                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-bold">
                                    {colorData.totalQuantity}
                                  </span>
                                </td>
                                {canEditDelete() && (
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEdit(colorData, designGroup);
                                        }}
                                        className="px-3 py-1 bg-blue-500 text-white rounded text-xs font-semibold hover:bg-blue-600 transition-all"
                                      >
                                        Edit
                                      </button>

                                      {['borrowed_buyer', 'borrowed_vendor'].includes(colorData.sourceType) &&
                                        colorData.borrowStatus === 'active' &&
                                        (isAdmin || user?.role === 'salesperson') && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenReturnModal(colorData, designGroup);
                                            }}
                                            className="px-3 py-1 bg-orange-500 text-white rounded text-xs font-semibold hover:bg-orange-600 transition-all"
                                          >
                                            Return
                                          </button>
                                        )}

                                        {['borrowed_buyer', 'borrowed_vendor'].includes(colorData.sourceType) && (
                                          <button
                                            type="button"
                                            onClick={() => openBorrowHistory(colorData.sourceName)}
                                            className="text-xs text-blue-600 underline ml-2"
                                          >
                                            View history
                                          </button>
                                        )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(colorData);
                                        }}
                                        className="px-3 py-1 bg-red-500 text-white rounded text-xs font-semibold hover:bg-red-600 transition-all flex items-center gap-1"
                                      >
                                        <FiTrash2 size={12} />
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}

          {groupedData.length === 0 && (
            <Card>
              <div className="text-center py-12 text-gray-500">
                <FiPackage className="mx-auto text-5xl mb-4 text-gray-300" />
                <p className="text-lg font-semibold">No receivings recorded yet</p>
                <p className="text-sm mt-2">Click "Receive Stock" to add your first receiving</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ==================== ADD/EDIT MODAL ==================== */}
      <Modal 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); resetForm(); }}
        title={editMode ? 'Edit Factory Receiving' : 'Factory Receiving (Multiple Designs)'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header with Add More button */}
          {!editMode && (
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <div>
                <h3 className="font-bold text-gray-900">
                  {designEntries.length} Design{designEntries.length > 1 ? 's' : ''} to Add
                </h3>
                <p className="text-sm text-gray-600">Add multiple designs in a single submission</p>
              </div>
              <button
                type="button"
                onClick={handleAddDesignEntry}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all"
              >
                <FiPlus /> Add More Design
              </button>
            </div>
          )}

          {/* Loop through all design entries */}
          {designEntries.map((entry, index) => (
            <div key={entry.id} className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50 relative">
              {/* Entry header with remove button */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-300">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                    {index + 1}
                  </span>
                  <h4 className="font-bold text-gray-900">
                    Design {index + 1} {entry.selectedDesign && `- ${entry.selectedDesign}`}
                  </h4>
                </div>
                {!editMode && designEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDesignEntry(entry.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all flex items-center gap-1"
                  >
                    <FiTrash2 size={14} /> Remove
                  </button>
                )}
              </div>

              {/* Design Selection */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Design Number</label>
                {editMode ? (
                  <input
                    type="text"
                    value={entry.selectedDesign}
                    disabled
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={entry.selectedDesign === 'new' || entry.isNewProduct ? 'new' : entry.selectedDesign}
                    onChange={(e) => handleDesignChange(entry.id, e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    required={!entry.isNewProduct}
                  >
                    <option value="">Select Design</option>
                    {products.map((product) => (
                      <option key={product._id} value={product.design}>
                        {product.design}
                      </option>
                    ))}
                    <option value="new">➕ Add New Design</option>
                  </select>
                )}
              </div>

              {/* New Design Input */}
              {entry.isNewProduct && !editMode && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">New Design Number</label>
                  <input
                    type="text"
                    value={entry.selectedDesign === 'new' ? '' : entry.selectedDesign}
                    onChange={(e) => {
                      const newValue = e.target.value.trim();
                      handleEntryFieldChange(entry.id, 'selectedDesign', newValue || 'new'); // Keep "new" if empty
                    }}
                    placeholder="e.g., D15"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    required
                  />
                </div>
              )}

              {/* NEW: Color Selection for New Products */}
              {entry.isNewProduct && !editMode && (
                <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Select Colors for This Design <span className="text-red-600">*</span>
                  </label>
                  
                  {/* Color Palette from Settings */}
                  <div className="flex flex-wrap gap-2">
                    {colors.map((colorObj) => {
                      const isSelected = entry.stockData && entry.stockData[colorObj.colorName];
                      return (
                        <button
                          key={colorObj.colorName}
                          type="button"
                          onClick={() => {
                            setDesignEntries(prev => prev.map(e => {
                              if (e.id === entry.id) {
                                const newStockData = { ...e.stockData };
                                if (isSelected) {
                                  // Remove color
                                  delete newStockData[colorObj.colorName];
                                } else {
                                  // Add color with default structure
                                  const pieces = {};
                                  enabledSizes.forEach(size => {
                                    pieces[size] = 0;
                                  });
                                  newStockData[colorObj.colorName] = {
                                    mode: 'sets',
                                    sets: 0,
                                    pieces: pieces
                                  };
                                }
                                return { ...e, stockData: newStockData };
                              }
                              return e;
                            }));
                          }}
                          className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                            isSelected
                              ? 'bg-green-500 text-white ring-2 ring-green-600'
                              : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-purple-400'
                          }`}
                        >
                          <div
                            className="w-5 h-5 rounded-full border-2 border-gray-400"
                            style={{ backgroundColor: colorObj.hex }}
                          />
                          {colorObj.colorName}
                          {isSelected && <span>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Color Stock Entry - Show colors based on context */}
              {(entry.isNewProduct || Object.keys(entry.stockData).length > 0 || !entry.isNewProduct && entry.selectedDesign) && (
                <div className="mb-4">
                  <h5 className="font-bold text-gray-700 mb-3">Stock Quantities</h5>

                  {(() => {
                    let colorsToShow = [];
                    
                    if (entry.isNewProduct) {
                      // NEW PRODUCT: Show only colors user has selected
                      colorsToShow = Object.keys(entry.stockData);
                    } else {
                      // ✅ EXISTING PRODUCT: Show colors from BOTH product + palette
                      const existingProduct = products.find(p => p.design === entry.selectedDesign);
                      
                      if (existingProduct) {
                        // Get existing colors from product
                        const existingColors = existingProduct.colors.map(c => c.color);
                        
                        // Get available colors from palette for this design
                        const paletteColors = getColorsForDesign(entry.selectedDesign).map(c => c.colorName);
                        
                        // Combine both - existing colors FIRST, then new palette colors
                        const combinedColors = [...new Set([...existingColors, ...paletteColors])];
                        colorsToShow = combinedColors;
                      }
                    }

                    // Auto-initialize missing colors
                    return colorsToShow.map(color => {
                      if (!entry.stockData[color]) {
                        const pieces = {};
                        enabledSizes.forEach(size => {
                          pieces[size] = 0;
                        });
                        entry.stockData[color] = {
                          mode: 'sets',
                          sets: 0,
                          pieces: pieces
                        };
                      }

                      const colorData = entry.stockData[color];
                      
                      return (
                        <div key={color} className="mb-6 last:mb-0 bg-gray-50 rounded-lg p-4 border border-gray-200">
                          {/* Color Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-6 h-6 rounded-full border-2 border-gray-300"
                                style={{ backgroundColor: getColorCode(color) }}
                              />
                              <h4 className="font-bold text-gray-900">{color}</h4>
                            </div>
                            
                            {/* Mode toggle buttons */}
                            {!editMode && (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleModeChange(entry.id, color, 'sets')}
                                  className={`px-3 py-1 rounded-lg font-semibold text-sm transition-all ${
                                    colorData.mode === 'sets'
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  Sets
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleModeChange(entry.id, color, 'pieces')}
                                  className={`px-3 py-1 rounded-lg font-semibold text-sm transition-all ${
                                    colorData.mode === 'pieces'
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  Pieces
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Sets/Pieces Input */}
                          {colorData.mode === 'sets' && !editMode ? (
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">
                                Number of Sets (1 set = 1 of each size)
                              </label>
                              <input
                                type="number"
                                value={colorData.sets || 0}
                                onChange={(e) => handleSetsChange(entry.id, color, e.target.value)}
                                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                                placeholder="0"
                                min="0"
                              />
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {enabledSizes.map(size => (
                                <div key={size}>
                                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                                    {size}
                                  </label>
                                  <input
                                    type="number"
                                    value={colorData.pieces?.[size] || 0}
                                    onChange={(e) => handlePiecesChange(entry.id, color, size, e.target.value)}
                                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                                    placeholder="0"
                                    min="0"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Batch ID & Notes */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Batch ID</label>
                  <input
                    type="text"
                    value={entry.batchId}
                    onChange={(e) => handleEntryFieldChange(entry.id, 'batchId', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                  <input
                    type="text"
                    value={entry.notes}
                    onChange={(e) => handleEntryFieldChange(entry.id, 'notes', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="Optional"
                  />
                </div>
              </div>

              {/* New Product Pricing */}
              {entry.isNewProduct && (
                <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Wholesale Price <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      value={entry.wholesalePrice}
                      onChange={(e) => handleEntryFieldChange(entry.id, 'wholesalePrice', e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                      placeholder="0"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Retail Price <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      value={entry.retailPrice}
                      onChange={(e) => handleEntryFieldChange(entry.id, 'retailPrice', e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                      placeholder="0"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => { setShowModal(false); resetForm(); }}
              className="px-6 py-2 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : editMode ? 'Update' : 'Create Receivings'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ✅ FLEXIBLE Return Modal with Cash Settlement */}
      <Modal
        isOpen={showReturnModal}
        onClose={() => {
          setShowReturnModal(false);
          setReturnType('same');
          setExchangeStock({ items: [] });
          setSelectedItemsToReturn([]);
          setReturnQuantities({});
          setReturnNotes('');
        }}
        title={`Return Borrowed Stock - ${returningReceipt?.sourceName}`}
        size="3xl"
      >
        {returningReceipt && (() => {
          // Calculate borrowed value
          const totalBorrowedValue = returningReceipt.allBorrowedItems?.reduce((sum, item) => {
            const product = products.find(p => p.design === item.design);
            const color = product?.colors.find(c => c.color === item.color);
            const wholesalePrice = color?.wholesalePrice || 0;
            return sum + (item.totalQuantity * wholesalePrice);
          }, 0) || 0;

          // Calculate selected items value (what user wants to return)
          const selectedBorrowedValue = selectedItemsToReturn.reduce((sum, idx) => {
            const item = returningReceipt.allBorrowedItems[idx];
            const product = products.find(p => p.design === item.design);
            const color = product?.colors.find(c => c.color === item.color);
            const wholesalePrice = color?.wholesalePrice || 0;
            
            if (returnType === 'same') {
              const returningQty = Object.values(returnQuantities[idx] || {}).reduce((s, q) => s + (Number(q) || 0), 0);
              return sum + (returningQty * wholesalePrice);
            } else {
              return sum + (item.totalQuantity * wholesalePrice);
            }
          }, 0);

          // Calculate exchange value
          const exchangeValue = exchangeStock.items?.reduce((sum, exchItem) => {
            const product = products.find(p => p.design === exchItem.design);
            const color = product?.colors.find(c => c.color === exchItem.color);
            const wholesalePrice = color?.wholesalePrice || 0;
            const totalQty = Object.values(exchItem.quantities || {}).reduce((s, q) => s + (Number(q) || 0), 0);
            return sum + (totalQty * wholesalePrice);
          }, 0) || 0;

          const remainingDebt = totalBorrowedValue - selectedBorrowedValue;
          
          // ✅ NEW: Calculate settlement (difference between exchange and borrowed)
          const valueDifference = exchangeValue - selectedBorrowedValue;
          const isBalanced = Math.abs(valueDifference) < 1;
          const isExcess = valueDifference > 0;
          const isDeficit = valueDifference < 0;

          return (
            <form onSubmit={handleReturnSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
              {/* Financial Summary Header */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border-2 border-purple-200 sticky top-0 z-10">
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">💰 Total Borrowed</p>
                    <p className="text-xl font-bold text-purple-600">₹{totalBorrowedValue.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{returningReceipt.totalUnits} units</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">🎯 Selected Return</p>
                    <p className="text-xl font-bold text-orange-600">₹{selectedBorrowedValue.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">
                      {selectedItemsToReturn.reduce((sum, idx) => {
                        if (returnType === 'same') {
                          return sum + Object.values(returnQuantities[idx] || {}).reduce((s, q) => s + (Number(q) || 0), 0);
                        }
                        return sum + returningReceipt.allBorrowedItems[idx].totalQuantity;
                      }, 0)} units
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">
                      {returnType === 'exchange' ? '🔄 Exchange Value' : '💳 Remaining Debt'}
                    </p>
                    <p className="text-xl font-bold text-blue-600">
                      {returnType === 'exchange' ? `₹${exchangeValue.toLocaleString()}` : `₹${remainingDebt.toLocaleString()}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {returnType === 'exchange' 
                        ? `Stock value returning`
                        : 'After this return'
                      }
                    </p>
                  </div>
                  
                  {/* ✅ NEW: Settlement Display */}
                  {returnType === 'exchange' && exchangeValue > 0 && (
                    <div className={`rounded-lg p-2 ${
                      isBalanced ? 'bg-green-100 border-2 border-green-400' :
                      isExcess ? 'bg-blue-100 border-2 border-blue-400' :
                      'bg-orange-100 border-2 border-orange-400'
                    }`}>
                      <p className="text-xs font-semibold mb-1">
                        {isBalanced ? '✅ Settlement' : isExcess ? '📈 Excess Return' : '📉 Short Return'}
                      </p>
                      {isBalanced ? (
                        <>
                          <p className="text-lg font-bold text-green-700">BALANCED</p>
                          <p className="text-xs text-green-600">Perfect match!</p>
                        </>
                      ) : isExcess ? (
                        <>
                          <p className="text-lg font-bold text-blue-700">+₹{Math.abs(valueDifference).toLocaleString()}</p>
                          <p className="text-xs text-blue-600">You borrow from them OR they pay you</p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-bold text-orange-700">-₹{Math.abs(valueDifference).toLocaleString()}</p>
                          <p className="text-xs text-orange-600">You pay cash OR return more later</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Select Items to Return */}
              <div>
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  📦 Select Items to Return
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedItemsToReturn.length === returningReceipt.allBorrowedItems?.length) {
                        setSelectedItemsToReturn([]);
                        setReturnQuantities({});
                      } else {
                        const allIndices = returningReceipt.allBorrowedItems?.map((_, idx) => idx) || [];
                        setSelectedItemsToReturn(allIndices);
                        const allQty = {};
                        returningReceipt.allBorrowedItems?.forEach((item, idx) => {
                          allQty[idx] = { ...item.sizes };
                        });
                        setReturnQuantities(allQty);
                      }
                    }}
                    className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    {selectedItemsToReturn.length === returningReceipt.allBorrowedItems?.length ? 'Deselect All' : 'Select All'}
                  </button>
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2 border rounded-lg p-2">
                  {returningReceipt.allBorrowedItems?.map((item, idx) => {
                    const product = products.find(p => p.design === item.design);
                    const color = product?.colors.find(c => c.color === item.color);
                    const wholesalePrice = color?.wholesalePrice || 0;
                    const itemValue = item.totalQuantity * wholesalePrice;

                    return (
                      <label
                        key={idx}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedItemsToReturn.includes(idx) ? 'bg-blue-50 border-blue-400' : 'border-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedItemsToReturn.includes(idx)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItemsToReturn(prev => [...prev, idx]);
                              setReturnQuantities(prev => ({
                                ...prev,
                                [idx]: { ...item.sizes }
                              }));
                            } else {
                              setSelectedItemsToReturn(prev => prev.filter(i => i !== idx));
                              setReturnQuantities(prev => {
                                const newQty = { ...prev };
                                delete newQty[idx];
                                return newQty;
                              });
                            }
                          }}
                          className="w-5 h-5"
                        />
                        <span
                          className="w-8 h-8 rounded-full border-2 border-gray-300 flex-shrink-0"
                          style={{ backgroundColor: getColorCode(item.color) }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900">{item.design} - {item.color}</p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {enabledSizes.map(size => {
                              const qty = item.sizes[size] || 0;
                              if (qty === 0) return null;
                              return (
                                <span key={size} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">
                                  {size}:{qty}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-green-600">{item.totalQuantity} units</p>
                          <p className="text-xs text-gray-600">@ ₹{wholesalePrice}/unit</p>
                          <p className="text-sm font-bold text-purple-600">₹{itemValue.toLocaleString()}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {selectedItemsToReturn.length > 0 && (
                <>
                  {/* Return Type Selection */}
                  <div>
                    <h4 className="font-bold text-gray-900 mb-3">🔄 Return Type</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        returnType === 'same' ? 'bg-blue-50 border-blue-400' : 'border-gray-300 hover:bg-gray-50'
                      }`}>
                        <input
                          type="radio"
                          name="returnType"
                          value="same"
                          checked={returnType === 'same'}
                          onChange={(e) => {
                            setReturnType(e.target.value);
                            setExchangeStock({ items: [] });
                          }}
                          className="w-5 h-5"
                        />
                        <div>
                          <p className="font-bold text-gray-900">📦 Return Same Stock</p>
                          <p className="text-xs text-gray-600">Return exact items (full or partial)</p>
                        </div>
                      </label>

                      <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        returnType === 'exchange' ? 'bg-orange-50 border-orange-400' : 'border-gray-300 hover:bg-gray-50'
                      }`}>
                        <input
                          type="radio"
                          name="returnType"
                          value="exchange"
                          checked={returnType === 'exchange'}
                          onChange={(e) => {
                            setReturnType(e.target.value);
                            setExchangeStock({ items: [] });
                          }}
                          className="w-5 h-5"
                        />
                        <div>
                          <p className="font-bold text-gray-900">🔄 Exchange Stock</p>
                          <p className="text-xs text-gray-600">Return different items + settle cash</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* SAME STOCK - Adjust Quantities */}
                  {returnType === 'same' && (
                    <div>
                      <h4 className="font-bold text-gray-900 mb-3">
                        ✏️ Adjust Return Quantities
                        <span className="text-sm font-normal text-gray-600 ml-2">(Partial allowed)</span>
                      </h4>
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2 border rounded-lg p-3 bg-gray-50">
                        {selectedItemsToReturn.map(itemIdx => {
                          const item = returningReceipt.allBorrowedItems[itemIdx];
                          const product = products.find(p => p.design === item.design);
                          const color = product?.colors.find(c => c.color === item.color);
                          const wholesalePrice = color?.wholesalePrice || 0;
                          const currentReturnQty = Object.values(returnQuantities[itemIdx] || {}).reduce((s, q) => s + (Number(q) || 0), 0);
                          const currentReturnValue = currentReturnQty * wholesalePrice;

                          return (
                            <div key={itemIdx} className="border-2 rounded-lg p-3 bg-white">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-6 h-6 rounded-full border-2 border-gray-300"
                                    style={{ backgroundColor: getColorCode(item.color) }}
                                  />
                                  <span className="font-bold text-sm">{item.design} - {item.color}</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-600">Returning: {currentReturnQty} / {item.totalQuantity} units</p>
                                  <p className="text-sm font-bold text-purple-600">₹{currentReturnValue.toLocaleString()}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-5 gap-2">
                                {enabledSizes.map(size => {
                                  const maxQty = item.sizes[size] || 0;
                                  if (maxQty === 0) return null;
                                  
                                  return (
                                    <div key={size}>
                                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                                        {size} <span className="text-gray-500">(max:{maxQty})</span>
                                      </label>
                                      <input
                                        type="number"
                                        value={returnQuantities[itemIdx]?.[size] || 0}
                                        onChange={(e) => {
                                          const value = Number(e.target.value);
                                          if (value <= maxQty && value >= 0) {
                                            setReturnQuantities(prev => ({
                                              ...prev,
                                              [itemIdx]: {
                                                ...prev[itemIdx],
                                                [size]: value
                                              }
                                            }));
                                          }
                                        }}
                                        className="w-full px-2 py-1 border-2 border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                                        min="0"
                                        max={maxQty}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* EXCHANGE STOCK - Multiple Items */}
                  {returnType === 'exchange' && (
                    <div className="space-y-4">
                      <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
                        <p className="text-sm font-bold text-gray-900 mb-1">
                          💡 Flexible Exchange System:
                        </p>
                        <ul className="text-xs text-gray-700 space-y-1">
                          <li>✅ Exchange <strong>any amount</strong> - no restrictions!</li>
                          <li>✅ Select <strong>multiple designs & colors</strong></li>
                          <li>✅ If values don't match, settle with <strong>cash or future returns</strong></li>
                          <li>💰 Selected borrowed value: <strong>₹{selectedBorrowedValue.toLocaleString()}</strong></li>
                        </ul>
                      </div>

                      {/* Exchange Items List */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-gray-900">🎁 Select Exchange Stock</h4>
                          <button
                            type="button"
                            onClick={() => {
                              setExchangeStock(prev => ({
                                items: [...(prev.items || []), { design: '', color: '', quantities: {} }]
                              }));
                            }}
                            className="px-3 py-1 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 text-sm flex items-center gap-1"
                          >
                            <span className="text-lg">+</span> Add Item
                          </button>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                          {(!exchangeStock.items || exchangeStock.items.length === 0) && (
                            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                              <p className="text-gray-500">Click "+ Add Item" to select exchange stock</p>
                            </div>
                          )}

                          {exchangeStock.items?.map((exchItem, exchIdx) => {
                            const product = products.find(p => p.design === exchItem.design);
                            const color = product?.colors.find(c => c.color === exchItem.color);
                            const wholesalePrice = color?.wholesalePrice || 0;
                            const itemQty = Object.values(exchItem.quantities || {}).reduce((s, q) => s + (Number(q) || 0), 0);
                            const itemValue = itemQty * wholesalePrice;

                            return (
                              <div key={exchIdx} className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50 relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExchangeStock(prev => ({
                                      items: prev.items.filter((_, i) => i !== exchIdx)
                                    }));
                                  }}
                                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center justify-center text-sm font-bold"
                                >
                                  ×
                                </button>

                                <p className="text-xs font-bold text-gray-700 mb-3">Exchange Item #{exchIdx + 1}</p>

                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Design</label>
                                    <select
                                      value={exchItem.design}
                                      onChange={(e) => {
                                        const newItems = [...exchangeStock.items];
                                        newItems[exchIdx] = {
                                          design: e.target.value,
                                          color: '',
                                          quantities: {}
                                        };
                                        setExchangeStock({ items: newItems });
                                      }}
                                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 text-sm"
                                      required
                                    >
                                      <option value="">Select Design</option>
                                      {products.map(p => (
                                        <option key={p._id} value={p.design}>{p.design}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Color</label>
                                    <select
                                      value={exchItem.color}
                                      onChange={(e) => {
                                        const newItems = [...exchangeStock.items];
                                        newItems[exchIdx] = {
                                          ...newItems[exchIdx],
                                          color: e.target.value,
                                          quantities: {}
                                        };
                                        setExchangeStock({ items: newItems });
                                      }}
                                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 text-sm"
                                      required
                                      disabled={!exchItem.design}
                                    >
                                      <option value="">Select Color</option>
                                      {products
                                        .find(p => p.design === exchItem.design)
                                        ?.colors.map(c => (
                                          <option key={c.color} value={c.color}>{c.color}</option>
                                        ))}
                                    </select>
                                  </div>
                                </div>

                                {exchItem.design && exchItem.color && (
                                  <>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                                      Quantities (@ ₹{wholesalePrice}/unit)
                                    </label>
                                    <div className="grid grid-cols-5 gap-2 mb-2">
                                      {enabledSizes.map(size => {
                                        const availableStock = color?.sizes.find(s => s.size === size)?.currentStock || 0;

                                        return (
                                          <div key={size}>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                                              {size} <span className="text-gray-500">({availableStock})</span>
                                            </label>
                                            <input
                                              type="number"
                                              value={exchItem.quantities[size] || 0}
                                              onChange={(e) => {
                                                const value = Number(e.target.value);
                                                if (value <= availableStock && value >= 0) {
                                                  const newItems = [...exchangeStock.items];
                                                  newItems[exchIdx] = {
                                                    ...newItems[exchIdx],
                                                    quantities: {
                                                      ...newItems[exchIdx].quantities,
                                                      [size]: value
                                                    }
                                                  };
                                                  setExchangeStock({ items: newItems });
                                                }
                                              }}
                                              className="w-full px-2 py-1 border-2 border-gray-300 rounded text-sm focus:border-orange-500"
                                              min="0"
                                              max={availableStock}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div className="bg-white rounded p-2 border border-orange-300">
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-600">This item total:</span>
                                        <div className="text-right">
                                          <span className="font-bold text-gray-900">{itemQty} units</span>
                                          <span className="text-purple-600 font-bold ml-3">₹{itemValue.toLocaleString()}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* ✅ UPDATED: Exchange Summary with Settlement */}
                      {exchangeStock.items && exchangeStock.items.length > 0 && exchangeValue > 0 && (
                        <div className={`p-4 rounded-lg border-2 ${
                          isBalanced ? 'bg-green-100 border-green-400' :
                          isExcess ? 'bg-blue-100 border-blue-400' :
                          'bg-orange-100 border-orange-400'
                        }`}>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-bold text-gray-900 mb-2">Exchange Summary:</p>
                              <div className="space-y-1 text-xs">
                                <p className="flex justify-between">
                                  <span className="text-gray-600">Borrowed (selected):</span>
                                  <span className="font-bold">₹{selectedBorrowedValue.toLocaleString()}</span>
                                </p>
                                <p className="flex justify-between">
                                  <span className="text-gray-600">Exchanging:</span>
                                  <span className="font-bold">₹{exchangeValue.toLocaleString()}</span>
                                </p>
                                <p className="flex justify-between border-t pt-1">
                                  <span className="text-gray-600">Difference:</span>
                                  <span className={`font-bold ${isExcess ? 'text-blue-700' : 'text-orange-700'}`}>
                                    {isExcess ? '+' : ''}₹{valueDifference.toLocaleString()}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="border-l pl-4">
                              <p className="text-sm font-bold text-gray-900 mb-2">💰 Settlement:</p>
                              {isBalanced ? (
                                <div className="text-center py-2">
                                  <p className="text-2xl font-bold text-green-700">✅ PERFECT</p>
                                  <p className="text-xs text-green-600">No cash settlement needed</p>
                                </div>
                              ) : isExcess ? (
                                <div className="text-center py-2">
                                  <p className="text-2xl font-bold text-blue-700">+₹{Math.abs(valueDifference).toLocaleString()}</p>
                                  <p className="text-xs text-blue-600 font-semibold">📈 You're returning MORE</p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    Either:<br/>
                                    • You borrow ₹{Math.abs(valueDifference).toLocaleString()} from them<br/>
                                    • They pay you ₹{Math.abs(valueDifference).toLocaleString()}
                                  </p>
                                </div>
                              ) : (
                                <div className="text-center py-2">
                                  <p className="text-2xl font-bold text-orange-700">-₹{Math.abs(valueDifference).toLocaleString()}</p>
                                  <p className="text-xs text-orange-600 font-semibold">📉 You're returning LESS</p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    Either:<br/>
                                    • You pay ₹{Math.abs(valueDifference).toLocaleString()} cash<br/>
                                    • Return more stock later
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Return Notes */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      📝 Return Notes {returnType === 'exchange' && <span className="text-red-600">*</span>}
                    </label>
                    <textarea
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                      placeholder={returnType === 'exchange' ? "Required: Explain exchange and settlement details..." : "Optional notes..."}
                      required={returnType === 'exchange'}
                    />
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t-2 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setShowReturnModal(false);
                    setReturnType('same');
                    setExchangeStock({ items: [] });
                    setSelectedItemsToReturn([]);
                    setReturnQuantities({});
                    setReturnNotes('');
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting || 
                    selectedItemsToReturn.length === 0 ||
                    (returnType === 'exchange' && (!exchangeStock.items || exchangeStock.items.length === 0 || exchangeValue === 0))
                  }
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="animate-spin">⏳</span> Processing...
                    </>
                  ) : (
                    <>
                      {returnType === 'exchange' ? '🔄 Exchange & Settle' : '📦 Return Stock'}
                    </>
                  )}
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>

      {/* ✅ COMPLETELY NEW HISTORY MODAL */}
      <Modal
        isOpen={historyModal.show}
        onClose={() => {
          setHistoryModal({ show: false, sourceName: '', loading: false, borrows: [], returns: [] });
          setExpandedBorrows({});
        }}
        title={`📦 Borrow History: ${historyModal.sourceName}`}
      >
        {historyModal.loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ✅ OVERALL SUMMARY */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">⚖️ OVERALL SUMMARY</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 border-2 border-purple-200">
                  <p className="text-sm text-gray-600 mb-1">📥 Total Borrowed</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {historyModal.borrows.reduce((sum, b) => {
                      const quantities = b.quantities instanceof Map 
                        ? Object.fromEntries(b.quantities) 
                        : b.quantities;
                      return sum + Object.values(quantities).reduce((s, q) => s + (q || 0), 0);
                    }, 0)}
                  </p>
                  <p className="text-xs text-gray-500">units</p>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                  <p className="text-sm text-gray-600 mb-1">📤 Total Returned</p>
                  <p className="text-3xl font-bold text-green-600">
                    {historyModal.borrows.reduce((sum, b) => sum + (b.returnedQuantity || 0), 0)}
                  </p>
                  <p className="text-xs text-gray-500">units</p>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-orange-200">
                  <p className="text-sm text-gray-600 mb-1">🟠 Still With You</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {historyModal.borrows.reduce((sum, b) => {
                      const quantities = b.quantities instanceof Map 
                        ? Object.fromEntries(b.quantities) 
                        : b.quantities;
                      const borrowed = Object.values(quantities).reduce((s, q) => s + (q || 0), 0);
                      const returned = b.returnedQuantity || 0;
                      return sum + (borrowed - returned);
                    }, 0)}
                  </p>
                  <p className="text-xs text-gray-500">units</p>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-gray-300"></div>

            {/* ✅ ACTIVE BORROWS SECTION */}
            <div>
              <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
                🔴 ACTIVE BORROWS (Need to Return)
              </h3>
              
              {historyModal.borrows.filter(b => b.borrowStatus !== 'returned').length === 0 ? (
                <p className="text-gray-500 text-sm italic">No active borrows - all returned! ✅</p>
              ) : (
                <div className="space-y-4">
                  {historyModal.borrows
                    .filter(b => b.borrowStatus !== 'returned')
                    .map((borrow) => {
                      const quantities = borrow.quantities instanceof Map
                        ? Object.fromEntries(borrow.quantities)
                        : borrow.quantities;
                      
                      const totalQty = Object.values(quantities).reduce((sum, q) => sum + (Number(q) || 0), 0);
                      const returnedQty = borrow.returnedQuantity || 0;
                      const remainingQty = totalQty - returnedQty;

                      const returnedQuantities = borrow.returnedQuantities instanceof Map
                        ? Object.fromEntries(borrow.returnedQuantities)
                        : (borrow.returnedQuantities || {});

                      const isExpanded = expandedBorrows[borrow._id];
                      
                      return (
                        <div key={borrow._id} className="border-2 border-orange-300 rounded-lg p-5 bg-orange-50">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">
                                {borrow.borrowStatus === 'active' ? '🔵' : '🟡'}
                              </span>
                              <div>
                                <h4 className="text-lg font-bold text-gray-900">
                                  {borrow.design} - {borrow.color}
                                </h4>
                                {getBorrowStatusBadge(borrow.borrowStatus)}
                              </div>
                            </div>
                          </div>

                          {/* Borrowed Section */}
                          <div className="bg-white rounded-lg p-4 mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-semibold text-blue-700 flex items-center gap-2">
                                📥 BORROWED
                              </h5>
                              <button
                                onClick={() => setExpandedBorrows(prev => ({
                                  ...prev,
                                  [`${borrow._id}-borrowed`]: !prev[`${borrow._id}-borrowed`]
                                }))}
                                className="text-sm text-blue-600 hover:text-blue-800"
                              >
                                {expandedBorrows[`${borrow._id}-borrowed`] ? '▲ Hide Sizes' : '▼ Show Sizes'}
                              </button>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                              📅 Date: {format(new Date(borrow.receivedDate), 'dd MMM yyyy, hh:mm a')}
                            </p>
                            <p className="text-lg font-bold text-gray-900">Total: {totalQty} units</p>
                            
                            {expandedBorrows[`${borrow._id}-borrowed`] && (
                              <div className="grid grid-cols-5 gap-2 mt-3">
                                {enabledSizes.map(size => {
                                  const qty = quantities[size] || 0;
                                  return qty > 0 ? (
                                    <div key={size} className="bg-blue-50 px-2 py-1 rounded border text-center">
                                      <div className="text-xs text-gray-600">{size}</div>
                                      <div className="text-sm font-bold">{qty}</div>
                                    </div>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>

                          {/* Returned Section (if any) */}
                          {returnedQty > 0 && (
                            <div className="bg-white rounded-lg p-4 mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-semibold text-green-700 flex items-center gap-2">
                                  📤 RETURNED
                                </h5>
                                <button
                                  onClick={() => setExpandedBorrows(prev => ({
                                    ...prev,
                                    [`${borrow._id}-returned`]: !prev[`${borrow._id}-returned`]
                                  }))}
                                  className="text-sm text-green-600 hover:text-green-800"
                                >
                                  {expandedBorrows[`${borrow._id}-returned`] ? '▲ Hide Sizes' : '▼ Show Sizes'}
                                </button>
                              </div>
                              <p className="text-sm text-gray-600 mb-1">
                                📅 Date: {borrow.returnedDate ? format(new Date(borrow.returnedDate), 'dd MMM yyyy, hh:mm a') : 'Multiple dates'}
                              </p>
                              <p className="text-lg font-bold text-gray-900">Total: {returnedQty} units</p>
                              
                              {expandedBorrows[`${borrow._id}-returned`] && (
                                <div className="grid grid-cols-5 gap-2 mt-3">
                                  {enabledSizes.map(size => {
                                    const qty = returnedQuantities[size] || 0;
                                    return qty > 0 ? (
                                      <div key={size} className="bg-green-50 px-2 py-1 rounded border text-center">
                                        <div className="text-xs text-gray-600">{size}</div>
                                        <div className="text-sm font-bold">{qty}</div>
                                      </div>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Remaining Section */}
                          <div className="bg-orange-100 rounded-lg p-4 border-2 border-orange-300">
                            <h5 className="font-semibold text-orange-800 mb-2">⚠️ REMAINING TO RETURN</h5>
                            <p className="text-2xl font-bold text-orange-600 mb-3">{remainingQty} units</p>
                            
                            <div className="grid grid-cols-5 gap-2 mb-3">
                              {enabledSizes.map(size => {
                                const borrowed = quantities[size] || 0;
                                const returned = returnedQuantities[size] || 0;
                                const remaining = borrowed - returned;
                                return remaining > 0 ? (
                                  <div key={size} className="bg-white px-2 py-1 rounded border-2 border-orange-400 text-center">
                                    <div className="text-xs text-gray-600">{size}</div>
                                    <div className="text-sm font-bold text-orange-600">{remaining}</div>
                                  </div>
                                ) : null;
                              })}
                            </div>

                            {/* Quick Return Button */}
                            <button
                              onClick={() => {
                                setReturningReceipt({
                                  ...borrow,
                                  allBorrowedItems: [{
                                    design: borrow.design,
                                    color: borrow.color,
                                    receivingId: borrow._id,
                                    totalQuantity: remainingQty,
                                    sourceName: borrow.sourceName,
                                    quantities: Object.fromEntries(
                                      enabledSizes.map(size => {
                                        const borrowed = quantities[size] || 0;
                                        const returned = returnedQuantities[size] || 0;
                                        return [size, borrowed - returned];
                                      }).filter(([_, qty]) => qty > 0)
                                    )
                                  }]
                                });
                                setReturnQuantities({});
                                setReturnType('same');
                                setShowReturnModal(true);
                                setHistoryModal(prev => ({ ...prev, show: false }));
                              }}
                              className="w-full mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              Return This Stock
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="border-t-2 border-gray-300"></div>

            {/* ✅ COMPLETED RETURNS SECTION */}
            <div>
              <h3 className="text-xl font-bold text-green-600 mb-4 flex items-center gap-2">
                ✅ COMPLETED RETURNS
              </h3>
              
              {historyModal.borrows.filter(b => b.borrowStatus === 'returned').length === 0 ? (
                <p className="text-gray-500 text-sm italic">No completed returns yet.</p>
              ) : (
                <div className="space-y-3">
                  {historyModal.borrows
                    .filter(b => b.borrowStatus === 'returned')
                    .map((borrow) => {
                      const quantities = borrow.quantities instanceof Map
                        ? Object.fromEntries(borrow.quantities)
                        : borrow.quantities;
                      
                      const totalQty = Object.values(quantities).reduce((sum, q) => sum + (Number(q) || 0), 0);

                      return (
                        <div key={borrow._id} className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">✅</span>
                              <div>
                                <h4 className="font-bold text-gray-900">{borrow.design} - {borrow.color}</h4>
                                <p className="text-sm text-gray-600">
                                  Borrowed: {totalQty} units ({format(new Date(borrow.receivedDate), 'dd MMM yyyy')})
                                </p>
                                <p className="text-sm text-gray-600">
                                  Returned: {totalQty} units ({borrow.returnedDate ? format(new Date(borrow.returnedDate), 'dd MMM yyyy') : 'N/A'})
                                </p>
                              </div>
                            </div>
                            <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm font-semibold">
                              Fully Returned ✓
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FactoryReceiving;
