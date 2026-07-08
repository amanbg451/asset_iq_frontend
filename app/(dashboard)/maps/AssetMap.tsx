"use client";

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet-fullscreen/dist/leaflet.fullscreen.css";
import "leaflet.heat/dist/leaflet-heat.js";
import MarkerClusterGroup from "react-leaflet-cluster";

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Fix for fullscreen
// @ts-ignore
delete L.Map.prototype._initFullScreen;
// @ts-ignore
delete L.Map.prototype.isFullscreen;

interface AssetLocation {
  asset_id: string;
  current_latitude: number;
  current_longitude: number;
  name: string | null;
  location_id: string | null;
  status?: string;
  [key: string]: any;
}

interface AssetMapProps {
  assets: AssetLocation[];
  onAssetClick: (asset: AssetLocation) => void;
  mapMode?: "light" | "dark";
  viewType?: "street" | "satellite";
  selectedAssetId?: string;
  showHeatmap?: boolean;
  fullscreen?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export interface AssetMapRef {
  fitBounds: () => void;
  toggleFullscreen: () => void;
  getMap: () => L.Map | null;
}

// ─── TILE LAYER CONFIGURATIONS ────────────────────────────────────────────────
const TILE_LAYERS = {
  street: {
    light: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    dark: {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB',
    },
  },
  satellite: {
    light: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: '&copy; <a href="https://www.esri.com">Esri</a>',
    },
    dark: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: '&copy; <a href="https://www.esri.com">Esri</a>',
    },
  },
};

// ─── CUSTOM MARKERS BY STATUS ──────────────────────────────────────────────────
const getMarkerIcon = (status?: string, isDark?: boolean) => {
  const colors: Record<string, string> = {
    AVAILABLE: "#22c55e",
    ASSIGNED: "#3b82f6",
    MAINTENANCE: "#eab308",
    TRANSIT: "#8b5cf6",
    DECOMMISSIONED: "#ef4444",
  };

  const color = status && colors[status] ? colors[status] : "#6b7280";
  const borderColor = isDark ? "#1f2937" : "white";

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background: ${color};
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 3px solid ${borderColor};
        box-shadow: 0 2px 12px rgba(0,0,0,${isDark ? 0.4 : 0.25});
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s, box-shadow 0.2s;
        cursor: pointer;
      ">
        <div style="
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: white;
          opacity: 0.9;
        "></div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
};

