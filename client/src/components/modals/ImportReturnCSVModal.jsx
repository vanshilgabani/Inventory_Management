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

const ImportReturnCSVModal = ({ isOpen, onClose, onSuccess, preloadedFile }) => {
  const [step, setStep] = useState(STEP.UPLOAD);
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [parseStats, setParseStats] = useState(null);
  const fileInputRef = useRef(null);



  const reset = () => {
    setStep(STEP.UPLOAD);
    setFile(null);
    setIsLoading(false);
    setPreview(null);
    setResult(null);
    setParsedRows([]);
    setParseStats(null);
  };



  useEffect(() => {
    if (isOpen && preloadedFile) {
      handleFile(preloadedFile);
    }
  }, [isOpen, preloadedFile]);



  const handleClose = () => { reset(); onClose(); };



  const handleFile = async (f) => {
    setFile(f);
    setIsLoading(true);
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        if (!rows.length) {
          toast.error('CSV file is empty.');
          setIsLoading(false);
          return;
        }

        // ── Header validation ──────────────────────────────────────────────
        const headers = Object.keys(rows[0]).map(h => h.trim().toLowerCase());
        const returnSignature = ['return id', 'return reason', 'return sub-reason', 'return status', 'return type'];
        const matchCount = returnSignature.filter(col => headers.includes(col)).length;
        if (matchCount < 2) {
          toast.error('Not a Flipkart Return CSV. Please upload the correct file.', { duration: 4000 });
          setFile(null);
          setIsLoading(false);
          return;
        }

        // ✅ STEP 1: Client-side filtering — skip rows with no Order Item ID
        const validRows = rows.filter(row => {
          const id = (
            row['Order Item ID'] ||
            row['Order Item Id'] ||
            row['ORDER ITEM ID']
          )?.trim();
          return !!id;
        });

        // ✅ STEP 2: Deduplication — keep only the last row per Order Item ID
        //   Strip Excel apostrophe before keying so 'OD123 and OD123 don't create duplicates
        const deduped = new Map();
        validRows.forEach(row => {
          const id = (
            row['Order Item ID'] ||
            row['Order Item Id'] ||
            row['ORDER ITEM ID']
          )?.trim().replace(/^'/, '');
          if (id) deduped.set(id, row);
        });

        // ✅ STEP 3: Slim payload — use EXACT key names the backend reads
        //
        //   Backend reads via row['Order Item ID']     ← capital ID, not Id
        //   Backend reads via row['Order ID']          ← capital ID
        //   Backend reads via row['Return ID']         ← capital ID
        //   Backend reads via row['Tracking ID']       ← NOT 'Return Tracking Id'
        //   Backend reads via row['Return Sub-reason'] ← lowercase 'r' in reason
        //   Backend reads via row['Comments']          ← NOT 'Customer Comments'
        //   Backend reads via row['Return Requested Date']
        //   Backend reads via row['Completed Date']
        const slimRows = Array.from(deduped.values()).map(row => ({
          'Order Item ID': (
            row['Order Item ID'] ||
            row['Order Item Id'] ||
            row['ORDER ITEM ID']
          )?.trim().replace(/^'/, '') || '',

          'Order ID': (
            row['Order ID'] ||
            row['Order Id']
          )?.trim() || '',

          'Return ID': (
            row['Return ID'] ||
            row['Return Id']
          )?.trim() || '',

          // Backend key is 'Tracking ID' — this is the return shipment AWB
          'Tracking ID': (
            row['Tracking ID'] ||
            row['Return Tracking Id'] ||
            row['Return AWB']
          )?.trim() || '',

          'Return Status': row['Return Status']?.trim() || '',

          'Return Reason': row['Return Reason']?.trim() || '',

          // Backend key is 'Return Sub-reason' — lowercase 'r'
          'Return Sub-reason': (
            row['Return Sub-reason'] ||
            row['Return Sub-Reason']
          )?.trim() || '',

          // Backend key is 'Comments' — not 'Customer Comments'
          'Comments': (
            row['Comments'] ||
            row['Customer Comments']
          )?.trim() || '',

          'Return Type': row['Return Type']?.trim() || '',

          'Return Requested Date': row['Return Requested Date']?.trim() || '',

          'Completed Date': row['Completed Date']?.trim() || '',
        }));

        const stats = {
          total:      rows.length,
          invalid:    rows.length - validRows.length,
          duplicates: validRows.length - slimRows.length,
          toProcess:  slimRows.length,
        };

        console.log(
          `📦 Return CSV: ${rows.length} total → ${validRows.length} valid → ${slimRows.length} unique`
        );
        setParseStats(stats);

        try {
          setParsedRows(slimRows);

          // Build preview entirely from CSV data
          const clientPreview = {
            matchedCount:  slimRows.length,    // "orders to attempt"
            skippedCount:  stats.invalid,
            matched: slimRows.slice(0, 8).map(row => ({
              orderItemId:         row['Order Item ID'],
              orderId:             row['Order ID'],
              returnType:          row['Return Type'],
              returnReason:        row['Return Reason'],
              returnSubReason:     row['Return Sub-reason'],
              returnStatus:        row['Return Status'],
              isRTO:               row['Return Type'] === 'courier_return',
              newReturnTrackingId: row['Tracking ID'] || null,
              comments:            row['Comments'],
            })),
            unmatched: [], // unknown until server processes — shown in result
          };

          setPreview(clientPreview);
          setStep(STEP.PREVIEW);
        } catch (err) {
          toast.error('Failed to build preview.');
        } finally {
          setIsLoading(false);
        }
      },
      error: () => {
        toast.error('Failed to read CSV file.');
        setIsLoading(false);
      }
    });
  };

  // ✅ Parallel batch import — all batches fire simultaneously via Promise.allSettled
  const handleImport = async () => {
    setIsLoading(true);
    try {
      const chunks = [];
      for (let i = 0; i < parsedRows.length; i += BATCH_SIZE) {
        chunks.push(parsedRows.slice(i, i + BATCH_SIZE));
      }

      console.log(
        `🚀 Importing ${parsedRows.length} rows in ${chunks.length} parallel batch(es) of ${BATCH_SIZE}`
      );

      const batchResults = await Promise.allSettled(
        chunks.map((chunk, i) =>
          salesService.importReturnCSV(chunk).catch(err => {
            console.error(`❌ Batch ${i + 1}/${chunks.length} failed:`, err.message);
            throw err;
          })
        )
      );

      // ✅ All 6 fields initialized
      const aggregated = {
        updated:         0,
        unmatched:       0,
        skipped:         0,
        rtoCount:        0,   // ✅ ADD
        trackingStored:  0,   // ✅ ADD
        errors:          [],
        unmatchedOrders: [],  // ✅ ADD
        failedBatches:   0,
      };

      batchResults.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value?.success) {
          const d = result.value.data;
          aggregated.updated         += d.updated         || 0;
          aggregated.unmatched       += d.unmatched       || 0;
          aggregated.skipped         += d.skipped         || 0;
          aggregated.rtoCount        += d.rtoCount        || 0;  // ✅ collect
          aggregated.trackingStored  += d.trackingStored  || 0;  // ✅ collect
          aggregated.errors           = [...aggregated.errors,         ...(d.errors          || [])];
          aggregated.unmatchedOrders  = [...aggregated.unmatchedOrders, ...(d.unmatchedOrders || [])]; // ✅ collect
        } else {
          aggregated.failedBatches++;
          console.error(
            `❌ Batch ${i + 1}/${chunks.length} rejected:`,
            result.reason?.message
          );
        }
      });

      setResult(aggregated);
      setStep(STEP.RESULT);
      if (onSuccess) onSuccess();

      if (aggregated.failedBatches > 0) {
        toast.error(
          `⚠️ ${aggregated.failedBatches} batch(es) failed — ${aggregated.updated} updated, some may need re-import`,
          { duration: 6000 }
        );
      } else {
        toast.success(`${aggregated.updated} orders updated!`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed. Please try again.');
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