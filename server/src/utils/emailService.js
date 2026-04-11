const nodemailer = require('nodemailer');
const Settings = require('../models/Settings'); // ✅ CHANGED: Use Settings instead of ChallanSettings

// Create transporter (configure with your email service)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ✅ UPDATED: Get business settings from Settings model
const getBusinessSettings = async () => {
  try {
    const settings = await Settings.findOne();
    return {
      businessName: settings?.companyName || 'VeeRaa Impex',
      email: settings?.email || process.env.EMAIL_USER,
      mobile: settings?.phone || '+91 9328822592',
      address: settings?.address || 'Surat'
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
      from: `"${businessSettings.businessName}" <${process.env.EMAIL_USER}>`,
      to: buyerEmail,
      subject: '⚠️ Credit Limit Warning - Action Required',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f44336; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .warning-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .details { background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>⚠️ Credit Limit Warning</h2>
            </div>
            <div class="content">
              <p>Dear <strong>${buyerName}</strong>,</p>
              
              <p>This is to inform you that your credit utilization has reached <strong>${creditUsagePercent}%</strong>.</p>
              
              <div class="details">
                <div class="detail-row">
                  <span><strong>Credit Limit:</strong></span>
                  <span>₹${creditLimit.toLocaleString('en-IN')}</span>
                </div>
                <div class="detail-row">
                  <span><strong>Current Due:</strong></span>
                  <span style="color: #f44336;">₹${totalDue.toLocaleString('en-IN')}</span>
                </div>
                <div class="detail-row">
                  <span><strong>Utilization:</strong></span>
                  <span style="color: #f44336;">${creditUsagePercent}%</span>
                </div>
              </div>

              <div class="warning-box">
                <p><strong>Action Required:</strong></p>
                <p>Please clear your pending dues at the earliest to avoid any service interruption.</p>
              </div>

              <p>If you have already made the payment, please ignore this email.</p>

              <div class="footer">
                <p><strong>${businessSettings.businessName}</strong></p>
                <p>${businessSettings.address}</p>
                <p>Email: ${businessSettings.email}</p>
                <p>Mobile: ${businessSettings.mobile}</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Credit limit warning email sent to ${buyerEmail}`);
  } catch (error) {
    console.error('Error sending credit limit warning email:', error);
    throw error;
  }
};

// Send payment reminder email
const sendPaymentReminder = async (buyerEmail, buyerName, amountDue, daysOverdue, pendingOrdersCount) => {
  try {
    const businessSettings = await getBusinessSettings();

    const mailOptions = {
      from: `"${businessSettings.businessName}" <${process.env.EMAIL_USER}>`,
      to: buyerEmail,
      subject: '💰 Payment Reminder - Pending Dues',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff9800; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .details { background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>💰 Payment Reminder</h2>
            </div>
            <div class="content">
              <p>Dear <strong>${buyerName}</strong>,</p>
              
              <p>This is a friendly reminder that you have pending payments.</p>
              
              <div class="details">
                <div class="detail-row">
                  <span><strong>Total Due:</strong></span>
                  <span style="color: #f44336; font-size: 18px;">₹${amountDue.toLocaleString('en-IN')}</span>
                </div>
                <div class="detail-row">
                  <span><strong>Days Overdue:</strong></span>
                  <span>${daysOverdue} days</span>
                </div>
                <div class="detail-row">
                  <span><strong>Pending Orders:</strong></span>
                  <span>${pendingOrdersCount}</span>
                </div>
              </div>

              <p>Please make the payment at your earliest convenience.</p>
              <p>If you have already made the payment, please ignore this email.</p>

              <div class="footer">
                <p><strong>${businessSettings.businessName}</strong></p>
                <p>${businessSettings.address}</p>
                <p>Email: ${businessSettings.email}</p>
                <p>Mobile: ${businessSettings.mobile}</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Payment reminder email sent to ${buyerEmail}`);
  } catch (error) {
    console.error('Error sending payment reminder email:', error);
    throw error;
  }
};

// Send wholesale order challan via email
const sendWholesaleChallan = async (buyerEmail, subject, text, pdfBuffer, filename) => {
  try {
    const businessSettings = await getBusinessSettings();

    const mailOptions = {
      from: `"${businessSettings.businessName}" <${process.env.EMAIL_USER}>`,
      to: buyerEmail,
      subject: subject,
      text: text,
      attachments: [
        {
          filename: filename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log(`Challan email sent to ${buyerEmail}`);
  } catch (error) {
    console.error('Error sending challan email:', error);
    throw error;
  }
};

const sendOTPEmail = async ({ toEmail, toName, otp }) => {
  const businessSettings = await getBusinessSettings();

  const mailOptions = {
    from: `"GarmentFlow Team" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${otp} is your GarmentFlow password reset OTP`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f0fdf4; }
          .wrapper { max-width: 520px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
          .header { background: linear-gradient(135deg, #022c22 0%, #065f46 100%); padding: 32px 40px; text-align: center; }
          .header-logo { font-size: 26px; font-weight: 900; color: #fff; letter-spacing: -0.03em; }
          .header-sub { font-size: 11px; color: rgba(110,231,183,.7); letter-spacing: .08em; text-transform: uppercase; margin-top: 4px; }
          .body { padding: 36px 40px; }
          .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
          .message { font-size: 14px; color: #475569; line-height: 1.7; margin-bottom: 26px; }
          .otp-box { background: #f0fdf4; border: 2px dashed #10b981; border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 26px; }
          .otp-label { font-size: 11px; font-weight: 700; color: #059669; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px; }
          .otp-code { font-size: 44px; font-weight: 900; color: #064e3b; letter-spacing: 0.2em; }
          .otp-expiry { font-size: 12px; color: #64748b; margin-top: 8px; }
          .warning { background: #fefce8; border-left: 4px solid #fbbf24; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #92400e; margin-bottom: 22px; line-height: 1.6; }
          .footer { background: #f8fafc; padding: 20px 40px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
          .footer strong { color: #059669; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <div class="header-logo">GarmentFlow</div>
            <div class="header-sub">Inventory System</div>
          </div>
          <div class="body">
            <div class="greeting">Hello, ${toName} 👋</div>
            <div class="message">
              We received a request to reset the password for your <strong>Admin</strong> account on GarmentFlow.
              Use the OTP below to verify your identity. It is valid for <strong>10 minutes only</strong>.
            </div>
            <div class="otp-box">
              <div class="otp-label">Your One-Time Password</div>
              <div class="otp-code">${otp}</div>
              <div class="otp-expiry">⏱ Expires in 10 minutes · Single use only</div>
            </div>
            <div class="warning">
              🔒 <strong>Never share this OTP</strong> with anyone. GarmentFlow staff will never ask for it.
              If you did not request a password reset, please ignore this email — your account is safe.
            </div>
          </div>
          <div class="footer">
            <p><strong>GarmentFlow</strong></p>
            <p>${businessSettings.address}</p>
            <p>Email: venrbd@gmail.com &nbsp;
            <p style="margin-top:10px;">© 2025 <strong>GarmentFlow</strong> Inventory System</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
  console.log(`✅ OTP email sent to ${toEmail}`);
};

module.exports = {
  sendCreditLimitWarning,
  sendPaymentReminder,
  sendWholesaleChallan,
  sendOTPEmail
};
