const express = require('express');
const Offer = require('../models/Offer');
const { protect, admin } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// @route   GET /api/offers/all
// @desc    Get all offers (admin)
// @access  Private/Admin
router.get('/all', protect, admin, async (req, res) => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 });
    res.json(offers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/offers/:id
// @desc    Get single offer
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    res.json(offer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/offers
// @desc    Get all active offers
// @access  Public
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const offers = await Offer.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    }).sort({ createdAt: -1 });
    res.json(offers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/offers
// @desc    Create an offer
// @access  Private/Admin
router.post('/', protect, admin, upload.single('image'), async (req, res) => {
  try {
    console.log('POST /api/offers - Request received');
    console.log('Request body:', req.body);
    console.log('Uploaded file:', req.file);
    const { title, description, discount, code, validFrom, validUntil, minOrderAmount } = req.body;

    if (!title || !description || !discount || !code || !validFrom || !validUntil) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Validate discount range
    const discountNum = parseFloat(discount);
    if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) {
      return res.status(400).json({ message: 'Discount must be a number between 0 and 100' });
    }

    // Validate dates
    const fromDate = new Date(validFrom);
    const untilDate = new Date(validUntil);
    if (isNaN(fromDate.getTime()) || isNaN(untilDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    if (untilDate <= fromDate) {
      return res.status(400).json({ message: 'Valid until date must be after valid from date' });
    }

    // Check if code already exists
    const codeExists = await Offer.findOne({ code: code.toUpperCase() });
    if (codeExists) {
      return res.status(400).json({ message: 'Offer code already exists' });
    }

    const offer = await Offer.create({
      title: title.trim(),
      description: description.trim(),
      discount: discountNum,
      code: code.toUpperCase().trim(),
      validFrom: fromDate,
      validUntil: untilDate,
      minOrderAmount: minOrderAmount && minOrderAmount !== '' ? parseFloat(minOrderAmount) : 0,
      image: req.file ? req.file.filename : '',
    });

    res.status(201).json(offer);
  } catch (error) {
    console.error('Error creating offer:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message).join(', ');
      return res.status(400).json({ message: messages || 'Validation error' });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Offer code already exists' });
    }
    res.status(500).json({ message: error.message || 'Failed to create offer' });
  }
});

// @route   PUT /api/offers/:id
// @desc    Update an offer
// @access  Private/Admin
router.put('/:id', protect, admin, upload.single('image'), async (req, res) => {
  try {
    const { title, description, discount, code, validFrom, validUntil, isActive, minOrderAmount } = req.body;
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    if (title) offer.title = title;
    if (description) offer.description = description;
    if (discount !== undefined) offer.discount = parseFloat(discount);
    if (code) {
      // Check if new code conflicts with existing
      const codeExists = await Offer.findOne({ code: code.toUpperCase(), _id: { $ne: offer._id } });
      if (codeExists) {
        return res.status(400).json({ message: 'Offer code already exists' });
      }
      offer.code = code.toUpperCase();
    }
    if (validFrom) offer.validFrom = new Date(validFrom);
    if (validUntil) offer.validUntil = new Date(validUntil);
    if (isActive !== undefined) offer.isActive = isActive;
    if (minOrderAmount !== undefined) offer.minOrderAmount = parseFloat(minOrderAmount);
    // Update image only if a new file is uploaded
    if (req.file) {
      offer.image = req.file.filename;
    }

    await offer.save();
    res.json(offer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/offers/:id
// @desc    Delete an offer
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    await offer.deleteOne();
    res.json({ message: 'Offer deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

