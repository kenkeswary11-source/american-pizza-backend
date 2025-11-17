require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Get admin details from command line or use defaults
    const args = process.argv.slice(2);
    const name = args[0] || 'Admin';
    const email = args[1] || 'admin@pizza.com';
    const password = args[2] || 'admin123';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      if (existingAdmin.isAdmin) {
        console.log('Admin user already exists with this email!');
        process.exit(0);
      } else {
        // Update existing user to admin
        existingAdmin.isAdmin = true;
        await existingAdmin.save();
        console.log('✅ Existing user promoted to admin!');
        console.log(`Email: ${email}`);
        process.exit(0);
      }
    }

    // Create new admin user
    const admin = await User.create({
      name,
      email,
      password,
      isAdmin: true,
    });

    console.log('✅ Admin user created successfully!');
    console.log(`Name: ${admin.name}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Password: ${password}`);
    console.log('\nYou can now login with these credentials.');

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  }
};

createAdmin();

