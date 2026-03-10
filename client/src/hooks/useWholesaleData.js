import { useState, useEffect, useCallback, useRef } from 'react';
import { wholesaleService } from '../services/wholesaleService';

const LIMIT = 15;

export const useWholesaleData = () => {
  const [orders, setOrders]               = useState([]);
  const [products, setProducts]           = useState([]);
  const [allBuyers, setAllBuyers]         = useState([]);
  const [syncStatuses, setSyncStatuses]   = useState({});
  const [loading, setLoading]             = useState(true);
  const [buyersLoading, setBuyersLoading] = useState(false);

  // Pagination + filter state
  const [page, setPage]                   = useState(1);
  const [pagination, setPagination]       = useState({
    total: 0, page: 1, totalPages: 1,
    hasNext: false, hasPrev: false, limit: LIMIT
  });
  const [search, setSearch]               = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [sortBy, setSortBy]               = useState('createdAt');
  const [sortOrder, setSortOrder]         = useState('desc');

  const searchTimer = useRef(null);

  // ── Core fetch ──────────────────────────────────────────────
  const fetchOrders = useCallback(async (overrides = {}) => {
    setLoading(true);
    try {
      const params = {
        page:          overrides.page          ?? page,
        limit:         LIMIT,
        search:        overrides.search        ?? search,
        paymentStatus: overrides.paymentFilter ?? paymentFilter,
        sortBy:        overrides.sortBy        ?? sortBy,
        sortOrder:     overrides.sortOrder     ?? sortOrder,
      };
      const qs = new URLSearchParams(params).toString();
      const res = await wholesaleService.getAllOrders(qs);
      setOrders(res.orders || []);
      setPagination(res.pagination || {
        total: 0, page: 1, totalPages: 1,
        hasNext: false, hasPrev: false, limit: LIMIT
      });
    } catch (err) {
      console.error('fetchOrders failed', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, paymentFilter, sortBy, sortOrder]);

  // Fetch buyers + products (once on mount)
  const fetchBuyers = useCallback(async () => {
    setBuyersLoading(true);
    try {
      const buyers = await wholesaleService.getAllBuyers();
      setAllBuyers(buyers || []);
    } catch (err) {
      console.error('fetchBuyers failed', err);
    } finally {
      setBuyersLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
        const { inventoryService } = await import('../services/inventoryService');
        const data = await inventoryService.getAllProducts();
        // ✅ handle both response shapes
        setProducts(Array.isArray(data) ? data : (data?.products || []));
    } catch (err) {
        console.error('fetchProducts failed', err);
    }
  }, []);

  // Re-fetch when page / filter / sort changes (not search — handled by debounce)
  useEffect(() => {
    fetchOrders();
  }, [page, paymentFilter, sortBy, sortOrder]); // eslint-disable-line

  // Fetch buyers + products once on mount
  useEffect(() => {
    fetchBuyers();
    fetchProducts();
  }, []); // eslint-disable-line

  // Sync status fetcher
  const fetchOrderSyncStatus = useCallback(async (orderId) => {
    try {
      const res = await wholesaleService.getOrderSyncStatus(orderId);
      if (res.success) {
        setSyncStatuses(prev => ({ ...prev, [orderId]: res.data || {} }));
      }
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    orders.forEach(o => { if (o._id) fetchOrderSyncStatus(o._id); });
  }, [orders]); // eslint-disable-line

  // Real-time sync events
  useEffect(() => {
    const refresh = (e) => { if (e.detail?.orderId) fetchOrderSyncStatus(e.detail.orderId); };
    window.addEventListener('syncAccepted', refresh);
    window.addEventListener('syncRejected', refresh);
    return () => {
      window.removeEventListener('syncAccepted', refresh);
      window.removeEventListener('syncRejected', refresh);
    };
  }, [fetchOrderSyncStatus]);

  // ── Search (debounced 500ms) ─────────────────────────────────
  const handleSearchChange = (value) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchOrders({ search: value, page: 1 });
    }, 500);
  };

  // ── Filter / pagination handlers ────────────────────────────
  const handleFilterChange = (filter) => {
    setPaymentFilter(filter);
    setPage(1);
  };

  const goToPage    = (p) => setPage(p);
  const nextPage    = () => pagination.hasNext && setPage(p => p + 1);
  const prevPage    = () => pagination.hasPrev && setPage(p => p - 1);

  return {
    // data
    orders, products, allBuyers, syncStatuses,
    loading, buyersLoading,
    // pagination
    pagination, page, goToPage, nextPage, prevPage,
    // search + filter
    search, handleSearchChange,
    paymentFilter, handleFilterChange,
    sortBy, setSortBy, sortOrder, setSortOrder,
    // actions
    refetch: fetchOrders,
    refetchBuyers: fetchBuyers,
  };
};
