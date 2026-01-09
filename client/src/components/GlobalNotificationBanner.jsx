import { useState, useEffect } from 'react';
import { FiBell, FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {settingsService} from '../services/settingsService';

const GlobalNotificationBanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());

  useEffect(() => {
    if (user?.role !== 'admin') return;

    const fetchNotifications = async () => {
      try {
        const settings = await settingsService.getSettings();
        
        const pendingRequests = settings.editPermissions?.permissionRequests?.filter(
          req => req.status === 'pending'
        ) || [];

        const pendingExtensions = settings.editPermissions?.extensionRequests?.filter(
          req => req.status === 'pending'
        ) || [];

        setNotifications([
          ...pendingRequests.map(req => ({
            id: `perm-${req._id}`,
            type: 'permission',
            message: `${req.userName} requested edit access`,
            data: req
          })),
          ...pendingExtensions.map(req => ({
            id: `ext-${req._id}`,
            type: 'extension',
            message: `${req.userName} requested ${req.additionalMinutes}min extension`,
            data: req
          }))
        ]);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, [user]);

  const visibleNotifications = notifications.filter(n => !dismissed.has(n.id));

  if (visibleNotifications.length === 0) return null;

  const handleDismiss = (id) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  const handleView = () => {
    navigate('/settings?tab=permissions');
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-yellow-400 to-orange-500 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-full p-2 animate-pulse">
              <FiBell className="text-orange-600 w-5 h-5" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">
                {visibleNotifications.length} Pending Request{visibleNotifications.length > 1 ? 's' : ''}
              </p>
              <p className="text-white/90 text-xs">
                {visibleNotifications[0].message}
                {visibleNotifications.length > 1 && ` and ${visibleNotifications.length - 1} more`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleView}
              className="px-4 py-2 bg-white text-orange-600 rounded-lg hover:bg-orange-50 transition-colors font-medium text-sm"
            >
              View All
            </button>
            <button
              onClick={() => handleDismiss(visibleNotifications[0].id)}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalNotificationBanner;
