import mongoose from 'mongoose';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { Place } from './models/Place.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/touchgrass';

const cities = [
  'Darjeeling, India',
  'Bengaluru, India',
  'Chennai, India',
  'Kolkata, India',
  'London, UK',
  'Parma, Italy',
  'Jakarta, Indonesia',
  'Mysuru, India',
  'Ooty, India'
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB for seeding');

  // Clear existing AI seeded places (optional, leaving commented out so we don't wipe user data)
  // await Place.deleteMany({ isAiSuggested: true });

  for (const city of cities) {
    console.log(`\nFetching spots for ${city}...`);
    
    // Overpass QL to find viewpoints and ruins in the bounding area of the city
    const query = `
      [out:json][timeout:25];
      geocodeArea("${city}")->.searchArea;
      (
        node["tourism"="viewpoint"](area.searchArea);
        node["historic"="ruins"](area.searchArea);
      );
      out center 5;
    `;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
      });

      const data = await response.json();
      
      if (data && data.elements) {
        console.log(`Found ${data.elements.length} spots in ${city}`);
        
        for (const el of data.elements) {
          if (!el.lat || !el.lon) continue;
          
          const title = el.tags?.name || (el.tags?.tourism === 'viewpoint' ? 'Scenic Viewpoint' : 'Historic Ruins');
          
          const newPlace = new Place({
            title: `${title} (${city.split(',')[0]})`,
            description: el.tags?.description || 'A beautiful spot imported from OpenStreetMap.',
            coordinates: { lat: el.lat, lng: el.lon },
            tags: [el.tags?.tourism || el.tags?.historic],
            isAiSuggested: false,
            createdBy: 'OSM_Seeder'
          });
          
          await newPlace.save();
        }
      }
    } catch (err) {
      console.error(`Error fetching for ${city}:`, err.message);
    }
    
    // Sleep for 2 seconds to respect Overpass API rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\nSeeding complete!');
  process.exit(0);
}

seed();
