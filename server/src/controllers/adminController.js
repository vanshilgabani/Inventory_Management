const User = require('../models/User');
const Subscription = require('../models/Subscription');
const WholesaleBuyer = require('../models/WholesaleBuyer');
const WholesaleOrder = require('../models/WholesaleOrder');
const MarketplaceSale = require('../models/MarketplaceSale');
const DirectSale = require('../models/DirectSale');
const TenantSettings = require('../models/TenantSettings');
const Invoice = require('../models/Invoice');
const logger = require('../utils/logger');

// Get all customers (buyers who have User accounts)
exports.getCustomers = async (req, res) => {
  try {
    const { role, id: userId } = req.user;

    // Only admin can access
    if (role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    // Find all wholesale buyers that belong to this admin/supplier
    // and have a linked User account (customerUserId is not null)
    const wholesaleBuyers = await WholesaleBuyer.find({
      organizationId: userId, // Buyers that belong to this supplier
      customerUserId: { $ne: null }, // Only buyers who have signed up for User account
      isCustomer: true
    })
    .populate('customerUserId', 'name email phone businessName companyName createdAt syncPreference')
    .lean();

    console.log('Found wholesale buyers:', wholesaleBuyers.length);

    if (wholesaleBuyers.length === 0) {
      return res.json({
        success: true,
        data: {
          customers: [],
          stats: {
            totalCustomers: 0,
            activeSubscriptions: 0,
            trialUsers: 0,
            totalOrdersThisMonth: 0,
            estimatedRevenue: 0
          }
        }
      });
    }

    // Get detailed stats for each customer
    const customersWithDetails = await Promise.all(
      wholesaleBuyers.map(async (buyer) => {
        const customerUser = buyer.customerUserId;
        if (!customerUser || !customerUser._id) {
          console.warn(`⚠️  Skipping buyer ${buyer.businessName} - customerUserId didn't populate`);
          return null;
        }
        const customerOrgId = customerUser._id; // Their organization ID

        // Get subscription
        const subscription = await Subscription.findOne({
          organizationId: customerOrgId
        }).select('planType status trialEndDate trialStartDate yearlyEndDate orderBasedStartDate pricePerOrder').lean();

        // Get current month date range
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        // Count orders this month (marketplace + direct + wholesale)
        const [marketplaceCount, directCount, wholesaleCount] = await Promise.all([
          MarketplaceSale.countDocuments({
            organizationId: customerOrgId,
            deletedAt: null,
            saleDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
          }),
          DirectSale.countDocuments({
            organizationId: customerOrgId,
            deletedAt: null,
            saleDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
          }),
          WholesaleOrder.countDocuments({
            organizationId: customerOrgId,
            deletedAt: null,
            orderDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
          })
        ]);

        const totalOrdersThisMonth = marketplaceCount + directCount + wholesaleCount;

        // Calculate estimated bill based on subscription plan
        let estimatedBill = 0;
        let pricePerOrder = 0;

        if (subscription) {
          if (subscription.planType === 'trial') {
            // Trial users pay nothing - ZERO revenue
            estimatedBill = 0;
            pricePerOrder = 0;
            
          } else if (subscription.planType === 'order-based') {
          // Order-based: Only count orders AFTER plan started
          pricePerOrder = subscription.pricePerOrder || 0.5;
          
          // Get when they switched to order-based plan
          const planStartDate = subscription.orderBasedStartDate;
          
          if (planStartDate) {
            // Count orders created AFTER switching (use createdAt, not saleDate)
            const [marketplaceAfter, directAfter, wholesaleAfter] = await Promise.all([
              MarketplaceSale.countDocuments({
                organizationId: customerOrgId,
                deletedAt: null,
                createdAt: { $gte: new Date(planStartDate) }
              }),
              DirectSale.countDocuments({
                organizationId: customerOrgId,
                deletedAt: null,
                createdAt: { $gte: new Date(planStartDate) }
              }),
              WholesaleOrder.countDocuments({
                organizationId: customerOrgId,
                deletedAt: null,
                createdAt: { $gte: new Date(planStartDate) }
              })
            ]);
            
            const paidOrders = marketplaceAfter + directAfter + wholesaleAfter;
            estimatedBill = paidOrders * pricePerOrder;
          } else {
            estimatedBill = 0;
          }
        }
        else if (subscription.planType === 'yearly' || subscription.planType === 'monthly') {
            // Yearly/Monthly - already paid upfront, no per-order charges
            estimatedBill = 0;
            pricePerOrder = 0;
          }
        } else {
          // No subscription
          estimatedBill = 0;
          pricePerOrder = 0;
        }

        // ✅ Calculate breakdown for display
        let chargeableOrders = 0;
        let unchargeableOrders = 0;

        if (subscription?.status === 'trial' || subscription?.planType === 'trial') {
          // All orders during trial are FREE
          chargeableOrders = 0;
          unchargeableOrders = totalOrdersThisMonth;
        } else if (subscription?.planType === 'order-based') {
          // Calculate paid orders (after plan started)
          chargeableOrders = Math.round(estimatedBill / (pricePerOrder || 0.5));
          unchargeableOrders = totalOrdersThisMonth - chargeableOrders;
        } else {
          chargeableOrders = 0;
          unchargeableOrders = 0;
        }

        // Get last month's order count
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        const [lastMarketplace, lastDirect, lastWholesale] = await Promise.all([
          MarketplaceSale.countDocuments({
            organizationId: customerOrgId,
            deletedAt: null,
            saleDate: { $gte: lastMonthStart, $lte: lastMonthEnd }
          }),
          DirectSale.countDocuments({
            organizationId: customerOrgId,
            deletedAt: null,
            saleDate: { $gte: lastMonthStart, $lte: lastMonthEnd }
          }),
          WholesaleOrder.countDocuments({
            organizationId: customerOrgId,
            deletedAt: null,
            orderDate: { $gte: lastMonthStart, $lte: lastMonthEnd }
          })
        ]);

        const lastMonthOrders = lastMarketplace + lastDirect + lastWholesale;

        // Calculate last month bill from actual invoices
        let lastMonthBill = 0;

        // Get last paid invoice
        const Invoice = require('../models/Invoice');
        const lastInvoice = await Invoice.findOne({
          userId: customerOrgId,
          status: 'paid',
          paidAt: { $exists: true }
        })
        .sort({ paidAt: -1 })
        .select('totalAmount')
        .lean();

        if (lastInvoice) {
          lastMonthBill = lastInvoice.totalAmount;
        } else if (subscription && subscription.planType === 'order-based') {
          // Fallback: Calculate from last month orders for order-based
          lastMonthBill = lastMonthOrders * pricePerOrder;
        }

        // Get tenant settings (for sidebar permissions)
        const tenantSettings = await TenantSettings.findOne({
          organizationId: customerOrgId
        }).select('allowedSidebarItems').lean();

        // Calculate next bill date (1st of next month)
        let nextBillDate;

        if (subscription) {
          if (subscription.planType === 'yearly') {
            // Yearly plan: Next bill is 1 year from start date (renewal date)
            nextBillDate = subscription.yearlyEndDate;
          } else if (subscription.planType === 'order-based') {
            // Order-based: Monthly billing on 1st of next month
            nextBillDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          } else if (subscription.planType === 'trial') {
            // Trial: Next bill is after trial ends (or upgrade)
            nextBillDate = subscription.trialEndDate;
          } else {
            // Default: 1st of next month
            nextBillDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          }
        } else {
          nextBillDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }

        let statusLabel = 'No Subscription';
        let statusColor = 'gray';
        let daysRemaining = null;

        if (subscription) {
          if (subscription.status === 'trial') {
            const trialEnd = new Date(subscription.trialEndDate);
            daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
            statusLabel = `Trial (${daysRemaining} days left)`;
            statusColor = 'blue';
            
          } else if (subscription.status === 'active') {
            // ✅ FIXED: Check planType properly
            if (subscription.planType === 'order-based') {
              statusLabel = 'Order-Based';
              statusColor = 'purple';
            } else if (subscription.planType === 'yearly') {
              statusLabel = 'Yearly Active';
              statusColor = 'green';
            } else if (subscription.planType === 'monthly') {
              statusLabel = 'Monthly Active';
              statusColor = 'green';
            }
            
          } else if (subscription.status === 'expired') {
            statusLabel = 'Expired';
            statusColor = 'red';
          }
        }

        return {
          _id: customerUser._id,
          name: customerUser.name || buyer.name,
          email: customerUser.email || buyer.email,
          phone: customerUser.phone || buyer.mobile,
          businessName: buyer.businessName || customerUser.businessName,
          companyName: customerUser.companyName || buyer.businessName,
          createdAt: customerUser.createdAt,
          linkedSupplier: true, // They are linked through WholesaleBuyer
          syncPreference: customerUser.syncPreference || 'direct',
          subscription: {
            ...subscription,
            statusLabel,
            statusColor,
            daysRemaining
          },
          billing: {
            currentMonth: {
              marketplace: marketplaceCount,
              direct: directCount,
              wholesale: wholesaleCount,
              total: totalOrdersThisMonth,
              estimatedAmount: estimatedBill,
              // ✅ NEW: Show breakdown of chargeable vs unchargeable
              breakdown: {
                chargeable: chargeableOrders,
                unchargeable: unchargeableOrders,
              }
            },
            lastMonth: {
              total: lastMonthOrders,
              amount: lastMonthBill
            },
            nextBillDate
          },
          allowedSidebarItems: tenantSettings?.allowedSidebarItems || ['dashboard', 'inventory', 'marketplace-sales', 'settings']
        };
      })
    );

    // ✅ Filter out null values (buyers with missing users)
    const validCustomers = customersWithDetails.filter(c => c !== null);

    const stats = {
      totalCustomers: validCustomers.length,
      activeSubscriptions: validCustomers.filter(c => c.subscription?.status === 'active').length,
      trialUsers: validCustomers.filter(c => c.subscription?.status === 'trial').length,
      totalOrdersThisMonth: validCustomers.reduce((sum, c) => sum + c.billing.currentMonth.total, 0),
      estimatedRevenue: validCustomers.reduce((sum, c) => sum + c.billing.currentMonth.estimatedAmount, 0)
    };

    logger.info('Fetched customer list', { 
      adminId: userId, 
      totalCustomers: validCustomers.length 
    });

    res.json({
      success: true,
      data: {
        customers: validCustomers,
        stats
      }
    });

  } catch (error) {
    console.error('Get customers error:', error);
    logger.error('Get customers failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error.message
    });
  }
};