// ─── CUSTOM CLUSTER ICON ──────────────────────────────────────────────────────
const createClusterIcon = (cluster: any, isDark?: boolean) => {
  const count = cluster.getChildCount();
  const size = count > 100 ? 54 : count > 50 ? 44 : 34;
  const bgColor = isDark ? "#dc2626" : "#c0152a";
  
  return L.divIcon({
    html: `
      <div style="
        background: ${bgColor};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 3px solid ${isDark ? "#1f2937" : "white"};
        box-shadow: 0 2px 16px rgba(192,21,42,${isDark ? 0.5 : 0.35});
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${count > 100 ? 15 : 13}px;
        font-family: system-ui, -apple-system, sans-serif;
      ">
        ${count}
      </div>
    `,
    className: "cluster-icon",
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
};

// ─── HEATMAP LAYER COMPONENT ───────────────────────────────────────────────────
function HeatmapLayer({ assets, show }: { assets: AssetLocation[]; show: boolean }) {
  const map = useMap();
  const heatLayerRef = useRef<any>(null);

  useEffect(() => {
    // @ts-ignore
    if (!L.heatLayer) {
      console.warn("Leaflet heat plugin not loaded");
      return;
    }

    if (show) {
      const heatData = assets
        .filter(a => a.current_latitude && a.current_longitude)
        .map(a => [a.current_latitude, a.current_longitude, 1] as [number, number, number]);

      if (heatData.length > 0) {
        // @ts-ignore
        heatLayerRef.current = L.heatLayer(heatData, {
          radius: 25,
          blur: 15,
          maxZoom: 17,
          minOpacity: 0.3,
          gradient: {
            0.0: 'rgba(192,21,42,0)',
            0.2: 'rgba(192,21,42,0.3)',
            0.5: 'rgba(220,38,38,0.6)',
            0.8: 'rgba(220,38,38,0.8)',
            1.0: 'rgba(220,38,38,1)',
          },
        }).addTo(map);
      }
    } else {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    }

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [assets, show, map]);

  return null;
}

// ─── MAP CONTROLLER ────────────────────────────────────────────────────────────
function MapController({ 
  assets, 
  selectedAssetId, 
  onMapReady 
}: { 
  assets: AssetLocation[]; 
  selectedAssetId?: string;
  onMapReady?: (map: L.Map) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  useEffect(() => {
    if (selectedAssetId) {
      const asset = assets.find((a) => a.asset_id === selectedAssetId);
      if (asset && asset.current_latitude && asset.current_longitude) {
        map.flyTo([asset.current_latitude, asset.current_longitude], 15, {
          duration: 1.5,
        });
      }
    }
  }, [selectedAssetId, assets, map]);

  return null;
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
const AssetMap = forwardRef<AssetMapRef, AssetMapProps>(({
  assets,
  onAssetClick,
  mapMode = "light",
  viewType = "street",
  selectedAssetId,
  showHeatmap = false,
  fullscreen = false,
  onFullscreenChange,
}, ref) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ─── Calculate center based on assets ─────────────────────────────────────
  const getCenter = () => {
    const validAssets = assets.filter(a => a.current_latitude && a.current_longitude);
    if (validAssets.length === 0) {
      return { lat: 28.6139, lng: 77.2090 };
    }
    
    const avgLat = validAssets.reduce((sum, a) => sum + a.current_latitude, 0) / validAssets.length;
    const avgLng = validAssets.reduce((sum, a) => sum + a.current_longitude, 0) / validAssets.length;
    return { lat: avgLat, lng: avgLng };
  };

  const center = getCenter();

  // ─── Get tile config ──────────────────────────────────────────────────────
  const getTileConfig = () => {
    const mode = mapMode === "dark" ? "dark" : "light";
    const type = viewType === "satellite" ? "satellite" : "street";
    return TILE_LAYERS[type][mode];
  };

  const tileConfig = getTileConfig();

  // ─── Handle map ready ─────────────────────────────────────────────────────
  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    setMapReady(true);
    
    // Add fullscreen control
    // @ts-ignore
    if (L.control.fullscreen) {
      // @ts-ignore
      const fullscreenControl = L.control.fullscreen({
        position: 'topright',
        title: 'Toggle Fullscreen',
        titleCancel: 'Exit Fullscreen',
      });
      map.addControl(fullscreenControl);
      
      // @ts-ignore
      map.on('fullscreenchange', () => {
        // @ts-ignore
        const isFull = map.isFullscreen();
        setIsFullscreen(isFull);
        if (onFullscreenChange) {
          onFullscreenChange(isFull);
        }
      });
    }
  }, [onFullscreenChange]);

  // ─── Fit bounds ──────────────────────────────────────────────────────────
  const fitBounds = useCallback(() => {
    if (mapRef.current && assets.length > 0) {
      const validAssets = assets.filter(a => a.current_latitude && a.current_longitude);
      if (validAssets.length > 0) {
        const bounds = L.latLngBounds(
          validAssets.map(a => [a.current_latitude, a.current_longitude] as [number, number])
        );
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }
  }, [assets]);

  // ─── Toggle fullscreen ──────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (mapRef.current) {
      // @ts-ignore
      if (mapRef.current.isFullscreen) {
        // @ts-ignore
        if (mapRef.current.isFullscreen()) {
          // @ts-ignore
          mapRef.current.toggleFullscreen();
        } else {
          // @ts-ignore
          mapRef.current.toggleFullscreen();
        }
      }
    }
  }, []);

  // ─── Get map instance ──────────────────────────────────────────────────
  const getMap = useCallback(() => {
    return mapRef.current;
  }, []);

  // ─── Expose methods via ref ─────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    fitBounds,
    toggleFullscreen,
    getMap,
  }), [fitBounds, toggleFullscreen, getMap]);

  // ─── Fit bounds on assets change ──────────────────────────────────────
  useEffect(() => {
    if (mapRef.current && mapReady && assets.length > 0) {
      const validAssets = assets.filter(a => a.current_latitude && a.current_longitude);
      if (validAssets.length > 0) {
        const bounds = L.latLngBounds(
          validAssets.map(a => [a.current_latitude, a.current_longitude] as [number, number])
        );
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }
  }, [assets, mapReady]);

  // ─── Handle fullscreen prop change ────────────────────────────────────
  useEffect(() => {
    if (fullscreen && !isFullscreen) {
      toggleFullscreen();
    }
  }, [fullscreen, isFullscreen, toggleFullscreen]);

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full ${isFullscreen ? 'h-screen' : 'h-[600px]'} transition-all duration-300`}
    >
      {/* --- 1. MAP CONTAINER (ABSOLUTE) --- */}
      <div className="absolute inset-0 w-full h-full">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={12}
          scrollWheelZoom={true}
          className="w-full h-full rounded-lg"
          ref={mapRef as any}
          zoomControl={false}
          // @ts-ignore
          fullscreenControl={false}
        >
          {/* Zoom Control */}
          <ZoomControl position="topright" />

          {/* Tile Layer */}
          <TileLayer
            url={tileConfig.url}
            attribution={tileConfig.attribution}
          />

          {/* Heatmap Layer */}
          <HeatmapLayer assets={assets} show={showHeatmap} />

          {/* Marker Cluster Group */}
          <MarkerClusterGroup
            chunkedLoading
            iconCreateFunction={(cluster: any) => createClusterIcon(cluster, mapMode === "dark")}
            maxClusterRadius={60}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            zoomToBoundsOnClick={true}
          >
            {assets.map((asset) => {
              if (!asset.current_latitude || !asset.current_longitude) return null;
              
              return (
                <Marker
                  key={asset.asset_id}
                  position={[asset.current_latitude, asset.current_longitude]}
                  icon={getMarkerIcon(asset.status, mapMode === "dark")}
                  eventHandlers={{
                    click: () => onAssetClick(asset),
                  }}
                >
                  <Popup className={`custom-popup ${mapMode === "dark" ? "dark-popup" : ""}`}>
                    <div className={`min-w-[200px] p-1 ${mapMode === "dark" ? "bg-gray-800 text-white" : ""}`}>
                      <h3 className={`font-semibold ${mapMode === "dark" ? "text-white" : "text-gray-900"} mb-1`}>
                        {asset.name || "Unnamed Asset"}
                      </h3>
                      <p className={`text-xs font-mono mb-2 ${mapMode === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                        ID: {asset.asset_id.substring(0, 12)}...
                      </p>
                      {asset.status && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                          ${asset.status === "AVAILABLE" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400" : ""}
                          ${asset.status === "ASSIGNED" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400" : ""}
                          ${asset.status === "MAINTENANCE" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400" : ""}
                          ${asset.status === "TRANSIT" ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400" : ""}
                          ${asset.status === "DECOMMISSIONED" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400" : ""}
                        `}>
                          {asset.status}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssetClick(asset);
                        }}
                        className="mt-2 w-full px-3 py-1.5 bg-gradient-to-r from-red-600 to-red-700 text-white text-xs rounded-lg hover:shadow-md transition-all font-medium"
                      >
                        View Details →
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MarkerClusterGroup>

          {/* Map Controller */}
          <MapController 
            assets={assets} 
            selectedAssetId={selectedAssetId}
            onMapReady={handleMapReady}
          />
        </MapContainer>
      </div>

      {/* --- 2. LEGEND (NOW OUTSIDE MAPCONTAINER, ON TOP) --- */}
      <div className={`absolute bottom-4 left-4 z-[1000] backdrop-blur-sm rounded-lg shadow-lg p-3 border transition-colors duration-300 pointer-events-auto
        ${mapMode === "dark" 
          ? "bg-gray-800/90 border-gray-700" 
          : "bg-white/90 border-gray-200"
        }`}
      >
        <p className={`text-xs font-semibold mb-2 ${mapMode === "dark" ? "text-gray-300" : "text-gray-700"}`}>
          Status
        </p>
        <div className="space-y-1">
          {[
            { color: "bg-green-500", label: "Available" },
            { color: "bg-blue-500", label: "Assigned" },
            { color: "bg-yellow-500", label: "Maintenance" },
            { color: "bg-purple-500", label: "In Transit" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
              <span className={mapMode === "dark" ? "text-gray-400" : "text-gray-600"}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
        <div className={`mt-2 pt-2 border-t ${mapMode === "dark" ? "border-gray-700" : "border-gray-200"}`}>
          <div className={`flex items-center gap-2 text-xs ${mapMode === "dark" ? "text-gray-500" : "text-gray-500"}`}>
            <span>📍</span>
            <span>{assets.filter(a => a.current_latitude && a.current_longitude).length} assets located</span>
          </div>
        </div>
      </div>

      {/* --- 3. OTHER UI ELEMENTS (OUTSIDE MAPCONTAINER) --- */}
      {/* ─── ZOOM HINT ────────────────────────────────────────────────────────── */}
      <div className={`absolute bottom-4 right-4 z-[1000] backdrop-blur-sm rounded-lg shadow-lg p-2 text-xs transition-colors duration-300 pointer-events-none
        ${mapMode === "dark" 
          ? "bg-gray-800/90 text-gray-400" 
          : "bg-white/90 text-gray-500"
        }`}
      >
        🖱️ Scroll to zoom
      </div>

      {/* ─── HEATMAP INDICATOR ────────────────────────────────────────────────── */}
      {showHeatmap && (
        <div className={`absolute top-4 right-4 z-[1000] backdrop-blur-sm rounded-lg shadow-lg px-3 py-1.5 text-xs font-medium transition-colors duration-300 pointer-events-none
          ${mapMode === "dark" 
            ? "bg-red-900/40 text-red-400 border border-red-800" 
            : "bg-red-50 text-red-600 border border-red-200"
          }`}
        >
          🔥 Heatmap Active
        </div>
      )}
    </div>
  );
});

AssetMap.displayName = "AssetMap";

export default AssetMap;