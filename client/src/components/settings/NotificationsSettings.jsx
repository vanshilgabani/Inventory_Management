import React from 'react';
import { FiBell, FiMail } from 'react-icons/fi';

const NotificationsSettings = ({ settings, handleNestedChange, handleEmailTemplateChange, handleUpdateSettings, saving }) => {
  return (
    <div className="space-y-6">
      {/* Notification Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <FiBell className="text-blue-600" />
          <h3 className="text-lg font-semibold">Notification Settings</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div>
              <p className="font-medium text-sm">Auto Delete Resolved Notifications</p>
              <p className="text-xs text-gray-500">Automatically delete resolved notifications after specified days</p>
            </div>
            <input
              type="number"
              min="1"
              max="365"
              value={settings.notifications?.autoDeleteResolvedAfterDays || 30}
              onChange={(e) => handleNestedChange('notifications', 'autoDeleteResolvedAfterDays', parseInt(e.target.value))}
              className="w-20 px-2 py-1 border border-gray-300 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Email Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <FiMail className="text-blue-600" />
          <h3 className="text-lg font-semibold">Email Settings</h3>
        </div>

        <div className="space-y-4">
          {/* Wholesale Challan Email */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium text-sm">Wholesale Challan Email</h4>
                <p className="text-xs text-gray-500">Automatically email PDF challan to buyer after order creation</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailTemplates?.wholesaleChallan?.enabled || false}
                  onChange={(e) => handleEmailTemplateChange('wholesaleChallan', 'enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {settings.emailTemplates?.wholesaleChallan?.enabled && (
              <div className="space-y-3 mt-3 pt-3 border-t">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={settings.emailTemplates?.wholesaleChallan?.subject || ''}
                    onChange={(e) => handleEmailTemplateChange('wholesaleChallan', 'subject', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Your Wholesale Order #{challanNumber}"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Message Body</label>
                  <textarea
                    value={settings.emailTemplates?.wholesaleChallan?.body || ''}
                    onChange={(e) => handleEmailTemplateChange('wholesaleChallan', 'body', e.target.value)}
                    rows={4}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dear {buyerName}, Your order {challanNumber} has been confirmed..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Available variables: {'{buyerName}'}, {'{challanNumber}'}, {'{totalAmount}'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Daily Summary Email */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">Daily Summary Email</h4>
                <p className="text-xs text-gray-500">Receive daily summary of pending payments and notifications</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailTemplates?.dailySummary?.enabled || false}
                  onChange={(e) => handleEmailTemplateChange('dailySummary', 'enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleUpdateSettings}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default NotificationsSettings;
