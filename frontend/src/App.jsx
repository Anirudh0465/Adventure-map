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
  
  const [isEditingPlace, setIsEditingPlace] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, my_pins, scenic, danger

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
      const url = isEditingPlace ? `/api/places/${selectedPlace._id}` : '/api/places';
      const method = isEditingPlace ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        body: formData
      });
      
      const newPlace = await response.json();
      
      if (isEditingPlace) {
        setPlaces(places.map(p => p._id === newPlace._id ? newPlace : p));
        setSelectedPlace(newPlace);
      } else {
        setPlaces([newPlace, ...places]);
      }
      
      // Reset form
      setIsAddingPlace(false);
      setIsEditingPlace(false);
      setTitle('');
      setDescription('');
      setPhoto(null);
      if (!isEditingPlace) setSelectedLocation(null);
      setIsDrawingTrail(false);
      setTrailStrokes([]);
      setTrailPOIs([]);
      setDrawingMode('path');
    } catch (err) {
      console.error("Error saving place:", err);
      alert("Failed to save pin. Is the backend running?");
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

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    
    try {
      const res = await fetch(`/api/places/${selectedPlace._id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, text: commentText })
      });
      
      if (res.ok) {
        const updatedPlace = await res.json();
        setPlaces(places.map(p => p._id === updatedPlace._id ? updatedPlace : p));
        setSelectedPlace(updatedPlace);
        setCommentText('');
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (e) {
      console.error("Error posting comment:", e);
    }
  };

  const handleUpvote = async (id) => {
    if (!user) {
      alert("Please sign in to upvote trails!");
      return;
    }
    try {
      const res = await fetch(`/api/places/${id}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      if (res.ok) {
        const updatedPlace = await res.json();
        setPlaces(places.map(p => p._id === id ? updatedPlace : p));
        if (selectedPlace && selectedPlace._id === id) {
          setSelectedPlace(updatedPlace);
        }
      }
    } catch (e) {
      console.error("Error toggling upvote:", e);
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
              {mapTheme === 'street' ? '🛰️ Satellite' : '🗺️ Street'}
            </button>
            <select 
              className="btn-secondary" 
              style={{ padding: '6px 12px' }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Trails</option>
              {user && <option value="my_pins">My Trails</option>}
              <option value="scenic">Scenic Trails</option>
              <option value="danger">Dangerous Trails</option>
            </select>
            {user ? (
              <div className="user-profile" onClick={() => setShowProfile(!showProfile)} style={{ cursor: 'pointer', marginLeft: '10px' }}>
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
            places={places.filter(p => {
              if (filterType === 'all') return true;
              if (filterType === 'my_pins') return user && (p.authorId === user._id || p.createdBy === user.username);
              if (filterType === 'danger') return (p.trailStrokes && p.trailStrokes.some(s => s.type === 'danger')) || (p.trailPOIs && p.trailPOIs.some(poi => poi.poiType === 'danger'));
              if (filterType === 'scenic') return p.trailPOIs && p.trailPOIs.some(poi => poi.poiType === 'scenic');
              return true;
            })} 
            onMapClick={handleMapClick} 
            onMarkerClick={handleMarkerClick} 
            mapStyleType={mapTheme} 
            trailStrokes={(isAddingPlace || isEditingPlace) ? trailStrokes : (selectedPlace?.trailStrokes || [])}
            trailPOIs={(isAddingPlace || isEditingPlace) ? trailPOIs : (selectedPlace?.trailPOIs || [])}
            selectedLocation={(isAddingPlace || isEditingPlace) ? selectedLocation : (selectedPlace?.coordinates || null)}
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
          {(isAddingPlace || isEditingPlace) && (
            <div className="floating-ui glass-panel">
              <button 
                className="btn-secondary" 
                style={{ position: 'absolute', top: '15px', right: '15px', padding: '4px 10px', minWidth: 'auto', borderRadius: '50%' }}
                onClick={() => { setIsAddingPlace(false); setIsEditingPlace(false); }}
              >
                ✕
              </button>
              <h3 style={{ marginBottom: '20px' }}>{isEditingPlace ? 'Edit Pin' : 'Add a new spot'}</h3>
              
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
                  <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setIsAddingPlace(false); setIsEditingPlace(false); }}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ flex: 2 }}>{isEditingPlace ? 'Save Changes' : 'Drop Pin'}</button>
                </div>
              </form>
            </div>
          )}
          
          {/* Floating UI Panel (View Place Details) */}
          {selectedPlace && !isAddingPlace && !isEditingPlace && (
            <div className="floating-ui glass-panel" style={{ position: 'relative', maxHeight: '80vh', overflowY: 'auto' }}>
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
                <button 
                  onClick={() => handleUpvote(selectedPlace._id)}
                  className={selectedPlace.upvotes && user && selectedPlace.upvotes.includes(user.email) ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '4px 8px', minWidth: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <span style={{ fontSize: '1.2rem' }}>⛰️</span> {selectedPlace.upvotes ? selectedPlace.upvotes.length : 0}
                </button>
              </div>

              {user && (selectedPlace.authorId === user._id || selectedPlace.createdBy === user.username) && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <button 
                    className="btn-primary" 
                    style={{ flex: 1 }}
                    onClick={() => {
                      setTitle(selectedPlace.title);
                      setDescription(selectedPlace.description || '');
                      setTrailStrokes(selectedPlace.trailStrokes || []);
                      setTrailPOIs(selectedPlace.trailPOIs || []);
                      setSelectedLocation({ lat: selectedPlace.coordinates.lat, lng: selectedPlace.coordinates.lng });
                      setIsEditingPlace(true);
                    }}
                  >
                    Edit Pin
                  </button>
                  <button 
                    className="btn-secondary" 
                    style={{ flex: 1, color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    onClick={() => handleDeletePlace(selectedPlace._id)}
                  >
                    Delete
                  </button>
                </div>
              )}

              {/* Comments Section */}
              <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                <h4 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>Comments ({selectedPlace.comments ? selectedPlace.comments.length : 0})</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px', maxHeight: '150px', overflowY: 'auto' }}>
                  {selectedPlace.comments && selectedPlace.comments.map((comment, idx) => (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <strong style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>{comment.username}</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{new Date(comment.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', margin: 0 }}>{comment.text}</p>
                    </div>
                  ))}
                  {(!selectedPlace.comments || selectedPlace.comments.length === 0) && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No comments yet.</p>
                  )}
                </div>

                {user ? (
                  <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Add a comment..." 
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      style={{ flex: 1, padding: '8px' }}
                    />
                    <button type="submit" className="btn-primary" style={{ padding: '8px 12px' }}>Post</button>
                  </form>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Login to leave a comment.</p>
                )}
              </div>

            </div>
          )}
          {/* Legend */}
          <div className="floating-ui glass-panel" style={{ bottom: '20px', left: '20px', top: 'auto', right: 'auto', width: 'auto', padding: '15px 20px', zIndex: 100 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Legend</h4>
            <div style={{ display: 'flex', gap: '30px', fontSize: '0.8rem' }}>
              <div>
                <strong style={{ display: 'block', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Pins</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#000', border: '2px solid #FFF' }}></div> Saved Destination</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#8B5CF6', border: '2px solid #FFF' }}></div> Selected Location</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#3B82F6', border: '2px solid #FFF' }}></div> Scenic / Rest</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#EF4444', border: '2px solid #FFF' }}></div> Danger / Blocked</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#8B5CF6', border: '2px solid #FFF' }}></div> Point of Interest</div>
              </div>
              <div>
                <strong style={{ display: 'block', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Trails</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><div style={{ width: '20px', height: '4px', backgroundColor: '#3B82F6', borderRadius: '2px' }}></div> Normal Path (Blue)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><div style={{ width: '20px', height: '4px', backgroundColor: '#EAB308', borderRadius: '2px' }}></div> Moderate Zone (Yellow)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '20px', height: '4px', backgroundColor: '#EF4444', borderRadius: '2px' }}></div> Danger Zone (Red)</div>
              </div>
            </div>
          </div>
          
        </main>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
