import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Map, Globe, Palette } from 'lucide-react';

// Distinct pastel colors per sector so the map looks colorful and clean
const SECTOR_COLORS = {
  'caimito': '#fbcfe8',            // Pink pastel
  'las-tomitas': '#fef08a',        // Yellow pastel
  'el-collao': '#bbf7d0',          // Green pastel
  'san-julian': '#bfdbfe',         // Blue pastel
  'casco-central': '#fed7aa',      // Orange pastel
  'tarigua': '#ddd6fe',            // Violet pastel
  'la-miel': '#c084fc',            // Purple pastel
  'francisco-fajardo': '#93c5fd',  // Light Blue pastel
  '27-de-julio': '#a7f3d0',        // Mint pastel
  'colonia-andina': '#fca5a5',     // Light Red/Coral pastel
  'palmar-este': '#fdba74',        // Amber pastel
  'tarituca': '#f5d0fe',           // Light Pink pastel
  'tucacas': '#cffafe'             // Cyan pastel
};

// Available map styles/tiles
const TILE_LAYERS = {
  roadmap: {
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    options: {
      attribution: '&copy; Google Maps',
      maxZoom: 20
    }
  },
  satellite: {
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    options: {
      attribution: '&copy; Google Maps',
      maxZoom: 20
    }
  },
  classic: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }
  }
};

// Helper to determine circle styles based on active/hover states
const getSectorStyle = (feature, isActive, isHovered) => {
  const id = feature?.properties?.id;
  const baseColor = SECTOR_COLORS[id] || '#cbd5e1'; // Fallback to slate grey

  if (isActive) {
    return {
      color: '#0891b2', // Slightly darker cyan for better contrast
      weight: 4,
      dashArray: 'none',
      fillColor: '#06b6d4',
      fillOpacity: 0.60, // Significantly less faint
      transition: 'all 0.3s'
    };
  }
  if (isHovered) {
    return {
      color: baseColor,
      weight: 3.5,
      dashArray: 'none',
      fillColor: baseColor,
      fillOpacity: 0.50, // More solid on hover
      transition: 'all 0.3s'
    };
  }
  return {
    color: baseColor,
    weight: 2.5, // Thicker border
    dashArray: 'none', // Solid line for clearer division
    fillColor: baseColor,
    fillOpacity: 0.35, // Less faint default fill
    transition: 'all 0.3s'
  };
};

export default function InteractiveMap({
  sectorsData,
  activeSector,
  onSelectSector
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const geojsonLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [mapStyle, setMapStyle] = useState('roadmap');
  const appliedStyleRef = useRef('roadmap');

  const onSelectSectorRef = useRef(onSelectSector);
  const activeSectorRef = useRef(activeSector);
  onSelectSectorRef.current = onSelectSector;
  activeSectorRef.current = activeSector;

  // Synchronize active map style when user clicks the style toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileLayerRef.current || appliedStyleRef.current === mapStyle) return;

    map.removeLayer(tileLayerRef.current);

    const config = TILE_LAYERS[mapStyle];
    if (config) {
      const tileLayer = L.tileLayer(config.url, config.options).addTo(map);
      tileLayerRef.current = tileLayer;
      appliedStyleRef.current = mapStyle;
    }
  }, [mapStyle]);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center map around Caraballeda (10.6167, -66.8500)
    const map = L.map(mapContainerRef.current, {
      center: [10.6167, -66.8500],
      zoom: 13,
      zoomControl: true,
      attributionControl: true
    });

    mapRef.current = map;

    // Load initial tile layer based on mapStyle state
    const config = TILE_LAYERS[mapStyle];
    const tileLayer = L.tileLayer(config.url, config.options).addTo(map);
    tileLayerRef.current = tileLayer;
    appliedStyleRef.current = mapStyle;

    // 2. Load Sector Layer from GeoJSON
    try {
      if (!sectorsData || !sectorsData.features) {
        throw new Error("Invalid or corrupt GeoJSON data structure");
      }

      const geojsonLayer = L.geoJSON(sectorsData, {
        style: (feature) => {
          const isActive = activeSectorRef.current && activeSectorRef.current.properties.id === feature.properties.id;
          return getSectorStyle(feature, isActive, false);
        },
        onEachFeature: (feature, layer) => {
          // Hover and click events
          layer.on({
            mouseover: () => {
              const isActive = activeSectorRef.current && activeSectorRef.current.properties.id === feature.properties.id;
              if (!isActive) {
                layer.setStyle(getSectorStyle(feature, false, true));
              }
            },
            mouseout: () => {
              const isActive = activeSectorRef.current && activeSectorRef.current.properties.id === feature.properties.id;
              layer.setStyle(getSectorStyle(feature, isActive, false));
            },
            click: (e) => {
              onSelectSectorRef.current(feature);
              L.DomEvent.stopPropagation(e);
            }
          });

          // Bind tooltip
          layer.bindTooltip(feature.properties.name, {
            permanent: false,
            direction: 'center',
            className: 'glass-tooltip'
          });
        }
      }).addTo(map);

      geojsonLayerRef.current = geojsonLayer;
    } catch (error) {
      console.warn("Malformed boundaries detected in sectorsData. Rendering fallback bounding box.", error);
      
      // Render fallback bounding box: red dashed lines
      L.rectangle([[10.60, -66.87], [10.623, -66.818]], {
        color: '#ef4444',
        weight: 1.5,
        fillColor: '#ef4444',
        fillOpacity: 0.03,
        dashArray: '5, 5'
      }).addTo(map);
    }

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [sectorsData]);

  // 3. Synchronize Active Sector Selection & flyTo Bounds
  useEffect(() => {
    const map = mapRef.current;
    const geojsonLayer = geojsonLayerRef.current;
    if (!map || !geojsonLayer) return;

    // Reset styles and find active layer
    let activeLayer = null;
    geojsonLayer.eachLayer((layer) => {
      const isActive = activeSector && activeSector.properties.id === layer.feature.properties.id;
      layer.setStyle(getSectorStyle(layer.feature, isActive, false));
      if (isActive) {
        activeLayer = layer;
      }
    });

    // Fly to bounds if active sector changes
    if (activeLayer) {
      const bounds = activeLayer.getBounds();
      map.flyToBounds(bounds, {
        padding: [60, 60],
        duration: 1.2,
        easeLinearity: 0.25
      });
    }
  }, [activeSector]);

  return (
    <div className="map-wrapper">
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Premium Floating Map Style Selector */}
      <div className="map-style-switcher">
        <button
          className={`map-style-btn ${mapStyle === 'roadmap' ? 'active' : ''}`}
          onClick={() => setMapStyle('roadmap')}
          title="Ver calles y avenidas (Google Maps)"
        >
          <Map />
          <span>Mapa</span>
        </button>
        <button
          className={`map-style-btn ${mapStyle === 'satellite' ? 'active' : ''}`}
          onClick={() => setMapStyle('satellite')}
          title="Ver imagen satelital con etiquetas (Google Maps)"
        >
          <Globe />
          <span>Satélite</span>
        </button>
        {/* <button
          className={`map-style-btn ${mapStyle === 'classic' ? 'active' : ''}`}
          onClick={() => setMapStyle('classic')}
          title="Ver mapa clásico (Pastel)"
        >
          <Palette />
          <span>Clásico</span>
        </button> */}
      </div>
    </div>
  );
}
