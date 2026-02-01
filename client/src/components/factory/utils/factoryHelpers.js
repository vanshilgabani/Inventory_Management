import { format, parseISO, isWithinInterval } from 'date-fns';
import * as XLSX from 'xlsx';

// ===== GROUP BY DATE =====
export const groupByDate = (receivings, enabledSizes) => {
  const grouped = {};

  receivings.forEach((receiving) => {
    const date = format(new Date(receiving.receivedDate), 'yyyy-MM-dd');

    if (!grouped[date]) {
      grouped[date] = {
        date: date,
        designs: {},
        totalQuantity: 0,
      };
    }

    const design = receiving.design;
    const notes = receiving.notes || 'No notes';
    const batchId = receiving.batchId || '';
    const designKey = `${design}-${notes}-${batchId}`;

    if (!grouped[date].designs[designKey]) {
      grouped[date].designs[designKey] = {
        design: design,
        notes: notes,
        batchIds: new Set(),
        colors: {},
        totalQuantity: 0,
        receivingIds: [],
      };
    }

    const designGroup = grouped[date].designs[designKey];
    const color = receiving.color;

    if (!designGroup.colors[color]) {
      designGroup.colors[color] = {
        color: color,
        quantities: {},
        totalQuantity: 0,
        receivingIds: [],
      };
    }

    designGroup.colors[color].receivingIds.push(receiving._id);
    designGroup.receivingIds.push(receiving._id);

    const quantities =
      receiving.quantities instanceof Map
        ? Object.fromEntries(receiving.quantities)
        : receiving.quantities;

    Object.keys(quantities).forEach((size) => {
      if (size !== 'undefined' && enabledSizes.includes(size)) {
        if (!designGroup.colors[color].quantities[size]) {
          designGroup.colors[color].quantities[size] = 0;
        }
        designGroup.colors[color].quantities[size] += quantities[size];
      }
    });

    const colorTotal = receiving.totalQuantity || 0;
    designGroup.colors[color].totalQuantity += colorTotal;
    designGroup.totalQuantity += colorTotal;
    grouped[date].totalQuantity += colorTotal;

    if (receiving.batchId) {
      designGroup.batchIds.add(receiving.batchId);
    }
  });

  const result = Object.values(grouped).map((dayData) => ({
    date: dayData.date,
    designs: Object.values(dayData.designs).map((designGroup) => ({
      ...designGroup,
      batchIds: Array.from(designGroup.batchIds),
      colors: Object.values(designGroup.colors),
    })),
    totalQuantity: dayData.totalQuantity,
  }));

  return result.sort((a, b) => new Date(b.date) - new Date(a.date));
};

