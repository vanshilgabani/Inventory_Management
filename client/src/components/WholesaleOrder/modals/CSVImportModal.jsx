import { useState, useCallback } from 'react';
import { FiUpload, FiCheck, FiAlertCircle, FiArrowRight, FiX } from 'react-icons/fi';
import SKUMappingModal from '../../modals/SKUMappingModal';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

  const normalizeSize  = (s) => { const t = s?.trim(); return sizeMap[t] || t || null; };
  const cleaned        = sku.replace(/#/g, '').replace(/,/g, '').trim();

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
  const parseLine = (line) => {
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
  let skuIdx  = -1;
  let qtyIdx  = -1;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const cols = parseLine(line);

    if (skuIdx === -1) {
      const lower = cols.map(c => c.toLowerCase().trim());
      const si    = lower.findIndex(c => c === 'sku');
      const qi    = lower.findIndex(c => c === 'quantity');
      if (si !== -1 && qi !== -1) {
        skuIdx = si;
        qtyIdx = qi;
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

    // ── Look up wholesale price from products ─────────────────────────────
    const product      = products?.find(p => p.design === design);
    const colorVariant = product?.colors?.find(c => c.color === color);
    const pricePerUnit = colorVariant?.wholesalePrice || product?.colors?.[0]?.wholesalePrice || 0;

    const key = `${design}__${pricePerUnit}`;

    if (!groups[key]) {
      const itemSizes = getSizesForDesign ? getSizesForDesign(design) : enabledSizes;
      groups[key] = {
        design,
        pricePerUnit,
        selectedColors: [],
        colorData     : {},
        isCollapsed   : false,
        isComplete    : true,
        _itemSizes    : itemSizes,
      };
    }

    const g = groups[key];

    if (!g.selectedColors.includes(color)) {
      g.selectedColors.push(color);
      const itemSizes = getSizesForDesign ? getSizesForDesign(design) : enabledSizes;
      g.colorData[color] = {
        mode  : 'pieces',
        sets  : 0,
        pieces: itemSizes.reduce((acc, s) => ({ ...acc, [s]: 0 }), {}),
      };
    }

    if (g.colorData[color]?.pieces !== undefined) {
      g.colorData[color].pieces[size] = (g.colorData[color].pieces[size] || 0) + qty;
    }
  }

  return Object.values(groups).map(({ _itemSizes, ...rest }) => rest);
};

// ── STEP indicators ────────────────────────────────────────────────────────────
const Step = ({ n, label, active, done }) => (
  <div className={`flex items-center gap-2 text-sm font-medium ${done ? 'text-green-600' : active ? 'text-indigo-600' : 'text-gray-400'}`}>
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2
      ${done ? 'bg-green-600 border-green-600 text-white' : active ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}>
      {done ? <FiCheck size={12} /> : n}
    </div>
    {label}
  </div>
);

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function CSVImportModal({
  isOpen, onClose, products, getSizesForDesign, enabledSizes, onPrefill
}) {
  const [step,             setStep]             = useState(1); // 1=upload 2=resolve 3=preview
  const [aggregated,       setAggregated]       = useState({}); // { sku: {qty, price} }
  const [resolved,         setResolved]         = useState({}); // { sku: {design,color,size} }
  const [unmappedQueue,    setUnmappedQueue]    = useState([]); // skus still to map
  const [currentUnmapped,  setCurrentUnmapped]  = useState(null);
  const [skippedSKUs,      setSkippedSKUs]      = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [previewItems,     setPreviewItems]     = useState([]);
  const [dragging,         setDragging]         = useState(false);

  const token = localStorage.getItem('token');

  // ── Step 1: parse & bulk lookup ────────────────────────────────────────────
const handleFile = useCallback(async (file) => {
  if (!file) return;

  setLoading(true);
  try {
    const text       = await file.text();
    const agg        = parseCSV(text);
    const uniqueSKUs = Object.keys(agg);

    console.log('Parsed SKUs:', uniqueSKUs.length, uniqueSKUs);

    if (uniqueSKUs.length === 0) {
      toast.error('No valid SKUs found — check console for details');
      setLoading(false);
      return;
    }

    toast.success(`Found ${uniqueSKUs.length} unique SKUs`);

    // ── DB lookup ──────────────────────────────────────────────────────────
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
        console.log('DB mappings found:', Object.keys(dbMappings).length);
      } else {
        console.warn('Bulk lookup failed:', res.status);
      }
    } catch (fetchErr) {
      console.warn('Bulk lookup error (non-fatal):', fetchErr.message);
    }

    // ── Auto-parse unmapped SKUs ───────────────────────────────────────────
    const autoResolved = {};
    const needsManual  = [];

    for (const sku of uniqueSKUs) {
      if (dbMappings[sku]) continue;
      const parsed = parseFlipkartSKU(sku);
      if (parsed.design && parsed.color && parsed.size) {
        autoResolved[sku] = parsed;
        console.log(`Auto-resolved: ${sku} →`, parsed);
      } else {
        needsManual.push(sku);
        console.warn(`Cannot auto-parse: ${sku}`, parsed);
      }
    }

    // ── Merge & proceed ────────────────────────────────────────────────────
    const allResolved = { ...dbMappings, ...autoResolved };

    setAggregated(agg);
    setResolved(allResolved);
    setStep(2);

    if (needsManual.length > 0) {
      setUnmappedQueue(needsManual);
      setCurrentUnmapped(needsManual[0]);
      toast(`${needsManual.length} SKU(s) need manual mapping`, { icon: '⚠️' });
    } else {
      buildPreview(agg, allResolved);
      toast.success(`All ${uniqueSKUs.length} SKUs resolved automatically!`);
    }

  } catch (err) {
    console.error('CSV import error:', err);
    toast.error(`CSV import failed: ${err.message}`);
  } finally {
    setLoading(false);
  }
}, [token]);

  // ── Step 2: SKUMappingModal callback ───────────────────────────────────────
  const handleMappingComplete = useCallback((sku, { design, color, size }) => {
    setResolved(prev => {
      const next = { ...prev, [sku]: { design, color, size } };
      const nextQueue = unmappedQueue.filter(s => s !== sku);
      setUnmappedQueue(nextQueue);

      if (nextQueue.length > 0) {
        setCurrentUnmapped(nextQueue[0]);
      } else {
        setCurrentUnmapped(null);
        buildPreview(aggregated, next);
      }
      return next;
    });
  }, [unmappedQueue, aggregated]);

  const handleSkipSKU = useCallback(() => {
    if (!currentUnmapped) return;
    setSkippedSKUs(prev => [...prev, currentUnmapped]);
    const nextQueue = unmappedQueue.filter(s => s !== currentUnmapped);
    setUnmappedQueue(nextQueue);
    if (nextQueue.length > 0) {
      setCurrentUnmapped(nextQueue[0]);
    } else {
      setCurrentUnmapped(null);
      buildPreview(aggregated, resolved);
    }
  }, [currentUnmapped, unmappedQueue, aggregated, resolved]);

  // ── Step 3: build preview ──────────────────────────────────────────────────
  const buildPreview = (agg, res) => {
    const items = buildOrderItems(agg, res, getSizesForDesign, enabledSizes, products);
    setPreviewItems(items);
    setStep(3);
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

  // Mapped + skipped summary for step 2
  const mappedCount  = Object.keys(resolved).length;
  const totalSKUs    = Object.keys(aggregated).length;
  const pendingCount = unmappedQueue.length;

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Import Orders from CSV</h2>
              <p className="text-xs text-gray-500 mt-0.5">Flipkart order CSV → prefill wholesale order form</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <FiX size={20} />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-6 px-6 py-3 bg-gray-50 border-b">
            <Step n={1} label="Upload CSV"    active={step === 1} done={step > 1} />
            <div className="flex-1 h-px bg-gray-200" />
            <Step n={2} label="Map SKUs"      active={step === 2} done={step > 2} />
            <div className="flex-1 h-px bg-gray-200" />
            <Step n={3} label="Preview"       active={step === 3} done={false} />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* ── Step 1: Upload ── */}
            {step === 1 && (
              <div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer
                    ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}`}
                  onClick={() => document.getElementById('csv-file-input').click()}
                >
                  <FiUpload size={36} className="mx-auto text-gray-400 mb-3" />
                  <p className="font-semibold text-gray-700">Drop Flipkart CSV here</p>
                  <p className="text-sm text-gray-400 mt-1">or click to browse</p>
                  <p className="text-xs text-gray-400 mt-3">Columns used: SKU (col 9) ·  Quantity (col 19)</p>
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
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

            {/* ── Step 2: Resolve unmapped (inline status) ── */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total SKUs',  val: totalSKUs,    color: 'text-gray-700',   bg: 'bg-gray-50'    },
                    { label: 'Mapped',      val: mappedCount,  color: 'text-green-700',  bg: 'bg-green-50'   },
                    { label: 'Pending',     val: pendingCount, color: 'text-orange-700', bg: 'bg-orange-50'  },
                  ].map(({ label, val, color, bg }) => (
                    <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                      <div className={`text-2xl font-bold ${color}`}>{val}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Mapped SKUs list */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    SKU Resolution Status
                  </div>
                  <div className="divide-y max-h-64 overflow-y-auto">
                    {Object.entries(aggregated).map(([sku, { qty, price }]) => {
                      const mapping  = resolved[sku];
                      const skipped  = skippedSKUs.includes(sku);
                      const pending  = unmappedQueue.includes(sku) || currentUnmapped === sku;
                      return (
                        <div key={sku} className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <div>
                            <span className="font-mono text-gray-800 font-medium">{sku}</span>
                            <span className="text-gray-400 ml-2 text-xs">×{qty} @ ₹{price}</span>
                          </div>
                          <div>
                            {mapping ? (
                              <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                                <FiCheck size={12} /> {mapping.design} · {mapping.color} · {mapping.size}
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

                {/* All mapped — go to preview */}
                {pendingCount === 0 && !currentUnmapped && (
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <FiCheck className="text-green-600" size={20} />
                    <span className="text-green-700 font-medium text-sm">
                      All SKUs resolved! {skippedSKUs.length > 0 && `(${skippedSKUs.length} skipped)`}
                    </span>
                    <button
                      onClick={() => buildPreview(aggregated, resolved)}
                      className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                    >
                      Preview Order <FiArrowRight size={14} />
                    </button>
                  </div>
                )}

                {/* Waiting for SKUMappingModal */}
                {currentUnmapped && (
                  <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                    <FiAlertCircle className="text-orange-500" size={20} />
                    <span className="text-orange-700 font-medium text-sm">
                      Mapping SKU: <code className="bg-orange-100 px-1 rounded">{currentUnmapped}</code>
                      <span className="text-orange-500 text-xs ml-2">({pendingCount} remaining)</span>
                    </span>
                    <button
                      onClick={handleSkipSKU}
                      className="ml-auto text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Skip this SKU
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Preview ── */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {previewItems.length} design group{previewItems.length !== 1 ? 's' : ''} ready to import
                    {skippedSKUs.length > 0 && ` · ${skippedSKUs.length} SKU(s) skipped`}
                  </p>
                </div>

                {/* Preview table */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Design</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Colors</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Price</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Total Pcs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewItems.map((item, i) => {
                        const totalPcs = item.selectedColors.reduce((sum, color) => {
                          const pieces = item.colorData[color]?.pieces || {};
                          return sum + Object.values(pieces).reduce((s, q) => s + q, 0);
                        }, 0);
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-semibold text-indigo-700">{item.design}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {item.selectedColors.map(c => {
                                  const pcs = Object.values(item.colorData[c]?.pieces || {}).reduce((s, q) => s + q, 0);
                                  return (
                                    <span key={c} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 rounded-full px-2 py-0.5 text-xs">
                                      {c} <strong>{pcs}</strong>
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-medium">₹{item.pricePerUnit}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">{totalPcs} pcs</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Skipped SKUs warning */}
                {skippedSKUs.length > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                    <FiAlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>Skipped SKUs (not included): {skippedSKUs.join(', ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">
              Cancel
            </button>
            {step === 3 && (
              <button
                onClick={handleConfirm}
                disabled={previewItems.length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiArrowRight size={16} />
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