const express = require('express');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');

const router = express.Router();

// --------------------------------------------
// GET ALL PRODUCTS
// --------------------------------------------
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --------------------------------------------
// GET SINGLE PRODUCT
// --------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --------------------------------------------
// CREATE PRODUCT (ADMIN)
// --------------------------------------------
router.post('/', protect, admin, upload.single('image'), async (req, res) => {
  try {
    const { name, description, category, price, featured } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    // Cloudinary image URL
    const imageUrl = req.file.path;

    const product = await Product.create({
      name,
      description,
      category,
      price: parseFloat(price),
      image: imageUrl,
      featured: featured === 'true' || featured === true
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("Create Product Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// --------------------------------------------
// UPDATE PRODUCT (ADMIN)
// --------------------------------------------
router.put('/:id', protect, admin, upload.single('image'), async (req, res) => {
  try {
    const { name, description, category, price, featured } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (req.file) {
      // Delete old image from Cloudinary
      if (product.image) {
        const publicId = product.image.split("/").pop().split(".")[0];
        try {
          await cloudinary.uploader.destroy(`american_pizza_products/${publicId}`);
        } catch (err) {
          console.log("Cloudinary delete failed:", err);
        }
      }

      // Add new image URL
      product.image = req.file.path;
    }

    product.name = name || product.name;
    product.description = description || product.description;
    product.category = category || product.category;
    product.price = price ? parseFloat(price) : product.price;
    product.featured = featured !== undefined ? (featured === 'true' || featured === true) : product.featured;

    await product.save();
    res.json(product);

  } catch (error) {
    console.error("Update Product Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// --------------------------------------------
// DELETE PRODUCT (ADMIN)
// --------------------------------------------
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Delete Cloudinary image
    if (product.image) {
      const publicId = product.image.split("/").slice(-1)[0].split(".")[0];

      try {
        await cloudinary.uploader.destroy(`american_pizza_products/${publicId}`);
      } catch (err) {
        console.log("Cloudinary delete error:", err);
      }
    }

    await product.deleteOne();
    res.json({ message: 'Product deleted' });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
