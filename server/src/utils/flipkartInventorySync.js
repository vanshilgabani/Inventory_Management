const axios = require('axios');
const flipkartAuth = require('./flipkartAuth');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const TenantSettings = require('../models/TenantSettings');
const flipkartOrderFetcher = require('./flipkartOrderFetcher');

const TEST_MODE = process.env.FLIPKART_TEST_MODE === 'true';

class FlipkartInventorySync {
  constructor() {
    this.baseURL = 'https://api.flipkart.net';
  }

  // ✅ UPDATED: Sync to all active marketplace accounts
  async syncProducts(products, organizationId) {
    try {
      const settings = await Settings.findOne({ organizationId });
      
      if (!settings || !settings.marketplaceAccounts || settings.marketplaceAccounts.length === 0) {
        return { success: false, message: 'No marketplace accounts configured' };
      }

      // ✅ Get inventory mode
      const tenantSettings = await TenantSettings.findOne({ organizationId });
      const inventoryMode = tenantSettings?.inventoryMode || 'main';
      
      console.log(`📦 Using inventory mode: ${inventoryMode}`);

      // ✅ Get active accounts with Flipkart enabled
      const activeAccounts = settings.marketplaceAccounts.filter(
        acc => acc.isActive && acc.flipkart?.enabled
      );

      if (activeAccounts.length === 0) {
        return { success: false, message: 'No active Flipkart accounts found' };
      }

      console.log(`🏦 Syncing to ${activeAccounts.length} account(s)`);

      const allResults = [];

      // ✅ Sync to each account
      for (const account of activeAccounts) {
        console.log(`\n📱 Syncing account: ${account.accountName}`);
        
        const result = await this.syncToAccount(
          products,
          account,
          inventoryMode,
          organizationId
        );

        allResults.push({
          accountId: account._id,
          accountName: account.accountName,
          ...result
        });
      }

      // ✅ Update global last sync time
      await Settings.updateOne(
        { organizationId },
        { $set: { 'flipkartSettings.lastSyncAt': new Date() } }
      );

      return {
        success: true,
        message: `Synced to ${activeAccounts.length} account(s)`,
        results: allResults
      };
    } catch (error) {
      console.error('❌ Flipkart sync error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync to a specific account with early-stage order adjustment
   */
  async syncToAccount(products, account, inventoryMode, organizationId) {
    try {
      const { appId, appSecret, locationId } = account.flipkart;

      if (!appId || !appSecret || !locationId) {
        return {
          success: false,
          message: 'Missing credentials for account'
        };
      }

      // ✅ Get token only if NOT in test mode
      let token = null;
      if (!TEST_MODE) {
        token = await flipkartAuth.getAccessTokenForAccount(appId, appSecret, organizationId);
      }

      // ✅ NEW: Fetch early-stage orders BEFORE building payload
      console.log(`📥 Checking early-stage orders for ${account.accountName}...`);
      const pendingOrders = await flipkartOrderFetcher.fetchEarlyStageOrders(account, organizationId);

      const results = [];
      const batches = this.createBatches(products, 10);

      for (const batch of batches) {
        try {
          // ✅ Build payload with pending orders adjustment
          const payload = this.buildInventoryPayload(
            batch,
            locationId,
            inventoryMode,
            account._id.toString(),
            account.accountName,
            pendingOrders  // ← Pass pending orders here
          );

          if (Object.keys(payload).length === 0) {
            continue;
          }

          // Mock sync in test mode
          if (TEST_MODE) {
            console.log(`🧪 TEST MODE: Simulating sync for ${account.accountName}`, {
              products: batch.map(p => p.design),
              payload: Object.keys(payload).length + ' items',
              inventoryMode,
              adjustedForPending: Object.keys(pendingOrders).length > 0
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            // Update sync status for this account
            for (const product of batch) {
              const accountMapping = product.flipkart.accountMappings?.find(
                am => am.accountId === account._id.toString()
              );
              if (accountMapping) {
                accountMapping.lastSyncedAt = new Date();
                accountMapping.lastSyncStatus = 'success';
                accountMapping.lastSyncError = null;
                await product.save();
              }
            }

            results.push({
              success: true,
              products: batch.map(p => p.design),
              response: { 
                message: `Test sync successful for ${account.accountName}`,
                adjustedForPending: Object.keys(pendingOrders).length
              }
            });

            continue;
          }

          // ✅ Real API call
          const response = await axios.post(
            `${this.baseURL}/listings/v3/update/inventory`,
            payload,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          );

          // Update sync status for this account
          for (const product of batch) {
            const accountMapping = product.flipkart.accountMappings?.find(
              am => am.accountId === account._id.toString()
            );
            if (accountMapping) {
              accountMapping.lastSyncedAt = new Date();
              accountMapping.lastSyncStatus = 'success';
              accountMapping.lastSyncError = null;
              await product.save();
            }
          }

          results.push({
            success: true,
            products: batch.map(p => p.design),
            response: response.data
          });

        } catch (error) {
          console.error(`❌ Batch sync error for ${account.accountName}:`, error.response?.data || error.message);

          // Mark as failed for this account
          for (const product of batch) {
            const accountMapping = product.flipkart.accountMappings?.find(
              am => am.accountId === account._id.toString()
            );
            if (accountMapping) {
              accountMapping.lastSyncedAt = new Date();
              accountMapping.lastSyncStatus = 'failed';
              accountMapping.lastSyncError = error.response?.data?.message || error.message;
              await product.save();
            }
          }

          results.push({
            success: false,
            products: batch.map(p => p.design),
            error: error.response?.data || error.message
          });
        }
      }

      // ✅ Update account last sync time
      account.flipkart.lastSyncAt = new Date();
      account.flipkart.lastSyncStatus = results.every(r => r.success) ? 'success' : 'failed';
      await Settings.updateOne(
        { organizationId, 'marketplaceAccounts._id': account._id },
        {
          $set: {
            'marketplaceAccounts.$.flipkart.lastSyncAt': account.flipkart.lastSyncAt,
            'marketplaceAccounts.$.flipkart.lastSyncStatus': account.flipkart.lastSyncStatus
          }
        }
      );

      return {
        success: true,
        totalProducts: products.length,
        results
      };

    } catch (error) {
      console.error(`❌ Account sync error for ${account.accountName}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build inventory payload with early-stage order adjustment
   */
  buildInventoryPayload(products, locationId, inventoryMode, accountId, accountName, pendingOrders = {}) {
    const payload = {};

    products.forEach(product => {
      const accountMapping = product.flipkart?.accountMappings?.find(
        am => am.accountId === accountId
      );

      if (!accountMapping || !accountMapping.enabled) {
        return;
      }

      product.colors.forEach(colorVariant => {
        colorVariant.sizes.forEach(sizeVariant => {
          // Find FSN for this variant in this account
          const variantMapping = accountMapping.variantMappings?.find(
            vm => vm.color === colorVariant.color && vm.size === sizeVariant.size
          );

          if (!variantMapping || !variantMapping.fsn) {
            return;
          }

          const fsn = variantMapping.fsn;

          // Calculate stock based on inventory mode
          let availableStock = 0;

          if (inventoryMode === 'main') {
            availableStock = sizeVariant.currentStock || 0;
          } else {
            // Reserved mode - get account allocation
            const allocation = sizeVariant.reservedAllocations?.find(
              a => a.accountName === accountName
            );
            availableStock = allocation?.quantity || 0;
          }

          // ✅ SUBTRACT early-stage orders from Flipkart
          const pendingQty = pendingOrders[fsn] || 0;
          const adjustedStock = Math.max(0, availableStock - pendingQty);

          // Build payload
          if (!payload[fsn]) {
            payload[fsn] = {
              fsn: fsn,
              locations: [
                {
                  id: locationId,
                  inventory: adjustedStock
                }
              ]
            };
          }

          // Log the calculation
          console.log(`📊 ${product.design}-${colorVariant.color}-${sizeVariant.size} (${accountName}):`);
          console.log(`   Allocation: ${availableStock} units`);
          if (pendingQty > 0) {
            console.log(`   Early-stage orders: ${pendingQty} units`);
            console.log(`   Adjusted: ${adjustedStock} units ✅`);
          } else {
            console.log(`   Syncing: ${adjustedStock} units (no pending orders)`);
          }
        });
      });
    });

    return payload;
  }

  createBatches(array, size) {
    const batches = [];
    for (let i = 0; i < array.length; i += size) {
      batches.push(array.slice(i, i + size));
    }
    return batches;
  }

  async getProductsToSync(organizationId) {
    return await Product.find({
      organizationId,
      'flipkart.accountMappings.enabled': true,
      'flipkart.accountMappings.variantMappings.0': { $exists: true }
    });
  }
}

module.exports = new FlipkartInventorySync();
