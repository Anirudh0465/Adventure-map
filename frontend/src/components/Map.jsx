import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const streetStyle = {
  version: 8,
  sources: {
    'osm': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap Contributors'
    }
  },
  layers: [{ id: 'osm-layer', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 }]
};

const satelliteStyle = {
  version: 8,
  sources: {
    'satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: '&copy; Esri & Maxar'
    }
  },
  layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite', minzoom: 0, maxzoom: 19 }]
};

export default function Map({ places, onMapClick, onMarkerClick, mapStyleType = 'street', trailStrokes = [], trailPOIs = [], selectedLocation = null, isDrawingFreehand = false, onDrawFreehand }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng] = useState(0); // Center of globe
  const [lat] = useState(20);
  const [zoom] = useState(2); // Globe view
  const markersRef = useRef({}); // keep track of markers
  const poiMarkersRef = useRef([]); // track POI pins
  const onMapClickRef = useRef(onMapClick);
  const isDrawingRef = useRef(false);
  const [activePath, setActivePath] = useState([]);
  const [renderTick, setRenderTick] = useState(0);
  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (map.current) return; // initialize map only once
    
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyleType === 'satellite' ? satelliteStyle : streetStyle,
      center: [lng, lat],
      zoom: zoom,
    });

    setPortalTarget(map.current.getCanvasContainer());

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.doubleClickZoom.disable();

    map.current.on('dblclick', (e) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.lngLat, true);
      }
    });

    map.current.on('click', (e) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.lngLat, false);
      }
    });

    // Try to get user's location and fly to it
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (map.current) {
            map.current.flyTo({
              center: [position.coords.longitude, position.coords.latitude],
              zoom: 12,
              essential: true
            });
          }
        },
        (error) => {
          console.warn("Geolocation denied or failed:", error);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
    
    // Sync SVG overlay with map movements
    const forceUpdate = () => setRenderTick(t => t + 1);
    map.current.on('move', forceUpdate);
    map.current.on('zoom', forceUpdate);

  }, [lng, lat, zoom]);

  useEffect(() => {
    if (!map.current) return;
    map.current.setStyle(mapStyleType === 'satellite' ? satelliteStyle : streetStyle);
  }, [mapStyleType]);

  // Handle Map Panning Toggle
  useEffect(() => {
    if (!map.current) return;
    if (isDrawingFreehand) {
      map.current.dragPan.disable();
    } else {
      map.current.dragPan.enable();
    }
  }, [isDrawingFreehand]);

  // Handle Freehand Drawing Mouse Events
  useEffect(() => {
    if (!map.current) return;
    
    const onMouseDown = (e) => {
      if (!isDrawingFreehand) return;
      if (e.originalEvent.detail > 1) return; // ignore double click
      e.preventDefault();
      isDrawingRef.current = true;
      setActivePath([{ lat: e.lngLat.lat, lng: e.lngLat.lng }]);
    };

    const onMouseMove = (e) => {
      if (!isDrawingFreehand || !isDrawingRef.current) return;
      e.preventDefault();
      setActivePath(prev => [...prev, { lat: e.lngLat.lat, lng: e.lngLat.lng }]);
    };

    const onMouseUp = (e) => {
      if (!isDrawingFreehand || !isDrawingRef.current) return;
      isDrawingRef.current = false;
      
      setActivePath(current => {
        if (current.length > 1 && onDrawFreehand) {
          onDrawFreehand([...current]);
        }
        return [];
      });
    };

    map.current.on('mousedown', onMouseDown);
    map.current.on('mousemove', onMouseMove);
    map.current.on('mouseup', onMouseUp);
    
    map.current.on('touchstart', onMouseDown);
    map.current.on('touchmove', onMouseMove);
    map.current.on('touchend', onMouseUp);

    return () => {
      map.current.off('mousedown', onMouseDown);
      map.current.off('mousemove', onMouseMove);
      map.current.off('mouseup', onMouseUp);
      
      map.current.off('touchstart', onMouseDown);
      map.current.off('touchmove', onMouseMove);
      map.current.off('touchend', onMouseUp);
    };
  }, [isDrawingFreehand, onDrawFreehand]);

  useEffect(() => {
    if (!map.current) return;

    // Remove old markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // Add new markers
    places.forEach((place) => {
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.backgroundColor = '#000000'; // Black pin
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.borderRadius = '50%';
      el.style.border = '3px solid #FFFFFF'; // White border
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';
      el.style.zIndex = '5'; // Ensure pin is above the SVG lines

      el.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent map click
        onMarkerClick(place);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.coordinates.lng, place.coordinates.lat])
        .addTo(map.current);
        
      markersRef.current[place._id] = marker;
    });

    // Add temporary selected location marker
    if (selectedLocation) {
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.backgroundColor = '#8B5CF6'; // Purple for active new pin
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.borderRadius = '50%';
      el.style.border = '3px solid #FFFFFF';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.zIndex = '5'; // Ensure pin is above the SVG lines

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([selectedLocation.lng, selectedLocation.lat])
        .addTo(map.current);
        
      markersRef.current['temp_selected'] = marker;
    }
  }, [places, onMarkerClick, selectedLocation]);

  useEffect(() => {
    if (!map.current) return;

    // 1. Remove old markers
    poiMarkersRef.current.forEach(m => m.remove());
    poiMarkersRef.current = [];

    // 2. Draw colored POI pins (Square shape to stand out)
    const poiColors = {
      scenic: '#3B82F6', // Blue
      danger: '#EF4444', // Red
      poi: '#8B5CF6' // Purple
    };

    trailPOIs.forEach(pt => {
      const el = document.createElement('div');
      el.style.width = '18px';
      el.style.height = '18px';
      el.style.borderRadius = '4px';
      el.style.backgroundColor = poiColors[pt.poiType] || '#8B5CF6';
      el.style.border = '2px solid #FFFFFF';
      el.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
      el.style.cursor = 'pointer';
      el.style.zIndex = '5'; // Ensure POI is above SVG lines
      el.title = pt.poiType.toUpperCase();

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pt.lng, pt.lat])
        .addTo(map.current);
      
      poiMarkersRef.current.push(marker);
    });

  }, [trailPOIs, selectedLocation]);

  const projectToSVG = (lng, lat) => {
    if (!map.current) return { x: 0, y: 0 };
    return map.current.project([lng, lat]);
  };

  return (
    <div className="map-wrapper" style={{ position: 'relative' }}>
      <div ref={mapContainer} className="map-container" style={{ width: '100%', height: '100%' }} />
      
      {/* 100% Bulletproof SVG Overlay for lines, injected inside MapLibre so pins render on top */}
      {portalTarget && createPortal(
        <svg 
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
        >
          {/* Draw connections to merge lines automatically */}
          {(() => {
            let connections = [];
            
            // 1. Connect Destination Pin to the first stroke
            if (selectedLocation && trailStrokes.length > 0 && trailStrokes[0].path && trailStrokes[0].path.length > 0) {
              const start = projectToSVG(selectedLocation.lng, selectedLocation.lat);
              const end = projectToSVG(trailStrokes[0].path[0].lng, trailStrokes[0].path[0].lat);
              connections.push(
                <path key="conn-dest" d={`M ${start.x},${start.y} L ${end.x},${end.y}`} fill="none" stroke="#3B82F6" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              );
            }

            // 2. Connect consecutive strokes to form a continuous trail
            for (let i = 0; i < trailStrokes.length - 1; i++) {
              const currentStroke = trailStrokes[i];
              const nextStroke = trailStrokes[i + 1];
              
              if (currentStroke.path && currentStroke.path.length > 0 && nextStroke.path && nextStroke.path.length > 0) {
                const currentLastPoint = currentStroke.path[currentStroke.path.length - 1];
                const start = projectToSVG(currentLastPoint.lng, currentLastPoint.lat);
                const end = projectToSVG(nextStroke.path[0].lng, nextStroke.path[0].lat);
                
                // Use the color of the NEXT stroke for the connecting line
                let strokeColor = '#3B82F6';
                if (nextStroke.type === 'moderate') strokeColor = '#EAB308';
                if (nextStroke.type === 'danger') strokeColor = '#EF4444';

                connections.push(
                  <path key={`conn-${i}`} d={`M ${start.x},${start.y} L ${end.x},${end.y}`} fill="none" stroke={strokeColor} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                );
              }
            }
            
            // 3. Connect the last stroke to the currently active drawing path
            if (trailStrokes.length > 0 && activePath.length > 0) {
               const lastStroke = trailStrokes[trailStrokes.length - 1];
               if (lastStroke.path && lastStroke.path.length > 0) {
                 const lastPoint = lastStroke.path[lastStroke.path.length - 1];
                 const start = projectToSVG(lastPoint.lng, lastPoint.lat);
                 const end = projectToSVG(activePath[0].lng, activePath[0].lat);
                 connections.push(
                   <path key="conn-active" d={`M ${start.x},${start.y} L ${end.x},${end.y}`} fill="none" stroke="#3B82F6" strokeWidth="6" strokeDasharray="6 6" strokeLinecap="round" strokeLinejoin="round" />
                 );
               }
            }
            
            return connections;
          })()}

          {/* Draw the actual strokes */}
          {trailStrokes.map((stroke, i) => {
            if (!stroke.path || stroke.path.length < 2) return null;
            const points = stroke.path.map(p => projectToSVG(p.lng, p.lat));
            const d = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
            let strokeColor = '#3B82F6'; // Default normal path (Blue)
            if (stroke.type === 'moderate') strokeColor = '#EAB308'; // Yellow
            if (stroke.type === 'danger') strokeColor = '#EF4444'; // Red
            return <path key={`stroke-${i}`} d={d} fill="none" stroke={strokeColor} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />;
          })}
          
          {/* Active Path being drawn */}
          {activePath.length > 1 && (
            <path 
              d={`M ${activePath.map(p => projectToSVG(p.lng, p.lat)).map(p => `${p.x},${p.y}`).join(' L ')}`} 
              fill="none" stroke="#3B82F6" strokeWidth="6" strokeDasharray="6 6" strokeLinecap="round" strokeLinejoin="round" 
            />
          )}
        </svg>,
        portalTarget
      )}
    </div>
  );
}