// ===== GROUP BY BORROWER =====
export const groupByBorrower = (receivings, enabledSizes) => {
  const borrowerMap = {};

  // Group borrowed items
  const borrowed = receivings.filter((r) =>
    ['borrowed_buyer', 'borrowed_vendor'].includes(r.sourceType)
  );

  borrowed.forEach((receipt) => {
    const sourceName = receipt.sourceName || 'Unknown';

    if (!borrowerMap[sourceName]) {
      borrowerMap[sourceName] = {
        sourceName,
        borrowedItems: [],
        returns: [],
        totalBorrowed: 0,
        totalReturned: 0,
        outstanding: 0,
        status: 'active',
      };
    }

    const quantities =
      receipt.quantities instanceof Map
        ? Object.fromEntries(receipt.quantities)
        : receipt.quantities;

    const totalQty = Object.values(quantities).reduce((sum, q) => sum + (q || 0), 0);
    const returnedQty = receipt.returnedQuantity || 0;

    borrowerMap[sourceName].borrowedItems.push({
      design: receipt.design,
      color: receipt.color,
      quantities: quantities,
      returnedQuantities: receipt.returnedQuantities || {},
      totalQuantity: totalQty,
      returnedQuantity: returnedQty,
      borrowedDate: receipt.receivedDate,
      returnDueDate: receipt.returnDueDate,
      borrowStatus: receipt.borrowStatus,
      receipt: receipt,
    });

    borrowerMap[sourceName].totalBorrowed += totalQty;
    borrowerMap[sourceName].totalReturned += returnedQty;
  });

  // Group returns
  const returns = receivings.filter((r) => r.sourceType === 'return');

  returns.forEach((returnReceipt) => {
    const sourceName = returnReceipt.sourceName || 'Unknown';

    if (borrowerMap[sourceName]) {
      const quantities =
        returnReceipt.quantities instanceof Map
          ? Object.fromEntries(returnReceipt.quantities)
          : returnReceipt.quantities;

      const totalQty = Object.values(quantities).reduce((sum, q) => sum + (q || 0), 0);

      borrowerMap[sourceName].returns.push({
        design: returnReceipt.design,
        color: returnReceipt.color,
        quantities: quantities,
        totalQuantity: totalQty,
        returnedDate: returnReceipt.returnedDate || returnReceipt.receivedDate,
        returnType: returnReceipt.returnType || 'same',
      });
    }
  });

  // Calculate status
  Object.values(borrowerMap).forEach((borrower) => {
    borrower.outstanding = borrower.totalBorrowed - borrower.totalReturned;

    if (borrower.outstanding === 0) {
      borrower.status = 'completed';
    } else if (borrower.totalReturned > 0 && borrower.outstanding > 0) {
      borrower.status = 'partial';
    } else {
      borrower.status = 'active';
    }
  });

  return Object.values(borrowerMap).sort((a, b) => b.outstanding - a.outstanding);
};

// ===== CALCULATE STATS (Filter-aware) =====
export const calculateStats = (receivings, factoryFilters, borrowedFilters) => {
  // Factory Stats
  let factoryReceivings = receivings.filter(
    (r) => r.sourceType === 'factory' || !r.sourceType
  );

  // Apply factory filters
  if (factoryFilters) {
    if (factoryFilters.dateFrom || factoryFilters.dateTo) {
      factoryReceivings = factoryReceivings.filter((r) => {
        const date = parseISO(format(new Date(r.receivedDate), 'yyyy-MM-dd'));
        const from = factoryFilters.dateFrom ? parseISO(factoryFilters.dateFrom) : new Date('1900-01-01');
        const to = factoryFilters.dateTo ? parseISO(factoryFilters.dateTo) : new Date('2100-12-31');
        return isWithinInterval(date, { start: from, end: to });
      });
    }

    if (factoryFilters.search && factoryFilters.search.trim()) {
      const query = factoryFilters.search.toLowerCase();
      factoryReceivings = factoryReceivings.filter((r) =>
        r.design.toLowerCase().includes(query) ||
        (r.notes && r.notes.toLowerCase().includes(query)) ||
        (r.batchId && r.batchId.toLowerCase().includes(query))
      );
    }
  }

  const factoryTotal = factoryReceivings.reduce((sum, r) => sum + (r.totalQuantity || 0), 0);
  const uniqueDesigns = new Set(factoryReceivings.map((r) => r.design)).size;
  const lastReceived =
    receivings.filter((r) => r.sourceType === 'factory' || !r.sourceType).length > 0
      ? format(
          new Date(
            Math.max(...receivings.filter((r) => r.sourceType === 'factory' || !r.sourceType).map((r) => new Date(r.receivedDate)))
          ),
          'dd MMM yyyy'
        )
      : 'Never';

  // Borrowed Stats
  let borrowed = receivings.filter((r) =>
    ['borrowed_buyer', 'borrowed_vendor'].includes(r.sourceType)
  );

  // Apply borrowed filters
  if (borrowedFilters) {
    if (borrowedFilters.search && borrowedFilters.search.trim()) {
      const query = borrowedFilters.search.toLowerCase();
      borrowed = borrowed.filter((r) =>
        r.sourceName && r.sourceName.toLowerCase().includes(query)
      );
    }

    if (borrowedFilters.status && borrowedFilters.status !== 'all') {
      borrowed = borrowed.filter((r) => {
        const totalQty = r.totalQuantity || 0;
        const returnedQty = r.returnedQuantity || 0;
        const outstanding = totalQty - returnedQty;

        if (borrowedFilters.status === 'active') {
          return outstanding > 0 && returnedQty === 0;
        } else if (borrowedFilters.status === 'partial') {
          return outstanding > 0 && returnedQty > 0;
        } else if (borrowedFilters.status === 'completed') {
          return outstanding === 0;
        }
        return true;
      });
    }
  }

  const totalBorrowed = borrowed.reduce((sum, r) => sum + (r.totalQuantity || 0), 0);
  const totalReturned = borrowed.reduce((sum, r) => sum + (r.returnedQuantity || 0), 0);
  const outstanding = totalBorrowed - totalReturned;
  
  const activeBorrowers = new Set(
    borrowed
      .filter((r) => r.totalQuantity - (r.returnedQuantity || 0) > 0)
      .map((r) => r.sourceName)
  ).size;

  return {
    factory: {
      totalReceived: factoryTotal,
      uniqueDesigns,
      lastReceived,
    },
    borrowed: {
      totalBorrowed,
      totalReturned,
      outstanding,
      activeBorrowers,
    },
  };
};

