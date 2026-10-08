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
  const [selectedPlace, setSelectedPlace] = useState(null);

  // Fetch places from backend
  useEffect(() => {
    fetch('/api/places')
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
    setSelectedPlace(null);
  };

  const handleMarkerClick = (place) => {
    setSelectedPlace(place);
    setIsAddingPlace(false);
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
      const response = await fetch('/api/places', {
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
                {user.picture && <img src={user.picture} alt="Profile" />}
                <span>{user.name}</span>
                <button className="btn-secondary" onClick={() => setUser(null)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Sign Out</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <GoogleLogin
                  onSuccess={handleLoginSuccess}
                  onError={() => {
                    console.log('Login Failed');
                  }}
                  theme="filled_black"
                  shape="pill"
                />
                <button 
                  className="btn-primary" 
                  onClick={() => setUser({ name: 'Test Explorer' })}
                  style={{ padding: '0 16px', height: '40px', borderRadius: '50px' }}
                >
                  Test Login
                </button>
              </div>
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
          
          {/* Floating UI Panel (View Place Details) */}
          {selectedPlace && !isAddingPlace && (
            <div className="floating-ui glass-panel" style={{ position: 'relative' }}>
              <button 
                className="btn-secondary" 
                style={{ position: 'absolute', top: '15px', right: '15px', padding: '4px 10px', minWidth: 'auto', borderRadius: '50%' }}
                onClick={() => setSelectedPlace(null)}
              >
                ✕
              </button>
              
              <h3 style={{ marginBottom: '15px', paddingRight: '30px' }}>{selectedPlace.title}</h3>
              
              {selectedPlace.photoUrl && (
                <img 
                  src={selectedPlace.photoUrl} 
                  alt={selectedPlace.title} 
                  style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px', marginBottom: '15px' }} 
                />
              )}
              
              <p style={{ color: 'var(--text-secondary)', marginBottom: '15px', lineHeight: '1.5' }}>
                {selectedPlace.description}
              </p>
              
              {selectedPlace.tags && selectedPlace.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '15px' }}>
                  {selectedPlace.tags.map((tag, idx) => (
                    <span key={idx} style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                      color: '#FFFFFF', 
                      padding: '4px 12px', 
                      borderRadius: '50px', 
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}>
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px', display: 'flex', justifyContent: 'space-between' }}>
                <span>By {selectedPlace.createdBy || 'Unknown'}</span>
                {selectedPlace.isAiSuggested && <span style={{ color: '#8B5CF6', fontWeight: 'bold' }}>✨ AI Tagged</span>}
              </div>
            </div>
          )}
          
        </main>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
