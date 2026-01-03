import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { settingsService } from '../services/settingsService';
import logo from '../assets/logo.png';

// Helper function to format currency
const formatCurrency = (n) => {
  if (n == null) return '₹ 0.00';
  return `₹ ${Number(n).toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};

// Helper function to format date
const formatDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

/**
 * Generate Monthly Bill PDF
 * @param {Object} bill - Monthly bill object
 * @param {Object} options - PDF generation options
 */
export const generateMonthlyBillPDF = async (bill, options = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      const settings = await settingsService.getSettings();
      const doc = new jsPDF('p', 'mm', 'a4');
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);

      // ==========================================
      // 1. HEADER SECTION
      // ==========================================
      const headerStartY = 10;
      const headerHeight = 40;
      
      doc.setDrawColor(0);
      doc.setLineWidth(0.2);
      doc.rect(margin, headerStartY, contentWidth, headerHeight);

      // --- LEFT: Logo & Company Name ---
      try {
        doc.addImage(logo, 'PNG', margin + 2, headerStartY + 2, 25, 25);
      } catch (e) { console.error('Logo error', e); }

      const textLeftX = margin + 30;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text((bill.company.name || 'COMPANY NAME').toUpperCase(), textLeftX, headerStartY + 10);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const addressStr = `${bill.company.address?.line1 || ''}, ${bill.company.address?.city || ''}, ${bill.company.address?.state || ''} - ${bill.company.address?.pincode || ''}`;
      const addressLines = doc.splitTextToSize(addressStr, contentWidth * 0.55);
      doc.text(addressLines, textLeftX, headerStartY + 16);

      // --- RIGHT: Contact Info ---
      const rightColX = pageWidth - margin - 5;
      const contactStartY = headerStartY + 10;
      const contactLineHeight = 5;
      
      doc.text(`Email: ${bill.company.contact?.email || ''}`, rightColX, contactStartY, { align: 'right' });
      doc.text(`Phone: ${bill.company.contact?.phone || ''}`, rightColX, contactStartY + contactLineHeight, { align: 'right' });
      doc.text(`GSTIN: ${bill.company.gstin || ''}`, rightColX, contactStartY + (contactLineHeight * 2), { align: 'right' });

      // ==========================================
      // 2. INVOICE TITLE & DETAILS
      // ==========================================
      const invoiceY = headerStartY + headerHeight;
      const invoiceHeight = 45;
      
      doc.rect(margin, invoiceY, contentWidth, invoiceHeight);

      // --- Title ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('TAX INVOICE', pageWidth / 2, invoiceY + 10, { align: 'center' });

      // --- Vertical Divider ---
      const splitX = margin + (contentWidth * 0.60);
      doc.line(splitX, invoiceY, splitX, invoiceY + invoiceHeight);

      // --- LEFT: Bill To ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Bill To:', margin + 3, invoiceY + 20);
      
      doc.setFontSize(11);
      doc.text((bill.buyer.businessName || bill.buyer.name || '').toUpperCase(), margin + 3, invoiceY + 26);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(bill.buyer.address || '', margin + 3, invoiceY + 31);
      doc.text(`Mobile: ${bill.buyer.mobile}`, margin + 3, invoiceY + 36);
      if (bill.buyer.gstin) {
        doc.text(`GSTIN: ${bill.buyer.gstin}`, margin + 3, invoiceY + 41);
      }

      // --- RIGHT: Invoice Details ---
      const labelX = splitX + 5;
      const valueX = rightColX;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Invoice No:', labelX, invoiceY + 20);
      doc.setFont('helvetica', 'normal');
      doc.text(bill.billNumber || '', valueX, invoiceY + 20, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text('Invoice Date:', labelX, invoiceY + 26);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(bill.generatedAt), valueX, invoiceY + 26, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text('Due Date:', labelX, invoiceY + 32);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(bill.paymentDueDate), valueX, invoiceY + 32, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text('Period:', labelX, invoiceY + 38);
      doc.setFont('helvetica', 'normal');
      doc.text(`${bill.billingPeriod.month} ${bill.billingPeriod.year}`, valueX, invoiceY + 38, { align: 'right' });

      // ==========================================
      // 3. CHALLANS TABLE
      // ==========================================
      const challansTableY = invoiceY + invoiceHeight;
      
      const challansHead = [['Sr.', 'Challan No.', 'Date', 'Qty', 'Taxable Amt', 'GST', 'Total']];
      const challansBody = (bill.challans || []).map((challan, index) => [
        index + 1,
        challan.challanNumber,
        formatDate(challan.challanDate),
        `${challan.itemsQty} Pcs`,
        formatCurrency(challan.taxableAmount),
        formatCurrency(challan.gstAmount),
        formatCurrency(challan.totalAmount)
      ]);

      autoTable(doc, {
        startY: challansTableY,
        head: challansHead,
        body: challansBody,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 3,
          lineColor: 0,
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [52, 152, 219],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 15 },
          1: { halign: 'left', cellWidth: 35 },
          2: { halign: 'center', cellWidth: 25 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'right', cellWidth: 30 },
          5: { halign: 'right', cellWidth: 25 },
          6: { halign: 'right', cellWidth: 30 }
        },
        margin: { left: margin, right: margin }
      });

      // ==========================================
      // 4. TOTALS SECTION
      // ==========================================
      let finalY = doc.lastAutoTable.finalY + 5;
      
      if (finalY > pageHeight - 70) {
        doc.addPage();
        finalY = margin;
      }

      const totalsHeight = 50;
      doc.rect(margin, finalY, contentWidth, totalsHeight);

      // --- Vertical divider ---
      const totalsSplitX = pageWidth - margin - 80;
      doc.line(totalsSplitX, finalY, totalsSplitX, finalY + totalsHeight);

      // --- LEFT: Amount in Words ---
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Amount in Words:', margin + 3, finalY + 8);
      
      doc.setFont('helvetica', 'bold');
      const amountWords = numberToWords(Math.round(bill.financials.grandTotal));
      const wordsLines = doc.splitTextToSize(amountWords + ' Only', totalsSplitX - margin - 5);
      doc.text(wordsLines, margin + 3, finalY + 14);

      // Signatures
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text("Receiver's Signature", margin + 3, finalY + totalsHeight - 5);
      doc.text("Authorised Signatory", totalsSplitX - 5, finalY + totalsHeight - 5, { align: 'right' });

      // --- RIGHT: Financial Summary ---
      let calcY = finalY + 8;
      const lineSpacing = 6;
      const labelXRight = totalsSplitX + 5;
      const valueXRight = pageWidth - margin - 3;

      doc.setFont('helvetica', 'normal');
      doc.text('Taxable Amount:', labelXRight, calcY);
      doc.text(formatCurrency(bill.financials.totalTaxableAmount), valueXRight, calcY, { align: 'right' });

      calcY += lineSpacing;
      doc.text(`CGST (${bill.financials.gstRate / 2}%):`, labelXRight, calcY);
      doc.text(formatCurrency(bill.financials.cgst), valueXRight, calcY, { align: 'right' });

      calcY += lineSpacing;
      doc.text(`SGST (${bill.financials.gstRate / 2}%):`, labelXRight, calcY);
      doc.text(formatCurrency(bill.financials.sgst), valueXRight, calcY, { align: 'right' });

      // Line separator
      calcY += 4;
      doc.setLineWidth(0.1);
      doc.line(totalsSplitX, calcY, pageWidth - margin, calcY);

      calcY += 6;
      doc.setFont('helvetica', 'bold');
      doc.text('Invoice Total:', labelXRight, calcY);
      doc.text(formatCurrency(bill.financials.invoiceTotal), valueXRight, calcY, { align: 'right' });

      // Previous Outstanding (if any)
      if (bill.financials.previousOutstanding > 0) {
        calcY += lineSpacing;
        doc.setFont('helvetica', 'normal');
        doc.text('Previous Outstanding:', labelXRight, calcY);
        doc.text(formatCurrency(bill.financials.previousOutstanding), valueXRight, calcY, { align: 'right' });
      }

      // Line separator
      calcY += 4;
      doc.setLineWidth(0.2);
      doc.line(totalsSplitX, calcY, pageWidth - margin, calcY);

      // Grand Total
      calcY += 7;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('GRAND TOTAL:', labelXRight, calcY);
      doc.text(formatCurrency(bill.financials.grandTotal), valueXRight, calcY, { align: 'right' });

      // ==========================================
      // 5. FOOTER
      // ==========================================
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text('This is a computer-generated invoice.', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Page numbers
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
      }

      // Output
      if (options.openInNewTab) {
        window.open(doc.output('bloburl'));
      } else {
        doc.save(`Invoice_${bill.billNumber}.pdf`);
      }

      resolve(doc);
    } catch (e) {
      reject(e);
    }
  });
};

/**
 * Send Monthly Bill via WhatsApp
 * @param {Object} bill - Monthly bill object
 */
export const sendMonthlyBillViaWhatsApp = async (bill) => {
  return new Promise(async (resolve, reject) => {
    try {
      const settings = await settingsService.getSettings();
      
      // Format message
      let message = `🧾 *TAX INVOICE*\n\nDear ${bill.buyer.name},\n\nYour monthly invoice is ready!\n\n`;
      message += `📋 *Invoice No:* ${bill.billNumber}\n`;
      message += `📅 *Date:* ${new Date(bill.generatedAt).toLocaleDateString('en-IN')}\n`;
      message += `📆 *Period:* ${bill.billingPeriod.month} ${bill.billingPeriod.year}\n`;
      message += `🏭 *Company:* ${bill.company.name}\n\n`;

      message += `📦 *Summary:*\n`;
      message += `• Total Challans: ${bill.challans.length}\n`;
      const totalQty = bill.challans.reduce((sum, c) => sum + c.itemsQty, 0);
      message += `• Total Items: ${totalQty} pcs\n\n`;

      message += `💰 *Financial Details:*\n`;
      message += `• Taxable Amount: Rs. ${bill.financials.totalTaxableAmount.toFixed(2)}\n`;
      message += `• GST (${bill.financials.gstRate}%): Rs. ${(bill.financials.cgst + bill.financials.sgst).toFixed(2)}\n`;
      message += `• Invoice Total: Rs. ${bill.financials.invoiceTotal.toFixed(2)}\n`;

      if (bill.financials.previousOutstanding > 0) {
        message += `• Previous Outstanding: Rs. ${bill.financials.previousOutstanding.toFixed(2)}\n`;
      }

      message += `\n💰 *GRAND TOTAL: Rs. ${bill.financials.grandTotal.toFixed(2)}*\n`;

      if (bill.financials.amountPaid > 0) {
        message += `💳 *Paid: Rs. ${bill.financials.amountPaid.toFixed(2)}*\n`;
        message += `⏳ *Balance Due: Rs. ${bill.financials.balanceDue.toFixed(2)}*\n`;
      } else {
        message += `⏳ *Due Date:* ${new Date(bill.paymentDueDate).toLocaleDateString('en-IN')}\n`;
      }

      message += `\n*From:* ${settings.companyName}\n`;
      message += `📍 ${settings.address}\n`;
      message += `📞 ${settings.phone}\n\n`;
      message += `Thank you for your business! 🙏\n\n`;
      message += `_Please download the PDF invoice for complete details._`;

      // Format mobile number
      let mobile = bill.buyer.mobile.replace(/\D/g, '');
      if (!mobile.startsWith('91')) {
        mobile = '91' + mobile;
      }

      // Open WhatsApp
      const whatsappUrl = `https://wa.me/${mobile}?text=${encodeURIComponent(message)}`;
      
      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
        resolve();
      }, 500);

    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      reject(error);
    }
  });
};

// Helper: Convert number to words (Indian format)
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

export default { generateMonthlyBillPDF, sendMonthlyBillViaWhatsApp };