// ===== FILTER BY DATE RANGE =====
export const filterByDateRange = (data, dateFrom, dateTo) => {
  if (!dateFrom && !dateTo) return data;

  return data.filter((dateGroup) => {
    const date = parseISO(dateGroup.date);
    const from = dateFrom ? parseISO(dateFrom) : new Date('1900-01-01');
    const to = dateTo ? parseISO(dateTo) : new Date('2100-12-31');

    return isWithinInterval(date, { start: from, end: to });
  });
};

// ===== FILTER BY SEARCH =====
export const filterBySearch = (data, search) => {
  const query = search.toLowerCase().trim();

  return data
    .map((dateGroup) => {
      const filteredDesigns = dateGroup.designs.filter(
        (design) =>
          design.design.toLowerCase().includes(query) ||
          design.notes.toLowerCase().includes(query) ||
          design.batchIds.some((batch) => batch.toLowerCase().includes(query))
      );

      if (filteredDesigns.length === 0) return null;

      return {
        ...dateGroup,
        designs: filteredDesigns,
        totalQuantity: filteredDesigns.reduce((sum, d) => sum + d.totalQuantity, 0),
      };
    })
    .filter(Boolean);
};

// ===== FILTER BORROWERS BY SEARCH =====
export const filterBorrowersBySearch = (data, search) => {
  const query = search.toLowerCase().trim();
  return data.filter((borrower) => borrower.sourceName.toLowerCase().includes(query));
};

// ===== FILTER BORROWERS BY STATUS =====
export const filterBorrowersByStatus = (data, status) => {
  if (status === 'all') return data;
  return data.filter((borrower) => borrower.status === status);
};

// ===== EXPORT TO EXCEL =====
export const exportToExcel = (data, filename) => {
  try {
    const exportData = [];

    data.forEach((dateGroup) => {
      dateGroup.designs.forEach((design) => {
        design.colors.forEach((color) => {
          const row = {
            Date: format(parseISO(dateGroup.date), 'dd MMM yyyy'),
            Design: design.design,
            Color: color.color,
            Batch: design.batchIds.join(', ') || 'N/A',
            Notes: design.notes,
          };

          Object.entries(color.quantities).forEach(([size, qty]) => {
            row[size] = qty;
          });

          row['Total Quantity'] = color.totalQuantity;
          exportData.push(row);
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Receivings');

    const exportFilename = `${filename}_${format(new Date(), 'dd-MMM-yyyy')}.xlsx`;
    XLSX.writeFile(wb, exportFilename);

    return true;
  } catch (error) {
    console.error('Export failed:', error);
    return false;
  }
};
