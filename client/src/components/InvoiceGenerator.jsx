import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { challanSettingsService } from '../services/challanSettingsService';
import logo from '../assets/logo.png';

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

export const generateInvoice = async (order, options = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      const settings = await challanSettingsService.getSettings();
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);

      // ✅ Calculate GST percentage from order data
      const gstPercentage = settings.gstPercentage || 5;
      const cgstPercentage = gstPercentage / 2;
      const sgstPercentage = gstPercentage / 2;

      // ✅ Calculate round-off
      const totalBeforeRoundOff = order.totalAmount || 0;
      const roundedTotal = Math.round(totalBeforeRoundOff);
      const roundOffAmount = roundedTotal - totalBeforeRoundOff;

      // ==========================================
      // 1. HEADER SECTION (Box 1)
      // ==========================================
      const headerStartY = 10;
      const headerHeight = 35;
      doc.setDrawColor(0);
      doc.setLineWidth(0.2);
      doc.rect(margin, headerStartY, contentWidth, headerHeight);

      // --- LEFT: Logo & Name ---
      try {
        doc.addImage(logo, 'PNG', margin + 2, headerStartY + 2, 25, 25);
      } catch (e) { console.error('Logo error', e); }

      const textLeftX = margin + 30;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text((settings.companyName || 'VEERAA IMPEX').toUpperCase(), textLeftX, headerStartY + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const addressStr = `${settings.address || ''}`;
      const addressLines = doc.splitTextToSize(addressStr, contentWidth * 0.55);
      doc.text(addressLines, textLeftX, headerStartY + 14);

      // --- RIGHT: Contact Info ---
      const rightColX = pageWidth - margin - 5;
      const contactStartY = headerStartY + 8;
      const contactLineHeight = 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Email: ${settings.email || ''}`, rightColX, contactStartY, { align: 'right' });
      doc.text(`Phone: ${settings.phone || '9824556000'}`, rightColX, contactStartY + contactLineHeight, { align: 'right' });
      doc.text(`GSTIN: ${settings.gstNumber || ''}`, rightColX, contactStartY + (contactLineHeight * 2), { align: 'right' });

      // ==========================================
      // 2. BILL TO & CHALLAN INFO (Box 2)
      // ==========================================
      const billToY = headerStartY + headerHeight;
      const billToHeight = 35; // ✅ Increased from 30 to 35 for buyer GST

      // Draw Box
      doc.rect(margin, billToY, contentWidth, billToHeight);

      // --- VERTICAL DIVIDER ---
      const splitX = margin + (contentWidth * 0.65);
      doc.line(splitX, billToY, splitX, billToY + billToHeight);

      // --- LEFT SIDE: Bill To Details ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Bill To:', margin + 3, billToY + 5);

      doc.setFontSize(10);
      doc.text((order.businessName || order.buyerName || '').toUpperCase(), margin + 3, billToY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      const maxAddressWidth = (splitX - margin) - 10;
      const buyerAddr = order.buyerAddress ? doc.splitTextToSize(order.buyerAddress, maxAddressWidth) : [];
      
      let currentBillY = billToY + 15;
      if (buyerAddr.length > 0) {
        doc.text(buyerAddr, margin + 3, currentBillY);
        currentBillY += (buyerAddr.length * 4);
      }

      // ✅ FIXED: Always show mobile (removed condition)
      if (order.buyerContact) {
        doc.text(`Mo: ${order.buyerContact}`, margin + 3, currentBillY);
        currentBillY += 4;
      }

      // ✅ NEW: Show buyer GST number
      if (order.gstNumber) {
        doc.text(`GSTIN: ${order.gstNumber}`, margin + 3, currentBillY);
      }

      // --- RIGHT SIDE: Challan Info ---
      const infoLabelX = splitX + 5;
      const infoValueX = rightColX;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      // ✅ CHANGED: Center-aligned CHALLAN text
      doc.text('CHALLAN', splitX + ((pageWidth - margin - splitX) / 2), billToY + 7, { align: 'center' });

      // ✅ REMOVED: Fulfillment Type Badge (deleted the entire block)

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      // Row 1: Number
      doc.text('Number:', infoLabelX, billToY + 20);
      doc.setFont('helvetica', 'normal');
      doc.text(order.challanNumber || '', infoValueX, billToY + 20, { align: 'right' });

      // Row 2: Date
      doc.setFont('helvetica', 'bold');
      doc.text('Date:', infoLabelX, billToY + 27);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(order.createdAt), infoValueX, billToY + 27, { align: 'right' });

      // ==========================================
      // 3. ITEMS TABLE (Box 3)
      // ==========================================
      const hasDiscount = (order.items || []).some(i => i.discount > 0) || order.discountAmount > 0;

      const head = [['#', 'Item', 'Qty', 'Rate', hasDiscount ? 'Discount' : null, 'Total'].filter(Boolean)];

      const body = (order.items || []).map((item, index) => {
      const total = (item.quantity * item.pricePerUnit) - (item.discount || 0);
      
      // ✅ NEW: Format with underscores between design, color, size
      const itemName = [item.design, item.color, item.size]
        .filter(Boolean)  
        .join('_');      // Join with space-underscore
      
      return [
        index + 1,
        itemName,  
        `${item.quantity} Pcs`,
        formatCurrency(item.pricePerUnit),
        hasDiscount ? formatCurrency(item.discount || 0) : null,
        formatCurrency(total)
      ].filter(Boolean);
    });

      const totalQty = (order.items || []).reduce((sum, i) => sum + i.quantity, 0);

      const tableFooter = [
        '',
        `Total Qty:`,
        `${totalQty} Pcs`,
        '',
        hasDiscount ? '' : null,
        ''
      ].filter(val => val !== null);

      autoTable(doc, {
        startY: billToY + billToHeight,
        head: head,
        body: body,
        foot: [tableFooter],
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: 4,
          lineColor: 0,
          lineWidth: 0.2,
          textColor: 0,
        },
        headStyles: {
          fillColor: [240, 240, 240],
          fontStyle: 'bold',
          halign: 'center'
        },
        footStyles: {
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 15 }, // ✅ CHANGED: Increased from 10 to 15
          1: { halign: 'left', cellWidth: 'auto' },
          2: { halign: 'center', cellWidth: 25 },
          3: { halign: 'right', cellWidth: 30 },
          4: { halign: 'right', cellWidth: 30 },
          5: { halign: 'right', cellWidth: 35 },
        },
        margin: { left: margin, right: margin },
        tableLineWidth: 0.2,
        tableLineColor: 0,
        // ✅ NEW: Add page numbering
        didDrawPage: function (data) {
          const pageCount = doc.internal.getNumberOfPages();
          const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
          
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(`Page ${currentPage} of ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
        }
      });

      // ==========================================
      // 4. FOOTER & TOTALS (Box 4)
      // ==========================================
      let finalY = doc.lastAutoTable.finalY;

      if (finalY > pageHeight - 60) { // ✅ Increased from 50 to 60
        doc.addPage();
        finalY = margin;
      }

      const footerHeight = 55; // ✅ Increased from 45 to 55 for CGST/SGST split
      doc.rect(margin, finalY, contentWidth, footerHeight);

      const totalBoxWidth = 75;
      const totalBoxX = pageWidth - margin - totalBoxWidth;
      doc.line(totalBoxX, finalY, totalBoxX, finalY + footerHeight);

      // -- Left: Words & Signatures --
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Net Payable in Words:', margin + 3, finalY + 8);

      doc.setFont('helvetica', 'bold');
      const netPayable = roundedTotal; // ✅ Use rounded total
      const words = doc.splitTextToSize(numberToWords(netPayable), totalBoxX - margin - 5);
      doc.text(words, margin + 3, finalY + 14);

      const sigY = finalY + footerHeight - 6;
      doc.setFont('helvetica', 'normal');
      doc.text("Receiver's Signature", margin + 3, sigY);
      doc.text("Authorised Signature", totalBoxX - 5, sigY, { align: 'right' });

      // -- Right: Calculations --
      let calcY = finalY + 8;
      const lineSpacing = 6;
      const valX = pageWidth - margin - 3;
      const labelX = totalBoxX + 3;

      doc.text('Subtotal:', labelX, calcY);
      doc.text(formatCurrency(order.subtotalAmount), valX, calcY, { align: 'right' });

      if (order.discountAmount > 0) {
        calcY += lineSpacing;
        doc.text('Discount:', labelX, calcY);
        doc.text(`- ${formatCurrency(order.discountAmount)}`, valX, calcY, { align: 'right' });
      }

      // ✅ NEW: Split CGST and SGST
      if (order.gstEnabled && order.cgst > 0) {
        calcY += lineSpacing;
        doc.text(`CGST (${cgstPercentage}%):`, labelX, calcY);
        doc.text(formatCurrency(order.cgst), valX, calcY, { align: 'right' });

        calcY += lineSpacing;
        doc.text(`SGST (${sgstPercentage}%):`, labelX, calcY);
        doc.text(formatCurrency(order.sgst), valX, calcY, { align: 'right' });
      }

      // ✅ NEW: Show round-off if applicable
      if (Math.abs(roundOffAmount) > 0.01) {
        calcY += lineSpacing;
        doc.text('Round Off:', labelX, calcY);
        doc.text(roundOffAmount >= 0 ? `+ ${formatCurrency(Math.abs(roundOffAmount))}` : `- ${formatCurrency(Math.abs(roundOffAmount))}`, valX, calcY, { align: 'right' });
      }

      doc.setLineWidth(0.1);
      doc.line(totalBoxX, calcY + 4, pageWidth - margin, calcY + 4);

      calcY += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Net Payable:', labelX, calcY);
      doc.text(formatCurrency(roundedTotal), valX, calcY, { align: 'right' });

      // ✅ Add page numbers to footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
      }

      if (options.openInNewTab) {
        window.open(doc.output('bloburl'));
      } else {
        doc.save(`Challan_${order.challanNumber}.pdf`);
      }

      resolve(doc);
    } catch (e) { reject(e); }
  });
};

