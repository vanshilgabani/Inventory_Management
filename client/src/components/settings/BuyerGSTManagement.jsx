import React, { useState, useEffect } from 'react';
import { FiUser, FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import {wholesaleService} from '../../services/wholesaleService';
import buyerGSTService from '../../services/buyerGSTService';

const BuyerGSTManagement = () => {
  const [buyers, setBuyers] = useState([]);
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [gstProfiles, setGstProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingGST, setAddingGST] = useState(false);
  const [verifyingGST, setVerifyingGST] = useState(false);
  const [gstInput, setGstInput] = useState('');
  const [verifiedData, setVerifiedData] = useState(null);
  const [isDefault, setIsDefault] = useState(false);
  const [notes, setNotes] = useState('');

  // Fetch all buyers
  useEffect(() => {
    fetchBuyers();
  }, []);

  const fetchBuyers = async () => {
    setLoading(true);
    try {
      const data = await wholesaleService.getAllBuyers();
      setBuyers(data);
    } catch (error) {
      toast.error('Failed to load buyers');
    } finally {
      setLoading(false);
    }
  };

  // Fetch GST profiles for selected buyer
  const fetchGSTProfiles = async (buyerId) => {
    setLoading(true);
    try {
      const response = await buyerGSTService.getGSTProfiles(buyerId);
      setGstProfiles(response.data.profiles || []);
      setSelectedBuyer(response.data.buyer);
    } catch (error) {
      toast.error('Failed to load GST profiles');
      setGstProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle buyer selection
  const handleBuyerClick = (buyer) => {
    fetchGSTProfiles(buyer._id);
  };

// Handle GST verification
const handleVerifyGST = async () => {
  if (!gstInput || gstInput.trim().length !== 15) {
    toast.error('Please enter a valid 15-character GST number');
    return;
  }

  setVerifyingGST(true); // Use the correct state variable
  try {
    const result = await buyerGSTService.verifyGSTNumber(gstInput);
    
    if (result.success) {
      const data = result.data;
      
      // Show warning if API was unavailable
      if (result.warning) {
        toast.warning(result.warning, { duration: 6000 });
      } else {
        toast.success('GST verified successfully!');
      }
      
      // Store verified data
      setVerifiedData(data);
      
    } else {
      toast.error(result.message || 'GST verification failed');
    }
  } catch (error) {
    console.error('GST verification error:', error);
    toast.error(error.response?.data?.message || 'Failed to verify GST number');
  } finally {
    setVerifyingGST(false);
  }
};

  // Add GST profile
  const handleAddProfile = async () => {
    if (!verifiedData) {
      toast.error('Please verify GST first');
      return;
    }

    setAddingGST(true);
    try {
      await buyerGSTService.addGSTProfile(selectedBuyer.id, {
        gstNumber: gstInput,
        isDefault,
        notes
      });
      toast.success('GST profile added successfully');
      setShowAddModal(false);
      resetAddForm();
      fetchGSTProfiles(selectedBuyer.id);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add GST profile');
    } finally {
      setAddingGST(false);
    }
  };

  // Toggle profile active status
  const handleToggleActive = async (profileId, currentStatus) => {
    try {
      await buyerGSTService.updateGSTProfile(selectedBuyer.id, profileId, {
        isActive: !currentStatus
      });
      toast.success(`Profile ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchGSTProfiles(selectedBuyer.id);
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  // Set as default
  const handleSetDefault = async (profileId) => {
    try {
      await buyerGSTService.updateGSTProfile(selectedBuyer.id, profileId, {
        isDefault: true
      });
      toast.success('Default profile updated');
      fetchGSTProfiles(selectedBuyer.id);
    } catch (error) {
      toast.error('Failed to set default');
    }
  };

  // Delete profile
  const handleDeleteProfile = async (profileId) => {
    if (!window.confirm('Are you sure you want to delete this GST profile?')) {
      return;
    }

    try {
      await buyerGSTService.deleteGSTProfile(selectedBuyer.id, profileId);
      toast.success('GST profile deleted');
      fetchGSTProfiles(selectedBuyer.id);
    } catch (error) {
      toast.error('Failed to delete profile');
    }
  };

  // Refresh profile data
  const handleRefreshProfile = async (profileId) => {
    try {
      await buyerGSTService.refreshGSTProfile(selectedBuyer.id, profileId);
      toast.success('Profile refreshed from GST database');
      fetchGSTProfiles(selectedBuyer.id);
    } catch (error) {
      toast.error('Failed to refresh profile');
    }
  };

  // Reset add form
  const resetAddForm = () => {
    setGstInput('');
    setVerifiedData(null);
    setIsDefault(false);
    setNotes('');
  };

  // Filter buyers by search
  const filteredBuyers = buyers.filter(buyer =>
    buyer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    buyer.mobile?.includes(searchTerm) ||
    buyer.businessName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && buyers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading buyers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Buyer GST Profile Management
        </h2>
        <p className="text-gray-600">
          Manage multiple GST numbers for buyers who sell on different platforms
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Buyer List */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow p-4">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search buyers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredBuyers.map((buyer) => (
              <button
                key={buyer._id}
                onClick={() => handleBuyerClick(buyer)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedBuyer?.id === buyer._id
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <div className="flex items-start gap-2">
                  <FiUser className="text-gray-400 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {buyer.name}
                    </div>
                    <div className="text-sm text-gray-500">{buyer.mobile}</div>
                    {buyer.businessName && (
                      <div className="text-xs text-gray-400 truncate">
                        {buyer.businessName}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {filteredBuyers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No buyers found
              </div>
            )}
          </div>
        </div>

        {/* Right: GST Profiles */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          {!selectedBuyer ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
              <FiAlertCircle className="text-6xl mb-4" />
              <p className="text-lg">Select a buyer to manage GST profiles</p>
            </div>
          ) : (
            <>
              {/* Buyer Info Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">
                    {selectedBuyer.name}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedBuyer.mobile}</p>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FiPlus />
                  Add GST Profile
                </button>
              </div>

              {/* GST Profiles List */}
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  Loading profiles...
                </div>
              ) : gstProfiles.length === 0 ? (
                <div className="text-center py-12">
                  <FiAlertCircle className="text-4xl text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">No GST profiles added yet</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="text-blue-600 hover:underline"
                  >
                    Add the first GST profile
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {gstProfiles.map((profile) => (
                    <div
                      key={profile.profileId}
                      className={`border rounded-lg p-4 ${
                        profile.isActive ? 'bg-white' : 'bg-gray-50 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900">
                              {profile.businessName}
                            </h4>
                            {profile.isDefault && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                Default
                              </span>
                            )}
                            {!profile.isActive && (
                              <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                                Inactive
                              </span>
                            )}
                            {profile.gstStatus !== 'Active' && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                {profile.gstStatus}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            GST: <span className="font-mono">{profile.gstNumber}</span>
                          </div>
                          {profile.pan && (
                            <div className="text-sm text-gray-600">
                              PAN: <span className="font-mono">{profile.pan}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRefreshProfile(profile.profileId)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Refresh from GST database"
                          >
                            <FiRefreshCw />
                          </button>
                          <button
                            onClick={() => handleToggleActive(profile.profileId, profile.isActive)}
                            className={`p-2 rounded transition-colors ${
                              profile.isActive
                                ? 'text-gray-500 hover:text-orange-600 hover:bg-orange-50'
                                : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                            }`}
                            title={profile.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {profile.isActive ? <FiX /> : <FiCheck />}
                          </button>
                          <button
                            onClick={() => handleDeleteProfile(profile.profileId)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete profile"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>

                      {/* Address */}
                      {profile.address?.fullAddress && (
                        <div className="text-sm text-gray-600 mb-2">
                          📍 {profile.address.fullAddress}
                        </div>
                      )}

                      {/* Notes */}
                      {profile.notes && (
                        <div className="text-sm text-gray-500 italic">
                          Note: {profile.notes}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t">
                        {!profile.isDefault && profile.isActive && (
                          <button
                            onClick={() => handleSetDefault(profile.profileId)}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Set as Default
                          </button>
                        )}
                        {profile.usageCount > 0 && (
                          <span className="text-xs text-gray-400">
                            Used in {profile.usageCount} bills
                          </span>
                        )}
                        {profile.lastUsedAt && (
                          <span className="text-xs text-gray-400">
                            Last used: {new Date(profile.lastUsedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add GST Profile Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">
                  Add GST Profile - {selectedBuyer?.name}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetAddForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="text-2xl" />
                </button>
              </div>

              {/* GST Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GST Number *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={gstInput}
                    onChange={(e) => setGstInput(e.target.value.toUpperCase())}
                    placeholder="Enter 15-character GST number"
                    maxLength={15}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                    disabled={verifiedData !== null}
                  />
                  {!verifiedData ? (
                    <button
                      onClick={handleVerifyGST}
                      disabled={verifyingGST || gstInput.length !== 15}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {verifyingGST ? 'Verifying...' : 'Verify'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setVerifiedData(null);
                        setGstInput('');
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Change
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter GST number to auto-fetch business details
                </p>
              </div>

              {/* Verified Data Display */}
              {verifiedData && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 font-medium mb-3">
                    <FiCheck className="text-xl" />
                    GST Verified Successfully
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Business Name:</span>
                      <span className="ml-2 text-gray-900">{verifiedData.businessName}</span>
                    </div>
                    
                    {verifiedData.legalName && (
                      <div>
                        <span className="font-medium text-gray-700">Legal Name:</span>
                        <span className="ml-2 text-gray-900">{verifiedData.legalName}</span>
                      </div>
                    )}
                    
                    <div>
                      <span className="font-medium text-gray-700">PAN:</span>
                      <span className="ml-2 font-mono text-gray-900">{verifiedData.pan}</span>
                    </div>
                    
                    <div>
                      <span className="font-medium text-gray-700">State:</span>
                      <span className="ml-2 text-gray-900">
                        {verifiedData.address?.state} ({verifiedData.stateCode})
                      </span>
                    </div>
                    
                    {verifiedData.address?.fullAddress && (
                      <div>
                        <span className="font-medium text-gray-700">Address:</span>
                        <div className="ml-2 text-gray-900">
                          {verifiedData.address.fullAddress}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <span className="font-medium text-gray-700">GST Status:</span>
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                        verifiedData.gstStatus === 'Active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {verifiedData.gstStatus}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Options */}
              {verifiedData && (
                <>
                  <div className="mb-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        Set as default GST profile for this buyer
                      </span>
                    </label>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes about this GST profile..."
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetAddForm();
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddProfile}
                  disabled={!verifiedData || addingGST}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {addingGST ? 'Adding...' : 'Add Profile'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerGSTManagement;