// Update sidebar permissions for a customer
exports.updateSidebarPermissions = async (req, res) => {
  try {
    const { customerId } = req.params; // Customer's user ID
    const { allowedSidebarItems } = req.body;

    // Verify admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    // Verify this customer belongs to this supplier
    const wholesaleBuyer = await WholesaleBuyer.findOne({
      customerUserId: customerId,
      organizationId: req.user.id // Your organization
    });

    if (!wholesaleBuyer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Customer not found or not linked to you' 
      });
    }

    // ✅ Update TenantSettings for CUSTOMER's organizationId
    const tenantSettings = await TenantSettings.findOneAndUpdate(
      { organizationId: customerId }, // Customer's org ID (their user ID)
      {
        $set: {
          allowedSidebarItems,
          updatedAt: new Date()
        },
        $setOnInsert: {
          userId: customerId,
          organizationId: customerId, // Same as userId for admins
          inventoryMode: 'reserved',
          enabledModules: ['inventory', 'marketplace-sales'],
          createdAt: new Date()
        }
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: 'Sidebar permissions updated successfully',
      data: {
        allowedSidebarItems: tenantSettings.allowedSidebarItems
      }
    });
  } catch (error) {
    console.error('Update sidebar permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update permissions',
      error: error.message
    });
  }
};

