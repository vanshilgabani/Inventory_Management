import { useState } from 'react';
import Card from '../common/Card';
import { format, startOfMonth } from 'date-fns';
import { FiTruck, FiX, FiUser, FiCalendar, FiHash, FiFileText, FiArrowDownCircle } from 'react-icons/fi';

const INCOMING_TYPES  = ['factory', 'borrowed_buyer', 'borrowed_vendor'];
const BORROWED_TYPES  = ['borrowed_buyer', 'borrowed_vendor'];
const FACTORY_TYPES   = ['factory'];
const SIZE_ORDER      = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

const getTypeBadge   = (t) => t === 'factory' ? 'bg-green-100 text-green-700' : t === 'borrowed_buyer' ? 'bg-blue-100 text-blue-700' : t === 'borrowed_vendor' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600';
const getTypeLabel   = (t) => t === 'factory' ? 'Factory' : t === 'borrowed_buyer' ? 'Buyer' : t === 'borrowed_vendor' ? 'Vendor' : t;
const getTypeColor   = (t) => t === 'factory' ? 'border-green-200 bg-green-50' : t === 'borrowed_buyer' ? 'border-blue-200 bg-blue-50' : 'border-purple-200 bg-purple-50';
const getHeaderColor = (t) => t === 'factory' ? 'bg-green-600' : t === 'borrowed_buyer' ? 'bg-blue-600' : 'bg-purple-600';

// ── Group receivings into logical batches ──
const buildGroups = (receivings) => {
  const groupedBatches = [];
  const batchMap = {};

  receivings.forEach(r => {
    const isBorrowed = BORROWED_TYPES.includes(r.sourceType);
    const batchId    = r.batchId ? String(r.batchId).trim() : '';
    const rDate      = new Date(r.receivedDate || r.createdAt);
    const dateKey    = format(rDate, 'yyyy-MM-dd');

    let groupKey;
    if (!isBorrowed && batchId) groupKey = `batch_${batchId}`;         // factory with batchId
    else if (!isBorrowed)       groupKey = `factory_${dateKey}`;        // factory no batchId → group by date ✅
    else                        groupKey = `${r.sourceType}_${dateKey}`; // borrowed → group by type+date

    if (batchMap[groupKey] !== undefined) {
      const g = groupedBatches[batchMap[groupKey]];
      g.totalQuantity += Number(r.totalQuantity || 0);
      g.receivings.push(r);
      if (rDate > g.latestDate) g.latestDate = rDate;
      if (r.design && !g.designs.includes(r.design)) g.designs.push(r.design);
      if (r.color  && !g.colors.includes(r.color))   g.colors.push(r.color);
    } else {
      batchMap[groupKey] = groupedBatches.length;
      groupedBatches.push({
        groupKey,
        batchId:       (!isBorrowed && batchId) ? batchId : null,
        sourceType:    r.sourceType,
        sourceName:    r.sourceName || '',
        totalQuantity: Number(r.totalQuantity || 0),
        latestDate:    rDate,
        designs:       r.design ? [r.design] : [],
        colors:        r.color  ? [r.color]  : [],
        receivings:    [r],
        isBorrowed,
      });
    }
  });

  return groupedBatches.sort((a, b) => b.latestDate - a.latestDate);
};

const getBatchLabel = (g) => {
  if (g.isBorrowed)           return g.sourceName || getTypeLabel(g.sourceType);
  if (!g.designs.length)      return g.batchId ? `Batch #${g.batchId}` : format(g.latestDate, 'dd MMM');
  if (g.designs.length === 1) return g.colors.length === 1 ? `${g.designs[0]} · ${g.colors[0]}` : g.designs[0];
  if (g.designs.length <= 3)  return g.designs.join(', ');
  return `${g.designs.slice(0, 2).join(', ')} +${g.designs.length - 2}`;
};

