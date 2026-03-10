import { useState, useEffect, useRef } from 'react';
import { settingsService } from '../../services/settingsService';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiStar, FiEye, FiEyeOff, FiUpload, FiImage } from 'react-icons/fi';

const CompanyManagement = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const fileInputRef = useRef(null);

  const defaultFormData = {
    name: '', legalName: '', gstin: '', pan: '',
    address: { line1: '', line2: '', city: '', state: 'Gujarat', pincode: '', stateCode: '24' },
    contact: { phone: '', email: '' },
    bank: { name: '', accountNo: '', ifsc: '', branch: '' },
    logo: '',
    isDefault: false,
    // ✅ NEW
    signature: {
      image: '',
      enabledForChallans: false,
      enabledForBills: false
    }
  };

  const [formData, setFormData] = useState(defaultFormData);

  useEffect(() => { fetchCompanies(); }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const data = await settingsService.getCompanies();
      setCompanies(data.companies || []);
    } catch (error) {
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (company = null) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        name: company.name || '',
        legalName: company.legalName || '',
        gstin: company.gstin || '',
        pan: company.pan || '',
        address: company.address || defaultFormData.address,
        contact: company.contact || defaultFormData.contact,
        bank: company.bank || defaultFormData.bank,
        logo: company.logo || '',
        isDefault: company.isDefault || false,
        // ✅ NEW: Load existing signature data
        signature: {
          image: company.signature?.image || '',
          enabledForChallans: company.signature?.enabledForChallans || false,
          enabledForBills: company.signature?.enabledForBills || false
        }
      });
    } else {
      setEditingCompany(null);
      setFormData(defaultFormData);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCompany(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleNestedChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  // ✅ NEW: Handle signature image upload
  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Please upload PNG or JPG image only');
      return;
    }

    // Validate file size (max 2MB before resize)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image too large. Please use image under 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to max 800px wide, maintain aspect ratio
        const canvas = document.createElement('canvas');
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        // Keep transparency for PNG
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const base64 = canvas.toDataURL('image/png');
        setFormData(prev => ({
          ...prev,
          signature: { ...prev.signature, image: base64 }
        }));
        toast.success('Signature uploaded successfully');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // ✅ NEW: Remove signature
  const handleRemoveSignature = () => {
    setFormData(prev => ({
      ...prev,
      signature: { ...prev.signature, image: '' }
    }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    try {
      if (editingCompany) {
        await settingsService.updateCompany(editingCompany.id, formData);
        toast.success('Company updated successfully');
      } else {
        await settingsService.addCompany(formData);
        toast.success('Company added successfully');
      }
      fetchCompanies();
      handleCloseModal();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save company');
    }
  };

  const handleToggleActive = async (companyId, currentStatus) => {
    try {
      await settingsService.toggleCompanyActive(companyId, !currentStatus);
      toast.success(`Company ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchCompanies();
    } catch (error) {
      toast.error('Failed to update company status');
    }
  };

  const handleSetDefault = async (companyId) => {
    try {
      await settingsService.setDefaultCompany(companyId);
      toast.success('Default company set successfully');
      fetchCompanies();
    } catch (error) {
      toast.error('Failed to set default company');
    }
  };

  const handleDelete = async (companyId) => {
    if (!window.confirm('Are you sure you want to delete this company?')) return;
    try {
      await settingsService.deleteCompany(companyId);
      toast.success('Company deleted successfully');
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete company');
    }
  };

  if (loading) return <div className="text-center py-4">Loading companies...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Company Information</h3>
          <p className="text-sm text-gray-500 mt-1">Manage your company details for invoices and bills</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <FiPlus /> Add Company
        </button>
      </div>

      {/* Companies List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map((company) => (
          <div
            key={company.id}
            className={`border rounded-lg p-4 ${company.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900">{company.name}</h4>
                  {company.isDefault && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                      <FiStar className="w-3 h-3" /> Default
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    company.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {company.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {company.legalName && company.legalName !== company.name && (
                  <p className="text-sm text-gray-600 mt-1">{company.legalName}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenModal(company)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                  <FiEdit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleToggleActive(company.id, company.isActive)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
                  {company.isActive ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
                {!company.isDefault && (
                  <button onClick={() => handleDelete(company.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              {company.gstin && <p><span className="font-medium">GSTIN:</span> {company.gstin}</p>}
              {company.contact?.phone && <p><span className="font-medium">Phone:</span> {company.contact.phone}</p>}
              {company.contact?.email && <p><span className="font-medium">Email:</span> {company.contact.email}</p>}
              {company.address?.line1 && <p><span className="font-medium">Address:</span> {company.address.line1}</p>}
            </div>

            {/* ✅ NEW: Show signature status badge on card */}
            {company.signature?.image && (
              <div className="mt-2 flex gap-2">
                {company.signature.enabledForChallans && (
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">✍️ Sign on Challans</span>
                )}
                {company.signature.enabledForBills && (
                  <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">✍️ Sign on Bills</span>
                )}
              </div>
            )}

            {!company.isDefault && company.isActive && (
              <button
                onClick={() => handleSetDefault(company.id)}
                className="mt-3 w-full py-2 text-sm text-orange-600 border border-orange-600 rounded hover:bg-orange-50"
              >
                Set as Default
              </button>
            )}
          </div>
        ))}
      </div>

      {companies.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No companies added yet</p>
          <button onClick={() => handleOpenModal()} className="mt-4 text-orange-600 hover:text-orange-700 font-medium">
            Add your first company
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                {editingCompany ? 'Edit Company' : 'Add New Company'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">

              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Legal Name</label>
                    <input type="text" name="legalName" value={formData.legalName} onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                    <input type="text" name="gstin" value={formData.gstin} onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="24XXXXX1234X1Z5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
                    <input type="text" name="pan" value={formData.pan} onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="XXXXX1234X" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="isDefault" id="isDefault" checked={formData.isDefault} onChange={handleInputChange}
                    className="rounded text-orange-600 focus:ring-orange-500" />
                  <label htmlFor="isDefault" className="text-sm text-gray-700">Set as default company</label>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Address</h4>
                <div className="space-y-3">
                  <input type="text" value={formData.address.line1}
                    onChange={(e) => handleNestedChange('address', 'line1', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="Address" />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={formData.address.city}
                      onChange={(e) => handleNestedChange('address', 'city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="City" />
                    <input type="text" value={formData.address.state}
                      onChange={(e) => handleNestedChange('address', 'state', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="State" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={formData.address.pincode}
                      onChange={(e) => handleNestedChange('address', 'pincode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="Pincode" />
                    <input type="text" value={formData.address.stateCode}
                      onChange={(e) => handleNestedChange('address', 'stateCode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="State Code (e.g., 24)" />
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="tel" value={formData.contact.phone}
                    onChange={(e) => handleNestedChange('contact', 'phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="Phone Number" />
                  <input type="email" value={formData.contact.email}
                    onChange={(e) => handleNestedChange('contact', 'email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="Email Address" />
                </div>
              </div>

              {/* Bank */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Bank Details</h4>
                <div className="space-y-3">
                  <input type="text" value={formData.bank.name}
                    onChange={(e) => handleNestedChange('bank', 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="Bank Name" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input type="text" value={formData.bank.accountNo}
                      onChange={(e) => handleNestedChange('bank', 'accountNo', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="Account Number" />
                    <input type="text" value={formData.bank.ifsc}
                      onChange={(e) => handleNestedChange('bank', 'ifsc', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="IFSC Code" />
                  </div>
                  <input type="text" value={formData.bank.branch}
                    onChange={(e) => handleNestedChange('bank', 'branch', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="Branch" />
                </div>
              </div>

              {/* ✅ NEW: Authorised Signature Section */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900">Authorised Signature</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Upload PNG with transparent background for best results</p>
                </div>

                {/* Upload Area */}
                {!formData.signature.image ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors"
                  >
                    <FiUpload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Click to upload signature image</p>
                    <p className="text-xs text-gray-400 mt-1">PNG (transparent) or JPG • Max 2MB</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-sm font-medium text-gray-700">Signature Preview</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <FiImage className="w-3 h-3" /> Change
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveSignature}
                          className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                        >
                          <FiTrash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>
                    {/* Checkerboard background to show transparency */}
                    <div className="flex justify-center p-4 rounded"
                      style={{ background: 'repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0 0 / 16px 16px' }}>
                      <img
                        src={formData.signature.image}
                        alt="Signature preview"
                        className="max-h-24 max-w-full object-contain"
                      />
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleSignatureUpload}
                  className="hidden"
                />

                {/* Toggle Controls — only show if signature is uploaded */}
                {formData.signature.image && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-gray-700">Attach signature automatically in:</p>

                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="text-sm text-gray-700">Challans (Delivery Notes)</p>
                        <p className="text-xs text-gray-500">Will appear above "Authorised Signature" label</p>
                      </div>
                      <div
                        onClick={() => handleNestedChange('signature', 'enabledForChallans', !formData.signature.enabledForChallans)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                          formData.signature.enabledForChallans ? 'bg-orange-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          formData.signature.enabledForChallans ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </div>
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="text-sm text-gray-700">Bills (Tax Invoices)</p>
                        <p className="text-xs text-gray-500">Will appear above "Authorised Signature" label</p>
                      </div>
                      <div
                        onClick={() => handleNestedChange('signature', 'enabledForBills', !formData.signature.enabledForBills)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                          formData.signature.enabledForBills ? 'bg-orange-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          formData.signature.enabledForBills ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit"
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
                  {editingCompany ? 'Update Company' : 'Add Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyManagement;
