const WholesaleBuyer = require('../models/WholesaleBuyer');
const { verifyGST } = require('../utils/gstService');
const mongoose = require('mongoose');

/**
 * Verify GST number and return details
 * POST /api/wholesale/verify-gst
 */
const verifyGSTNumber = async (req, res) => {
  try {
    const { gstNumber } = req.body;
    
    if (!gstNumber || !gstNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: 'GST number is required'
      });
    }
    
    // Call GST verification service
    const result = await verifyGST(gstNumber);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.data
    });
    
  } catch (error) {
    console.error('GST verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify GST number',
      error: error.message
    });
  }
};

/**
 * Get all GST profiles for a buyer
 * GET /api/wholesale/buyers/:buyerId/gst-profiles
 */
const getGSTProfiles = async (req, res) => {
  try {
    const { buyerId } = req.params;
    const organizationId = req.user.organizationId;
    
    const buyer = await WholesaleBuyer.findOne({
      _id: buyerId,
      organizationId
    }).select('name mobile email gstProfiles');
    
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }
    
    // Sort: default first, then by addedAt
    const profiles = buyer.gstProfiles.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return new Date(b.addedAt) - new Date(a.addedAt);
    });
    
    res.json({
      success: true,
      data: {
        buyer: {
          id: buyer._id,
          name: buyer.name,
          mobile: buyer.mobile,
          email: buyer.email
        },
        profiles
      }
    });
    
  } catch (error) {
    console.error('Get GST profiles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch GST profiles',
      error: error.message
    });
  }
};

/**
 * Add new GST profile to buyer
 * POST /api/wholesale/buyers/:buyerId/gst-profiles
 */
const addGSTProfile = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { buyerId } = req.params;
    const organizationId = req.user.organizationId;
    const { gstNumber, isDefault, notes } = req.body;
    
    if (!gstNumber) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'GST number is required'
      });
    }
    
    const buyer = await WholesaleBuyer.findOne({
      _id: buyerId,
      organizationId
    }).session(session);
    
    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }
    
    // Check if GST already exists
    const cleanGST = gstNumber.toUpperCase().trim();
    const exists = buyer.gstProfiles.some(
      profile => profile.gstNumber === cleanGST
    );
    
    if (exists) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'This GST number already exists for this buyer'
      });
    }
    
    // Verify GST and fetch details
    const gstResult = await verifyGST(gstNumber);
    
    if (!gstResult.success) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: gstResult.error
      });
    }
    
    // If this is set as default, unset all others
    if (isDefault) {
      buyer.gstProfiles.forEach(profile => {
        profile.isDefault = false;
      });
    }
    
    // Generate profile ID
    const profileId = `gst_${Date.now()}`;
    
    // Add new profile
    const newProfile = {
      profileId,
      gstNumber: gstResult.data.gstNumber,
      businessName: gstResult.data.businessName,
      legalName: gstResult.data.legalName,
      tradeName: gstResult.data.tradeName,
      pan: gstResult.data.pan,
      address: gstResult.data.address,
      stateCode: gstResult.data.stateCode,
      gstStatus: gstResult.data.gstStatus,
      registrationDate: gstResult.data.registrationDate,
      isDefault: isDefault || false,
      isActive: true,
      notes: notes || '',
      addedAt: new Date(),
      usageCount: 0
    };
    
    buyer.gstProfiles.push(newProfile);
    await buyer.save({ session });
    
    await session.commitTransaction();
    
    console.log('GST profile added:', {
      buyerId: buyer._id,
      gstNumber: newProfile.gstNumber
    });
    
    res.status(201).json({
      success: true,
      message: 'GST profile added successfully',
      data: newProfile
    });
    
  } catch (error) {
    await session.abortTransaction();
    console.error('Add GST profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add GST profile',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

/**
 * Update GST profile (only user-editable fields)
 * PUT /api/wholesale/buyers/:buyerId/gst-profiles/:profileId
 */
const updateGSTProfile = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { buyerId, profileId } = req.params;
    const organizationId = req.user.organizationId;
    const { isDefault, isActive, notes } = req.body;
    
    const buyer = await WholesaleBuyer.findOne({
      _id: buyerId,
      organizationId
    }).session(session);
    
    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }
    
    const profile = buyer.gstProfiles.find(p => p.profileId === profileId);
    
    if (!profile) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'GST profile not found'
      });
    }
    
    // Update only allowed fields
    if (isDefault === true) {
      buyer.gstProfiles.forEach(p => {
        p.isDefault = false;
      });
      profile.isDefault = true;
    } else if (isDefault === false) {
      profile.isDefault = false;
    }
    
    if (isActive !== undefined) {
      profile.isActive = isActive;
    }
    
    if (notes !== undefined) {
      profile.notes = notes;
    }
    
    await buyer.save({ session });
    await session.commitTransaction();
    
    console.log('GST profile updated:', {
      buyerId: buyer._id,
      profileId
    });
    
    res.json({
      success: true,
      message: 'GST profile updated successfully',
      data: profile
    });
    
  } catch (error) {
    await session.abortTransaction();
    console.error('Update GST profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update GST profile',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

/**
 * Delete GST profile
 * DELETE /api/wholesale/buyers/:buyerId/gst-profiles/:profileId
 */
const deleteGSTProfile = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { buyerId, profileId } = req.params;
    const organizationId = req.user.organizationId;
    
    const buyer = await WholesaleBuyer.findOne({
      _id: buyerId,
      organizationId
    }).session(session);
    
    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }
    
    const profileIndex = buyer.gstProfiles.findIndex(
      p => p.profileId === profileId
    );
    
    if (profileIndex === -1) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'GST profile not found'
      });
    }
    
    // Remove profile
    buyer.gstProfiles.splice(profileIndex, 1);
    await buyer.save({ session });
    
    await session.commitTransaction();
    
    console.log('GST profile deleted:', {
      buyerId: buyer._id,
      profileId
    });
    
    res.json({
      success: true,
      message: 'GST profile deleted successfully'
    });
    
  } catch (error) {
    await session.abortTransaction();
    console.error('Delete GST profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete GST profile',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

/**
 * Refresh GST profile data from API
 * POST /api/wholesale/buyers/:buyerId/gst-profiles/:profileId/refresh
 */
const refreshGSTProfile = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { buyerId, profileId } = req.params;
    const organizationId = req.user.organizationId;
    
    const buyer = await WholesaleBuyer.findOne({
      _id: buyerId,
      organizationId
    }).session(session);
    
    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }
    
    const profile = buyer.gstProfiles.find(p => p.profileId === profileId);
    
    if (!profile) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'GST profile not found'
      });
    }
    
    // Re-fetch from GST API
    const gstResult = await verifyGST(profile.gstNumber);
    
    if (!gstResult.success) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: gstResult.error
      });
    }
    
    // Update profile with fresh data
    profile.businessName = gstResult.data.businessName;
    profile.legalName = gstResult.data.legalName;
    profile.tradeName = gstResult.data.tradeName;
    profile.address = gstResult.data.address;
    profile.gstStatus = gstResult.data.gstStatus;
    
    await buyer.save({ session });
    await session.commitTransaction();
    
    console.log('GST profile refreshed:', {
      buyerId: buyer._id,
      profileId
    });
    
    res.json({
      success: true,
      message: 'GST profile refreshed successfully',
      data: profile
    });
    
  } catch (error) {
    await session.abortTransaction();
    console.error('Refresh GST profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh GST profile',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
  verifyGSTNumber,
  getGSTProfiles,
  addGSTProfile,
  updateGSTProfile,
  deleteGSTProfile,
  refreshGSTProfile
};
