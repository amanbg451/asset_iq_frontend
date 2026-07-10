"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";
import api from "@/app/lib/api";
import html2canvas from "html2canvas";
import { motion, AnimatePresence } from "framer-motion";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

interface AssetLocation {
  asset_id: string;
  current_latitude: number;
  current_longitude: number;
  name: string | null;
  location_id: string | null;
  status?: string;
  department?: string;
  department_id?: string;
  last_scanned_at?: string;
  created_at?: string;
  serial_number?: string;
  model?: string;
  manufacturer?: string;
  description?: string;
  // Additional fields from API response
  id?: string;
  asset_condition?: string;
  tag_state?: string;
  is_active?: boolean;
  purchase_value?: number;
  qr_code_url?: string;
  created_image_url?: string;
  latest_image_url?: string;
  remarks?: string;
  category_id?: string;
  type_id?: string;
  parent_asset_id?: string | null;
  created_by?: string;
  last_scanned_by?: string;
  updated_at?: string;
  purchase_date?: string;
  metadata_json?: any;
  custom_fields?: any[];
  client_id?: string;
  assigned_to_user_id?: string;
}

interface Client {
  id: string;
  name: string;
  client_code: string;
  is_active: boolean;
}

interface Department {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

const AssetMap = dynamic(
  () => import("./AssetMap").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[400px] sm:h-[500px] lg:h-[600px] bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl">
        <div className="text-center">
          <div className="relative">
            <div className="w-12 h-12 lg:w-16 lg:h-16 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 lg:w-8 lg:h-8 bg-red-600/20 rounded-full animate-ping"></div>
            </div>
          </div>
          <p className="text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium">
            Loading map...
          </p>
        </div>
      </div>
    ),
  },
) as React.ComponentType<any>;

const getClientIdFromToken = () => {
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.client_id || null;
  } catch {
    return null;
  }
};

const getUserRoleFromToken = () => {
  const token = localStorage.getItem("access_token");
  if (!token) return "";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || "";
  } catch {
    return "";
  }
};

// Helper function to map API asset to AssetLocation
const mapApiAssetToAssetLocation = (apiAsset: any): AssetLocation => {
  return {
    asset_id: apiAsset.id || apiAsset.asset_id,
    current_latitude: apiAsset.current_latitude,
    current_longitude: apiAsset.current_longitude,
    name: apiAsset.name,
    location_id: apiAsset.location_id,
    status: apiAsset.asset_condition || apiAsset.status || "AVAILABLE",
    department: apiAsset.department_id,
    department_id: apiAsset.department_id,
    last_scanned_at: apiAsset.last_scanned_at,
    created_at: apiAsset.created_at,
    serial_number: apiAsset.serial_number,
    model: apiAsset.model,
    manufacturer: apiAsset.manufacturer,
    description: apiAsset.description,
    // Preserve all original data
    id: apiAsset.id,
    asset_condition: apiAsset.asset_condition,
    tag_state: apiAsset.tag_state,
    is_active: apiAsset.is_active,
    purchase_value: apiAsset.purchase_value,
    qr_code_url: apiAsset.qr_code_url,
    created_image_url: apiAsset.created_image_url,
    latest_image_url: apiAsset.latest_image_url,
    remarks: apiAsset.remarks,
    category_id: apiAsset.category_id,
    type_id: apiAsset.type_id,
    parent_asset_id: apiAsset.parent_asset_id,
    created_by: apiAsset.created_by,
    last_scanned_by: apiAsset.last_scanned_by,
    updated_at: apiAsset.updated_at,
    purchase_date: apiAsset.purchase_date,
    metadata_json: apiAsset.metadata_json,
    custom_fields: apiAsset.custom_fields,
    client_id: apiAsset.client_id,
    assigned_to_user_id: apiAsset.assigned_to_user_id,
  };
};

