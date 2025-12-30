import { useState, useEffect } from 'react';
import { settingsService } from '../services/settingsService';
import { useAuth } from '../context/AuthContext';

export const usePermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState({ allowSalesEdit: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const settings = await settingsService.getSettings();
        setPermissions(settings.permissions || { allowSalesEdit: false });
      } catch (error) {
        console.error('Failed to fetch permissions:', error);
        // Keep default permissions on error
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  // Helper function: Check if current user can edit/delete
  const canEditDelete = () => {
    // Admins can always edit/delete
    if (user?.role === 'admin') return true;
    
    // Sales users can only if permission is enabled
    return permissions.allowSalesEdit;
  };

  // Helper function: Check if current user is admin
  const isAdmin = () => {
    return user?.role === 'admin';
  };

  return {
    permissions,
    loading,
    canEditDelete,
    isAdmin,
  };
};
