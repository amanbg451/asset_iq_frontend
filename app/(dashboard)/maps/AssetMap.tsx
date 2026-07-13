"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import MarkerClusterGroup from "react-leaflet-cluster";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface AssetLocation {
  asset_id: string;
  current_latitude: number;
  current_longitude: number;
  name: string | null;
  location_id: string | null;
  status?: string;
  created_image_url?: string;
  latest_image_url?: string;
  qr_code_url?: string;
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
  height?: string | number; // NEW: Custom height prop
}

export interface AssetMapRef {
  fitBounds: () => void;
  toggleFullscreen: () => void;
  getMap: () => L.Map | null;
}

const TILE_LAYERS = {
  street: {
    light: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    dark: {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB',
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

const getMarkerIcon = (status?: string, isDark?: boolean) => {
  const colors: Record<string, string> = {
    AVAILABLE: "#22c55e",
    ASSIGNED: "#3b82f6",
    MAINTENANCE: "#eab308",
    TRANSIT: "#8b5cf6",
    DECOMMISSIONED: "#ef4444",
    ACTIVE: "#22c55e",
    Good: "#22c55e",
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
    iconAnchor: [size / 2, size / 2],
  });
};

function HeatmapLayer({
  assets,
  show,
}: {
  assets: AssetLocation[];
  show: boolean;
}) {
  const map = useMap();
  const heatLayerRef = useRef<any>(null);

  useEffect(() => {
    // @ts-ignore
    if (!L.heatLayer) {
      console.warn("Leaflet heat plugin not loaded");
      return;
    }

    if (heatLayerRef.current) {
      try {
        map.removeLayer(heatLayerRef.current);
      } catch (e) {
        console.warn("Failed to remove heat layer:", e);
      }
      heatLayerRef.current = null;
    }

    if (show && assets.length > 0) {
      const heatData = assets
        .filter((a) => a.current_latitude && a.current_longitude)
        .map(
          (a) =>
            [a.current_latitude, a.current_longitude, 1] as [
              number,
              number,
              number,
            ],
        );

      if (heatData.length > 0) {
        try {
          // @ts-ignore
          heatLayerRef.current = L.heatLayer(heatData, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            minOpacity: 0.3,
            gradient: {
              0.0: "rgba(192,21,42,0)",
              0.2: "rgba(192,21,42,0.3)",
              0.5: "rgba(220,38,38,0.6)",
              0.8: "rgba(220,38,38,0.8)",
              1.0: "rgba(220,38,38,1)",
            },
          }).addTo(map);
        } catch (e) {
          console.warn("Failed to add heatmap layer:", e);
        }
      }
    }

    return () => {
      if (heatLayerRef.current) {
        try {
          map.removeLayer(heatLayerRef.current);
        } catch (e) {
          console.warn("Failed to remove heat layer on cleanup:", e);
        }
        heatLayerRef.current = null;
      }
    };
  }, [assets, show, map]);

  return null;
}

function MapController({
  assets,
  selectedAssetId,
  onMapReady,
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

const AssetMap = forwardRef<AssetMapRef, AssetMapProps>(
  (
    {
      assets,
      onAssetClick,
      mapMode = "light",
      viewType = "street",
      selectedAssetId,
      showHeatmap = false,
      fullscreen = false,
      onFullscreenChange,
      height = 500,
    },
    ref,
  ) => {
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [mapReady, setMapReady] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMounted, setIsMounted] = useState(true);

    const mapKey = useMemo(() => {
      return `map-${assets.length}-${Date.now()}`;
    }, [assets.length]);

    const getCenter = useCallback(() => {
      const validAssets = assets.filter(
        (a) => a.current_latitude && a.current_longitude,
      );
      if (validAssets.length === 0) {
        return { lat: 28.6139, lng: 77.209 };
      }

      const avgLat =
        validAssets.reduce((sum, a) => sum + a.current_latitude, 0) /
        validAssets.length;
      const avgLng =
        validAssets.reduce((sum, a) => sum + a.current_longitude, 0) /
        validAssets.length;
      return { lat: avgLat, lng: avgLng };
    }, [assets]);

    const center = getCenter();

    const getTileConfig = () => {
      const mode = mapMode === "dark" ? "dark" : "light";
      const type = viewType === "satellite" ? "satellite" : "street";
      return TILE_LAYERS[type][mode];
    };

    const tileConfig = getTileConfig();

    const handleMapReady = useCallback(
      (map: L.Map) => {
        if (!isMounted) return;

        mapRef.current = map;
        setMapReady(true);

        // @ts-ignore
        if (L.control.fullscreen) {
          try {
            // @ts-ignore
            const fullscreenControl = L.control.fullscreen({
              position: "topright",
              title: "Toggle Fullscreen",
              titleCancel: "Exit Fullscreen",
            });
            map.addControl(fullscreenControl);

            // @ts-ignore
            map.on("fullscreenchange", () => {
              if (!isMounted) return;
              // @ts-ignore
              const isFull = map.isFullscreen();
              setIsFullscreen(isFull);
              if (onFullscreenChange) {
                onFullscreenChange(isFull);
              }
            });
          } catch (e) {
            console.warn("Failed to add fullscreen control:", e);
          }
        }
      },
      [onFullscreenChange, isMounted],
    );

    const fitBounds = useCallback(() => {
      if (mapRef.current && assets.length > 0 && isMounted) {
        const validAssets = assets.filter(
          (a) => a.current_latitude && a.current_longitude,
        );
        if (validAssets.length > 0) {
          try {
            const bounds = L.latLngBounds(
              validAssets.map(
                (a) =>
                  [a.current_latitude, a.current_longitude] as [number, number],
              ),
            );
            mapRef.current.fitBounds(bounds, {
              padding: [50, 50],
              maxZoom: 14,
            });
          } catch (e) {
            console.warn("Failed to fit bounds:", e);
          }
        }
      }
    }, [assets, isMounted]);

    const toggleFullscreen = useCallback(() => {
      if (mapRef.current && isMounted) {
        try {
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
        } catch (e) {
          console.warn("Failed to toggle fullscreen:", e);
        }
      }
    }, [isMounted]);

    const getMap = useCallback(() => {
      return mapRef.current;
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        fitBounds,
        toggleFullscreen,
        getMap,
      }),
      [fitBounds, toggleFullscreen, getMap],
    );

    useEffect(() => {
      if (mapRef.current && mapReady && assets.length > 0 && isMounted) {
        const validAssets = assets.filter(
          (a) => a.current_latitude && a.current_longitude,
        );
        if (validAssets.length > 0) {
          try {
            const bounds = L.latLngBounds(
              validAssets.map(
                (a) =>
                  [a.current_latitude, a.current_longitude] as [number, number],
              ),
            );
            mapRef.current.fitBounds(bounds, {
              padding: [50, 50],
              maxZoom: 14,
            });
          } catch (e) {
            console.warn("Failed to fit bounds on assets change:", e);
          }
        }
      }
    }, [assets, mapReady, isMounted]);

    useEffect(() => {
      if (fullscreen && !isFullscreen && isMounted) {
        toggleFullscreen();
      }
    }, [fullscreen, isFullscreen, toggleFullscreen, isMounted]);

    useEffect(() => {
      return () => {
        setIsMounted(false);

        if (mapRef.current) {
          try {
            mapRef.current.eachLayer((layer: any) => {
              try {
                mapRef.current?.removeLayer(layer);
              } catch (e) {
                console.warn("Failed to remove layer:", e);
              }
            });

            mapRef.current.remove();
          } catch (e) {
            console.warn("Failed to clean up map:", e);
          }
          mapRef.current = null;
        }

        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }
      };
    }, []);

    if (assets.length === 0) {
      return (
        <div
          className="relative w-full rounded-lg flex items-center justify-center"
          style={{
            height: typeof height === "number" ? `${height}px` : height,
          }}
        >
          <div style={{ color: "#94a3b8", fontSize: 13 }}>
            No assets with location data
          </div>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className={`relative w-full transition-all duration-300 overflow-hidden`}
        style={{
          height: isFullscreen
            ? "100vh"
            : typeof height === "number"
              ? `${height}px`
              : height,
        }}
      >
        <MapContainer
          key={mapKey}
          center={[center.lat, center.lng]}
          zoom={12}
          scrollWheelZoom={true}
          className="w-full h-full rounded-lg z-0"
          zoomControl={false}
          whenReady={() => setMapReady(true)}
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
            iconCreateFunction={(cluster: any) =>
              createClusterIcon(cluster, mapMode === "dark")
            }
            maxClusterRadius={60}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            zoomToBoundsOnClick={true}
          >
            {assets.map((asset) => {
              if (!asset.current_latitude || !asset.current_longitude)
                return null;

              return (
                <Marker
                  key={asset.asset_id}
                  position={[asset.current_latitude, asset.current_longitude]}
                  icon={getMarkerIcon(asset.status, mapMode === "dark")}
                  eventHandlers={{
                    click: () => onAssetClick(asset),
                  }}
                />
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

        {/* --- LEGEND --- */}
        <div
          className={`absolute bottom-4 left-4 z-[50] backdrop-blur-sm rounded-lg shadow-lg p-3 border transition-colors duration-300 pointer-events-auto
        ${
          mapMode === "dark"
            ? "bg-gray-800/90 border-gray-700"
            : "bg-white/90 border-gray-200"
        }`}
        >
          <p
            className={`text-xs font-semibold mb-2 ${mapMode === "dark" ? "text-gray-300" : "text-gray-700"}`}
          >
            Status
          </p>
          <div className="space-y-1">
            {[
              { color: "bg-green-500", label: "Available" },
              { color: "bg-blue-500", label: "Assigned" },
              { color: "bg-yellow-500", label: "Maintenance" },
              { color: "bg-purple-500", label: "In Transit" },
              { color: "bg-red-500", label: "Decommissioned" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs">
                <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                <span
                  className={
                    mapMode === "dark" ? "text-gray-400" : "text-gray-600"
                  }
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          <div
            className={`mt-2 pt-2 border-t ${mapMode === "dark" ? "border-gray-700" : "border-gray-200"}`}
          >
            <div
              className={`flex items-center gap-2 text-xs ${mapMode === "dark" ? "text-gray-500" : "text-gray-500"}`}
            >
              <span>📍</span>
              <span>
                {
                  assets.filter(
                    (a) => a.current_latitude && a.current_longitude,
                  ).length
                }{" "}
                assets located
              </span>
            </div>
          </div>
        </div>

        {/* --- ZOOM HINT --- */}
        <div
          className={`absolute bottom-4 right-4 z-[50] backdrop-blur-sm rounded-lg shadow-lg p-2 text-xs transition-colors duration-300 pointer-events-none
        ${
          mapMode === "dark"
            ? "bg-gray-800/90 text-gray-400"
            : "bg-white/90 text-gray-500"
        }`}
        >
          🖱️ Scroll to zoom
        </div>

        {/* --- HEATMAP INDICATOR --- */}
        {showHeatmap && (
          <div
            className={`absolute top-4 right-4 z-[50] backdrop-blur-sm rounded-lg shadow-lg px-3 py-1.5 text-xs font-medium transition-colors duration-300 pointer-events-none
          ${
            mapMode === "dark"
              ? "bg-red-900/40 text-red-400 border border-red-800"
              : "bg-red-50 text-red-600 border border-red-200"
          }`}
          >
            🔥 Heatmap Active
          </div>
        )}
      </div>
    );
  },
);

AssetMap.displayName = "AssetMap";

export default AssetMap;
