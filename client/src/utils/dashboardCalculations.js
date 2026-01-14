// src/utils/dashboardCalculations.js

import { format, differenceInDays, subDays, startOfDay } from 'date-fns';

// ========================================
// FORMAT CURRENCY
// ========================================
export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0';
  }
  const numAmount = Number(amount);
  if (numAmount >= 10000000) {
    return `₹${(numAmount / 10000000).toFixed(2)}Cr`;
  } else if (numAmount >= 100000) {
    return `₹${(numAmount / 100000).toFixed(1)}L`;
  } else if (numAmount >= 1000) {
    return `₹${(numAmount / 1000).toFixed(1)}k`;
  }
  return `₹${numAmount.toFixed(0)}`;
};

// ========================================
// TIME AGO HELPER
// ========================================
export const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

// ========================================
// STOCK ALERTS CALCULATOR
// ========================================
export const calculateStockAlerts = (products, wholesaleOrders, directSales, globalThreshold = 10) => {
  const outOfStock = [];
  const lowStock = [];
  const salesVelocity = calculateWDSalesVelocity(wholesaleOrders, directSales, 30);

  products.forEach(product => {
    product.colors?.forEach(color => {
      color.sizes?.forEach(size => {
        const key = `${product.design}-${color.color}-${size.size}`;
        const velocity = salesVelocity[key] || 0;
        const avgPerMonth = velocity;
        const avgPerDay = velocity / 30;
        const daysLeft = avgPerDay > 0 ? Math.round(size.currentStock / avgPerDay) : 999;
        const lastSale = findLastSaleDate(product.design, color.color, size.size, wholesaleOrders, directSales);

        const variant = {
          design: product.design,
          color: color.color,
          size: size.size,
          currentStock: size.currentStock,
          avgPerMonth: Math.round(avgPerMonth),
          avgPerDay: avgPerDay.toFixed(1),
          daysLeft: daysLeft === 999 ? '∞' : daysLeft,
          lastSold: lastSale,
          wholesalePrice: color.wholesalePrice || 0,
          reorderPoint: size.reorderPoint || globalThreshold,
          priority: velocity > 15 ? '🔥🔥' : velocity > 10 ? '🔥' : '⚠️',
          velocityScore: velocity
        };

        if (size.currentStock === 0 && velocity > 0) {
          outOfStock.push(variant);
        } else if (size.currentStock > 0 && size.currentStock <= (size.reorderPoint || globalThreshold)) {
          lowStock.push(variant);
        }
      });
    });
  });

  outOfStock.sort((a, b) => b.velocityScore - a.velocityScore);
  lowStock.sort((a, b) => (b.velocityScore * (a.reorderPoint - a.currentStock)) - (a.velocityScore * (b.reorderPoint - b.currentStock)));

  return { outOfStock, lowStock };
};

// ========================================
// FIND LAST SALE DATE
// ========================================
const findLastSaleDate = (design, color, size, wholesaleOrders, directSales) => {
  let lastDate = null;

  wholesaleOrders.forEach(order => {
    order.items?.forEach(item => {
      if (item.design === design && item.color === color && item.size === size) {
        const orderDate = new Date(order.createdAt);
        if (!lastDate || orderDate > lastDate) {
          lastDate = orderDate;
        }
      }
    });
  });

  directSales.forEach(sale => {
    sale.items?.forEach(item => {
      if (item.design === design && item.color === color && item.size === size) {
        const saleDate = new Date(sale.createdAt);
        if (!lastDate || saleDate > lastDate) {
          lastDate = saleDate;
        }
      }
    });
  });

  return lastDate;
};

