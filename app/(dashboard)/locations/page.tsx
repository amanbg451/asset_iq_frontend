"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { z } from "zod";
import api from "@/app/lib/api";

interface LocationPath {
  id?: string;
  name: string;
  location_type: "COUNTRY" | "STATE" | "CITY" | "OFFICE";
}

interface Location {
  id: string;
  name: string;
  location_type: "COUNTRY" | "STATE" | "CITY" | "OFFICE";
  full_path?: string;
  path?: LocationPath[];
}

interface LocationHierarchy {
  leaf_id: string;
  leaf_name: string;
  full_path: string;
  path: LocationPath[];
}

type ViewMode = "table" | "grid";
type ModalType = "create" | "view" | "migrate" | "close" | null;

const locationPathSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  location_type: z.enum(["COUNTRY", "STATE", "CITY", "OFFICE"]),
});

const createLocationSchema = z.object({
  path: z.array(locationPathSchema).min(1, "At least one location is required"),
});

const migrateLocationSchema = z.object({
  source_location_id: z.string().min(1, "Source location is required"),
  path: z.array(locationPathSchema).min(1, "Destination path is required"),
});

export default function LocationsPage() {
  const router = useRouter();

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [mounted, setMounted] = useState(false);

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedLocation, setSelectedLocation] = useState<
    Location | LocationHierarchy | null
  >(null);
  const [submitting, setSubmitting] = useState(false);

  const [createPath, setCreatePath] = useState<LocationPath[]>([
    { name: "", location_type: "COUNTRY" },
  ]);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createPreview, setCreatePreview] = useState("");

  const [migrateSource, setMigrateSource] = useState("");
  const [migratePath, setMigratePath] = useState<LocationPath[]>([
    { name: "", location_type: "COUNTRY" },
  ]);
  const [migrateConfirmed, setMigrateConfirmed] = useState(false);
  const [migrateErrors, setMigrateErrors] = useState<Record<string, string>>(
    {},
  );

  const [closeConfirmed, setCloseConfirmed] = useState(false);

  const locationTypes = ["COUNTRY", "STATE", "CITY", "OFFICE"] as const;

  const getLocationTypeIcon = (type: string) => {
    switch (type) {
      case "COUNTRY":
        return "🌍";
      case "STATE":
        return "🏛️";
      case "CITY":
        return "🏙️";
      case "OFFICE":
        return "🏢";
      default:
        return "📍";
    }
  };

  const getLocationTypeColor = (type: string) => {
    switch (type) {
      case "COUNTRY":
        return "bg-red-100 text-red-700";
      case "STATE":
        return "bg-purple-100 text-purple-700";
      case "CITY":
        return "bg-green-100 text-green-700";
      case "OFFICE":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getDisplayName = (
    location: Location | LocationHierarchy | null,
  ): string => {
    if (!location) return "";
    if ("leaf_name" in location) return location.leaf_name;
    return location.name;
  };

  const getPath = (
    location: Location | LocationHierarchy | null,
  ): LocationPath[] => {
    if (!location) return [];
    if ("path" in location) return location.path || [];
    return location.path || [];
  };

  const getFullPath = (
    location: Location | LocationHierarchy | null,
  ): string => {
    if (!location) return "";
    if ("full_path" in location) return location.full_path || "";
    return location.full_path || "";
  };

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/location/cards");
      setLocations(response.data || []);
    } catch (error: any) {
      console.error("Error fetching locations:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch locations");
    } finally {
      setLoading(false);
    }
  }, []);

  const createLocation = async (data: { path: LocationPath[] }) => {
    try {
      setSubmitting(true);
      const response = await api.post("/location/path", data);
      const result: LocationHierarchy = response.data;
      toast.success(`✅ Location "${result.leaf_name}" created successfully!`);
      setActiveModal(null);
      resetCreateForm();
      await fetchLocations();
    } catch (error: any) {
      console.error("Error creating location:", error);
      toast.error(error.response?.data?.detail || "Failed to create location");
    } finally {
      setSubmitting(false);
    }
  };

  const fetchLocationPath = async (locationId: string) => {
    try {
      const response = await api.get(`/location/${locationId}/leaf-path`);
      const data: LocationHierarchy = response.data;
      setSelectedLocation(data);
      setActiveModal("view");
    } catch (error: any) {
      console.error("Error fetching location path:", error);
      toast.error(
        error.response?.data?.detail || "Failed to fetch location path",
      );
    }
  };

  const migrateLocation = async (data: {
    source_location_id: string;
    path: LocationPath[];
  }) => {
    try {
      setSubmitting(true);
      const response = await api.post("/location/migrate", data);
      toast.success("✅ Migration completed successfully!");
      setActiveModal(null);
      resetMigrateForm();
      await fetchLocations();
    } catch (error: any) {
      console.error("Error migrating location:", error);
      toast.error(error.response?.data?.detail || "Failed to migrate location");
    } finally {
      setSubmitting(false);
    }
  };

  const closeLocation = async (locationId: string) => {
    try {
      setSubmitting(true);
      const response = await api.post(`/location/${locationId}/close`);
      toast.success("✅ Location closed successfully!");
      setActiveModal(null);
      setCloseConfirmed(false);
      await fetchLocations();
    } catch (error: any) {
      console.error("Error closing location:", error);
      toast.error(error.response?.data?.detail || "Failed to close location");
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setCreatePath([{ name: "", location_type: "COUNTRY" }]);
    setCreateErrors({});
    setCreatePreview("");
  };

  const addCreateLevel = () => {
    const lastType = createPath[createPath.length - 1].location_type;
    const typeIndex = locationTypes.indexOf(lastType);
    if (typeIndex < locationTypes.length - 1) {
      setCreatePath([
        ...createPath,
        { name: "", location_type: locationTypes[typeIndex + 1] },
      ]);
    } else {
      toast.error("Cannot add more levels. Maximum depth reached.");
    }
  };

  const removeCreateLevel = (index: number) => {
    if (createPath.length > 1) {
      setCreatePath(createPath.filter((_, i) => i !== index));
    }
  };

  const updateCreateLevel = (
    index: number,
    field: keyof LocationPath,
    value: string,
  ) => {
    const newPath = [...createPath];
    newPath[index] = { ...newPath[index], [field]: value };
    setCreatePath(newPath);
    if (createErrors[`path[${index}].name`]) {
      const newErrors = { ...createErrors };
      delete newErrors[`path[${index}].name`];
      setCreateErrors(newErrors);
    }
  };

  const handleCreatePreview = () => {
    const names = createPath
      .filter((item) => item.name.trim())
      .map((item) => item.name.toUpperCase());
    if (names.length === 0) {
      toast.error("Please fill in at least one location name");
      return;
    }
    setCreatePreview(names.join(" > "));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validPath = createPath.filter((item) => item.name.trim());
    if (validPath.length === 0) {
      toast.error("Please fill in at least one location name");
      return;
    }

    const result = createLocationSchema.safeParse({ path: validPath });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });
      setCreateErrors(errors);
      toast.error(result.error.issues[0].message);
      return;
    }

    await createLocation(result.data);
  };

  const resetMigrateForm = () => {
    setMigrateSource("");
    setMigratePath([{ name: "", location_type: "COUNTRY" }]);
    setMigrateConfirmed(false);
    setMigrateErrors({});
  };

  const addMigrateLevel = () => {
    const lastType = migratePath[migratePath.length - 1].location_type;
    const typeIndex = locationTypes.indexOf(lastType);
    if (typeIndex < locationTypes.length - 1) {
      setMigratePath([
        ...migratePath,
        { name: "", location_type: locationTypes[typeIndex + 1] },
      ]);
    } else {
      toast.error("Cannot add more levels. Maximum depth reached.");
    }
  };

  const removeMigrateLevel = (index: number) => {
    if (migratePath.length > 1) {
      setMigratePath(migratePath.filter((_, i) => i !== index));
    }
  };

  const updateMigrateLevel = (
    index: number,
    field: keyof LocationPath,
    value: string,
  ) => {
    const newPath = [...migratePath];
    newPath[index] = { ...newPath[index], [field]: value };
    setMigratePath(newPath);
    if (migrateErrors[`path[${index}].name`]) {
      const newErrors = { ...migrateErrors };
      delete newErrors[`path[${index}].name`];
      setMigrateErrors(newErrors);
    }
  };

  const handleMigrateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!migrateSource) {
      toast.error("Please select a source location");
      return;
    }

    const validPath = migratePath.filter((item) => item.name.trim());
    if (validPath.length === 0) {
      toast.error("Please fill in destination path");
      return;
    }

    const result = migrateLocationSchema.safeParse({
      source_location_id: migrateSource,
      path: validPath,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });
      setMigrateErrors(errors);
      toast.error(result.error.issues[0].message);
      return;
    }

    if (!migrateConfirmed) {
      toast.error("Please confirm the migration warning");
      return;
    }

    await migrateLocation(result.data);
  };

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchLocations();
  }, [router, fetchLocations]);

  const filteredLocations = locations.filter(
    (location) =>
      location.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.full_path?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards; }
        .fade-in-scale { animation: fadeInScale 0.3s ease forwards; }
        
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeInUp 0.25s ease;
          padding: 16px;
        }
        .modal-content {
          background: white;
          border-radius: 28px;
          width: 95%;
          max-width: 820px;
          max-height: 90vh;
          overflow-y: auto;
          animation: fadeInScale 0.35s cubic-bezier(0.2, 0.9, 0.4, 1.2);
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.5);
          padding: 20px;
        }
        @media (min-width: 640px) {
          .modal-content { padding: 28px 32px; border-radius: 32px; }
        }
        @media (max-width: 640px) {
          .modal-content { border-radius: 20px; padding: 16px; }
        }
        
        .modal-content::-webkit-scrollbar { width: 6px; }
        .modal-content::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 20px; }
        .modal-content::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #dc2626, #b91c1c); border-radius: 20px; }
        
        .stat-card {
          background: white;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
          transition: all 0.3s ease;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px -8px rgba(0,0,0,0.1);
        }
        
        .location-card {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .location-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px -12px rgba(220,38,38,0.15);
        }
        
        .input-fancy {
          transition: all 0.2s ease;
          background: #fafbfc;
        }
        .input-fancy:focus {
          background: white;
          transform: scale(1.01);
        }
        
        .view-toggle-btn {
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          border: 1px solid #e2e8f0;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #64748b;
        }
        .view-toggle-btn:hover { border-color: #dc2626; color: #dc2626; }
        .view-toggle-btn.active {
          background: #dc2626;
          color: white;
          border-color: #dc2626;
          box-shadow: 0 2px 8px rgba(220,38,38,0.25);
        }
        
        .location-table {
          width: 100%;
          min-width: 700px;
          border-collapse: collapse;
          font-size: 14px;
        }
        .location-table thead th {
          text-align: left;
          padding: 12px 16px;
          font-weight: 600;
          font-size: 13px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid #f1f5f9;
          background: #fafbfc;
        }
        .location-table tbody td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #1f2937;
        }
        .location-table tbody tr {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .location-table tbody tr:hover {
          background: #fef2f2;
        }
        
        .table-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        
        .path-tree {
          font-family: monospace;
          line-height: 1.8;
        }
        .path-tree .node {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
        }
        .path-tree .node .indent {
          display: inline-block;
          width: 24px;
        }
        .path-tree .node .connector {
          color: #9ca3af;
        }
        
        .warning-box {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 12px;
          padding: 16px;
        }
        .warning-box ul {
          list-style: disc;
          padding-left: 20px;
          margin: 8px 0;
        }
        .warning-box ul li {
          color: #991b1b;
          font-size: 14px;
        }
        
        /* ─── RED THEME INPUT STYLES ─── */
        .input-red {
          border: 1px solid #e5e7eb;
          transition: all 0.2s ease;
          background: #ffffff;
          color: #1f2937;
        }
        .input-red:focus {
          border-color: #dc2626;
          ring: 2px solid rgba(220,38,38,0.2);
          outline: none;
          box-shadow: 0 0 0 3px rgba(220,38,38,0.1);
        }
        .input-red::placeholder {
          color: #9ca3af;
          font-weight: 400;
        }
        .input-red:focus::placeholder {
          color: #6b7280;
        }
        
        .select-red {
          border: 1px solid #e5e7eb;
          transition: all 0.2s ease;
          background: #ffffff;
          color: #1f2937;
        }
        .select-red:focus {
          border-color: #dc2626;
          outline: none;
          box-shadow: 0 0 0 3px rgba(220,38,38,0.1);
        }
        
        .btn-red-primary {
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          color: white;
          transition: all 0.3s ease;
        }
        .btn-red-primary:hover {
          background: linear-gradient(135deg, #b91c1c, #991b1b);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(220,38,38,0.3);
        }
        
        .btn-red-secondary {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
          transition: all 0.3s ease;
        }
        .btn-red-secondary:hover {
          background: #fee2e2;
          border-color: #fca5a5;
        }
        
        .bg-red-gradient {
          background: linear-gradient(135deg, #dc2626, #b91c1c);
        }
        
        .text-red-theme {
          color: #dc2626;
        }
        
        .ring-red-theme:focus {
          ring: 2px solid rgba(220,38,38,0.3);
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="relative p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {/* ─── HEADER ─── */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3 fade-in-up">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md shadow-red-500/20">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.8"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">
                  Locations
                </h1>
              </div>
              <p className="text-gray-500 ml-[52px] sm:ml-[56px] text-xs sm:text-sm">
                Manage location hierarchies and offices
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex bg-white/80 backdrop-blur-sm rounded-xl border border-gray-100 p-1 shadow-sm">
                {(["table", "grid"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={`view-toggle-btn text-xs sm:text-sm ${viewMode === mode ? "active" : ""}`}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode === "table" ? "📋 Table" : "📊 Grid"}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setActiveModal("create")}
                className="cursor-pointer flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-md shadow-red-500/25 hover:shadow-lg hover:shadow-red-500/35 transition-all duration-300 transform hover:-translate-y-0.5"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="hidden xs:inline">Add Location</span>
                <span className="xs:hidden">Add</span>
              </button>
            </div>
          </div>

          {/* ─── STATS ─── */}
          {!loading && locations.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6 fade-in-up">
              <div className="stat-card p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center">
                  <span className="text-xl sm:text-2xl">📍</span>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">
                    {locations.length}
                  </p>
                  <p className="text-[9px] sm:text-xs lg:text-sm font-medium text-gray-500">
                    Total Locations
                  </p>
                </div>
              </div>
              <div className="stat-card p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center">
                  <span className="text-xl sm:text-2xl">🏢</span>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">
                    {
                      locations.filter((l) => l.location_type === "OFFICE")
                        .length
                    }
                  </p>
                  <p className="text-[9px] sm:text-xs lg:text-sm font-medium text-gray-500">
                    Offices
                  </p>
                </div>
              </div>
              <div className="stat-card p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center">
                  <span className="text-xl sm:text-2xl">🌍</span>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">
                    {
                      locations.filter((l) => l.location_type === "COUNTRY")
                        .length
                    }
                  </p>
                  <p className="text-[9px] sm:text-xs lg:text-sm font-medium text-gray-500">
                    Countries
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── SEARCH ─── */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6 fade-in-up">
            <div className="relative w-full sm:w-72 lg:w-96">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search locations by name or path..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 sm:pl-11 py-2.5 sm:py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all shadow-sm text-gray-800 placeholder-gray-500 text-sm"
              />
            </div>

            <button
              onClick={fetchLocations}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition text-sm font-medium text-gray-700"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10" />
                <path d="M20.49 15a9 9 0 01-14.85 3.36L1 14" />
              </svg>
              Refresh
            </button>
          </div>

          {/* ─── LOADING ─── */}
          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* ─── CONTENT ─── */}
          {!loading && (
            <>
              {viewMode === "grid" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredLocations.map((location, idx) => (
                    <div
                      key={location.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm location-card fade-in-up"
                      style={{ animationDelay: `${idx * 70}ms` }}
                      onClick={() => fetchLocationPath(location.id)}
                    >
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">
                              {getLocationTypeIcon(location.location_type)}
                            </span>
                            <div>
                              <h3 className="font-bold text-gray-900 text-base sm:text-lg">
                                {location.name}
                              </h3>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getLocationTypeColor(location.location_type)}`}
                              >
                                {location.location_type}
                              </span>
                            </div>
                          </div>
                        </div>
                        {location.full_path && (
                          <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg truncate">
                            📍 {location.full_path}
                          </div>
                        )}
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              fetchLocationPath(location.id);
                            }}
                            className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm transition-all"
                          >
                            🌳 View Path
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLocation(location);
                              setActiveModal("close");
                            }}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm transition-all"
                          >
                            ⚠️ Close
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewMode === "table" && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in-up">
                  <div className="table-scroll">
                    <table className="location-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Full Path</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLocations.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="text-center py-8 sm:py-12 text-gray-500 text-sm"
                            >
                              No locations found
                            </td>
                          </tr>
                        ) : (
                          filteredLocations.map((location) => (
                            <tr
                              key={location.id}
                              onClick={() =>
                                router.push(`/locations/${location.id}`)
                              }
                              className="cursor-pointer hover:bg-red-50 transition-colors"
                            >
                              <td className="font-semibold text-gray-900">
                                <span className="mr-2">
                                  {getLocationTypeIcon(location.location_type)}
                                </span>
                                {location.name}
                              </td>
                              <td>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getLocationTypeColor(location.location_type)}`}
                                >
                                  {location.location_type}
                                </span>
                              </td>
                              <td className="text-gray-600 text-sm">
                                {location.full_path || "—"}
                              </td>
                              <td>
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      fetchLocationPath(location.id);
                                    }}
                                    className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs transition-all"
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedLocation(location);
                                      setActiveModal("migrate");
                                      setMigrateSource(location.id);
                                    }}
                                    className="px-3 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-xs transition-all"
                                  >
                                    Migrate
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedLocation(location);
                                      setActiveModal("close");
                                    }}
                                    className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs transition-all"
                                  >
                                    Close
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── EMPTY STATE ─── */}
          {!loading && filteredLocations.length === 0 && (
            <div className="text-center py-12 sm:py-20 fade-in-up">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl sm:text-4xl">📍</span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                No locations found
              </h3>
              <p className="text-gray-500 mb-4 text-sm">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Add your first location to get started"}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setActiveModal("create")}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold"
                >
                  + Add Location
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── CREATE LOCATION MODAL ─── */}
      {activeModal === "create" && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                  📌 Create Location Hierarchy
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                  Build a location path from root to leaf
                </p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="space-y-3 mb-4">
                {createPath.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-500 min-w-[60px]">
                      Level {index + 1}
                    </span>
                    <select
                      className="px-3 py-2 border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 select-red"
                      value={item.location_type}
                      onChange={(e) =>
                        updateCreateLevel(
                          index,
                          "location_type",
                          e.target.value,
                        )
                      }
                    >
                      {locationTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder={`Enter ${item.location_type.toLowerCase()} name`}
                      className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition text-sm input-red ${
                        createErrors[`path[${index}].name`] 
                          ? "border-red-500 focus:ring-red-400/50" 
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      value={item.name}
                      onChange={(e) =>
                        updateCreateLevel(index, "name", e.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeCreateLevel(index)}
                      className="text-red-500 hover:text-red-700 disabled:opacity-50"
                      disabled={createPath.length <= 1}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addCreateLevel}
                className="text-red-500 hover:text-red-700 text-sm font-medium"
              >
                + Add Level
              </button>

              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCreatePreview}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
                >
                  👁️ Preview
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 min-w-[120px] px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md shadow-red-500/25"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "✅ Create Location"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition text-sm"
                >
                  Cancel
                </button>
              </div>

              {createPreview && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="font-medium text-sm text-gray-700">
                    Preview Path:
                  </p>
                  <p className="text-lg font-semibold text-red-700">
                    {createPreview}
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ─── VIEW PATH MODAL ─── */}
      {activeModal === "view" && selectedLocation && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                  🌳 Location Path
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                  {getDisplayName(selectedLocation)}
                </p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="path-tree">
                {getPath(selectedLocation).map((node, index) => (
                  <div key={index} className="node">
                    <span className="indent">
                      {Array(index).fill("  ").join("")}
                    </span>
                    {index > 0 && <span className="connector">└── </span>}
                    <span className="mr-2">
                      {getLocationTypeIcon(node.location_type)}
                    </span>
                    <span className="font-medium">{node.name}</span>
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded-full ${getLocationTypeColor(node.location_type)}`}
                    >
                      {node.location_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Full Path:</span>{" "}
                <span className="font-mono text-red-700">
                  {getFullPath(selectedLocation)}
                </span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium text-sm"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const locationId =
                    "leaf_id" in selectedLocation
                      ? selectedLocation.leaf_id
                      : selectedLocation.id;
                  setActiveModal("migrate");
                  setMigrateSource(locationId);
                }}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition font-medium text-sm"
              >
                🔄 Migrate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MIGRATE LOCATION MODAL ─── */}
      {activeModal === "migrate" && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                  🔄 Migrate Location
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                  Move assets and departments to a new location
                </p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleMigrateSubmit}>
              {/* Source Selection */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Source Location <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 text-sm select-red"
                  value={migrateSource}
                  onChange={(e) => setMigrateSource(e.target.value)}
                >
                  <option value="">Select source location...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} - {loc.full_path}
                    </option>
                  ))}
                </select>
                {migrateErrors.source_location_id && (
                  <p className="text-red-500 text-xs mt-1.5">
                    {migrateErrors.source_location_id}
                  </p>
                )}
              </div>

              {/* Destination Path */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Destination Hierarchy <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {migratePath.map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <select
                        className="px-3 py-2 border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 select-red"
                        value={item.location_type}
                        onChange={(e) =>
                          updateMigrateLevel(
                            index,
                            "location_type",
                            e.target.value,
                          )
                        }
                      >
                        {locationTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder={`Enter ${item.location_type.toLowerCase()} name`}
                        className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition text-sm input-red ${
                          migrateErrors[`path[${index}].name`]
                            ? "border-red-500 focus:ring-red-400/50"
                            : "border-gray-200 focus:ring-red-400/50"
                        }`}
                        value={item.name}
                        onChange={(e) =>
                          updateMigrateLevel(index, "name", e.target.value)
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeMigrateLevel(index)}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        disabled={migratePath.length <= 1}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addMigrateLevel}
                  className="text-red-500 hover:text-red-700 text-sm font-medium mt-2"
                >
                  + Add Level
                </button>
              </div>

              {/* Warning */}
              <div className="warning-box mb-4">
                <div className="flex items-start gap-2">
                  <span className="text-xl text-red-600">⚠️</span>
                  <div>
                    <p className="font-bold text-red-800 text-sm">
                      Warning: This action is irreversible!
                    </p>
                    <ul className="text-sm text-red-700">
                      <li>All assets will be moved to the new location</li>
                      <li>All departments will be transferred</li>
                      <li>The source location will be deactivated</li>
                    </ul>
                    <label className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={migrateConfirmed}
                        onChange={(e) => setMigrateConfirmed(e.target.checked)}
                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700">
                        I understand the consequences
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting || !migrateSource || !migrateConfirmed}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-sm shadow-md shadow-red-500/25"
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "🚀 Execute Migration"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CLOSE LOCATION MODAL ─── */}
      {activeModal === "close" && selectedLocation && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div
            className="modal-content max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">
                Close Location?
              </h3>
              <p className="text-gray-600 text-sm mb-2">
                You are about to close{" "}
                <span className="font-semibold text-gray-800">
                  {getDisplayName(selectedLocation)}
                </span>
              </p>
              {getFullPath(selectedLocation) && (
                <p className="text-xs text-gray-500 mb-4 font-mono">
                  {getFullPath(selectedLocation)}
                </p>
              )}

              <div className="warning-box text-left mb-4">
                <p className="font-bold text-red-800 text-sm">This will:</p>
                <ul className="text-sm text-red-700">
                  <li>Deactivate this location</li>
                  <li>Deactivate all child locations</li>
                  <li>Deactivate all assets</li>
                  <li>Deactivate all departments</li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  ⚠️ Records are not deleted. History remains intact.
                </p>
              </div>

              <label className="flex items-center justify-center gap-2 mb-4">
                <input
                  type="checkbox"
                  checked={closeConfirmed}
                  onChange={(e) => setCloseConfirmed(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                />
                <span className="text-sm text-gray-700">
                  I understand this action is permanent
                </span>
              </label>

              <div className="flex gap-3">
                <button
                  onClick={() => setActiveModal(null)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const locationId =
                      "leaf_id" in selectedLocation
                        ? selectedLocation.leaf_id
                        : selectedLocation.id;
                    closeLocation(locationId);
                  }}
                  disabled={submitting || !closeConfirmed}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-sm shadow-md shadow-red-500/25"
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "⚠️ Close Location"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}