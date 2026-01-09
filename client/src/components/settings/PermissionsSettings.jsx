import React, { useState, useEffect } from 'react';
import { 
  FiUsers, 
  FiClock, 
  FiEdit, 
  FiTrash2, 
  FiSave,
  FiPlus,
  FiX,
  FiShield,
  FiCheckCircle,
  FiXCircle
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { settingsService } from '../../services/settingsService';
import { authService } from '../../services/authService';
import AdminPermissionRequestModal from '../../components/modals/AdminPermissionRequestModal';

const PermissionsSettings = () => {
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

const fetchData = async () => {
  try {
    const [settingsData, usersData, requestsData] = await Promise.all([
      settingsService.getSettings(),
      authService.getAllUsers(),
      getPendingRequests()
    ]);

    console.log('📊 Settings:', settingsData);
    console.log('👥 Users:', usersData);
    console.log('📋 Pending Requests:', requestsData); // ✅ ADD THIS

    setSettings(settingsData.settings || settingsData);
    setUsers(usersData?.users?.filter(u => u.role === 'sales') || []);
    
    // ✅ ADD SAFETY CHECK
    const requests = requestsData?.requests || requestsData || [];
    setPendingRequests(Array.isArray(requests) ? requests : []);
    
    console.log('✅ Pending requests set:', requests.length);
  } catch (error) {
    console.error('Failed to load data:', error);
    // Show specific error message
    if (error.response?.status === 401) {
      toast.error('Session expired. Please login again.');
    } else if (error.response?.status === 403) {
      toast.error('Access denied. Admin only.');
    } else {
      toast.error(error.response?.data?.message || 'Failed to load data');
    }
  }
};

  const toggleFeature = async (enabled) => {
  setLoading(true);
  try {
    const updated = {
      ...settings,
      editPermissions: {
        ...settings.editPermissions,
        enabled
      }
    };
    await settingsService.updateSettings(updated);
    setSettings(updated);
    toast.success(enabled ? 'Edit permissions enabled' : 'Edit permissions disabled');
    
    // ✅ ADD THIS - Force page reload to refresh hooks
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    toast.error('Failed to update settings');
  } finally {
    setLoading(false);
  }
};

  const addSalesperson = async (userId) => {
    setLoading(true);
    try {
      const user = users.find(u => u._id === userId);
      const newSalesperson = {
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        isActive: true,
        maxChanges: 3,
        isInfinite: false,
        timeWindowMinutes: 5,
        permissionLevel: 'level2',
        stats: {
          totalSessionsGranted: 0,
          totalChangesUsed: 0,
          lastSessionDate: null
        }
      };

      const updatedSalespersons = [
        ...(settings.editPermissions.salespersons || []),
        newSalesperson
      ];

      const updated = {
        ...settings,
        editPermissions: {
          ...settings.editPermissions,
          salespersons: updatedSalespersons
        }
      };

      await settingsService.updateSettings(updated);
      setSettings(updated);
      toast.success('Salesperson added');
    } catch (error) {
      toast.error('Failed to add salesperson');
    } finally {
      setLoading(false);
    }
  };

  const updateSalesperson = async (userId, updates) => {
    setLoading(true);
    try {
      const updatedSalespersons = settings.editPermissions.salespersons.map(sp =>
        sp.userId === userId ? { ...sp, ...updates } : sp
      );

      const updated = {
        ...settings,
        editPermissions: {
          ...settings.editPermissions,
          salespersons: updatedSalespersons
        }
      };

      await settingsService.updateSettings(updated);
      setSettings(updated);
      toast.success('Updated successfully');
    } catch (error) {
      toast.error('Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const removeSalesperson = async (userId) => {
    if (!confirm('Remove this salesperson from edit permissions?')) return;

    setLoading(true);
    try {
      const updatedSalespersons = settings.editPermissions.salespersons.filter(
        sp => sp.userId !== userId
      );

      const updated = {
        ...settings,
        editPermissions: {
          ...settings.editPermissions,
          salespersons: updatedSalespersons
        }
      };

      await settingsService.updateSettings(updated);
      setSettings(updated);
      toast.success('Salesperson removed');
    } catch (error) {
      toast.error('Failed to remove');
    } finally {
      setLoading(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const availableUsers = users.filter(
    u => !settings.editPermissions.salespersons?.some(sp => sp.userId === u._id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <FiShield className="text-2xl text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Edit Permissions</h2>
              <p className="text-sm text-gray-600">
                Control who can edit/delete orders with time-limited sessions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Feature Status:</span>
            <button
              onClick={() => toggleFeature(!settings.editPermissions.enabled)}
              disabled={loading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                settings.editPermissions.enabled
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {settings.editPermissions.enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <FiClock className="text-yellow-600 text-xl" />
            <h3 className="text-lg font-bold text-yellow-900">
              Pending Requests ({pendingRequests.length})
            </h3>
          </div>
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div
                key={request._id}
                className="bg-white rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{request.requesterName}</p>
                  <p className="text-sm text-gray-600 italic">"{request.reason}"</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(request.requestedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRequest(request)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Authorized Salespersons */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-800">Authorized Salespersons</h3>
          {availableUsers.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addSalesperson(e.target.value);
                  e.target.value = '';
                }
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">+ Add Salesperson</option>
              {availableUsers.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          )}
        </div>

        {settings.editPermissions.salespersons?.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FiUsers className="text-6xl mx-auto mb-4 text-gray-300" />
            <p>No salespersons authorized yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {settings.editPermissions.salespersons?.map((sp) => (
              <SalespersonCard
                key={sp.userId}
                salesperson={sp}
                onUpdate={(updates) => updateSalesperson(sp.userId, updates)}
                onRemove={() => removeSalesperson(sp.userId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Request Modal */}
      {selectedRequest && (
        <AdminPermissionRequestModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onApprove={() => {
            fetchData();
            setSelectedRequest(null);
          }}
          onDeny={() => {
            fetchData();
            setSelectedRequest(null);
          }}
        />
      )}
    </div>
  );
};

// Salesperson Card Component
const SalespersonCard = ({ salesperson, onUpdate, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    maxChanges: salesperson.maxChanges || 3,
    isInfinite: salesperson.isInfinite || false,
    timeWindowMinutes: salesperson.timeWindowMinutes || 5,
    permissionLevel: salesperson.permissionLevel || 'level2',
    isActive: salesperson.isActive
  });

  const handleSave = () => {
    onUpdate(formData);
    setIsEditing(false);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-800">{salesperson.userName}</h4>
            {formData.isActive ? (
              <FiCheckCircle className="text-green-600" />
            ) : (
              <FiXCircle className="text-red-600" />
            )}
          </div>
          <p className="text-sm text-gray-600">{salesperson.userEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                <FiSave />
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    maxChanges: salesperson.maxChanges,
                    isInfinite: salesperson.isInfinite,
                    timeWindowMinutes: salesperson.timeWindowMinutes,
                    permissionLevel: salesperson.permissionLevel,
                    isActive: salesperson.isActive
                  });
                }}
                className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <FiX />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
              >
                <FiEdit />
              </button>
              <button
                onClick={onRemove}
                className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <FiTrash2 />
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Changes
            </label>
            <input
              type="number"
              value={formData.maxChanges}
              onChange={(e) => setFormData({ ...formData, maxChanges: parseInt(e.target.value) })}
              disabled={formData.isInfinite}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              min="1"
            />
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input
                type="checkbox"
                checked={formData.isInfinite}
                onChange={(e) => setFormData({ ...formData, isInfinite: e.target.checked })}
                className="rounded"
              />
              Infinite
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Window (min)
            </label>
            <input
              type="number"
              value={formData.timeWindowMinutes}
              onChange={(e) => setFormData({ ...formData, timeWindowMinutes: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              min="1"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Permission Level
            </label>
            <select
              value={formData.permissionLevel}
              onChange={(e) => setFormData({ ...formData, permissionLevel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="level1">Level 1: Edit Only</option>
              <option value="level2">Level 2: Edit + Delete</option>
              <option value="level3">Level 3: Full Access</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Changes</p>
            <p className="font-semibold">{formData.isInfinite ? '∞' : formData.maxChanges}</p>
          </div>
          <div>
            <p className="text-gray-600">Duration</p>
            <p className="font-semibold">{formData.timeWindowMinutes} min</p>
          </div>
          <div>
            <p className="text-gray-600">Level</p>
            <p className="font-semibold">
              {formData.permissionLevel === 'level1' && 'Edit Only'}
              {formData.permissionLevel === 'level2' && 'Edit + Delete'}
              {formData.permissionLevel === 'level3' && 'Full Access'}
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-600">Sessions</p>
          <p className="font-semibold">{salesperson.stats?.totalSessionsGranted || 0}</p>
        </div>
        <div>
          <p className="text-gray-600">Changes Used</p>
          <p className="font-semibold">{salesperson.stats?.totalChangesUsed || 0}</p>
        </div>
        <div>
          <p className="text-gray-600">Last Session</p>
          <p className="font-semibold text-xs">
            {salesperson.stats?.lastSessionDate 
              ? new Date(salesperson.stats.lastSessionDate).toLocaleDateString()
              : 'Never'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default PermissionsSettings;
