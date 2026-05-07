import { useState, useEffect, useMemo, useCallback } from 'react';
import { salesService } from '../services/salesService';
import { wholesaleService } from '../services/wholesaleService';
import { directSalesService } from '../services/directSalesService';
import { settlementService } from '../services/settlementService';
import { useColorPalette } from '../hooks/useColorPalette';
import { useEnabledSizes } from '../hooks/useEnabledSizes';

// ─── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300..700&display=swap');
.rp-root { font-family:'Inter',sans-serif; }
@keyframes rp-fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes rp-shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
@keyframes rp-spin { to{transform:rotate(360deg)} }
.rp-animate { animation:rp-fadeIn 0.3s ease both; }
.rp-skeleton { background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:600px 100%;animation:rp-shimmer 1.5s ease-in-out infinite;border-radius:6px; }
.rp-tab-active { background:#0f766e;color:#fff;box-shadow:0 2px 8px rgba(15,118,110,0.35); }
.rp-tab-inactive { background:transparent;color:#4b5563; }
.rp-tab-inactive:hover { background:#f3f4f6;color:#111827; }
.rp-report-btn-active { background:#f0fdf4;border-color:#0f766e;color:#0f766e;font-weight:600; }
.rp-report-btn-inactive { background:#fff;border-color:#e5e7eb;color:#374151; }
.rp-report-btn-inactive:hover { border-color:#9ca3af;background:#f9fafb; }
.rp-table th { background:#f8fafc;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#64748b;padding:10px 14px;white-space:nowrap;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:1; }
.rp-table td { padding:10px 14px;font-size:13px;color:#1e293b;border-bottom:1px solid #f1f5f9;white-space:nowrap; }
.rp-table tr:last-child td { border-bottom:none; }
.rp-table tr:hover td { background:#f8fafc; }
.rp-table .rp-num { font-variant-numeric:tabular-nums;text-align:right; }
.rp-table .rp-label-col { font-weight:600;color:#374151;background:#f8fafc;position:sticky;left:0;z-index:1;min-width:130px; }
.rp-table .rp-total-row td { background:#f0fdf4;font-weight:700;color:#0f766e;border-top:2px solid #bbf7d0; }
.rp-matrix-wrap { overflow-x:auto;border-radius:10px;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(0,0,0,0.05); }
.rp-select { appearance:none;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 10px center;border:1px solid #d1d5db;border-radius:8px;padding:7px 32px 7px 11px;font-size:13px;color:#374151;cursor:pointer;transition:border-color 0.15s,box-shadow 0.15s;min-width:130px; }
.rp-select:focus { outline:none;border-color:#0f766e;box-shadow:0 0 0 3px rgba(15,118,110,0.12); }
.rp-input { border:1px solid #d1d5db;border-radius:8px;padding:7px 11px;font-size:13px;color:#374151;transition:border-color 0.15s,box-shadow 0.15s;background:#fff; }
.rp-input:focus { outline:none;border-color:#0f766e;box-shadow:0 0 0 3px rgba(15,118,110,0.12); }
.rp-btn-primary { background:#0f766e;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background 0.15s,transform 0.1s,box-shadow 0.15s; }
.rp-btn-primary:hover { background:#0d5d57;box-shadow:0 2px 8px rgba(15,118,110,0.3); }
.rp-btn-primary:active { transform:scale(0.97); }
.rp-btn-primary:disabled { background:#9ca3af;cursor:not-allowed; }
.rp-btn-ghost { background:transparent;color:#6b7280;border:1px solid #e5e7eb;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.15s; }
.rp-btn-ghost:hover { background:#f9fafb;border-color:#9ca3af;color:#374151; }
.rp-spinner { width:18px;height:18px;border:2px solid #e2e8f0;border-top-color:#0f766e;border-radius:50%;animation:rp-spin 0.7s linear infinite;display:inline-block; }
.rp-badge { display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600; }
.rp-color-dot { width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:6px;border:1px solid rgba(0,0,0,0.1);flex-shrink:0; }
.rp-section-card { background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.04); }
.rp-section-header { padding:14px 18px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;background:#fafafa; }
.rp-section-title { font-size:13px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.05em;display:flex;align-items:center;gap:7px; }
.rp-empty { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;color:#9ca3af;gap:10px; }
.rp-scrollable-table { max-height:500px;overflow-y:auto; }
.rp-detail-row { cursor:pointer; }
.rp-detail-row:hover td { background:#f0fdf4 !important; }
`;

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  const el = document.createElement('style');
  el.textContent = STYLES;
  document.head.appendChild(el);
  _stylesInjected = true;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CUR_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CUR_YEAR - i);

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n === undefined || n === null) return '—';
  return Number(n).toLocaleString('en-IN');
}
function fmtCur(n) {
  if (n === undefined || n === null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function buildDateRange(filterMode, month, year, customFrom, customTo) {
  if (filterMode === 'all') return { startDate: null, endDate: null };
  if (filterMode === 'custom') return { startDate: customFrom || null, endDate: customTo || null };
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  const startDate = `${y}-${String(m).padStart(2,'0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  return { startDate, endDate };
}
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// New: Build matrix for a single design
function buildSingleDesignMatrix(rows, selectedDesign, sizes) {
  const matrixColors = [];
  const matrixMap = {};
  
  for (const r of rows) {
    // Filter by selected design (if not 'all')
    if (selectedDesign && selectedDesign !== 'all' && r.design !== selectedDesign) continue;
    
    const color = r.color || '—';
    const size = r.size || '—';
    const qty = r.quantity || r.totalQuantity || 1;
    
    const key = `${color}||${size}`;
    matrixMap[key] = (matrixMap[key] || 0) + qty;
    
    if (!matrixColors.includes(color)) {
      matrixColors.push(color);
    }
  }
  
  return { matrixColors, matrixMap };
}

// Helper: Sort sizes in proper order using enabledSizes as reference
function sortSizes(sizesToSort, enabledSizes) {
  if (!sizesToSort || sizesToSort.length === 0) return [];
  
  // If enabledSizes provided, use that order
  if (enabledSizes && enabledSizes.length > 0) {
    return enabledSizes.filter(s => sizesToSort.includes(s));
  }
  
  // Fallback: standard size order
  const sizeOrder = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '28', '30', '32', '34', '36', '38', '40', '42'];
  return sizesToSort.sort((a, b) => {
    const indexA = sizeOrder.indexOf(a);
    const indexB = sizeOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}

// New: Build CSV with multiple design matrices in grid (2 per row)
function buildMultiDesignCSV(designs, allRows, enabledSizes, getSizesForDesign = null) {
  const rows = [];
  const designsPerRow = 2;
  
  for (let i = 0; i < designs.length; i += designsPerRow) {
    const batch = designs.slice(i, i + designsPerRow);
    
    // Get sizes for each design in batch
    const batchSizes = batch.map(design => {
      if (getSizesForDesign) {
        // Use hook to get design-specific sizes
        const designSpecificSizes = getSizesForDesign(design);
        const detectedSizes = [...new Set(allRows.filter(r => r.design === design).map(r => r.size).filter(s => s && s !== '—'))];
        // Only include sizes that exist in the data AND are enabled for this design
        return designSpecificSizes.filter(s => detectedSizes.includes(s));
      } else {
        // Fallback: detect from data
        const detectedSizes = [...new Set(allRows.filter(r => r.design === design).map(r => r.size).filter(s => s && s !== '—'))];
        return sortSizes(detectedSizes, enabledSizes);
      }
    });
    
    // Header row with design names
    const headerRow = [];
    batch.forEach((design, idx) => {
      headerRow.push(`Design: ${design}`);
      for (let j = 0; j < batchSizes[idx].length; j++) {
        headerRow.push('');
      }
      // Add 2 empty columns as spacing between matrices (except for last one)
      if (idx < batch.length - 1) {
        headerRow.push('', '');
      }
    });
    rows.push(headerRow);
    
    // Column headers row
    const colHeaderRow = [];
    batch.forEach((design, idx) => {
      colHeaderRow.push('Color/Size');
      batchSizes[idx].forEach(size => colHeaderRow.push(size));
      colHeaderRow.push('Total');
      // Add 2 empty columns as spacing
      if (idx < batch.length - 1) {
        colHeaderRow.push('', '');
      }
    });
    rows.push(colHeaderRow);
    
    // Build matrices for each design in batch
    const matrices = batch.map((design, idx) => {
      const designRows = allRows.filter(r => r.design === design);
      const colors = [];
      const map = {};
      
      for (const r of designRows) {
        const color = r.color || '—';
        const size = r.size || '—';
        const qty = r.quantity || r.totalQuantity || 1;
        const key = `${color}||${size}`;
        map[key] = (map[key] || 0) + qty;
        if (!colors.includes(color)) colors.push(color);
      }
      
      return { colors, map, sizes: batchSizes[idx] };
    });
    
    // Get all unique colors across batch
    const allColors = [...new Set(matrices.flatMap(m => m.colors))];
    
    // Data rows
    for (const color of allColors) {
      const dataRow = [];
      
      matrices.forEach(({ colors, map, sizes }, idx) => {
        if (colors.includes(color)) {
          dataRow.push(color);
          sizes.forEach(size => {
            dataRow.push(map[`${color}||${size}`] || 0);
          });
          const rowTotal = sizes.reduce((sum, size) => sum + (map[`${color}||${size}`] || 0), 0);
          dataRow.push(rowTotal);
        } else {
          dataRow.push('');
          sizes.forEach(() => dataRow.push(''));
          dataRow.push('');
        }
        // Add 2 empty columns as spacing
        if (idx < matrices.length - 1) {
          dataRow.push('', '');
        }
      });
      
      rows.push(dataRow);
    }
    
    // Total row
    const totalRow = [];
    matrices.forEach(({ colors, map, sizes }, idx) => {
      totalRow.push('TOTAL');
      sizes.forEach(size => {
        const total = colors.reduce((sum, color) => sum + (map[`${color}||${size}`] || 0), 0);
        totalRow.push(total);
      });
      const grandTotal = sizes.reduce((sum, size) => 
        sum + colors.reduce((s2, color) => s2 + (map[`${color}||${size}`] || 0), 0), 0
      );
      totalRow.push(grandTotal);
      // Add 2 empty columns as spacing
      if (idx < matrices.length - 1) {
        totalRow.push('', '');
      }
    });
    rows.push(totalRow);
    
    // Empty row between batches
    rows.push([]);
  }
  
  return rows;
}

function payStatusStyle(status) {
  const s = (status||'').toLowerCase();
  if (s==='paid') return { background:'#dcfce7', color:'#166534' };
  if (s==='partial') return { background:'#fef9c3', color:'#854d0e' };
  return { background:'#fee2e2', color:'#991b1b' };
}


// ─── Shared UI Components ──────────────────────────────────────────────────────
function Skeleton({ w='100%', h=16 }) {
  return <div className="rp-skeleton" style={{ width:w, height:h }} />;
}

function Spinner({ label='Loading...' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 20px', gap:10, color:'#6b7280', fontSize:13 }}>
      <span className="rp-spinner" />
      {label}
    </div>
  );
}

function Empty({ msg='No data found for the selected period.' }) {
  return (
    <div className="rp-empty">
      <span style={{ fontSize:32 }}>📭</span>
      <span style={{ fontSize:13 }}>{msg}</span>
    </div>
  );
}

function SectionCard({ title, icon, children, onDownload }) {
  return (
    <div className="rp-section-card">
      <div className="rp-section-header">
        <span className="rp-section-title">
          {icon && <span>{icon}</span>}
          {title}
        </span>
        {onDownload && (
          <button className="rp-btn-ghost" onClick={onDownload} style={{ padding:'5px 12px', fontSize:12 }}>
            ⬇ CSV
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// New: Design selector component
function DesignSelector({ designs, selectedDesign, setSelectedDesign, label="Filter by Design" }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
      <span style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase' }}>{label}</span>
      <select 
        className="rp-select" 
        value={selectedDesign} 
        onChange={e => setSelectedDesign(e.target.value)}
        style={{ minWidth:180 }}
      >
        <option value="all">All Designs</option>
        {designs.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
    </div>
  );
}

// ─── Shared UI Components ──────────────────────────────────────────────────────
// NOTE: ALL shared components must be defined BEFORE any report component

function MatrixTable({ matrixColors, matrixSizes, matrixMap, getColorCode, autoDetectSizes = false, rawData = [] }) {
  // If sizes not provided or empty, extract from data
  let sizes = matrixSizes;
  
  if (autoDetectSizes && rawData.length > 0) {
    const detectedSizes = [...new Set(rawData.map(r => r.size).filter(s => s && s !== '—'))];
    
    // If matrixSizes (from hook) is provided and has values, use it as the canonical order
    if (matrixSizes && matrixSizes.length > 0) {
      // Sort detected sizes by the order in matrixSizes
      sizes = matrixSizes.filter(s => detectedSizes.includes(s));
    } else {
      // Fallback: use standard size order
      const sizeOrder = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '28', '30', '32', '34', '36', '38', '40', '42'];
      sizes = detectedSizes.sort((a, b) => {
        const indexA = sizeOrder.indexOf(a);
        const indexB = sizeOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }
  }
  
  if (!matrixColors || matrixColors.length === 0) return <Empty msg="No data for selected design" />;
  if (!sizes || sizes.length === 0) return <Empty msg="No sizes available" />;
  
  const grandTotal = matrixColors.reduce((sum, cn) =>
    sum + sizes.reduce((s2, sz) => s2 + (matrixMap[`${cn}||${sz}`]||0), 0), 0);
    
  return (
    <div className="rp-matrix-wrap">
      <table className="rp-table" style={{ width:'100%' }}>
        <thead>
          <tr>
            <th className="rp-label-col">Color / Size</th>
            {sizes.map(s => <th key={s} className="rp-num">{s}</th>)}
            <th className="rp-num" style={{ background:'#f0fdf4', color:'#0f766e' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {matrixColors.map(cn => {
            const rowData = sizes.map(s => matrixMap[`${cn}||${s}`]||0);
            const rowTotal = rowData.reduce((a,b)=>a+b,0);
            return (
              <tr key={cn}>
                <td className="rp-label-col">
                  <div style={{ display:'flex', alignItems:'center' }}>
                    <span className="rp-color-dot" style={{ background: getColorCode ? getColorCode(cn) : '#ccc' }} />
                    {cn}
                  </div>
                </td>
                {rowData.map((v,i) => (
                  <td key={i} className="rp-num" style={{ color: v>0?'#1e293b':'#cbd5e1' }}>
                    {v > 0 ? fmt(v) : '—'}
                  </td>
                ))}
                <td className="rp-num" style={{ fontWeight:700, color:'#0f766e', background:'#f0fdf4' }}>{fmt(rowTotal)}</td>
              </tr>
            );
          })}
          <tr className="rp-total-row">
            <td className="rp-label-col">TOTAL</td>
            {sizes.map(s => {
              const t = matrixColors.reduce((sum,cn) => sum+(matrixMap[`${cn}||${s}`]||0), 0);
              return <td key={s} className="rp-num">{fmt(t)}</td>;
            })}
            <td className="rp-num">{fmt(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function FilterBar({ filterMode, setFilterMode, month, setMonth, year, setYear,
  customFrom, setCustomFrom, customTo, setCustomTo,
  accounts=[], selectedAccount, setSelectedAccount, onApply, loading }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
      <select className="rp-select" value={filterMode} onChange={e => setFilterMode(e.target.value)} style={{ minWidth:130 }}>
        <option value="month">Month</option>
        <option value="custom">Custom Range</option>
        <option value="all">All Time</option>
      </select>
      {filterMode === 'month' && (
        <>
          <select className="rp-select" value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select className="rp-select" value={year} onChange={e => setYear(Number(e.target.value))}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </>
      )}
      {filterMode === 'custom' && (
        <>
          <input type="date" className="rp-input" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
          <span style={{ color:'#9ca3af', fontSize:12 }}>to</span>
          <input type="date" className="rp-input" value={customTo} onChange={e => setCustomTo(e.target.value)} />
        </>
      )}
      {accounts.length > 0 && (
        <select className="rp-select" value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}>
          <option value="all">All Accounts</option>
          {accounts.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      )}
      {/*<button className="rp-btn-primary" onClick={onApply} disabled={loading}>
        {loading ? <span className="rp-spinner" style={{ width:14, height:14 }} /> : '🔍'}
        Apply
      </button>*/}
    </div>
  );
}

// ─── Report Components ─────────────────────────────────────────────────────────

function SalesReport({ filters={}, colors, sizes=[], getColorCode, channel='marketplace' }) {
  const { startDate=null, endDate=null, account='all' } = filters;
  const { getSizesForDesign } = useEnabledSizes(); // Add this
  const [matrixRows, setMatrixRows] = useState([]);
  const [detailRows, setDetailRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState('all');

  useEffect(() => { load(); }, [JSON.stringify(filters)]);

  async function load() {
    setLoading(true);
    try {
      if (channel === 'marketplace') {
        const res = await salesService.getAllSales(
          account === 'all' ? 'all' : account,
          'all', startDate, endDate, 1, 99999
        );
        const items = res?.data?.data || res?.data || res?.orders || [];
        const flat = items.map(s => ({
          color: s.color || '—', size: s.size || '—',
          quantity: s.quantity ?? 1,
          saleDate: s.saleDate || s.dispatchDate || s.createdAt,
          design: s.design || '—', accountName: s.accountName || '—',
          status: s.status || '—', _id: s._id,
        }));
        setMatrixRows(flat);
        setDetailRows([...flat].sort((a,b) => new Date(b.saleDate)-new Date(a.saleDate)));

      } else if (channel === 'direct') {
        const res = await directSalesService.getAllDirectSales();
        let items = Array.isArray(res) ? res : (res?.data || res?.sales || []);
        if (startDate || endDate) {
          items = items.filter(s => {
            const d = new Date(s.saleDate || s.createdAt);
            if (startDate && d < new Date(startDate)) return false;
            if (endDate && d > new Date(endDate+'T23:59:59')) return false;
            return true;
          });
        }
        const flat = [];
        for (const sale of items) {
          for (const item of (sale.items||[])) {
            flat.push({
              color: item.color||'—', size: item.size||'—',
              quantity: item.quantity||1,
              saleDate: sale.saleDate||sale.createdAt,
              design: item.design||'—',
              customerName: sale.customerName||'Walk-in',
              price: item.price||item.rate||0,
            });
          }
        }
        setMatrixRows(flat);
        setDetailRows([...flat].sort((a,b) => new Date(b.saleDate)-new Date(a.saleDate)));
      }
    } catch(e) { console.error('[SalesReport]',e); }
    finally { setLoading(false); }
  }

  const allDesigns = useMemo(() => {
    const designs = [...new Set(matrixRows.map(r => r.design).filter(d => d && d !== '—'))];
    return designs.sort();
  }, [matrixRows]);

  // Get sizes for the selected design
  const designSizes = useMemo(() => {
    if (selectedDesign === 'all') {
      // For 'all', show union of all sizes from data
      return [...new Set(matrixRows.map(r => r.size).filter(s => s && s !== '—'))].sort();
    }
    // Get sizes specific to this design from hook
    return getSizesForDesign(selectedDesign);
  }, [selectedDesign, matrixRows, getSizesForDesign]);

  const { matrixColors, matrixMap } = useMemo(() => 
    buildSingleDesignMatrix(matrixRows, selectedDesign, designSizes),
    [matrixRows, selectedDesign, designSizes]
  );

  useEffect(() => {
    if (allDesigns.length > 0 && !allDesigns.includes(selectedDesign) && selectedDesign !== 'all') {
      setSelectedDesign('all');
    }
  }, [allDesigns]);

  function handleDownload() {
    const rows = [];
    rows.push([`Sales Report - ${channel} - Matrices by Design`]);
    rows.push([]);
    
    if (allDesigns.length > 0) {
      // For CSV, pass getSizesForDesign function
      const matrixCSV = buildMultiDesignCSV(allDesigns, matrixRows, sizes, getSizesForDesign);
      rows.push(...matrixCSV);
    }
    
    rows.push([]);
    rows.push(['=== DETAILED BREAKDOWN ===']);
    rows.push([]);
    
    if (channel === 'marketplace') {
      rows.push(['Date','Design','Color','Size','Qty','Account','Status']);
      detailRows.forEach(r => {
        rows.push([fmtDate(r.saleDate),r.design,r.color,r.size,r.quantity,r.accountName,r.status]);
      });
    } else {
      rows.push(['Date','Design','Color','Size','Qty','Customer','Price']);
      detailRows.forEach(r => {
        rows.push([fmtDate(r.saleDate),r.design,r.color,r.size,r.quantity,r.customerName,r.price]);
      });
    }
    
    downloadCSV(`sales-${channel}-${Date.now()}.csv`, rows);
  }

  if (loading) return <Spinner />;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <SectionCard title="Sales Matrix — Color × Size" icon="📊" onDownload={handleDownload}>
        <div style={{ padding:16 }}>
          <DesignSelector 
            designs={allDesigns} 
            selectedDesign={selectedDesign} 
            setSelectedDesign={setSelectedDesign}
          />
          <MatrixTable 
            matrixColors={matrixColors} 
            matrixSizes={designSizes}
            matrixMap={matrixMap} 
            getColorCode={getColorCode}
            autoDetectSizes={false}
            rawData={matrixRows}
          />
        </div>
      </SectionCard>
      <SectionCard title="Detailed Sales" icon="📋">
        {detailRows.length === 0 ? <Empty /> : (
          <div className="rp-scrollable-table">
            <table className="rp-table" style={{ width:'100%' }}>
              <thead>
                <tr>
                  <th>Date</th><th>Design</th><th>Color</th><th>Size</th>
                  <th className="rp-num">Qty</th>
                  {channel==='marketplace' ? <><th>Account</th><th>Status</th></> : <><th>Customer</th><th className="rp-num">Price</th></>}
                </tr>
              </thead>
              <tbody>
                {detailRows.map((r,i) => (
                  <tr key={i}>
                    <td>{fmtDate(r.saleDate)}</td>
                    <td style={{ fontWeight:500 }}>{r.design}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center' }}>
                        <span className="rp-color-dot" style={{ background: getColorCode?getColorCode(r.color):'#ccc' }} />
                        {r.color}
                      </div>
                    </td>
                    <td>{r.size}</td>
                    <td className="rp-num">{fmt(r.quantity)}</td>
                    {channel==='marketplace'
                      ? <><td>{r.accountName}</td><td><span className="rp-badge" style={payStatusStyle(r.status)}>{r.status}</span></td></>
                      : <><td>{r.customerName}</td><td className="rp-num">{fmtCur(r.price)}</td></>
                    }
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function NetSalesReport({ filters={}, sizes=[], getColorCode }) {
  const { startDate=null, endDate=null, account='all' } = filters;
  const { getSizesForDesign } = useEnabledSizes(); // Add this
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState('all');

  useEffect(() => { load(); }, [JSON.stringify(filters)]);

  async function load() {
    setLoading(true);
    try {
      const res = await salesService.getAllSales(
        account==='all'?'all':account, 'all', startDate, endDate, 1, 99999
      );
      const all = res?.data?.data || res?.data || res?.orders || [];
      const positive = ['delivered','dispatched'];
      const negative = ['rto','wrongreturn','wrong return','returned'];
      const net = {};
      for (const s of all) {
        const key = `${s.design}||${s.color}||${s.size}`;
        if (!net[key]) net[key] = { design: s.design||'—', color:s.color, size:s.size, quantity:0 };
        const st = (s.status||'').toLowerCase().replace(/\s/g,'');
        if (positive.includes(st)) net[key].quantity += (s.quantity??1);
        if (negative.includes(st)) net[key].quantity -= (s.quantity??1);
      }
      setRows(Object.values(net));
    } catch(e) { console.error('[NetSalesReport]',e); }
    finally { setLoading(false); }
  }

  const allDesigns = useMemo(() => {
    const designs = [...new Set(rows.map(r => r.design).filter(d => d && d !== '—'))];
    return designs.sort();
  }, [rows]);

  const designSizes = useMemo(() => {
    if (selectedDesign === 'all') {
      return [...new Set(rows.map(r => r.size).filter(s => s && s !== '—'))].sort();
    }
    return getSizesForDesign(selectedDesign);
  }, [selectedDesign, rows, getSizesForDesign]);

  const { matrixColors, matrixMap } = useMemo(() => 
    buildSingleDesignMatrix(rows, selectedDesign, designSizes),
    [rows, selectedDesign, designSizes]
  );

  useEffect(() => {
    if (allDesigns.length > 0 && !allDesigns.includes(selectedDesign) && selectedDesign !== 'all') {
      setSelectedDesign('all');
    }
  }, [allDesigns]);

  function handleDownload() {
    const csvRows = [];
    csvRows.push(['Net Sales Report - All Designs']);
    csvRows.push([]);
    
    if (allDesigns.length > 0) {
      const matrixCSV = buildMultiDesignCSV(allDesigns, rows, sizes, getSizesForDesign);
      csvRows.push(...matrixCSV);
    }
    
    downloadCSV(`net-sales-${Date.now()}.csv`, csvRows);
  }

  if (loading) return <Spinner />;
  return (
    <SectionCard title="Net Sales — Color × Size" icon="📈" onDownload={handleDownload}>
      <div style={{ padding:16 }}>
        <DesignSelector 
          designs={allDesigns} 
          selectedDesign={selectedDesign} 
          setSelectedDesign={setSelectedDesign}
        />
        <MatrixTable 
          matrixColors={matrixColors} 
          matrixSizes={designSizes}
          matrixMap={matrixMap} 
          getColorCode={getColorCode}
          autoDetectSizes={false}
          rawData={rows}
        />
      </div>
    </SectionCard>
  );
}

function ReturnTypeReport({ filters={}, status, title, icon }) {
  const { startDate=null, endDate=null, account='all' } = filters;
  const { getColorCode } = useColorPalette();
  const { sizes, getSizesForDesign } = useEnabledSizes();
  
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState('all');

  useEffect(() => { load(); }, [JSON.stringify(filters), status]);

  // Helper function - matches backend's getDisplayDate logic
  function getDisplayDate(sale) {
    const returnStatuses = ['returned', 'cancelled', 'wrongreturn', 'RTO'];
    
    // If current status is a return-type status
    if (returnStatuses.includes(sale.status)) {
      const statusHistory = sale.statusHistory;
      
      // Check if statusHistory exists and has entries
      if (statusHistory && Array.isArray(statusHistory) && statusHistory.length > 0) {
        // Search backwards (most recent first)
        for (let i = statusHistory.length - 1; i >= 0; i--) {
          const entry = statusHistory[i];
          
          // Make sure entry and newStatus exist
          if (entry && entry.newStatus && returnStatuses.includes(entry.newStatus)) {
            // Make sure changedAt exists
            if (entry.changedAt) {
              return new Date(entry.changedAt).toISOString().split('T')[0];
            }
          }
        }
      }
    }
    
    // Default: use dispatch date (saleDate)
    return new Date(sale.saleDate || sale.createdAt).toISOString().split('T')[0];
  }

  async function load() {
    setLoading(true);
    try {
      // Fetch ALL orders with the specific status (no date filter on API)
      const res = await salesService.getAllSales(
        account === 'all' ? 'all' : account,
        status, 
        null, // Don't send startDate
        null, // Don't send endDate
        1, 
        99999
      );
      
      const allOrders = res?.data?.data || res?.data || res?.orders || [];
      
      // Filter by displayDate (return date) on frontend
      let filtered = allOrders;
      
      if (startDate || endDate) {
        filtered = allOrders.filter(order => {
          const displayDate = getDisplayDate(order);
          const displayDateObj = new Date(displayDate);
          
          if (startDate && displayDateObj < new Date(startDate)) return false;
          if (endDate && displayDateObj > new Date(endDate + 'T23:59:59')) return false;
          return true;
        });
      }
      
      // Attach displayDate to each order for table display
      const ordersWithDisplayDate = filtered.map(order => ({
        ...order,
        displayDate: getDisplayDate(order)
      }));
      
      console.log(`[${title}] Total returns:`, ordersWithDisplayDate.length);
      setReturns(ordersWithDisplayDate);
    } catch(e) { 
      console.error(`[${title}]`, e); 
    }
    finally { setLoading(false); }
  }

  // Extract items for matrix
  const matrixItems = useMemo(() => {
    return returns.map(r => ({
      design: r.design || '—',
      color: r.color || '—',
      size: r.size || '—',
      quantity: r.quantity || 0
    }));
  }, [returns]);

  // Get all unique designs
  const allDesigns = useMemo(() => {
    const designs = [...new Set(matrixItems.map(item => item.design).filter(d => d && d !== '—'))];
    return designs.sort();
  }, [matrixItems]);

  // Filter matrix items by selected design
  const designMatrixItems = useMemo(() => {
    if (selectedDesign === 'all') return matrixItems;
    return matrixItems.filter(item => item.design === selectedDesign);
  }, [matrixItems, selectedDesign]);

  // Get sizes for selected design
  const designSizes = useMemo(() => {
    if (selectedDesign === 'all') {
      return [...new Set(matrixItems.map(item => item.size).filter(s => s && s !== '—'))].sort();
    }
    return getSizesForDesign(selectedDesign);
  }, [selectedDesign, matrixItems, getSizesForDesign]);

  // Build matrix for selected design
  const { matrixColors, matrixMap } = useMemo(() => {
    const colors = [];
    const map = {};
    
    for (const item of designMatrixItems) {
      const key = `${item.color}||${item.size}`;
      map[key] = (map[key] || 0) + item.quantity;
      if (!colors.includes(item.color)) colors.push(item.color);
    }
    
    return { matrixColors: colors, matrixMap: map };
  }, [designMatrixItems]);

  const totalQty = returns.reduce((sum, r) => sum + (r.quantity || 0), 0);

  function handleCSV() {
    const rows = [
      [title],
      ['Total Returns:', returns.length, 'Total Qty:', totalQty],
      [],
      ['=== MATRIX ==='],
      []
    ];
    
    // Add matrix CSV
    const matrixCSV = buildMultiDesignCSV(allDesigns, matrixItems, sizes, getSizesForDesign);
    rows.push(...matrixCSV);
    
    rows.push([]);
    rows.push(['=== DETAILS ===']);
    rows.push([]);
    rows.push(['Return Date', 'Order Date', 'SKU', 'Design', 'Color', 'Size', 'Qty', 'Account', 'Tracking ID']);
    
    returns.forEach(r => {
      rows.push([
        fmtDate(r.displayDate),
        fmtDate(r.saleDate || r.createdAt),
        r.sku || '—',
        r.design || '—',
        r.color || '—',
        r.size || '—',
        r.quantity || 0,
        r.accountName || '—',
        r.trackingId || '—'
      ]);
    });
    
    downloadCSV(`${status}-returns-${Date.now()}.csv`, rows);
  }

  if (loading) return <Spinner />;

  return (
    <SectionCard title={title} icon={icon} onDownload={handleCSV}>
      {returns.length === 0 ? (
        <Empty msg={`No ${status} returns found for this period.`} />
      ) : (
        <>
          {/* Summary Stats */}
          <div style={{ padding:'10px 18px', background:'#fef2f2', borderBottom:'1px solid #fecaca', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
            <div style={{ display:'flex', gap:24 }}>
              <span style={{ fontSize:13, color:'#dc2626', fontWeight:600 }}>
                Total Returns: <span style={{ fontSize:16, fontWeight:800 }}>{returns.length}</span>
              </span>
              <span style={{ fontSize:13, color:'#dc2626', fontWeight:600 }}>
                Total Qty: <span style={{ fontSize:16, fontWeight:800 }}>{totalQty}</span>
              </span>
            </div>
          </div>

          {/* Matrix Section */}
          {matrixItems.length > 0 && (
            <div style={{ padding:16, borderBottom:'1px solid #e2e8f0' }}>
              <div style={{ marginBottom:12, fontSize:13, fontWeight:600, color:'#64748b', textTransform:'uppercase' }}>
                Return Matrix
              </div>
              
              {/* Design Selector */}
              <div style={{ marginBottom:16 }}>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button 
                    onClick={() => setSelectedDesign('all')}
                    style={{
                      padding:'6px 14px', 
                      borderRadius:8,
                      border:`2px solid ${selectedDesign==='all'?'#dc2626':'#e2e8f0'}`,
                      background: selectedDesign==='all'?'#fef2f2':'#fff',
                      cursor:'pointer', 
                      fontSize:12, 
                      fontWeight:600,
                      color: selectedDesign==='all'?'#dc2626':'#374151',
                      transition:'all 0.15s'
                    }}
                  >
                    All Designs ({allDesigns.length})
                  </button>
                  {allDesigns.map((design) => {
                    const designQty = matrixItems
                      .filter(item => item.design === design)
                      .reduce((sum, item) => sum + item.quantity, 0);
                    
                    return (
                      <button 
                        key={design}
                        onClick={() => setSelectedDesign(design)}
                        style={{
                          padding:'6px 14px', 
                          borderRadius:8,
                          border:`2px solid ${selectedDesign===design?'#dc2626':'#e2e8f0'}`,
                          background: selectedDesign===design?'#fef2f2':'#fff',
                          cursor:'pointer', 
                          fontSize:12, 
                          fontWeight:600,
                          color: selectedDesign===design?'#dc2626':'#374151',
                          display:'flex', 
                          alignItems:'center', 
                          gap:6,
                          transition:'all 0.15s'
                        }}
                      >
                        {design} <span style={{ color:'#6b7280', fontWeight:400 }}>({fmt(designQty)})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Matrix Table */}
              <MatrixTable 
                matrixColors={matrixColors}
                matrixSizes={designSizes}
                matrixMap={matrixMap}
                getColorCode={getColorCode}
                autoDetectSizes={false}
                rawData={designMatrixItems}
              />
            </div>
          )}
          
          {/* Details Table */}
          <div style={{ overflowX:'auto' }}>
            <table className="rp-table" style={{ width:'100%', minWidth:'max-content' }}>
              <thead>
                <tr>
                  <th style={{ minWidth:90 }}>Return Date</th>
                  <th style={{ minWidth:90 }}>Order Date</th>
                  <th style={{ minWidth:120 }}>SKU</th>
                  <th style={{ minWidth:100 }}>Design</th>
                  <th style={{ minWidth:80 }}>Color</th>
                  <th style={{ minWidth:60 }}>Size</th>
                  <th className="rp-num" style={{ minWidth:50 }}>Qty</th>
                  <th style={{ minWidth:100 }}>Account</th>
                  <th style={{ minWidth:120 }}>Tracking ID</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:600, color:'#dc2626' }}>
                      {fmtDate(r.displayDate)}
                    </td>
                    <td>{fmtDate(r.saleDate || r.createdAt)}</td>
                    <td style={{ fontFamily:'monospace', fontSize:11 }}>{r.sku || '—'}</td>
                    <td style={{ fontWeight:500 }}>{r.design || '—'}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ 
                          width:16, 
                          height:16, 
                          borderRadius:4, 
                          border:'1px solid #e2e8f0',
                          background: getColorCode(r.color) 
                        }} />
                        {r.color || '—'}
                      </div>
                    </td>
                    <td>{r.size || '—'}</td>
                    <td className="rp-num" style={{ fontWeight:600 }}>{r.quantity || 0}</td>
                    <td style={{ fontSize:12 }}>{r.accountName || '—'}</td>
                    <td style={{ fontFamily:'monospace', fontSize:11, color:'#6b7280' }}>
                      {r.trackingId || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SectionCard>
  );
}

function BestDesigns({ filters={} }) {
  const { startDate=null, endDate=null } = filters;
  const { getColorCode } = useColorPalette();
  const { sizes, getSizesForDesign } = useEnabledSizes();
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState('all');

  // Load ALL wholesale orders (no date filter on API)
  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: 99999 });
    
    wholesaleService.getAllOrders(qs.toString())
      .then(res => {
        const orders = res?.data?.orders || res?.orders || res?.data || [];
        setAllOrders(orders);
      })
      .catch(e => console.error('[BestDesigns] Error loading orders:', e))
      .finally(() => setLoading(false));
  }, []); // Only load once

  // Filter orders respecting date filters
  const filteredOrders = useMemo(() => {
    if (!startDate && !endDate) return allOrders;
    
    return allOrders.filter(order => {
      const orderDate = new Date(order.orderDate || order.createdAt);
      if (startDate && orderDate < new Date(startDate)) return false;
      if (endDate && orderDate > new Date(endDate + 'T23:59:59')) return false;
      return true;
    });
  }, [allOrders, startDate, endDate]);

  // Extract items from FILTERED orders (for matrix)
  const filteredMatrixItems = useMemo(() => {
    const items = [];
    for (const order of filteredOrders) {
      for (const item of (order.items || [])) {
        items.push({
          design: item.design || '—',
          color: item.color || '—',
          size: item.size || '—',
          quantity: item.quantity || 0,
          pricePerUnit: item.pricePerUnit || item.rate || 0
        });
      }
    }
    return items;
  }, [filteredOrders]);

  // Get all unique designs from FILTERED data
  const allDesigns = useMemo(() => {
    const designs = [...new Set(filteredMatrixItems.map(item => item.design).filter(d => d && d !== '—'))];
    return designs.sort();
  }, [filteredMatrixItems]);

  // Set initial design when designs load
  useEffect(() => {
    if (allDesigns.length > 0 && !allDesigns.includes(selectedDesign) && selectedDesign !== 'all') {
      setSelectedDesign('all');
    }
  }, [allDesigns, selectedDesign]);

  // Filter matrix items by selected design
  const designMatrixItems = useMemo(() => {
    if (selectedDesign === 'all') return filteredMatrixItems;
    return filteredMatrixItems.filter(item => item.design === selectedDesign);
  }, [filteredMatrixItems, selectedDesign]);

  // Get sizes for selected design
  const designSizes = useMemo(() => {
    if (selectedDesign === 'all') {
      return [...new Set(filteredMatrixItems.map(item => item.size).filter(s => s && s !== '—'))].sort();
    }
    return getSizesForDesign(selectedDesign);
  }, [selectedDesign, filteredMatrixItems, getSizesForDesign]);

  // Build matrix for selected design
  const { matrixColors, matrixMap } = useMemo(() => {
    const colors = [];
    const map = {};
    
    for (const item of designMatrixItems) {
      const key = `${item.color}||${item.size}`;
      map[key] = (map[key] || 0) + item.quantity;
      if (!colors.includes(item.color)) colors.push(item.color);
    }
    
    return { matrixColors: colors, matrixMap: map };
  }, [designMatrixItems]);

  // Calculate design stats from FILTERED orders (for rankings)
  const designStats = useMemo(() => {
    const stats = {};
    
    for (const order of filteredOrders) {
      for (const item of (order.items || [])) {
        const design = item.design || 'Unknown';
        if (!stats[design]) {
          stats[design] = { 
            design, 
            totalQty: 0, 
            totalRevenue: 0
          };
        }
        stats[design].totalQty += item.quantity || 0;
        stats[design].totalRevenue += (item.quantity || 0) * (item.pricePerUnit || item.rate || 0);
      }
    }
    
    // Convert to array and sort by quantity
    return Object.values(stats).sort((a, b) => b.totalQty - a.totalQty);
  }, [filteredOrders]);

  const totalQty = filteredMatrixItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalRevenue = designStats.reduce((sum, d) => sum + d.totalRevenue, 0);

  function handleCSV() {
    const rows = [
      ['Best Selling Designs - Wholesale'],
      [`Total Designs: ${designStats.length}`, `Total Units: ${totalQty}`, `Total Revenue: ${totalRevenue}`],
      [],
      ['=== SALES MATRIX ==='],
      []
    ];
    
    // Add matrices for all designs
    const matrixCSV = buildMultiDesignCSV(allDesigns, filteredMatrixItems, sizes, getSizesForDesign);
    rows.push(...matrixCSV);
    
    rows.push([]);
    rows.push(['=== DESIGN RANKINGS ===']);
    rows.push([]);
    rows.push(['Rank', 'Design', 'Total Qty', 'Revenue', 'Avg Price', '% of Total']);
    
    designStats.forEach((d, i) => {
      const avgPrice = d.totalQty > 0 ? d.totalRevenue / d.totalQty : 0;
      const percentage = totalQty > 0 ? (d.totalQty / totalQty * 100) : 0;
      rows.push([
        i + 1,
        d.design,
        d.totalQty,
        d.totalRevenue.toFixed(2),
        avgPrice.toFixed(2),
        percentage.toFixed(1) + '%'
      ]);
    });
    
    downloadCSV(`best-designs-wholesale-${Date.now()}.csv`, rows);
  }

  if (loading) return <Spinner />;

  return (
    <div className="rp-animate">
      {filteredOrders.length === 0 ? (
        <Empty msg="No design data available for selected period" />
      ) : (
        <>
          {/* Matrix Section */}
          <div className="rp-section-card" style={{ marginBottom:16 }}>
            <div className="rp-section-header">
              <span className="rp-section-title">📊 Sales Matrix</span>
              <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                <span style={{ fontSize:14, fontWeight:700, color:'#0f766e' }}>
                  Total Units: {fmt(totalQty)}
                </span>
                {designStats.length > 0 && (
                  <button className="rp-btn-ghost" onClick={handleCSV}>⬇ CSV</button>
                )}
              </div>
            </div>
            <div style={{ padding:16 }}>
              {/* Design Selector */}
              <div style={{ marginBottom:16 }}>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button 
                    onClick={() => setSelectedDesign('all')}
                    style={{
                      padding:'6px 14px', 
                      borderRadius:8,
                      border:`2px solid ${selectedDesign==='all'?'#0f766e':'#e2e8f0'}`,
                      background: selectedDesign==='all'?'#f0fdf4':'#fff',
                      cursor:'pointer', 
                      fontSize:12, 
                      fontWeight:600,
                      color: selectedDesign==='all'?'#0f766e':'#374151',
                      transition:'all 0.15s'
                    }}
                  >
                    All Designs ({allDesigns.length})
                  </button>
                  {allDesigns.map((design) => {
                    const designQty = filteredMatrixItems
                      .filter(item => item.design === design)
                      .reduce((sum, item) => sum + item.quantity, 0);
                    
                    return (
                      <button 
                        key={design}
                        onClick={() => setSelectedDesign(design)}
                        style={{
                          padding:'6px 14px', 
                          borderRadius:8,
                          border:`2px solid ${selectedDesign===design?'#0f766e':'#e2e8f0'}`,
                          background: selectedDesign===design?'#f0fdf4':'#fff',
                          cursor:'pointer', 
                          fontSize:12, 
                          fontWeight:600,
                          color: selectedDesign===design?'#0f766e':'#374151',
                          display:'flex', 
                          alignItems:'center', 
                          gap:6,
                          transition:'all 0.15s'
                        }}
                      >
                        {design} <span style={{ color:'#6b7280', fontWeight:400 }}>({fmt(designQty)})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Matrix Table */}
              <MatrixTable 
                matrixColors={matrixColors}
                matrixSizes={designSizes}
                matrixMap={matrixMap}
                getColorCode={getColorCode}
                autoDetectSizes={false}
                rawData={designMatrixItems}
              />
            </div>
          </div>

          {/* Rankings Section */}
          <div className="rp-section-card">
            <div className="rp-section-header">
              <span className="rp-section-title">🏆 Design Rankings</span>
            </div>
            
            {/* Summary Stats */}
            <div style={{ padding:'10px 18px', background:'#f0fdf4', borderBottom:'1px solid #bbf7d0', display:'flex', gap:24, flexWrap:'wrap' }}>
              <span style={{ fontSize:13, color:'#0f766e', fontWeight:600 }}>
                Total Designs: <span style={{ fontSize:16, fontWeight:800 }}>{designStats.length}</span>
              </span>
              <span style={{ fontSize:13, color:'#0f766e', fontWeight:600 }}>
                Total Units: <span style={{ fontSize:16, fontWeight:800 }}>{fmt(totalQty)}</span>
              </span>
              <span style={{ fontSize:13, color:'#0f766e', fontWeight:600 }}>
                Total Revenue: <span style={{ fontSize:16, fontWeight:800 }}>{fmtCur(totalRevenue)}</span>
              </span>
            </div>

            {/* Design Stats Table */}
            <div style={{ overflowX:'auto' }}>
              <table className="rp-table" style={{ width:'100%' }}>
                <thead>
                  <tr>
                    <th style={{ width:60 }}>Rank</th>
                    <th style={{ minWidth:120 }}>Design</th>
                    <th className="rp-num" style={{ minWidth:80 }}>Total Qty</th>
                    <th className="rp-num" style={{ minWidth:100 }}>Revenue</th>
                    <th className="rp-num" style={{ minWidth:90 }}>Avg Price</th>
                    <th style={{ minWidth:120 }}>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {designStats.map((d, i) => {
                    const avgPrice = d.totalQty > 0 ? d.totalRevenue / d.totalQty : 0;
                    const percentage = totalQty > 0 ? (d.totalQty / totalQty * 100) : 0;
                    
                    return (
                      <tr key={d.design}>
                        <td style={{ textAlign:'center', fontWeight:600, color:'#6b7280' }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </td>
                        <td style={{ fontWeight:600, fontSize:14 }}>{d.design}</td>
                        <td className="rp-num" style={{ fontWeight:700, color:'#0f766e' }}>{fmt(d.totalQty)}</td>
                        <td className="rp-num" style={{ fontWeight:600 }}>{fmtCur(d.totalRevenue)}</td>
                        <td className="rp-num">{fmtCur(avgPrice)}</td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ 
                              flex:1, 
                              height:8, 
                              background:'#e2e8f0', 
                              borderRadius:4, 
                              overflow:'hidden' 
                            }}>
                              <div style={{ 
                                width:`${percentage}%`, 
                                height:'100%', 
                                background:'linear-gradient(90deg, #10b981, #059669)',
                                transition:'width 0.3s ease'
                              }} />
                            </div>
                            <span style={{ fontSize:12, fontWeight:600, color:'#6b7280', minWidth:45 }}>
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WholesaleOrdersReport({ filters={} }) {
  const { startDate=null, endDate=null } = filters;
  const { getColorCode } = useColorPalette();
  const { sizes, getSizesForDesign } = useEnabledSizes();
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [selectedDesign, setSelectedDesign] = useState('all');

  // Load ALL wholesale orders (no date filter on API)
  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: 99999 });
    
    wholesaleService.getAllOrders(qs.toString())
      .then(res => {
        const orders = res?.data?.orders || res?.orders || res?.data || [];
        setAllOrders(orders);
      })
      .catch(e => console.error('[WholesaleOrders] Error loading orders:', e))
      .finally(() => setLoading(false));
  }, []); // Only load once

  // Filter orders respecting date filters
  const filteredOrders = useMemo(() => {
    if (!startDate && !endDate) return allOrders;
    
    return allOrders.filter(order => {
      const orderDate = new Date(order.orderDate || order.createdAt);
      if (startDate && orderDate < new Date(startDate)) return false;
      if (endDate && orderDate > new Date(endDate + 'T23:59:59')) return false;
      return true;
    });
  }, [allOrders, startDate, endDate]);

  // Extract items from FILTERED orders (for matrix display)
  const filteredMatrixItems = useMemo(() => {
    const items = [];
    for (const order of filteredOrders) {
      for (const item of (order.items || [])) {
        items.push({
          design: item.design || '—',
          color: item.color || '—',
          size: item.size || '—',
          quantity: item.quantity || 0
        });
      }
    }
    return items;
  }, [filteredOrders]);

  // Get all unique designs from FILTERED data
  const allDesigns = useMemo(() => {
    const designs = [...new Set(filteredMatrixItems.map(item => item.design).filter(d => d && d !== '—'))];
    return designs.sort();
  }, [filteredMatrixItems]);

  // Set initial design when designs load
  useEffect(() => {
    if (allDesigns.length > 0 && !allDesigns.includes(selectedDesign) && selectedDesign !== 'all') {
      setSelectedDesign('all');
    }
  }, [allDesigns, selectedDesign]);

  // Filter matrix items by selected design (from FILTERED data)
  const designMatrixItems = useMemo(() => {
    if (selectedDesign === 'all') return filteredMatrixItems;
    return filteredMatrixItems.filter(item => item.design === selectedDesign);
  }, [filteredMatrixItems, selectedDesign]);

  // Get sizes for selected design
  const designSizes = useMemo(() => {
    if (selectedDesign === 'all') {
      return [...new Set(filteredMatrixItems.map(item => item.size).filter(s => s && s !== '—'))].sort();
    }
    return getSizesForDesign(selectedDesign);
  }, [selectedDesign, filteredMatrixItems, getSizesForDesign]);

  // Build matrix for selected design (from FILTERED data)
  const { matrixColors, matrixMap } = useMemo(() => {
    const colors = [];
    const map = {};
    
    for (const item of designMatrixItems) {
      const key = `${item.color}||${item.size}`;
      map[key] = (map[key] || 0) + item.quantity;
      if (!colors.includes(item.color)) colors.push(item.color);
    }
    
    return { matrixColors: colors, matrixMap: map };
  }, [designMatrixItems]);

  // Calculate totals from FILTERED data
  const totalUnits = filteredMatrixItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalSpent = filteredOrders.reduce((s,o)=>s+(Number(o.totalAmount)||0),0);
  const totalPaid  = filteredOrders.reduce((s,o)=>s+(Number(o.amountPaid)||Number(o.paidAmount)||0),0);
  const totalDue   = filteredOrders.reduce((s,o)=>{
    const paid=Number(o.amountPaid)||Number(o.paidAmount)||0;
    return s+(Number(o.amountDue)||Math.max(0,(Number(o.totalAmount)||0)-paid));
  },0);

  const sortedOrders = useMemo(() =>
    [...filteredOrders].sort((a,b)=>new Date(b.orderDate||b.createdAt)-new Date(a.orderDate||a.createdAt)),
    [filteredOrders]);

  function handleCSV() {
    const rows = [
      ['Wholesale Orders Report'],
      [`Total Units: ${totalUnits}`, `Total Spent: ${totalSpent}`, `Total Paid: ${totalPaid}`, `Total Due: ${totalDue}`],
      [],
      ['=== SALES MATRIX ==='],
      []
    ];
    
    // Add matrices for all designs (use FILTERED data)
    const matrixCSV = buildMultiDesignCSV(allDesigns, filteredMatrixItems, sizes, getSizesForDesign);
    rows.push(...matrixCSV);
    
    rows.push([]);
    rows.push(['=== ORDER DETAILS ===']);
    rows.push([]);
    rows.push(['Date','Challan No','Buyer','Business','Design','Color','Size','Qty','Rate','Total','Paid','Due','Status']);
    
    for (const o of filteredOrders) {
      const paid=Number(o.amountPaid)||Number(o.paidAmount)||0;
      const due=Number(o.amountDue)||Math.max(0,(Number(o.totalAmount)||0)-paid);
      const buyerName = o.buyerId?.name || o.buyerName || '—';
      const businessName = o.buyerId?.businessName || o.businessName || '—';
      
      if (o.items?.length) {
        for (const item of o.items) {
          rows.push([fmtDate(o.orderDate||o.createdAt),o.challanNumber||'—',
            buyerName, businessName,
            item.design||'—',item.color||'—',item.size||'—',
            item.quantity||0,item.pricePerUnit||item.rate||0,
            o.totalAmount||0,paid,due,o.paymentStatus||'—']);
        }
      } else {
        rows.push([fmtDate(o.orderDate||o.createdAt),o.challanNumber||'—',
          buyerName, businessName,
          '—','—','—','—','—',o.totalAmount||0,paid,due,o.paymentStatus||'—']);
      }
    }
    downloadCSV(`wholesale-orders-${Date.now()}.csv`, rows);
  }

  return (
    <div className="rp-animate">
      {loading ? <Spinner /> : (
        <>
          {/* Summary Stats */}
          <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 16px', marginBottom:12, fontSize:13, display:'flex', gap:24, flexWrap:'wrap', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
              <span style={{ color:'#0f766e', fontWeight:600 }}>Spent: {fmtCur(totalSpent)}</span>
              <span style={{ color:'#059669', fontWeight:600 }}>Paid: {fmtCur(totalPaid)}</span>
              <span style={{ color:totalDue>0?'#dc2626':'#059669', fontWeight:700 }}>Due: {fmtCur(totalDue)}</span>
            </div>
            {filteredOrders.length>0 && <button className="rp-btn-ghost" onClick={handleCSV}>⬇ CSV</button>}
          </div>

          {/* Matrix Section */}
          {filteredOrders.length > 0 && (
            <div className="rp-section-card" style={{ marginBottom:16 }}>
              <div className="rp-section-header">
                <span className="rp-section-title">📊 Sales Matrix</span>
                <span style={{ fontSize:14, fontWeight:700, color:'#0f766e' }}>
                  Total Units: {fmt(totalUnits)}
                </span>
              </div>
              <div style={{ padding:16 }}>
                {/* Design Selector */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button 
                      onClick={() => setSelectedDesign('all')}
                      style={{
                        padding:'6px 14px', 
                        borderRadius:8,
                        border:`2px solid ${selectedDesign==='all'?'#0f766e':'#e2e8f0'}`,
                        background: selectedDesign==='all'?'#f0fdf4':'#fff',
                        cursor:'pointer', 
                        fontSize:12, 
                        fontWeight:600,
                        color: selectedDesign==='all'?'#0f766e':'#374151',
                        transition:'all 0.15s'
                      }}
                    >
                      All Designs ({allDesigns.length})
                    </button>
                    {allDesigns.map((design) => {
                      const designQty = filteredMatrixItems
                        .filter(item => item.design === design)
                        .reduce((sum, item) => sum + item.quantity, 0);
                      
                      return (
                        <button 
                          key={design}
                          onClick={() => setSelectedDesign(design)}
                          style={{
                            padding:'6px 14px', 
                            borderRadius:8,
                            border:`2px solid ${selectedDesign===design?'#0f766e':'#e2e8f0'}`,
                            background: selectedDesign===design?'#f0fdf4':'#fff',
                            cursor:'pointer', 
                            fontSize:12, 
                            fontWeight:600,
                            color: selectedDesign===design?'#0f766e':'#374151',
                            display:'flex', 
                            alignItems:'center', 
                            gap:6,
                            transition:'all 0.15s'
                          }}
                        >
                          {design} <span style={{ color:'#6b7280', fontWeight:400 }}>({fmt(designQty)})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Matrix Table */}
                <MatrixTable 
                  matrixColors={matrixColors}
                  matrixSizes={designSizes}
                  matrixMap={matrixMap}
                  getColorCode={getColorCode}
                  autoDetectSizes={false}
                  rawData={designMatrixItems}
                />
              </div>
            </div>
          )}

          {/* Orders Table */}
          <div className="rp-section-card">
            <div className="rp-section-header">
              <span className="rp-section-title">📋 All Orders — {sortedOrders.length} challans</span>
            </div>
            {sortedOrders.length===0 ? (
              <div className="rp-empty">
                <span style={{ fontSize:32 }}>📭</span>
                <span style={{ fontSize:13 }}>No orders found for selected period</span>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table className="rp-table" style={{ width:'100%', minWidth:'max-content' }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth:90 }}>Date</th>
                      <th style={{ minWidth:100 }}>Challan No</th>
                      <th style={{ minWidth:140 }}>Buyer</th>
                      <th className="rp-num" style={{ minWidth:50 }}>Qty</th>
                      <th className="rp-num" style={{ minWidth:90 }}>Total</th>
                      <th className="rp-num" style={{ minWidth:90 }}>Paid</th>
                      <th className="rp-num" style={{ minWidth:90 }}>Due</th>
                      <th style={{ minWidth:80 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOrders.map((o) => {
                      const paid=Number(o.amountPaid)||Number(o.paidAmount)||0;
                      const due=Number(o.amountDue)||Math.max(0,(Number(o.totalAmount)||0)-paid);
                      const qty=(o.items||[]).reduce((s,it)=>s+(it.quantity||0),0);
                      const st=payStatusStyle(o.paymentStatus);
                      const ek=o._id||o.challanNumber;
                      const isExp=expanded===ek;
                      const buyerName = o.buyerId?.name || o.buyerName || '—';
                      const businessName = o.buyerId?.businessName || o.businessName || '';
                      
                      return (
                        <>
                          <tr key={ek} className="rp-detail-row" onClick={()=>setExpanded(isExp?null:ek)}>
                            <td>{fmtDate(o.orderDate||o.createdAt)}</td>
                            <td style={{ fontWeight:600, color:'#0f766e' }}>{o.challanNumber||'—'}</td>
                            <td>
                              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                                <span style={{ fontWeight:600 }}>{buyerName}</span>
                                {businessName && <span style={{ fontSize:11, color:'#6b7280' }}>{businessName}</span>}
                              </div>
                            </td>
                            <td className="rp-num">{fmt(qty)}</td>
                            <td className="rp-num" style={{ fontWeight:600 }}>{fmtCur(o.totalAmount)}</td>
                            <td className="rp-num" style={{ color:'#059669' }}>{fmtCur(paid)}</td>
                            <td className="rp-num" style={{ color:due>0?'#dc2626':'#059669', fontWeight:due>0?700:400 }}>{due>0?fmtCur(due):'✓'}</td>
                            <td><span className="rp-badge" style={st}>{o.paymentStatus||'Pending'}</span></td>
                          </tr>
                          {isExp && (
                            <tr key={`exp-${ek}`}>
                              <td colSpan={8} style={{ padding:0 }}>
                                <div className="rp-animate" style={{ background:'#f8fafc', padding:'10px 16px', borderTop:'1px solid #e2e8f0' }}>
                                  <table className="rp-table" style={{ fontSize:12 }}>
                                    <thead><tr><th>Design</th><th>Color</th><th>Size</th><th className="rp-num">Qty</th><th className="rp-num">Rate</th><th className="rp-num">Amount</th></tr></thead>
                                    <tbody>
                                      {(o.items||[]).map((item,j) => (
                                        <tr key={j}>
                                          <td>{item.design||'—'}</td><td>{item.color||'—'}</td><td>{item.size||'—'}</td>
                                          <td className="rp-num">{fmt(item.quantity)}</td>
                                          <td className="rp-num">{fmtCur(item.pricePerUnit||item.rate||0)}</td>
                                          <td className="rp-num" style={{ fontWeight:600 }}>{fmtCur((item.quantity||0)*(item.pricePerUnit||item.rate||0))}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PendingPaymentsReport({ filters={} }) {
  const { startDate=null, endDate=null } = filters;

  console.log('[PendingPaymentsReport] Filters:', filters);
  console.log('[PendingPaymentsReport] startDate:', startDate, 'endDate:', endDate);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [JSON.stringify(filters)]);

  async function load() {
    setLoading(true);
    try {
      // Get all orders and filter for pending payments
      const qs = new URLSearchParams({ limit:99999 });
      if (startDate) qs.set('startDate', startDate);
      if (endDate) qs.set('endDate', endDate);
      
      const res = await wholesaleService.getAllOrders(qs.toString());
      const allOrders = res?.data?.orders || res?.orders || res?.data || [];
      
      console.log('[PendingPaymentsReport] All orders:', allOrders.length);
      
      // Filter for orders with pending payments
      const pendingOnly = allOrders.filter(order => {
        const paid = order.amountPaid || order.paidAmount || 0;
        const total = order.totalAmount || 0;
        const due = order.amountDue || (total - paid);
        return due > 0;
      });
      
      console.log('[PendingPaymentsReport] Pending payments:', pendingOnly.length);
      setData(pendingOnly);
    } catch(e) { 
      console.error('[PendingPaymentsReport] Error:', e);
    }
    finally { setLoading(false); }
  }

  const total = data.reduce((a,r)=>a+(r.amountDue||(r.totalAmount-(r.amountPaid||r.paidAmount||0))||0),0);

  if (loading) return <Spinner />;
  return (
    <SectionCard title="Pending Payments" icon="⚠️"
      onDownload={() => downloadCSV(`pending-payments-${Date.now()}.csv`, [
        ['Buyer','Challan No','Order Date','Total','Paid','Due'],
        ...data.map(r=>{
          const paid = r.amountPaid||r.paidAmount||0;
          const due=r.amountDue||((r.totalAmount||0)-paid);
          return[r.buyerName||r.buyerId?.name||'—',r.challanNumber,fmtDate(r.orderDate||r.createdAt),r.totalAmount,paid,due];
        })
      ])}>
      {data.length===0 ? <Empty msg="No pending payments." /> : (
        <>
          <div style={{ padding:'10px 18px', background:'#fef2f2', borderBottom:'1px solid #fecaca', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, color:'#dc2626', fontWeight:600 }}>Total Due</span>
            <span style={{ fontSize:16, fontWeight:800, color:'#dc2626' }}>{fmtCur(total)}</span>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table className="rp-table" style={{ width:'100%', minWidth:'max-content' }}>
              <thead>
                <tr>
                  <th style={{ minWidth:120 }}>Buyer</th>
                  <th style={{ minWidth:100 }}>Challan No</th>
                  <th style={{ minWidth:90 }}>Order Date</th>
                  <th className="rp-num" style={{ minWidth:90 }}>Total</th>
                  <th className="rp-num" style={{ minWidth:90 }}>Paid</th>
                  <th className="rp-num" style={{ minWidth:90 }}>Due</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r,i) => {
                  const paid = r.amountPaid||r.paidAmount||0;
                  const due=r.amountDue||((r.totalAmount||0)-paid);
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight:600, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.buyerName||r.buyerId?.name}>{r.buyerName||r.buyerId?.name||'—'}</td>
                      <td style={{ color:'#0f766e', fontWeight:500 }}>{r.challanNumber||'—'}</td>
                      <td>{fmtDate(r.orderDate||r.createdAt)}</td>
                      <td className="rp-num">{fmtCur(r.totalAmount)}</td>
                      <td className="rp-num" style={{ color:'#059669' }}>{fmtCur(paid)}</td>
                      <td className="rp-num" style={{ color:'#dc2626', fontWeight:700 }}>{fmtCur(due)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SectionCard>
  );
}

function BuyerWiseSummaryReport({ filters={} }) {
  const { startDate=null, endDate=null } = filters;

  console.log('[BuyerWiseSummaryReport] Filters:', filters);
  console.log('[BuyerWiseSummaryReport] startDate:', startDate, 'endDate:', endDate);

  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [JSON.stringify(filters)]);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit:99999 });
      if (startDate) qs.set('startDate', startDate);
      if (endDate) qs.set('endDate', endDate);
      const res = await wholesaleService.getAllOrders(qs.toString());
      const orders = res?.data?.orders||res?.orders||res?.data||[];
      const map = {};
      for (const o of orders) {
        const id = o.buyerId?._id||o.buyerId||o.buyerName||'unknown';
        const bn = o.buyerName||o.buyerId?.name||'—';
        if (!map[id]) map[id] = { name:bn, mobile:o.buyerContact||o.buyerId?.mobile||'—', businessName:o.businessName||o.buyerId?.businessName||'—', orders:0, totalQty:0, totalAmount:0, paidAmount:0 };
        map[id].orders++;
        map[id].totalAmount += (o.totalAmount||0);
        map[id].paidAmount += (o.amountPaid||o.paidAmount||0);
        map[id].totalQty += (o.items||[]).reduce((s,it)=>s+(it.quantity||0),0);
      }
      setBuyers(Object.values(map).sort((a,b)=>b.totalAmount-a.totalAmount));
    } catch(e) { console.error('[BuyerWiseSummaryReport]',e); }
    finally { setLoading(false); }
  }

  if (loading) return <Spinner />;
  return (
    <SectionCard title="Buyer-wise Summary" icon="👥"
      onDownload={() => downloadCSV(`buyer-summary-${Date.now()}.csv`, [
        ['Buyer','Business','Mobile','Orders','Total Qty','Total Amount','Paid','Due'],
        ...buyers.map(b=>[b.name,b.businessName,b.mobile,b.orders,b.totalQty,b.totalAmount,b.paidAmount,b.totalAmount-b.paidAmount])
      ])}>
      {buyers.length===0 ? <Empty /> : (
        <div style={{ overflowX:'auto' }}>
          <table className="rp-table" style={{ width:'100%', minWidth:'max-content' }}>
            <thead>
              <tr>
                <th style={{ minWidth:120 }}>Buyer</th>
                <th style={{ minWidth:120 }}>Business</th>
                <th style={{ minWidth:100 }}>Mobile</th>
                <th className="rp-num" style={{ minWidth:60 }}>Orders</th>
                <th className="rp-num" style={{ minWidth:60 }}>Qty</th>
                <th className="rp-num" style={{ minWidth:90 }}>Total</th>
                <th className="rp-num" style={{ minWidth:90 }}>Paid</th>
                <th className="rp-num" style={{ minWidth:90 }}>Due</th>
              </tr>
            </thead>
            <tbody>
              {buyers.map((b,i) => {
                const due=b.totalAmount-b.paidAmount;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight:600, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={b.name}>{b.name}</td>
                    <td style={{ maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={b.businessName}>{b.businessName}</td>
                    <td style={{ color:'#6b7280' }}>{b.mobile}</td>
                    <td className="rp-num">{fmt(b.orders)}</td>
                    <td className="rp-num">{fmt(b.totalQty)}</td>
                    <td className="rp-num" style={{ fontWeight:700 }}>{fmtCur(b.totalAmount)}</td>
                    <td className="rp-num" style={{ color:'#059669' }}>{fmtCur(b.paidAmount)}</td>
                    <td className="rp-num" style={{ color:due>0?'#dc2626':'#059669', fontWeight:due>0?700:400 }}>{due>0?fmtCur(due):'✓'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function BuyerWiseOrders({ filters={} }) {
  const { startDate=null, endDate=null } = filters;
  const { getColorCode } = useColorPalette();
  const { sizes, getSizesForDesign } = useEnabledSizes();
  const [buyers, setBuyers] = useState([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingBuyers, setLoadingBuyers] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [selectedDesign, setSelectedDesign] = useState('all');

  // Load all buyers (once)
  useEffect(() => {
    setLoadingBuyers(true);
    wholesaleService.getAllBuyers()
      .then(resp => {
        const items = Array.isArray(resp) ? resp
          : Array.isArray(resp?.buyers) ? resp.buyers
          : Array.isArray(resp?.data?.buyers) ? resp.data.buyers
          : Array.isArray(resp?.data) ? resp.data : [];
        
        setBuyers(items);
        if (items.length > 0) {
          setSelectedBuyerId(items[0]._id || '');
        }
      })
      .catch(e => console.error('[BuyerWiseOrders] Error loading buyers:', e))
      .finally(() => setLoadingBuyers(false));
  }, []);

  // Load ALL wholesale orders (reload when filters change OR buyer changes)
  useEffect(() => {
    if (!selectedBuyerId) return;
    
    setLoading(true);
    const qs = new URLSearchParams({ limit: 99999 });
    // Don't apply filters here - we'll filter on frontend
    
    wholesaleService.getAllOrders(qs.toString())
      .then(res => {
        const orders = res?.data?.orders || res?.orders || res?.data || [];
        setAllOrders(orders);
      })
      .catch(e => console.error('[BuyerWiseOrders] Error loading orders:', e))
      .finally(() => setLoading(false));
  }, [selectedBuyerId]); // Only reload when buyer changes

  const buyer = buyers.find(b => b._id === selectedBuyerId);
  
  // Filter orders for selected buyer (ALL TIME)
  const allBuyerOrders = useMemo(() => {
    if (!selectedBuyerId || !buyer) return [];
    
    return allOrders.filter(order => {
      const orderBuyerId = order.buyerId?._id || order.buyerId;
      const orderBuyerName = order.buyerName;
      const orderBuyerMobile = order.buyerContact;
      
      return orderBuyerId === selectedBuyerId || 
             orderBuyerName === buyer.name ||
             orderBuyerMobile === buyer.mobile;
    });
  }, [allOrders, selectedBuyerId, buyer]);

  // Filter orders respecting date filters
  const filteredBuyerOrders = useMemo(() => {
    if (!startDate && !endDate) return allBuyerOrders;
    
    return allBuyerOrders.filter(order => {
      const orderDate = new Date(order.orderDate || order.createdAt);
      if (startDate && orderDate < new Date(startDate)) return false;
      if (endDate && orderDate > new Date(endDate + 'T23:59:59')) return false;
      return true;
    });
  }, [allBuyerOrders, startDate, endDate]);

  // Extract items from ALL TIME orders (for total units calculation only)
  const allTimeItems = useMemo(() => {
    const items = [];
    for (const order of allBuyerOrders) {
      for (const item of (order.items || [])) {
        items.push({
          design: item.design || '—',
          color: item.color || '—',
          size: item.size || '—',
          quantity: item.quantity || 0
        });
      }
    }
    return items;
  }, [allBuyerOrders]);

  // Extract items from FILTERED orders (for matrix display)
  const filteredMatrixItems = useMemo(() => {
    const items = [];
    for (const order of filteredBuyerOrders) {
      for (const item of (order.items || [])) {
        items.push({
          design: item.design || '—',
          color: item.color || '—',
          size: item.size || '—',
          quantity: item.quantity || 0
        });
      }
    }
    return items;
  }, [filteredBuyerOrders]);

  // Get all unique designs from FILTERED data
  const allDesigns = useMemo(() => {
    const designs = [...new Set(filteredMatrixItems.map(item => item.design).filter(d => d && d !== '—'))];
    return designs.sort();
  }, [filteredMatrixItems]);

  // Set initial design when designs load
  useEffect(() => {
    if (allDesigns.length > 0 && !allDesigns.includes(selectedDesign) && selectedDesign !== 'all') {
      setSelectedDesign('all');
    }
  }, [allDesigns, selectedDesign]);

  // Filter matrix items by selected design (from FILTERED data)
  const designMatrixItems = useMemo(() => {
    if (selectedDesign === 'all') return filteredMatrixItems;
    return filteredMatrixItems.filter(item => item.design === selectedDesign);
  }, [filteredMatrixItems, selectedDesign]);

  // Get sizes for selected design
  const designSizes = useMemo(() => {
    if (selectedDesign === 'all') {
      return [...new Set(filteredMatrixItems.map(item => item.size).filter(s => s && s !== '—'))].sort();
    }
    return getSizesForDesign(selectedDesign);
  }, [selectedDesign, filteredMatrixItems, getSizesForDesign]);

  // Build matrix for selected design (from FILTERED data)
  const { matrixColors, matrixMap } = useMemo(() => {
    const colors = [];
    const map = {};
    
    for (const item of designMatrixItems) {
      const key = `${item.color}||${item.size}`;
      map[key] = (map[key] || 0) + item.quantity;
      if (!colors.includes(item.color)) colors.push(item.color);
    }
    
    return { matrixColors: colors, matrixMap: map };
  }, [designMatrixItems]);

  // Calculate total units from ALL TIME data (unaffected by filters)
  const totalUnits = filteredMatrixItems.reduce((sum, item) => sum + item.quantity, 0);

  const totalSpent = filteredBuyerOrders.reduce((s,o)=>s+(Number(o.totalAmount)||0),0);
  const totalPaid  = filteredBuyerOrders.reduce((s,o)=>s+(Number(o.amountPaid)||Number(o.paidAmount)||0),0);
  const totalDue   = filteredBuyerOrders.reduce((s,o)=>{
    const paid=Number(o.amountPaid)||Number(o.paidAmount)||0;
    return s+(Number(o.amountDue)||Math.max(0,(Number(o.totalAmount)||0)-paid));
  },0);

  const sortedOrders = useMemo(() =>
    [...filteredBuyerOrders].sort((a,b)=>new Date(b.orderDate||b.createdAt)-new Date(a.orderDate||a.createdAt)),
    [filteredBuyerOrders]);

  function handleCSV() {
    const rows = [
      [`Buyer: ${buyer?.name||'—'}`,`Business: ${buyer?.businessName||'—'}`,`Mobile: ${buyer?.mobile||'—'}`,`Total Units (All Time): ${totalUnits}`],
      [],
      ['=== SALES MATRIX (Filtered Period) ==='],
      []
    ];
    
    // Add matrices for all designs (use FILTERED data in CSV)
    const flatItems = filteredMatrixItems; // Changed from allTimeItems
    const allDesignsForCSV = [...new Set(flatItems.map(item => item.design).filter(d => d && d !== '—'))].sort();
    const matrixCSV = buildMultiDesignCSV(allDesignsForCSV, flatItems, sizes, getSizesForDesign);
    rows.push(...matrixCSV);
    
    rows.push([]);
    rows.push(['=== ORDER DETAILS (Filtered Period) ===']);
    rows.push([]);
    rows.push(['Date','Challan No','Design','Color','Size','Qty','Rate','Total','Paid','Due','Status']);
    
    // Use filtered orders instead of all orders
    for (const o of filteredBuyerOrders) { // Changed from allBuyerOrders
      const paid=Number(o.amountPaid)||Number(o.paidAmount)||0;
      const due=Number(o.amountDue)||Math.max(0,(Number(o.totalAmount)||0)-paid);
      if (o.items?.length) {
        for (const item of o.items) {
          rows.push([fmtDate(o.orderDate||o.createdAt),o.challanNumber||'—',
            item.design||'—',item.color||'—',item.size||'—',
            item.quantity||0,item.pricePerUnit||item.rate||0,
            o.totalAmount||0,paid,due,o.paymentStatus||'—']);
        }
      } else {
        rows.push([fmtDate(o.orderDate||o.createdAt),o.challanNumber||'—',
          '—','—','—','—','—',o.totalAmount||0,paid,due,o.paymentStatus||'—']);
      }
    }
    downloadCSV(`buyer-orders-${buyer?.name||selectedBuyerId}.csv`, rows);
  }

  return (
    <div className="rp-animate">
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase' }}>Select Buyer</span>
        {loadingBuyers ? <Skeleton w={220} h={36} /> : (
          buyers.length === 0 ? (
            <span style={{ color:'#dc2626', fontSize:13 }}>No buyers found</span>
          ) : (
            <select 
              className="rp-select" 
              style={{ minWidth:260 }}
              value={selectedBuyerId}
              onChange={e => {setSelectedBuyerId(e.target.value);setExpanded(null);setSelectedDesign('all');}}
            >
              {buyers.map(b => (
                <option key={b._id} value={b._id}>
                  {b.name||'—'}{b.businessName?` (${b.businessName})`:''}
                </option>
              ))}
            </select>
          )
        )}
        {allBuyerOrders.length>0 && <button className="rp-btn-ghost" onClick={handleCSV}>⬇ CSV</button>}
      </div>

      {buyer && (
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 16px', marginBottom:12, fontSize:13, display:'flex', gap:24, flexWrap:'wrap' }}>
          <span><strong>{buyer.name}</strong>{buyer.businessName?` — ${buyer.businessName}`:''}</span>
          <span>📞 {buyer.mobile||'—'}</span>
          <span style={{ color:'#0f766e', fontWeight:600 }}>Spent: {fmtCur(totalSpent)}</span>
          <span style={{ color:'#059669', fontWeight:600 }}>Paid: {fmtCur(totalPaid)}</span>
          <span style={{ color:totalDue>0?'#dc2626':'#059669', fontWeight:700 }}>Due: {fmtCur(totalDue)}</span>
        </div>
      )}

      {loading ? <Spinner /> : (
        <>
          {/* Matrix Section */}
          {filteredBuyerOrders.length > 0 && (
            <div className="rp-section-card" style={{ marginBottom:16 }}>
              <div className="rp-section-header">
                <span className="rp-section-title">📊 Sales Matrix</span>
                <span style={{ fontSize:14, fontWeight:700, color:'#0f766e' }}>
                  Total Units: {fmt(totalUnits)}
                </span>
              </div>
              <div style={{ padding:16 }}>
                {/* Design Selector */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button 
                      onClick={() => setSelectedDesign('all')}
                      style={{
                        padding:'6px 14px', 
                        borderRadius:8,
                        border:`2px solid ${selectedDesign==='all'?'#0f766e':'#e2e8f0'}`,
                        background: selectedDesign==='all'?'#f0fdf4':'#fff',
                        cursor:'pointer', 
                        fontSize:12, 
                        fontWeight:600,
                        color: selectedDesign==='all'?'#0f766e':'#374151',
                        transition:'all 0.15s'
                      }}
                    >
                      All Designs ({allDesigns.length})
                    </button>
                    {allDesigns.map((design) => {
                      const designQty = filteredMatrixItems
                        .filter(item => item.design === design)
                        .reduce((sum, item) => sum + item.quantity, 0);
                      
                      return (
                        <button 
                          key={design}
                          onClick={() => setSelectedDesign(design)}
                          style={{
                            padding:'6px 14px', 
                            borderRadius:8,
                            border:`2px solid ${selectedDesign===design?'#0f766e':'#e2e8f0'}`,
                            background: selectedDesign===design?'#f0fdf4':'#fff',
                            cursor:'pointer', 
                            fontSize:12, 
                            fontWeight:600,
                            color: selectedDesign===design?'#0f766e':'#374151',
                            display:'flex', 
                            alignItems:'center', 
                            gap:6,
                            transition:'all 0.15s'
                          }}
                        >
                          {design} <span style={{ color:'#6b7280', fontWeight:400 }}>({fmt(designQty)})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Matrix Table */}
                <MatrixTable 
                  matrixColors={matrixColors}
                  matrixSizes={designSizes}
                  matrixMap={matrixMap}
                  getColorCode={getColorCode}
                  autoDetectSizes={false}
                  rawData={designMatrixItems}
                />
              </div>
            </div>
          )}

          {/* Orders Table */}
          <div className="rp-section-card">
            <div className="rp-section-header">
              <span className="rp-section-title">📋 All Orders — {sortedOrders.length} challans</span>
            </div>
            {sortedOrders.length===0 ? (
              <div className="rp-empty">
                <span style={{ fontSize:32 }}>📭</span>
                <span style={{ fontSize:13 }}>No orders found for this buyer in selected period</span>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table className="rp-table" style={{ width:'100%', minWidth:'max-content' }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth:90 }}>Date</th>
                      <th style={{ minWidth:100 }}>Challan No</th>
                      <th className="rp-num" style={{ minWidth:50 }}>Qty</th>
                      <th className="rp-num" style={{ minWidth:90 }}>Total</th>
                      <th className="rp-num" style={{ minWidth:90 }}>Paid</th>
                      <th className="rp-num" style={{ minWidth:90 }}>Due</th>
                      <th style={{ minWidth:80 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOrders.map((o) => {
                      const paid=Number(o.amountPaid)||Number(o.paidAmount)||0;
                      const due=Number(o.amountDue)||Math.max(0,(Number(o.totalAmount)||0)-paid);
                      const qty=(o.items||[]).reduce((s,it)=>s+(it.quantity||0),0);
                      const st=payStatusStyle(o.paymentStatus);
                      const ek=o._id||o.challanNumber;
                      const isExp=expanded===ek;
                      return (
                        <>
                          <tr key={ek} className="rp-detail-row" onClick={()=>setExpanded(isExp?null:ek)}>
                            <td>{fmtDate(o.orderDate||o.createdAt)}</td>
                            <td style={{ fontWeight:600, color:'#0f766e' }}>{o.challanNumber||'—'}</td>
                            <td className="rp-num">{fmt(qty)}</td>
                            <td className="rp-num" style={{ fontWeight:600 }}>{fmtCur(o.totalAmount)}</td>
                            <td className="rp-num" style={{ color:'#059669' }}>{fmtCur(paid)}</td>
                            <td className="rp-num" style={{ color:due>0?'#dc2626':'#059669', fontWeight:due>0?700:400 }}>{due>0?fmtCur(due):'✓'}</td>
                            <td><span className="rp-badge" style={st}>{o.paymentStatus||'Pending'}</span></td>
                          </tr>
                          {isExp && (
                            <tr key={`exp-${ek}`}>
                              <td colSpan={7} style={{ padding:0 }}>
                                <div className="rp-animate" style={{ background:'#f8fafc', padding:'10px 16px', borderTop:'1px solid #e2e8f0' }}>
                                  <table className="rp-table" style={{ fontSize:12 }}>
                                    <thead><tr><th>Design</th><th>Color</th><th>Size</th><th className="rp-num">Qty</th><th className="rp-num">Rate</th><th className="rp-num">Amount</th></tr></thead>
                                    <tbody>
                                      {(o.items||[]).map((item,j) => (
                                        <tr key={j}>
                                          <td>{item.design||'—'}</td><td>{item.color||'—'}</td><td>{item.size||'—'}</td>
                                          <td className="rp-num">{fmt(item.quantity)}</td>
                                          <td className="rp-num">{fmtCur(item.pricePerUnit||item.rate||0)}</td>
                                          <td className="rp-num" style={{ fontWeight:600 }}>{fmtCur((item.quantity||0)*(item.pricePerUnit||item.rate||0))}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SettlementsReport({ filters={} }) {
  const { startDate=null, endDate=null, account='all' } = filters;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [JSON.stringify(filters)]);

  async function load() {
    setLoading(true);
    try {
      const res = await settlementService.getAllSettlements(
        account==='all'?null:account, startDate, endDate
      );
      const s = res?.data?.settlements||res?.settlements||res?.data||(Array.isArray(res)?res:[]);
      setData(s);
    } catch(e) { console.error('[SettlementsReport]',e); }
    finally { setLoading(false); }
  }

  const total = data.reduce((a,r)=>a+(r.settlementAmount||r.amount||0),0);
  const sorted = useMemo(()=>[...data].sort((a,b)=>new Date(b.settlementDate||b.createdAt)-new Date(a.settlementDate||a.createdAt)),[data]);

  if (loading) return <Spinner />;
  return (
    <SectionCard title="Marketplace Settlements" icon="💰"
      onDownload={() => downloadCSV(`settlements-${Date.now()}.csv`, [
        ['Date','Account','Amount'],
        ...sorted.map(r=>[fmtDate(r.settlementDate||r.createdAt),r.accountName||r.account||'—',r.settlementAmount||r.amount||0])
      ])}>
      {data.length===0 ? <Empty /> : (
        <>
          <div style={{ padding:'10px 18px', background:'#f0fdf4', borderBottom:'1px solid #bbf7d0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, color:'#059669', fontWeight:600 }}>Total Settled</span>
            <span style={{ fontSize:16, fontWeight:800, color:'#059669' }}>{fmtCur(total)}</span>
          </div>
          <div className="rp-scrollable-table">
            <table className="rp-table" style={{ width:'100%' }}>
              <thead><tr><th>Date</th><th>Account</th><th className="rp-num">Amount</th></tr></thead>
              <tbody>
                {sorted.map((r,i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:500 }}>{fmtDate(r.settlementDate||r.createdAt)}</td>
                    <td>{r.accountName||r.account||'—'}</td>
                    <td className="rp-num" style={{ fontWeight:700, color:'#059669' }}>{fmtCur(r.settlementAmount||r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ─── Report Menu Config ────────────────────────────────────────────────────────
// ─── Report Menu Config ────────────────────────────────────────────────────────
const REPORT_MENU = {
  marketplace: [
    { id:'sales',       label:'Sales Report',         icon:'📊' },
    { id:'net-sales',   label:'Net Sales Report',      icon:'📈' },
    { id:'rto',         label:'RTO Report',            icon:'🔄' },
    { id:'returned',    label:'Returned Report',       icon:'↩️' },
    { id:'wrongreturn', label:'Wrong Return Report',   icon:'❌' },
    { id:'settlements', label:'Settlements',           icon:'💰' },
    { id:'best-designs',label:'Best Designs',          icon:'🏆' },
  ],
  wholesale: [
    { id:'wholesale-orders',  label:'Wholesale Orders',      icon:'📦' },
    { id:'pending-payments',  label:'Pending Payments',      icon:'⚠️' },
    { id:'buyer-summary',     label:'Buyer-wise Summary',    icon:'👥' },
    { id:'buyer-orders',      label:'Buyer-wise Orders',     icon:'🧾' },
    { id:'best-designs',      label:'Best Designs',          icon:'🏆' },
  ],
  direct: [
    { id:'sales',        label:'Direct Sales Report',  icon:'🛍️' },
    { id:'best-designs', label:'Best Designs',         icon:'🏆' },
  ],
};


// ─── Main Reports Component ────────────────────────────────────────────────────
export default function Reports() {
  injectStyles();

  const { getColorCode } = useColorPalette();
  const { sizes = [] } = useEnabledSizes();

  const [activeTab, setActiveTab] = useState('marketplace');
  const [activeReport, setActiveReport] = useState('sales');

  // ===== GLOBAL FILTERS (applies to ALL tabs/reports) =====
  const [filterMode, setFilterMode] = useState('month');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(CUR_YEAR);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [accounts, setAccounts] = useState([]);

  // Load marketplace accounts once
  useEffect(() => {
    salesService.getAllSales('all','all',null,null,1,1)
      .then(res => {
        const items = res?.data?.data||res?.data||res?.orders||[];
        const accs = [...new Set(items.map(s=>s.accountName).filter(Boolean))];
        setAccounts(accs);
      })
      .catch(()=>{});
  }, []);

  // When tab changes, reset to first report of that tab
  useEffect(() => {
    const first = REPORT_MENU[activeTab]?.[0]?.id || 'sales';
    setActiveReport(first);
  }, [activeTab]);

  // Build date range from global filters
  const dateRange = useMemo(
    () => buildDateRange(filterMode, month, year, customFrom, customTo),
    [filterMode, month, year, customFrom, customTo]
  );

  // Global filters object - passed to ALL reports
  const filters = useMemo(() => ({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    account: selectedAccount,
  }), [dateRange, selectedAccount]);

  
  // Add this useEffect to log when filters change
  useEffect(() => {
    console.log('[Reports] Filter changed!');
    console.log('[Reports] filterMode:', filterMode);
    console.log('[Reports] month:', month);
    console.log('[Reports] year:', year);
    console.log('[Reports] customFrom:', customFrom);
    console.log('[Reports] customTo:', customTo);
    console.log('[Reports] Computed filters:', filters);
  }, [filterMode, month, year, customFrom, customTo, filters]);

  function renderReport() {
    const props = { filters, sizes, getColorCode };

    // Marketplace reports
    if (activeTab === 'marketplace') {
      if (activeReport === 'sales')        return <SalesReport {...props} channel="marketplace" />;
      if (activeReport === 'net-sales')    return <NetSalesReport {...props} />;
      if (activeReport === 'rto')          return <ReturnTypeReport {...props} status="RTO"         title="RTO Report"         icon="🔄" />;
      if (activeReport === 'returned')     return <ReturnTypeReport {...props} status="returned"    title="Returned Report"    icon="↩️" />;
      if (activeReport === 'wrongreturn')  return <ReturnTypeReport {...props} status="wrongreturn" title="Wrong Return Report" icon="❌" />;
      if (activeReport === 'settlements')  return <SettlementsReport {...props} />;
      if (activeReport === 'best-designs') return <BestDesigns filters={filters} channel="marketplace" />;
    }

    // Wholesale reports
    if (activeTab === 'wholesale') {
        if (activeReport === 'wholesale-orders') return <WholesaleOrdersReport filters={filters} />;
        if (activeReport === 'pending-payments') return <PendingPaymentsReport filters={filters} />;
        if (activeReport === 'buyer-summary')    return <BuyerWiseSummaryReport filters={filters} />;
        if (activeReport === 'buyer-orders')     return <BuyerWiseOrders filters={filters} />;
        if (activeReport === 'best-designs')     return <BestDesigns filters={filters} channel="wholesale" />;
      }

    // Direct reports
    if (activeTab === 'direct') {
      if (activeReport === 'sales')        return <SalesReport {...props} channel="direct" />;
      if (activeReport === 'best-designs') return <BestDesigns filters={filters} channel="direct" />;
    }

    return <Empty msg="Select a report from the menu." />;
  }

  const currentMenu = REPORT_MENU[activeTab] || [];

  console.log('[Reports] Current filters:', filters);
  console.log('[Reports] Active tab:', activeTab);
  console.log('[Reports] Active report:', activeReport);

  return (
    <div className="rp-root rp-animate" style={{ minHeight:'100vh', background:'#f8fafc', padding:'20px 16px' }}>
      {/* Page Header */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>Reports</h1>
        <p style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>Generate and download reports for all channels</p>
      </div>

      {/* Channel Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:16, background:'#f1f5f9', borderRadius:10, padding:4, width:'fit-content' }}>
        {[
          { id:'marketplace', label:'Marketplace', icon:'🛒' },
          { id:'wholesale',   label:'Wholesale',   icon:'📦' },
          { id:'direct',      label:'Direct',      icon:'🛍️' },
        ].map(tab => (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            className={activeTab===tab.id?'rp-tab-active':'rp-tab-inactive'}
            style={{ padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6, transition:'all 0.15s' }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ===== GLOBAL FILTER BAR ===== */}
      <FilterBar 
        filterMode={filterMode}
        setFilterMode={setFilterMode}
        month={month}
        setMonth={setMonth}
        year={year}
        setYear={setYear}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
        accounts={activeTab === 'marketplace' ? accounts : []}
        selectedAccount={selectedAccount}
        setSelectedAccount={setSelectedAccount}
        onApply={() => {}} // No apply button needed since it's real-time
        loading={false}
      />

      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:16, alignItems:'start' }}>
        {/* Report Sidebar */}
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', position:'sticky', top:16 }}>
          <div style={{ padding:'12px 14px', borderBottom:'1px solid #f1f5f9', background:'#fafafa' }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>Reports</span>
          </div>
          <div style={{ padding:6 }}>
            {currentMenu.map(r => (
              <button key={r.id} onClick={()=>setActiveReport(r.id)}
                className={activeReport===r.id?'rp-report-btn-active':'rp-report-btn-inactive'}
                style={{ width:'100%', textAlign:'left', padding:'9px 12px', borderRadius:8, border:'1px solid transparent', cursor:'pointer', fontSize:12.5, display:'flex', alignItems:'center', gap:8, marginBottom:2, transition:'all 0.15s' }}>
                <span>{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Report Content */}
        <div>
          <div key={`${activeTab}-${activeReport}-${JSON.stringify(filters)}`} className="rp-animate">
            {renderReport()}
          </div>
        </div>
      </div>
    </div>
  );
}