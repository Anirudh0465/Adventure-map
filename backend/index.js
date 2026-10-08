import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HfInference } from '@huggingface/inference';
import { Place } from './models/Place.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const hf = new HfInference(process.env.HF_TOKEN);

const app = express();
app.use(cors());
app.use(express.json());

// Setup multer for handling photo uploads
const upload = multer({ dest: 'uploads/' });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

    // If a photo was uploaded, send it to HuggingFace Serverless API
    if (req.file && process.env.HF_TOKEN) {
      try {
        console.log("Sending photo to HuggingFace PaliGemma...");
        const imageBuffer = fs.readFileSync(req.file.path);
        
        const aiResponse = await hf.visualQuestionAnswering({
          model: 'google/paligemma-3b-mix-224',
          inputs: {
            image: imageBuffer,
            question: "Output a JSON object with keys: 'tags' (list of 1-3 lowercase words describing location type like 'waterfall', 'ruins', 'park'), 'vibe' (1-3 word description of atmosphere), 'bestTimeOfDay' (suggested time to visit), 'hazards' (boolean object with keys: 'privateProperty', 'unstableStructures', 'water', 'wildlife'). Output ONLY valid JSON."
          }
        });

        if (aiResponse && aiResponse.answer) {
          const resultStr = aiResponse.answer;
          const jsonStart = resultStr.indexOf('{');
          const jsonEnd = resultStr.lastIndexOf('}') + 1;
          
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            const parsedData = JSON.parse(resultStr.substring(jsonStart, jsonEnd));
            aiData = {
              tags: parsedData.tags || [],
              vibe: parsedData.vibe || '',
              bestTimeOfDay: parsedData.bestTimeOfDay || '',
              hazards: parsedData.hazards || {},
              isAiSuggested: true
            };
            console.log("AI analysis complete:", aiData);
          }
        }
      } catch (aiError) {
        console.error('AI Service Error (Continuing without AI data):', aiError.message);
      }
    } else if (req.file && !process.env.HF_TOKEN) {
      console.log("Skipping AI analysis: HF_TOKEN not set in environment.");
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
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
