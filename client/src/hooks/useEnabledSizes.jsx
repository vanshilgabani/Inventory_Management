import { useState, useEffect } from 'react';
import { settingsService } from '../services/settingsService';

export const useEnabledSizes = () => {
  const [enabledSizes, setEnabledSizes] = useState(['S', 'M', 'L', 'XL', 'XXL']); // Default
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEnabledSizes = async () => {
      try {
        // ✅ NEW: Fetch from new API endpoint
        const sizes = await settingsService.getEnabledSizes();
        setEnabledSizes(sizes); // Already sorted by displayOrder from backend
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
