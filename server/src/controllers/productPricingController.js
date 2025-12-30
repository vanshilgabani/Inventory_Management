const ProductPricing = require('../models/ProductPricing');

// @desc Get all product pricings
// @route GET /api/product-pricing
// @access Private (Admin only)
const getAllPricings = async (req, res) => {
  try {
    const pricings = await ProductPricing.find({ 
      organizationId: req.organizationId 
    }).sort({ design: 1, marketplaceAccount: 1 });
    
    res.json(pricings);
  } catch (error) {
    console.error('Get all pricings error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Get pricing by ID
// @route GET /api/product-pricing/:id
// @access Private (Admin only)
const getPricingById = async (req, res) => {
  try {
    const pricing = await ProductPricing.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });
    
    if (!pricing) {
      return res.status(404).json({ message: 'Pricing not found' });
    }
    
    res.json(pricing);
  } catch (error) {
    console.error('Get pricing by ID error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Get pricing for specific product + account
// @route GET /api/product-pricing/find
// @access Private
const getPricingByProductAndAccount = async (req, res) => {
  try {
    const { design, account } = req.query;
    
    if (!design || !account) {
      return res.status(400).json({ message: 'Design and account are required' });
    }
    
    const pricing = await ProductPricing.findOne({
      design,
      marketplaceAccount: account,
      organizationId: req.organizationId
    });
    
    if (!pricing) {
      return res.status(404).json({ message: 'Pricing configuration not found for this product and account' });
    }
    
    res.json(pricing);
  } catch (error) {
    console.error('Get pricing by product and account error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Get accounts configured for a specific product
// @route GET /api/product-pricing/accounts/:design
// @access Private
const getAccountsForProduct = async (req, res) => {
  try {
    const { design } = req.params;
    
    const pricings = await ProductPricing.find({
      design,
      organizationId: req.organizationId
    }).select('marketplaceAccount marketplaceAccountId');
    
    const accounts = pricings.map(p => ({
      accountName: p.marketplaceAccount,
      accountId: p.marketplaceAccountId
    }));
    
    res.json(accounts);
  } catch (error) {
    console.error('Get accounts for product error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Create product pricing
// @route POST /api/product-pricing
// @access Private (Admin only)
const createPricing = async (req, res) => {
  try {
    const {
      design,
      marketplaceAccount,
      sellingPrice,
      marketplaceFees,
      returnFees,
      costPrice
    } = req.body;
    
    // Check if pricing already exists for this design + account
    const existingPricing = await ProductPricing.findOne({
      design,
      marketplaceAccount,
      organizationId: req.organizationId
    });
    
    if (existingPricing) {
      return res.status(400).json({ 
        message: `Pricing already exists for ${design} on ${marketplaceAccount}. Please edit the existing configuration.` 
      });
    }
    
    // Create new pricing
    const pricing = await ProductPricing.create({
      design,
      marketplaceAccount,
      sellingPrice,
      marketplaceFees,
      returnFees,
      costPrice,
      organizationId: req.organizationId,
      createdBy: req.user?.name || 'Admin'
    });
    
    res.status(201).json(pricing);
  } catch (error) {
    console.error('Create pricing error:', error);
    res.status(400).json({ message: error.message });
  }
};

// @desc Update product pricing
// @route PUT /api/product-pricing/:id
// @access Private (Admin only)
const updatePricing = async (req, res) => {
  try {
    const pricing = await ProductPricing.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });
    
    if (!pricing) {
      return res.status(404).json({ message: 'Pricing not found' });
    }
    
    // Update fields
    const {
      sellingPrice,
      marketplaceFees,
      returnFees,
      costPrice
    } = req.body;
    
    if (sellingPrice !== undefined) pricing.sellingPrice = sellingPrice;
    if (marketplaceFees !== undefined) pricing.marketplaceFees = marketplaceFees;
    if (returnFees !== undefined) pricing.returnFees = returnFees;
    if (costPrice !== undefined) pricing.costPrice = costPrice;
    
    await pricing.save();
    
    res.json(pricing);
  } catch (error) {
    console.error('Update pricing error:', error);
    res.status(400).json({ message: error.message });
  }
};

// @desc Delete product pricing
// @route DELETE /api/product-pricing/:id
// @access Private (Admin only)
const deletePricing = async (req, res) => {
  try {
    const pricing = await ProductPricing.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });
    
    if (!pricing) {
      return res.status(404).json({ message: 'Pricing not found' });
    }
    
    await pricing.deleteOne();
    
    res.json({ message: 'Pricing configuration deleted successfully' });
  } catch (error) {
    console.error('Delete pricing error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllPricings,
  getPricingById,
  getPricingByProductAndAccount,
  getAccountsForProduct,
  createPricing,
  updatePricing,
  deletePricing
};
