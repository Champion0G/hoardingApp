const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Hoarding = require('../models/Hoarding');

// Add a new hoarding (protected route)
router.post('/add', auth, async (req, res) => {
  try {
    // Check if user is authorized
    if (req.user.role !== 'authorized') {
      return res.status(403).json({ error: 'Only authorized users can add hoardings' });
    }

    const { title, description, location, price, size, address, availability } = req.body;
    
    console.log('Received request body:', JSON.stringify(req.body, null, 2));

    // Validate location coordinates
    if (!location || !location.coordinates || !Array.isArray(location.coordinates) || 
        location.coordinates.length !== 2) {
      return res.status(400).json({ 
        error: 'Invalid location format. Expected {type: "Point", coordinates: [longitude, latitude]}',
        receivedLocation: location 
      });
    }

    // Convert coordinates to numbers and validate
    const coordinates = location.coordinates.map(coord => parseFloat(coord));
    
    if (coordinates.some(coord => isNaN(coord))) {
      return res.status(400).json({ 
        error: 'Invalid coordinates. Both values must be valid numbers.',
        receivedCoordinates: coordinates
      });
    }

    const [longitude, latitude] = coordinates;

    // Validate coordinate ranges
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      return res.status(400).json({ 
        error: 'Coordinates out of range. Longitude must be between -180 and 180, latitude between -90 and 90.',
        receivedCoordinates: [longitude, latitude]
      });
    }

    // Create hoarding with validated coordinates
    const hoarding = new Hoarding({
      title: title.trim(),
      description: description.trim(),
      location: {
        type: 'Point',
        coordinates: coordinates
      },
      price: parseFloat(price),
      size: size.trim(),
      address: address ? address.trim() : undefined,
      availability: !!availability,
      createdBy: req.user._id
    });

    console.log('Saving hoarding:', JSON.stringify(hoarding.toObject(), null, 2));

    await hoarding.save();
    res.status(201).json(hoarding);
  } catch (error) {
    console.error('Error adding hoarding:', error);
    res.status(400).json({ 
      error: error.message,
      details: error.toString()
    });
  }
});

// Get nearby hoardings
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query; // radius in meters, default 5km

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const hoardings = await Hoarding.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: parseInt(radius),
        },
      },
    }).populate('createdBy', 'email');

    res.json(hoardings);
  } catch (error) {
    console.error('Error fetching nearby hoardings:', error);
    res.status(500).json({ error: 'Error fetching nearby hoardings' });
  }
});

// Get all hoardings
router.get('/', async (req, res) => {
  try {
    const hoardings = await Hoarding.find().populate('createdBy', 'email');
    res.json(hoardings);
  } catch (error) {
    console.error('Error fetching hoardings:', error);
    res.status(500).json({ error: 'Error fetching hoardings' });
  }
});

// Update hoarding
router.put('/:id', auth, async (req, res) => {
  try {
    const hoarding = await Hoarding.findById(req.params.id);
    
    if (!hoarding) {
      return res.status(404).json({ error: 'Hoarding not found' });
    }

    if (hoarding.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this hoarding' });
    }

    const updatedHoarding = await Hoarding.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    res.json(updatedHoarding);
  } catch (error) {
    console.error('Error updating hoarding:', error);
    res.status(500).json({ error: 'Error updating hoarding' });
  }
});

// Delete hoarding
router.delete('/:id', auth, async (req, res) => {
  try {
    const hoarding = await Hoarding.findById(req.params.id);
    
    if (!hoarding) {
      return res.status(404).json({ error: 'Hoarding not found' });
    }

    if (hoarding.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this hoarding' });
    }

    await hoarding.remove();
    res.json({ message: 'Hoarding removed' });
  } catch (error) {
    console.error('Error deleting hoarding:', error);
    res.status(500).json({ error: 'Error deleting hoarding' });
  }
});

module.exports = router; 