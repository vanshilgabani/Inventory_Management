// utils/pricingUtils.js
const PRICING = {
  yearly: parseFloat(process.env.YEARLY_PLAN_PRICE) || 5999,
  monthly: parseFloat(process.env.MONTHLY_PLAN_PRICE) || 999,
  orderBased: parseFloat(process.env.ORDER_BASED_PRICE) || 0.5,
};

const getPlanPrice = (planType) => {
  const prices = {
    yearly: PRICING.yearly,
    monthly: PRICING.monthly,
    'order-based': 0,
  };
  return prices[planType] || 0;
};

// ✅ Issue 5 fixed: no mutation of `now`
const calculateProration = (subscription, newPlanType) => {
  const now = new Date();

  if (subscription.planType === 'trial') {
    return { proratedAmount: 0, fullAmount: getPlanPrice(newPlanType), credited: 0 };
  }

  if (subscription.planType === 'order-based' && ['monthly', 'yearly'].includes(newPlanType)) {
    return { proratedAmount: 0, fullAmount: getPlanPrice(newPlanType), credited: 0 };
  }

  // monthly → yearly upgrade with credit
  if (subscription.planType === 'monthly' && newPlanType === 'yearly') {
    const monthlyEndDate = subscription.monthlyEndDate || new Date();
    const daysRemaining = Math.max(0, Math.ceil((monthlyEndDate - now) / (1000 * 60 * 60 * 24)));
    const unusedCredit = (daysRemaining / 30) * PRICING.monthly;
    const finalAmount = Math.max(0, PRICING.yearly - unusedCredit);

    // ✅ Fixed: use a copy, never mutate `now`
    const expiryDate = new Date(now);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    return {
      proratedAmount: unusedCredit,
      fullAmount: PRICING.yearly,
      credited: unusedCredit,
      daysRemaining,
      finalAmount,
      newExpiryDate: expiryDate,
    };
  }

  // yearly renewal
  if (subscription.planType === 'yearly' && newPlanType === 'yearly') {
    const yearlyEndDate = subscription.yearlyEndDate;
    const isExpired = !yearlyEndDate || now > yearlyEndDate;

    if (isExpired) {
      const expiryDate = new Date(now);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      return {
        proratedAmount: 0, fullAmount: PRICING.yearly, credited: 0,
        isRenewal: true, newStartDate: now, newExpiryDate: expiryDate,
      };
    } else {
      const newExpiry = new Date(yearlyEndDate);
      newExpiry.setFullYear(newExpiry.getFullYear() + 1);
      return {
        proratedAmount: 0, fullAmount: PRICING.yearly, credited: 0,
        isRenewal: true, currentExpiryDate: yearlyEndDate, newExpiryDate: newExpiry,
      };
    }
  }

  // monthly renewal
  if (subscription.planType === 'monthly' && newPlanType === 'monthly') {
    const monthlyEndDate = subscription.monthlyEndDate;
    const isExpired = !monthlyEndDate || now > monthlyEndDate;

    if (isExpired) {
      const expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      return {
        proratedAmount: 0, fullAmount: PRICING.monthly, credited: 0,
        isRenewal: true, newStartDate: now, newExpiryDate: expiryDate,
      };
    } else {
      const newExpiry = new Date(monthlyEndDate);
      newExpiry.setMonth(newExpiry.getMonth() + 1);
      return {
        proratedAmount: 0, fullAmount: PRICING.monthly, credited: 0,
        isRenewal: true, currentExpiryDate: monthlyEndDate, newExpiryDate: newExpiry,
      };
    }
  }

  return { proratedAmount: 0, fullAmount: getPlanPrice(newPlanType), credited: 0 };
};

module.exports = { PRICING, getPlanPrice, calculateProration };