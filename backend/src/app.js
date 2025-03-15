const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const containerRoutes = require('./routes/containerRoutes');


// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/containers', containerRoutes);
app.use('/api/containers/qrcode', cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  exposedHeaders: ['Content-Type']
}));


// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aqro')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/authRoutes');

// Use routes
app.use('/api/auth', authRoutes);

// Default route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to aQRo API' });
});
app.use('/api/activities', require('./routes/activityRoutes'));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;