// Send Challan via WhatsApp (with delay)
export const sendChallanViaWhatsApp = async (order) => {
  return new Promise(async (resolve, reject) => {
    try {
      const SELLER_INFO = await challanSettingsService.getSettings();

      const challanNo = order.challanNumber || order._id.slice(-8).toUpperCase();
      const totalAmount = order.totalAmount.toFixed(2);
      const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN'); // ✅ FIXED: Use createdAt

      // Create professional WhatsApp message with GST info
      let message = `🧾 *DELIVERY CHALLAN*\n\nDear ${order.buyerName},\n\nYour challan has been generated successfully!\n\n📋 *Challan No:* ${challanNo}\n📅 *Date:* ${orderDate}\n📦 *Total Items:* ${totalQty}`;

      // ✅ Add fulfillment type
      const fulfillmentType = order.fulfillmentType || 'warehouse';
      if (fulfillmentType === 'factory_direct') {
        message += `\n🏭 *Type:* Factory Direct`;
      } else {
        message += `\n📦 *Type:* Warehouse`;
      }

      // Add GST info if enabled
      if (order.gstEnabled && order.gstAmount > 0) {
        message += `\n\n💰 *Subtotal:* Rs. ${(order.totalAmount - order.gstAmount).toFixed(2)}\n🧾 *GST:* Rs. ${order.gstAmount.toFixed(2)}`;
      }

      message += `\n\n💰 *Net Payable:* Rs. ${totalAmount}\n\n*From:* ${SELLER_INFO.businessName}\n📍 ${SELLER_INFO.address}\n📞 ${SELLER_INFO.mobile}\n\nThank you for your business! 🙏\n\n_Please download and review the attached PDF challan._`;

      // Format mobile number for WhatsApp
      let mobile = order.buyerContact.replace(/\D/g, '');
      if (!mobile.startsWith('91')) {
        mobile = '91' + mobile;
      }

      const whatsappUrl = 'https://wa.me/' + mobile + '?text=' + encodeURIComponent(message);

      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
        resolve();
      }, 1000);
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      reject(error);
    }
  });
};

