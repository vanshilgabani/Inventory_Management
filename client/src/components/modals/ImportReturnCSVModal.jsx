import React, { useState, useRef, useEffect } from 'react';
import {
  FiX, FiUpload, FiCheckCircle, FiAlertCircle,
  FiFileText, FiRotateCcw, FiFilter, FiRefreshCw, FiCopy, FiDownload
} from 'react-icons/fi';
import Papa from 'papaparse';
import { salesService } from '../../services/salesService';
import toast from 'react-hot-toast';

const STEP = { UPLOAD: 'upload', PREVIEW: 'preview', RESULT: 'result' };
const BATCH_SIZE = 300;

const cleanId = value =>
  String(value ?? '').trim().replace(/^'/, '');

const cleanOptionalId = value => {
  const cleaned = cleanId(value);
  return cleaned || '';
};

const isScientificNotation = value =>
  /^\d+(\.\d+)?e\+\d+$/i.test(String(value ?? '').trim());

const normalizeMyntraReturnRow = row => {
  const normalized = {};

  Object.entries(row || {}).forEach(([key, value]) => {
    normalized[String(key).trim().toLowerCase()] = value;
  });

  const status = String(normalized.status || '')
    .trim()
    .toUpperCase();

  const isRTO = status === 'RTO';

  return {
    order_id: cleanOptionalId(normalized.order_id),
    order_group_id: cleanOptionalId(normalized.order_group_id),
    forward_tracking_number: cleanOptionalId(
      normalized.forward_tracking_number
    ),
    seller_sku_code: String(normalized.seller_sku_code || '').trim(),

    status,

    return_id: cleanOptionalId(normalized.return_id),
    return_reason: String(normalized.return_reason || '').trim(),
    return_created_date: String(
      normalized.return_created_date || ''
    ).trim(),

    return_tracking_number: isRTO
      ? ''
      : cleanOptionalId(normalized.return_tracking_number),

    isRTO,

    corrupted:
      isScientificNotation(normalized.order_id) ||
      isScientificNotation(normalized.order_group_id)
  };
};

const ImportReturnCSVModal = ({ isOpen, onClose, onSuccess, preloadedFile, importAccount }) => {
  const [step, setStep] = useState(STEP.UPLOAD);
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [parseStats, setParseStats] = useState(null);
  const [returnMarketplace, setReturnMarketplace] = useState('flipkart');
  const fileInputRef = useRef(null);

  const reset = () => {
    setStep(STEP.UPLOAD);
    setFile(null);
    setIsLoading(false);
    setPreview(null);
    setResult(null);
    setParsedRows([]);
    setParseStats(null);
    setReturnMarketplace('flipkart');
  };

  useEffect(() => {
    if (isOpen && preloadedFile) {
      handleFile(preloadedFile);
    }
  }, [isOpen, preloadedFile]);

  const handleClose = () => { reset(); onClose(); };

const handleFile = async f => {
  if (!f) return;

  setFile(f);
  setIsLoading(true);
  setPreview(null);
  setResult(null);

  Papa.parse(f, {
    header: true,
    skipEmptyLines: true,

    complete: async results => {
      try {
        const rows = results.data || [];

        if (!rows.length) {
          toast.error('CSV file is empty.');
          return;
        }

        const rawHeaders = Object.keys(rows[0] || {});
        const headers = rawHeaders.map(header =>
          String(header).trim().toLowerCase()
        );

        const isMyntra =
          headers.includes('order_id') &&
          headers.includes('order_group_id') &&
          headers.includes('forward_tracking_number') &&
          headers.includes('return_tracking_number');

        const isFlipkart =
          headers.includes('return id') ||
          headers.includes('return reason') ||
          headers.includes('return status') ||
          headers.includes('return type');

        if (!isMyntra && !isFlipkart) {
          toast.error(
            'Unsupported return CSV. Upload a Flipkart Return CSV or Myntra Returns Report.',
            { duration: 5000 }
          );
          setFile(null);
          return;
        }

        setReturnMarketplace(isMyntra ? 'myntra' : 'flipkart');

        if (isMyntra) {
          const normalizedRows = rows.map(normalizeMyntraReturnRow);

          const validRows = normalizedRows.filter(row => {
            const hasIdentifier =
              row.order_id ||
              row.order_group_id ||
              row.forward_tracking_number;

            return hasIdentifier || row.corrupted;
          });

          const skippedCount = normalizedRows.length - validRows.length;

          const dedupeMap = new Map();

          validRows.forEach(row => {
            const key =
              row.order_id ||
              `${row.order_group_id}__${row.forward_tracking_number}__${row.seller_sku_code}`;

            // Keep the last occurrence, matching the current Flipkart behavior.
            dedupeMap.set(key, row);
          });

          const uniqueRows = Array.from(dedupeMap.values());

          const parsedStats = {
            total: rows.length,
            invalid: skippedCount,
            duplicates: validRows.length - uniqueRows.length,
            toProcess: uniqueRows.length
          };

          setParseStats(parsedStats);
          setParsedRows(uniqueRows);

          const previewRows = uniqueRows.slice(0, 8).map(row => ({
            orderItemId: row.order_id || '-',
            orderId: row.order_group_id || '-',
            returnType: row.isRTO
              ? 'Courier Return'
              : 'Customer Return',
            returnReason: row.return_reason || '',
            returnSubReason: '',
            returnStatus: '',
            isRTO: row.isRTO,
            newReturnTrackingId: row.return_tracking_number || null,
            comments: '',
            matchedVia: 'Server matching'
          }));

          setPreview({
            marketplace: 'myntra',
            matchedCount: uniqueRows.length,
            skippedCount,
            matched: previewRows,
            unmatched: []
          });

          setStep(STEP.PREVIEW);

          toast.success(
            `Myntra return report loaded: ${uniqueRows.length} unique rows`,
            { duration: 4000 }
          );

          return;
        }

        /*
         * Existing Flipkart path
         */
        const returnSignature = [
          'return id',
          'return reason',
          'return sub-reason',
          'return status',
          'return type'
        ];

        const matchCount = returnSignature.filter(column =>
          headers.includes(column)
        ).length;

        if (matchCount < 2) {
          toast.error(
            'Not a Flipkart Return CSV. Please upload the correct file.',
            { duration: 4000 }
          );
          setFile(null);
          return;
        }

        const validRows = rows.filter(row => {
          const id =
            row['Order Item ID'] ||
            row['Order Item Id'] ||
            row['ORDER ITEM ID'];

          return Boolean(String(id || '').trim());
        });

        const deduped = new Map();

        validRows.forEach(row => {
          const id = String(
            row['Order Item ID'] ||
            row['Order Item Id'] ||
            row['ORDER ITEM ID'] ||
            ''
          )
            .trim()
            .replace(/^'/, '');

          if (id) deduped.set(id, row);
        });

        const slimRows = Array.from(deduped.values()).map(row => ({
          'Order Item ID': String(
            row['Order Item ID'] ||
            row['Order Item Id'] ||
            row['ORDER ITEM ID'] ||
            ''
          )
            .trim()
            .replace(/^'/, ''),

          'Order ID': String(
            row['Order ID'] ||
            row['Order Id'] ||
            ''
          ).trim(),

          'Return ID': String(
            row['Return ID'] ||
            row['Return Id'] ||
            ''
          ).trim(),

          'Tracking ID': String(
            row['Tracking ID'] ||
            row['Return Tracking Id'] ||
            row['Return AWB'] ||
            ''
          ).trim(),

          'Return Status': String(
            row['Return Status'] || ''
          ).trim(),

          'Return Reason': String(
            row['Return Reason'] || ''
          ).trim(),

          'Return Sub-reason': String(
            row['Return Sub-reason'] ||
            row['Return Sub-Reason'] ||
            ''
          ).trim(),

          Comments: String(
            row['Comments'] ||
            row['Customer Comments'] ||
            ''
          ).trim(),

          'Return Type': String(
            row['Return Type'] || ''
          ).trim(),

          'Return Requested Date': String(
            row['Return Requested Date'] || ''
          ).trim(),

          'Completed Date': String(
            row['Completed Date'] || ''
          ).trim()
        }));

        const stats = {
          total: rows.length,
          invalid: rows.length - validRows.length,
          duplicates: validRows.length - slimRows.length,
          toProcess: slimRows.length
        };

        setParseStats(stats);
        setParsedRows(slimRows);

        setPreview({
          marketplace: 'flipkart',
          matchedCount: slimRows.length,
          skippedCount: stats.invalid,
          matched: slimRows.slice(0, 8).map(row => ({
            orderItemId: row['Order Item ID'],
            orderId: row['Order ID'],
            returnType: row['Return Type'],
            returnReason: row['Return Reason'],
            returnSubReason: row['Return Sub-reason'],
            returnStatus: row['Return Status'],
            isRTO:
              String(row['Return Type']).toLowerCase() ===
              'courier_return',
            newReturnTrackingId: row['Tracking ID'] || null,
            comments: row.Comments
          })),
          unmatched: []
        });

        setReturnMarketplace('flipkart');
        setStep(STEP.PREVIEW);
      } catch (error) {
        console.error('Return CSV processing error:', error);
        toast.error('Failed to process return CSV.');
      } finally {
        setIsLoading(false);
      }
    },

    error: error => {
      console.error('CSV parse error:', error);
      toast.error('Failed to read CSV file.');
      setIsLoading(false);
    }
  });
};

const handleImport = async () => {
  if (!parsedRows.length) {
    toast.error('No valid rows to import.');
    return;
  }

  setIsLoading(true);

  try {
    /*
     * Do not run parallel batches.
     *
     * Myntra matching may use tracking ID or Order ID for multiple
     * line items in one parcel. Sequential processing prevents two
     * batches from trying to claim the same sale.
     */
    const BATCH_SIZE = 300;
    const chunks = [];

    for (let i = 0; i < parsedRows.length; i += BATCH_SIZE) {
      chunks.push(parsedRows.slice(i, i + BATCH_SIZE));
    }

    const aggregated = {
      updated: 0,
      unmatched: 0,
      skipped: parseStats?.invalid || 0,
      rtoCount: 0,
      trackingStored: 0,
      errors: [],
      unmatchedOrders: [],
      failedBatches: 0
    };

    for (let i = 0; i < chunks.length; i += 1) {
      const response =
        returnMarketplace === 'myntra'
          ? await salesService.importMyntraReturnCSV(
              chunks[i],
              importAccount
            )
          : await salesService.importReturnCSV(
              chunks[i],
              importAccount
            );

      if (!response?.success) {
        throw new Error(
          response?.message || `Batch ${i + 1} failed`
        );
      }

      const data = response.data || {};

      aggregated.updated += data.updated || 0;
      aggregated.unmatched += data.unmatched || 0;
      aggregated.skipped +=
        i === 0 ? data.skipped || 0 : 0;
      aggregated.rtoCount += data.rtoCount || 0;
      aggregated.trackingStored += data.trackingStored || 0;
      aggregated.errors.push(...(data.errors || []));
      aggregated.unmatchedOrders.push(
        ...(data.unmatchedOrders || [])
      );
    }

    setResult(aggregated);
    setStep(STEP.RESULT);

    if (onSuccess) {
      onSuccess();
    }

    toast.success(
      `${aggregated.updated} orders updated successfully!`
    );
  } catch (error) {
    console.error('Return import failed:', error);

    toast.error(
      error?.response?.data?.message ||
        error.message ||
        'Import failed. Please try again.',
      { duration: 6000 }
    );
  } finally {
    setIsLoading(false);
  }
};

  if (!isOpen) return null;

  const stepLabels = ['Upload', 'Preview', 'Done'];
  const stepIdx = Object.values(STEP).indexOf(step);



  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">


        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
              <FiRotateCcw className="text-orange-500 text-lg" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Import Return CSV</h2>
              <p className="text-xs text-gray-400 mt-0.5">Update orders with return tracking &amp; reasons</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <FiX className="text-gray-400 text-lg" />
          </button>
        </div>


        {/* ── Step Indicator ── */}
        <div className="flex items-center gap-1.5 px-6 pt-4">
          {stepLabels.map((label, i) => {
            const done   = i < stepIdx;
            const active = i === stepIdx;
            return (
              <React.Fragment key={label}>
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  done   ? 'bg-green-100 text-green-700' :
                  active ? 'bg-orange-100 text-orange-700' :
                           'bg-gray-100 text-gray-400'
                }`}>
                  {done && <FiCheckCircle className="text-xs" />}
                  {label}
                </div>
                {i < 2 && <div className="w-4 h-px bg-gray-200" />}
              </React.Fragment>
            );
          })}
        </div>


        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6">


          {/* STEP 1 — UPLOAD */}
          {step === STEP.UPLOAD && (
            <div className="space-y-4">
              <div
                onClick={() => !isLoading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
                  isLoading
                    ? 'border-orange-300 bg-orange-50 cursor-wait'
                    : 'border-gray-200 hover:border-orange-400 hover:bg-orange-50/40 cursor-pointer group'
                }`}
              >
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3 text-orange-500">
                    <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                    <p className="text-sm font-medium">Analysing CSV...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-200">
                      <FiUpload className="text-orange-500 text-2xl" />
                    </div>
                    <p className="font-semibold text-gray-700 mb-1">Click to upload Return CSV</p>
                    <p className="text-xs text-gray-400">Flipkart Seller Hub → Reports → Returns</p>
                    {file && (
                      <div className="mt-3 inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-medium">
                        <FiFileText /> {file.name}
                      </div>
                    )}
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
              />

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-blue-800">What this import updates:</p>
                {[
                  'Return Tracking ID — customer returns only (RTO tracking is skipped)',
                  'Return Reason, Sub-reason & Customer Comments',
                  'Return ID, Return Status, Return Type & Dates',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-blue-700">
                    <span className="text-blue-400 font-bold mt-0.5">·</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* STEP 2 — PREVIEW */}
          {step === STEP.PREVIEW && preview && (
            <div className="space-y-4">

              {/* Client-side filter summary banner */}
              {parseStats && (parseStats.invalid > 0 || parseStats.duplicates > 0) && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center gap-3">
                  <FiFilter className="text-indigo-500 flex-shrink-0" />
                  <div className="text-xs text-indigo-700 space-y-0.5">
                    <p className="font-semibold text-indigo-800">Pre-processed before sending to server</p>
                    <p>
                      {parseStats.total} rows in CSV
                      {parseStats.invalid > 0 && (
                        <span className="ml-2 text-red-500">
                          · {parseStats.invalid} empty rows removed
                        </span>
                      )}
                      {parseStats.duplicates > 0 && (
                        <span className="ml-2 text-amber-600">
                          · {parseStats.duplicates} duplicates removed
                        </span>
                      )}
                      <span className="ml-2 font-semibold text-indigo-800">
                        → {parseStats.toProcess} unique orders sent
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">  {/* 2 cols, not 3 */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700">{preview.matchedCount}</p>
                  <p className="text-xs text-blue-600 font-medium mt-1">Orders to Process</p>
                  <p className="text-xs text-blue-400 mt-0.5">Exact results shown after update</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-gray-400">{preview.skippedCount}</p>
                  <p className="text-xs text-gray-400 font-medium mt-1">Empty Rows Skipped</p>
                </div>
              </div>

              {/* Matched orders sample */}
              {preview.matched?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Sample of orders to process
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                    {preview.matched.slice(0, 8).map((item, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50/80 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono font-semibold text-gray-800">
                            {item.orderItemId || item.orderId}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full font-medium ${
                            item.isRTO
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {item.isRTO ? 'RTO' : 'Return'}
                          </span>
                        </div>
                        <div className="space-y-0.5 text-gray-500">
                          {item.newReturnTrackingId && (
                            <p>🚚 <span className="text-gray-700 font-medium">{item.newReturnTrackingId}</span></p>
                          )}
                          {item.returnReason && (
                            <p>{item.returnReason}{item.returnSubReason ? ` → ${item.returnSubReason}` : ''}</p>
                          )}
                          {item.returnStatus && (
                            <p className="text-gray-400">Status: {item.returnStatus}</p>
                          )}
                          {item.comments && (
                            <p className="italic text-gray-400">"{item.comments}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {preview.matched.length > 8 && (
                      <p className="text-xs text-center text-gray-400 py-2">
                        +{preview.matched.length - 8} more orders
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Batch info hint for large imports */}
              {parsedRows.length > BATCH_SIZE && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2 text-xs text-gray-500">
                  <FiFilter className="flex-shrink-0" />
                  <span>
                    {parsedRows.length} orders will be imported in{' '}
                    <strong>
                      {Math.ceil(parsedRows.length / BATCH_SIZE)} parallel batches
                    </strong>{' '}
                    of {BATCH_SIZE}.
                  </span>
                </div>
              )}
            </div>
          )}


          {/* STEP 3 — RESULT */}
          {step === STEP.RESULT && result && (
            <div className="space-y-4">
              <div className="text-center pt-2 pb-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  result.failedBatches > 0 ? 'bg-amber-100' : 'bg-green-100'
                }`}>
                  {result.failedBatches > 0
                    ? <FiAlertCircle className="text-amber-500 text-3xl" />
                    : <FiCheckCircle className="text-green-600 text-3xl" />
                  }
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  {result.failedBatches > 0 ? 'Partial Import' : 'Import Complete'}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {result.failedBatches > 0
                    ? `${result.failedBatches} batch(es) failed — retry below`
                    : 'Exact results from server shown below'
                  }
                </p>
              </div>

              {/* ✅ Accurate result cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{result.updated}</p>
                  <p className="text-xs text-green-600 font-medium mt-1">Updated</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{result.unmatched}</p>
                  <p className="text-xs text-amber-600 font-medium mt-1">Not Found</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-gray-500">{result.skipped}</p>
                  <p className="text-xs text-gray-400 font-medium mt-1">Skipped</p>
                </div>
              </div>

              {/* ✅ ADD-ON 1: RTO + Tracking summary */}
              {(result.rtoCount > 0 || result.trackingStored > 0) && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
                  <FiFileText className="text-blue-500 flex-shrink-0" />
                  <div className="text-xs text-blue-700 space-y-0.5">
                    {result.trackingStored > 0 && (
                      <p>🚚 <strong>{result.trackingStored}</strong> return tracking IDs stored</p>
                    )}
                    {result.rtoCount > 0 && (
                      <p>📦 <strong>{result.rtoCount}</strong> RTOs — tracking skipped (as expected)</p>
                    )}
                  </div>
                </div>
              )}

              {/* ✅ ADD-ON 2: Unmatched orders list with Copy + Download */}
              {result.unmatchedOrders?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-amber-800">
                      ⚠ {result.unmatchedOrders.length} orders not found in system
                    </p>
                    <div className="flex items-center gap-2">
                      {/* ✅ ADD-ON 3: Copy unmatched IDs */}
                      <button
                        onClick={() => {
                          const ids = result.unmatchedOrders
                            .map(o => o.orderItemId || o.orderId)
                            .join('\n');
                          navigator.clipboard.writeText(ids);
                          toast.success('Copied to clipboard!');
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-800 text-xs font-medium rounded-lg transition-colors"
                      >
                        <FiCopy className="text-xs" /> Copy IDs
                      </button>

                      {/* ✅ ADD-ON 4: Download unmatched as CSV */}
                      {result.unmatchedOrders.length >= 5 && (
                        <button
                          onClick={() => {
                            const csv = [
                              'Order Item ID,Order ID,Return Type,Return Reason',
                              ...result.unmatchedOrders.map(o =>
                                `${o.orderItemId || ''},${o.orderId || ''},${o.returnType || ''},${o.returnReason || ''}`
                              )
                            ].join('\n');
                            const blob = new Blob([csv], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `unmatched-returns-${new Date().toISOString().slice(0,10)}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-800 text-xs font-medium rounded-lg transition-colors"
                        >
                          <FiDownload className="text-xs" /> Download
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {result.unmatchedOrders.slice(0, 6).map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-amber-800">
                          {item.orderItemId || item.orderId}
                        </span>
                        {item.returnReason && (
                          <span className="text-amber-500 truncate ml-2 max-w-[160px]">
                            {item.returnReason}
                          </span>
                        )}
                      </div>
                    ))}
                    {result.unmatchedOrders.length > 6 && (
                      <p className="text-xs text-amber-500 pt-1">
                        +{result.unmatchedOrders.length - 6} more — download CSV to see all
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.errors?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-800 mb-1.5">Row-level errors:</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs font-mono text-red-700">
                      {e.orderItemId}: {e.error}
                    </p>
                  ))}
                </div>
              )}

              {/* Retry banner */}
              {result.failedBatches > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      {result.failedBatches} batch(es) did not complete
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Safe to retry — return import only overwrites, never duplicates.
                    </p>
                  </div>
                  <button
                    onClick={handleImport}
                    disabled={isLoading}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    <FiRefreshCw className={`text-xs ${isLoading ? 'animate-spin' : ''}`} />
                    {isLoading ? 'Retrying...' : 'Retry'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>


        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => {
              if (step === STEP.UPLOAD || step === STEP.RESULT) {
                handleClose();
              } else {
                setStep(STEP.UPLOAD);
                setPreview(null);
                setFile(null);
                setParsedRows([]);
                setParseStats(null);
              }
            }}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
          >
            {step === STEP.RESULT ? 'Close' : 'Cancel'}
          </button>

          {step === STEP.PREVIEW && (
            <button
              onClick={handleImport}
              disabled={isLoading || preview?.matchedCount === 0}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors flex items-center gap-2"
            >
              {isLoading
                ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <FiUpload className="text-xs" />
                    Update {preview?.matchedCount} Orders
                  </>
                )
              }
            </button>
          )}

          {step === STEP.RESULT && !result?.failedBatches && (
            <button
              onClick={handleClose}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-xl transition-colors flex items-center gap-2"
            >
              <FiCheckCircle className="text-xs" /> Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};



export default ImportReturnCSVModal;