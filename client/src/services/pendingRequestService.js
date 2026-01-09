import api from './api';

const pendingRequestService = {
  // Sales User: Create new request
  createRequest: async (requestData) => {
    const response = await api.post('/pending-requests', requestData);
    return response.data;
  },

  // Sales User: Get my requests
  getMyRequests: async (status = 'all') => {
    const response = await api.get('/pending-requests/my-requests', {
      params: { status },
    });
    return response.data;
  },

  // Sales User: Cancel my request
  cancelRequest: async (requestId) => {
    const response = await api.delete(`/pending-requests/${requestId}/cancel`);
    return response.data;
  },

  // Admin: Get all pending requests
  getAllPendingRequests: async (status = 'pending', module = null) => {
    const response = await api.get('/pending-requests', {
      params: { status, module },
    });
    return response.data;
  },

  // Admin: Get single request
  getRequestById: async (requestId) => {
    const response = await api.get(`/pending-requests/${requestId}`);
    return response.data;
  },

  // Admin: Check for conflicts
  checkConflict: async (requestId) => {
    const response = await api.get(`/pending-requests/${requestId}/check-conflict`);
    return response.data;
  },

  // Admin: Approve request
  approveRequest: async (requestId) => {
    const response = await api.post(`/pending-requests/${requestId}/approve`);
    return response.data;
  },

  // Admin: Reject request
  rejectRequest: async (requestId, reason, note) => {
    const response = await api.post(`/pending-requests/${requestId}/reject`, {
      reason,
      note,
    });
    return response.data;
  },

  // Admin: Get pending count (for badge)
  getPendingCount: async () => {
    const response = await api.get('/pending-requests/count/pending');
    return response.data;
  },
};

export default pendingRequestService;
