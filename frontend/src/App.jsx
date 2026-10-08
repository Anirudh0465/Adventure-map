import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import Map from './components/Map';
import './index.css';

// We load this from the environment variables (e.g. .env file or Render dashboard)
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";

function App() {
  const [places, setPlaces] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [mapTheme, setMapTheme] = useState('street'); // 'street' or 'satellite'
  const [showProfile, setShowProfile] = useState(false);
  const [isDrawingTrail, setIsDrawingTrail] = useState(false);
  const [drawingMode, setDrawingMode] = useState('path'); // 'path' or 'poi'
  const [trailStrokes, setTrailStrokes] = useState([]);
  const [trailPOIs, setTrailPOIs] = useState([]);
  const [currentTrailType, setCurrentTrailType] = useState('normal'); // normal, moderate, danger
  const [currentPoiType, setCurrentPoiType] = useState('scenic'); // scenic, danger, poi

  // Fetch places from backend
  useEffect(() => {
    fetch('/api/places')
      .then(res => res.json())
      .then(data => setPlaces(data))
      .catch(err => console.error("Error fetching places:", err));
  }, []);

  const handleMapClick = (lngLat, isDoubleClick) => {
    if (!user) {
      alert("Please sign in to add a place!");
      return;
    }
    if (isDrawingTrail) {
      if (!isDoubleClick) {
        if (drawingMode === 'poi') {
          setTrailPOIs([...trailPOIs, { lat: lngLat.lat, lng: lngLat.lng, poiType: currentPoiType }]);
        }
      }
      return;
    }

    if (isDoubleClick) {
      setSelectedLocation(lngLat);
      setIsAddingPlace(true);
      setSelectedPlace(null);
    }
  };

  const handleMarkerClick = (place) => {
    setSelectedPlace(place);
    setIsAddingPlace(false);
  };

  const handleDrawFreehand = (path) => {
    if (path.length > 1) {
      setTrailStrokes([...trailStrokes, { type: currentTrailType, path }]);
    }
  };

  const handleLoginSuccess = async (credentialResponse) => {
    try {
      const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1]));
      
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payload.email,
          name: payload.name,
          picture: payload.picture
        })
      });
      
      if (res.ok) {
        const dbUser = await res.json();
        setUser(dbUser);
      }
    } catch (e) {
      console.error("Error logging in", e);
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
    formData.append('createdBy', user.username);
    formData.append('authorId', user._id);
    if (trailStrokes.length > 0) {
      formData.append('trailStrokes', JSON.stringify(trailStrokes));
    }
    if (trailPOIs.length > 0) {
      formData.append('trailPOIs', JSON.stringify(trailPOIs));
    }
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
      setIsDrawingTrail(false);
      setTrailStrokes([]);
      setTrailPOIs([]);
      setDrawingMode('path');
    } catch (err) {
      console.error("Error creating place:", err);
      alert("Failed to drop pin. Is the backend running?");
    }
  };

  const handleDeletePlace = async (id) => {
    if (!window.confirm("Are you sure you want to delete this pin?")) return;
    try {
      const res = await fetch(`/api/places/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      if (res.ok) {
        setPlaces(places.filter(p => p._id !== id));
        setSelectedPlace(null);
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const newUsername = e.target.username.value;
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, newUsername })
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        alert("Profile updated!");
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="app-container" data-map-theme={mapTheme}>
        
        {/* Header */}
        <header className="header glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}>
          <div className="logo">Touch Grass</div>
          
          <div className="auth-container">
            <button 
              className="btn-secondary" 
              onClick={() => setMapTheme(mapTheme === 'street' ? 'satellite' : 'street')}
              style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '50px' }}
              title="Toggle Map Style"
            >
              {mapTheme === 'street' ? '🛰️ Satellite Map' : '🗺️ Street Map'}
            </button>
            {user ? (
              <div className="user-profile" onClick={() => setShowProfile(!showProfile)} style={{ cursor: 'pointer' }}>
                {user.picture && <img src={user.picture} alt="Profile" />}
                <span>{user.username || user.name}</span>
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
                </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="main-content">
          
          {/* Map */}
          <Map 
            places={places} 
            onMapClick={handleMapClick} 
            onMarkerClick={handleMarkerClick} 
            mapStyleType={mapTheme} 
            trailStrokes={isDrawingTrail ? trailStrokes : (selectedPlace?.trailStrokes || [])}
            trailPOIs={isDrawingTrail ? trailPOIs : (selectedPlace?.trailPOIs || [])}
            selectedLocation={isAddingPlace ? selectedLocation : (selectedPlace?.coordinates || null)}
            isDrawingFreehand={isDrawingTrail && drawingMode === 'path'}
            onDrawFreehand={handleDrawFreehand}
            currentDrawingType={currentTrailType}
          />

          {/* Profile Panel */}
          {showProfile && user && (
            <div className="floating-ui glass-panel" style={{ left: 'auto', right: '20px', width: '300px' }}>
              <button className="btn-secondary" style={{ float: 'right', padding: '4px 8px' }} onClick={() => setShowProfile(false)}>✕</button>
              <h3 style={{ marginBottom: '15px' }}>Your Profile</h3>
              
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <img src={user.picture} style={{ width: '80px', borderRadius: '50%', marginBottom: '10px' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{user.email}</p>
              </div>

              <form onSubmit={handleUpdateProfile} style={{ marginBottom: '20px' }}>
                <div className="form-group">
                  <label>Username</label>
                  <input type="text" name="username" defaultValue={user.username} className="form-control" />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%' }}>Save Profile</button>
              </form>

              <h4>Your Pins</h4>
              <ul style={{ listStyle: 'none', padding: 0, marginTop: '10px', maxHeight: '150px', overflowY: 'auto' }}>
                {places.filter(p => p.authorId === user._id || p.createdBy === user.username).map(p => (
                  <li key={p._id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }} onClick={() => { setSelectedPlace(p); setShowProfile(false); }}>
                    {p.title}
                  </li>
                ))}
              </ul>

              <button className="btn-secondary" onClick={() => { setUser(null); setShowProfile(false); }} style={{ width: '100%', marginTop: '20px' }}>Sign Out</button>
            </div>
          )}
          
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
                
                <div className="form-group">
                  <label>Trail / Path</label>
                  {!isDrawingTrail ? (
                    <button type="button" className="btn-secondary" onClick={() => setIsDrawingTrail(true)}>
                      Draw Trail on Map ({trailStrokes.length} paths, {trailPOIs.length} pins)
                    </button>
                  ) : (
                    <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                      <p style={{ fontSize: '0.8rem', marginBottom: '10px', color: 'var(--accent-primary)' }}>
                        {drawingMode === 'path' ? "Click and hold to paint a path." : "Click map to drop POI pins."}
                      </p>
                      
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <button type="button" className={drawingMode === 'path' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, padding: '4px' }} onClick={() => setDrawingMode('path')}>Path</button>
                        <button type="button" className={drawingMode === 'poi' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, padding: '4px' }} onClick={() => setDrawingMode('poi')}>Pins</button>
                      </div>

                      {drawingMode === 'path' ? (
                        <select 
                          className="form-control" 
                          value={currentTrailType} 
                          onChange={(e) => setCurrentTrailType(e.target.value)}
                          style={{ marginBottom: '10px', width: '100%' }}
                        >
                          <option value="normal">Normal Path (Blue)</option>
                          <option value="moderate">Moderate Zone (Yellow)</option>
                          <option value="danger">Hard/Danger Zone (Red)</option>
                        </select>
                      ) : (
                        <select 
                          className="form-control" 
                          value={currentPoiType} 
                          onChange={(e) => setCurrentPoiType(e.target.value)}
                          style={{ marginBottom: '10px', width: '100%' }}
                        >
                          <option value="scenic">Scenic/Rest Place</option>
                          <option value="danger">Danger/Blocked</option>
                          <option value="poi">Point of Interest</option>
                        </select>
                      )}

                      <button type="button" className="btn-secondary" onClick={() => { setIsDrawingTrail(false); setTrailStrokes([]); setTrailPOIs([]); }} style={{ marginRight: '10px', fontSize: '0.8rem' }}>Clear</button>
                      <button type="button" className="btn-primary" onClick={() => setIsDrawingTrail(false)} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>Done Drawing</button>
                    </div>
                  )}
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
              
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>By {selectedPlace.createdBy || 'Unknown'}</span>
                {selectedPlace.isAiSuggested && <span style={{ color: '#8B5CF6', fontWeight: 'bold' }}>✨ AI Tagged</span>}
              </div>

              {user && (selectedPlace.authorId === user._id || selectedPlace.createdBy === user.username) && (
                <button 
                  className="btn-secondary" 
                  style={{ width: '100%', marginTop: '15px', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  onClick={() => handleDeletePlace(selectedPlace._id)}
                >
                  Delete Pin
                </button>
              )}
            </div>
          )}
          
        </main>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
