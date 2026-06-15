"use client";

import { useEffect, useRef } from "react";

interface AssetMapProps {
  filter: "all" | "transit" | "idle" | "maintenance";
}

// Mock asset locations
const ASSETS = [
  { id: 1, name: "Truck-089", lat: 28.6139, lng: 77.209, status: "transit" },
  { id: 2, name: "Crane-14", lat: 28.6, lng: 77.23, status: "maintenance" },
  { id: 3, name: "Forklift-07", lat: 28.628, lng: 77.22, status: "idle" },
  { id: 4, name: "Excavator-15", lat: 28.59, lng: 77.19, status: "transit" },
  { id: 5, name: "Generator-05", lat: 28.61, lng: 77.25, status: "idle" },
  { id: 6, name: "Pump-001", lat: 28.605, lng: 77.2, status: "maintenance" },
];

const STATUS_COLORS = {
  transit: "#0ea5e9",
  idle: "#64748b",
  maintenance: "#f59e0b",
};

export default function AssetMap({ filter }: AssetMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const initializedRef = useRef(false);

  const updateMarkers = async () => {
    if (!mapInstanceRef.current) return;

    try {
      const L = await import("leaflet");
      const map = mapInstanceRef.current;

      // Clear existing markers
      markersRef.current.forEach((marker) => {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      });
      markersRef.current = [];

      const filteredAssets =
        filter === "all" ? ASSETS : ASSETS.filter((a) => a.status === filter);

      filteredAssets.forEach((asset) => {
        const markerColor =
          STATUS_COLORS[asset.status as keyof typeof STATUS_COLORS];

        // Create normal icon
        const normalIcon = L.divIcon({
          className: "custom-marker",
          html: `<div style="
            width: 24px;
            height: 24px;
            background: ${markerColor};
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: pointer;
          ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
            </svg>
          </div>`,
          iconSize: [24, 24],
          popupAnchor: [0, -12],
        });

        // Create hover icon (slightly larger but no transform to prevent movement)
        const hoverIcon = L.divIcon({
          className: "custom-marker-hover",
          html: `<div style="
            width: 28px;
            height: 28px;
            background: ${markerColor};
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            cursor: pointer;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
            </svg>
          </div>`,
          iconSize: [28, 28],
          popupAnchor: [0, -14],
        });

        const marker = L.marker([asset.lat, asset.lng], {
          icon: normalIcon,
        }).bindPopup(
          `
            <div style="font-family: system-ui; min-width: 140px;">
              <strong style="color: #1e293b;">${asset.name}</strong><br/>
              <span style="color: ${markerColor}; font-size: 12px; font-weight: 500;">
                ${asset.status.toUpperCase()}
              </span>
              <div style="font-size: 11px; color: #64748b; margin-top: 6px;">
                <span>📍 Lat: ${asset.lat.toFixed(4)}</span><br/>
                <span>📡 Last update: Just now</span>
              </div>
            </div>
          `,
          {
            autoPan: false,
            closeOnClick: true,
            closeButton: true,
          },
        );

        // Replace icon on hover instead of using CSS transform
        marker.on("mouseover", () => {
          marker.setIcon(hoverIcon);
        });

        marker.on("mouseout", () => {
          marker.setIcon(normalIcon);
        });

        // Open popup on click
        marker.on("click", () => {
          marker.openPopup();
        });

        marker.addTo(map);
        markersRef.current.push(marker);
      });
    } catch (error) {
      console.error("Error updating markers:", error);
    }
  };

  // Initialize map only once
  useEffect(() => {
    if (initializedRef.current || !mapRef.current) return;

    let isMounted = true;

    const initMap = async () => {
      try {
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        if (!isMounted || !mapRef.current) return;

        const map = L.map(mapRef.current!).setView([28.6139, 77.209], 12);

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB',
            subdomains: "abcd",
            maxZoom: 19,
          },
        ).addTo(map);

        mapInstanceRef.current = map;
        initializedRef.current = true;

        await updateMarkers();
      } catch (error) {
        console.error("Failed to initialize map:", error);
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []);

  // Update markers when filter changes
  useEffect(() => {
    if (initializedRef.current && mapInstanceRef.current) {
      updateMarkers();
    }
  }, [filter]);

  return (
    <div
      ref={mapRef}
      style={{
        height: 270,
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        background: "#e2e8f0",
      }}
    />
  );
}
