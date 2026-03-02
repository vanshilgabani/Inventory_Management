const axios = require('axios');
const flipkartAuth = require('./flipkartAuth');

class FlipkartOrderFetcher {
  constructor() {
    this.baseURL = process.env.FLIPKART_API_URL || 'https://api.flipkart.net';
    this.testMode = process.env.FLIPKART_TEST_MODE === 'true';
  }

  /**
   * Fetch early-stage orders (upcoming + pending label only)
   * Returns: { fsn: quantity } mapping
   */
  async fetchEarlyStageOrders(account, organizationId) {
    try {
      const { appId, appSecret, locationId } = account.flipkart;

      if (!appId || !appSecret || !locationId) {
        console.warn(`⚠️ Missing credentials for ${account.accountName}`);
        return {};
      }

      // Test mode simulation
      if (this.testMode) {
        console.log(`🧪 TEST MODE: Simulating early-stage orders for ${account.accountName}`);
        // Return empty for test mode (no orders to subtract)
        return {};
      }

      // Get access token
      const token = await flipkartAuth.getAccessTokenForAccount(appId, appSecret, organizationId);

      console.log(`📥 Fetching early-stage orders for ${account.accountName}...`);

      // Fetch orders with status: upcoming, pending
      const response = await axios.get(`${this.baseURL}/orders/v3/shipments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          filter: {
            states: ['Approved', 'PENDING_LABEL_GENERATION'], // Flipkart API statuses
            locationIds: [locationId]
          },
          pageSize: 100
        },
        timeout: 15000
      });

      // Parse and group by FSN
      const pendingByFSN = {};

      if (response.data && response.data.shipments) {
        response.data.shipments.forEach(shipment => {
          // Check status
          const status = shipment.status || '';
          
          // Only count "Approved" (upcoming) and "PENDING_LABEL_GENERATION" (pending label)
          if (!['Approved', 'PENDING_LABEL_GENERATION'].includes(status)) {
            return;
          }

          // Process each item in the shipment
          if (shipment.orderItems && Array.isArray(shipment.orderItems)) {
            shipment.orderItems.forEach(item => {
              const fsn = item.fsn;
              const quantity = item.quantity || 0;

              if (fsn && quantity > 0) {
                if (!pendingByFSN[fsn]) {
                  pendingByFSN[fsn] = 0;
                }
                pendingByFSN[fsn] += quantity;
              }
            });
          }
        });
      }

      // Log results
      const totalOrders = Object.keys(pendingByFSN).length;
      if (totalOrders > 0) {
        console.log(`✅ Found ${totalOrders} variants with early-stage orders:`);
        Object.entries(pendingByFSN).forEach(([fsn, qty]) => {
          console.log(`   ${fsn}: ${qty} units`);
        });
      } else {
        console.log(`✅ No early-stage orders found for ${account.accountName}`);
      }

      return pendingByFSN;

    } catch (error) {
      console.error(`❌ Failed to fetch orders for ${account.accountName}:`, error.message);
      
      // If API fails, return empty (safer to not subtract anything)
      return {};
    }
  }

  /**
   * Fetch early-stage orders for multiple accounts
   */
  async fetchForAllAccounts(accounts, organizationId) {
    const ordersByAccount = {};

    for (const account of accounts) {
      const orders = await this.fetchEarlyStageOrders(account, organizationId);
      ordersByAccount[account._id.toString()] = orders;
    }

    return ordersByAccount;
  }
}

module.exports = new FlipkartOrderFetcher();
