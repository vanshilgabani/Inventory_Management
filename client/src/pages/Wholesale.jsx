import { useState, useEffect, useCallback } from 'react';
import { useEnabledSizes } from '../hooks/useEnabledSizes';
import { useColorPalette } from '../hooks/useColorPalette';
import { useWholesaleData } from '../hooks/useWholesaleData';
import { useDraftManager } from '../hooks/useDraftManager';
import { useAuth } from '../context/AuthContext';
import { wholesaleService } from '../services/wholesaleService';
import { generateInvoice, sendChallanViaWhatsApp } from '../components/InvoiceGenerator';
import toast from 'react-hot-toast';
import ScrollToTop from '../components/common/ScrollToTop';
import BorrowFromReservedModal from '../components/BorrowFromReservedModal';
import { connectQZ, getAvailablePrinters, getSavedPrinter, savePrinter, printBase64PDF, printViaIframe } from '../utils/qzPrinter';
import { FiPrinter } from 'react-icons/fi';

import WholesaleHeader  from '../components/WholesaleOrder/WholesaleHeader';
import WholesaleStats   from '../components/WholesaleOrder/WholesaleStats';
import OrderFilters     from '../components/WholesaleOrder/OrderFilters';
import OrderList        from '../components/WholesaleOrder/OrderList';
import OrderCard        from '../components/WholesaleOrder/OrderCard';
import OrderFormModal   from '../components/WholesaleOrder/modals/OrderFormModal';
import OrderDetailModal from '../components/WholesaleOrder/modals/OrderDetailModal';
import PaymentModal     from '../components/WholesaleOrder/modals/PaymentModal';
import DraftsListModal  from '../components/WholesaleOrder/modals/DraftsListModal';
import UseLockModal     from '../components/WholesaleOrder/modals/UseLockModal';
import BuyerListModal   from '../components/WholesaleOrder/modals/BuyerListModal';

