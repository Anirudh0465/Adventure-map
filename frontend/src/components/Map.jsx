import React, { useEffect, useRef, useState } from 'react';
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
  const currentPathRef = useRef([]);
  const latestGeoJSONRef = useRef({ type: 'FeatureCollection', features: [] });

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

    // Initialize Trail Layer permanently when style loads
    const initTrailLayer = () => {
      if (map.current && !map.current.getSource('trail')) {
        map.current.addSource('trail', {
          type: 'geojson',
          data: latestGeoJSONRef.current
        });
        map.current.addLayer({
          id: 'trail-line',
          type: 'line',
          source: 'trail',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 
            'line-color': [
              'match',
              ['get', 'type'],
              'moderate', '#EAB308', // yellow
              'danger', '#EF4444', // red
              '#FFFFFF' // normal
            ],
            'line-width': 6
          }
        });
        
        // Active drawing source
        map.current.addSource('active-trail', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
        map.current.addLayer({
          id: 'active-trail-line',
          type: 'line',
          source: 'active-trail',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 
            'line-color': '#FFFFFF', 
            'line-width': 6,
            'line-dasharray': [1, 2] // Dashed so user knows it's being drawn
          }
        });
      }
    };

    map.current.on('style.load', initTrailLayer);
    if (map.current.isStyleLoaded()) {
      initTrailLayer();
    }

    // Try to get user's location and fly to it
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (map.current) {
            map.current.flyTo({
              center: [position.coords.longitude, position.coords.latitude],
              zoom: 12,
              essential: true // this animation is considered essential with respect to prefers-reduced-motion
            });
          }
        },
        (error) => {
          console.warn("Geolocation denied or failed:", error);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

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
      currentPathRef.current = [{ lat: e.lngLat.lat, lng: e.lngLat.lng }];
    };

    const onMouseMove = (e) => {
      if (!isDrawingFreehand || !isDrawingRef.current) return;
      e.preventDefault();
      currentPathRef.current.push({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      
      const source = map.current.getSource('active-trail');
      if (source && currentPathRef.current.length > 1) {
        source.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: currentPathRef.current.map(p => [p.lng, p.lat])
            }
          }]
        });
      }
    };

    const onMouseUp = (e) => {
      if (!isDrawingFreehand || !isDrawingRef.current) return;
      isDrawingRef.current = false;
      if (currentPathRef.current.length > 1 && onDrawFreehand) {
        onDrawFreehand(currentPathRef.current);
      }
      currentPathRef.current = [];
      const source = map.current.getSource('active-trail');
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] });
      }
    };

    map.current.on('mousedown', onMouseDown);
    map.current.on('mousemove', onMouseMove);
    map.current.on('mouseup', onMouseUp);

    return () => {
      map.current.off('mousedown', onMouseDown);
      map.current.off('mousemove', onMouseMove);
      map.current.off('mouseup', onMouseUp);
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
      el.title = pt.poiType.toUpperCase();

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pt.lng, pt.lat])
        .addTo(map.current);
      
      poiMarkersRef.current.push(marker);
    });

    // 3. Prepare colored LineString segments from strokes
    let trailFeatures = [];
    
    trailStrokes.forEach(stroke => {
      if (stroke.path && stroke.path.length > 1) {
        trailFeatures.push({
          type: 'Feature',
          properties: { type: stroke.type },
          geometry: {
            type: 'LineString',
            coordinates: stroke.path.map(p => [p.lng, p.lat])
          }
        });
      }
    });

    const geojsonData = {
      type: 'FeatureCollection',
      features: trailFeatures
    };

    latestGeoJSONRef.current = geojsonData;

    // 4. Safely update the geojson data
    const source = map.current?.getSource('trail');
    if (source) {
      source.setData(geojsonData);
    }
  }, [trailStrokes, trailPOIs, selectedLocation]);

  return (
    <div className="map-wrapper">
      <div ref={mapContainer} className="map-container" />
    </div>
  );
}
