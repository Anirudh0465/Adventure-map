import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { Place } from './models/Place.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Setup multer for handling photo uploads
const upload = multer({ dest: 'uploads/' });

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/touchgrass';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Route for creating a place
app.post('/api/places', upload.single('photo'), async (req, res) => {
  try {
    const { title, description, lat, lng, createdBy } = req.body;
    
    // For MVP Step 1, we just save the basic info without AI processing
    // We'll add the Gemma AI vision extraction in Step 2
    
    const newPlace = new Place({
      title,
      description,
      coordinates: { lat: Number(lat), lng: Number(lng) },
      createdBy,
      photoUrl: req.file ? `/uploads/${req.file.filename}` : null
    });
    
    await newPlace.save();
    res.status(201).json(newPlace);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route for fetching places
app.get('/api/places', async (req, res) => {
  try {
    const places = await Place.find().sort({ createdAt: -1 });
    res.json(places);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
