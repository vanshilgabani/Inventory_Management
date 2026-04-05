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

    if (role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const orgId = req.user.organizationId || userId;
    const wholesaleBuyers = await WholesaleBuyer.find({
      organizationId: orgId,
      customerUserId: { $ne: null },
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

    const customersWithDetails = await Promise.all(
      wholesaleBuyers.map(async (buyer) => {
        const customerUser = buyer.customerUserId;
        if (!customerUser || !customerUser._id) {
          console.warn(`⚠️  Skipping buyer ${buyer.businessName} - customerUserId didn't populate`);
          return null;
        }
        const customerOrgId = customerUser._id;

        // ✅ FIX 1: Added currentBillingCycle to select
        const subscription = await Subscription.findOne({
          organizationId: customerOrgId
        }).select('planType status trialEndDate trialStartDate yearlyEndDate orderBasedStartDate pricePerOrder currentBillingCycle gracePeriodEndDate monthlyEndDate').lean();

        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

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

        let estimatedBill = 0;
        let pricePerOrder = 0;

        if (subscription) {
          if (subscription.planType === 'trial') {
            estimatedBill = 0;
            pricePerOrder = 0;

          } else if (subscription.planType === 'order-based') {
            pricePerOrder = subscription.pricePerOrder || 0.5;

            // ✅ FIX 2: If current cycle invoice already generated/paid → no unbilled amount
            if (subscription.currentBillingCycle?.invoiceGenerated) {
              estimatedBill = 0;
            } else {
              // ✅ FIX 3: Use currentBillingCycle.startDate, NOT orderBasedStartDate
              // orderBasedStartDate is the original plan start — it never changes
              // currentBillingCycle.startDate resets each month after payment
              const cycleStart = subscription.currentBillingCycle?.startDate
                || subscription.orderBasedStartDate
                || firstDayOfMonth;
              const cycleEnd = subscription.currentBillingCycle?.endDate || lastDayOfMonth;

              const [marketplaceAfter, directAfter, wholesaleAfter] = await Promise.all([
                MarketplaceSale.countDocuments({
                  organizationId: customerOrgId,
                  deletedAt: null,
                  createdAt: { $gte: new Date(cycleStart), $lte: new Date(cycleEnd) }
                }),
                DirectSale.countDocuments({
                  organizationId: customerOrgId,
                  deletedAt: null,
                  createdAt: { $gte: new Date(cycleStart), $lte: new Date(cycleEnd) }
                }),
                WholesaleOrder.countDocuments({
                  organizationId: customerOrgId,
                  deletedAt: null,
                  createdAt: { $gte: new Date(cycleStart), $lte: new Date(cycleEnd) }
                })
              ]);

              const unbilledOrders = marketplaceAfter + directAfter + wholesaleAfter;
              estimatedBill = unbilledOrders * pricePerOrder;
            }

          } else if (subscription.planType === 'yearly' || subscription.planType === 'monthly') {
            estimatedBill = 0;
            pricePerOrder = 0;
          }
        } else {
          estimatedBill = 0;
          pricePerOrder = 0;
        }

        // ✅ Breakdown
        let chargeableOrders = 0;
        let unchargeableOrders = 0;

        if (subscription?.status === 'trial' || subscription?.planType === 'trial') {
          chargeableOrders = 0;
          unchargeableOrders = totalOrdersThisMonth;
        } else if (subscription?.planType === 'order-based') {
          // If invoice already generated for this cycle, nothing is chargeable yet
          const cycleInvoiceGenerated = subscription.currentBillingCycle?.invoiceGenerated;
          chargeableOrders = cycleInvoiceGenerated ? 0 : Math.round(estimatedBill / (pricePerOrder || 0.5));
          unchargeableOrders = totalOrdersThisMonth - chargeableOrders;
        } else {
          chargeableOrders = 0;
          unchargeableOrders = 0;
        }

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

        let lastMonthBill = 0;
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
          lastMonthBill = lastMonthOrders * pricePerOrder;
        }

        const tenantSettings = await TenantSettings.findOne({
          organizationId: customerOrgId
        }).select('allowedSidebarItems').lean();

        let nextBillDate;
        if (subscription) {
          if (subscription.planType === 'yearly') {
            nextBillDate = subscription.yearlyEndDate;
          } else if (subscription.planType === 'order-based') {
            nextBillDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          } else if (subscription.planType === 'trial') {
            nextBillDate = subscription.trialEndDate;
          } else {
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
          } else if (subscription.status === 'grace-period') {
            statusLabel = 'Grace Period';
            statusColor = 'orange';
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
          linkedSupplier: true,
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
      data: { customers: validCustomers, stats }
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
    const orgId = req.user.organizationId || req.user.id;
    const wholesaleBuyer = await WholesaleBuyer.findOne({
      customerUserId: customerId,
      organizationId: orgId   // ← whole org
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

// 🆕 Generate invoice for customer (order-based plan)
exports.generateCustomerInvoice = async (req, res) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customerId } = req.params;
    const adminId = req.user.id;

    // Verify admin access
    if (req.user.role !== 'admin') {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Verify this customer belongs to this admin
    const orgId = req.user.organizationId || adminId;
    const buyer = await WholesaleBuyer.findOne({
      customerUserId: customerId,
      organizationId: orgId 
    }).session(session);

    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Customer not found or not linked to you'
      });
    }

    const subscription = await Subscription.findOne({ 
      userId: customerId 
    }).session(session);

    if (!subscription || subscription.planType !== 'order-based') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Customer is not on order-based plan'
      });
    }

    if (subscription.currentBillingCycle?.invoiceGenerated) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invoice already generated for this billing cycle'
      });
    }

    // Count real orders from database
    const billingStart = subscription.currentBillingCycle?.startDate || 
                         subscription.orderBasedStartDate ||
                         new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    const billingEnd = subscription.currentBillingCycle?.endDate || 
                       new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    console.log('📅 Generating invoice for period:', {
      billingStart: billingStart.toISOString(),
      billingEnd: billingEnd.toISOString()
    });

    // Count orders in billing period (AFTER plan started)
    const [marketplaceCount, directCount, wholesaleCount] = await Promise.all([
      MarketplaceSale.countDocuments({
        organizationId: customerId,
        deletedAt: null,
        createdAt: { 
          $gte: billingStart,
          $lte: billingEnd 
        }
      }),
      DirectSale.countDocuments({
        organizationId: customerId,
        deletedAt: null,
        createdAt: { 
          $gte: billingStart,
          $lte: billingEnd 
        }
      }),
      WholesaleOrder.countDocuments({
        organizationId: customerId,
        deletedAt: null,
        createdAt: { 
          $gte: billingStart,
          $lte: billingEnd 
        }
      })
    ]);

    const ordersCount = marketplaceCount + directCount + wholesaleCount;
    const pricePerOrder = subscription.pricePerOrder;
    const totalAmount = ordersCount * pricePerOrder;

    // Skip if no orders
    if (ordersCount === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'No billable orders in current billing cycle'
      });
    }

    const user = await User.findById(customerId).session(session);
    const now = new Date();
    const gracePeriodEnd = new Date(now);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

    // Generate invoice number
    const userShortId = customerId.toString().slice(-6).toUpperCase();
    const invoiceCount = await Invoice.countDocuments({ userId: customerId }).session(session);
    const invoiceNumber = `INV-${new Date().getFullYear()}-${userShortId}-${String(invoiceCount + 1).padStart(3, '0')}`;

    // Create invoice
    const invoice = await Invoice.create([{
      userId: customerId,
      organizationId: subscription.organizationId,
      invoiceNumber,
      customerName: user.name,
      customerEmail: user.email,
      customerPhone: user.phone,
      billingPeriod: {
        startDate: billingStart,
        endDate: billingEnd,
        month: billingEnd.toLocaleDateString('en-IN', { 
          month: 'long', 
          year: 'numeric' 
        })
      },
      invoiceType: 'order-based',
      planType: 'order-based',
      items: [{
        description: `Orders from ${billingStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to ${billingEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} (${marketplaceCount} marketplace + ${directCount} direct + ${wholesaleCount} wholesale = ${ordersCount} total × ₹${pricePerOrder})`,
        quantity: ordersCount,
        unitPrice: pricePerOrder,
        amount: totalAmount
      }],
      subtotal: totalAmount,
      gstRate: 0,
      cgst: 0,
      sgst: 0,
      totalAmount: totalAmount,
      status: 'generated',
      paymentDueDate: gracePeriodEnd,
      generatedAt: now,
      notes: `Invoice generated by admin for ${ordersCount} billable orders`
    }], { session });

    // Update subscription
    subscription.currentBillingCycle.invoiceGenerated = true;
    subscription.currentBillingCycle.invoiceId = invoice[0]._id;
    subscription.currentBillingCycle.ordersCount = ordersCount;
    subscription.currentBillingCycle.totalAmount = totalAmount;
    subscription.status = 'grace-period';
    subscription.gracePeriodEndDate = gracePeriodEnd;
    subscription.gracePeriodInvoiceId = invoice[0]._id;
    subscription.notificationsSent.invoiceGenerated = true;
    subscription.notificationsSent.gracePeriodStarted = true;

    await subscription.save({ session });
    await session.commitTransaction();

    logger.info('Admin generated invoice for customer', { 
      adminId,
      customerId, 
      invoiceId: invoice[0]._id, 
      ordersCount,
      totalAmount
    });

    res.json({
      success: true,
      message: `Invoice generated successfully for ${ordersCount} orders. Customer has 7 days to pay.`,
      data: { 
        invoice: invoice[0],
        gracePeriodEnd,
        breakdown: {
          marketplace: marketplaceCount,
          direct: directCount,
          wholesale: wholesaleCount,
          total: ordersCount
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Admin invoice generation failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};