// ========================================
// SALES VELOCITY (W+D ONLY)
// ========================================
export const calculateWDSalesVelocity = (wholesaleOrders, directSales, days = 30) => {
  const now = new Date();
  const startDate = subDays(now, days);
  const velocity = {};

  wholesaleOrders
    .filter(order => new Date(order.createdAt) >= startDate && order.status !== 'cancelled')
    .forEach(order => {
      order.items?.forEach(item => {
        const key = `${item.design}-${item.color}-${item.size}`;
        velocity[key] = (velocity[key] || 0) + item.quantity;
      });
    });

  directSales
    .filter(sale => new Date(sale.createdAt) >= startDate)
    .forEach(sale => {
      sale.items?.forEach(item => {
        const key = `${item.design}-${item.color}-${item.size}`;
        velocity[key] = (velocity[key] || 0) + item.quantity;
      });
    });

  return velocity;
};

// ========================================
// DESIGN PERFORMANCE (W+D ONLY)
// ========================================
export const calculateDesignPerformance = (products, wholesaleOrders, directSales, days = 30) => {
  const now = new Date();
  const startDate = subDays(now, days);
  const salesMap = {};

  wholesaleOrders
    .filter(o => new Date(o.createdAt) >= startDate && o.status !== 'cancelled')
    .forEach(order => {
      order.items?.forEach(item => {
        const key = `${item.design}-${item.color}-${item.size}`;
        if (!salesMap[key]) {
          salesMap[key] = {
            design: item.design,
            color: item.color,
            size: item.size,
            sold: 0,
            revenue: 0
          };
        }
        salesMap[key].sold += item.quantity;
        salesMap[key].revenue += item.quantity * item.price;
      });
    });

  directSales
    .filter(s => new Date(s.createdAt) >= startDate)
    .forEach(sale => {
      sale.items?.forEach(item => {
        const key = `${item.design}-${item.color}-${item.size}`;
        if (!salesMap[key]) {
          salesMap[key] = {
            design: item.design,
            color: item.color,
            size: item.size,
            sold: 0,
            revenue: 0
          };
        }
        salesMap[key].sold += item.quantity;
        salesMap[key].revenue += item.quantity * item.price;
      });
    });

  const performanceArray = Object.values(salesMap).map(item => {
    const product = products.find(p => p.design === item.design);
    const colorObj = product?.colors?.find(c => c.color === item.color);
    const sizeObj = colorObj?.sizes?.find(s => s.size === item.size);

    return {
      ...item,
      currentStock: sizeObj?.currentStock || 0,
      velocityScore: item.sold,
      status: item.sold > 50 ? '🔥' : item.sold > 30 ? '⭐' : item.sold > 10 ? '🟢' : '🟡'
    };
  });

  products.forEach(product => {
    product.colors?.forEach(color => {
      color.sizes?.forEach(size => {
        if (size.currentStock > 0) {
          const key = `${product.design}-${color.color}-${size.size}`;
          if (!salesMap[key]) {
            performanceArray.push({
              design: product.design,
              color: color.color,
              size: size.size,
              sold: 0,
              revenue: 0,
              currentStock: size.currentStock,
              velocityScore: 0,
              status: '🐌'
            });
          }
        }
      });
    });
  });

  return performanceArray.sort((a, b) => b.sold - a.sold);
};

// ========================================
// ✅ REVENUE BREAKDOWN (FIXED - USE SETTLEMENTS FOR MARKETPLACE)
// ========================================
export const calculateRevenueBreakdown = (settlements, wholesaleOrders, directSales, monthFilter = 'current') => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let startDate, endDate;

  if (monthFilter === 'current') {
    startDate = new Date(currentYear, currentMonth, 1);
    endDate = new Date(currentYear, currentMonth + 1, 0);
  } else if (monthFilter === 'last') {
    startDate = new Date(currentYear, currentMonth - 1, 1);
    endDate = new Date(currentYear, currentMonth, 0);
  }

  // ✅ FIXED: Calculate marketplace revenue from SETTLEMENTS, not MarketplaceSales
  const marketplaceRevenue = settlements
    .filter(s => {
      const date = new Date(s.settlementDate);
      return date >= startDate && date <= endDate;
    })
    .reduce((sum, s) => sum + (s.settlementAmount || 0), 0);

  const wholesaleRevenue = wholesaleOrders
    .filter(o => {
      const date = new Date(o.createdAt);
      return date >= startDate && date <= endDate && o.status !== 'cancelled';
    })
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const directRevenue = directSales
    .filter(s => {
      const date = new Date(s.createdAt);
      return date >= startDate && date <= endDate;
    })
    .reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  const total = marketplaceRevenue + wholesaleRevenue + directRevenue;

  return {
    total,
    marketplace: {
      amount: marketplaceRevenue,
      percentage: total > 0 ? ((marketplaceRevenue / total) * 100).toFixed(1) : '0.0'
    },
    wholesale: {
      amount: wholesaleRevenue,
      percentage: total > 0 ? ((wholesaleRevenue / total) * 100).toFixed(1) : '0.0'
    },
    direct: {
      amount: directRevenue,
      percentage: total > 0 ? ((directRevenue / total) * 100).toFixed(1) : '0.0'
    }
  };
};