// ── Batch Detail Modal ──
const BatchModal = ({ batch, onClose }) => {
  if (!batch) return null;

  const allQuantities = {};
  batch.receivings.forEach(r => {
    const quantities = (r.quantities && typeof r.quantities === 'object' && !Array.isArray(r.quantities))
      ? r.quantities : {};
    Object.entries(quantities).forEach(([size, qty]) => {
      if (size && size !== 'undefined')
        allQuantities[size] = (allQuantities[size] || 0) + Number(qty || 0);
    });
  });
  const sortedSizes = Object.keys(allQuantities).sort(
    (a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className={`${getHeaderColor(batch.sourceType)} p-4 flex items-start justify-between`}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <FiTruck className="w-4 h-4 text-white opacity-80" />
              <span className="text-white text-xs font-semibold uppercase tracking-wider opacity-80">
                {getTypeLabel(batch.sourceType)} Receiving
              </span>
            </div>
            <p className="text-white text-base font-bold">
              {batch.batchId ? `Batch #${batch.batchId}` : batch.sourceName || getBatchLabel(batch)}
            </p>
            <p className="text-white text-xs opacity-70 mt-0.5">
              {format(batch.latestDate, 'dd MMMM yyyy')}
              {batch.receivings.length > 1 && ` · ${batch.receivings.length} entries`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center transition-colors ml-3">
            <FiX className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-xl p-2.5 text-center border border-gray-100">
              <p className="text-lg font-extrabold text-gray-800">{batch.totalQuantity.toLocaleString('en-IN')}</p>
              <p className="text-[9px] text-gray-500 mt-0.5">Total Pcs</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 text-center border border-gray-100">
              <p className="text-lg font-extrabold text-gray-800">{batch.designs.length || '—'}</p>
              <p className="text-[9px] text-gray-500 mt-0.5">Designs</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 text-center border border-gray-100">
              <p className="text-lg font-extrabold text-gray-800">{batch.receivings.length}</p>
              <p className="text-[9px] text-gray-500 mt-0.5">Entries</p>
            </div>
          </div>

          {/* Combined size breakdown */}
          {sortedSizes.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Size Breakdown</p>
              <div className="flex flex-wrap gap-2">
                {sortedSizes.map(size => (
                  <div key={size} className="flex flex-col items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 min-w-[52px]">
                    <span className="text-xs font-bold text-gray-700">{size}</span>
                    <span className="text-sm font-extrabold text-gray-900">{allQuantities[size]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Individual entries */}
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Entries</p>
            <div className="space-y-2">
              {batch.receivings
                .sort((a, b) => new Date(a.receivedDate || a.createdAt) - new Date(b.receivedDate || b.createdAt))
                .map((r, i) => {
                  const rQty        = (r.quantities && typeof r.quantities === 'object' && !Array.isArray(r.quantities)) ? r.quantities : {};
                  const rDate       = new Date(r.receivedDate || r.createdAt);
                  const sizeEntries = Object.entries(rQty).filter(([s, q]) => s && s !== 'undefined' && Number(q) > 0);
                  return (
                    <div key={r._id || i} className={`rounded-xl border p-3 ${getTypeColor(r.sourceType)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${getTypeBadge(r.sourceType)}`}>
                            {getTypeLabel(r.sourceType)}
                          </span>
                          {r.design && (
                            <span className="text-[10px] font-bold text-gray-700">
                              {r.design}{r.color ? ` · ${r.color}` : ''}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-extrabold text-gray-800">
                          +{Number(r.totalQuantity || 0).toLocaleString('en-IN')} pcs
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
                        <div className="flex items-center gap-1.5">
                          <FiCalendar className="w-3 h-3 text-gray-400" />
                          <span className="text-[10px] text-gray-600">{format(rDate, 'dd MMM yyyy, hh:mm a')}</span>
                        </div>
                        {r.receivedBy && (
                          <div className="flex items-center gap-1.5">
                            <FiUser className="w-3 h-3 text-gray-400" />
                            <span className="text-[10px] text-gray-600">{r.receivedBy}</span>
                          </div>
                        )}
                        {r.batchId && (
                          <div className="flex items-center gap-1.5">
                            <FiHash className="w-3 h-3 text-gray-400" />
                            <span className="text-[10px] text-gray-600">Batch #{r.batchId}</span>
                          </div>
                        )}
                        {r.sourceName && (
                          <div className="flex items-center gap-1.5">
                            <FiTruck className="w-3 h-3 text-gray-400" />
                            <span className="text-[10px] text-gray-600">{r.sourceName}</span>
                          </div>
                        )}
                      </div>
                      {sizeEntries.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-white border-opacity-60">
                          {sizeEntries
                            .sort(([a], [b]) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b))
                            .map(([size, qty]) => (
                              <span key={size} className="text-[9px] px-2 py-0.5 bg-white rounded-lg border border-gray-200 text-gray-700 font-semibold">
                                {size}: {qty}
                              </span>
                            ))}
                        </div>
                      )}
                      {r.notes && (
                        <div className="flex items-start gap-1.5 mt-1.5 pt-1.5 border-t border-white border-opacity-60">
                          <FiFileText className="w-3 h-3 text-gray-400 mt-0.5" />
                          <span className="text-[10px] text-gray-500 italic">{r.notes}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Sub-section: Factory OR Borrowed ──
const ReceivingSection = ({ title, icon: Icon, accentColor, kpiColor, groups, onSelect, maxHeight = 'max-h-[200px]' }) => {
  const totalUnits = groups.reduce((s, g) => s + g.totalQuantity, 0);

  if (groups.length === 0) return (
    <div className={`rounded-xl border ${accentColor} p-3`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-gray-500" />
        <p className="text-xs font-bold text-gray-700">{title}</p>
      </div>
      <p className="text-[10px] text-gray-400 text-center py-2">No receiving this month</p>
    </div>
  );

  return (
    <div className={`rounded-xl border ${accentColor} p-3`}>
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-gray-600" />
          <p className="text-xs font-bold text-gray-700">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-extrabold ${kpiColor}`}>
            {totalUnits.toLocaleString('en-IN')} pcs
          </span>
          <span className="text-[10px] text-gray-400">
            {groups.filter(g => g.batchId).length > 0
              ? `· ${groups.filter(g => g.batchId).length} batch${groups.filter(g => g.batchId).length !== 1 ? 'es' : ''}`
              : ''}
          </span>
        </div>
      </div>

      {/* Batch rows */}
      <div className={`space-y-1.5 ${maxHeight} overflow-y-auto`}>
        {groups.map(g => (
          <div
            key={g.groupKey}
            onClick={() => onSelect(g)}
            className="flex items-center justify-between text-[10px] p-2 bg-white rounded-lg hover:bg-gray-50 border border-gray-100 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded text-gray-500 whitespace-nowrap">
                {format(g.latestDate, 'dd MMM')}
              </span>
              {g.batchId && (
                <span className="text-[9px] px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded text-gray-500 whitespace-nowrap">
                  #{g.batchId}
                </span>
              )}
              {g.isBorrowed && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${getTypeBadge(g.sourceType)}`}>
                  {getTypeLabel(g.sourceType)}
                </span>
              )}
              <span className="font-medium text-gray-700 truncate">{getBatchLabel(g)}</span>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className="font-bold text-green-700">+{g.totalQuantity.toLocaleString('en-IN')}</p>
              {g.receivings.length > 1 && <p className="text-[9px] text-gray-400">{g.receivings.length} entries</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main Card ──
const FactoryReceivingCard = ({ factoryReceivings = [] }) => {
  const [selectedBatch, setSelectedBatch] = useState(null);
  const monthStart = startOfMonth(new Date());

  // This month, incoming only
  const thisMonth = (factoryReceivings || []).filter(r => {
    if (!INCOMING_TYPES.includes(r.sourceType)) return false;
    return new Date(r.receivedDate || r.createdAt) >= monthStart;
  });

  // Split by type BEFORE grouping
  const factoryRaw  = thisMonth.filter(r => FACTORY_TYPES.includes(r.sourceType));
  const borrowedRaw = thisMonth.filter(r => BORROWED_TYPES.includes(r.sourceType));

  const factoryGroups  = buildGroups(factoryRaw);
  const borrowedGroups = buildGroups(borrowedRaw);

  const totalAll = thisMonth.reduce((s, r) => s + Number(r.totalQuantity || 0), 0);

  return (
    <>
      <Card className="p-4 h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-800">Factory Receiving</h3>
            <p className="text-[10px] text-gray-400">{format(new Date(), 'MMMM yyyy')} inflow</p>
          </div>
          <div className="p-1.5 bg-green-50 rounded-lg">
            <FiTruck className="w-4 h-4 text-green-600" />
          </div>
        </div>

        {/* Overall KPIs */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-green-50 rounded-xl p-2.5 text-center">
            <p className="text-base font-extrabold text-green-700">
              {factoryRaw.reduce((s, r) => s + Number(r.totalQuantity || 0), 0).toLocaleString('en-IN')}
            </p>
            <p className="text-[9px] text-gray-500 mt-0.5">Factory Units</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-2.5 text-center">
            <p className="text-base font-extrabold text-blue-700">
              {borrowedRaw.reduce((s, r) => s + Number(r.totalQuantity || 0), 0).toLocaleString('en-IN')}
            </p>
            <p className="text-[9px] text-gray-500 mt-0.5">Borrowed Units</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-2.5 text-center">
            <p className="text-base font-extrabold text-purple-700">
              {factoryGroups.filter(g => g.batchId).length}
            </p>
            <p className="text-[9px] text-gray-500 mt-0.5">Factory Batches</p>
          </div>
        </div>

        {/* ── Factory Section ── */}
        <div className="mb-3">
          <ReceivingSection
            title="Factory Received"
            icon={FiTruck}
            accentColor="border-green-100 bg-green-50"
            kpiColor="text-green-700"
            groups={factoryGroups}
            onSelect={setSelectedBatch}
            maxHeight="max-h-[200px]"
          />
        </div>

        {/* ── Borrowed Section ── */}
        <ReceivingSection
          title="Borrowed Stock"
          icon={FiArrowDownCircle}
          accentColor="border-blue-100 bg-blue-50"
          kpiColor="text-blue-700"
          groups={borrowedGroups}
          onSelect={setSelectedBatch}
          maxHeight="max-h-[80px]"
        />
      </Card>

      {selectedBatch && (
        <BatchModal batch={selectedBatch} onClose={() => setSelectedBatch(null)} />
      )}
    </>
  );
};

export default FactoryReceivingCard;
