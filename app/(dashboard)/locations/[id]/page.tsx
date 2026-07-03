"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import api from "@/app/lib/api";

interface LocationPathItem {
  id: string;
  name: string;
  location_type: string;
}

interface LocationDetail {
  id: string;
  name: string;
  location_type: string;
  full_path: string;
  path: LocationPathItem[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Asset {
  id: string;
  name: string;
  serial_number: string;
  asset_condition: string;
  assigned_to_user_id: string | null;
}

interface User {
  id: string;
  full_name: string;
  email: string;
}

export default function LocationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const locationId = params.id as string;

  const [location, setLocation] = useState<LocationDetail | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    location_type: "",
  });
  const [migrateFormData, setMigrateFormData] = useState({
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

  const fetchLocationDetails = async () => {
    try {
      setLoading(true);

      const locRes = await api.get(`/location/${locationId}/leaf-path`);
      const assetsRes = await api.get(`/assets?location_id=${locationId}`);
      const usersRes = await api.get("/users");

      setLocation(locRes.data);
      setAssets(assetsRes.data || []);
      setUsers(usersRes.data || []);

      setEditFormData({
        name: locRes.data.leaf_name || "",
        location_type:
          locRes.data.path?.[locRes.data.path.length - 1]?.location_type || "",
      });
    } catch (error: any) {
      console.error("Error fetching location details:", error);
      toast.error("Failed to load location details");
      router.push("/locations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    if (locationId) {
      fetchLocationDetails();
    }
  }, [locationId]);

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editFormData.name.trim()) {
      toast.error("Location name is required");
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/location/${locationId}`, {
        name: editFormData.name.trim(),
        location_type: editFormData.location_type,
      });
      toast.success("Location updated successfully");
      setShowEditModal(false);
      fetchLocationDetails();
    } catch (error: any) {
      console.error("Error updating location:", error);
      toast.error(error.response?.data?.detail || "Failed to update location");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMigrateLocation = async (e: React.FormEvent) => {
    e.preventDefault();

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
        source_location_id: locationId,
        path: filteredPath,
      });
      toast.success("Location migrated successfully");
      setShowMigrateModal(false);
      setMigrateFormData({
        path: [
          { name: "", location_type: "COUNTRY" },
          { name: "", location_type: "STATE" },
          { name: "", location_type: "CITY" },
          { name: "", location_type: "OFFICE" },
        ],
      });
      fetchLocationDetails();
    } catch (error: any) {
      console.error("Error migrating location:", error);
      toast.error(error.response?.data?.detail || "Failed to migrate location");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseLocation = async () => {
    setSubmitting(true);
    try {
      await api.post(`/location/${locationId}/close`, {});
      toast.success("Location closed successfully");
      setShowCloseConfirm(false);
      fetchLocationDetails();
    } catch (error: any) {
      console.error("Error closing location:", error);
      toast.error(error.response?.data?.detail || "Failed to close location");
    } finally {
      setSubmitting(false);
    }
  };

  const updateMigratePath = (index: number, field: string, value: string) => {
    const newPath = [...migrateFormData.path];
    newPath[index] = { ...newPath[index], [field]: value };
    setMigrateFormData({ ...migrateFormData, path: newPath });
  };

  const getLocationTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      COUNTRY: "bg-emerald-100 text-emerald-700",
      STATE: "bg-blue-100 text-blue-700",
      CITY: "bg-purple-100 text-purple-700",
      ZONE: "bg-amber-100 text-amber-700",
      BUILDING: "bg-orange-100 text-orange-700",
      FLOOR: "bg-indigo-100 text-indigo-700",
      OFFICE: "bg-rose-100 text-rose-700",
    };
    return colors[type] || "bg-gray-100 text-gray-700";
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

  const getAssetStatusBadge = (condition: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-700",
      AVAILABLE: "bg-green-100 text-green-700",
      ASSIGNED: "bg-blue-100 text-blue-700",
      MAINTENANCE: "bg-yellow-100 text-yellow-700",
      UNDER_MAINTENANCE: "bg-yellow-100 text-yellow-700",
      DECOMMISSIONED: "bg-red-100 text-red-700",
      LOST: "bg-red-100 text-red-700",
    };
    return colors[condition] || "bg-gray-100 text-gray-700";
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "—";
    const user = users.find((u) => u.id === userId);
    return user ? user.full_name : "Unknown";
  };

  if (!mounted || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Location not found</p>
          <button
            onClick={() => router.push("/locations")}
            className="mt-4 text-emerald-600 hover:underline"
          >
            Back to Locations
          </button>
        </div>
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
        .fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards; }
        .slide-in { animation: slideIn 0.3s ease forwards; }

        .info-card {
          background: white;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
          transition: all 0.3s ease;
        }
        .info-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px -8px rgba(0,0,0,0.08);
        }

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
          max-width: 560px;
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

        .breadcrumb-path {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 2px;
          padding: 10px 14px;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #f1f5f9;
          overflow-x: auto;
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
          white-space: nowrap;
        }
        @media (min-width: 640px) {
          .breadcrumb-item {
            font-size: 12px;
            padding: 2px 8px;
          }
        }
        .breadcrumb-item::after {
          content: '›';
          color: #94a3b8;
          margin: 0 2px;
          font-weight: 700;
          font-size: 14px;
        }
        @media (min-width: 640px) {
          .breadcrumb-item::after {
            margin: 0 4px;
            font-size: 16px;
          }
        }
        .breadcrumb-item:last-child::after {
          content: '';
        }
        .breadcrumb-item:last-child {
          color: #10b981;
          font-weight: 700;
          background: rgba(16, 185, 129, 0.08);
        }

        .asset-row {
          transition: all 0.2s ease;
          cursor: pointer;
          border-radius: 10px;
        }
        .asset-row:hover {
          background: #f8fafc;
          transform: translateX(4px);
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

        .input-fancy {
          transition: all 0.2s ease;
          background: #fafbfc;
        }
        .input-fancy:focus {
          background: white;
          border-color: #10b981;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
        }

        /* Responsive: Asset row - stack on mobile */
        .asset-row-content {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 12px 16px;
        }
        @media (min-width: 640px) {
          .asset-row-content {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            gap: 12px;
          }
        }

        /* Responsive: Action buttons */
        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
        }
        @media (min-width: 640px) {
          .action-buttons {
            flex-direction: row;
            gap: 8px;
            width: auto;
          }
        }
        .action-buttons button {
          flex: 1;
          justify-content: center;
        }
        @media (min-width: 640px) {
          .action-buttons button {
            flex: none;
          }
        }

        /* Responsive: Header */
        .location-header {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        @media (min-width: 768px) {
          .location-header {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }
        }

        .location-title {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        @media (min-width: 640px) {
          .location-title {
            flex-direction: row;
            align-items: center;
            gap: 12px;
          }
        }

        /* Responsive: Migrate form fields */
        .migrate-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        @media (min-width: 640px) {
          .migrate-row {
            flex-direction: row;
            gap: 12px;
            align-items: center;
          }
        }
        .migrate-row .type-label {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          width: 100%;
        }
        @media (min-width: 640px) {
          .migrate-row .type-label {
            width: 80px;
            font-size: 12px;
            flex-shrink: 0;
          }
        }
        .migrate-row input {
          flex: 1;
          width: 100%;
        }
        .migrate-row select {
          width: 100%;
        }
        @media (min-width: 640px) {
          .migrate-row select {
            width: 120px;
            flex-shrink: 0;
          }
        }

        /* Responsive: Stats grid */
        .detail-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 1024px) {
          .detail-grid {
            grid-template-columns: 2fr 1fr;
            gap: 24px;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
        <div className="relative p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {/* ─── Back Button ─── */}
          <button
            onClick={() => router.push("/locations")}
            className="flex items-center gap-1.5 sm:gap-2 text-slate-500 hover:text-emerald-600 transition-colors mb-4 sm:mb-6 group"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="group-hover:-translate-x-0.5 transition-transform sm:w-4.5 sm:h-4.5"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span className="text-sm sm:text-base">Back to Locations</span>
          </button>

          {/* ─── Header ─── */}
          <div className="location-header mb-6 sm:mb-8 fade-in-up">
            <div className="location-title">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-2xl blur-xl animate-pulse"></div>
                <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <span className="text-xl sm:text-2xl">
                    {getLocationTypeIcon(location.location_type)}
                  </span>
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight truncate">
                  {location.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                  <span
                    className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${getLocationTypeColor(location.location_type)}`}
                  >
                    {location.location_type}
                  </span>
                  <span
                    className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${location.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {location.is_active ? "Active" : "Closed"}
                  </span>
                </div>
              </div>
            </div>
            <div className="action-buttons">
              <button
                onClick={() => setShowEditModal(true)}
                className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-xs sm:text-sm transition-all duration-200 shadow-lg shadow-blue-500/20"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => setShowMigrateModal(true)}
                className="px-3 sm:px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold text-xs sm:text-sm transition-all duration-200 shadow-lg shadow-amber-500/20"
              >
                🔄 Migrate
              </button>
              {location.is_active && (
                <button
                  onClick={() => setShowCloseConfirm(true)}
                  className="px-3 sm:px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 font-semibold text-xs sm:text-sm transition-all duration-200 shadow-lg shadow-rose-500/20"
                >
                  🔒 Close
                </button>
              )}
            </div>
          </div>

          {/* ─── Two Column Layout ─── */}
          <div className="detail-grid fade-in-up">
            {/* ─── Left Column: Location Info ─── */}
            <div className="space-y-4 sm:space-y-6">
              {/* Location Path */}
              <div className="info-card p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-3 sm:mb-4 flex items-center gap-2">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    className="sm:w-5 sm:h-5"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Location Path
                </h3>
                <div className="breadcrumb-path">
                  {location.path.map((item, idx) => (
                    <span key={idx} className="breadcrumb-item">
                      {getLocationTypeIcon(item.location_type)} {item.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Assets at this location */}
              <div className="info-card p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      className="sm:w-5 sm:h-5"
                    >
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                      <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                    Assets at this location ({assets.length})
                  </h3>
                  <button
                    onClick={() =>
                      router.push(`/assets?location_id=${locationId}`)
                    }
                    className="text-[10px] sm:text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                  >
                    View all →
                  </button>
                </div>

                {assets.length === 0 ? (
                  <div className="text-center py-6 sm:py-8 text-slate-500 text-xs sm:text-sm">
                    No assets at this location yet.
                    <button
                      onClick={() => router.push("/assets/new")}
                      className="block mt-2 text-emerald-600 hover:underline font-medium"
                    >
                      + Add asset
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assets.slice(0, 5).map((asset) => (
                      <div
                        key={asset.id}
                        className="asset-row border border-transparent hover:border-emerald-200"
                        onClick={() => router.push(`/assets/${asset.id}`)}
                      >
                        <div className="asset-row-content">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-sm truncate">
                              {asset.name}
                            </p>
                            {asset.serial_number && (
                              <p className="text-[10px] sm:text-xs text-slate-400">
                                SN: {asset.serial_number}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${getAssetStatusBadge(asset.asset_condition)}`}
                            >
                              {asset.asset_condition}
                            </span>
                            <span className="text-[10px] sm:text-xs text-slate-400">
                              {getUserName(asset.assigned_to_user_id)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {assets.length > 5 && (
                      <button
                        onClick={() =>
                          router.push(`/assets?location_id=${locationId}`)
                        }
                        className="text-[10px] sm:text-xs text-emerald-600 hover:text-emerald-700 font-semibold mt-2 block"
                      >
                        + {assets.length - 5} more assets →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Right Column: Metadata ─── */}
            <div className="space-y-4 sm:space-y-6">
              <div className="info-card p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-3 sm:mb-4 flex items-center gap-2">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    className="sm:w-5 sm:h-5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4l3 3" />
                  </svg>
                  Details
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wide">
                      Location ID
                    </p>
                    <p className="text-xs sm:text-sm font-mono text-slate-700 mt-0.5 sm:mt-1 break-all">
                      {location.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wide">
                      Type
                    </p>
                    <p className="text-xs sm:text-sm text-slate-700 mt-0.5 sm:mt-1 flex items-center gap-2">
                      <span>{getLocationTypeIcon(location.location_type)}</span>
                      {location.location_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wide">
                      Full Path
                    </p>
                    <p className="text-xs sm:text-sm text-slate-700 mt-0.5 sm:mt-1 font-medium break-all">
                      {location.full_path}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wide">
                      Status
                    </p>
                    <p className="text-xs sm:text-sm text-slate-700 mt-0.5 sm:mt-1">
                      <span
                        className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${location.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${location.is_active ? "bg-green-500" : "bg-gray-400"}`}
                        ></span>
                        {location.is_active ? "Active" : "Closed"}
                      </span>
                    </p>
                  </div>
                  <div className="pt-3 sm:pt-4 border-t border-slate-100">
                    <button
                      onClick={() =>
                        router.push(`/locations/${locationId}/audits`)
                      }
                      className="text-xs sm:text-sm text-slate-500 hover:text-emerald-600 font-medium transition-colors"
                    >
                      📜 View audit history →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Edit Modal ─── */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Edit Location
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Update location details
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
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
              onSubmit={handleUpdateLocation}
              className="space-y-3 sm:space-y-4"
            >
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Location Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all input-fancy text-slate-800 placeholder-slate-400 text-xs sm:text-sm font-normal"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Location Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={editFormData.location_type}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      location_type: e.target.value,
                    })
                  }
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 bg-white text-slate-800 text-xs sm:text-sm font-normal"
                >
                  {locationTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold text-xs sm:text-sm transition-all duration-200 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 btn-primary rounded-xl font-semibold text-xs sm:text-sm disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
                >
                  {submitting ? (
                    <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Update Location"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Migrate Modal ─── */}
      {showMigrateModal && (
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
                  Move{" "}
                  <span className="font-semibold text-slate-700">
                    {location.name}
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
                  <span className="font-semibold">{location.full_path}</span>
                </p>
              </div>

              <p className="text-[10px] sm:text-xs text-slate-500">
                Enter the new hierarchy path for this location
              </p>

              {migrateFormData.path.map((item, index) => (
                <div
                  key={index}
                  className="migrate-row slide-in"
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

      {/* ─── Close Confirmation ─── */}
      {showCloseConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowCloseConfirm(false)}
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
                  {location.name}
                </span>
                ?
                <br />
                <span className="text-[10px] sm:text-xs text-slate-400">
                  This will deactivate the location
                </span>
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                <button
                  onClick={() => setShowCloseConfirm(false)}
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
