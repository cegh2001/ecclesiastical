import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Map, Globe, Palette, PenTool, Undo, Trash2, Copy, Check } from 'lucide-react';

const DRAWING_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

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
      transition: 'all 0.3s',
      className: 'sector-polygon-path'
    };
  }
  if (isHovered) {
    return {
      color: baseColor,
      weight: 3.5,
      dashArray: 'none',
      fillColor: baseColor,
      fillOpacity: 0.50, // More solid on hover
      transition: 'all 0.3s',
      className: 'sector-polygon-path'
    };
  }
  return {
    color: baseColor,
    weight: 2.5, // Thicker border
    dashArray: 'none', // Solid line for clearer division
    fillColor: baseColor,
    fillOpacity: 0.35, // Less faint default fill
    transition: 'all 0.3s',
    className: 'sector-polygon-path'
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

  // Drawing states
  const [showDrawingPanel, setShowDrawingPanel] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [snapToRoad, setSnapToRoad] = useState(true);
  const [lineWidth, setLineWidth] = useState(3);
  const [lineColor, setLineColor] = useState('#3b82f6');
  const [drawnLines, setDrawnLines] = useState([]);
  const [activeLinePoints, setActiveLinePoints] = useState([]);
  const [copied, setCopied] = useState(false);

  const isDrawingRef = useRef(isDrawing);
  const snapToRoadRef = useRef(snapToRoad);
  const activeLinePointsRef = useRef(activeLinePoints);

  const onSelectSectorRef = useRef(onSelectSector);
  const activeSectorRef = useRef(activeSector);
  onSelectSectorRef.current = onSelectSector;
  activeSectorRef.current = activeSector;

  // Keep refs synchronized to prevent stale closure issues in Leaflet events
  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);

  useEffect(() => {
    snapToRoadRef.current = snapToRoad;
  }, [snapToRoad]);

  useEffect(() => {
    activeLinePointsRef.current = activeLinePoints;
  }, [activeLinePoints]);

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

  // 4. Drawing Event Listeners & Effects
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = async (e) => {
      if (!isDrawingRef.current) return;

      const clickedPoint = e.latlng;
      const prevPoints = activeLinePointsRef.current;

      if (prevPoints.length > 0 && snapToRoadRef.current) {
        const lastPoint = prevPoints[prevPoints.length - 1];
        // Fetch route from OSRM to follow the street curves
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${lastPoint.lng},${lastPoint.lat};${clickedPoint.lng},${clickedPoint.lat}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates; // [lng, lat]
            const routeLatLngs = coords.map(coord => L.latLng(coord[1], coord[0]));
            
            // Skip the first coordinate as it corresponds to lastPoint roughly
            setActiveLinePoints(prev => [...prev, ...routeLatLngs.slice(1)]);
          } else {
            setActiveLinePoints(prev => [...prev, clickedPoint]);
          }
        } catch (error) {
          console.warn("OSRM routing request failed. Drawing straight line.", error);
          setActiveLinePoints(prev => [...prev, clickedPoint]);
        }
      } else {
        setActiveLinePoints(prev => [...prev, clickedPoint]);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [sectorsData]);

  // Toggle map cursor class when drawing mode is active
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const container = map.getContainer();
    if (isDrawing) {
      container.classList.add('drawing-cursor');
    } else {
      container.classList.remove('drawing-cursor');
    }
  }, [isDrawing]);

  // Active line preview rendering
  const activePolylineRef = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (activePolylineRef.current) {
      map.removeLayer(activePolylineRef.current);
      activePolylineRef.current = null;
    }

    if (activeLinePoints.length > 0) {
      activePolylineRef.current = L.polyline(activeLinePoints, {
        color: lineColor,
        weight: lineWidth,
        dashArray: '5, 8',
        opacity: 0.8
      }).addTo(map);
    }
  }, [activeLinePoints, lineColor, lineWidth]);

  // Completed lines rendering
  const completedLayersRef = useRef([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    completedLayersRef.current.forEach(layer => map.removeLayer(layer));
    completedLayersRef.current = [];

    drawnLines.forEach((line, index) => {
      const polyline = L.polyline(line.points, {
        color: line.color,
        weight: line.width,
        opacity: 0.9
      }).addTo(map);

      polyline.bindPopup(`Línea ${index + 1} (Grosor: ${line.width}px, Color: ${line.color})`);
      completedLayersRef.current.push(polyline);
    });
  }, [drawnLines]);

  // Drawing helper functions
  const finishCurrentLine = () => {
    if (activeLinePoints.length < 2) {
      setActiveLinePoints([]);
      return;
    }
    setDrawnLines(prev => [...prev, {
      points: activeLinePoints,
      color: lineColor,
      width: lineWidth
    }]);
    setActiveLinePoints([]);
  };

  const undoLastPoint = () => {
    setActiveLinePoints(prev => {
      if (prev.length <= 1) return [];
      return prev.slice(0, -1);
    });
  };

  const clearAllDrawing = () => {
    if (window.confirm("¿Estás seguro de que querés borrar todas las líneas dibujadas?")) {
      setDrawnLines([]);
      setActiveLinePoints([]);
    }
  };

  const editDrawnLine = (index) => {
    if (activeLinePoints.length > 0) {
      if (!window.confirm("Hay una línea en progreso. ¿Querés descartarla para editar esta línea?")) {
        return;
      }
    }
    const targetLine = drawnLines[index];
    setLineColor(targetLine.color);
    setLineWidth(targetLine.width);
    setActiveLinePoints(targetLine.points);
    setDrawnLines(prev => prev.filter((_, idx) => idx !== index));
    setIsDrawing(true);
  };

  const deleteDrawnLine = (index) => {
    if (window.confirm("¿Querés borrar esta línea?")) {
      setDrawnLines(prev => prev.filter((_, idx) => idx !== index));
    }
  };

  const editSectorBoundary = () => {
    if (!activeSector) return;
    if (activeLinePoints.length > 0) {
      if (!window.confirm("Hay una línea en progreso. ¿Querés descartarla para editar el límite de este sector?")) {
        return;
      }
    }
    
    try {
      const coords = activeSector.geometry.coordinates[0]; // exterior ring
      const latLngs = coords.map(coord => L.latLng(coord[1], coord[0]));
      
      // Remove closing point to make it a line for editing
      if (latLngs.length > 1 && latLngs[0].equals(latLngs[latLngs.length - 1])) {
        latLngs.pop();
      }

      setLineColor(SECTOR_COLORS[activeSector.properties.id] || '#3b82f6');
      setLineWidth(3);
      setActiveLinePoints(latLngs);
      setIsDrawing(true);
    } catch (error) {
      console.error("Error importing sector geometry:", error);
      alert("No se pudo importar la geometría de este sector.");
    }
  };

  const generateGeoJSON = () => {
    const features = drawnLines.map((line, index) => {
      const coordinates = line.points.map(pt => [pt.lng, pt.lat]);
      return {
        type: "Feature",
        properties: {
          id: `drawn-line-${index + 1}`,
          color: line.color,
          width: line.width,
          name: `Línea Delimitadora ${index + 1}`
        },
        geometry: {
          type: "LineString",
          coordinates: coordinates
        }
      };
    });

    return JSON.stringify({
      type: "FeatureCollection",
      features: features
    }, null, 2);
  };

  const copyToClipboard = () => {
    const geojsonStr = generateGeoJSON();
    navigator.clipboard.writeText(geojsonStr)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error("Error copying GeoJSON to clipboard:", err);
      });
  };

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
        <button
          className={`map-style-btn ${showDrawingPanel ? 'active' : ''}`}
          onClick={() => {
            setShowDrawingPanel(!showDrawingPanel);
            if (showDrawingPanel) {
              setIsDrawing(false);
            }
          }}
          title="Trazar líneas delimitadoras en calles"
        >
          <PenTool />
          <span>Trazar</span>
        </button>
      </div>

      {/* Collapsible drawing tool panel */}
      {showDrawingPanel && (
        <div className="drawing-panel glass-panel">
          <div className="drawing-panel-title">
            <PenTool size={18} style={{ color: 'var(--neon-cyan)' }} />
            <span>Herramienta de Delimitación</span>
          </div>

          {activeSector && (
            <div className="drawing-section">
              <span className="drawing-label">Sector Seleccionado</span>
              <div className="drawing-row" style={{ background: 'var(--bg-active)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--panel-border-hover)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{activeSector.properties.name}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{activeSector.properties.patronSaint}</span>
                </div>
                <button
                  className="drawing-btn"
                  onClick={editSectorBoundary}
                  title="Importar contorno del sector al editor de trazado para modificarlo"
                  style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', gap: '4px', alignItems: 'center' }}
                >
                  <PenTool size={12} /> Editar Límite
                </button>
              </div>
            </div>
          )}

          <div className="drawing-section">
            <span className="drawing-label">Modo de Operación</span>
            <div className="drawing-row">
              <button
                className={`drawing-btn ${isDrawing ? 'active' : ''}`}
                onClick={() => setIsDrawing(!isDrawing)}
                style={{ flex: 1 }}
              >
                {isDrawing ? 'Dibujando (Clic en mapa)' : 'Iniciar Dibujo'}
              </button>
            </div>
          </div>

          {isDrawing && (
            <div className="drawing-section">
              <span className="drawing-label">Método de Trazado</span>
              <label className="switch-container">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={snapToRoad}
                  onChange={(e) => setSnapToRoad(e.target.checked)}
                />
                <span className="switch-slider"></span>
                <span>Ajustar a Calles (OSRM)</span>
              </label>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px', lineHeight: '1.2' }}>
                {snapToRoad 
                  ? "Hace clic en las esquinas y la línea seguirá las curvas de la calle automáticamente."
                  : "Dibuja tramos rectos libres conectando cada clic."}
              </p>
            </div>
          )}

          <div className="drawing-section">
            <span className="drawing-label">Estilo de Línea</span>
            <div className="drawing-row">
              <span>Grosor:</span>
              <div className="width-controls">
                <button
                  className="drawing-btn"
                  onClick={() => setLineWidth(Math.max(1, lineWidth - 1))}
                  style={{ padding: '4px 8px' }}
                >
                  -
                </button>
                <span className="width-value">{lineWidth}px</span>
                <button
                  className="drawing-btn"
                  onClick={() => setLineWidth(Math.min(10, lineWidth + 1))}
                  style={{ padding: '4px 8px' }}
                >
                  +
                </button>
              </div>
            </div>

            <div className="drawing-row" style={{ marginTop: '4px' }}>
              <span>Color:</span>
              <div className="color-presets">
                {DRAWING_COLORS.map(color => (
                  <div
                    key={color}
                    className={`color-dot ${lineColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setLineColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>

          {(activeLinePoints.length > 0 || drawnLines.length > 0) && (
            <div className="drawing-section">
              <span className="drawing-label">Acciones</span>
              <div className="drawing-grid">
                {activeLinePoints.length > 0 && (
                  <>
                    <button
                      className="drawing-btn drawing-btn-success"
                      onClick={finishCurrentLine}
                    >
                      <Check size={14} /> Finalizar
                    </button>
                    <button
                      className="drawing-btn"
                      onClick={undoLastPoint}
                    >
                      <Undo size={14} /> Deshacer
                    </button>
                  </>
                )}
                {drawnLines.length > 0 && (
                  <button
                    className="drawing-btn drawing-btn-danger"
                    onClick={clearAllDrawing}
                    style={{ gridColumn: 'span 2' }}
                  >
                    <Trash2 size={14} /> Limpiar Todo
                  </button>
                )}
              </div>
            </div>
          )}

          {drawnLines.length > 0 && (
            <div className="drawing-section">
              <span className="drawing-label">Líneas Trazadas ({drawnLines.length})</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '105px', overflowY: 'auto', paddingRight: '4px' }}>
                {drawnLines.map((line, index) => (
                  <div key={index} className="drawing-row" style={{ background: 'rgba(255, 255, 255, 0.4)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--panel-border)', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: line.color }} />
                      <span>Línea {index + 1} ({line.width}px)</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="drawing-btn"
                        onClick={() => editDrawnLine(index)}
                        style={{ padding: '4px 6px' }}
                        title="Volver a editar esta línea"
                      >
                        <PenTool size={11} />
                      </button>
                      <button
                        className="drawing-btn drawing-btn-danger"
                        onClick={() => deleteDrawnLine(index)}
                        style={{ padding: '4px 6px' }}
                        title="Eliminar esta línea"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {drawnLines.length > 0 && (
            <div className="drawing-section geojson-container">
              <span className="drawing-label">Resultados (GeoJSON)</span>
              <textarea
                className="geojson-textarea"
                readOnly
                value={generateGeoJSON()}
                onClick={(e) => e.target.select()}
              />
              <button
                className="drawing-btn"
                onClick={copyToClipboard}
                style={{ width: '100%', background: copied ? 'rgba(16, 185, 129, 0.1)' : '' }}
              >
                <Copy size={14} /> {copied ? '¡Copiado!' : 'Copiar GeoJSON'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
