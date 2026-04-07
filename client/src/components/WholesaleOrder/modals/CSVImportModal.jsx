import { useState, useCallback } from 'react';
import { FiUpload, FiCheck, FiAlertCircle, FiArrowRight, FiX, FiPackage } from 'react-icons/fi';
import SKUMappingModal from '../../modals/SKUMappingModal';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── SKU Parser ─────────────────────────────────────────────────────────────────
const parseFlipkartSKU = (sku) => {
  if (!sku) return { design: null, color: null, size: null };

  const sizeMap = {
    '28': 'S', '30': 'M', '32': 'L', '34': 'XL',
    '36': 'XXL', '38': '3XL', '40': '4XL', '42': '5XL',
  };

  const COLOR_MAP = {
    'KHAKHI': 'Khaki', 'KHAKI': 'Khaki',
    'BLACK': 'Black',
    'GREEN': 'Green',
    'LGREY': 'Light Grey', 'L.GREY': 'Light Grey', 'LIGHTGREY': 'Light Grey',
    'DGREY': 'Dark Grey', 'D.GREY': 'Dark Grey', 'DARKGREY': 'Dark Grey',
    'NAVY': 'Navy Blue', 'NAVYBLUE': 'Navy Blue',
  };

  const normalizeColor = c => {
    if (!c) return null;
    const cleaned = c.replace(/\./g, '').replace(/-/g, '').replace(/\s/g, '').trim().toUpperCase();
    return COLOR_MAP[cleaned] || c.trim();
  };

  const normalizeSize = (s) => { const t = s?.trim(); return sizeMap[t] || t || null; };
  const cleaned = sku.replace(/#/g, '').replace(/,/g, '').trim();

  const dnoMatch = cleaned.match(/(?:.*-)?D-NO-(\d+)-([^_]+)_(\w+)$/i);
  if (dnoMatch) {
    return {
      design: `D${dnoMatch[1]}`,
      color:  normalizeColor(dnoMatch[2]),
      size:   normalizeSize(dnoMatch[3]),
    };
  }

  if (cleaned.includes('_')) {
    const parts    = cleaned.split('-');
    const lastPart = parts[parts.length - 1];
    if (lastPart.includes('_') && parts.length >= 2) {
      const uIdx     = lastPart.indexOf('_');
      const colorRaw = lastPart.slice(0, uIdx);
      const sizeRaw  = lastPart.slice(uIdx + 1);
      const prefix   = parts.slice(0, -1).join('-');
      const dMatch   = prefix.match(/(?:^|-)(D\d{1,3})(?:-|$)/i);
      return {
        design: dMatch ? dMatch[1].toUpperCase() : (prefix || null),
        color:  normalizeColor(colorRaw),
        size:   normalizeSize(sizeRaw),
      };
    }
  }

  const parts = cleaned.split('-');
  if (parts.length < 3) return { design: null, color: null, size: null };

  let design, color, size;
  if (parts[0] === 'D' && !isNaN(parts[1])) {
    design = 'D' + parts[1];
    color  = parts.slice(2, -1).join('-');
    size   = parts[parts.length - 1];
  } else if (/^D\d+$/i.test(parts[0])) {
    design = parts[0].toUpperCase();
    color  = parts.slice(1, -1).join('-');
    size   = parts[parts.length - 1];
  } else {
    size   = parts[parts.length - 1];
    color  = parts[parts.length - 2];
    design = parts.slice(0, -2).join('-');
  }

  return {
    design: design || null,
    color:  normalizeColor(color),
    size:   normalizeSize(size),
  };
};

// ── CSV Parser ─────────────────────────────────────────────────────────────────
const parseCSV = (text) => {
  const aggregated = {};
  const parseLine  = (line) => {
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    cols.push(current.trim());
    return cols;
  };

  const lines = text.split('\n');
  let skuIdx = -1;
  let qtyIdx = -1;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const cols = parseLine(line);

    if (skuIdx === -1) {
      const lower = cols.map(c => c.toLowerCase().trim());
      const si    = lower.findIndex(c => c === 'sku');
      const qi    = lower.findIndex(c => c === 'quantity');
      if (si !== -1 && qi !== -1) {
        skuIdx = si; qtyIdx = qi;
        console.log('✅ Header found → SKU col:', skuIdx, '| Qty col:', qtyIdx);
      }
      continue;
    }

    const sku = cols[skuIdx]?.trim().replace(/^'+/, '');
    const qty = parseInt(cols[qtyIdx]) || 1;
    if (!sku || sku.length < 2 || sku.toLowerCase() === 'sku') continue;

    if (!aggregated[sku]) aggregated[sku] = { qty: 0 };
    aggregated[sku].qty += qty;
  }

  console.log('📦 Aggregated SKUs:', Object.keys(aggregated).length, Object.keys(aggregated));
  return aggregated;
};

// ── Build orderItems grouped structure for OrderFormModal ──────────────────────
const buildOrderItems = (aggregated, resolvedMappings, getSizesForDesign, enabledSizes, products) => {
  const groups = {};

  for (const [sku, { qty }] of Object.entries(aggregated)) {
    const mapping = resolvedMappings[sku];
    if (!mapping) continue;

    const { design, color, size } = mapping;
    const product      = products?.find(p => p.design === design);
    const colorVariant = product?.colors?.find(c => c.color === color);
    const pricePerUnit = colorVariant?.wholesalePrice || product?.colors?.[0]?.wholesalePrice || 0;
    const key          = `${design}__${pricePerUnit}`;

    if (!groups[key]) {
      const itemSizes = getSizesForDesign ? getSizesForDesign(design) : enabledSizes;
      groups[key] = {
        design, pricePerUnit,
        selectedColors: [], colorData: {},
        isCollapsed: false, isComplete: true,
        _itemSizes: itemSizes,
      };
    }

    const g = groups[key];
    if (!g.selectedColors.includes(color)) {
      g.selectedColors.push(color);
      const itemSizes = getSizesForDesign ? getSizesForDesign(design) : enabledSizes;
      g.colorData[color] = {
        mode: 'pieces', sets: 0,
        pieces: itemSizes.reduce((acc, s) => ({ ...acc, [s]: 0 }), {}),
      };
    }

    if (g.colorData[color]?.pieces !== undefined) {
      g.colorData[color].pieces[size] = (g.colorData[color].pieces[size] || 0) + qty;
    }
  }

  return Object.values(groups).map(({ _itemSizes, ...rest }) => rest);
};

// ── NEW: Fetch stock for all resolved SKUs ─────────────────────────────────────
// fulfillmentType: 'reserved' | 'warehouse' | 'factory'
// Returns a map: { "Design||Color||Size": stockQty }
const fetchStockForItems = async (resolvedMappings, aggregated, fulfillmentType, token, buyer) => {
  console.log('🧪 buyer object received:', buyer);  
  if (fulfillmentType === 'factory') return {};
  if (!buyer?.mobile) return {};  // No buyer selected = no check

  const uniqueVariants = [];
  const seenKeys = new Set();

  for (const [sku] of Object.entries(aggregated)) {
    const mapping = resolvedMappings[sku];
    if (!mapping) continue;
    const { design, color, size } = mapping;
    const key = `${design}||${color}||${size}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueVariants.push({ design, color, size });
    }
  }

  const stockMap = {};

  console.log('🔍 Calling buyer-stock-check with:', {
    buyerContact: buyer.mobile,
    variantsCount: uniqueVariants.length,
    variants: uniqueVariants,
    mode: fulfillmentType,
  });

  try {
    const res = await fetch(`${API}/inventory/buyer-stock-check`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body   : JSON.stringify({
        buyerContact: buyer.mobile,
        variants    : uniqueVariants,
        mode        : fulfillmentType,
      }),
    });

    console.log('📡 Response status:', res.status);
    const data = await res.json();
    console.log('📦 Response data:', data);

    if (res.ok) {
      for (const item of (data.stocks || [])) {
        const key = `${item.design}||${item.color}||${item.size}`;
        stockMap[key] =
          fulfillmentType === 'reserved'
            ? (item.reservedStock  ?? 0)
            : (item.warehouseStock ?? 0);
      }
      console.log('🗺️ Final stockMap:', stockMap);
    }
  } catch (err) {
    console.warn('Buyer stock fetch error:', err.message);
  }

  return stockMap;
};

// ── NEW: Cap quantities based on stock ────────────────────────────────────────
// Returns { cappedAggregated, adjustments }
// adjustments: [ { sku, design, color, size, csvQty, stock, finalQty, status } ]
const applyStockFilter = (aggregated, resolvedMappings, stockMap, fulfillmentType) => {
  if (fulfillmentType === 'factory') {
    return { cappedAggregated: aggregated, adjustments: [] };
  }

  const cappedAggregated = {};
  const adjustments      = [];

  for (const [sku, { qty }] of Object.entries(aggregated)) {
    const mapping = resolvedMappings[sku];
    if (!mapping) continue;

    const { design, color, size } = mapping;
    const key        = `${design}||${color}||${size}`;
    const buyerStock = stockMap[key] ?? 0;

    // How much does buyer still need?
    const needed = Math.max(0, qty - buyerStock);

    if (needed === 0) {
      // Buyer already has enough — skip entirely
      adjustments.push({
        sku, design, color, size,
        csvQty: qty, buyerStock, finalQty: 0,
        status: 'sufficient',
      });
    } else {
      cappedAggregated[sku] = { ...aggregated[sku], qty: needed };
      if (needed < qty) {
        // Buyer has some but not all — partial order
        adjustments.push({
          sku, design, color, size,
          csvQty: qty, buyerStock, finalQty: needed,
          status: 'trimmed',
        });
      }
      // If needed === qty → buyer has 0, full order, no adjustment entry needed
    }
  }

  return { cappedAggregated, adjustments };
};

// ── Step indicator ─────────────────────────────────────────────────────────────
const Step = ({ n, label, active, done }) => (
  <div className={`flex items-center gap-2 text-sm font-medium
    ${done ? 'text-green-600' : active ? 'text-indigo-600' : 'text-gray-400'}`}>
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2
      ${done   ? 'bg-green-600 border-green-600 text-white'
      : active ? 'bg-indigo-600 border-indigo-600 text-white'
      :          'border-gray-300'}`}>
      {done ? <FiCheck size={12} /> : n}
    </div>
    {label}
  </div>
);

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function CSVImportModal({
  isOpen, onClose, products, getSizesForDesign, enabledSizes, onPrefill,
  fulfillmentType = 'warehouse', onFulfillmentTypeChange, allBuyers = [],
}) {
  const [step,          setStep]          = useState(0);  // 0 = buyer select
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [buyerSearch,   setBuyerSearch]   = useState('');
  const [aggregated,      setAggregated]      = useState({});
  const [resolved,        setResolved]        = useState({});
  const [unmappedQueue,   setUnmappedQueue]   = useState([]);
  const [currentUnmapped, setCurrentUnmapped] = useState(null);
  const [skippedSKUs,     setSkippedSKUs]     = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [previewItems,    setPreviewItems]     = useState([]);
  const [dragging,        setDragging]        = useState(false);

  // ── NEW STATE ──────────────────────────────────────────────────────────────
  const [stockAdjustments, setStockAdjustments] = useState([]);
  // stockAdjustments: [ { sku, design, color, size, csvQty, stock, finalQty, status } ]

  // Only show buyers who are linked (customerTenantId is set)
  const linkedBuyers = allBuyers.filter(b => b.customerTenantId);
  const filteredBuyers = linkedBuyers.filter(b =>
    b.name?.toLowerCase().includes(buyerSearch.toLowerCase()) ||
    b.mobile?.includes(buyerSearch) ||
    b.businessName?.toLowerCase().includes(buyerSearch.toLowerCase())
  );

  const token = localStorage.getItem('token');

  // ── Inventory mode label (for UI) ──────────────────────────────────────────
  const inventoryModeLabel =
    fulfillmentType === 'reserved'  ? '🔒 Reserved Stock'   :
    fulfillmentType === 'factory'   ? '🏭 Factory Direct'    :
    fulfillmentType === 'warehouse' ? '🏬 Main Warehouse'    : '📦 Main Stock';

  const inventoryModeBadgeClass =
    fulfillmentType === 'reserved'  ? 'bg-blue-100 text-blue-700'   :
    fulfillmentType === 'factory'   ? 'bg-purple-100 text-purple-700' :
                                      'bg-green-100 text-green-700';

  // ── Step 1: parse & bulk lookup ────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      const text       = await file.text();
      const agg        = parseCSV(text);
      const uniqueSKUs = Object.keys(agg);

      if (uniqueSKUs.length === 0) {
        toast.error('No valid SKUs found — check console for details');
        return;
      }

      toast.success(`Found ${uniqueSKUs.length} unique SKUs`);

      // DB lookup
      let dbMappings = {};
      try {
        const res = await fetch(`${API}/sku-mapping/bulk-lookup`, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body   : JSON.stringify({ skus: uniqueSKUs }),
        });
        if (res.ok) {
          const data = await res.json();
          dbMappings = data.mappings || {};
        }
      } catch (fetchErr) {
        console.warn('Bulk lookup error (non-fatal):', fetchErr.message);
      }

      // Auto-parse unmapped
      const autoResolved = {};
      const needsManual  = [];
      for (const sku of uniqueSKUs) {
        if (dbMappings[sku]) continue;
        const parsed = parseFlipkartSKU(sku);
        if (parsed.design && parsed.color && parsed.size) {
          autoResolved[sku] = parsed;
        } else {
          needsManual.push(sku);
        }
      }

      const allResolved = { ...dbMappings, ...autoResolved };
      setAggregated(agg);
      setResolved(allResolved);
      setStep(2);

      if (needsManual.length > 0) {
        setUnmappedQueue(needsManual);
        setCurrentUnmapped(needsManual[0]);
        toast(`${needsManual.length} SKU(s) need manual mapping`, { icon: '⚠️' });
      } else {
        await buildPreview(agg, allResolved, selectedBuyer);
        toast.success(`All ${uniqueSKUs.length} SKUs resolved automatically!`);
      }
    } catch (err) {
      console.error('CSV import error:', err);
      toast.error(`CSV import failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [token, fulfillmentType, selectedBuyer]);

  // ── Step 2: SKUMappingModal callback ───────────────────────────────────────
  const handleMappingComplete = useCallback((sku, { design, color, size }) => {
    setResolved(prev => {
      const next      = { ...prev, [sku]: { design, color, size } };
      const nextQueue = unmappedQueue.filter(s => s !== sku);
      setUnmappedQueue(nextQueue);

      if (nextQueue.length > 0) {
        setCurrentUnmapped(nextQueue[0]);
      } else {
        setCurrentUnmapped(null);
        buildPreview(aggregated, next, selectedBuyer);
      }
      return next;
    });
  }, [unmappedQueue, aggregated, selectedBuyer]);

  const handleSkipSKU = useCallback(() => {
    if (!currentUnmapped) return;
    setSkippedSKUs(prev => [...prev, currentUnmapped]);
    const nextQueue = unmappedQueue.filter(s => s !== currentUnmapped);
    setUnmappedQueue(nextQueue);
    if (nextQueue.length > 0) {
      setCurrentUnmapped(nextQueue[0]);
    } else {
      setCurrentUnmapped(null);
      buildPreview(aggregated, resolved, selectedBuyer);
    }
  }, [currentUnmapped, unmappedQueue, aggregated, resolved, selectedBuyer]);

  // ── Step 3: build preview (NOW WITH STOCK CHECK) ──────────────────────────
  const buildPreview = async (agg, res, buyer) => {   // ← add buyer param
    setLoading(true);
    try {
      const stockMap = await fetchStockForItems(res, agg, fulfillmentType, token, buyer);  
      const { cappedAggregated, adjustments } = applyStockFilter(agg, res, stockMap, fulfillmentType);
      const items = buildOrderItems(cappedAggregated, res, getSizesForDesign, enabledSizes, products);
      setStockAdjustments(adjustments);
      setPreviewItems(items);
      setStep(4);  // ← was 3, now 4

      const sufficient = adjustments.filter(a => a.status === 'sufficient').length;
      const trimmed    = adjustments.filter(a => a.status === 'trimmed').length;
      if (sufficient > 0 || trimmed > 0) {
        toast(
          `Stock adjusted: ${trimmed} partially needed, ${sufficient} already in stock`,
          { icon: '⚠️', duration: 4000 }
        );
      }
    } catch (err) {
      console.error('Preview build error:', err);
      toast.error('Failed to check stock. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Confirm: pass to OrderFormModal ───────────────────────────────────────
  const handleConfirm = () => {
    if (previewItems.length === 0) { toast.error('No items to import'); return; }
    onPrefill(previewItems);
    onClose();
    toast.success('Order form prefilled from CSV!');
  };

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (!isOpen) return null;

  const mappedCount  = Object.keys(resolved).length;
  const totalSKUs    = Object.keys(aggregated).length;
  const pendingCount = unmappedQueue.length;

  // Adjustment summary counts
  const droppedCount = stockAdjustments.filter(a => a.status === 'dropped').length;
  const trimmedCount = stockAdjustments.filter(a => a.status === 'trimmed').length;
  const sufficientCount = stockAdjustments.filter(a => a.status === 'sufficient').length;
  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div>
              <h2 className="text-base font-bold text-gray-900">Import Orders from CSV</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-400">Flipkart CSV → prefill wholesale order</p>
                {/* ── NEW: Inventory mode badge ── */}
                <select
                  value={fulfillmentType}
                  onChange={e => onFulfillmentTypeChange?.(e.target.value)}
                  disabled={step > 1}
                  className={`text-[10px] px-2 py-1 rounded-full font-semibold border-0 cursor-pointer
                    focus:ring-1 focus:ring-offset-0 focus:outline-none
                    ${inventoryModeBadgeClass}
                    ${step > 1 ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="warehouse">🏬 Main Warehouse</option>
                  <option value="reserved">🔒 Reserved Stock</option>
                  <option value="factory">🏭 Factory Direct</option>
                </select>
                {selectedBuyer && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center gap-1">
                    👤 {selectedBuyer.businessName || selectedBuyer.name}
                    {step === 0 ? null : (
                      <button
                        onClick={() => { setSelectedBuyer(null); setStep(0); setAggregated({}); setResolved({}); }}
                        className="ml-1 hover:text-indigo-900"
                      >✕</button>
                    )}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <FiX size={18} />
            </button>
          </div>

          {/* ── Step indicator ── */}
          <div className="flex items-center gap-4 px-6 py-3 bg-gray-50 border-b">
            <Step n={1} label="Select Buyer"    active={step === 0} done={step > 0} />
            <div className="flex-1 h-px bg-gray-200" />
            <Step n={2} label="Upload CSV"      active={step === 1} done={step > 1} />
            <div className="flex-1 h-px bg-gray-200" />
            <Step n={3} label="Map SKUs"        active={step === 2} done={step > 2} />
            <div className="flex-1 h-px bg-gray-200" />
            <Step n={4} label="Preview & Import" active={step === 4 || step === 4} done={false} />
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* ── STEP 0: Select Buyer ── */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                  Select the buyer you're creating this order for. Only linked buyers are shown.
                  Their current inventory will be compared against the CSV to calculate what stock they actually need.
                </div>

                {linkedBuyers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-gray-500 font-medium text-sm">No linked buyers found</p>
                    <p className="text-gray-400 text-xs mt-1">
                      A buyer must be linked to a customer account before importing CSV for them.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Search */}
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"
                        fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      <input
                        autoFocus
                        type="text"
                        value={buyerSearch}
                        onChange={e => setBuyerSearch(e.target.value)}
                        placeholder="Search by name, mobile, business..."
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm
                                  focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    {/* Buyer list */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      {filteredBuyers.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-sm">No buyers match your search</p>
                      ) : filteredBuyers.map(buyer => (
                        <button
                          key={buyer._id}
                          onClick={() => {
                            setSelectedBuyer(buyer);
                            setStep(1);
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 text-left
                                    hover:bg-indigo-50 border-b border-gray-100 last:border-0 transition-all"
                        >
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">
                              {buyer.businessName || buyer.name}
                            </p>
                            <p className="text-xs text-gray-400">{buyer.mobile}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                              Linked ✓
                            </span>
                            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path d="m9 18 6-6-6-6"/>
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── STEP 1: Upload ── */}
            {step === 1 && (
              <div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('csv-file-input').click()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                    ${dragging
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}`}
                >
                  <FiUpload size={36} className="mx-auto text-gray-400 mb-3" />
                  <p className="font-semibold text-gray-700">Drop Flipkart CSV here</p>
                  <p className="text-sm text-gray-400 mt-1">or click to browse</p>
                  <p className="text-xs text-gray-300 mt-3">Columns required: SKU · Quantity</p>
                  <input
                    id="csv-file-input" type="file" accept=".csv,.txt" className="hidden"
                    onChange={e => handleFile(e.target.files[0])}
                  />
                </div>
                {loading && (
                  <div className="flex items-center justify-center gap-3 mt-6 text-indigo-600">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
                    <span className="text-sm font-medium">Parsing CSV & looking up mappings...</span>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Resolve SKUs ── */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total SKUs', val: totalSKUs,    color: 'text-gray-700',   bg: 'bg-gray-50'   },
                    { label: 'Mapped',     val: mappedCount,  color: 'text-green-700',  bg: 'bg-green-50'  },
                    { label: 'Pending',    val: pendingCount, color: 'text-orange-700', bg: 'bg-orange-50' },
                  ].map(({ label, val, color, bg }) => (
                    <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                      <div className={`text-2xl font-bold ${color}`}>{val}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                {/* SKU list */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    SKU Resolution Status
                  </div>
                  <div className="divide-y max-h-64 overflow-y-auto">
                    {Object.entries(aggregated).map(([sku, { qty }]) => {
                      const mapping = resolved[sku];
                      const skipped = skippedSKUs.includes(sku);
                      const pending = unmappedQueue.includes(sku) || currentUnmapped === sku;
                      return (
                        <div key={sku} className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <div>
                            <span className="font-mono text-gray-800 font-medium text-xs">{sku}</span>
                            <span className="text-gray-400 ml-2 text-xs">×{qty}</span>
                          </div>
                          <div>
                            {mapping ? (
                              <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                                <FiCheck size={11} />
                                {mapping.design} · {mapping.color} · {mapping.size}
                              </span>
                            ) : skipped ? (
                              <span className="text-gray-400 text-xs">Skipped</span>
                            ) : pending ? (
                              <span className="text-orange-500 text-xs font-medium animate-pulse">Needs mapping</span>
                            ) : (
                              <span className="text-gray-300 text-xs">Waiting...</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* All resolved → go to preview */}
                {pendingCount === 0 && !currentUnmapped && (
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <FiCheck className="text-green-600 flex-shrink-0" size={18} />
                    <span className="text-green-700 font-medium text-sm">
                      All SKUs resolved!{skippedSKUs.length > 0 && ` (${skippedSKUs.length} skipped)`}
                    </span>
                    <button
                      onClick={() => buildPreview(aggregated, resolved, selectedBuyer)}
                      disabled={loading}
                      className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                    >
                      {loading
                        ? <><div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> Checking stock...</>
                        : <>Check Stock & Preview <FiArrowRight size={13} /></>
                      }
                    </button>
                  </div>
                )}

                {/* Waiting for mapping */}
                {currentUnmapped && (
                  <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                    <FiAlertCircle className="text-orange-500 flex-shrink-0" size={18} />
                    <span className="text-orange-700 font-medium text-sm">
                      Mapping: <code className="bg-orange-100 px-1.5 py-0.5 rounded text-xs">{currentUnmapped}</code>
                      <span className="text-orange-400 text-xs ml-1.5">({pendingCount} remaining)</span>
                    </span>
                    <button onClick={handleSkipSKU} className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline">
                      Skip this SKU
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 3: Preview ── */}
            {step === 4 && (
              <div className="space-y-4">

                {/* Summary header with adjustment pills */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-gray-500">
                    {previewItems.length} design group{previewItems.length !== 1 ? 's' : ''} ready
                    {skippedSKUs.length > 0 && ` · ${skippedSKUs.length} SKU(s) skipped`}
                  </p>
                  {/* ── NEW: Stock adjustment summary pills ── */}
                  {fulfillmentType !== 'factory' ? (
                    <div className="flex items-center gap-2">
                      {trimmedCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
                          ⚠ {trimmedCount} trimmed
                        </span>
                      )}
                      {droppedCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-red-100 text-red-600 font-semibold">
                          ✕ {droppedCount} dropped
                        </span>
                      )}
                      {trimmedCount === 0 && droppedCount === 0 && sufficientCount === 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-semibold">
                          ✓ All quantities in stock
                        </span>
                      )}
                      {sufficientCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">
                          ✓ {sufficientCount} already with buyer
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-semibold">
                      ✓ All quantities as-is (Factory)
                    </span>
                  )}
                </div>

                {/* Preview table */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Design</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Colors & Sizes</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Price</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Pcs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewItems.map((item, i) => {
                        const totalPcs = item.selectedColors.reduce((sum, color) => {
                          return sum + Object.values(item.colorData[color]?.pieces || {}).reduce((s, q) => s + q, 0);
                        }, 0);
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-bold text-indigo-600">{item.design}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {item.selectedColors.map(c => {
                                  const pieces = item.colorData[c]?.pieces || {};
                                  const totalPcs = Object.values(pieces).reduce((s, q) => s + q, 0);
                                  const isTrimmed = stockAdjustments.some(
                                    a => a.status === 'trimmed' && a.design === item.design && a.color === c
                                  );
                                  // Only show sizes that have qty > 0
                                  const sizeBreakdown = Object.entries(pieces)
                                    .filter(([, q]) => q > 0)
                                    .map(([s, q]) => `${s}:${q}`)
                                    .join(' · ');

                                  return (
                                    <span
                                      key={c}
                                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs
                                        ${isTrimmed
                                          ? 'bg-yellow-100 text-yellow-800'
                                          : 'bg-gray-100 text-gray-700'}`}
                                    >
                                      <span className="font-semibold">{c}</span>
                                      <span className="text-gray-400 mx-0.5">|</span>
                                      <span className="font-mono text-[10px]">{sizeBreakdown}</span>
                                      <span className="font-bold ml-0.5">({totalPcs})</span>
                                      {isTrimmed && <span className="text-yellow-500 font-bold ml-0.5">⚠</span>}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-700">₹{item.pricePerUnit}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">{totalPcs}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── NEW: Stock Adjustments Panel ── */}
                {stockAdjustments.length > 0 && (
                  <div className="border border-yellow-200 rounded-xl overflow-hidden">
                    <div className="bg-yellow-50 px-4 py-2.5 flex items-center gap-2 text-xs font-bold text-yellow-800 uppercase tracking-wide">
                      <FiPackage size={13} />
                      Stock Adjustments —{' '}
                      {fulfillmentType === 'reserved' ? 'Reserved' : 'Main'} Inventory
                    </div>
                    <div className="divide-y divide-yellow-100">
                      {stockAdjustments.map((adj, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5">
                          <span className="font-mono text-gray-700 text-xs">
                            {adj.design} · {adj.color} · {adj.size}
                          </span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-400">
                              CSV: <span className="font-semibold text-gray-700">{adj.csvQty}</span>
                            </span>
                            <span className="text-gray-400">
                              Buyer Stock: <span className="font-semibold text-gray-700">{adj.buyerStock}</span>
                            </span>
                            {adj.status === 'trimmed' ? (
                              <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-bold text-[10px]">
                                → {adj.finalQty} pcs needed
                              </span>
                            ) : adj.status === 'sufficient' ? (
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px]">
                                ✓ Already in stock
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-bold text-[10px]">
                                Dropped (0 stock)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skipped SKUs */}
                {skippedSKUs.length > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-700">
                    <FiAlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                    <span>Skipped SKUs (not included): {skippedSKUs.join(', ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">
              Cancel
            </button>
            {step === 4 && (
              <button
                onClick={handleConfirm}
                disabled={previewItems.length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiArrowRight size={15} />
                Prefill Order Form
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SKUMappingModal — shown on top */}
      {currentUnmapped && (
        <SKUMappingModal
          isOpen={!!currentUnmapped}
          onClose={handleSkipSKU}
          sku={currentUnmapped}
          accountName="Flipkart"
          availableProducts={products}
          onMappingComplete={(sku, mapping) => handleMappingComplete(sku, mapping)}
        />
      )}
    </>
  );
}