// ========================================
// ✅ WEEKLY REVENUE TREND (FIXED - USE SETTLEMENTS)
// ========================================
export const calculateWeeklyRevenueTrend = (settlements, wholesaleOrders, directSales, weeks = 4) => {
  const weeklyData = [];
  const now = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const weekEnd = subDays(now, i * 7);
    const weekStart = subDays(weekEnd, 7);

    // ✅ FIXED: Use settlements for marketplace revenue
    const marketplaceRev = settlements
      .filter(s => {
        const date = new Date(s.settlementDate);
        return date >= weekStart && date < weekEnd;
      })
      .reduce((sum, s) => sum + (s.settlementAmount || 0), 0);

    const wholesaleRev = wholesaleOrders
      .filter(o => {
        const date = new Date(o.createdAt);
        return date >= weekStart && date < weekEnd && o.status !== 'cancelled';
      })
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const directRev = directSales
      .filter(s => {
        const date = new Date(s.createdAt);
        return date >= weekStart && date < weekEnd;
      })
      .reduce((sum, s) => sum + (s.totalAmount || 0), 0);

    weeklyData.push({
      week: `W${weeks - i}`,
      total: marketplaceRev + wholesaleRev + directRev,
      marketplace: marketplaceRev,
      wholesale: wholesaleRev,
      direct: directRev
    });
  }

  return weeklyData;
};

// ========================================
// PENDING COLLECTIONS
// ========================================
export const calculatePendingCollections = (wholesaleOrders, monthlyBills) => {
  const pending = [];

  wholesaleOrders
    .filter(o => o.amountDue > 0)
    .forEach(order => {
      const daysOverdue = Math.floor((new Date() - new Date(order.createdAt)) / (1000 * 60 * 60 * 24));
      pending.push({
        buyerName: order.businessName || order.buyerName,
        amount: order.amountDue,
        daysOverdue,
        type: 'order',
        orderId: order._id,
        priority: daysOverdue > 21 ? '🔴' : daysOverdue > 14 ? '🟡' : '🟢',
        priorityScore: order.amountDue * daysOverdue
      });
    });

  monthlyBills
    .filter(b => (b.status === 'overdue' || b.status === 'partial' || b.status === 'generated') && b.financials?.balanceDue > 0)
    .forEach(bill => {
      const dueDate = new Date(bill.paymentDueDate);
      const daysOverdue = Math.floor((new Date() - dueDate) / (1000 * 60 * 60 * 24));
      pending.push({
        buyerName: bill.buyer?.businessName || bill.buyer?.name || 'Unknown',
        amount: bill.financials.balanceDue,
        daysOverdue: daysOverdue > 0 ? daysOverdue : 0,
        type: 'bill',
        billId: bill._id,
        billNumber: bill.billNumber,
        priority: daysOverdue > 14 ? '🔴' : daysOverdue > 7 ? '🟡' : '🟢',
        priorityScore: bill.financials.balanceDue * (daysOverdue > 0 ? daysOverdue : 1)
      });
    });

  return pending.sort((a, b) => b.priorityScore - a.priorityScore);
};

