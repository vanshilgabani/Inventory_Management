import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import DraftsListModal from './DraftsListModal';
import Modal from '../../common/Modal';
import { wholesaleService } from '../../../services/wholesaleService';
import { debounce } from '../../../utils/debounce';
import toast from 'react-hot-toast';
import {
  FiPlus, FiTrash2, FiCopy, FiChevronDown, FiChevronRight, FiCheckCircle
} from 'react-icons/fi';
import { useColorPalette } from '../../../hooks/useColorPalette';
import { useEnabledSizes } from '../../../hooks/useEnabledSizes';

// ✅ Convert hex color to subtle rgba background
const hexToRgba = (hex = '#6b7280', alpha = 0.08) => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r)) return `rgba(107,114,128,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
};

// ── Convert flat DB items → grouped form items ─────────────────
const flatToGrouped = (flatItems, enabledSizes, getSizesForDesign) => {
  const map = {};
  flatItems.forEach(item => {
    if (!map[item.design]) {
      const itemSizes = getSizesForDesign ? getSizesForDesign(item.design) : enabledSizes;
      const pieces = {};
      itemSizes.forEach(s => { pieces[s] = 0; });
      map[item.design] = {
        design: item.design, pricePerUnit: item.pricePerUnit,
        selectedColors: [], colorData: {}, isCollapsed: false, isComplete: true,
      };
    }
    const g = map[item.design];
    if (!g.selectedColors.includes(item.color)) {
      g.selectedColors.push(item.color);
      const itemSizes = getSizesForDesign ? getSizesForDesign(item.design) : enabledSizes;
      const pieces = {};
      itemSizes.forEach(s => { pieces[s] = 0; });
      g.colorData[item.color] = { mode: 'pieces', sets: 0, pieces };
    }
    if (g.colorData[item.color]?.pieces)
      g.colorData[item.color].pieces[item.size] = item.quantity;
  });
  return Object.values(map);
};

const emptyItem = () => ({
  design: '', selectedColors: [], pricePerUnit: 0,
  colorData: {}, isCollapsed: false, isComplete: false,
});


const EMPTY_FORM = {
  buyerName: '', buyerContact: '', buyerEmail: '', buyerAddress: '',
  businessName: '', gstNumber: '', deliveryDate: '', notes: '',
  discountType: 'none', discountValue: 0, fulfillmentType: 'warehouse',
};

export default function OrderFormModal({
  show, editingOrder,
  products, autoOpenDrafts, enabledSizes, prefillItems = null,
  gstPercentage: gstPct = 5,
  savedDrafts, currentDraftId,
  saveDraft, deleteDraft, clearAllDrafts,
  onShowDrafts, onShowBuyerList,
  onSuccess, onBorrowNeeded, onUseLockNeeded, onClose,
}) {
  // ✅ Color palette from hook directly
  const { getColorCode, getColorsForDesign, colors: paletteColors } = useColorPalette();
  const { getSizesForDesign } = useEnabledSizes(); 

  const [formData,     setFormData]     = useState({ ...EMPTY_FORM });
  const [orderItems,   setOrderItems]   = useState([emptyItem()]);
  const [searchMobile, setSearchMobile] = useState('');
  const [buyerFound,   setBuyerFound]   = useState(null);
  const [gstEnabled,   setGstEnabled]   = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [showDrafts, setShowDrafts] = useState(false); 
  const [lastAddedColor, setLastAddedColor] = useState(null); 

// ✅ Refs — inside component
const firstDesignRef   = useRef(null);
const summaryBarRef    = useRef(null);
const lastItemRef     = useRef(null);  

const scrollToDesign = () => {
  setTimeout(() => {
    if (!lastItemRef.current || !firstDesignRef.current) return;

    const target    = lastItemRef.current;
    const stickyBar = summaryBarRef.current;
    const stickyH   = stickyBar ? stickyBar.getBoundingClientRect().height + 16 : 100;

    // Find modal's scrollable container
    let parent = target.parentElement;
    while (parent) {
      const overflow = window.getComputedStyle(parent).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') break;
      parent = parent.parentElement;
    }

    if (parent) {
      const targetTop  = target.getBoundingClientRect().top;
      const parentTop  = parent.getBoundingClientRect().top;
      const parentH    = parent.getBoundingClientRect().height;
      const targetH    = target.getBoundingClientRect().height;

      // ✅ Center the new item in the visible area between sticky bar and footer
      const visibleH   = parentH - stickyH - 80; // 80 = approx footer height
      const centerOffset = (visibleH - targetH) / 2;
      const offset = targetTop - parentTop + parent.scrollTop - stickyH - Math.max(0, centerOffset);

      parent.scrollTo({ top: offset, behavior: 'smooth' });
    }

    setTimeout(() => firstDesignRef.current?.focus(), 400);
  }, 150);
};

const scrollToColorSection = (idx) => {
  setTimeout(() => {
    // Find modal's scrollable parent via summaryBarRef
    let parent = summaryBarRef.current?.parentElement;
    while (parent) {
      const overflow = window.getComputedStyle(parent).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') break;
      parent = parent.parentElement;
    }
    if (!parent) return;

    const colorSection = parent.querySelector(`[data-color-section="${idx}"]`);
    if (!colorSection) return;

    const targetBottom = colorSection.getBoundingClientRect().bottom;
    const parentBottom = parent.getBoundingClientRect().bottom;
    const footerH = 88; // sticky footer height + gap

    // Only scroll if colors section is hidden behind footer
    if (targetBottom > parentBottom - footerH) {
      const overlap = targetBottom - (parentBottom - footerH);
      parent.scrollTo({ top: parent.scrollTop + overlap + 20, behavior: 'smooth' });
    }
  }, 200); // wait for colors to render after design selection
};

const scrollToColorInput = (idx) => {
  setTimeout(() => {
    let parent = summaryBarRef.current?.parentElement;
    while (parent) {
      const overflow = window.getComputedStyle(parent).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') break;
      parent = parent.parentElement;
    }
    if (!parent) return;

    // Color pills row — we want this at the TOP of visible area
    const colorSection = parent.querySelector(`[data-color-section="${idx}"]`);
    if (!colorSection) return;

    const stickyH    = summaryBarRef.current
      ? summaryBarRef.current.getBoundingClientRect().height + 16
      : 100;
    const parentRect = parent.getBoundingClientRect();

    // Scroll so color pills sit just below the sticky summary bar
    const colorTop  = colorSection.getBoundingClientRect().top;
    const newScroll = colorTop - parentRect.top + parent.scrollTop - stickyH - 12;

    parent.scrollTo({ top: newScroll, behavior: 'smooth' });
  }, 100); // 100ms — wait for prepended card to render
};

  // ── Populate on open ─────────────────────────────────────────
  useEffect(() => {
    if (!show) return;

    if (editingOrder) {
      setFormData({
        buyerName:       editingOrder.buyerName || '',
        buyerContact:    editingOrder.buyerContact || '',
        buyerEmail:      editingOrder.buyerEmail || '',
        buyerAddress:    editingOrder.buyerAddress || '',
        businessName:    editingOrder.businessName || '',
        gstNumber:       editingOrder.gstNumber || '',
        deliveryDate:    editingOrder.deliveryDate ? editingOrder.deliveryDate.split('T')[0] : '',
        notes:           editingOrder.notes || '',
        discountType:    editingOrder.discountType || 'none',
        discountValue:   editingOrder.discountValue || 0,
        fulfillmentType: editingOrder.fulfillmentType || 'warehouse',
      });
      setSearchMobile(editingOrder.buyerContact || '');
      setGstEnabled(editingOrder.gstEnabled !== false);

      if (editingOrder.items?.length > 0 && enabledSizes?.length > 0)
        setOrderItems(flatToGrouped(editingOrder.items, enabledSizes, getSizesForDesign));

      // ✅ FIX 1 — show buyer compact card in edit mode
      if (editingOrder.buyerContact) {
        setBuyerFound({
          mobile:      editingOrder.buyerContact,
          name:        editingOrder.buyerName,
          creditLimit: editingOrder.creditLimit || 0,
          totalDue:    editingOrder.totalDue || 0,
        });
      }

      // ✅ FIX 2 — scroll to Order Items after modal opens + items render
      setTimeout(() => scrollToDesign(), 400);

    } else {
      setFormData({ ...EMPTY_FORM });
      setOrderItems(prefillItems?.length > 0 ? prefillItems : [emptyItem]);
      setSearchMobile('');
      setBuyerFound(null);
      setGstEnabled(true);
      setSubmitting(false);
    }
  }, [show, editingOrder]);

// ── Auto-open drafts panel when triggered from WholesaleHeader ──
useEffect(() => {
  if (!show || !autoOpenDrafts) return;
  if (savedDrafts?.length > 0) {
    setShowDrafts(true);                   // ✅ opens the INTERNAL DraftsListModal
  }
}, [show, autoOpenDrafts]);

  // ── Mobile lookup ────────────────────────────────────────────
const debouncedLookup = useMemo(() => debounce(async (mobile) => {
  if (mobile.length !== 10) { setBuyerFound(null); return; }
  try {
    const buyer = await wholesaleService.getBuyerByMobile(mobile);
    setBuyerFound(buyer);
    setFormData(prev => ({
      ...prev,
      buyerName:    buyer.name         || prev.buyerName,
      buyerEmail:   buyer.email        || prev.buyerEmail,
      buyerAddress: buyer.address      || prev.buyerAddress,
      businessName: buyer.businessName || prev.businessName,
      gstNumber:    buyer.gstNumber    || prev.gstNumber,
    }));
    toast.success('Buyer found!');

    // ✅ Scroll to first design input
    scrollToDesign();   
  } catch {
    setBuyerFound(null);
    toast('New buyer – fill in details', { icon: '📝' });
  }
}, 500), []);


  useEffect(() => {
    if (searchMobile && !editingOrder) debouncedLookup(searchMobile);
  }, [searchMobile]);


  // ── Buyer selected from BuyerListModal ───────────────────────
  useEffect(() => {
  const handler = e => {
    const b = e.detail;
    setBuyerFound(b);
    setSearchMobile(b.mobile || '');
    setFormData(prev => ({
      ...prev,
      buyerName:    b.name         || '',
      buyerContact: b.mobile       || '',
      buyerEmail:   b.email        || '',
      buyerAddress: b.address      || '',
      businessName: b.businessName || '',
      gstNumber:    b.gstNumber    || '',
    }));

    // ✅ Scroll to first design input after buyer selected
    scrollToDesign();   
  };
  window.addEventListener('buyerSelected', handler);
  return () => window.removeEventListener('buyerSelected', handler);
}, []);


  // ── Keyboard shortcuts ───────────────────────────────────────
  useEffect(() => {
    if (!show) return;
    const handler = e => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') { e.preventDefault(); handleAddItem(); toast.success('Item added!'); }
      if (e.ctrlKey && e.key === 's')                { e.preventDefault(); saveDraft?.(formData, orderItems, gstEnabled); toast.success('Draft saved!'); }
      if (e.key === 'Escape')                         { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [show, formData, orderItems, gstEnabled]);


  // ── Auto-save ────────────────────────────────────────────────
  useEffect(() => {
    if (!show || editingOrder) return;
    const t = setInterval(() => saveDraft?.(formData, orderItems, gstEnabled), 30000);
    return () => clearInterval(t);
  }, [show, formData, orderItems, gstEnabled, editingOrder]);


  // ── Helpers ──────────────────────────────────────────────────
  const getColorQty = (cd, sizes) => {
    if (!cd) return {};
    if (cd.mode === 'sets') return (sizes || []).reduce((a, s) => ({ ...a, [s]: Number(cd.sets) || 0 }), {});
    return cd.pieces || {};
  };

  const getStock = (design, color, size) => {
    const p  = products.find(p => p.design === design); if (!p) return 0;
    const cv = p.colors.find(c => c.color === color);   if (!cv) return 0;
    const s  = cv.sizes.find(s => s.size === size);
    return s?.currentStock || 0;
  };


  const getTotalPieces = item => {
    if (!item?.selectedColors?.length) return 0;
    return item.selectedColors.reduce((t, color) => {
      const cd  = item.colorData?.[color];
      if (!cd) return t;
      const sizes = getSizesForDesign?.(item.design) || enabledSizes || [];
      const qty   = getColorQty(cd, sizes);
      if (!qty) return t;
      return t + Object.values(qty).reduce((s, q) => s + Number(q || 0), 0);
    }, 0);
  };

  const calcTotals = useCallback(() => {
    let subtotal = 0;
    orderItems.forEach(item => {
      if (!item.design) return;
      item.selectedColors.forEach(color => {
        const qty = getColorQty(item.colorData[color], getSizesForDesign(item.design) || enabledSizes || []);
        Object.values(qty).forEach(q => { subtotal += (Number(q) || 0) * (item.pricePerUnit || 0); });
      });
    });
    let discountAmount = 0;
    if (formData.discountType === 'percentage')
      discountAmount = subtotal * (Number(formData.discountValue) || 0) / 100;
    else if (formData.discountType === 'fixed')
      discountAmount = Math.min(Number(formData.discountValue) || 0, subtotal);
    const taxable   = subtotal - discountAmount;
    const gstAmount = gstEnabled ? (taxable * gstPct / 100) : 0;
    return { subtotal, discountAmount, gstAmount, total: taxable + gstAmount };
  }, [orderItems, formData.discountType, formData.discountValue, gstEnabled, gstPct, enabledSizes]);


  // ── Item management ──────────────────────────────────────────
const handleAddItem = () => {
  setOrderItems(prev => {
    const upd  = [...prev];
    const last = upd[upd.length - 1];
    if (last && last.design && last.selectedColors.length > 0)
      upd[upd.length - 1] = { ...last, isCollapsed: true, isComplete: true };
    return [...upd, emptyItem()];
  });

  // ✅ Scroll to the new item's design select after it renders
  scrollToDesign();
};

  const handleRemoveItem = idx => {
    setOrderItems(prev => {
      const upd = prev.filter((_, i) => i !== idx);
      return upd.length === 0 ? [emptyItem()] : upd;
    });
  };


  const duplicateItem = idx => {
    setOrderItems(prev => {
      const copy = JSON.parse(JSON.stringify(prev[idx]));
      copy.design = ''; copy.isCollapsed = false; copy.isComplete = false;
      const upd  = [...prev];
      upd.splice(idx + 1, 0, copy);
      return upd;
    });
    toast.success('Item duplicated!');
  };


  const toggleCollapse = idx =>
    setOrderItems(prev => prev.map((item, i) => i === idx ? { ...item, isCollapsed: !item.isCollapsed } : item));


  const handleDesignChange = (idx, value) => {
    const product        = products.find(p => p.design === value);
    const wholesalePrice = product?.colors?.[0]?.wholesalePrice || 0;
    setOrderItems(prev => prev.map((item, i) =>
      i !== idx ? item : { ...item, design: value, pricePerUnit: wholesalePrice, selectedColors: [], colorData: {}, isCollapsed: false, isComplete: false }
    ));
    if (wholesalePrice > 0) toast.success(`Price auto-filled ₹${wholesalePrice}/pc`, { duration: 2000 });
    if (value) scrollToColorSection(idx);
  };


  const handleColorToggle = (idx, color) => {
    setOrderItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      if (item.selectedColors.includes(color)) {
        // Deselecting — remove it
        const { [color]: _, ...rest } = item.colorData;
        return { ...item, selectedColors: item.selectedColors.filter(c => c !== color), colorData: rest };
      }
      // ✅ Selecting — PREPEND so latest is always on top
      const pieces = {};
      (getSizesForDesign(item.design) || enabledSizes || []).forEach(s => { pieces[s] = 0; });
      return {
        ...item,
        selectedColors: [color, ...item.selectedColors],   // ✅ prepend
        colorData: { ...item.colorData, [color]: { mode: 'pieces', sets: 0, pieces } },
      };
  }));

  // ✅ Flash animation on new color card
  setLastAddedColor(color);
  setTimeout(() => setLastAddedColor(null), 600);
  scrollToColorInput(idx);
};


  const setItemField = (idx, field, value) =>
    setOrderItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, [field]: value }));


  const setColorField = (idx, color, field, value) =>
    setOrderItems(prev => prev.map((item, i) =>
      i !== idx ? item
        : { ...item, colorData: { ...item.colorData, [color]: { ...item.colorData[color], [field]: value } } }
    ));


  const setPiecesField = (idx, color, size, value) =>
    setOrderItems(prev => prev.map((item, i) =>
      i !== idx ? item : {
        ...item,
        colorData: {
          ...item.colorData,
          [color]: { ...item.colorData[color], pieces: { ...item.colorData[color]?.pieces, [size]: Number(value) || 0 } },
        },
      }
    ));


  // ✅ FIXED
  const handleModeChange = (idx, color, mode) => {
    setOrderItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const itemSizes = getSizesForDesign(item.design) || enabledSizes || [];
      const pieces = {};
      itemSizes.forEach(s => { pieces[s] = 0; });
      return { ...item, colorData: { ...item.colorData, [color]: { mode, sets: 0, pieces } } };
    }));
  };


  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    const flatItems = [];
    for (const item of orderItems) {
      if (!item.design) continue;
      for (const color of item.selectedColors) {
        const qty = getColorQty(item.colorData[color], getSizesForDesign(item.design) || enabledSizes || []);
        for (const size of (getSizesForDesign(item.design) || enabledSizes || [])) {
          const q = Number(qty[size]) || 0;
          if (q > 0) flatItems.push({ design: item.design, color, size, quantity: q, pricePerUnit: item.pricePerUnit });
        }
      }
    }
    if (flatItems.length === 0) {
      toast.error('Add at least one item with quantity!');
      setSubmitting(false); return;
    }
    const { subtotal, discountAmount, gstAmount, total } = calcTotals();
    const payload = {
      ...formData,
      buyerContact: searchMobile || formData.buyerContact,
      items: flatItems,
      subtotalAmount: subtotal, discountAmount,
      gstEnabled, gstAmount, totalAmount: total,
      amountPaid: 0, amountDue: total,
    };
    try {
      if (editingOrder) {
        await wholesaleService.updateOrder(editingOrder._id, payload);
        toast.success('Order updated!');
      } else {
        await wholesaleService.createOrder(payload);
        toast.success('Order created!');
      }
      onSuccess?.();
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'MAIN_INSUFFICIENT_BORROW_RESERVED') {
        setSubmitting(false); onBorrowNeeded?.(err.response.data, payload); return;
      }
      if (code === 'USE_LOCK_NEEDED') {
        setSubmitting(false); onUseLockNeeded?.(err.response.data, payload); return;
      }
      toast.error(err?.response?.data?.message || 'Failed to save order');
    } finally { setSubmitting(false); }
  };


  if (!show) return null;

  const totals = calcTotals();
  const totalPieces = orderItems.reduce((s, item) => s + getTotalPieces(item), 0);

  return (
    <Modal
      isOpen={show}
      onClose={onClose}
      title={editingOrder ? `Edit — ${editingOrder.challanNumber}` : 'Create Wholesale Order'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Sticky Summary ── */}
        <div ref={summaryBarRef}className="sticky top-0 z-20 -mx-0 px-6 pt-3 pb-2 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
            <div>
            <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
                Live Summary
                {/* ✅ Show business/buyer name when buyer is selected */}
                {buyerFound && (
                <span className="normal-case text-indigo-400 font-medium ml-1">
                    · {formData.businessName || formData.buyerName}
                </span>
                )}
            </h3>
            </div>
            {!editingOrder && (
            <div className="flex gap-2">
                {savedDrafts?.length > 0 && (
                <button type="button" onClick={() => setShowDrafts(true)}
                    className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200">
                    📋 {savedDrafts.length} Draft{savedDrafts.length !== 1 ? 's' : ''}
                </button>
                )}
                <button type="button" onClick={() => saveDraft?.(formData, orderItems, gstEnabled)}
                className="text-xs px-2 py-1 bg-white border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-50">
                💾 Save Draft
                </button>
            </div>
            )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            {[
            ['Subtotal', `₹${totals.subtotal.toLocaleString('en-IN')}`,         'text-gray-900'],
            ['Discount', `-₹${totals.discountAmount.toLocaleString('en-IN')}`,  'text-red-500'],
            ['GST',      `+₹${totals.gstAmount.toFixed(2)}`,                    'text-yellow-600'],
            ['TOTAL',    `₹${totals.total.toLocaleString('en-IN')}`,            'text-indigo-700 text-base font-extrabold'],
            ['Qty',      `${totalPieces} pcs`,                                  'text-gray-900'],
            ].map(([label, val, cls]) => (
            <div key={label}>
                <div className="text-xs text-gray-400">{label}</div>
                <div className={`font-semibold ${cls}`}>{val}</div>
            </div>
            ))}
        </div>
        </div>

        {/* ── Buyer Details ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">

        {/* ✅ When buyer NOT yet selected — show full search + form */}
        {!buyerFound ? (
            <>
            <h3 className="text-base font-semibold text-gray-900 mb-4">👤 Buyer Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Mobile search */}
                <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
                <div className="flex gap-2">
                    <input
                    type="text" value={searchMobile} maxLength={10} required
                    onChange={e => { setSearchMobile(e.target.value); setFormData(p => ({ ...p, buyerContact: e.target.value })); }}
                    placeholder="Enter 10-digit mobile"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button type="button" onClick={onShowBuyerList}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm whitespace-nowrap">
                    Browse Buyers
                    </button>
                </div>
                </div>

                {[
                ['buyerName',    'Full Name *',   'text',  true],
                ['businessName', 'Business Name', 'text',  false],
                ['buyerEmail',   'Email',         'email', false],
                ['gstNumber',    'GST Number',    'text',  false],
                ].map(([field, label, type, required]) => (
                <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input type={type} value={formData[field]} required={required}
                    onChange={e => setFormData(p => ({ ...p, [field]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                ))}

                <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea value={formData.buyerAddress} rows={2}
                    onChange={e => setFormData(p => ({ ...p, buyerAddress: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
                </div>

                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
                <input type="date" value={formData.deliveryDate}
                    onChange={e => setFormData(p => ({ ...p, deliveryDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
                </div>

                {/* Fulfillment when no buyer */}
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fulfillment Type</label>
                <div className="flex gap-4 mt-2">
                    {[['warehouse','🏬 Warehouse'],['factorydirect','🏭 Factory Direct']].map(([val, label]) => (
                    <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" value={val} checked={formData.fulfillmentType === val}
                        onChange={e => setFormData(p => ({ ...p, fulfillmentType: e.target.value }))} />
                        <span className="text-sm">{label}</span>
                    </label>
                    ))}
                </div>
                </div>
            </div>
            </>
        ) : (
            /* ✅ Buyer selected — show compact card, hide full form */
            <>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">👤 Buyer</h3>
                <button
                type="button"
                onClick={() => { setBuyerFound(null); setSearchMobile(''); setFormData(p => ({ ...p, buyerName: '', buyerContact: '', buyerEmail: '', buyerAddress: '', businessName: '', gstNumber: '' })); }}
                className="text-xs px-3 py-1.5 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50"
                >
                ✏️ Change Buyer
                </button>
            </div>

            {/* Buyer info strip */}
            <div className="flex items-center gap-4 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                {(formData.buyerName?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm">{formData.buyerName}</div>
                {formData.businessName && (
                    <div className="text-xs text-indigo-600 font-medium">{formData.businessName}</div>
                )}
                <div className="text-xs text-gray-400">{formData.buyerContact}{formData.gstNumber ? ` · GST: ${formData.gstNumber}` : ''}</div>
                </div>
                {buyerFound?.creditLimit > 0 && (
                <div className="text-right flex-shrink-0">
                    <div className="text-xs text-gray-400">Credit Left</div>
                    <div className="text-sm font-semibold text-green-600">
                    ₹{Math.max(0, buyerFound.creditLimit - (buyerFound.totalDue || 0)).toLocaleString('en-IN')}
                    </div>
                </div>
                )}
            </div>

            {/* ✅ Fulfillment type — always visible even when buyer is selected */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fulfillment Type</label>
                <div className="flex gap-3">
                {[['warehouse','🏬 Warehouse'],['factorydirect','🏭 Factory Direct']].map(([val, label]) => (
                    <label
                    key={val}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-medium transition-all ${
                        formData.fulfillmentType === val
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                    >
                    <input
                        type="radio" value={val}
                        checked={formData.fulfillmentType === val}
                        onChange={e => setFormData(p => ({ ...p, fulfillmentType: e.target.value }))}
                        className="hidden"
                    />
                    {label}
                    </label>
                ))}
                </div>
            </div>
            </>
        )}
        </div>

        {/* ── Order Items ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">
              📦 Order Items
              <span className="ml-2 text-sm font-normal text-gray-400">
                {orderItems.length} item{orderItems.length !== 1 ? 's' : ''} · {totalPieces} pcs
              </span>
            </h3>
            <span className="text-xs text-gray-400 hidden md:block">Ctrl+Shift+A to add</span>
          </div>

          <div className="space-y-4">
            {orderItems.map((item, idx) => (
              <div key={idx} ref={idx === orderItems.length - 1 ? lastItemRef : null} className={`border-2 rounded-xl overflow-hidden ${item.isComplete ? 'border-green-200' : 'border-gray-200'}`}>

                {/* Item header */}
                <div className={`flex items-center justify-between px-4 py-3 ${item.isComplete ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => toggleCollapse(idx)} className="text-gray-400">
                      {item.isCollapsed ? <FiChevronRight /> : <FiChevronDown />}
                    </button>
                    <span className="font-bold text-gray-600 text-sm">#{idx + 1}</span>
                    {item.design && <span className="text-indigo-700 font-semibold text-sm">{item.design}</span>}
                    {item.isComplete && <FiCheckCircle className="text-green-500" size={14} />}
                    {item.design && (
                      <span className="text-xs text-gray-400">
                        {getTotalPieces(item)} pcs · ₹{(getTotalPieces(item) * item.pricePerUnit).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => duplicateItem(idx)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 rounded" title="Duplicate">
                      <FiCopy size={13} />
                    </button>
                    <button type="button" onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Remove">
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Collapsed preview */}
                {item.isCollapsed && item.isComplete && (
                  <div className="px-4 py-2 bg-white flex flex-wrap gap-2">
                    {item.selectedColors.map(color => {
                      const itemSizes = getSizesForDesign(item.design) || enabledSizes || []; 
                      const qty   = getColorQty(item.colorData[color], itemSizes);
                      const total = Object.values(qty).reduce((s, q) => s + q, 0);
                      return (
                        <span key={color} className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: getColorCode(color) }} />
                          {color} · <strong>{total}</strong> pcs
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Expanded body */}
                {!item.isCollapsed && (
                  <div className="p-4 space-y-4 bg-white">

                    {/* Design + Price */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Design *</label>
                        <select value={item.design} required
                        ref={idx === orderItems.length - 1 ? firstDesignRef : null}
                          onChange={e => handleDesignChange(idx, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
                          <option value="">Select design...</option>
                          {products.map(p => <option key={p.design} value={p.design}>{p.design}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price per unit (₹) *</label>
                        <input type="number" min="0" required value={item.pricePerUnit || ''}
                          onChange={e => setItemField(idx, 'pricePerUnit', Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* ✅ Colors — bigger pills with real color dots from hook */}
                    {item.design && (
                      <div data-color-section={idx}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Colors
                          {item.selectedColors.length > 0 && (
                            <span className="ml-2 text-xs font-normal text-indigo-500">
                              {item.selectedColors.length} selected
                            </span>
                          )}
                        </label>
                        <div className="flex flex-wrap gap-2.5">
                          {(getColorsForDesign(item.design)?.length > 0
                            ? getColorsForDesign(item.design)
                            : paletteColors
                          ).map(c => {
                            const name       = typeof c === 'string' ? c : c.colorName;
                            const code       = getColorCode(name);
                            const isSelected = item.selectedColors.includes(name);
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => handleColorToggle(idx, name)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all shadow-sm ${
                                  isSelected
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800 shadow-indigo-100'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <span
                                  className="w-5 h-5 rounded-full border-2 border-white shadow flex-shrink-0"
                                  style={{ backgroundColor: code }}
                                />
                                {name}
                                {isSelected && (
                                  <FiCheckCircle size={13} className="text-indigo-500 ml-0.5" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Quantities per color */}
                    {(item.selectedColors?.length > 0) && (
                      <div className="space-y-3" data-qty-section={idx}>
                        {item.selectedColors.map(color => {
                          const itemSizes = getSizesForDesign(item.design) || enabledSizes || [];
                          const cd        = item.colorData[color] || { mode: 'pieces', sets: 0, pieces: {} };
                          const qtyTotal  = Object.values(getColorQty(cd, itemSizes)).reduce((s, q) => s + q, 0);
                          const colorHex  = getColorCode(color);
                          const isNew     = lastAddedColor === color;

                          return (
                            <div
                              key={color}
                              className="border rounded-lg p-3 transition-colors"
                              style={{
                                backgroundColor: hexToRgba(colorHex, 0.07),
                                borderColor:     hexToRgba(colorHex, 0.35),
                                animation:       isNew ? 'colorSlideIn 0.3s ease-out' : undefined,
                                boxShadow:       isNew ? `0 0 0 2px ${hexToRgba(colorHex, 0.5)}` : undefined,
                              }}
                            >
                              {/* Color header */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-4 h-4 rounded-full border border-white shadow-sm"
                                    style={{ background: colorHex }}
                                  />
                                  <span className="font-medium text-gray-800">{color}</span>
                                  <span className="text-xs text-gray-400">{qtyTotal} pcs</span>
                                </div>
                                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                                  {['pieces', 'sets'].map(m => (
                                    <button key={m} type="button" onClick={() => handleModeChange(idx, color, m)}
                                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                                        cd.mode === m ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                                      }`}>
                                      {m === 'pieces' ? 'Pieces' : 'Sets'}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {cd.mode === 'sets' ? (
                                <div className="flex items-center gap-3">
                                  <span className="text-sm text-gray-500">Sets (each size gets same qty)</span>
                                  <input
                                    type="number" min="0" value={cd.sets || ''}
                                    onChange={e => setColorField(idx, color, 'sets', Number(e.target.value) || 0)}
                                    className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-center focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                    placeholder="0"
                                  />
                                  <span className="text-xs text-gray-400">
                                    × {itemSizes?.length || 0} · {cd.sets || 0} × {itemSizes?.length || 0} pcs
                                  </span>
                                </div>
                              ) : (
                                <div
                                  className="grid gap-2"
                                  style={{ gridTemplateColumns: `repeat(${Math.min(itemSizes?.length || 1, 7)}, minmax(0, 1fr))` }}
                                >
                                  {(itemSizes || []).map(size => {
                                    const stock = getStock(item.design, color, size);
                                    const qty   = Number(cd.pieces?.[size]) || 0;
                                    const over  = qty > stock && formData.fulfillmentType === 'warehouse';
                                    return (
                                      <div key={size} className="text-center">
                                        <div className="text-xs text-gray-500 mb-1 font-medium">{size}</div>
                                        <input
                                          type="number" min="0" value={qty || ''}
                                          onChange={e => setPiecesField(idx, color, size, e.target.value)}
                                          className={`w-full px-1 py-1.5 border rounded-lg text-center text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white ${
                                            over ? 'border-red-400 bg-red-50' : 'border-gray-300'
                                          }`}
                                          placeholder="0"
                                        />
                                        {formData.fulfillmentType === 'warehouse' && (
                                          <div className={`text-xs mt-0.5 ${over ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                                            Stock: {stock}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add item button */}
          <button type="button" onClick={handleAddItem}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-sm font-medium">
            <FiPlus /> Add Another Design
          </button>
        </div>

        {/* ── Discount & GST ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">💰 Pricing Options</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
              <select value={formData.discountType}
                onChange={e => setFormData(p => ({ ...p, discountType: e.target.value, discountValue: 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
                <option value="none">No Discount</option>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </div>
            {formData.discountType !== 'none' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Value {formData.discountType === 'percentage' ? '(%)' : '(₹)'}
                </label>
                <input type="number" min="0" value={formData.discountValue || ''}
                  onChange={e => setFormData(p => ({ ...p, discountValue: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0"
                />
              </div>
            )}
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={gstEnabled} onChange={e => setGstEnabled(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded" />
                <span className="text-sm font-medium text-gray-700">GST ({gstPct}%)</span>
              </label>
            </div>
          </div>

          {/* Totals */}
          <div className="mt-4 bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold">₹{totals.subtotal.toLocaleString('en-IN')}</span>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Discount</span>
                <span>−₹{totals.discountAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
            {gstEnabled && totals.gstAmount > 0 && (
              <div className="flex justify-between text-yellow-600">
                <span>GST ({gstPct}%)</span>
                <span>+₹{totals.gstAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2">
              <span>TOTAL</span>
              <span className="text-indigo-700">₹{totals.total.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* ── Notes ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-3">📝 Notes</h3>
          <textarea value={formData.notes} rows={3}
            onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
            placeholder="Special instructions, delivery notes..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* ── Submit ── */}
        <div className="flex gap-3 sticky bottom-0 bg-white pt-4 pb-4 border-t border-gray-200 -mx-6 px-6 -mb-6">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="flex-[2] px-4 py-3 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? '⏳ Saving...' : editingOrder ? '💾 Update Order' : '✅ Create Order'}
          </button>
        </div>

      </form>
      <DraftsListModal
      show={showDrafts}
      drafts={savedDrafts || []}
      onLoad={draft => {
        setFormData(draft.formData);
        setOrderItems(draft.orderItems);
        setGstEnabled(draft.gstEnabled ?? true);
        setSearchMobile(draft.formData?.buyerContact || '');
        setBuyerFound(
          draft.formData?.buyerContact
            ? { mobile: draft.formData.buyerContact, name: draft.formData.buyerName }
            : null
        );
        setShowDrafts(false);
        toast.success(`Draft "${draft.formData?.businessName || draft.formData?.buyerName || 'Draft'}" loaded!`);
      }}
      onDelete={deleteDraft}
      onClearAll={clearAllDrafts}
      onClose={() => setShowDrafts(false)}
    />
    </Modal>
  );
}
