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

const Wholesale = () => {
  const { isAdmin }                                  = useAuth();
  const { enabledSizes }                             = useEnabledSizes();
  const { colors, getColorsForDesign, getColorCode } = useColorPalette();
  const [autoOpenDrafts, setAutoOpenDrafts] = useState(false);

  // ── useWholesaleData handles ALL order fetching, filtering & pagination ──
  const {
    orders, products, allBuyers, syncStatuses, loading,
    pagination, page, goToPage,
    search, handleSearchChange,
    paymentFilter, handleFilterChange,
    sortBy, setSortBy, sortOrder, setSortOrder,
    refetch, refetchBuyers,
  } = useWholesaleData();

  // ── useDraftManager handles draft persistence ──
  const {
    savedDrafts, currentDraftId,
    saveDraft, deleteDraft, deleteCurrentDraft, clearAllDrafts,
  } = useDraftManager();

  // ── Backend stats (separate endpoint, not from hook) ──────────
  const [orderStats, setOrderStats] = useState({
    totalOrders: 0, totalRevenue: 0, totalCollected: 0,
    totalDue: 0, pendingCount: 0, partialCount: 0, paidCount: 0,
  });

  const fetchOrderStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const base  = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
      const res   = await fetch(`${base}/api/wholesale/orders/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.totalOrders !== undefined || data.success) setOrderStats(data);
      }
    } catch (e) { console.error('fetchOrderStats failed', e); }
  };

  // ✅ ONLY fetchOrderStats here — useWholesaleData fetches orders/products/buyers automatically
  useEffect(() => {
    fetchOrderStats();
  }, []);

  // ── Modal visibility ──────────────────────────────────────────
  const [showForm,     setShowForm]     = useState(false);
  const [showDetail,   setShowDetail]   = useState(false);
  const [showPayment,  setShowPayment]  = useState(false);
  const [showDrafts,   setShowDrafts]   = useState(false);
  const [showBuyerList,setShowBuyerList]= useState(false);
  const [showUseLock,  setShowUseLock]  = useState(false);
  const [showBorrow,   setShowBorrow]   = useState(false);

  const [editingOrder,     setEditingOrder]     = useState(null);
  const [viewingOrder,     setViewingOrder]     = useState(null);
  const [paymentOrder,     setPaymentOrder]     = useState(null);
  const [useLockData,      setUseLockData]      = useState(null);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [borrowData,       setBorrowData]       = useState(null);

  // ── Handlers ─────────────────────────────────────────────────
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

  const handleWhatsApp = async (order) => {
    if (!order.buyerContact) { toast.error('No contact number'); return; }
    try { await sendChallanViaWhatsApp(order); }
    catch { toast.error('Failed to open WhatsApp'); }
  };

  const handleResendSync = useCallback(async (orderId) => {
    try {
      const res  = await fetch(`/api/supplier-sync/resend/${orderId}`, {
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

  const handleUseLockNeeded  = (data, payload) => { setUseLockData(data);  setPendingOrderData(payload); setShowUseLock(true); };
  const handleBorrowNeeded   = (data, payload) => { setBorrowData(data);   setPendingOrderData(payload); setShowBorrow(true); };

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

  // ── Render ────────────────────────────────────────────────────
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
        sortBy={sortBy}     setSortBy={setSortBy}
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
            onWhatsApp={handleWhatsApp}
            onDelete={handleDeleteOrder}
            onResendSync={handleResendSync}
          />
        )}
      />

      <ScrollToTop />

      {/* ── Modals ── */}
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
        onClose={() => { setShowForm(false); setEditingOrder(null); setAutoOpenDrafts(false);}}
        clearAllDrafts={clearAllDrafts}
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
          handleEditOrder(o);   // opens OrderFormModal with this order
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
          setDraftToLoad(draft);
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
    </div>
  );
};

export default Wholesale;
