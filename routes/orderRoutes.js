const express = require('express');
const Order = require('../models/Order');
const { protect, admin } = require('../middleware/auth');
const { calculateDistance, calculateDeliveryCharge, geocodeAddress } = require('../utils/distanceCalculator');
const { generateOrderPDF } = require('../utils/pdfGenerator');
const { sendPickupReadyNotification } = require('../utils/notificationService');

const router = express.Router();

// Restaurant location (Bahnhof str.119, 47137 Duisburg)
const RESTAURANT_LOCATION = {
  lat: 51.4322,
  lng: 6.7611,
};

// @route   POST /api/orders
// @desc    Create a new order
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { items, totalAmount, customerName, customerEmail, paymentMethod, deliveryType, address } = req.body;

    console.log('=== ORDER CREATION ===');
    console.log('Delivery Type:', deliveryType);
    console.log('Address:', address);
    console.log('Subtotal received:', totalAmount);

    if (!items || items.length === 0 || !totalAmount || !customerName || !customerEmail) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    let distance = 0;
    let deliveryCharge = 0;

    // Calculate distance and delivery charge if delivery is selected
    if (deliveryType === 'delivery') {
      if (address && address.trim().length > 0) {
        try {
          console.log('Calculating delivery for address:', address);
          const customerLocation = await geocodeAddress(address);
          distance = calculateDistance(
            RESTAURANT_LOCATION.lat,
            RESTAURANT_LOCATION.lng,
            customerLocation.lat,
            customerLocation.lng
          );
          deliveryCharge = calculateDeliveryCharge(distance);
          console.log(`Distance: ${distance.toFixed(2)} km, Delivery Charge: €${deliveryCharge.toFixed(2)}`);
        } catch (error) {
          console.error('Error calculating distance:', error);
          // Use default distance for demo (8km = €2 charge)
          distance = 8.0;
          deliveryCharge = calculateDeliveryCharge(distance);
          console.log(`Using default distance: ${distance} km, Delivery Charge: €${deliveryCharge.toFixed(2)}`);
        }
      } else {
        // If delivery is selected but no address, use default charge (€2 for ≤10km)
        console.warn('Delivery selected but no address provided, using default charge');
        distance = 8.0;
        deliveryCharge = calculateDeliveryCharge(distance);
        console.log(`Default delivery charge: €${deliveryCharge.toFixed(2)}`);
      }
    }

    const finalTotal = parseFloat(totalAmount) + deliveryCharge;
    console.log(`Order total: Subtotal (€${parseFloat(totalAmount).toFixed(2)}) + Delivery (€${deliveryCharge.toFixed(2)}) = €${finalTotal.toFixed(2)}`);

    const order = await Order.create({
      user: req.user._id,
      items,
      totalAmount: finalTotal, // This includes delivery charge
      customerName,
      customerEmail,
      paymentMethod: paymentMethod || 'card',
      paymentStatus: 'completed',
      deliveryType: deliveryType || 'pickup',
      address: address || '',
      distance: distance,
      deliveryCharge: deliveryCharge,
    });

    console.log('=== ORDER CREATED ===');
    console.log('Order ID:', order._id);
    console.log('Delivery Type:', order.deliveryType);
    console.log('Subtotal:', parseFloat(totalAmount).toFixed(2));
    console.log('Delivery Charge:', order.deliveryCharge.toFixed(2));
    console.log('Final Total Amount:', order.totalAmount.toFixed(2));
    console.log('===================');

    // Emit new order event (will be handled by Socket.io in server.js)
    req.app.get('io').emit('newOrder', order);

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/orders
// @desc    Get all orders (admin) or user's orders
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let orders;
    if (req.user.isAdmin) {
      orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 });
    } else {
      orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    }
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/orders/:id
// @desc    Get single order by ID
// @access  Public (for tracking)
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private/Admin
router.put('/:id/status', protect, admin, async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const validStatuses = ['Pending', 'Preparing', 'Ready for Pickup', 'Out for Delivery', 'Delivered'];

    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }

    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const previousStatus = order.orderStatus;
    order.orderStatus = orderStatus;
    await order.save();

    // Convert order._id to string for Socket.io
    const orderIdString = order._id.toString();

    const io = req.app.get('io');
    // Emit to all clients (for admin dashboard)
    io.emit('orderStatusUpdate', { orderId: orderIdString, status: orderStatus });
    // Emit to specific order room (for customer tracking)
    io.to(`order:${orderIdString}`).emit('orderStatusUpdate', { orderId: orderIdString, status: orderStatus, order });

    // Send pickup ready notification if status changed to "Ready for Pickup"
    if (orderStatus === 'Ready for Pickup' && previousStatus !== 'Ready for Pickup') {
      try {
        await sendPickupReadyNotification(io, order);
      } catch (notificationError) {
        console.error('Notification error (non-blocking):', notificationError);
        // Don't fail the order update if notification fails
      }
    }

    res.json(order);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/orders/:id/print
// @desc    Get order print view (HTML for printing)
// @access  Private/Admin
router.get('/:id/print', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const htmlContent = generateOrderPDF(order);
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

