// Load environment variables FIRST, before any other imports
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

let connectDB;
try {
  connectDB = require('./config/database');
} catch (error) {
  console.error('Error: Cannot find ./config/database.js');
  console.error('Current working directory:', __dirname);
  console.error('Make sure the config folder exists in your repository.');
  console.error('Original error:', error.message);
  process.exit(1);
}

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Development: allow localhost
    if (process.env.NODE_ENV !== 'production') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    // Allow Vercel domains (preview and production)
    if (origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    
    // Allow specific frontend URLs from environment
    if (process.env.FRONTEND_URL) {
      const allowedUrls = process.env.FRONTEND_URL.split(',').map(url => url.trim());
      // Check exact match or if origin starts with any allowed URL
      for (const allowedUrl of allowedUrls) {
        if (origin === allowedUrl || origin.startsWith(allowedUrl)) {
          return callback(null, true);
        }
      }
    }
    
    // Production: deny if no match
    if (process.env.NODE_ENV === 'production') {
      console.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }
    
    // Development fallback: allow
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

// Middleware
app.use(cors(corsOptions));

const io = socketIo(server, {
  cors: corsOptions
});

// Store io instance in app for use in routes
app.set('io', io);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// Serve uploaded images
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'American Pizza API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api',
      auth: '/api/auth',
      products: '/api/products',
      orders: '/api/orders',
      reviews: '/api/reviews',
      offers: '/api/offers',
      delivery: '/api/delivery',
      sales: '/api/sales'
    }
  });
});

// API root endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'American Pizza API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      orders: '/api/orders',
      reviews: '/api/reviews',
      offers: '/api/offers',
      delivery: '/api/delivery',
      sales: '/api/sales'
    }
  });
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/offers', require('./routes/offerRoutes'));
app.use('/api/delivery', require('./routes/deliveryRoutes'));
app.use('/api/sales', require('./routes/salesRoutes')); // New sales routes

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join order tracking room
  socket.on('joinOrderRoom', (orderId) => {
    socket.join(`order:${orderId}`);
    console.log(`Client ${socket.id} joined order room: order:${orderId}`);
  });

  // Leave order tracking room
  socket.on('leaveOrderRoom', (orderId) => {
    socket.leave(`order:${orderId}`);
    console.log(`Client ${socket.id} left order room: order:${orderId}`);
  });

  // Join user-specific room for notifications
  socket.on('joinUserRoom', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`Client ${socket.id} joined user room: user:${userId}`);
  });

  // Leave user-specific room
  socket.on('leaveUserRoom', (userId) => {
    socket.leave(`user:${userId}`);
    console.log(`Client ${socket.id} left user room: user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.FRONTEND_URL) {
    console.log(`Allowed frontend URLs: ${process.env.FRONTEND_URL}`);
  }
  console.log(`Health check: http://${HOST}:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

