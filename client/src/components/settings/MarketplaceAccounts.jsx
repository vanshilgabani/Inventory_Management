// src/components/settings/MarketplaceAccounts.jsx
import React from 'react';
import {
  FiShoppingBag,
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiEye,
  FiEyeOff,
  FiPlus
} from 'react-icons/fi';

const MarketplaceAccounts = ({
  settings,
  editingAccountId,
  editingAccountName,
  handleEditAccount,
  handleSaveAccountEdit,
  handleCancelEdit,
  handleSetDefaultAccount,
  handleToggleAccountActive,
  handleDeleteAccount,
  setEditingAccountName,
  newAccountName,
  setNewAccountName,
  newAccountIsDefault,
  setNewAccountIsDefault,
  handleAddMarketplaceAccount
}) => {
  const accounts = settings.marketplaceAccounts || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FiShoppingBag className="text-blue-600" />
            <h3 className="text-lg font-semibold">Marketplace Accounts</h3>
          </div>
        </div>

        {/* Add account form */}
        <div className="mb-6 border rounded-lg p-4 bg-gray-50">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="e.g., Amazon, Flipkart"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={newAccountIsDefault}
                  onChange={(e) => setNewAccountIsDefault(e.target.checked)}
                  className="mr-2"
                />
                Set as default
              </label>
              <button
                type="button"
                onClick={handleAddMarketplaceAccount}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <FiPlus size={16} />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* List of accounts */}
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FiShoppingBag className="mx-auto text-4xl mb-2 text-gray-400" />
            <p className="font-medium">No marketplace accounts configured</p>
            <p className="text-sm">Add your first account to start tracking sales</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account._id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  {editingAccountId === account._id ? (
                    <input
                      type="text"
                      value={editingAccountName}
                      onChange={(e) => setEditingAccountName(e.target.value)}
                      className="w-full px-3 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.accountName}</span>
                        {account.isDefault && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                            Default
                          </span>
                        )}
                        {!account.isActive && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      {account.createdAt && (
                        <p className="text-xs text-gray-500">
                          Added{' '}
                          {new Date(account.createdAt).toLocaleDateString('en-IN')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {editingAccountId === account._id ? (
                    <>
                      <button
                        onClick={() => handleSaveAccountEdit(account._id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded"
                        title="Save"
                      >
                        <FiCheck />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      {!account.isDefault && (
                        <button
                          onClick={() => handleSetDefaultAccount(account._id)}
                          className="px-3 py-1 text-xs border border-blue-600 text-blue-600 rounded hover:bg-blue-50"
                          title="Set as default"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() =>
                          handleToggleAccountActive(account._id, account.isActive)
                        }
                        className="p-2 hover:bg-gray-100 rounded"
                        title={account.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {account.isActive ? (
                          <FiEye className="text-green-600" />
                        ) : (
                          <FiEyeOff className="text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEditAccount(account)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(account._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceAccounts;
