const nodemailer = require('nodemailer');
const ChallanSettings = require('../models/ChallanSettings');

// Create transporter (configure with your email service)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Get business settings
const getBusinessSettings = async () => {
  try {
    const settings = await ChallanSettings.findOne();
    return settings || {
      businessName: 'VeeRaa Impex',
      email: process.env.EMAIL_USER,
      mobile: '+91 9328822592',
      address: 'Surat'
    };
  } catch (error) {
    console.error('Error fetching business settings:', error);
    return {
      businessName: 'VeeRaa Impex',
      email: process.env.EMAIL_USER,
      mobile: '+91 9328822592',
      address: 'Surat'
    };
  }
};

// Send credit limit warning email
const sendCreditLimitWarning = async (buyerEmail, buyerName, creditUsagePercent, creditLimit, totalDue) => {
  try {
    const businessSettings = await getBusinessSettings();
    
    const mailOptions = {
      from: `"${businessSettings.businessName}" <${process.env.EMAIL_USER}>`,  // ✅ Show business name as sender
      to: buyerEmail,
      subject: '⚠️ Credit Limit Warning - Action Required',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f97316;">⚠️ Credit Limit Warning</h2>
          <p>Dear ${buyerName},</p>
          <p>This is to inform you that your credit utilization has reached <strong>${creditUsagePercent}%</strong>.</p>
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Credit Limit:</strong> ₹${creditLimit.toLocaleString('en-IN')}</p>
            <p style="margin: 5px 0;"><strong>Current Due:</strong> ₹${totalDue.toLocaleString('en-IN')}</p>
            <p style="margin: 5px 0;"><strong>Utilization:</strong> ${creditUsagePercent}%</p>
          </div>
          
          <p>Please clear your pending dues at the earliest to avoid any service interruption.</p>
          
          <p>If you have already made the payment, please ignore this email.</p>
          
          <p>Best regards,<br><strong>${businessSettings.businessName}</strong></p>
          <p style="color: #666; font-size: 12px;">
            ${businessSettings.address}<br>
            Email: ${businessSettings.email}<br>
            Mobile: ${businessSettings.mobile}
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

// Send overdue payment reminder
const sendOverduePaymentReminder = async (buyerEmail, buyerName, amountDue, daysOverdue, pendingOrdersCount) => {
  try {
    const businessSettings = await getBusinessSettings();
    
    const mailOptions = {
      from: `"${businessSettings.businessName}" <${process.env.EMAIL_USER}>`,  // ✅ Show business name as sender
      to: buyerEmail,
      subject: `🔔 Payment Reminder - ${daysOverdue} Days Overdue`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">🔔 Payment Reminder</h2>
          <p>Dear ${buyerName},</p>
          <p>This is a friendly reminder that you have pending payments.</p>
          
          <div style="background: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Total Due:</strong> ₹${amountDue.toLocaleString('en-IN')}</p>
            <p style="margin: 5px 0;"><strong>Days Overdue:</strong> ${daysOverdue} days</p>
            <p style="margin: 5px 0;"><strong>Pending Orders:</strong> ${pendingOrdersCount}</p>
          </div>
          
          <p>Please make the payment at your earliest convenience.</p>
          
          <p>If you have already made the payment, please ignore this email.</p>
          
          <p>Best regards,<br><strong>${businessSettings.businessName}</strong></p>
          <p style="color: #666; font-size: 12px;">
            ${businessSettings.address}<br>
            Email: ${businessSettings.email}<br>
            Mobile: ${businessSettings.mobile}
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

// Send wholesale challan email with PDF attachment
const sendWholesaleChallan = async (to, subject, text, pdfBuffer, fileName) => {
  if (!to || !pdfBuffer) {
    console.log('❌ Missing email or PDF buffer');
    return;
  }

  const businessSettings = await getBusinessSettings();

  const mailOptions = {
    from: `${businessSettings.businessName} <${process.env.EMAIL_USER}>`,
    to,
    subject: subject || `Delivery Challan - ${businessSettings.businessName}`,
    text: text || 'Please find attached your delivery challan.',
    attachments: [
      {
        filename: fileName || 'challan.pdf',
        content: pdfBuffer,
      },
    ],
  };

  try {
    console.log('📧 Attempting to send email to:', to);
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    console.log('📬 Preview URL:', nodemailer.getTestMessageUrl(info)); // For testing
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    console.error('Full error:', error);
    return { success: false, error: error.message };
  }
};

// Update module.exports to include sendWholesaleChallan
module.exports = {
  sendCreditLimitWarning,
  sendOverduePaymentReminder,
  sendWholesaleChallan, // ✅ ADD THIS
};