// ========================================
// MONTHLY BILLS SUMMARY
// ========================================
export const calculateMonthlyBillsSummary = (monthlyBills, month = 'current') => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let targetMonth, targetYear;
  if (month === 'current') {
    targetMonth = currentMonth;
    targetYear = currentYear;
  } else if (month === 'last') {
    targetMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    targetYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  }

  const filteredBills = monthlyBills.filter(bill => {
    return bill.billingPeriod?.year === targetYear &&
      bill.billingPeriod?.month === format(new Date(targetYear, targetMonth), 'MMMM');
  });

  const paid = filteredBills.filter(b => b.status === 'paid');
  const partial = filteredBills.filter(b => b.status === 'partial');
  const overdue = filteredBills.filter(b => b.status === 'overdue');

  const totalAmount = filteredBills.reduce((sum, b) => sum + (b.financials?.grandTotal || 0), 0);
  const totalDue = filteredBills.reduce((sum, b) => sum + (b.financials?.balanceDue || 0), 0);

  return {
    total: filteredBills.length,
    totalAmount,
    totalDue,
    paid: { count: paid.length, amount: paid.reduce((sum, b) => sum + (b.financials?.amountPaid || 0), 0) },
    partial: { count: partial.length, amount: partial.reduce((sum, b) => sum + (b.financials?.balanceDue || 0), 0) },
    overdue: { count: overdue.length, amount: overdue.reduce((sum, b) => sum + (b.financials?.balanceDue || 0), 0) },
    overdueBills: overdue.slice(0, 3).map(b => ({
      billNumber: b.billNumber,
      buyerName: b.buyer?.businessName || b.buyer?.name,
      amount: b.financials?.balanceDue,
      daysOverdue: Math.floor((new Date() - new Date(b.paymentDueDate)) / (1000 * 60 * 60 * 24))
    }))
  };
};

// ========================================
// 7-DAY SALES VELOCITY & FORECAST
// ========================================
export const calculate7DayVelocity = (wholesaleOrders, directSales) => {
  const last7Days = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = startOfDay(subDays(now, i));
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    let units = 0;

    wholesaleOrders
      .filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= date && orderDate < nextDay && o.status !== 'cancelled';
      })
      .forEach(order => {
        order.items?.forEach(item => {
          units += item.quantity;
        });
      });

    directSales
      .filter(s => {
        const saleDate = new Date(s.createdAt);
        return saleDate >= date && saleDate < nextDay;
      })
      .forEach(sale => {
        sale.items?.forEach(item => {
          units += item.quantity;
        });
      });

    last7Days.push({
      date,
      dayName: format(date, 'EEE'),
      units
    });
  }

  const totalUnits = last7Days.reduce((sum, day) => sum + day.units, 0);
  const avgDaily = totalUnits / 7;
  const forecast = Math.round(avgDaily * 7);

  const wholesaleUnits = wholesaleOrders
    .filter(o => {
      const date = new Date(o.createdAt);
      return date >= subDays(now, 7) && o.status !== 'cancelled';
    })
    .reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);

  const directUnits = directSales
    .filter(s => {
      const date = new Date(s.createdAt);
      return date >= subDays(now, 7);
    })
    .reduce((sum, s) => sum + s.items.reduce((s, i) => s + i.quantity, 0), 0);

  return {
    last7Days,
    avgDaily: Math.round(avgDaily),
    forecast,
    wholesalePercentage: totalUnits > 0 ? Math.round((wholesaleUnits / totalUnits) * 100) : 0,
    directPercentage: totalUnits > 0 ? Math.round((directUnits / totalUnits) * 100) : 0,
    wholesaleUnits,
    directUnits
  };
};