// 🆕 FIXED: Update customer user's sync preference (not buyer)
exports.updateBuyerSyncPreference = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { syncPreference } = req.body;

    // Validate sync preference
    if (!['direct', 'manual'].includes(syncPreference)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sync preference. Must be "direct" or "manual"'
      });
    }

    // ✅ UPDATE: Update the User model (not WholesaleBuyer)
    const customerUser = await User.findByIdAndUpdate(
      customerId,
      { syncPreference },
      { new: true }
    ).select('syncPreference name email');

    if (!customerUser) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // ✅ ALSO update the WholesaleBuyer record (for sync logic)
    const buyer = await WholesaleBuyer.findOne({
      customerTenantId: customerId,
      organizationId: req.user.organizationId
    });

    if (buyer) {
      buyer.syncPreference = syncPreference;
      await buyer.save();
    }

    console.log(`✅ Updated sync preference for ${customerUser.name} to: ${syncPreference}`);

    res.json({
      success: true,
      message: 'Sync preference updated successfully',
      data: {
        customerId: customerUser._id,
        customerName: customerUser.name,
        syncPreference: customerUser.syncPreference
      }
    });
  } catch (error) {
    console.error('Error updating sync preference:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sync preference',
      error: error.message
    });
  }
};

// 🆕 NEW: Get customer details with sync preference
exports.getCustomerDetails = async (req, res) => {
  try {
    const { customerId } = req.params;
    const supplierOrgId = req.user.organizationId;

    // Get customer user
    const customerUser = await User.findById(customerId)
      .select('name email businessName phone organizationId isActive subscription')
      .lean();

    if (!customerUser) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Find corresponding buyer record
    const buyer = await WholesaleBuyer.findOne({
      customerTenantId: customerId,
      organizationId: supplierOrgId
    }).lean();

    res.json({
      success: true,
      data: {
        ...customerUser,
        syncPreference: buyer?.syncPreference || 'direct',
        buyerId: buyer?._id,
        buyerMobile: buyer?.mobile
      }
    });

  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer details',
      error: error.message
    });
  }
};

// Add this new function to fetch payment requests filtered by organization
exports.getPaymentRequests = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const adminOrgId = req.user.organizationId || req.user.id;

    // ✅ FIX: Filter payment requests by organizationId
    // Only show requests from customers linked to this admin/supplier
    const query = {
      organizationId: adminOrgId,
      status
    };

    const requests = await ManualPaymentRequest.find(query)
      .populate('userId', 'name email phone businessName')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        requests: requests.map(req => ({
          ...req,
          userDetails: {
            name: req.userId?.name || req.userDetails?.name,
            email: req.userId?.email || req.userDetails?.email,
            phone: req.userId?.phone || req.userDetails?.phone,
            businessName: req.userId?.businessName || req.userDetails?.businessName
          }
        }))
      }
    });
  } catch (error) {
    console.error('Get payment requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment requests',
      error: error.message
    });
  }
};