// ✅ Single API base — used for all fetch/axios calls in this file
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const Wholesale = () => {
  const { isAdmin } = useAuth();
  const { enabledSizes, getSizesForDesign } = useEnabledSizes();
  const { colors, getColorsForDesign, getColorCode } = useColorPalette();
  const [autoOpenDrafts, setAutoOpenDrafts] = useState(false);

  const {
    orders, products, allBuyers, syncStatuses, loading,
    pagination, page, goToPage,
    search, handleSearchChange,
    paymentFilter, handleFilterChange,
    sortBy, setSortBy, sortOrder, setSortOrder,
    refetch, refetchBuyers,
  } = useWholesaleData();

  const {
    savedDrafts, currentDraftId,
    saveDraft, deleteDraft, deleteCurrentDraft, clearAllDrafts,
  } = useDraftManager();

  const [orderStats, setOrderStats] = useState({
    totalOrders: 0, totalRevenue: 0, totalCollected: 0,
    totalDue: 0, pendingCount: 0, partialCount: 0, paidCount: 0,
  });

  const [qzStatus, setQzStatus]                 = useState('checking');
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter]     = useState('');
  const [pendingPrintOrder, setPendingPrintOrder] = useState(null);
  const [isPrinting, setIsPrinting]               = useState(false);

  // ✅ FIX 1: fetchOrderStats — was using convoluted .replace() trick; now clean
  const fetchOrderStats = async () => {
    try {
      const res = await fetch(`${API}/wholesale/orders/stats`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.totalOrders !== undefined || data.success) setOrderStats(data);
      }
    } catch (e) { console.error('fetchOrderStats failed', e); }
  };

  useEffect(() => {
    fetchOrderStats();
    connectQZ().then(available => {
      setQzStatus(available ? 'available' : 'unavailable');
    });
  }, []);

  const [showForm,      setShowForm]      = useState(false);
  const [showDetail,    setShowDetail]    = useState(false);
  const [showPayment,   setShowPayment]   = useState(false);
  const [showDrafts,    setShowDrafts]    = useState(false);
  const [showBuyerList, setShowBuyerList] = useState(false);
  const [showUseLock,   setShowUseLock]   = useState(false);
  const [showBorrow,    setShowBorrow]    = useState(false);

  const [editingOrder,     setEditingOrder]     = useState(null);
  const [viewingOrder,     setViewingOrder]     = useState(null);
  const [paymentOrder,     setPaymentOrder]     = useState(null);
  const [useLockData,      setUseLockData]      = useState(null);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [borrowData,       setBorrowData]       = useState(null);

  const handleNewOrder  = () => { setEditingOrder(null); setShowForm(true); };
  const handleEditOrder = (o) => { setEditingOrder(o);   setShowForm(true); };
  const handleViewOrder = (o) => { setViewingOrder(o);   setShowDetail(true); };

  const handleDeleteOrder = async (id) => {
    if (!window.confirm('Delete this order?')) return;
    try {
      await wholesaleService.deleteOrder(id);
      toast.success('Order deleted');
      refetch(); refetchBuyers(); fetchOrderStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete order');
    }
  };

  const handleDownloadChallan = async (order) => {
    try {
      const buyer = await wholesaleService.getBuyerByMobile(order.buyerContact).catch(() => null);
      await generateInvoice(buyer ? { ...order, ...buyer } : order);
      toast.success('Challan downloaded!');
    } catch { toast.error('Failed to generate challan'); }
  };

  const handlePrintChallan = async (order) => {
    if (isPrinting) return;
    setIsPrinting(true);

    try {
      const buyer = await wholesaleService.getBuyerByMobile(order.buyerContact).catch(() => null);
      const mergedOrder = buyer ? { ...order, ...buyer } : order;

      if (qzStatus === 'available') {
        const savedPrinter = getSavedPrinter();

        if (!savedPrinter) {
          const printers = await getAvailablePrinters();
          setAvailablePrinters(printers);
          setSelectedPrinter(printers[0] || '');
          setPendingPrintOrder(mergedOrder);
          setShowPrinterModal(true);
          setIsPrinting(false);
          return;
        }

        const { base64 } = await generateInvoice(mergedOrder, {});
        const result = await printBase64PDF(base64, savedPrinter);

        if (result.success) {
          toast.success(`Printed to ${savedPrinter}`);
        } else {
          toast.error(`Print failed: ${result.error}`);
        }

      } else {
        const { base64 } = await generateInvoice(mergedOrder, {});
        printViaIframe(base64);

        toast(
          (t) => (
            <div className="flex items-start gap-3">
              <span className="text-2xl">🖨️</span>
              <div>
                <p className="font-semibold text-gray-800">QZ Tray not installed</p>
                <p className="text-xs text-gray-500 mt-0.5">PDF downloaded. Print dialog opening...</p>
                <a
                  href="https://qz.io/download/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-600 underline mt-1 inline-block"
                  onClick={() => toast.dismiss(t.id)}
                >
                  Install QZ Tray for direct printing →
                </a>
              </div>
            </div>
          ),
          { duration: 6000 }
        );
      }
    } catch {
      toast.error('Failed to print challan');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleConfirmPrinter = async () => {
    if (!selectedPrinter || !pendingPrintOrder) return;
    savePrinter(selectedPrinter);
    setShowPrinterModal(false);

    setIsPrinting(true);
    try {
      const { base64 } = await generateInvoice(pendingPrintOrder, {});
      const result = await printBase64PDF(base64, selectedPrinter);
      if (result.success) {
        toast.success(`Printed to ${selectedPrinter}`);
      } else {
        toast.error(`Print failed: ${result.error}`);
      }
    } catch {
      toast.error('Print failed');
    } finally {
      setIsPrinting(false);
      setPendingPrintOrder(null);
    }
  };

  const handleWhatsApp = async (order) => {
    if (!order.buyerContact) { toast.error('No contact number'); return; }
    try { await sendChallanViaWhatsApp(order); }
    catch { toast.error('Failed to open WhatsApp'); }
  };

  // ✅ FIX 2: handleResendSync — was `/api/supplier-sync/...` (relative, hit Vercel)
  const handleResendSync = useCallback(async (orderId) => {
    try {
      const res = await fetch(`${API}/supplier-sync/resend/${orderId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (res.ok && data.success) { toast.success('Sync request sent!'); refetch(); }
      else toast.error(data.message || 'Sync failed');
    } catch { toast.error('Sync request failed'); }
  }, [refetch]);

  const handleFormSuccess = () => {
    deleteCurrentDraft();
    setShowForm(false);
    setEditingOrder(null);
    refetch(); refetchBuyers(); fetchOrderStats();
  };

  const handleUseLockNeeded = (data, payload) => { setUseLockData(data);  setPendingOrderData(payload); setShowUseLock(true); };
  const handleBorrowNeeded  = (data, payload) => { setBorrowData(data);   setPendingOrderData(payload); setShowBorrow(true); };

  const handleConfirmUseLock = async () => {
    if (!pendingOrderData) return;
    try {
      await wholesaleService.createOrder({ ...pendingOrderData, useLockStock: true });
      toast.success('Order created using locked stock!');
      setShowUseLock(false); setUseLockData(null); setPendingOrderData(null);
      handleFormSuccess();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
  };

  const handleBorrowConfirm = async () => {
    try {
      await wholesaleService.createOrderWithReservedBorrow(pendingOrderData, borrowData.insufficientItems);
      toast.success('Order created! Stock borrowed from Reserved.', { duration: 5000 });
      setShowBorrow(false); setBorrowData(null); setPendingOrderData(null);
      handleFormSuccess();
    } catch (err) { toast.error(err?.response?.data?.message || 'Borrow failed'); }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">

      <WholesaleHeader
        draftsCount={savedDrafts.length}
        onNewOrder={handleNewOrder}
        onShowDrafts={() => {
          setEditingOrder(null);
          setAutoOpenDrafts(true);
          setShowForm(true);
        }}
      />

      <WholesaleStats orderStats={orderStats} />

      <OrderFilters
        search={search}
        onSearchChange={handleSearchChange}
        paymentFilter={paymentFilter}
        onFilterChange={handleFilterChange}
        sortBy={sortBy}       setSortBy={setSortBy}
        sortOrder={sortOrder} setSortOrder={setSortOrder}
        totalCount={orders.length}
      />

      <OrderList
        orders={orders}
        loading={loading}
        pagination={pagination}
        onPageChange={goToPage}
        renderCard={(order) => (
          <OrderCard
            key={order._id}
            order={order}
            syncStatus={syncStatuses?.[order._id]}
            isAdmin={isAdmin}
            onView={handleViewOrder}
            onEdit={handleEditOrder}
            onPayment={(o) => { setPaymentOrder(o); setShowPayment(true); }}
            onDownload={handleDownloadChallan}
            onPrint={handlePrintChallan}
            onWhatsApp={handleWhatsApp}
            onDelete={handleDeleteOrder}
            onResendSync={handleResendSync}
          />
        )}
      />

      <ScrollToTop />

      <OrderFormModal
        show={showForm}
        editingOrder={editingOrder}
        autoOpenDrafts={autoOpenDrafts}
        products={products}
        allBuyers={allBuyers}
        enabledSizes={enabledSizes}
        colors={colors}
        getColorsForDesign={getColorsForDesign}
        getColorCode={getColorCode}
        savedDrafts={savedDrafts}
        currentDraftId={currentDraftId}
        saveDraft={saveDraft}
        deleteDraft={deleteDraft}
        onShowDrafts={() => setShowDrafts(true)}
        onShowBuyerList={() => setShowBuyerList(true)}
        onSuccess={handleFormSuccess}
        onBorrowNeeded={handleBorrowNeeded}
        onUseLockNeeded={handleUseLockNeeded}
        onClose={() => { setShowForm(false); setEditingOrder(null); setAutoOpenDrafts(false); }}
        clearAllDrafts={clearAllDrafts}
        getSizesForDesign={getSizesForDesign}
      />

      <OrderDetailModal
        order={showDetail ? viewingOrder : null}
        onClose={() => { setShowDetail(false); setViewingOrder(null); }}
        onDownload={handleDownloadChallan}
        onWhatsApp={handleWhatsApp}
        onRecordPayment={(o) => {
          setPaymentOrder(o);
          setShowDetail(false);
          setShowPayment(true);
        }}
        onEdit={(o) => {
          setShowDetail(false);
          setViewingOrder(null);
          handleEditOrder(o);
        }}
      />

      <PaymentModal
        show={showPayment}
        order={paymentOrder}
        onSuccess={() => { refetch(); refetchBuyers(); fetchOrderStats(); }}
        onClose={() => { setShowPayment(false); setPaymentOrder(null); }}
      />

      <DraftsListModal
        show={showDrafts}
        drafts={savedDrafts}
        onLoad={(draft) => {
          setEditingOrder(null);
          setShowDrafts(false);
          setShowForm(true);
        }}
        onDelete={deleteDraft}
        onClearAll={clearAllDrafts}
        onClose={() => setShowDrafts(false)}
      />

      <BuyerListModal
        show={showBuyerList}
        buyers={allBuyers}
        onSelect={(buyer) => {
          window.dispatchEvent(new CustomEvent('buyerSelected', { detail: buyer }));
          setShowBuyerList(false);
        }}
        onClose={() => setShowBuyerList(false)}
      />

      <UseLockModal
        show={showUseLock}
        data={useLockData}
        onConfirm={handleConfirmUseLock}
        onCancel={() => { setShowUseLock(false); setUseLockData(null); setPendingOrderData(null); }}
      />

      {showBorrow && borrowData && (
        <BorrowFromReservedModal
          isOpen={showBorrow}
          onClose={() => { setShowBorrow(false); setBorrowData(null); setPendingOrderData(null); }}
          onConfirm={handleBorrowConfirm}
          insufficientItems={borrowData.insufficientItems}
          orderType="order"
        />
      )}

      {showPrinterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-80 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-indigo-100 p-2 rounded-xl">
                <FiPrinter className="text-indigo-600 text-xl" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Select Challan Printer</h3>
                <p className="text-xs text-gray-500">Saved once, used always</p>
              </div>
            </div>

            <select
              value={selectedPrinter}
              onChange={e => setSelectedPrinter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-indigo-500"
            >
              {availablePrinters.length === 0
                ? <option>No printers found</option>
                : availablePrinters.map(p => <option key={p} value={p}>{p}</option>)
              }
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowPrinterModal(false); setPendingPrintOrder(null); }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPrinter}
                disabled={!selectedPrinter || availablePrinters.length === 0}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Set & Print
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-3 text-center">
              To change printer later, clear <code className="bg-gray-100 px-1 rounded">qz_challan_printer</code> from localStorage
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wholesale;
