const axios = require('axios');

/**
 * State mapping for GST state codes
 */
const stateMapping = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli',
  '27': 'Karnataka', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh',
  '38': 'Ladakh'
};

/**
 * Real GST Verification using RapidAPI (IDFY)
 */
const verifyGST = async (gstNumber) => {
  try {
    const cleanGST = gstNumber.toUpperCase().trim();
    
    // Validate GST format
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstRegex.test(cleanGST)) {
      return {
        success: false,
        error: 'Invalid GST number format. GST must be 15 characters (e.g., 24AAAAA0000A1Z5)'
      };
    }
    
    console.log('🔍 Verifying GST via RapidAPI (IDFY):', cleanGST);
    
    // Check if API key is configured
    if (!process.env.RAPIDAPI_KEY) {
      console.error('❌ RAPIDAPI_KEY not configured');
      return {
        success: false,
        error: 'GST verification service not configured. Please add API key.'
      };
    }
    
    // Extract state code and PAN from GST
    const stateCode = cleanGST.substring(0, 2);
    const pan = cleanGST.substring(2, 12);
    
    // Call RapidAPI IDFY GST Verification
    const response = await axios.post(
      'https://gst-verification.p.rapidapi.com/v3/tasks/sync/verify_with_source/ind_gst_certificate',
      {
        task_id: `gst_verify_${Date.now()}`,
        group_id: 'verification_group',
        data: {
          gstin: cleanGST
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'gst-verification.p.rapidapi.com'
        },
        timeout: 20000
      }
    );
    
    console.log('✅ API Response Status:', response.status);
    
    // Check if verification was successful
    if (response.data && response.data.status === 'completed') {
      const result = response.data.result;
      
      // ✅ FIXED: Correct path to source_output
      const sourceOutput = result.source_output;
      
      if (!sourceOutput) {
        console.error('❌ No source_output in response');
        return {
          success: false,
          error: 'Invalid API response structure'
        };
      }
      
      // Parse address from principal place of business
      const principalPlace = sourceOutput.principal_place_of_business_fields || {};
      const address = principalPlace.principal_place_of_business_address || {};
      
      const addressParts = [
        address.door_number,
        address.building_name,
        address.street,
        address.location,
        address.dst,
        address.state_name,
        address.pincode
      ].filter(Boolean);
      
      const fullAddress = addressParts.length > 0 
        ? addressParts.join(', ')
        : 'Address not available';
      
      const gstDetails = {
        gstNumber: cleanGST,
        businessName: sourceOutput.trade_name || sourceOutput.legal_name || 'N/A',
        legalName: sourceOutput.legal_name || sourceOutput.trade_name || 'N/A',
        tradeName: sourceOutput.trade_name || null,
        pan: pan,
        stateCode: stateCode,
        address: {
          building: address.building_name || address.door_number || '',
          street: address.street || '',
          location: address.location || '',
          district: address.dst || '',
          state: address.state_name || stateMapping[stateCode] || 'Unknown',
          pincode: address.pincode || '',
          fullAddress: fullAddress
        },
        gstStatus: sourceOutput.gstin_status || 'Unknown',
        registrationDate: sourceOutput.date_of_registration 
          ? new Date(sourceOutput.date_of_registration) 
          : null,
        constitutionOfBusiness: sourceOutput.constitution_of_business || null,
        taxpayerType: sourceOutput.taxpayer_type || null,
        natureOfBusiness: sourceOutput.nature_of_business_activity || [],
        lastUpdated: new Date()
      };
      
      console.log('✅ GST Verified Successfully!');
      console.log('   Business Name:', gstDetails.businessName);
      console.log('   Legal Name:', gstDetails.legalName);
      console.log('   Status:', gstDetails.gstStatus);
      console.log('   Address:', gstDetails.address.fullAddress);
      
      return {
        success: true,
        data: gstDetails
      };
    } else {
      console.error('❌ Verification failed:', response.data);
      return {
        success: false,
        error: response.data?.message || 'GST verification failed'
      };
    }
    
  } catch (error) {
    console.error('❌ GST Verification Error:', error.message);
    
    // Handle timeout
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        success: false,
        error: 'GST verification timeout. Please try again.'
      };
    }
    
    // Handle API errors
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      console.error('API Error Response:', JSON.stringify(errorData, null, 2));
      
      if (status === 401 || status === 403) {
        return {
          success: false,
          error: 'Invalid API key or not subscribed. Please check RapidAPI subscription.'
        };
      } else if (status === 404) {
        return {
          success: false,
          error: 'GST number not found in government database'
        };
      } else if (status === 429) {
        return {
          success: false,
          error: 'API rate limit exceeded. Monthly quota reached.'
        };
      } else {
        return {
          success: false,
          error: errorData?.message || `Verification failed (Error ${status})`
        };
      }
    }
    
    return {
      success: false,
      error: error.message || 'Failed to verify GST number. Please try again.'
    };
  }
};

module.exports = {
  verifyGST
};
