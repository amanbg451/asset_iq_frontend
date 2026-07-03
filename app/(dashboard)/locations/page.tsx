"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import api from "@/app/lib/api";

interface LocationPathItem {
  id: string;
  name: string;
  location_type: string;
}

interface LocationCard {
  id: string;
  name: string;
  location_type: string;
  full_path: string;
  path: LocationPathItem[];
}

export default function LocationsPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState<LocationCard | null>(
    null,
  );
  const [selectedLocation, setSelectedLocation] = useState<LocationCard | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    path: [
      { name: "", location_type: "COUNTRY" },
      { name: "", location_type: "STATE" },
      { name: "", location_type: "CITY" },
      { name: "", location_type: "OFFICE" },
    ],
  });
  const [migrateFormData, setMigrateFormData] = useState({
    source_location_id: "",
    path: [
      { name: "", location_type: "COUNTRY" },
      { name: "", location_type: "STATE" },
      { name: "", location_type: "CITY" },
      { name: "", location_type: "OFFICE" },
    ],
  });

  const locationTypes = [
    "COUNTRY",
    "STATE",
    "CITY",
    "ZONE",
    "BUILDING",
    "FLOOR",
    "OFFICE",
  ];

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchLocations();
  }, [router, fetchLocations]);

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();

    const filteredPath = createFormData.path.filter(
      (item) => item.name.trim() !== "",
    );

    if (filteredPath.length < 2) {
      toast.error("Please enter at least 2 levels (e.g., Country and State)");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/location/path", { path: filteredPath });
      toast.success("Location hierarchy created successfully");
      setShowCreateModal(false);
      setCreateFormData({
        path: [
          { name: "", location_type: "COUNTRY" },
          { name: "", location_type: "STATE" },
          { name: "", location_type: "CITY" },
          { name: "", location_type: "OFFICE" },
        ],
      });
      fetchLocations();
    } catch (error: any) {
      console.error("Error creating location:", error);
      toast.error(error.response?.data?.detail || "Failed to create location");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMigrateLocation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!migrateFormData.source_location_id) {
      toast.error("Please select a location to migrate");
      return;
    }

    const filteredPath = migrateFormData.path.filter(
      (item) => item.name.trim() !== "",
    );

    if (filteredPath.length < 2) {
      toast.error("Please enter at least 2 levels for the new path");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/location/migrate", {
        source_location_id: migrateFormData.source_location_id,
        path: filteredPath,
      });
      toast.success("Location migrated successfully");
      setShowMigrateModal(false);
      setMigrateFormData({
        source_location_id: "",
        path: [
          { name: "", location_type: "COUNTRY" },
          { name: "", location_type: "STATE" },
          { name: "", location_type: "CITY" },
          { name: "", location_type: "OFFICE" },
        ],
      });
      fetchLocations();
    } catch (error: any) {
      console.error("Error migrating location:", error);
      toast.error(error.response?.data?.detail || "Failed to migrate location");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseLocation = async () => {
    if (!showCloseConfirm) return;

    setSubmitting(true);
    try {
      await api.post(`/location/${showCloseConfirm.id}/close`, {});
      toast.success(`"${showCloseConfirm.name}" closed successfully`);
      setShowCloseConfirm(null);
      fetchLocations();
    } catch (error: any) {
      console.error("Error closing location:", error);
      toast.error(error.response?.data?.detail || "Failed to close location");
    } finally {
      setSubmitting(false);
    }
  };

  const updateCreatePath = (index: number, field: string, value: string) => {
    const newPath = [...createFormData.path];
    newPath[index] = { ...newPath[index], [field]: value };
    setCreateFormData({ path: newPath });
  };

  const updateMigratePath = (index: number, field: string, value: string) => {
    const newPath = [...migrateFormData.path];
    newPath[index] = { ...newPath[index], [field]: value };
    setMigrateFormData({ ...migrateFormData, path: newPath });
  };

  const filteredLocations = locations.filter(
    (loc) =>
      loc.full_path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getLocationTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      COUNTRY: "bg-emerald-100 text-emerald-700 border-emerald-200",
      STATE: "bg-blue-100 text-blue-700 border-blue-200",
      CITY: "bg-purple-100 text-purple-700 border-purple-200",
      ZONE: "bg-amber-100 text-amber-700 border-amber-200",
      BUILDING: "bg-orange-100 text-orange-700 border-orange-200",
      FLOOR: "bg-indigo-100 text-indigo-700 border-indigo-200",
      OFFICE: "bg-rose-100 text-rose-700 border-rose-200",
    };
    return colors[type] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getLocationTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      COUNTRY: "🌍",
      STATE: "🏛️",
      CITY: "🏙️",
      ZONE: "📌",
      BUILDING: "🏢",
      FLOOR: "🔼",
      OFFICE: "💼",
    };
    return icons[type] || "📍";
  };

  if (!mounted) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards; }
        .slide-in { animation: slideIn 0.3s ease forwards; }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
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
          border-radius: 24px;
          width: 95%;
          max-width: 640px;
          max-height: 90vh;
          overflow-y: auto;
          animation: fadeInUp 0.35s ease;
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.5);
          padding: 24px 20px 28px;
        }
        @media (min-width: 640px) {
          .modal-content {
            padding: 32px;
          }
        }
        .modal-content::-webkit-scrollbar {
          width: 6px;
        }
        .modal-content::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 20px;
        }
        .modal-content::-webkit-scrollbar-thumb {
          background: #10b981;
          border-radius: 20px;
        }

        .location-card {
          background: white;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          cursor: pointer;
        }
        .location-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #10b981, #34d399, #10b981);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .location-card:hover::before {
          opacity: 1;
        }
        .location-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px -12px rgba(16, 185, 129, 0.15);
          border-color: #10b981;
        }

        .stat-card {
          background: white;
          border-radius: 14px;
          border: 1px solid #f1f5f9;
          transition: all 0.3s ease;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px -8px rgba(0,0,0,0.08);
          border-color: #e2e8f0;
        }

        .breadcrumb-path {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 2px;
          padding: 8px 12px;
          background: #f8fafc;
          border-radius: 10px;
          border: 1px solid #f1f5f9;
        }
        .breadcrumb-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 500;
          color: #64748b;
          padding: 2px 6px;
          border-radius: 4px;
          transition: all 0.2s ease;
        }
        .breadcrumb-item:hover {
          background: #e2e8f0;
          color: #1e293b;
        }
        .breadcrumb-item::after {
          content: '›';
          color: #94a3b8;
          margin: 0 2px;
          font-weight: 700;
          font-size: 14px;
        }
        .breadcrumb-item:last-child::after {
          content: '';
        }
        .breadcrumb-item:last-child {
          color: #10b981;
          font-weight: 700;
          background: rgba(16, 185, 129, 0.08);
        }

        .input-fancy {
          transition: all 0.2s ease;
          background: #fafbfc;
        }
        .input-fancy:focus {
          background: white;
          border-color: #10b981;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
        }

        .btn-primary {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          transition: all 0.3s ease;
        }
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px -8px rgba(16, 185, 129, 0.4);
        }

        .location-type-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          border-radius: 99px;
          font-size: 10px;
          font-weight: 600;
          border: 1px solid;
          letter-spacing: 0.3px;
        }

        /* Responsive: Form fields stack on mobile */
        .form-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        @media (min-width: 640px) {
          .form-row {
            flex-direction: row;
            gap: 12px;
            align-items: center;
          }
        }

        .form-row .type-label {
          width: 100%;
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
        }
        @media (min-width: 640px) {
          .form-row .type-label {
            width: 80px;
            font-size: 12px;
            flex-shrink: 0;
          }
        }

        .form-row input {
          flex: 1;
          width: 100%;
        }

        .form-row select {
          width: 100%;
        }
        @media (min-width: 640px) {
          .form-row select {
            width: 120px;
            flex-shrink: 0;
          }
        }

        /* Responsive: Stats cards */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 32px;
        }
        @media (min-width: 640px) {
          .stats-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
          }
        }

        /* Responsive: Location cards grid */
        .locations-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 768px) {
          .locations-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }
        }
        @media (min-width: 1280px) {
          .locations-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
        {/* Background decoration */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-100/30 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-100/20 rounded-full blur-3xl"></div>
        </div>

        <div className="relative p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {/* ─── Header ─── */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 sm:mb-8 gap-4 fade-in-up">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-1">
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/25 flex-shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    className="sm:w-5 sm:h-5"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
                    Locations
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
                    Manage your organizational location hierarchy
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="group relative flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-2xl font-semibold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 transform hover:-translate-y-0.5 w-full sm:w-auto justify-center"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="group-hover:rotate-90 transition-transform duration-300 sm:w-4.5 sm:h-4.5"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Create Location</span>
            </button>
          </div>

          {/* ─── Stats ─── */}
          {!loading && locations.length > 0 && (
            <div className="stats-grid fade-in-up">
              <div className="stat-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#059669"
                    strokeWidth="2"
                    className="sm:w-5 sm:h-5"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">
                    {locations.length}
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
                    Total Locations
                  </p>
                </div>
              </div>
              <div className="stat-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#e11d48"
                    strokeWidth="2"
                    className="sm:w-5 sm:h-5"
                  >
                    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">
                    {
                      locations.filter((l) => l.location_type === "OFFICE")
                        .length
                    }
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
                    Offices
                  </p>
                </div>
              </div>
              <div className="stat-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2"
                    className="sm:w-5 sm:h-5"
                  >
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">
                    {locations.filter((l) => l.location_type === "CITY").length}
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
                    Cities
                  </p>
                </div>
              </div>
              <div className="stat-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth="2"
                    className="sm:w-5 sm:h-5"
                  >
                    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">
                    {
                      locations.filter((l) => l.location_type === "COUNTRY")
                        .length
                    }
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
                    Countries
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── Search ─── */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 fade-in-up">
            <div className="relative w-full sm:w-80">
              <svg
                className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400"
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
                placeholder="Search locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all shadow-sm text-slate-800 placeholder-slate-400 text-xs sm:text-sm font-normal"
              />
            </div>
            <div className="text-xs sm:text-sm text-slate-500 font-medium">
              {filteredLocations.length}{" "}
              {filteredLocations.length === 1 ? "location" : "locations"} found
            </div>
          </div>

          {/* ─── Loading State ─── */}
          {loading && (
            <div className="flex justify-center items-center py-16 sm:py-20">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-3 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* ─── Location Cards ─── */}
          {!loading && (
            <div className="locations-grid">
              {filteredLocations.length === 0 ? (
                <div className="col-span-full text-center py-16 sm:py-20">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      className="sm:w-10 sm:h-10"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-1.5 sm:mb-2">
                    No locations found
                  </h3>
                  <p className="text-slate-500 text-xs sm:text-sm">
                    {searchTerm
                      ? "Try adjusting your search terms"
                      : "Create your first location hierarchy to get started"}
                  </p>
                  {!searchTerm && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-3 sm:mt-4 px-4 sm:px-6 py-2 sm:py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-500/20"
                    >
                      + Create Location
                    </button>
                  )}
                </div>
              ) : (
                filteredLocations.map((loc, index) => (
                  <div
                    key={loc.id}
                    className="location-card p-4 sm:p-5 fade-in-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => router.push(`/locations/${loc.id}`)}
                  >
                    <div className="flex items-start justify-between mb-2.5 sm:mb-3">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <span className="text-lg sm:text-xl flex-shrink-0">
                          {getLocationTypeIcon(loc.location_type)}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight truncate">
                            {loc.name}
                          </h3>
                          <span
                            className={`location-type-badge ${getLocationTypeColor(loc.location_type)}`}
                          >
                            {loc.location_type}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCloseConfirm(loc);
                        }}
                        disabled={submitting}
                        className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-200 flex-shrink-0"
                        title="Close Location"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="sm:w-4 sm:h-4"
                        >
                          <path d="M18 6L6 18" />
                          <path d="M6 6L18 18" />
                        </svg>
                      </button>
                    </div>

                    {/* Breadcrumb path */}
                    <div className="breadcrumb-path mt-2 overflow-x-auto">
                      {loc.path.map((item, idx) => (
                        <span
                          key={idx}
                          className="breadcrumb-item whitespace-nowrap"
                        >
                          {item.name}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 sm:mt-4 flex justify-between items-center">
                      <span className="text-[10px] sm:text-xs text-slate-400">
                        ID: {loc.id.slice(0, 8)}...
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLocation(loc);
                          setMigrateFormData({
                            source_location_id: loc.id,
                            path: [
                              { name: "", location_type: "COUNTRY" },
                              { name: "", location_type: "STATE" },
                              { name: "", location_type: "CITY" },
                              { name: "", location_type: "OFFICE" },
                            ],
                          });
                          setShowMigrateModal(true);
                        }}
                        className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all duration-200"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="sm:w-3.5 sm:h-3.5"
                        >
                          <path d="M18 8l4-4-4-4" />
                          <path d="M6 16l-4 4 4 4" />
                          <path d="M2 12h20" />
                          <path d="M22 12H2" />
                        </svg>
                        Migrate
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Create Location Modal ─── */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Create Location Hierarchy
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Build your location tree from top to bottom
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200 flex-shrink-0"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="sm:w-4 sm:h-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form
              onSubmit={handleCreateLocation}
              className="space-y-3 sm:space-y-4"
            >
              <div className="p-2.5 sm:p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <p className="text-[10px] sm:text-xs text-emerald-700 flex items-center gap-1.5 sm:gap-2">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="sm:w-3.5 sm:h-3.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4l3 3" />
                  </svg>
                  Enter hierarchy from top to bottom (e.g., Country → State →
                  City → Office)
                </p>
              </div>

              {createFormData.path.map((item, index) => (
                <div
                  key={index}
                  className="form-row slide-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className="type-label">{item.location_type}</span>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) =>
                      updateCreatePath(index, "name", e.target.value)
                    }
                    placeholder={`Enter ${item.location_type.toLowerCase()} name...`}
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all input-fancy text-slate-800 placeholder-slate-400 text-xs sm:text-sm font-normal"
                  />
                  <select
                    value={item.location_type}
                    onChange={(e) =>
                      updateCreatePath(index, "location_type", e.target.value)
                    }
                    className="px-2 sm:px-3 py-2 sm:py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 bg-white text-slate-800 text-xs sm:text-sm font-normal"
                  >
                    {locationTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold text-xs sm:text-sm transition-all duration-200 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 btn-primary rounded-xl font-semibold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
                >
                  {submitting ? (
                    <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Create Location"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Migrate Location Modal ─── */}
      {showMigrateModal && selectedLocation && (
        <div
          className="modal-overlay"
          onClick={() => setShowMigrateModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Migrate Location
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Moving{" "}
                  <span className="font-semibold text-slate-700">
                    {selectedLocation.name}
                  </span>{" "}
                  to a new path
                </p>
              </div>
              <button
                onClick={() => setShowMigrateModal(false)}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200 flex-shrink-0"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="sm:w-4 sm:h-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form
              onSubmit={handleMigrateLocation}
              className="space-y-3 sm:space-y-4"
            >
              <div className="p-3 sm:p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                <p className="text-[10px] sm:text-xs text-amber-700 break-all">
                  Current path:{" "}
                  <span className="font-semibold">
                    {selectedLocation.full_path}
                  </span>
                </p>
              </div>

              <p className="text-[10px] sm:text-xs text-slate-500">
                Enter the new hierarchy path for this location
              </p>

              {migrateFormData.path.map((item, index) => (
                <div
                  key={index}
                  className="form-row slide-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className="type-label">{item.location_type}</span>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) =>
                      updateMigratePath(index, "name", e.target.value)
                    }
                    placeholder={`Enter ${item.location_type.toLowerCase()} name...`}
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all input-fancy text-slate-800 placeholder-slate-400 text-xs sm:text-sm font-normal"
                  />
                  <select
                    value={item.location_type}
                    onChange={(e) =>
                      updateMigratePath(index, "location_type", e.target.value)
                    }
                    className="px-2 sm:px-3 py-2 sm:py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 bg-white text-slate-800 text-xs sm:text-sm font-normal"
                  >
                    {locationTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMigrateModal(false)}
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold text-xs sm:text-sm transition-all duration-200 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm shadow-lg shadow-amber-500/20 order-1 sm:order-2"
                >
                  {submitting ? (
                    <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Migrate Location"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Close Confirmation Modal ─── */}
      {showCloseConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowCloseConfirm(null)}
        >
          <div
            className="modal-content max-w-md text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-100 flex items-center justify-center mb-3 sm:mb-4">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#e11d48"
                  strokeWidth="2"
                  className="sm:w-7 sm:h-7"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1.5 sm:mb-2">
                Close Location?
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6">
                Are you sure you want to close{" "}
                <span className="font-semibold text-slate-700">
                  {showCloseConfirm.name}
                </span>
                ?
                <br />
                <span className="text-[10px] sm:text-xs text-slate-400">
                  This will deactivate the location
                </span>
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                <button
                  onClick={() => setShowCloseConfirm(null)}
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold text-xs sm:text-sm transition-all duration-200 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloseLocation}
                  disabled={submitting}
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm shadow-lg shadow-rose-500/20 order-1 sm:order-2"
                >
                  {submitting ? (
                    <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Yes, Close"
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
