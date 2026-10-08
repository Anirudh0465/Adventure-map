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

export default function Map({ places, onMapClick, onMarkerClick, mapStyleType = 'street', trailPoints = [], selectedLocation = null }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng] = useState(-122.3321); // Seattle Default
  const [lat] = useState(47.6062);
  const [zoom] = useState(11);
  const markersRef = useRef({}); // keep track of markers
  const trailMarkersRef = useRef([]); // track trail dots
  const onMapClickRef = useRef(onMapClick);

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
  }, [lng, lat, zoom]);

  useEffect(() => {
    if (!map.current) return;
    map.current.setStyle(mapStyleType === 'satellite' ? satelliteStyle : streetStyle);
  }, [mapStyleType]);

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

    // 1. Remove old trail markers
    trailMarkersRef.current.forEach(m => m.remove());
    trailMarkersRef.current = [];

    // 2. Remove old GeoJSON line if exists
    if (map.current.getLayer('trail-line')) map.current.removeLayer('trail-line');
    if (map.current.getSource('trail')) map.current.removeSource('trail');

    if (trailPoints.length === 0) return;

    // 3. Draw the line connecting points (including destination if drawing)
    let coordinates = trailPoints.map(pt => [pt.lng, pt.lat]);
    
    // Connect to the destination pin if it exists so it flows into the final marker
    if (selectedLocation) {
      coordinates.push([selectedLocation.lng, selectedLocation.lat]);
    }

    if (coordinates.length >= 2) {
      map.current.addSource('trail', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates }
          }]
        }
      });

      map.current.addLayer({
        id: 'trail-line',
        type: 'line',
        source: 'trail',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#000000', 'line-width': 4 } // Solid black line for visibility
      });
    }

    // 4. Draw colored markers for each point based on difficulty type
    const typeColors = {
      normal: '#FFFFFF',
      moderate: '#EAB308', // yellow
      scenic: '#3B82F6', // blue
      danger: '#EF4444' // red
    };

    trailPoints.forEach(pt => {
      const el = document.createElement('div');
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = typeColors[pt.type] || '#FFFFFF';
      el.style.border = '2px solid #000';
      el.style.boxShadow = '0 0 5px rgba(255,255,255,0.5)';

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pt.lng, pt.lat])
        .addTo(map.current);
      
      trailMarkersRef.current.push(marker);
    });

  }, [trailPoints]);

  return (
    <div className="map-wrapper">
      <div ref={mapContainer} className="map-container" />
    </div>
  );
}
