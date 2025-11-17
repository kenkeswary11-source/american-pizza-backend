const express = require('express');
const { calculateDistance, calculateDeliveryCharge, geocodeAddress } = require('../utils/distanceCalculator');

const router = express.Router();

// Restaurant location (Bahnhof str.119, 47137 Duisburg)
const RESTAURANT_LOCATION = {
  lat: 51.4322,
  lng: 6.7611,
};

// @route   POST /api/delivery/calculate
// @desc    Calculate delivery distance and charge
// @access  Public
router.post('/calculate', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ message: 'Address is required' });
    }

    try {
      const customerLocation = await geocodeAddress(address);
      const distance = calculateDistance(
        RESTAURANT_LOCATION.lat,
        RESTAURANT_LOCATION.lng,
        customerLocation.lat,
        customerLocation.lng
      );
      const deliveryCharge = calculateDeliveryCharge(distance);

      res.json({
        distance: parseFloat(distance.toFixed(2)),
        deliveryCharge: parseFloat(deliveryCharge.toFixed(2)),
      });
    } catch (error) {
      console.error('Error calculating distance:', error);
      // Return default values for demo (8km = €2 charge)
      res.json({
        distance: 8.0,
        deliveryCharge: 2.00,
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

