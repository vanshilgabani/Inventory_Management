import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { settingsService } from '../services/settingsService';
import logo from '../assets/logo.png';

// Helper function to format currency
const formatCurrency = (n) => {
  if (n == null) return 'Rs. 0.00';
  return `Rs. ${Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

// Helper function to format date
const formatDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// Helper function to generate financial year based bill number
const generateBillNumber = (sequenceNumber, date = new Date()) => {
  const billDate = new Date(date);
  const month = billDate.getMonth(); // 0-11
  const year = billDate.getFullYear();
  
  // Financial year starts in April (month = 3)
  // If month is 0-2 (Jan-Mar), FY is previous year
  // If month is 3-11 (Apr-Dec), FY is current year
  const financialYear = month < 3 ? year - 1 : year;
  
  // Format: VR/YYYY/NN (e.g., VR/2025/01)
  const formattedNumber = String(sequenceNumber).padStart(2, '0');
  return `VR/${financialYear}/${formattedNumber}`;
};

/**
 * Consolidate items across all challans by per-unit price
 */
const consolidateItems = (challans) => {
  const priceMap = new Map();
  
  challans.forEach(challan => {
    if (!challan.items || challan.items.length === 0) {
      const perUnitPrice = parseFloat((challan.taxableAmount / challan.itemsQty).toFixed(2));
      if (priceMap.has(perUnitPrice)) {
        const existing = priceMap.get(perUnitPrice);
        existing.qty += challan.itemsQty;
        existing.amount += challan.taxableAmount;
      } else {
        priceMap.set(perUnitPrice, {
          price: perUnitPrice,
          qty: challan.itemsQty,
          amount: challan.taxableAmount
        });
      }
    } else {
      challan.items.forEach(item => {
        const perUnitPrice = parseFloat(Number(item.price).toFixed(2));
        const itemQuantity = Number(item.quantity);
        const calculatedAmount = itemQuantity * perUnitPrice;
        
        if (priceMap.has(perUnitPrice)) {
          const existing = priceMap.get(perUnitPrice);
          existing.qty += itemQuantity;
          existing.amount += calculatedAmount;
        } else {
          priceMap.set(perUnitPrice, {
            price: perUnitPrice,
            qty: itemQuantity,
            amount: calculatedAmount
          });
        }
      });
    }
  });

  const items = Array.from(priceMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map((entry, index) => ({
      description: `CARGO PANTS #${String(index + 9).padStart(2, '0')}`,
      hsn: '6203',
      qty: entry[1].qty,
      rate: entry[1].price,
      amount: parseFloat(entry[1].amount.toFixed(2))
    }));

  return items;
};

