import { useState, useEffect } from 'react';
import { settingsService } from '../../services/settingsService';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiStar, FiEye, FiEyeOff } from 'react-icons/fi';

const CompanyManagement = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    gstin: '',
    pan: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: 'Gujarat',
      pincode: '',
      stateCode: '24'
    },
    contact: {
      phone: '',
      email: ''
    },
    bank: {
      name: '',
      accountNo: '',
      ifsc: '',
      branch: ''
    },
    logo: '',
    isDefault: false
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const data = await settingsService.getCompanies();
      setCompanies(data.companies || []);
    } catch (error) {
      toast.error('Failed to load companies');
      console.error(error);
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
        address: company.address || {
          line1: '',
          line2: '',
          city: '',
          state: 'Gujarat',
          pincode: '',
          stateCode: '24'
        },
        contact: company.contact || {
          phone: '',
          email: ''
        },
        bank: company.bank || {
          name: '',
          accountNo: '',
          ifsc: '',
          branch: ''
        },
        logo: company.logo || '',
        isDefault: company.isDefault || false
      });
    } else {
      setEditingCompany(null);
      setFormData({
        name: '',
        legalName: '',
        gstin: '',
        pan: '',
        address: {
          line1: '',
          line2: '',
          city: '',
          state: 'Gujarat',
          pincode: '',
          stateCode: '24'
        },
        contact: {
          phone: '',
          email: ''
        },
        bank: {
          name: '',
          accountNo: '',
          ifsc: '',
          branch: ''
        },
        logo: '',
        isDefault: false
      });
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
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
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

  if (loading) {
    return <div className="text-center py-4">Loading companies...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Company Information</h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage your company details for invoices and bills
          </p>
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
            className={`border rounded-lg p-4 ${
              company.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'
            }`}
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
                    company.isActive 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {company.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {company.legalName && company.legalName !== company.name && (
                  <p className="text-sm text-gray-600 mt-1">{company.legalName}</p>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(company)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                  title="Edit"
                >
                  <FiEdit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggleActive(company.id, company.isActive)}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                  title={company.isActive ? 'Deactivate' : 'Activate'}
                >
                  {company.isActive ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
                {!company.isDefault && (
                  <button
                    onClick={() => handleDelete(company.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              {company.gstin && (
                <p><span className="font-medium">GSTIN:</span> {company.gstin}</p>
              )}
              {company.contact?.phone && (
                <p><span className="font-medium">Phone:</span> {company.contact.phone}</p>
              )}
              {company.contact?.email && (
                <p><span className="font-medium">Email:</span> {company.contact.email}</p>
              )}
              {company.address?.line1 && (
                <p><span className="font-medium">Address:</span> {company.address.line1}</p>
              )}
            </div>

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
          <button
            onClick={() => handleOpenModal()}
            className="mt-4 text-orange-600 hover:text-orange-700 font-medium"
          >
            Add your first company
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                {editingCompany ? 'Edit Company' : 'Add New Company'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Basic Information</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Legal Name
                    </label>
                    <input
                      type="text"
                      name="legalName"
                      value={formData.legalName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GSTIN
                    </label>
                    <input
                      type="text"
                      name="gstin"
                      value={formData.gstin}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="24XXXXX1234X1Z5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PAN
                    </label>
                    <input
                      type="text"
                      name="pan"
                      value={formData.pan}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="XXXXX1234X"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="isDefault"
                    id="isDefault"
                    checked={formData.isDefault}
                    onChange={handleInputChange}
                    className="rounded text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="isDefault" className="text-sm text-gray-700">
                    Set as default company
                  </label>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Address</h4>
                
                <div className="space-y-3">
                  <input
                    type="text"
                    value={formData.address.line1}
                    onChange={(e) => handleNestedChange('address', 'line1', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Address"
                  />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={formData.address.city}
                      onChange={(e) => handleNestedChange('address', 'city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="City"
                    />
                    
                    <input
                      type="text"
                      value={formData.address.state}
                      onChange={(e) => handleNestedChange('address', 'state', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="State"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={formData.address.pincode}
                      onChange={(e) => handleNestedChange('address', 'pincode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Pincode"
                    />
                    
                    <input
                      type="text"
                      value={formData.address.stateCode}
                      onChange={(e) => handleNestedChange('address', 'stateCode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="State Code (e.g., 24)"
                    />
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Contact Information</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="tel"
                    value={formData.contact.phone}
                    onChange={(e) => handleNestedChange('contact', 'phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Phone Number"
                  />
                  
                  <input
                    type="email"
                    value={formData.contact.email}
                    onChange={(e) => handleNestedChange('contact', 'email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Email Address"
                  />
                </div>
              </div>

              {/* Bank Details */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Bank Details</h4>
                
                <div className="space-y-3">
                  <input
                    type="text"
                    value={formData.bank.name}
                    onChange={(e) => handleNestedChange('bank', 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Bank Name"
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={formData.bank.accountNo}
                      onChange={(e) => handleNestedChange('bank', 'accountNo', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Account Number"
                    />
                    
                    <input
                      type="text"
                      value={formData.bank.ifsc}
                      onChange={(e) => handleNestedChange('bank', 'ifsc', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="IFSC Code"
                    />
                  </div>
                  
                  <input
                    type="text"
                    value={formData.bank.branch}
                    onChange={(e) => handleNestedChange('bank', 'branch', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Branch"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
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
