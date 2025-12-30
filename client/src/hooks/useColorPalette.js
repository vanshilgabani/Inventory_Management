import { useState, useEffect } from 'react';
import { settingsService } from '../services/settingsService';

export const useColorPalette = () => {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchColors();
  }, []);

  const fetchColors = async () => {
    setLoading(true);
    try {
      const data = await settingsService.getColorPalette();
      
      // Only return active colors
      const activeColors = data.filter(c => c.isActive);
      setColors(activeColors);
      setError(null);
      
      console.log('✅ Loaded color palette:', activeColors); // Debug log
      
    } catch (err) {
      console.error('❌ Failed to fetch color palette:', err);
      setError(err);
      
      // ✅ FIXED: Empty fallback - NO hardcoded colors!
      setColors([]);
    } finally {
      setLoading(false);
    }
  };

  // Get colors available for a specific design
  const getColorsForDesign = (design) => {
    return colors.filter(color => {
      // If availableForDesigns is empty or undefined, color is available for all
      if (!color.availableForDesigns || color.availableForDesigns.length === 0) {
        return true;
      }
      
      // Otherwise check if design is in the list
      return color.availableForDesigns.includes(design);
    });
  };

  // Get color code by name
  const getColorCode = (colorName) => {
    const color = colors.find(c => c.colorName === colorName);
    return color ? color.colorCode : '#6b7280'; // Default gray
  };

  // Get all color names
  const getColorNames = () => {
    return colors.map(c => c.colorName);
  };

  return {
    colors,
    loading,
    error,
    getColorsForDesign,
    getColorCode,
    getColorNames,
    refresh: fetchColors,
  };
};
