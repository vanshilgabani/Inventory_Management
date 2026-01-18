import { useState, useEffect } from 'react';
import { settingsService } from '../services/settingsService';

// Size sorting function
const sortSizesByOrder = (sizes) => {
  const order = { 'S': 1, 'M': 2, 'L': 3, 'XL': 4, 'XXL': 5, '2XL': 5, '3XL': 6 };
  return [...sizes].sort((a, b) => (order[a] || 999) - (order[b] || 999));
};

export const useEnabledSizes = () => {
  const [enabledSizes, setEnabledSizes] = useState(['S', 'M', 'L', 'XL', 'XXL']); // Default
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEnabledSizes = async () => {
      try {
        const sizes = await settingsService.getEnabledSizes();
        setEnabledSizes(sortSizesByOrder(sizes));
      } catch (error) {
        console.error('Failed to fetch enabled sizes:', error);
        // Keep default sizes on error
      } finally {
        setLoading(false);
      }
    };

    fetchEnabledSizes();
  }, []);

  return { enabledSizes, loading };
};
