// Helper to generate human-readable changes summary
export const generateChangesSummary = (oldData, newData) => {
  const changes = [];
  
  // Field name mappings for better readability
  const fieldLabels = {
    customerName: 'Customer',
    mobile: 'Mobile',
    paymentMethod: 'Payment',
    totalAmount: 'Amount',
    quantity: 'Quantity',
    color: 'Color',
    size: 'Size',
    design: 'Design',
    orderDate: 'Order Date',
    dispatchDate: 'Dispatch Date',
    itemName: 'Item',
    price: 'Price',
    stock: 'Stock',
    receivedDate: 'Received Date',
    challanNumber: 'Challan',
  };

  for (const key in newData) {
    if (oldData[key] !== newData[key]) {
      const label = fieldLabels[key] || key;
      const oldValue = oldData[key] || '(empty)';
      const newValue = newData[key] || '(empty)';
      
      // Truncate long values
      const truncate = (str, len = 25) => {
        if (typeof str !== 'string') str = String(str);
        return str.length > len ? str.substring(0, len) + '...' : str;
      };

      changes.push({
        field: label,
        oldValue: truncate(oldValue),
        newValue: truncate(newValue),
      });
    }
  }

  return changes;
};

// Format changes for display in one line
export const formatChangesSummaryText = (changes) => {
  return changes
    .slice(0, 3) // Max 3 changes
    .map(c => `${c.field}: ${c.oldValue} → ${c.newValue}`)
    .join(', ');
};

// Get module display name
export const getModuleDisplayName = (module) => {
  const names = {
    'direct-sales': 'Direct Sales',
    'marketplace-sales': 'Marketplace Sales',
    'inventory': 'Inventory',
    'factory-receiving': 'Factory Receiving',
  };
  return names[module] || module;
};

// Get action display name
export const getActionDisplayName = (action) => {
  const names = {
    'edit': 'Edit',
    'delete': 'Delete',
    'bulk-delete': 'Bulk Delete',
  };
  return names[action] || action;
};

// Get status badge color
export const getStatusColor = (status) => {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

// Calculate time remaining until expiry
export const getTimeRemaining = (expiresAt) => {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry - now;

  if (diff <= 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  return `${minutes}m left`;
};