/**
 * Generate Monthly Bill PDF
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
      // 1. HEADER
      // ==========================================
      const headerStartY = 10;
      const headerHeight = 35;

      doc.setDrawColor(0);
      doc.setLineWidth(0.2);
      doc.rect(margin, headerStartY, contentWidth, headerHeight);

      const headerDividerX = margin + (contentWidth * 0.6);
      doc.line(headerDividerX, headerStartY, headerDividerX, headerStartY + headerHeight);

      try {
        doc.addImage(logo, 'PNG', margin + 3, headerStartY + 3, 20, 20);
      } catch (e) {
        console.error('Logo error:', e);
      }

      const companyTextX = margin + 26;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text((bill.company.name || 'COMPANY NAME').toUpperCase(), companyTextX, headerStartY + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      // Build full address with line1 and line2
      let addressParts = [];
      if (bill.company.address?.line1) addressParts.push(bill.company.address.line1);
      if (bill.company.address?.line2) addressParts.push(bill.company.address.line2);
      if (bill.company.address?.city) addressParts.push(bill.company.address.city);
      if (bill.company.address?.state && bill.company.address?.pincode) {
        addressParts.push(`${bill.company.address.state} - ${bill.company.address.pincode}`);
      } else if (bill.company.address?.state) {
        addressParts.push(bill.company.address.state);
      } else if (bill.company.address?.pincode) {
        addressParts.push(bill.company.address.pincode);
      }
      const addressStr = addressParts.join(' ');

      const addressLines = doc.splitTextToSize(addressStr, headerDividerX - companyTextX - 5);
      doc.text(addressLines, companyTextX, headerStartY + 13);

      let contactY = headerStartY + 22;
      doc.text(`Phone: ${bill.company.contact?.phone || 'N/A'}`, companyTextX, contactY);
      contactY += 4;
      doc.text(`Email: ${bill.company.contact?.email || 'N/A'}`, companyTextX, contactY);
      contactY += 4;
      doc.text(`GSTIN: ${bill.company.gstin || 'N/A'}`, companyTextX, contactY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      const taxInvoiceX = headerDividerX + ((pageWidth - margin - headerDividerX) / 2);
      doc.text('TAX INVOICE', taxInvoiceX, headerStartY + 8, { align: 'center' });

      doc.setLineWidth(0.2);
      doc.line(headerDividerX + 2, headerStartY + 10, pageWidth - margin - 2, headerStartY + 10);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const LabelX = headerDividerX + 3;
      const valueX = pageWidth - margin - 3;

      let invoiceY = headerStartY + 16;
      doc.text('INVOICE NO.:', LabelX, invoiceY);
      doc.setFont('helvetica', 'normal');
      doc.text(bill.billNumber || '', valueX, invoiceY, { align: 'right' });

      invoiceY += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('DATE:', LabelX, invoiceY);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(bill.generatedAt), valueX, invoiceY, { align: 'right' });

      if (bill.company.pan) {
        invoiceY += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('PAN NO.:', LabelX, invoiceY);
        doc.setFont('helvetica', 'normal');
        doc.text(bill.company.pan, valueX, invoiceY, { align: 'right' });
      }

      // ==========================================
      // 2. BILL TO + BANK (FIXED - A/C Name on same line)
      // ==========================================
      const section2Y = headerStartY + headerHeight;
      const section2Height = 35;

      doc.rect(margin, section2Y, contentWidth, section2Height);
      const section2DividerX = margin + (contentWidth * 0.6);
      doc.line(section2DividerX, section2Y, section2DividerX, section2Y + section2Height);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('BILL TO:', margin + 3, section2Y + 6);

      // Business name inline with "BILL TO:"
      doc.setFontSize(11);
      const buyerName = (bill.buyer.businessName || bill.buyer.name || '').toUpperCase();
      doc.text(buyerName, margin + 22, section2Y + 6);

      // Address below
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      let billToY = section2Y + 12;

      if (bill.buyer.address) {
        const buyerAddressLines = doc.splitTextToSize(bill.buyer.address, section2DividerX - margin - 6);
        doc.text(buyerAddressLines, margin + 3, billToY);
        billToY += (buyerAddressLines.length * 4) + 1;
      }

      // GSTIN and PAN on same line (if available)
      let gstPanLine = '';
      if (bill.buyer.gstin) {
        gstPanLine += `GSTIN: ${bill.buyer.gstin}`;
      }
      if (bill.buyer.pan) {
        if (gstPanLine) gstPanLine += ' | ';
        gstPanLine += `PAN: ${bill.buyer.pan}`;
      }
      if (gstPanLine) {
        doc.text(gstPanLine, margin + 3, billToY);
        billToY += 4;
      }

      // Mobile number
      if (bill.buyer.mobile) {
        doc.text(`Mobile: ${bill.buyer.mobile}`, margin + 3, billToY);
        billToY += 4;
      }

      // State Code (if still needed)
      if (bill.buyer.stateCode) {
        doc.text(`State Code: ${bill.buyer.stateCode}`, margin + 3, billToY);
      }

      // ✅ FIXED: Bank Details on same line
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('BANK DETAILS:', section2DividerX + 3, section2Y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      let bankY = section2Y + 12;

      if (bill.company.bank?.name) {
        // A/C Name on same line
        doc.setFont('helvetica', 'bold');
        doc.text('A/C Name:', section2DividerX + 3, bankY);
        doc.setFont('helvetica', 'normal');
        doc.text(bill.company.name || 'N/A', section2DividerX + 30, bankY);
        
        bankY += 5;
        
        doc.setFont('helvetica', 'bold');
        doc.text('Bank:', section2DividerX + 3, bankY);
        doc.setFont('helvetica', 'normal');
        doc.text(bill.company.bank.name || 'N/A', section2DividerX + 30, bankY);

        bankY += 5;
        
        doc.setFont('helvetica', 'bold');
        doc.text('A/C No:', section2DividerX + 3, bankY);
        doc.setFont('helvetica', 'normal');
        doc.text(bill.company.bank.accountNo || 'N/A', section2DividerX + 30, bankY);

        bankY += 5;
        
        doc.setFont('helvetica', 'bold');
        doc.text('IFSC:', section2DividerX + 3, bankY);
        doc.setFont('helvetica', 'normal');
        doc.text(bill.company.bank.ifsc || 'N/A', section2DividerX + 30, bankY);
      } else {
        doc.text('Bank details not available', section2DividerX + 3, bankY);
      }

      // ==========================================
      // 3. ITEMS TABLE - FIXED (No double display + Add blank rows)
      // ==========================================
      const itemsTableY = section2Y + section2Height;
      const consolidatedItems = consolidateItems(bill.challans || []);
      const totalQuantity = consolidatedItems.reduce((sum, item) => sum + item.qty, 0);

      // ✅ FIXED: Add blank rows to fit A4 paper
      const minRows = 12; // Adjust this number based on desired spacing
      const tableData = [];

      consolidatedItems.forEach((item, index) => {
        tableData.push([
          index + 1,
          item.description,
          item.hsn,
          item.qty,
          item.rate,
          item.amount
        ]);
      });

      // Add blank rows for A4 padding
      for (let i = consolidatedItems.length; i < minRows; i++) {
        tableData.push(['', '', '', '', '', '']);
      }

      tableData.push([
        '',
        '',
        'TOTAL',
        totalQuantity,
        '',
        ''
      ]);

      autoTable(doc, {
        startY: itemsTableY,
        head: [['Sr.', 'DESCRIPTION OF GOODS', 'HSN', 'QTY', 'RATE(Rs.)', 'AMOUNT(Rs.)']],
        body: tableData,
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: 3,
          lineColor: 0,
          lineWidth: 0.2,
          textColor: 0
        },
        headStyles: {
          fillColor: [240, 240, 240],
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'left', cellWidth: 'auto' },
          2: { halign: 'center', cellWidth: 18 },
          3: { halign: 'center', cellWidth: 18 },
          4: { halign: 'center', cellWidth: 28 },
          5: { halign: 'center', cellWidth: 32 }
        },
        margin: { left: margin, right: margin },
        tableLineWidth: 0.2,
        tableLineColor: 0,

        didDrawCell: function (data) {
          // Make total row bold
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
          }
        }
      });

      // ==========================================
      // 4. TOTALS
      // ==========================================
      let finalY = doc.lastAutoTable.finalY;
      const totalsHeight = 55;

      doc.rect(margin, finalY, contentWidth, totalsHeight);

      const totalsDividerX = margin + (contentWidth * 0.6);
      doc.line(totalsDividerX, finalY, totalsDividerX, finalY + totalsHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('NET PAYABLE IN WORDS:', margin + 3, finalY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      const amountWords = numberToWords(Math.round(bill.financials.grandTotal));
      const wordsLines = doc.splitTextToSize(amountWords.toUpperCase() + ' ONLY', totalsDividerX - margin - 6);
      doc.text(wordsLines, margin + 3, finalY + 18);

      const sigLineY = finalY + totalsHeight - 6;
      doc.setLineWidth(0.1);
      doc.line(margin + 3, sigLineY, totalsDividerX - 3, sigLineY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text("Receiver's Signature", margin + 3, finalY + totalsHeight - 1);
      doc.text("Authorised Signature", totalsDividerX - 5, finalY + totalsHeight - 1, { align: 'right' });

      // RIGHT SIDE - FINANCIAL SUMMARY
      let calcY = finalY + 8;
      const lineSpacing = 5.5;
      const valX = pageWidth - margin - 2;
      const sumLabelX = totalsDividerX + 3;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      doc.text('Subtotal:', sumLabelX, calcY);
      doc.text(formatCurrency(bill.financials.totalTaxableAmount), valX, calcY, { align: 'right' });

      calcY += lineSpacing;
      doc.text(`CGST (${(bill.financials.gstRate / 2).toFixed(1)}%):`, sumLabelX, calcY);
      doc.text(formatCurrency(bill.financials.cgst), valX, calcY, { align: 'right' });

      calcY += lineSpacing;
      doc.text(`SGST (${(bill.financials.gstRate / 2).toFixed(1)}%):`, sumLabelX, calcY);
      doc.text(formatCurrency(bill.financials.sgst), valX, calcY, { align: 'right' });

      calcY += lineSpacing;
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL TAX:', sumLabelX, calcY);
      doc.text(formatCurrency(bill.financials.cgst + bill.financials.sgst), valX, calcY, { align: 'right' });

      calcY += 4;
      doc.setLineWidth(0.1);
      doc.line(totalsDividerX, calcY, pageWidth - margin, calcY);

      calcY += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('NET PAYABLE:', sumLabelX, calcY);
      doc.text(formatCurrency(bill.financials.grandTotal), valX, calcY, { align: 'right' });

      if (options.openInNewTab) {
        window.open(doc.output('bloburl'));
      } else {
        doc.save(`Invoice_${bill.billNumber}.pdf`);
      }

      resolve(doc);
    } catch (e) {
      console.error('PDF Generation Error:', e);
      reject(e);
    }
  });
};

export const sendMonthlyBillViaWhatsApp = async (bill) => {
  return new Promise(async (resolve, reject) => {
    try {
      const settings = await settingsService.getSettings();

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
      message += `• Subtotal: Rs. ${bill.financials.totalTaxableAmount.toFixed(2)}\n`;
      message += `• GST (${bill.financials.gstRate}%): Rs. ${(bill.financials.cgst + bill.financials.sgst).toFixed(2)}\n`;
      message += `\n💰 *NET PAYABLE: Rs. ${bill.financials.grandTotal.toFixed(2)}*\n`;

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

      let mobile = bill.buyer.mobile.replace(/\D/g, '');
      if (!mobile.startsWith('91')) {
        mobile = '91' + mobile;
      }

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

const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (num === 0) return 'Zero Rupees';
  num = Math.floor(num);

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = Math.floor((num % 1000) / 100);
  const remainder = num % 100;

  let words = '';
  if (crore > 0) words += convertTwoDigit(crore, ones, tens, teens) + ' Crore ';
  if (lakh > 0) words += convertTwoDigit(lakh, ones, tens, teens) + ' Lakh ';
  if (thousand > 0) words += convertTwoDigit(thousand, ones, tens, teens) + ' Thousand ';
  if (hundred > 0) words += ones[hundred] + ' Hundred ';
  if (remainder > 0) words += convertTwoDigit(remainder, ones, tens, teens);

  return words.trim() + ' Rupees';
};

const convertTwoDigit = (num, ones, tens, teens) => {
  if (num < 10) return ones[num];
  else if (num >= 10 && num < 20) return teens[num - 10];
  else {
    const tensDigit = Math.floor(num / 10);
    const onesDigit = num % 10;
    return tens[tensDigit] + (onesDigit > 0 ? ' ' + ones[onesDigit] : '');
  }
};

export default { generateMonthlyBillPDF, sendMonthlyBillViaWhatsApp };
