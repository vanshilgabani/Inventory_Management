const cron = require('node-cron');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const flipkartInventorySync = require('../utils/flipkartInventorySync');

class FlipkartSyncJob {
  constructor() {
    this.jobs = new Map(); // Store cron jobs per organization
  }

  /**
   * Start sync job for an organization
   */
  startJob(organizationId) {
    // Stop existing job if any
    this.stopJob(organizationId);

    Settings.findOne({ organizationId })
      .then(settings => {
        if (!settings?.flipkartSettings?.enabled || !settings.flipkartSettings.autoSyncEnabled) {
          console.log(`⏸️ Flipkart auto-sync disabled for org: ${organizationId}`);
          return;
        }

        const { syncTime, syncFrequency, secondSyncTime } = settings.flipkartSettings;

        // Parse time (format: "HH:MM")
        const [hour, minute] = syncTime.split(':');
        
        let cronExpression;
        
        if (syncFrequency === 'twice_daily' && secondSyncTime) {
          // Schedule twice daily
          const [hour2, minute2] = secondSyncTime.split(':');
          // Cron format: minute hour * * *
          cronExpression = `${minute} ${hour},${hour2} * * *`;
          console.log(`📅 Scheduling twice daily at ${syncTime} and ${secondSyncTime}`);
        } else {
          // Schedule once daily
          cronExpression = `${minute} ${hour} * * *`;
          console.log(`📅 Scheduling daily at ${syncTime}`);
        }

        const job = cron.schedule(cronExpression, async () => {
          console.log(`🔄 Auto Flipkart sync triggered for org: ${organizationId}`);
          await this.runSync(organizationId);
        }, {
          timezone: "Asia/Kolkata" // IST timezone
        });

        this.jobs.set(organizationId.toString(), job);
        console.log(`✅ Flipkart sync job started for org: ${organizationId}`);
      })
      .catch(err => {
        console.error(`❌ Failed to start Flipkart sync job:`, err);
      });
  }

  /**
   * Stop sync job for an organization
   */
  stopJob(organizationId) {
    const orgId = organizationId.toString();
    const job = this.jobs.get(orgId);
    
    if (job) {
      job.stop();
      this.jobs.delete(orgId);
      console.log(`⏹️ Flipkart sync job stopped for org: ${organizationId}`);
    }
  }

  /**
   * Run sync manually or via cron
   */
  async runSync(organizationId) {
    try {
      const products = await flipkartInventorySync.getProductsToSync(organizationId);
      
      if (products.length === 0) {
        console.log(`ℹ️ No products to sync for org: ${organizationId}`);
        
        // Update last sync result
        await Settings.findOneAndUpdate(
          { organizationId },
          { 
            'flipkartSettings.lastSyncAt': new Date(),
            'flipkartSettings.lastSyncResult': {
              success: true,
              totalProducts: 0,
              successCount: 0,
              failedCount: 0,
              message: 'No products enabled for sync'
            }
          }
        );
        
        return { success: true, message: 'No products to sync' };
      }

      console.log(`📦 Syncing ${products.length} products to Flipkart...`);
      const result = await flipkartInventorySync.syncProducts(products, organizationId);
      
      // ✅ FIXED: Count successes properly from nested structure
      let successCount = 0;
      let failedCount = 0;
      
      if (result.results && Array.isArray(result.results)) {
        // result.results is array of account results
        result.results.forEach(accountResult => {
          // Each accountResult has its own nested results array
          if (accountResult.results && Array.isArray(accountResult.results)) {
            accountResult.results.forEach(batchResult => {
              if (batchResult.success) {
                successCount += (batchResult.products?.length || 1);
              } else {
                failedCount += (batchResult.products?.length || 1);
              }
            });
          }
        });
      } else {
        // If results is missing, consider all products as failed
        failedCount = products.length;
      }

      // Update last sync result in settings
      await Settings.findOneAndUpdate(
        { organizationId },
        { 
          'flipkartSettings.lastSyncAt': new Date(),
          'flipkartSettings.lastSyncResult': {
            success: result.success,
            totalProducts: products.length,
            successCount,
            failedCount,
            message: result.success 
              ? 'Sync completed successfully' 
              : (result.error || result.message || 'Sync failed')
          }
        }
      );
      
      console.log(`✅ Flipkart sync completed:`, {
        total: products.length,
        success: successCount,
        failed: failedCount
      });
      
      return result;
      
    } catch (error) {
      console.error(`❌ Flipkart sync failed for org ${organizationId}:`, error);
      
      // Update last sync result with error
      await Settings.findOneAndUpdate(
        { organizationId },
        { 
          'flipkartSettings.lastSyncAt': new Date(),
          'flipkartSettings.lastSyncResult': {
            success: false,
            totalProducts: 0,
            successCount: 0,
            failedCount: 0,
            message: error.message
          }
        }
      );
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize jobs for all organizations with Flipkart enabled
   */
  async initializeAllJobs() {
    try {
      const settings = await Settings.find({
        'flipkartSettings.enabled': true,
        'flipkartSettings.autoSyncEnabled': true
      });

      console.log(`🚀 Initializing Flipkart sync jobs for ${settings.length} organizations`);

      settings.forEach(setting => {
        this.startJob(setting.organizationId);
      });

    } catch (error) {
      console.error('❌ Failed to initialize Flipkart sync jobs:', error);
    }
  }

  /**
   * Get next scheduled sync time for an organization
   */
  async getNextSyncTime(organizationId) {
    try {
      const settings = await Settings.findOne({ organizationId });
      
      if (!settings?.flipkartSettings?.enabled || !settings.flipkartSettings.autoSyncEnabled) {
        return null;
      }

      const { syncTime, syncFrequency, secondSyncTime } = settings.flipkartSettings;
      const now = new Date();
      
      // Parse sync time
      const [hour, minute] = syncTime.split(':').map(Number);
      
      // Create next sync date
      let nextSync = new Date();
      nextSync.setHours(hour, minute, 0, 0);
      
      // If time has passed today, schedule for tomorrow
      if (nextSync <= now) {
        nextSync.setDate(nextSync.getDate() + 1);
      }

      // Check if there's a second sync time that's sooner
      if (syncFrequency === 'twice_daily' && secondSyncTime) {
        const [hour2, minute2] = secondSyncTime.split(':').map(Number);
        let nextSync2 = new Date();
        nextSync2.setHours(hour2, minute2, 0, 0);
        
        if (nextSync2 > now && nextSync2 < nextSync) {
          nextSync = nextSync2;
        }
      }

      return nextSync;
      
    } catch (error) {
      console.error('Get next sync time error:', error);
      return null;
    }
  }
}

module.exports = new FlipkartSyncJob();
