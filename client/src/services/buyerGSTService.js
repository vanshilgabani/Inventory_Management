import api from './api';

const buyerGSTService = {
  /**
   * Verify GST number and return details
   */
  verifyGSTNumber: async (gstNumber) => {
    const response = await api.post('/wholesale/verify-gst', { gstNumber });
    return response.data;
  },

  /**
   * Get all GST profiles for a buyer
   */
  getGSTProfiles: async (buyerId) => {
    const response = await api.get(`/wholesale/buyers/${buyerId}/gst-profiles`);
    return response.data;
  },

  /**
   * Add new GST profile to buyer
   */
  addGSTProfile: async (buyerId, profileData) => {
    const response = await api.post(`/wholesale/buyers/${buyerId}/gst-profiles`, profileData);
    return response.data;
  },

  /**
   * Update GST profile
   */
  updateGSTProfile: async (buyerId, profileId, updates) => {
    const response = await api.put(
      `/wholesale/buyers/${buyerId}/gst-profiles/${profileId}`,
      updates
    );
    return response.data;
  },

  /**
   * Delete GST profile
   */
  deleteGSTProfile: async (buyerId, profileId) => {
    const response = await api.delete(`/wholesale/buyers/${buyerId}/gst-profiles/${profileId}`);
    return response.data;
  },

  /**
   * Refresh GST profile data from API
   */
  refreshGSTProfile: async (buyerId, profileId) => {
    const response = await api.post(
      `/wholesale/buyers/${buyerId}/gst-profiles/${profileId}/refresh`
    );
    return response.data;
  }
};

export default buyerGSTService;
