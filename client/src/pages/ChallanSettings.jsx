import { useState, useEffect } from 'react';
import { challanSettingsService } from '../services/challanSettingsService';
import Card from '../components/common/Card';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';
import { FiSave, FiFileText, FiPlus, FiX } from 'react-icons/fi';

const ChallanSettings = () => {
  // ✅ CHANGED: Initialize with empty values
  const [settings, setSettings] = useState({
    businessName: '',
    address: '',
    email: '',
    mobile: '',
    gstNumber: '',
    termsConditions: [],
    signatureText: 'Authorized Signatory'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await challanSettingsService.getSettings();
      // ✅ Set fetched data (will be empty if no settings exist)
      setSettings(data);
    } catch (error) {
      toast.error('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await challanSettingsService.updateSettings(settings);
      toast.success('Settings updated successfully!');
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTerm = () => {
    setSettings({
      ...settings,
      termsConditions: [...settings.termsConditions, '']
    });
  };

  const handleRemoveTerm = (index) => {
    const newTerms = settings.termsConditions.filter((_, i) => i !== index);
    setSettings({ ...settings, termsConditions: newTerms });
  };

  const handleTermChange = (index, value) => {
    const newTerms = [...settings.termsConditions];
    newTerms[index] = value;
    setSettings({ ...settings, termsConditions: newTerms });
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <FiFileText className="text-blue-500" />
          Challan Settings
        </h1>
        <p className="text-gray-500 mt-1">Configure your business details and challan format</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Business Details */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Business Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={settings.businessName}
                  onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                  placeholder="Enter business name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  GST Number *
                </label>
                <input
                  type="text"
                  value={settings.gstNumber}
                  onChange={(e) => setSettings({ ...settings, gstNumber: e.target.value })}
                  placeholder="Enter GST number"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="Enter email address"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mobile Number *
                </label>
                <input
                  type="text"
                  value={settings.mobile}
                  onChange={(e) => setSettings({ ...settings, mobile: e.target.value })}
                  placeholder="Enter mobile number"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Address *
                </label>
                <textarea
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="Enter business address"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Signature Text
                </label>
                <input
                  type="text"
                  value={settings.signatureText}
                  onChange={(e) => setSettings({ ...settings, signatureText: e.target.value })}
                  placeholder="Authorized Signatory"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Terms & Conditions */}
        <Card className="mt-6">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Terms & Conditions</h2>
              <button
                type="button"
                onClick={handleAddTerm}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                <FiPlus />
                Add Term
              </button>
            </div>

            <div className="space-y-3">
              {settings.termsConditions && settings.termsConditions.length > 0 ? (
                settings.termsConditions.map((term, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="text-sm font-semibold text-gray-700 mt-2">{index + 1}.</span>
                    <input
                      type="text"
                      value={term}
                      onChange={(e) => handleTermChange(index, e.target.value)}
                      placeholder="Enter term or condition"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveTerm(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <FiX size={20} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No terms added yet. Click "Add Term" to get started.</p>
              )}
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end mt-6">
          <button
            type="submit"
            disabled={saving}
            className={`flex items-center gap-2 px-8 py-3 text-white rounded-lg font-semibold ${
              saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            <FiSave />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChallanSettings;
