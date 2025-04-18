require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const hoardingsRoutes = require('./routes/hoardings');

const app = express();

// Configure CORS
app.use(cors({
  origin: [
    'http://localhost:19000',
    'http://localhost:19001', 
    'http://localhost:19002',
    'http://localhost:8081',
    'exp://192.168.29.210:8081',
    'http://192.168.29.210:5000',
    'http://192.168.29.210:19000',
    'http://192.168.29.210:19001',
    'http://192.168.29.210:19002'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/hoardings', hoardingsRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}); 