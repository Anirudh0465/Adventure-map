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

export default function Map({ places, onMapClick, onMarkerClick, mapStyleType = 'street' }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng] = useState(-122.3321); // Seattle Default
  const [lat] = useState(47.6062);
  const [zoom] = useState(11);
  const markersRef = useRef({}); // keep track of markers
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

    map.current.on('click', (e) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.lngLat);
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
  }, [places, onMarkerClick]);

  return (
    <div className="map-wrapper">
      <div ref={mapContainer} className="map-container" />
    </div>
  );
}
