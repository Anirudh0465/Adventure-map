import mongoose from 'mongoose';

const placeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  photoUrl: String,
  
  // AI or manual generated structured data
  tags: [String],
  vibe: String,
  bestTimeOfDay: String,
  
  // Hazard flags
  hazards: {
    privateProperty: { type: Boolean, default: false },
    unstableStructures: { type: Boolean, default: false },
    water: { type: Boolean, default: false },
    wildlife: { type: Boolean, default: false }
  },
  
  isAiSuggested: { type: Boolean, default: false },
  
  // Community signals
  stillAccessibleVotes: { type: Number, default: 0 },
  reportedCount: { type: Number, default: 0 },
  
  createdBy: { type: String, required: true }, // Legacy string field
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // New reference field
  
  // Array of trail points. type can be 'normal', 'easy', 'moderate', 'hard', 'danger'
  trail: [{
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    type: { type: String, default: 'normal' }
  }],
  
  createdAt: { type: Date, default: Date.now }
});

export const Place = mongoose.model('Place', placeSchema);
