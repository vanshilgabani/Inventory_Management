const axios = require('axios');
const Settings = require('../models/Settings');

// ✅ ADD THIS - Test mode flag
const TEST_MODE = process.env.FLIPKART_TEST_MODE === 'true';

class FlipkartAuth {
  constructor() {
    this.baseURL = 'https://api.flipkart.net';
  }

  async getAccessToken(organizationId) {
    try {
      const settings = await Settings.findOne({ organizationId });
      
      if (!settings?.flipkartSettings?.enabled) {
        throw new Error('Flipkart integration is not enabled');
      }

      const { appId, appSecret, accessToken, tokenExpiresAt } = settings.flipkartSettings;

      if (!appId || !appSecret) {
        throw new Error('Flipkart credentials not configured');
      }

      // ✅ ADD THIS - Return test token in test mode
      if (TEST_MODE) {
        console.log('🧪 TEST MODE: Using dummy access token');
        return 'test_access_token_12345';
      }

      // Check if existing token is still valid (with 5 min buffer)
      const now = new Date();
      const bufferTime = 5 * 60 * 1000;
      
      if (accessToken && tokenExpiresAt && new Date(tokenExpiresAt).getTime() > now.getTime() + bufferTime) {
        console.log('✅ Using existing Flipkart access token');
        return accessToken;
      }

      // Generate new token
      console.log('🔄 Generating new Flipkart access token...');
      const newToken = await this.generateToken(appId, appSecret);
      
      // Save to database
      settings.flipkartSettings.accessToken = newToken.access_token;
      settings.flipkartSettings.tokenExpiresAt = new Date(Date.now() + (newToken.expires_in * 1000));
      
      await settings.save();
      
      console.log('✅ New Flipkart token generated and saved');
      return newToken.access_token;
      
    } catch (error) {
      console.error('❌ Flipkart auth error:', error.message);
      throw error;
    }
  }

  // ✅ ADD THIS METHOD
  async getAccessTokenForAccount(appId, appSecret, organizationId) {
    try {
      // Generate Basic Auth token
      const basicAuth = Buffer.from(`${appId}:${appSecret}`).toString('base64');

      const response = await axios.post(
        'https://api.flipkart.net/oauth-service/oauth/token',
        'grant_type=client_credentials&scope=Seller_Api',
        {
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );

      if (response.data.access_token) {
        return response.data.access_token;
      }

      throw new Error('No access token in response');
    } catch (error) {
      console.error('Get account token error:', error);
      throw error;
    }
  }

  async generateToken(appId, appSecret) {
    // ✅ ADD THIS - Mock token in test mode
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Generating mock token');
      return {
        access_token: 'test_access_token_12345',
        expires_in: 3600
      };
    }

    try {
      const credentials = Buffer.from(`${appId}:${appSecret}`).toString('base64');
      
      const response = await axios.get(`${this.baseURL}/oauth-service/oauth/token`, {
        params: {
          grant_type: 'client_credentials',
          scope: 'Seller_Api'
        },
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return response.data;
      
    } catch (error) {
      if (error.response) {
        throw new Error(`Flipkart auth failed: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Flipkart auth failed: ${error.message}`);
    }
  }

  async validateCredentials(appId, appSecret) {
    // ✅ ADD THIS - Mock validation in test mode
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Validating credentials');
      // Accept any credentials that start with TEST_
      if (appId.startsWith('TEST_')) {
        return { valid: true };
      }
      return { valid: false, error: 'Test credentials must start with TEST_' };
    }

    try {
      await this.generateToken(appId, appSecret);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = new FlipkartAuth();