// ========================================
// ✅ RECENT ACTIVITY FEED (FIXED - USE SETTLEMENTS)
// ========================================
export const getRecentActivity = (settlements, wholesaleOrders, directSales, factoryReceivings, limit = 10) => {
  const activities = [];

  // ✅ FIXED: Add settlements as marketplace activity
  settlements.forEach(settlement => {
    activities.push({
      type: 'marketplace',
      time: timeAgo(settlement.settlementDate),
      title: `Settlement Received - ${settlement.accountName}`,
      subtitle: `${settlement.unitsSold} units sold`,
      description: `Period: ${format(new Date(settlement.periodStart), 'MMM d')} - ${format(new Date(settlement.periodEnd), 'MMM d')}`,
      amount: settlement.settlementAmount,
      timestamp: new Date(settlement.settlementDate)
    });
  });

  wholesaleOrders.forEach(order => {
    activities.push({
      type: 'wholesale',
      time: timeAgo(order.createdAt),
      title: `Wholesale Order - ${order.businessName || order.buyerName}`,
      subtitle: `${order.items?.reduce((sum, i) => sum + i.quantity, 0) || 0} units`,
      description: `Order #${order.orderNumber || 'N/A'}`,
      amount: order.totalAmount,
      timestamp: new Date(order.createdAt)
    });
  });

  directSales.forEach(sale => {
    activities.push({
      type: 'direct',
      time: timeAgo(sale.createdAt),
      title: `Direct Sale - ${sale.customerName || 'Walk-in'}`,
      subtitle: `${sale.items?.reduce((sum, i) => sum + i.quantity, 0) || 0} units`,
      description: `Invoice #${sale.invoiceNumber || 'N/A'}`,
      amount: sale.totalAmount,
      timestamp: new Date(sale.createdAt)
    });
  });

  factoryReceivings.forEach(receiving => {
    activities.push({
      type: 'factory',
      time: timeAgo(receiving.createdAt),
      title: 'Factory Stock Received',
      subtitle: `${receiving.items?.reduce((sum, i) => sum + i.quantity, 0) || 0} units`,
      description: `Challan #${receiving.challanNumber || 'N/A'}`,
      amount: null,
      timestamp: new Date(receiving.createdAt)
    });
  });

  return activities
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
};

// ========================================
// REORDER RECOMMENDATIONS
// ========================================
export const calculateReorderRecommendations = (outOfStock, lowStock, wholesaleOrders, directSales, products) => {
  const recommendations = [];
  const velocity = calculateWDSalesVelocity(wholesaleOrders, directSales, 30);

  [...outOfStock, ...lowStock].forEach(item => {
    const key = `${item.design}-${item.color}-${item.size}`;
    const monthlyVelocity = velocity[key] || 0;
    const avgPerDay = monthlyVelocity / 30;
    const recommendedQty = Math.ceil(monthlyVelocity * 1.5); // 1.5 months buffer
    const estimatedCost = recommendedQty * (item.wholesalePrice || 0);
    const daysWillLast = avgPerDay > 0 ? Math.round(recommendedQty / avgPerDay) : 999;

    recommendations.push({
      design: item.design,
      color: item.color,
      size: item.size,
      currentStock: item.currentStock,
      avgPerMonth: Math.round(monthlyVelocity),
      avgPerDay: avgPerDay.toFixed(1),
      recommendedQty,
      estimatedCost,
      daysWillLast,
      monthsWillLast: daysWillLast === 999 ? '∞' : (daysWillLast / 30).toFixed(1),
      reason: item.currentStock === 0 ? 'Out of stock' : 'Low stock'
    });
  });

  recommendations.sort((a, b) => b.avgPerMonth - a.avgPerMonth);

  const summary = {
    totalVariants: recommendations.length,
    totalQty: recommendations.reduce((sum, r) => sum + r.recommendedQty, 0),
    totalCost: recommendations.reduce((sum, r) => sum + r.estimatedCost, 0),
    expectedROI: 50 // Estimated based on 1.5x markup
  };

  return {
    recommendations: recommendations.slice(0, 5),
    summary
  };
};

// ========================================
// INVENTORY VALUE
// ========================================
export const calculateInventoryValue = (products) => {
  let totalValue = 0;
  let totalUnits = 0;

  products.forEach(product => {
    product.colors?.forEach(color => {
      const price = color.wholesalePrice || 0;
      color.sizes?.forEach(size => {
        const stock = size.currentStock || 0;
        totalValue += price * stock;
        totalUnits += stock;
      });
    });
  });

  return {
    totalValue,
    totalUnits
  };
};
