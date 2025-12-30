import api from './api';

export const challanSettingsService = {
  async getSettings() {
    const response = await api.get('/challan-settings');
    return response.data;
  },

  async updateSettings(settingsData) {
    const response = await api.put('/challan-settings', settingsData);
    return response.data;
  }
};
