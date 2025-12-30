const ChallanSettings = require('../models/ChallanSettings');

// @desc Get challan settings
// @route GET /api/challan-settings
// @access Private
const getChallanSettings = async (req, res) => {
  try {
    // ✅ FIXED: Filter by organizationId
    let settings = await ChallanSettings.findOne({ organizationId: req.organizationId });
    
    // ✅ FIXED: Return empty object if no settings found
    if (!settings) {
      return res.json({
        businessName: '',
        address: '',
        email: '',
        mobile: '',
        gstNumber: '',
        termsConditions: [],
        signatureText: 'Authorized Signatory'
      });
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Update challan settings
// @route PUT /api/challan-settings
// @access Private (Admin only)
const updateChallanSettings = async (req, res) => {
  try {
    const {
      businessName,
      address,
      email,
      mobile,
      gstNumber,
      termsConditions,
      signatureText
    } = req.body;

    // ✅ FIXED: Filter by organizationId
    let settings = await ChallanSettings.findOne({ organizationId: req.organizationId });

    if (settings) {
      // Update existing settings
      settings.businessName = businessName || settings.businessName;
      settings.address = address || settings.address;
      settings.email = email || settings.email;
      settings.mobile = mobile || settings.mobile;
      settings.gstNumber = gstNumber || settings.gstNumber;
      settings.termsConditions = termsConditions || settings.termsConditions;
      settings.signatureText = signatureText || settings.signatureText;

      await settings.save();
    } else {
      // ✅ FIXED: Create new settings with organizationId and NO defaults
      settings = await ChallanSettings.create({
        organizationId: req.organizationId,
        businessName: businessName || '',
        address: address || '',
        email: email || '',
        mobile: mobile || '',
        gstNumber: gstNumber || '',
        termsConditions: termsConditions || [],
        signatureText: signatureText || 'Authorized Signatory'
      });
    }
    
    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getChallanSettings,
  updateChallanSettings
};