// Helper function to convert number to words (Indian numbering system)
const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (num === 0) return 'Zero';

  num = Math.floor(num);

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = Math.floor((num % 1000) / 100);
  const remainder = num % 100;

  let words = '';

  if (crore > 0) {
    words += convertTwoDigit(crore, ones, tens, teens) + ' Crore ';
  }

  if (lakh > 0) {
    words += convertTwoDigit(lakh, ones, tens, teens) + ' Lakh ';
  }

  if (thousand > 0) {
    words += convertTwoDigit(thousand, ones, tens, teens) + ' Thousand ';
  }

  if (hundred > 0) {
    words += ones[hundred] + ' Hundred ';
  }

  if (remainder > 0) {
    words += convertTwoDigit(remainder, ones, tens, teens);
  }

  return words.trim();
};

// Helper to convert two-digit numbers
const convertTwoDigit = (num, ones, tens, teens) => {
  if (num < 10) {
    return ones[num];
  } else if (num >= 10 && num < 20) {
    return teens[num - 10];
  } else {
    const tensDigit = Math.floor(num / 10);
    const onesDigit = num % 10;
    return tens[tensDigit] + (onesDigit > 0 ? ' ' + ones[onesDigit] : '');
  }
};

export default { generateInvoice, sendChallanViaWhatsApp };
