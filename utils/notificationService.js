// Notification Service
// Handles sending notifications via multiple channels (WebSocket, Email, SMS)

// Optional dependencies - only loaded when needed
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // nodemailer not installed - email notifications will be skipped
}

/**
 * Send pickup ready notification via WebSocket
 * @param {Object} io - Socket.io instance
 * @param {Object} order - Order object
 */
const sendWebSocketNotification = (io, order) => {
  try {
    // Convert order._id to string if it's an ObjectId
    const orderId = order._id ? order._id.toString() : order._id;
    const orderNumber = orderId ? orderId.slice(-8) : 'N/A';

    // Emit to order-specific room
    io.to(`order:${orderId}`).emit('pickupReady', {
      orderId: orderId,
      orderNumber: orderNumber,
      message: 'Your order is ready for pickup!',
      order,
    });

    // Also emit to user-specific room if user is logged in
    if (order.user && order.user._id) {
      const userId = order.user._id.toString ? order.user._id.toString() : order.user._id;
      io.to(`user:${userId}`).emit('pickupReady', {
        orderId: orderId,
        orderNumber: orderNumber,
        message: 'Your order is ready for pickup!',
        order,
      });
    }
  } catch (error) {
    console.error('Error sending WebSocket notification:', error);
    // Don't throw - WebSocket failure shouldn't break order update
  }
};

/**
 * Send pickup ready notification via Email
 * @param {Object} order - Order object
 */
const sendEmailNotification = async (order) => {
  try {
    // Check if nodemailer is installed
    if (!nodemailer) {
      console.log('nodemailer not installed. Skipping email notification.');
      return;
    }

    // Check if email service is configured
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
      console.log('Email service not configured. Skipping email notification.');
      return;
    }

    // Create transporter (configure based on your email provider)
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"American Pizza" <${process.env.EMAIL_USER}>`,
      to: order.customerEmail,
      subject: '🍕 Your Order is Ready for Pickup!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(to right, #16a34a, #15803d); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">🍕 American Pizza</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #16a34a; margin-top: 0;">Your Order is Ready for Pickup!</h2>
            <p style="color: #374151; font-size: 16px;">Hello ${order.customerName},</p>
            <p style="color: #374151; font-size: 16px;">Great news! Your order <strong>#${order._id.slice(-8)}</strong> is ready for pickup.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
              <h3 style="margin-top: 0; color: #111827;">Order Details</h3>
              <p style="margin: 5px 0;"><strong>Order ID:</strong> ${order._id.slice(-8)}</strong></p>
              <p style="margin: 5px 0;"><strong>Total:</strong> $${order.totalAmount.toFixed(2)}</p>
              <p style="margin: 5px 0;"><strong>Items:</strong> ${order.items.length} item(s)</p>
            </div>

            <div style="background: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; color: #065f46; font-weight: bold; font-size: 18px;">
                📍 Pickup Location:<br>
                Bahnhof str.119, 47137 Duisburg
              </p>
            </div>

            <p style="color: #374151; font-size: 16px;">Please come to our restaurant to collect your order. We look forward to serving you!</p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',')[0] : ''}/tracking/${order._id}" 
                 style="background: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Track Your Order
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px; text-align: center;">
              Thank you for choosing American Pizza!<br>
              Contact: 015213759078 | kenkeswary11@icloud.com
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Pickup ready email sent to ${order.customerEmail}`);
  } catch (error) {
    console.error('Error sending email notification:', error);
    // Don't throw error - email failure shouldn't break the order update
  }
};

/**
 * Send pickup ready notification via SMS
 * @param {Object} order - Order object
 */
const sendSMSNotification = async (order) => {
  try {
    // Check if SMS service is configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.log('SMS service not configured. Skipping SMS notification.');
      return;
    }

    // Example using Twilio (uncomment and configure if needed)
    /*
    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Note: You'll need to store customer phone number in order/user model
    const phoneNumber = order.customerPhone || order.user?.phone;
    if (!phoneNumber) {
      console.log('No phone number available for SMS notification');
      return;
    }

    await client.messages.create({
      body: `🍕 Your American Pizza order #${order._id.slice(-8)} is ready for pickup! Visit us at Bahnhof str.119, 47137 Duisburg`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    console.log(`Pickup ready SMS sent to ${phoneNumber}`);
    */
    
    console.log('SMS notification feature ready (configure Twilio to enable)');
  } catch (error) {
    console.error('Error sending SMS notification:', error);
    // Don't throw error - SMS failure shouldn't break the order update
  }
};

/**
 * Send pickup ready notification via all configured channels
 * @param {Object} io - Socket.io instance
 * @param {Object} order - Order object
 */
const sendPickupReadyNotification = async (io, order) => {
  try {
    const orderId = order._id ? order._id.toString() : order._id;
    console.log(`Sending pickup ready notification for order ${orderId}`);

    // Always send WebSocket notification (real-time)
    sendWebSocketNotification(io, order);

    // Send email notification (if configured)
    if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
      await sendEmailNotification(order);
    }

    // Send SMS notification (if configured)
    if (process.env.ENABLE_SMS_NOTIFICATIONS === 'true') {
      await sendSMSNotification(order);
    }
  } catch (error) {
    console.error('Error in sendPickupReadyNotification:', error);
    // Don't throw - notification failure shouldn't break order update
  }
};

module.exports = {
  sendPickupReadyNotification,
  sendWebSocketNotification,
  sendEmailNotification,
  sendSMSNotification,
};