const AnimatedCounter = ({
  value,
  label,
  icon,
  color,
}: {
  value: number;
  label: string;
  icon: string;
  color: string;
}) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 },
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const duration = 1500;
    const step = 16;
    const totalSteps = duration / step;
    const increment = value / totalSteps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, step);

    return () => clearInterval(timer);
  }, [isVisible, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={isVisible ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-3 lg:p-4 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1 border border-gray-100/50 dark:border-gray-700/50"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent group-hover:from-red-50/20 group-hover:to-red-100/10 transition-all duration-700"></div>
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[10px] lg:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-lg lg:text-2xl font-bold text-gray-900 dark:text-white mt-1 tracking-tight">
            {count.toLocaleString()}
          </p>
        </div>
        <div
          className={`w-8 h-8 lg:w-10 lg:h-10 rounded-2xl bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center text-base lg:text-lg group-hover:scale-110 transition-transform duration-300`}
        >
          {icon}
        </div>
      </div>
      <div
        className={`absolute bottom-0 left-0 h-1 bg-${color}-500 transition-all duration-1000 group-hover:w-full w-0`}
      ></div>
    </motion.div>
  );
};

const QuickStats = ({ assets }: { assets: AssetLocation[] }) => {
  const stats = useMemo(() => {
    const total = assets.length;
    const withLocation = assets.filter(
      (a) => a.current_latitude && a.current_longitude,
    ).length;
    const statusCount = assets.reduce(
      (acc, a) => {
        const status = a.status || "UNKNOWN";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return { total, withLocation, statusCount };
  }, [assets]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      <AnimatedCounter
        value={stats.total}
        label="Total Assets"
        icon="📦"
        color="red"
      />
      <AnimatedCounter
        value={stats.withLocation}
        label="Located Assets"
        icon="📍"
        color="blue"
      />
      <AnimatedCounter
        value={stats.statusCount["AVAILABLE"] || 0}
        label="Available"
        icon="✅"
        color="green"
      />
      <AnimatedCounter
        value={stats.statusCount["ASSIGNED"] || 0}
        label="Assigned"
        icon="👤"
        color="purple"
      />
    </div>
  );
};

export default function MapsPage() {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const [assets, setAssets] = useState<AssetLocation[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<AssetLocation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });
  const [mapMode, setMapMode] = useState<"light" | "dark">("light");
  const [viewType, setViewType] = useState<"street" | "satellite">("street");
  const [selectedAsset, setSelectedAsset] = useState<AssetLocation | null>(
    null,
  );
  const [showPanel, setShowPanel] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      const response = await api.get("/clients");
      const activeClients = (response.data || []).filter(
        (c: Client) => c.is_active !== false,
      );
      setClients(activeClients);
      if (activeClients.length > 0 && !selectedClient) {
        setSelectedClient(activeClients[0].id);
      }
    } catch (error: any) {
      console.error("Error fetching clients:", error);
      if (error.response?.status === 403) {
        const clientId = getClientIdFromToken();
        if (clientId) setSelectedClient(clientId);
      }
    }
  }, [selectedClient]);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await api.get("/departments");
      const activeDepts = (response.data || []).filter(
        (d: Department) => d.is_active !== false,
      );
      setDepartments(activeDepts);
    } catch (error: any) {
      console.error("Error fetching departments:", error);
    }
  }, []);

  const fetchAssetLocations = useCallback(async () => {
    if (!selectedClient) {
      setAssets([]);
      setFilteredAssets([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get(`/map/asset?client_id=${selectedClient}`);
      const data = response.data;
      
      let assetsData = [];
      if (Array.isArray(data)) {
        assetsData = data;
      } else if (data.assets && Array.isArray(data.assets)) {
        assetsData = data.assets;
      } else {
        assetsData = [];
      }

      const enhancedAssets = assetsData.map(mapApiAssetToAssetLocation);
      
      setAssets(enhancedAssets);
      setLastRefreshed(new Date());
      applyFilters(enhancedAssets);
    } catch (error: any) {
      console.error("Error fetching asset locations:", error);
      toast.error(
        error.response?.data?.detail || "Failed to load asset locations",
      );
      setAssets([]);
      setFilteredAssets([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClient]);

  const applyFilters = useCallback(
    (assetsList: AssetLocation[]) => {
      let filtered = [...assetsList];
      
      if (selectedStatus) {
        filtered = filtered.filter((a) => a.status === selectedStatus);
      }
      
      if (selectedDepartment) {
        filtered = filtered.filter(
          (a) => a.department_id === selectedDepartment || a.department === selectedDepartment
        );
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (a) =>
            (a.name && a.name.toLowerCase().includes(query)) ||
            (a.asset_id && a.asset_id.toLowerCase().includes(query)) ||
            (a.serial_number && a.serial_number.toLowerCase().includes(query)) ||
            (a.model && a.model.toLowerCase().includes(query)) ||
            (a.manufacturer && a.manufacturer.toLowerCase().includes(query))
        );
      }
      
      if (dateRange.from) {
        filtered = filtered.filter((a) => {
          if (!a.last_scanned_at && !a.created_at) return false;
          const date = a.last_scanned_at || a.created_at;
          return new Date() >= new Date(dateRange.from);
        });
      }
      
      if (dateRange.to) {
        filtered = filtered.filter((a) => {
          if (!a.last_scanned_at && !a.created_at) return false;
          const date = a.last_scanned_at || a.created_at;
          return new Date() <= new Date(dateRange.to);
        });
      }
      
      setFilteredAssets(filtered);
    },
    [selectedStatus, selectedDepartment, searchQuery, dateRange],
  );

  // Mounting and Initial Data Fetch
  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    const role = getUserRoleFromToken();
    setIsAdmin(role === "ADMIN");
    if (role === "ADMIN") {
      fetchClients();
    } else {
      const clientId = getClientIdFromToken();
      if (clientId) setSelectedClient(clientId);
    }
    fetchDepartments();
  }, [router, fetchClients, fetchDepartments]);

  useEffect(() => {
    if (selectedClient) fetchAssetLocations();
  }, [selectedClient, fetchAssetLocations]);

  useEffect(() => {
    applyFilters(assets);
  }, [
    assets,
    selectedStatus,
    selectedDepartment,
    searchQuery,
    dateRange,
    applyFilters,
  ]);

  useEffect(() => {
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => {
        fetchAssetLocations();
        toast.success(
          `🔄 Auto-refreshed at ${new Date().toLocaleTimeString()}`,
          {
            duration: 2000,
            icon: "🔄",
          },
        );
      }, refreshInterval * 1000);
    } else {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    }
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, fetchAssetLocations]);

  const handleAssetClick = useCallback((asset: AssetLocation) => {
    setSelectedAsset(asset);
    setShowPanel(true);
    setImageError(false);
  }, []);

  const handleClosePanel = useCallback(() => {
    setShowPanel(false);
    setSelectedAsset(null);
    setImageError(false);
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedStatus("");
    setSelectedDepartment("");
    setSearchQuery("");
    setDateRange({ from: "", to: "" });
    applyFilters(assets);
  }, [assets, applyFilters]);

  const toggleMapMode = useCallback(() => {
    setMapMode((prev) => (prev === "light" ? "dark" : "light"));
    toast.success(
      mapMode === "light" ? "🌙 Dark mode enabled" : "☀️ Light mode enabled",
      { duration: 1500 },
    );
  }, [mapMode]);

  const toggleViewType = useCallback(() => {
    setViewType((prev) => (prev === "street" ? "satellite" : "street"));
    toast.success(
      viewType === "street"
        ? "🛰️ Satellite view enabled"
        : "🗺️ Street view enabled",
      { duration: 1500 },
    );
  }, [viewType]);

  const toggleHeatmap = useCallback(() => {
    setShowHeatmap((prev) => !prev);
    toast.success(showHeatmap ? "Heatmap hidden" : "🔥 Heatmap shown", {
      duration: 1500,
    });
  }, [showHeatmap]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleFullscreenChange = useCallback((isFull: boolean) => {
    setIsFullscreen(isFull);
  }, []);

  const exportMap = useCallback(async () => {
    if (!mapContainerRef.current) {
      toast.error("Map not ready");
      return;
    }
    try {
      setIsExporting(true);
      toast.loading("Generating map image...", { id: "export-map" });
      const canvas = await html2canvas(mapContainerRef.current, {
        backgroundColor: mapMode === "dark" ? "#1a1a2e" : "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
      });
      const link = document.createElement("a");
      link.download = `asset-map-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Map exported successfully!", { id: "export-map" });
    } catch (error) {
      console.error("Error exporting map:", error);
      toast.error("Failed to export map", { id: "export-map" });
    } finally {
      setIsExporting(false);
    }
  }, [mapMode]);

  const printMap = useCallback(() => {
    if (!mapContainerRef.current) {
      toast.error("Map not ready");
      return;
    }
    try {
      const printWindow = window.open("", "_blank", "width=1200,height=800");
      if (!printWindow) {
        toast.error("Please allow popups to print");
        return;
      }
      const mapElement = mapContainerRef.current;
      const mapHtml = mapElement.outerHTML;
      printWindow.document.write(`
        <html>
          <head>
            <title>Asset Map</title>
            <style>
              body { margin: 0; padding: 20px; background: white; }
              .map-container { width: 100%; height: 100%; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            <h1 style="text-align:center; margin-bottom:20px;">Asset Location Map</h1>
            <div style="width:100%; height:80vh;">${mapHtml}</div>
            <p style="text-align:center; margin-top:20px; color:#666; font-size:12px;">
              Generated on ${new Date().toLocaleString()}
            </p>
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 1000);
    } catch (error) {
      console.error("Error printing map:", error);
      toast.error("Failed to print map");
    }
  }, []);

  const getLastRefreshedText = useMemo(() => {
    if (!lastRefreshed) return "Never";
    const diff = Math.floor(
      (new Date().getTime() - lastRefreshed.getTime()) / 1000,
    );
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }, [lastRefreshed]);

  // Get image URL helper
  const getImageUrl = (asset: AssetLocation) => {
    return asset.latest_image_url || asset.created_image_url || null;
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="relative">
          <div className="w-12 h-12 lg:w-16 lg:h-16 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 lg:w-8 lg:h-8 bg-red-600/20 rounded-full animate-ping"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen"
    >
      {/* ─── GLASS HEADER ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-700/50 shadow-lg shadow-gray-200/20 dark:shadow-gray-800/20"
      >
        <div className="px-3 sm:px-4 lg:px-6 py-2 lg:py-3">
          {/* ─── Top Bar ────────────────────────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 lg:gap-3">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex items-center gap-2 lg:gap-3"
            >
              <div className="relative">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30">
                  <span className="text-sm lg:text-lg">🗺️</span>
                </div>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 lg:w-3 lg:h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-base lg:text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Asset Location Map
                </h1>
                <div className="flex items-center gap-2 text-[10px] lg:text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium">
                    {filteredAssets.length} assets displayed
                  </span>
                  {lastRefreshed && (
                    <span className="opacity-60">
                      • Updated {getLastRefreshedText}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* ─── Action Buttons ───────────────────────────────────────────── */}
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap items-center gap-1.5 lg:gap-2"
            >
              {[
                {
                  id: "dark",
                  icon: mapMode === "light" ? "🌙" : "☀️",
                  onClick: toggleMapMode,
                  active: mapMode === "dark",
                  tooltip: "Toggle Dark/Light",
                },
                {
                  id: "view",
                  icon: viewType === "street" ? "🗺️" : "🛰️",
                  onClick: toggleViewType,
                  active: viewType === "satellite",
                  tooltip: "Toggle Street/Satellite",
                },
                {
                  id: "heatmap",
                  icon: "🔥",
                  onClick: toggleHeatmap,
                  active: showHeatmap,
                  tooltip: "Toggle Heatmap",
                },
              ].map((btn) => (
                <motion.button
                  key={btn.id}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onHoverStart={() => setHoveredButton(btn.id)}
                  onHoverEnd={() => setHoveredButton(null)}
                  onClick={btn.onClick}
                  className={`relative p-1.5 lg:p-2 rounded-xl transition-all duration-300 ${
                    btn.active
                      ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30"
                      : "bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200/50 dark:border-gray-700/50"
                  }`}
                >
                  <span className="text-sm lg:text-base">{btn.icon}</span>
                  {hoveredButton === btn.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap z-50"
                    >
                      {btn.tooltip}
                    </motion.div>
                  )}
                </motion.button>
              ))}

              {/* ─── Auto-refresh Controls ────────────────────────────────── */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-1.5 lg:p-2 rounded-xl transition-all duration-300 ${
                  autoRefresh
                    ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30"
                    : "bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200/50 dark:border-gray-700/50"
                }`}
              >
                {autoRefresh ? "⏸" : "▶"}
              </motion.button>

              {autoRefresh && (
                <motion.select
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="px-2 py-1.5 lg:py-2 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-red-500/50 backdrop-blur-sm"
                >
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={60}>1m</option>
                  <option value={120}>2m</option>
                  <option value={300}>5m</option>
                </motion.select>
              )}

              {/* ─── Manual Refresh ────────────────────────────────────────── */}
              <motion.button
                whileHover={{ scale: 1.05, rotate: 180 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  fetchAssetLocations();
                  toast.success(
                    `🔄 Refreshed at ${new Date().toLocaleTimeString()}`,
                    { duration: 1500, icon: "🔄" },
                  );
                }}
                disabled={loading}
                className="p-1.5 lg:p-2 rounded-xl bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 disabled:opacity-50"
              >
                {loading ? "⏳" : "🔄"}
              </motion.button>

              {/* ─── Export ────────────────────────────────────────────────── */}
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={exportMap}
                disabled={isExporting}
                className="px-2.5 lg:px-3 py-1.5 lg:py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-lg hover:shadow-red-500/30 transition-all duration-300 font-semibold text-[10px] lg:text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <span className="animate-spin">⏳</span> Exporting...
                  </>
                ) : (
                  <>
                    <span>📸</span> Export
                  </>
                )}
              </motion.button>

              {/* ─── Print ──────────────────────────────────────────────────── */}
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={printMap}
                className="px-2.5 lg:px-3 py-1.5 lg:py-2 bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200/50 dark:border-gray-700/50 rounded-xl transition-all duration-300 text-[10px] lg:text-xs font-medium flex items-center gap-1.5"
              >
                <span>🖨️</span> Print
              </motion.button>

              {/* ─── Reset Filters ──────────────────────────────────────────── */}
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={resetFilters}
                className="px-2.5 lg:px-3 py-1.5 lg:py-2 bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200/50 dark:border-gray-700/50 rounded-xl transition-all duration-300 text-[10px] lg:text-xs font-medium"
              >
                Reset Filters
              </motion.button>
            </motion.div>
          </div>

          {/* ─── Filters Bar ────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="mt-2 lg:mt-3 flex flex-wrap items-center gap-1.5 lg:gap-2"
          >
            {isAdmin && (
              <motion.select
                whileHover={{ scale: 1.02 }}
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-red-500/50 backdrop-blur-sm transition-all duration-300 max-w-[120px] lg:max-w-full"
              >
                <option value="">Select Client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </motion.select>
            )}

            <motion.select
              whileHover={{ scale: 1.02 }}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-red-500/50 backdrop-blur-sm transition-all duration-300 max-w-[100px] lg:max-w-full"
            >
              <option value="">All Status</option>
              <option value="AVAILABLE">Available</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="TRANSIT">Transit</option>
              <option value="DECOMMISSIONED">Decommissioned</option>
              <option value="ACTIVE">Active</option>
              <option value="Good">Good</option>
            </motion.select>

            <motion.select
              whileHover={{ scale: 1.02 }}
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-red-500/50 backdrop-blur-sm transition-all duration-300 max-w-[100px] lg:max-w-full"
            >
              <option value="">All Depts</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </motion.select>

            <div className="relative flex-1 min-w-[120px] lg:min-w-[180px]">
              <motion.input
                whileFocus={{ scale: 1.02 }}
                type="text"
                placeholder="🔍 Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2.5 lg:px-3 py-1.5 lg:py-2 pl-7 lg:pl-9 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-red-500/50 backdrop-blur-sm transition-all duration-300"
              />
              <span className="absolute left-2 lg:left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] lg:text-xs">
                🔍
              </span>
            </div>

            <div className="flex items-center gap-1.5 lg:gap-2">
              <motion.input
                whileFocus={{ scale: 1.02 }}
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange({ ...dateRange, from: e.target.value })
                }
                className="px-2 lg:px-3 py-1.5 lg:py-2 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white text-[10px] lg:text-xs focus:outline-none focus:ring-2 focus:ring-red-500/50 backdrop-blur-sm transition-all duration-300 w-[100px] lg:w-auto"
                placeholder="From"
              />
              <span className="text-gray-500 dark:text-gray-400 font-medium text-[10px] lg:text-xs">
                to
              </span>
              <motion.input
                whileFocus={{ scale: 1.02 }}
                type="date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange({ ...dateRange, to: e.target.value })
                }
                className="px-2 lg:px-3 py-1.5 lg:py-2 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white text-[10px] lg:text-xs focus:outline-none focus:ring-2 focus:ring-red-500/50 backdrop-blur-sm transition-all duration-300 w-[100px] lg:w-auto"
                placeholder="To"
              />
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* ─── QUICK STATS ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="px-3 sm:px-4 lg:px-6 pt-3 lg:pt-4"
      >
        <QuickStats assets={filteredAssets} />
      </motion.div>

      {/* ─── MAP ────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="p-3 sm:p-4"
      >
        <div
          ref={mapContainerRef}
          className="relative rounded-2xl overflow-hidden shadow-2xl shadow-gray-200/50 dark:shadow-gray-900/50"
        >
          <div className="bg-white dark:bg-gray-800">
            {loading ? (
              <div className="flex items-center justify-center h-[400px] sm:h-[500px] lg:h-[600px] bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                <div className="text-center">
                  <div className="relative">
                    <div className="w-12 h-12 lg:w-16 lg:h-16 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 lg:w-8 lg:h-8 bg-red-600/20 rounded-full animate-ping"></div>
                    </div>
                  </div>
                  <p className="text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium">
                    Loading map data...
                  </p>
                </div>
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="flex items-center justify-center h-[400px] sm:h-[500px] lg:h-[600px] bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                <div className="text-center max-w-md px-4">
                  <div className="text-6xl mb-4">📍</div>
                  <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                    No Assets Found
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {assets.length > 0 
                      ? "Try adjusting your filters to see more assets"
                      : "No assets available for the selected client"
                    }
                  </p>
                  {assets.length > 0 && (
                    <button
                      onClick={resetFilters}
                      className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <AssetMap
                ref={mapRef}
                assets={filteredAssets}
                onAssetClick={handleAssetClick}
                mapMode={mapMode}
                viewType={viewType}
                selectedAssetId={selectedAsset?.asset_id}
                showHeatmap={showHeatmap}
                fullscreen={isFullscreen}
                onFullscreenChange={handleFullscreenChange}
              />
            )}
          </div>
        </div>
      </motion.div>

      {/* ─── ASSET DETAILS PANEL ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPanel && selectedAsset && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: "spring", damping: 25 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[400px] lg:w-[480px] z-[1000] bg-white dark:bg-gray-900 shadow-2xl shadow-black/20"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  {selectedAsset.name || "Asset Details"}
                </h3>
                <button
                  onClick={handleClosePanel}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Asset Image */}
                {getImageUrl(selectedAsset) && (
                  <div className="relative w-full h-56 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img
                      src={getImageUrl(selectedAsset)!}
                      alt={selectedAsset.name || "Asset Image"}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        // Show fallback
                        const parent = target.parentElement;
                        if (parent) {
                          const fallback = document.createElement('div');
                          fallback.className = 'w-full h-full flex items-center justify-center text-6xl';
                          fallback.textContent = '📦';
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                  </div>
                )}

                {/* Status Badge */}
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                    ${selectedAsset.status === "AVAILABLE" || selectedAsset.status === "ACTIVE" || selectedAsset.status === "Good" ? "bg-green-500/20 text-green-600 dark:text-green-400" : ""}
                    ${selectedAsset.status === "ASSIGNED" ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" : ""}
                    ${selectedAsset.status === "MAINTENANCE" ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" : ""}
                    ${selectedAsset.status === "TRANSIT" ? "bg-purple-500/20 text-purple-600 dark:text-purple-400" : ""}
                    ${selectedAsset.status === "DECOMMISSIONED" ? "bg-red-500/20 text-red-600 dark:text-red-400" : ""}
                  `}>
                    {selectedAsset.status || "UNKNOWN"}
                  </span>
                  {selectedAsset.tag_state && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedAsset.tag_state}
                    </span>
                  )}
                </div>

                {/* ID */}
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                  <p className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                    Asset ID
                  </p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white mt-1 break-all">
                    {selectedAsset.asset_id}
                  </p>
                </div>

                {/* Location */}
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                  <p className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                    📍 Location
                  </p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">
                    {selectedAsset.current_latitude?.toFixed(6)}, {selectedAsset.current_longitude?.toFixed(6)}
                  </p>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {selectedAsset.serial_number && (
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                        Serial Number
                      </p>
                      <p className="text-sm font-mono text-gray-900 dark:text-white mt-1 truncate">
                        {selectedAsset.serial_number}
                      </p>
                    </div>
                  )}
                  {selectedAsset.model && (
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                        Model
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mt-1 truncate">
                        {selectedAsset.model}
                      </p>
                    </div>
                  )}
                  {selectedAsset.manufacturer && (
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                        Manufacturer
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mt-1 truncate">
                        {selectedAsset.manufacturer}
                      </p>
                    </div>
                  )}
                  {selectedAsset.purchase_value !== undefined && (
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                        Purchase Value
                      </p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                        ${selectedAsset.purchase_value.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Description */}
                {selectedAsset.description && (
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <p className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                      Description
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {selectedAsset.description}
                    </p>
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  {selectedAsset.created_at && (
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                        Created
                      </p>
                      <p className="text-xs text-gray-900 dark:text-white mt-1">
                        {new Date(selectedAsset.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {selectedAsset.last_scanned_at && (
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                        Last Scanned
                      </p>
                      <p className="text-xs text-gray-900 dark:text-white mt-1">
                        {new Date(selectedAsset.last_scanned_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* QR Code */}
                {selectedAsset.qr_code_url && (
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <p className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 mb-2">
                      QR Code
                    </p>
                    <img 
                      src={selectedAsset.qr_code_url} 
                      alt="QR Code"
                      className="w-24 h-24 object-contain mx-auto"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                <button
                  onClick={() => {
                    router.push(`/assets/${selectedAsset.asset_id}`);
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  View Full Details →
                </button>
                <button
                  onClick={() => {
                    if (mapRef.current?.getMap) {
                      const map = mapRef.current.getMap();
                      if (map) {
                        map.flyTo([selectedAsset.current_latitude, selectedAsset.current_longitude], 15, {
                          duration: 1.5,
                        });
                      }
                    }
                    handleClosePanel();
                  }}
                  className="w-full py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                >
                  📍 Center on Map
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}