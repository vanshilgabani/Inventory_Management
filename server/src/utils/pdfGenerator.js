const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// ==========================================
// 1. HELPER FUNCTIONS
// ==========================================

const formatCurrency = (n) => {
  if (n == null) return 'Rs. 0.00';
  return `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

// Indian Numbering System Converter
const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  const convertTwoDigit = (n) => {
    if (n < 10) return ones[n];
    if (n >= 10 && n < 20) return teens[n - 10];
    const tensDigit = Math.floor(n / 10);
    const onesDigit = n % 10;
    return tens[tensDigit] + (onesDigit > 0 ? ' ' + ones[onesDigit] : '');
  };

  if (num === 0) return 'Zero';

  num = Math.floor(num);

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = Math.floor((num % 1000) / 100);
  const remainder = num % 100;

  let words = '';

  if (crore > 0) words += convertTwoDigit(crore) + ' Crore ';
  if (lakh > 0) words += convertTwoDigit(lakh) + ' Lakh ';
  if (thousand > 0) words += convertTwoDigit(thousand) + ' Thousand ';
  if (hundred > 0) words += ones[hundred] + ' Hundred ';
  if (remainder > 0) words += convertTwoDigit(remainder);

  return words.trim();
};

// ✅ IMPROVED: Logo loading with multiple fallbacks
const getLogoPath = () => {
  const possiblePaths = [
    path.join(__dirname, '../../public/logo.png'),
    path.join(__dirname, '../assets/logo.png'),
    path.join(__dirname, '../../../client/src/assets/logo.png'),
    path.join(__dirname, '../../logo.png')
  ];

  for (const logoPath of possiblePaths) {
    if (fs.existsSync(logoPath)) {
      logger.debug('Logo found', { path: logoPath });
      return logoPath;
    }
  }

  logger.warn('Logo not found in any standard location');
  return null;
};

// ✅ IMPROVED: Text overflow handling
const truncateText = (doc, text, maxWidth, fontSize = 9) => {
  doc.fontSize(fontSize);
  const textWidth = doc.widthOfString(text);
  
  if (textWidth <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (doc.widthOfString(truncated + '...') > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }

  return truncated + '...';
};

// ==========================================
// 2. MAIN GENERATOR FUNCTION
// ==========================================

const generateChallanPDF = async (order, challanSettings) => {
  return new Promise((resolve, reject) => {
    try {
      // ✅ Validate required fields
      if (!order) {
        return reject(new Error('Order data is required'));
      }

      if (!order.items || order.items.length === 0) {
        return reject(new Error('Order must contain items'));
      }

      if (!order.challanNumber) {
        logger.warn('Challan number missing, using order ID');
        order.challanNumber = order._id?.toString().slice(-8).toUpperCase() || 'DRAFT';
      }

      // Create Document (A4: 595.28 x 841.89 points)
      const doc = new PDFDocument({ size: 'A4', margin: 30, bufferPages: true });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const margin = 30;
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const contentWidth = pageWidth - (margin * 2);

      // Define Settings & Data
      const settings = challanSettings || {};
      const {
        challanNumber,
        createdAt,
        buyerName,
        buyerAddress,
        buyerContact,
        businessName,
        gstNumber,
        items,
        subtotalAmount,
        discountAmount = 0,
        gstAmount = 0,
        cgst = 0,
        sgst = 0,
        totalAmount,
        gstEnabled = false,
        fulfillmentType = 'warehouse' // ✅ NEW
      } = order;

      // ✅ Calculate GST percentage and round-off
      const gstPercentage = settings.gstPercentage || 5;
      const cgstPercentage = gstPercentage / 2;
      const sgstPercentage = gstPercentage / 2;
      
      const totalBeforeRoundOff = totalAmount || 0;
      const roundedTotal = Math.round(totalBeforeRoundOff);
      const roundOffAmount = roundedTotal - totalBeforeRoundOff;

      // --- CELL DRAWING HELPER ---
      const drawCell = (text, x, y, w, h, align = 'left', font = 'Helvetica', fontSize = 9, isBold = false) => {
        if (!text) text = '';
        doc.font(isBold ? 'Helvetica-Bold' : font)
          .fontSize(fontSize)
          .text(String(text), x + 4, y + 5, {
            width: w - 8,
            align: align,
            lineBreak: true,
            ellipsis: true
          });
      };

      let currentY = 30;
      let currentPage = 1;

      // ==========================================
      // SECTION 1: HEADER (Box 1)
      // ==========================================
      const headerHeight = 100;

      // Draw Header Box
      doc.rect(margin, currentY, contentWidth, headerHeight).stroke();

      // --- LEFT: Logo & Company Info ---
      const logoPath = getLogoPath();
      if (logoPath) {
        try {
          doc.image(logoPath, margin + 5, currentY + 5, { width: 60, height: 60, fit: [60, 60] });
        } catch (logoError) {
          logger.error('Failed to add logo to PDF', { error: logoError.message });
        }
      }

      const leftTextX = margin + 80;
      let textY = currentY + 15;

      // Company Name
      doc.font('Helvetica-Bold').fontSize(18)
        .text((settings.companyName || 'VEERAA IMPEX').toUpperCase(), leftTextX, textY);

      textY += 25;

      // Company Address (Restricted Width: 55% of content)
      doc.font('Helvetica').fontSize(9);
      const maxAddressWidth = contentWidth * 0.55;
      const companyAddress = settings.address || 'Surat, Gujarat, India';
      doc.text(companyAddress, leftTextX, textY, { width: maxAddressWidth, ellipsis: true });

      // --- RIGHT: Contact Info ---
      const rightX = pageWidth - margin;
      const contactY = currentY + 15;
      const contactLineHeight = 15;

      doc.font('Helvetica').fontSize(9);
      doc.text(`Email: ${settings.email || ''}`, rightX - 200, contactY, { width: 200, align: 'right' });
      doc.text(`Phone: ${settings.phone || '9824556000'}`, rightX - 200, contactY + contactLineHeight, { width: 200, align: 'right' });
      doc.text(`GSTIN: ${settings.gstNumber || ''}`, rightX - 200, contactY + (contactLineHeight * 2), { width: 200, align: 'right' });

      currentY += headerHeight;

      // ==========================================
      // SECTION 2: BILL TO & CHALLAN INFO (Box 2)
      // ==========================================
      const billToHeight = 95; // ✅ Increased from 85 to 95 for buyer GST

      // Draw Outer Box
      doc.rect(margin, currentY, contentWidth, billToHeight).stroke();

      // --- VERTICAL SPLIT ---
      const splitX = margin + (contentWidth * 0.65);
      doc.moveTo(splitX, currentY).lineTo(splitX, currentY + billToHeight).stroke();

      // --- LEFT SIDE: Bill To Details ---
      const leftPadding = 10;
      let billToY = currentY + 10;

      doc.font('Helvetica-Bold').fontSize(10).text('Bill To:', margin + leftPadding, billToY);
      billToY += 15;

      doc.fontSize(10).text((businessName || buyerName || '').toUpperCase(), margin + leftPadding, billToY);
      billToY += 15;

      doc.font('Helvetica').fontSize(9);

      const maxBuyerAddrWidth = (splitX - margin) - 20;
      const buyerAddr = buyerAddress || '';
      doc.text(buyerAddr, margin + leftPadding, billToY, { width: maxBuyerAddrWidth, height: 30, ellipsis: true });

      const usedHeight = doc.heightOfString(buyerAddr, { width: maxBuyerAddrWidth });
      billToY += usedHeight + 5;

      // ✅ FIXED: Always show mobile (removed condition)
      if (buyerContact) {
        doc.text(`Mo: ${buyerContact}`, margin + leftPadding, billToY);
        billToY += 12;
      }

      // ✅ NEW: Show buyer GST number
      if (gstNumber) {
        doc.text(`GSTIN: ${gstNumber}`, margin + leftPadding, billToY);
      }

      // --- RIGHT SIDE: Challan Info ---
      const infoLabelX = splitX + 15;
      const infoValueX = pageWidth - margin;
      const infoY = currentY + 10;

      // ✅ CHANGED: Center-aligned CHALLAN text
      const rightBoxWidth = (pageWidth - margin) - splitX;
      doc.font('Helvetica-Bold').fontSize(14)
        .text('CHALLAN', splitX, infoY, { 
          width: rightBoxWidth, 
          align: 'center' 
        });

      // ✅ REMOVED: Fulfillment Type Badge (deleted the entire block)

      const dataY = infoY + 25;

      doc.fontSize(10).font('Helvetica').text('Number:', infoLabelX, dataY);
      doc.font('Helvetica').text(challanNumber || '', infoValueX - 150, dataY, { width: 145, align: 'right' });

      doc.font('Helvetica-Bold').text('Date:', infoLabelX, dataY + 15);
      doc.font('Helvetica').text(formatDate(createdAt), infoValueX - 150, dataY + 15, { width: 145, align: 'right' });

      currentY += billToHeight;

      // ==========================================
      // SECTION 3: ITEMS TABLE (Box 3)
      // ==========================================
      const hasDiscount = (items || []).some(i => (i.discount || 0) > 0) || discountAmount > 0;

      const colW = {
        idx: 35,        // ✅ CHANGED: Increased from 30 to 35
        item: hasDiscount ? 200 : 260,
        qty: 60,
        rate: 80,
        disc: hasDiscount ? 80 : 0,
        total: 80
      };

      const xPos = {
        idx: margin,
        item: margin + colW.idx,
        qty: margin + colW.idx + colW.item,
        rate: margin + colW.idx + colW.item + colW.qty,
        disc: margin + colW.idx + colW.item + colW.qty + colW.rate,
        total: margin + colW.idx + colW.item + colW.qty + colW.rate + colW.disc
      };

      // --- Table Header ---
      const headerRowHeight = 25;

      doc.rect(margin, currentY, contentWidth, headerRowHeight).fillColor('#f0f0f0').fill().strokeColor('#000').stroke();
      doc.fillColor('#000');

      drawCell('#', xPos.idx, currentY, colW.idx, headerRowHeight, 'center', 'Helvetica-Bold');
      drawCell('Item', xPos.item, currentY, colW.item, headerRowHeight, 'left', 'Helvetica-Bold');
      drawCell('Qty', xPos.qty, currentY, colW.qty, headerRowHeight, 'center', 'Helvetica-Bold');
      drawCell('Rate', xPos.rate, currentY, colW.rate, headerRowHeight, 'right', 'Helvetica-Bold');
      if (hasDiscount) drawCell('Discount', xPos.disc, currentY, colW.disc, headerRowHeight, 'right', 'Helvetica-Bold');
      drawCell('Total', xPos.total, currentY, colW.total, headerRowHeight, 'right', 'Helvetica-Bold');

      const drawVerticalLines = (y, h) => {
        doc.moveTo(xPos.item, y).lineTo(xPos.item, y + h).stroke();
        doc.moveTo(xPos.qty, y).lineTo(xPos.qty, y + h).stroke();
        doc.moveTo(xPos.rate, y).lineTo(xPos.rate, y + h).stroke();
        if (hasDiscount) doc.moveTo(xPos.disc, y).lineTo(xPos.disc, y + h).stroke();
        doc.moveTo(xPos.total, y).lineTo(xPos.total, y + h).stroke();
      };

      drawVerticalLines(currentY, headerRowHeight);
      currentY += headerRowHeight;

      // --- Table Body ---
      (items || []).forEach((item, index) => {
        const total = (item.quantity * item.pricePerUnit) - (item.discount || 0);
        
        // ✅ NEW: Format with underscores between design, color, size
        const itemParts = [item.design, item.color, item.size].filter(Boolean);
        const itemText = itemParts.join('_');  
        
        const itemHeight = doc.heightOfString(itemText, { width: colW.item - 8 });
        const rowHeight = Math.max(25, itemHeight + 10);

        // ✅ Page break logic
        if (currentY + rowHeight > pageHeight - 150) { // ✅ Increased footer space
          doc.addPage();
          currentPage++;
          currentY = margin;
        }

        doc.rect(margin, currentY, contentWidth, rowHeight).stroke();

        drawCell((index + 1).toString(), xPos.idx, currentY, colW.idx, rowHeight, 'center');
        drawCell(itemText, xPos.item, currentY, colW.item, rowHeight, 'left');
        drawCell(`${item.quantity} Pcs`, xPos.qty, currentY, colW.qty, rowHeight, 'center');
        drawCell(formatCurrency(item.pricePerUnit), xPos.rate, currentY, colW.rate, rowHeight, 'right');
        if (hasDiscount) drawCell(formatCurrency(item.discount || 0), xPos.disc, currentY, colW.disc, rowHeight, 'right');
        drawCell(formatCurrency(total), xPos.total, currentY, colW.total, rowHeight, 'right');

        drawVerticalLines(currentY, rowHeight);
        currentY += rowHeight;
      });

      // --- Table Footer (Total Qty) ---
      const footerRowHeight = 25;

      doc.rect(margin, currentY, contentWidth, footerRowHeight).stroke();

      drawCell('Total Qty:', xPos.item, currentY, colW.item, footerRowHeight, 'right', 'Helvetica-Bold');

      const totalQty = (items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
      drawCell(`${totalQty} Pcs`, xPos.qty, currentY, colW.qty, footerRowHeight, 'center', 'Helvetica-Bold');

      drawVerticalLines(currentY, footerRowHeight);
      currentY += footerRowHeight;

      // ==========================================
      // SECTION 4: FOOTER & CALCULATIONS (Box 4)
      // ==========================================
      const footerBoxHeight = 140; // ✅ Increased from 130 to 140 for CGST/SGST split

      if (currentY + footerBoxHeight > pageHeight - 30) {
        doc.addPage();
        currentPage++;
        currentY = margin;
      }

      doc.rect(margin, currentY, contentWidth, footerBoxHeight).stroke();

      const footerSplitX = pageWidth - margin - 200;
      doc.moveTo(footerSplitX, currentY).lineTo(footerSplitX, currentY + footerBoxHeight).stroke();

      // --- Left Side: Words & Signatures ---
      let leftY = currentY + 10;

      doc.font('Helvetica').fontSize(9).text('Net Payable in Words:', margin + 10, leftY);
      leftY += 15;

      const netPayableVal = roundedTotal; // ✅ Use rounded total

      doc.font('Helvetica-Bold').fontSize(9)
        .text(numberToWords(netPayableVal), margin + 10, leftY, { width: footerSplitX - margin - 20 });

      const sigY = currentY + footerBoxHeight - 25;

      doc.font('Helvetica').fontSize(9);
      doc.text("Receiver's Signature", margin + 10, sigY);
      doc.text("Authorised Signature", footerSplitX - 120, sigY, { width: 110, align: 'right' });

      // --- Right Side: Calculations ---
      let rightY = currentY + 10;
      const rightContentWidth = (pageWidth - margin) - footerSplitX;
      const labelX = footerSplitX + 10;
      const valueX = footerSplitX + 10;

      doc.font('Helvetica').text('Subtotal:', labelX, rightY);
      doc.text(formatCurrency(subtotalAmount), valueX, rightY, { width: rightContentWidth - 20, align: 'right' });
      rightY += 18;

      if (discountAmount > 0) {
        doc.text('Discount:', labelX, rightY);
        doc.text(`- ${formatCurrency(discountAmount)}`, valueX, rightY, { width: rightContentWidth - 20, align: 'right' });
        rightY += 18;
      }

      // ✅ NEW: Split CGST and SGST with percentages
      if (gstEnabled && cgst > 0) {
        doc.text(`CGST (${cgstPercentage}%):`, labelX, rightY);
        doc.text(formatCurrency(cgst), valueX, rightY, { width: rightContentWidth - 20, align: 'right' });
        rightY += 18;

        doc.text(`SGST (${sgstPercentage}%):`, labelX, rightY);
        doc.text(formatCurrency(sgst), valueX, rightY, { width: rightContentWidth - 20, align: 'right' });
        rightY += 18;
      }

      // ✅ NEW: Show round-off if applicable
      if (Math.abs(roundOffAmount) > 0.01) {
        doc.text('Round Off:', labelX, rightY);
        doc.text(
          roundOffAmount >= 0 ? `+ ${formatCurrency(Math.abs(roundOffAmount))}` : `- ${formatCurrency(Math.abs(roundOffAmount))}`, 
          valueX, 
          rightY, 
          { width: rightContentWidth - 20, align: 'right' }
        );
        rightY += 18;
      }

      doc.moveTo(footerSplitX, rightY).lineTo(pageWidth - margin, rightY).stroke();
      rightY += 12;

      doc.font('Helvetica-Bold').fontSize(10).text('Net Payable:', labelX, rightY);
      doc.text(formatCurrency(roundedTotal), valueX, rightY, { width: rightContentWidth - 20, align: 'right' });

      // ✅ NEW: Add page numbers to all pages
      const totalPages = currentPage;
      const range = doc.bufferedPageRange();
      
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(8);
        doc.text(
          `Page ${i + 1} of ${totalPages}`,
          margin,
          pageHeight - 20,
          { width: contentWidth, align: 'right' }
        );
      }

      doc.end();

      logger.info('PDF generated successfully', { challanNumber });
    } catch (error) {
      logger.error('PDF generation error', { error: error.message, stack: error.stack });
      reject(error);
    }
  });
};

module.exports = { generateChallanPDF };
