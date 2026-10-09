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
import { User } from './models/User.js';

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

// Auth Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, name, picture } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    
    let user = await User.findOne({ email });
    if (!user) {
      // Generate a default username from email
      let baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      let username = baseUsername;
      let counter = 1;
      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }
      
      user = new User({ email, name, picture, username });
      await user.save();
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Profile
app.put('/api/users/profile', async (req, res) => {
  try {
    const { email, newUsername } = req.body;
    if (!email || !newUsername) return res.status(400).json({ error: "Missing fields" });
    
    const existing = await User.findOne({ username: newUsername });
    if (existing && existing.email !== email) {
      return res.status(400).json({ error: "Username already taken" });
    }
    
    const user = await User.findOneAndUpdate(
      { email },
      { username: newUsername },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route for creating a place
app.post('/api/places', upload.single('photo'), async (req, res) => {
  try {
    const { title, description, lat, lng, createdBy, authorId, trailStrokes, trailPOIs } = req.body;
    
    let parsedTrailStrokes = [];
    if (trailStrokes) {
      try { parsedTrailStrokes = JSON.parse(trailStrokes); } catch(e) {}
    }
    
    let parsedTrailPOIs = [];
    if (trailPOIs) {
      try { parsedTrailPOIs = JSON.parse(trailPOIs); } catch(e) {}
    }
    
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
      authorId: authorId || null,
      trailStrokes: parsedTrailStrokes,
      trailPOIs: parsedTrailPOIs,
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

// Route for deleting a place
app.delete('/api/places/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body; // In MVP, just verify with email
    
    const place = await Place.findById(id);
    if (!place) return res.status(404).json({ error: "Place not found" });
    
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    
    // Check if the user owns this place
    if (place.authorId && place.authorId.toString() !== user._id.toString() && place.createdBy !== user.username) {
      return res.status(403).json({ error: "Forbidden: You didn't create this pin" });
    }
    
    await Place.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route for updating a place (edit)
app.put('/api/places/:id', upload.single('photo'), async (req, res) => {
  try {
    const { title, description, lat, lng, email, trailStrokes, trailPOIs } = req.body;
    
    // Find the place
    const place = await Place.findById(req.params.id);
    if (!place) return res.status(404).json({ error: 'Place not found' });
    
    // Check ownership
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'User not found' });
    
    if (place.authorId && place.authorId.toString() !== user._id.toString() && place.createdBy !== user.username) {
      return res.status(403).json({ error: 'Not authorized to edit this place' });
    }
    
    let parsedTrailStrokes = place.trailStrokes;
    if (trailStrokes) {
      try { parsedTrailStrokes = JSON.parse(trailStrokes); } catch(e) {}
    }
    
    let parsedTrailPOIs = place.trailPOIs;
    if (trailPOIs) {
      try { parsedTrailPOIs = JSON.parse(trailPOIs); } catch(e) {}
    }

    if (title) place.title = title;
    if (description !== undefined) place.description = description;
    if (lat && lng) place.coordinates = { lat: Number(lat), lng: Number(lng) };
    place.trailStrokes = parsedTrailStrokes;
    place.trailPOIs = parsedTrailPOIs;
    
    if (req.file) {
      place.photoUrl = `/uploads/${req.file.filename}`;
    }

    await place.save();
    res.json(place);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Route for adding a comment
app.post('/api/places/:id/comments', async (req, res) => {
  try {
    const { email, text } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'User not found' });
    
    const place = await Place.findById(req.params.id);
    if (!place) return res.status(404).json({ error: 'Place not found' });
    
    const newComment = {
      authorId: user._id,
      username: user.username || user.name,
      text: text
    };
    
    place.comments.push(newComment);
    await place.save();
    
    res.json(place);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Route for toggling an upvote
app.post('/api/places/:id/upvote', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    const place = await Place.findById(req.params.id);
    if (!place) return res.status(404).json({ error: 'Place not found' });
    
    const index = place.upvotes.indexOf(email);
    if (index === -1) {
      place.upvotes.push(email);
    } else {
      place.upvotes.splice(index, 1);
    }
    
    await place.save();
    res.json(place);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
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
