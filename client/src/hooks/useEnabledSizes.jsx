import { useState, useEffect } from 'react';
import { settingsService } from '../services/settingsService';

export const useEnabledSizes = () => {
  const [enabledSizes, setEnabledSizes] = useState(['S', 'M', 'L', 'XL', 'XXL']);
  const [allSizes, setAllSizes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEnabledSizes = async () => {
      try {
        const [enabled, all] = await Promise.all([
          settingsService.getEnabledSizes(),
          settingsService.getAllSizes()
        ]);
        setEnabledSizes(enabled);
        setAllSizes(all.filter(s => s.isEnabled));
      } catch (error) {
        console.error('Failed to fetch enabled sizes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEnabledSizes();
  }, []);

  // Use this inside product/design loops
  const getSizesForDesign = (design) => {
    if (!design || allSizes.length === 0) return enabledSizes;
    return allSizes
      .filter(s => !s.disabledForDesigns?.includes(design))
      .map(s => s.name);
  };

  return { enabledSizes, getSizesForDesign, loading };
};
