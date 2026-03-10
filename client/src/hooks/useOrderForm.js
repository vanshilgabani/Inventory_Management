import { useState, useEffect, useCallback } from 'react';
import { wholesaleService } from '../services/wholesaleService';
import { settingsService }  from '../services/settingsService';
import toast from 'react-hot-toast';

const EMPTY_ITEM = () => ({
  design: '', selectedColors: [], pricePerUnit: 0,
  colorData: {}, isCollapsed: false, isComplete: false
});

const EMPTY_FORM = {
  buyerName: '', buyerContact: '', buyerEmail: '',
  buyerAddress: '', businessName: '', gstNumber: '',
  deliveryDate: '', notes: '',
  discountType: 'none', discountValue: 0,
  gstEnabled: true, fulfillmentType: 'warehouse'
};

export const useOrderForm = ({
  editingOrder, products, enabledSizes, colors,
  getColorsForDesign, onSuccess, onBorrowNeeded, onUseLockNeeded
}) => {
  const [formData,   setFormData]   = useState(EMPTY_FORM);
  const [orderItems, setOrderItems] = useState([EMPTY_ITEM()]);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [gstPercentage, setGstPercentage] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [buyerFound, setBuyerFound] = useState(null);
  const [expandedItems,  setExpandedItems]  = useState({});
  const [expandedColors, setExpandedColors] = useState({});

  // Load GST percentage from settings on mount
  useEffect(() => {
    settingsService.getSettings?.()
      .then(s => { if (s?.gstPercentage) setGstPercentage(s.gstPercentage); })
      .catch(() => {});
  }, []);

  // Pre-fill when editing
  useEffect(() => {
    if (editingOrder) {
      setFormData({
        buyerName:      editingOrder.buyerName      || '',
        buyerContact:   editingOrder.buyerContact   || '',
        buyerEmail:     editingOrder.buyerEmail     || '',
        buyerAddress:   editingOrder.buyerAddress   || '',
        businessName:   editingOrder.businessName   || '',
        gstNumber:      editingOrder.gstNumber      || '',
        deliveryDate:   editingOrder.deliveryDate
                          ? editingOrder.deliveryDate.split('T')[0] : '',
        notes:          editingOrder.notes          || '',
        discountType:   editingOrder.discountType   || 'none',
        discountValue:  editingOrder.discountValue  || 0,
        gstEnabled:     editingOrder.gstEnabled     ?? true,
        fulfillmentType:editingOrder.fulfillmentType|| 'warehouse',
      });
      setGstEnabled(editingOrder.gstEnabled ?? true);

      // Rebuild orderItems from order's flat items
      const grouped = {};
      (editingOrder.items || []).forEach(item => {
        if (!grouped[item.design]) {
          grouped[item.design] = {
            design: item.design, selectedColors: [],
            pricePerUnit: item.pricePerUnit || 0,
            colorData: {}, isCollapsed: false, isComplete: true
          };
        }
        const d = grouped[item.design];
        if (!d.selectedColors.includes(item.color)) d.selectedColors.push(item.color);
        if (!d.colorData[item.color]) d.colorData[item.color] = {};
        d.colorData[item.color][item.size] = item.quantity;
      });
      setOrderItems(Object.values(grouped));
    } else {
      resetForm();
    }
  }, [editingOrder]); // eslint-disable-line

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setOrderItems([EMPTY_ITEM()]);
    setGstEnabled(true);
    setBuyerFound(null);
    setExpandedItems({});
    setExpandedColors({});
  };

  // ── Buyer lookup ─────────────────────────────────────────────
  const lookupBuyer = useCallback(async (mobile) => {
    if (mobile.length < 10) { setBuyerFound(null); return; }
    try {
      const buyer = await wholesaleService.getBuyerByMobile(mobile);
      if (buyer) {
        setBuyerFound(buyer);
        setFormData(prev => ({
          ...prev,
          buyerName:    buyer.name         || prev.buyerName,
          buyerEmail:   buyer.email        || prev.buyerEmail,
          buyerAddress: buyer.address      || prev.buyerAddress,
          businessName: buyer.businessName || prev.businessName,
          gstNumber:    buyer.gstNumber    || prev.gstNumber,
        }));
      }
    } catch { setBuyerFound(null); }
  }, []);

  // ── Item handlers ────────────────────────────────────────────
  const addItem = () => setOrderItems(prev => [...prev, EMPTY_ITEM()]);

  const removeItem = (idx) =>
    setOrderItems(prev => prev.length === 1 ? [EMPTY_ITEM()] : prev.filter((_, i) => i !== idx));

  const duplicateItem = (idx) => {
    const clone = JSON.parse(JSON.stringify(orderItems[idx]));
    clone.isCollapsed = false;
    setOrderItems(prev => {
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };

  const updateItem = (idx, updates) => {
    setOrderItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, ...updates } : item
    ));
  };

  const handleDesignChange = (idx, design) => {
    const availableColors = getColorsForDesign ? getColorsForDesign(design) : [];
    updateItem(idx, {
      design,
      selectedColors: [],
      colorData: {},
      isComplete: false,
    });
  };

  const toggleColor = (idx, color) => {
    const item = orderItems[idx];
    const already = item.selectedColors.includes(color);
    const selectedColors = already
      ? item.selectedColors.filter(c => c !== color)
      : [...item.selectedColors, color];
    const colorData = { ...item.colorData };
    if (already) delete colorData[color];
    else colorData[color] = {};
    updateItem(idx, { selectedColors, colorData });
  };

  const setQty = (itemIdx, color, size, qty) => {
    setOrderItems(prev => prev.map((item, i) => {
      if (i !== itemIdx) return item;
      return {
        ...item,
        colorData: {
          ...item.colorData,
          [color]: { ...(item.colorData[color] || {}), [size]: qty }
        }
      };
    }));
  };

  // ── Totals calculation ───────────────────────────────────────
  const calcTotals = useCallback(() => {
    const subtotal = orderItems.reduce((sum, item) => {
      const qty = Object.values(item.colorData).reduce((s, sizes) =>
        s + Object.values(sizes).reduce((ss, q) => ss + (Number(q) || 0), 0), 0);
      return sum + qty * (item.pricePerUnit || 0);
    }, 0);

    let discount = 0;
    if (formData.discountType === 'percentage')
      discount = subtotal * (formData.discountValue || 0) / 100;
    else if (formData.discountType === 'fixed')
      discount = Math.min(formData.discountValue || 0, subtotal);

    const taxable = subtotal - discount;
    const gstAmt  = gstEnabled ? taxable * gstPercentage / 100 : 0;
    const cgst    = gstAmt / 2;
    const sgst    = gstAmt / 2;
    const total   = taxable + gstAmt;

    return { subtotal, discount, taxable, gstAmt, cgst, sgst, total, gstPercentage };
  }, [orderItems, formData.discountType, formData.discountValue, gstEnabled, gstPercentage]);

  // ── Flatten items for API ─────────────────────────────────────
  const flattenItems = () => {
    const flat = [];
    orderItems.forEach(item => {
      Object.entries(item.colorData).forEach(([color, sizes]) => {
        Object.entries(sizes).forEach(([size, qty]) => {
          if (qty > 0) flat.push({
            design: item.design, color, size,
            quantity: Number(qty), pricePerUnit: item.pricePerUnit || 0
          });
        });
      });
    });
    return flat;
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async (extraData = {}) => {
    if (!formData.buyerContact) { toast.error('Buyer contact is required'); return; }
    const items = flattenItems();
    if (!items.length) { toast.error('Add at least one item with quantity'); return; }

    const totals = calcTotals();
    const payload = {
      ...formData,
      items,
      subtotalAmount: totals.subtotal,
      discountAmount: totals.discount,
      gstEnabled,
      gstAmount:  totals.gstAmt,
      cgst:       totals.cgst,
      sgst:       totals.sgst,
      totalAmount: totals.total,
      ...extraData
    };

    setSubmitting(true);
    try {
      let result;
      if (editingOrder) {
        result = await wholesaleService.updateOrder(editingOrder._id, payload);
        toast.success('Order updated successfully!');
      } else {
        result = await wholesaleService.createOrder(payload);
        toast.success('Order created successfully!');
      }
      onSuccess?.(result);
      resetForm();
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'MAIN_INSUFFICIENT_BORROW_RESERVED') {
        onBorrowNeeded?.(err.response.data, payload);
      } else if (code === 'LOCK_STOCK_AVAILABLE') {
        onUseLockNeeded?.(err.response.data, payload);
      } else {
        toast.error(err?.response?.data?.message || 'Failed to save order');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBorrowConfirm = async (pendingPayload) => {
    setSubmitting(true);
    try {
      const result = await wholesaleService.createOrderWithReservedBorrow(pendingPayload);
      toast.success('Order created with reserved borrow!');
      onSuccess?.(result);
      resetForm();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Borrow failed');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    formData, setFormData,
    orderItems, setOrderItems,
    gstEnabled, setGstEnabled,
    gstPercentage,
    submitting,
    buyerFound, setBuyerFound,
    expandedItems, setExpandedItems,
    expandedColors, setExpandedColors,
    // handlers
    lookupBuyer,
    addItem, removeItem, duplicateItem, updateItem,
    handleDesignChange, toggleColor, setQty,
    calcTotals, flattenItems,
    handleSubmit, handleBorrowConfirm,
    resetForm,
  };
};
