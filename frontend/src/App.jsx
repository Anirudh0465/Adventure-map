import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import Map from './components/Map';
import './index.css';

// We will replace this with a real client ID from Google Cloud Console later
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

function App() {
  const [places, setPlaces] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);

  // Fetch places from backend
  useEffect(() => {
    fetch('http://localhost:5000/api/places')
      .then(res => res.json())
      .then(data => setPlaces(data))
      .catch(err => console.error("Error fetching places:", err));
  }, []);

  const handleMapClick = (lngLat) => {
    if (!user) {
      alert("Please sign in to add a place!");
      return;
    }
    setSelectedLocation(lngLat);
    setIsAddingPlace(true);
  };

  const handleMarkerClick = (place) => {
    // Show place details (to be implemented)
    console.log("Clicked place:", place.title);
  };

  const handleLoginSuccess = (credentialResponse) => {
    // For MVP, we'll just decode the JWT locally to get the user info
    // In production, send credentialResponse.credential to backend to verify
    try {
      const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1]));
      setUser({
        name: payload.name,
        picture: payload.picture,
        email: payload.email
      });
    } catch (e) {
      console.error("Error decoding token");
    }
  };

  const handleSubmitPlace = async (e) => {
    e.preventDefault();
    if (!title || !selectedLocation) return;
    
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('lat', selectedLocation.lat);
    formData.append('lng', selectedLocation.lng);
    formData.append('createdBy', user.name);
    if (photo) {
      formData.append('photo', photo);
    }
    
    try {
      const response = await fetch('http://localhost:5000/api/places', {
        method: 'POST',
        body: formData
      });
      
      const newPlace = await response.json();
      setPlaces([newPlace, ...places]);
      
      // Reset form
      setIsAddingPlace(false);
      setTitle('');
      setDescription('');
      setPhoto(null);
      setSelectedLocation(null);
    } catch (err) {
      console.error("Error creating place:", err);
      alert("Failed to drop pin. Is the backend running?");
    }
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="app-container">
        
        {/* Header */}
        <header className="header glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}>
          <div className="logo">Touch Grass</div>
          
          <div className="auth-container">
            {user ? (
              <div className="user-profile">
                <img src={user.picture} alt="Profile" />
                <span>{user.name}</span>
                <button className="btn-secondary" onClick={() => setUser(null)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Sign Out</button>
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleLoginSuccess}
                onError={() => {
                  console.log('Login Failed');
                }}
                theme="filled_black"
                shape="pill"
              />
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="main-content">
          
          {/* Map */}
          <Map places={places} onMapClick={handleMapClick} onMarkerClick={handleMarkerClick} />
          
          {/* Floating UI Panel (Add Place Form) */}
          {isAddingPlace && (
            <div className="floating-ui glass-panel">
              <h3 style={{ marginBottom: '20px' }}>Add a new spot</h3>
              
              <form onSubmit={handleSubmitPlace}>
                <div className="form-group">
                  <label>Selected Coordinates</label>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                    {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Title</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Hidden Waterfall" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea 
                    className="form-control" 
                    placeholder="Why is this worth leaving the house for?" 
                    rows="3"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  ></textarea>
                </div>
                
                {/* Photo upload */}
                <div className="form-group">
                  <label>Photo (AI will extract details)</label>
                  <input 
                    type="file" 
                    className="form-control" 
                    accept="image/*"
                    onChange={(e) => setPhoto(e.target.files[0])}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsAddingPlace(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ flex: 2 }}>Drop Pin</button>
                </div>
              </form>
            </div>
          )}
          
        </main>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
