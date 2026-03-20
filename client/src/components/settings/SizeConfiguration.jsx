import React, { useState, useEffect } from 'react';
import { settingsService } from '../../services/settingsService';
import { inventoryService } from '../../services/inventoryService';
import toast from 'react-hot-toast';

// ── Inline Icons ──────────────────────────────────────────────
const Icons = {
  Package: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  X: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Refresh: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Search: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Check: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  Design: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  ),
  Sparkle: () => (
    <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  ),
  Sliders: () => (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
};

// ── Toggle Switch ─────────────────────────────────────────────
const Toggle = ({ checked, onChange, disabled, color = 'indigo' }) => {
  const trackColor = {
    indigo:  checked ? '#6366f1' : '#e5e7eb',
    purple:  checked ? '#a855f7' : '#e5e7eb',
    emerald: checked ? '#10b981' : '#e5e7eb',
  }[color];

  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      style={{ backgroundColor: trackColor, transition: 'background-color 0.25s ease' }}
      className={`relative inline-flex h-6 w-11 items-center rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        style={{ transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)' }}
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-md
          ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
};

// ── Size Pill (global) ────────────────────────────────────────
const SizePill = ({ size, toggling, onToggle }) => {
  const enabled = size.isEnabled;
  const isLoading = toggling === size.name;

  return (
    <div
      className="size-card-enter flex flex-col items-center gap-2 p-4 rounded-2xl border-2 cursor-pointer"
      style={{
        borderColor:     enabled ? '#c7d2fe' : '#f3f4f6',
        backgroundColor: enabled ? '#fafafe' : '#f9fafb',
        boxShadow:       enabled ? '0 2px 12px rgba(99,102,241,0.10)' : 'none',
        transition:      'all 0.2s ease',
        opacity:         enabled ? 1 : 0.6,
      }}
      onClick={() => !isLoading && onToggle(size.name, enabled)}
    >
      {/* Badge */}
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl"
        style={{
          background:  enabled ? 'linear-gradient(135deg, #6366f1, #a855f7)' : '#e5e7eb',
          color:       enabled ? '#fff' : '#9ca3af',
          boxShadow:   enabled ? '0 4px 14px rgba(99,102,241,0.3)' : 'none',
          transition:  'all 0.3s ease',
        }}
      >
        {size.name}
      </div>

      {/* Label */}
      <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: enabled ? '#6366f1' : '#9ca3af' }}>
        {enabled ? 'ACTIVE' : 'OFF'}
      </span>

      {/* Toggle / Spinner */}
      {isLoading ? (
        <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
      ) : (
        <Toggle checked={enabled} onChange={() => onToggle(size.name, enabled)} color="indigo" />
      )}
    </div>
  );
};

// ── Design Size Pill ──────────────────────────────────────────
const DesignSizePill = ({ size, onToggle }) => {
  const [loading, setLoading] = useState(false);
  const enabled = size.enabledForDesign;

  const handleClick = async () => {
    setLoading(true);
    await onToggle(size);
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 font-semibold text-sm"
      style={{
        borderColor:     enabled ? '#a855f7' : '#e5e7eb',
        background:      enabled ? 'linear-gradient(135deg, #a855f7, #6366f1)' : '#fff',
        color:           enabled ? '#fff' : '#6b7280',
        transform:       enabled ? 'scale(1.04)' : 'scale(1)',
        boxShadow:       enabled ? '0 4px 14px rgba(168,85,247,0.3)' : 'none',
        transition:      'all 0.2s ease',
        opacity:         loading ? 0.7 : 1,
      }}
    >
      {loading ? (
        <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : enabled ? (
        <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.25)' }}>
          <Icons.Check />
        </span>
      ) : (
        <span className="w-5 h-5 rounded-full border-2 border-gray-300" />
      )}
      {size.name}
    </button>
  );
};

// ── Add Size Modal ────────────────────────────────────────────
const AddSizeModal = ({ onClose, onAdd }) => {
  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Enter a size name');
    setLoading(true);
    await onAdd(name.trim().toUpperCase());
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-enter"
      style={{ background: 'rgba(15,15,30,0.55)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="modal-enter bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }} className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Add New Size</h3>
              <p className="text-indigo-200 text-xs mt-0.5">Auto-syncs to all products</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <Icons.X />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Live Preview Badge */}
          <div className="flex justify-center mb-6">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold"
              style={{
                background:  name.trim() ? 'linear-gradient(135deg, #6366f1, #a855f7)' : '#f3f4f6',
                color:       name.trim() ? '#fff' : '#d1d5db',
                boxShadow:   name.trim() ? '0 8px 24px rgba(99,102,241,0.35)' : 'none',
                transition:  'all 0.25s ease',
              }}
            >
              {name.trim().toUpperCase() || '?'}
            </div>
          </div>

          <label className="block text-sm font-semibold text-gray-700 mb-2">Size Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value.toUpperCase())}
            placeholder="e.g. XS, 3XL, 4XL"
            maxLength={10}
            autoFocus
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-center text-xl font-bold tracking-widest
              focus:border-indigo-400 focus:outline-none transition-all"
            style={{ letterSpacing: '0.2em' }}
          />
          <p className="text-xs text-gray-400 mt-2 text-center">Max 10 characters</p>

          <div className="flex items-center gap-2 mt-4 p-3 rounded-xl"
            style={{ background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
            <Icons.Sparkle />
            <p className="text-xs font-medium" style={{ color: '#065f46' }}>
              Instantly synced to all existing products
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background:  'linear-gradient(135deg, #6366f1, #a855f7)',
                boxShadow:   '0 4px 14px rgba(99,102,241,0.35)',
                transition:  'all 0.2s ease',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Syncing...
                </span>
              ) : 'Add Size'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────
const SizeConfiguration = () => {
  const [sizes,       setSizes]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [toggling,    setToggling]    = useState(null);
  const [syncing,     setSyncing]     = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);

  // Design-specific
  const [designs,      setDesigns]      = useState([]);
  const [selectedDesign, setSelectedDesign] = useState('');
  const [designName,   setDesignName]   = useState('');
  const [designSizes,  setDesignSizes]  = useState(null);
  const [loadingDes,   setLoadingDes]   = useState(false);

  useEffect(() => {
    fetchSizes();
    fetchDesigns();
  }, []);

  const fetchSizes = async () => {
    try {
      setLoading(true);
      setSizes(await settingsService.getAllSizes());
    } catch { toast.error('Failed to load sizes'); }
    finally { setLoading(false); }
  };

  const fetchDesigns = async () => {
    try {
      const data = await inventoryService.getAllProducts();
      const arr  = Array.isArray(data) ? data : data?.products || [];
      setDesigns(arr.map(p => p.design).sort());
    } catch { /* silent */ }
  };

  const handleToggle = async (name, currentlyEnabled) => {
    setToggling(name);
    try {
      const result = await settingsService.toggleSize(name, !currentlyEnabled);
      let msg = result.message;
      if (result.syncStats?.productsUpdated > 0)
        msg += ` · ${result.syncStats.sizesAdded} entries synced`;
      toast.success(msg, { duration: 4000 });
      if (result.warning)
        toast(result.warning, { icon: '⚠️', duration: 6000, style: { background: '#fef3c7', color: '#92400e' } });
      fetchSizes();
    } catch { toast.error('Failed to toggle size'); }
    finally { setToggling(null); }
  };

  const handleSync = async () => {
    if (!window.confirm('Sync all products with current size configuration?\n\nMissing sizes will be added to all products.')) return;
    setSyncing(true);
    try {
      const r = await settingsService.syncProductsWithSizes();
      if (r.success)
        toast.success(`✅ Synced ${r.stats.productsUpdated}/${r.stats.totalProducts} products · ${r.stats.sizesAdded} entries added`, { duration: 6000 });
      else toast.error(r.message || 'Sync failed');
    } catch (err) { toast.error(err.response?.data?.message || err.message || 'Sync failed'); }
    finally { setSyncing(false); }
  };

  const handleAddSize = async name => {
    try {
      const result = await settingsService.addSize(name);
      toast.success(
        result.syncStats
          ? `"${result.size.name}" added & synced to ${result.syncStats.productsUpdated} products!`
          : `"${result.size.name}" added!`,
        { duration: 5000 }
      );
      setShowAdd(false);
      fetchSizes();
    } catch (err) { toast.error(err.message || 'Failed to add size'); }
  };

  // ✅ Accept design param directly
  const handleLoadDesign = async (d) => {
  if (!d) return;
  setLoadingDes(true);
  setDesignSizes(null);
  setDesignName(d);
  try {
    const [all, enabled] = await Promise.all([
      settingsService.getAllSizes(),
      settingsService.getEnabledSizes(d),
    ]);
    setDesignSizes(
      all.filter(s => s.isEnabled).map(s => ({
        ...s,
        enabledForDesign: enabled.includes(s.name),
      }))
    );
  } catch {
    toast.error('Failed to load design sizes');
  } finally {
    setLoadingDes(false);
  }
};

  const handleToggleDesignSize = async size => {
    await settingsService.toggleSize(size.name, !size.enabledForDesign, designName);
    setDesignSizes(prev => prev.map(s => s.name === size.name ? { ...s, enabledForDesign: !s.enabledForDesign } : s));
    toast.success(`"${size.name}" ${!size.enabledForDesign ? 'enabled' : 'disabled'} for "${designName}"`);
  };

  const handleToggleAllDesign = async () => {
    const allEnabled = designSizes.every(s => s.enabledForDesign);
    for (const size of designSizes) {
      if (size.enabledForDesign === allEnabled)
        await settingsService.toggleSize(size.name, !allEnabled, designName);
    }
    setDesignSizes(prev => prev.map(s => ({ ...s, enabledForDesign: !allEnabled })));
    toast.success(`All sizes ${!allEnabled ? 'enabled' : 'disabled'} for "${designName}"`);
  };

  const enabledSizes  = sizes.filter(s => s.isEnabled);
  const disabledSizes = sizes.filter(s => !s.isEnabled);

  // ── Loading skeleton ──
  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 animate-pulse">
      <div className="h-6 bg-gray-200 rounded-lg w-48 mb-6" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-2xl" />)}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Injected animations via JSX style tag ── */}
      <style>{`
        .size-card-enter { animation: sizeIn 0.25s ease-out both; }
        .modal-enter     { animation: modalIn 0.2s ease-out both; }
        @keyframes sizeIn  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes modalIn { from { opacity:0; transform:scale(0.95);     } to { opacity:1; transform:scale(1);     } }
      `}</style>

      {/* ══════════════ GLOBAL SIZES CARD ══════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

        {/* Rainbow top bar */}
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)' }} />

        <div className="p-6">
          {/* ── Title Row ── */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
                <Icons.Sliders />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Size Configuration</h2>
                <p className="text-xs text-gray-400 mt-0.5">Global sizes · Per-design overrides</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Stats chips */}
              <span className="hidden sm:inline-flex px-3 py-1 text-xs font-bold rounded-full"
                style={{ background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}>
                {enabledSizes.length} Active
              </span>
              {disabledSizes.length > 0 && (
                <span className="hidden sm:inline-flex px-3 py-1 text-xs font-bold rounded-full"
                  style={{ background: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb' }}>
                  {disabledSizes.length} Off
                </span>
              )}

              <button onClick={handleSync} disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
                style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                <span className={syncing ? 'animate-spin' : ''}><Icons.Refresh /></span>
                {syncing ? 'Syncing…' : 'Sync'}
              </button>

              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>
                <Icons.Plus />
                Add Size
              </button>
            </div>
          </div>

          {/* Info banner */}
          <div className="flex items-center gap-3 p-3 rounded-xl mb-6"
            style={{ background: 'linear-gradient(135deg, #eef2ff, #faf5ff)', border: '1px solid #e0e7ff' }}>
            <Icons.Sparkle />
            <p className="text-xs font-medium text-indigo-700">
              Enabling a size <strong>auto-syncs</strong> it to all products. Use "Sync" to force-update manually.
            </p>
          </div>

          {/* ── Size Grid ── */}
          {sizes.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icons.Package />
              </div>
              <p className="text-gray-500 font-semibold">No sizes yet</p>
              <p className="text-gray-400 text-sm mt-1">Click "Add Size" to get started</p>
            </div>
          ) : (
            <div className="space-y-6">
              {enabledSizes.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    ✅ Active Sizes
                  </p>
                  <div className="grid gap-3"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
                    {enabledSizes.map(size => (
                      <SizePill key={size.name} size={size} toggling={toggling} onToggle={handleToggle} />
                    ))}
                  </div>
                </div>
              )}

              {disabledSizes.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    ⛔ Disabled Sizes
                  </p>
                  <div className="grid gap-3"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
                    {disabledSizes.map(size => (
                      <SizePill key={size.name} size={size} toggling={toggling} onToggle={handleToggle} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════ DESIGN-SPECIFIC CARD ══════════════ */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-100 overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

        <div className="h-1" style={{ background: 'linear-gradient(90deg, #a855f7, #ec4899, #f97316)' }} />

        <div className="p-6">
          {/* Title */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', boxShadow: '0 4px 14px rgba(168,85,247,0.3)' }}>
              <Icons.Design />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Design-Specific Sizes</h3>
              <p className="text-xs text-gray-400 mt-0.5">Override enabled sizes for one design only</p>
            </div>
          </div>

          {/* Search bar — REPLACE THE ENTIRE flex gap-3 div with this */}
          <div className="relative">
  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
    <Icons.Design />
  </div>

  <select
    value={selectedDesign}
    onChange={e => {
      const d = e.target.value;
      setSelectedDesign(d);
      handleLoadDesign(d);
    }}
    className="w-full pl-10 pr-10 py-3 rounded-xl text-sm font-medium appearance-none focus:outline-none"
    style={{ border: '2px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}
    onFocus={e => { e.target.style.borderColor = '#a855f7'; e.target.style.boxShadow = '0 0 0 4px rgba(168,85,247,0.1)'; }}
    onBlur={e  => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
  >
    <option value="">— Select a Design —</option>
    {designs.map(d => (
      <option key={d} value={d}>{d}</option>
    ))}
  </select>

  {/* Chevron arrow */}
  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  </div>

  {/* Loading spinner inside dropdown */}
  {loadingDes && (
    <div className="absolute right-9 top-1/2 -translate-y-1/2">
      <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )}
</div>


          {/* ── Result ── */}
          {designSizes && (
            <div className="mt-6 size-card-enter">
              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="px-4 py-1.5 text-sm font-bold rounded-full"
                    style={{ background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff' }}>
                    {designName}
                  </span>
                  <span className="text-xs text-gray-400">
                    {designSizes.filter(s => s.enabledForDesign).length} / {designSizes.length} enabled
                  </span>
                </div>
                <button onClick={handleToggleAllDesign}
                  className="text-xs font-bold underline underline-offset-2"
                  style={{ color: '#a855f7' }}>
                  {designSizes.every(s => s.enabledForDesign) ? 'Disable All' : 'Enable All'}
                </button>
              </div>

              {/* Pills */}
              <div className="flex flex-wrap gap-3">
                {designSizes.map(size => (
                  <DesignSizePill key={size.name} size={size} onToggle={handleToggleDesignSize} />
                ))}
              </div>

              <p className="text-xs text-gray-400 mt-4 flex items-center gap-1.5">
                <Icons.Sparkle />
                Tap a pill to toggle it only for <strong className="text-gray-600">{designName}</strong>. Global sizes stay unchanged.
              </p>
            </div>
          )}

          {/* Empty state */}
          {!designSizes && !loadingDes && (
            <div className="mt-6 text-center py-10 rounded-2xl"
              style={{ border: '2px dashed #e5e7eb' }}>
              <div className="flex justify-center mb-3 opacity-40"><Icons.Design /></div>
              <p className="text-gray-400 text-sm">Search a design to manage its sizes</p>
              <p className="text-gray-300 text-xs mt-1">Type in the box above and press Load</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Modal ── */}
      {showAdd && (
        <AddSizeModal onClose={() => setShowAdd(false)} onAdd={handleAddSize} />
      )}
    </>
  );
};

export default SizeConfiguration;
