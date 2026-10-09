# Adventure Map

Adventure Map is a crowdsourced social map for hikers, explorers, and off-road adventurers. Discover hidden waterfalls, navigate dangerous zones, and map out your next excursion using our intuitive freehand trail-drawing engine.

## Features

### Core Mapping & Exploration
* **Interactive 3D Map:** Fluid MapLibre GL integration with seamless toggling between Street and Satellite views.
* **Smart Filtering:** Instantly declutter the map by filtering for *All Trails*, *My Trails*, *Scenic*, or *Danger Zones*.

### Drawing & Navigation
* **Freehand Trail Engine:** Paint custom, continuous trails directly on the map with categorized brushes (Normal/Blue, Moderate/Yellow, Danger/Red).
* **AI Auto-Routing:** The moment you draw a normal path, an AI engine (Powered by OSRM) instantly snaps your hand-drawn line to the nearest real-world roads and hiking trails.
* **Live GPS Tracking:** Hit "Start Tracking" on mobile to automatically paint the trail behind you as you walk in real-time.

### Social & Community
* **Google Auth & Profiles:** Instant sign-in, customizable usernames, and a dedicated profile panel to track your uploaded locations.
* **Community Validation:** Upvote accurate trails to boost their reputation, and read/leave comments on any pin to report live trail conditions.
* **Full Edit Control:** Authors can seamlessly edit their own trails, modify descriptions, or completely redraw paths after publishing.

## Tech Stack
- **Frontend:** React, Vite, MapLibre GL JS
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose)
- **AI Routing:** Open Source Routing Machine (OSRM) API
- **Authentication:** Google OAuth2

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Anirudh0465/Adventure-map.git
   cd Adventure-map
   ```

2. **Setup the Backend:**
   ```bash
   cd backend
   npm install
   ```
   *Create a `.env` file in the `backend` directory and add your MongoDB URI:*
   ```env
   MONGODB_URI=your_mongodb_connection_string
   PORT=5000
   ```
   *Start the backend server:*
   ```bash
   npm start
   ```

3. **Setup the Frontend:**
   ```bash
   cd ../frontend
   npm install
   ```
   *Create a `.env` file in the `frontend` directory with your Google Client ID:*
   ```env
   VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
   ```
   *Start the frontend development server:*
   ```bash
   npm run dev
   ```

4. **Explore!** 
   Open `http://localhost:5173` in your browser.
