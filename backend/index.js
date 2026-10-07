import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Place } from './models/Place.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    let aiData = {
      tags: [],
      vibe: '',
      bestTimeOfDay: '',
      hazards: {},
      isAiSuggested: false
    };

    // If a photo was uploaded, send it to the PaliGemma Python service
    if (req.file) {
      try {
        const formData = new FormData();
        formData.append('photo', fs.createReadStream(req.file.path));

        console.log("Sending photo to AI service...");
        const aiResponse = await axios.post('http://127.0.0.1:5001/analyze', formData, {
          headers: { ...formData.getHeaders() }
        });

        if (aiResponse.data) {
          aiData = {
            tags: aiResponse.data.tags || [],
            vibe: aiResponse.data.vibe || '',
            bestTimeOfDay: aiResponse.data.bestTimeOfDay || '',
            hazards: aiResponse.data.hazards || {},
            isAiSuggested: true
          };
          console.log("AI analysis complete:", aiData);
        }
      } catch (aiError) {
        console.error('AI Service Error (Continuing without AI data):', aiError.message);
      }
    }
    
    const newPlace = new Place({
      title,
      description,
      coordinates: { lat: Number(lat), lng: Number(lng) },
      createdBy: createdBy || 'Anonymous',
      photoUrl: req.file ? `/uploads/${req.file.filename}` : null,
      ...aiData
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

// Serve the frontend in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
