"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import api from "@/app/lib/api";

interface PlatformAdmin {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at?: string;
}

type ViewMode = "table" | "grid";

const exportToCSV = (data: PlatformAdmin[], filename: string) => {
  const headers = ["Full Name", "Email", "Role", "Status"];
  const rows = data.map((a) => [
    a.full_name,
    a.email,
    a.role,
    a.is_active ? "Active" : "Deactivated",
  ]);

  let csv = headers.join(",") + "\n";
  rows.forEach((row) => {
    csv += row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const exportToExcel = (data: PlatformAdmin[], filename: string) => {
  const headers = ["Full Name", "Email", "Role", "Status"];
  const rows = data.map((a) => [
    a.full_name,
    a.email,
    a.role,
    a.is_active ? "Active" : "Deactivated",
  ]);

  let csv = "\uFEFF";
  csv += headers.join(",") + "\n";
  rows.forEach((row) => {
    csv += row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
};

const getUserRoleFromToken = () => {
  if (typeof window === "undefined") return "";
  const token = localStorage.getItem("access_token");
  if (!token) return "";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || "";
  } catch {
    return "";
  }
};

export default function PlatformAdminsContent() {
  const router = useRouter();
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<PlatformAdmin | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
  });

  const userRole = getUserRoleFromToken();
  const isAdmin = userRole === "ADMIN";

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (showExportDropdown && exportButtonRef.current) {
      const rect = exportButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    } else {
      setDropdownPosition(null);
    }
  }, [showExportDropdown]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    if (!isAdmin) {
      toast.error("Access denied. Admin only.");
      router.push("/dashboard");
      return;
    }
  }, [router, isAdmin]);

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/platform-admins/");
      setAdmins(response.data);
    } catch (error: any) {
      console.error("Error fetching platform admins:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch admins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/platform-admins/create", formData);
      toast.success("Platform admin created successfully");
      setShowModal(false);
      setFormData({ full_name: "", email: "", password: "" });
      setShowPassword(false);
      fetchAdmins();
    } catch (error: any) {
      console.error("Error creating admin:", error);
      toast.error(error.response?.data?.detail || "Failed to create admin");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivateAdmin = async () => {
    if (!selectedAdmin) return;
    setSubmitting(true);
    try {
      await api.delete(`/platform-admins/${selectedAdmin.id}`);
      toast.success("Admin deactivated successfully");
      setShowDeleteConfirm(false);
      fetchAdmins();
    } catch (error: any) {
      console.error("Error deactivating admin:", error);
      toast.error(error.response?.data?.detail || "Failed to deactivate admin");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreAdmin = async () => {
    if (!selectedAdmin) return;
    setSubmitting(true);
    try {
      await api.patch(`/platform-admins/${selectedAdmin.id}/restore`);
      toast.success("Admin restored successfully");
      setShowRestoreConfirm(false);
      fetchAdmins();
    } catch (error: any) {
      console.error("Error restoring admin:", error);
      toast.error(error.response?.data?.detail || "Failed to restore admin");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    exportToCSV(
      admins,
      `platform_admins_${new Date().toISOString().split("T")[0]}`,
    );
    setShowExportDropdown(false);
    toast.success("CSV exported successfully");
  };

  const handleExportExcel = () => {
    exportToExcel(
      admins,
      `platform_admins_${new Date().toISOString().split("T")[0]}`,
    );
    setShowExportDropdown(false);
    toast.success("Excel exported successfully");
  };

  const filteredAdmins = admins.filter(
    (admin) =>
      admin.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const activeCount = admins.filter((a) => a.is_active).length;
  const deactivatedCount = admins.filter((a) => !a.is_active).length;

  const viewModeLabels: Record<ViewMode, string> = {
    table: "📋 Table",
    grid: "📊 Grid",
  };

  if (!isAdmin) {
    return null;
  }

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
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          border-radius: 32px;
          width: 95%;
          max-width: 820px;
          max-height: 90vh;
          overflow-y: auto;
          animation: fadeInScale 0.35s cubic-bezier(0.2, 0.9, 0.4, 1.2);
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(220, 38, 38, 0.08);
          padding: 24px 20px 28px;
        }

        @media (min-width: 640px) {
          .modal-content {
            padding: 28px 32px 32px;
          }
        }

        .modal-content::-webkit-scrollbar { width: 6px; }
        .modal-content::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 20px; margin: 12px 0; }
        .modal-content::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #dc2626, #ef4444); border-radius: 20px; border: 2px solid transparent; background-clip: padding-box; }
        .modal-content::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #b91c1c, #dc2626); }
        .modal-content { scrollbar-width: thin; scrollbar-color: #dc2626 #f1f5f9; scroll-behavior: smooth; }
        
        .delete-modal { max-width: 440px; }
        
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
        
        .admin-card {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .admin-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px -12px rgba(0,0,0,0.15);
        }
        
        .input-fancy {
          transition: all 0.2s ease;
          background: #fafbfc;
        }
        .input-fancy:focus {
          background: white;
          transform: scale(1.01);
        }
        .input-fancy::placeholder {
          color: #9ca3af;
          font-weight: 400;
          opacity: 0.9;
        }

        /* Table with horizontal scroll - ONLY the table scrolls */
        .table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }
        
        .table-wrapper::-webkit-scrollbar {
          height: 8px;
        }
        .table-wrapper::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 20px;
        }
        .table-wrapper::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, #dc2626, #ef4444);
          border-radius: 20px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .table-wrapper::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(90deg, #b91c1c, #dc2626);
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          font-weight: 400;
          min-width: 650px;
        }
        @media (min-width: 1024px) {
          .admin-table {
            min-width: auto;
          }
        }
        .admin-table thead th {
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
        .admin-table tbody td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #1f2937;
          font-size: 14px;
          font-weight: 400;
        }
        .admin-table tbody tr {
          transition: background 0.15s ease;
        }
        .admin-table tbody tr:hover {
          background: #fef2f2;
        }

        .admin-table .email-cell {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        @media (min-width: 1024px) {
          .admin-table .email-cell {
            max-width: none;
            white-space: normal;
          }
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
        .view-toggle-btn:hover {
          border-color: #dc2626;
          color: #dc2626;
        }
        .view-toggle-btn.active {
          background: #dc2626;
          color: white;
          border-color: #dc2626;
          box-shadow: 0 2px 8px rgba(220,38,38,0.25);
        }

        .modal-grid-2 {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 640px) {
          .modal-grid-2 {
            grid-template-columns: 1fr 1fr;
            gap: 18px 24px;
          }
        }
        .modal-grid-2 .full-width {
          grid-column: 1 / -1;
        }
        
        .input-icon-wrapper {
          position: relative;
        }
        .input-icon-wrapper .icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
          font-size: 16px;
          line-height: 1;
        }
        .input-icon-wrapper input {
          padding-left: 42px;
          padding-right: 12px;
        }
        .password-toggle {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .password-toggle:hover {
          color: #6b7280;
          background: #f3f4f6;
        }
        .password-toggle svg {
          width: 18px;
          height: 18px;
        }

        /* Responsive actions */
        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        @media (min-width: 640px) {
          .action-buttons {
            flex-direction: row;
            gap: 12px;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-100/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative p-6 lg:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 fade-in-up">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.8"
                  >
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-800">
                  Platform Admins
                </h1>
              </div>
              <p className="text-gray-500 ml-14 pl-0.5 text-sm font-normal">
                Manage platform administrators
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* ─── View Toggle ─── */}
              <div className="flex bg-white/80 backdrop-blur-sm rounded-xl border border-gray-100 p-1 shadow-sm">
                {(["table", "grid"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={`view-toggle-btn ${viewMode === mode ? "active" : ""}`}
                    onClick={() => setViewMode(mode)}
                  >
                    {viewModeLabels[mode]}
                  </button>
                ))}
              </div>

              {/* ─── Export Dropdown ─── */}
              <div className="relative">
                <button
                  ref={exportButtonRef}
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                  className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showExportDropdown &&
                  mounted &&
                  dropdownPosition &&
                  createPortal(
                    <div
                      className="fixed bg-white rounded-xl shadow-2xl border border-gray-100 py-1 fade-in-up"
                      style={{
                        zIndex: 999999,
                        minWidth: "180px",
                        top: dropdownPosition.top,
                        left: dropdownPosition.left,
                        transform: "translateX(-50%)",
                      }}
                    >
                      <button
                        onClick={handleExportExcel}
                        className="cursor-pointer w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-2"
                      >
                        <span>📊</span> Export to Excel
                      </button>
                      <button
                        onClick={handleExportCSV}
                        className="cursor-pointer w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-2"
                      >
                        <span>📄</span> Export to CSV
                      </button>
                    </div>,
                    document.body,
                  )}
              </div>

              {/* ─── Add Admin Button ─── */}
              <button
                onClick={() => setShowModal(true)}
                className="cursor-pointer group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 overflow-hidden"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="group-hover:rotate-90 transition-transform duration-300"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Add Admin</span>
              </button>
            </div>
          </div>

          {/* Stats Cards - Compact */}
          {!loading && admins.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mb-6 fade-in-up">
              <div className="stat-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="1.8"
                  >
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">
                    {admins.length}
                  </p>
                  <p className="text-sm font-medium text-gray-500">
                    Total Admins
                  </p>
                </div>
              </div>
              <div className="stat-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="1.8"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">
                    {activeCount}
                  </p>
                  <p className="text-sm font-medium text-gray-500">Active</p>
                </div>
              </div>
            </div>
          )}

          {/* Search Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 fade-in-up">
            <div className="relative max-w-md w-full">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
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
                placeholder="Search admins by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all shadow-sm text-gray-800 placeholder-gray-400 text-sm font-normal"
              />
            </div>
            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-gray-100">
              <span className="text-sm font-medium text-gray-500">
                Showing {filteredAdmins.length} admins
              </span>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* ─── Content Based on View Mode ─── */}
          {!loading && (
            <>
              {/* ─── GRID VIEW ─── */}
              {viewMode === "grid" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAdmins.map((admin, idx) => (
                    <div
                      key={admin.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm admin-card fade-in-up"
                      style={{ animationDelay: `${idx * 70}ms` }}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-50 to-white flex items-center justify-center shadow-sm border border-red-100/50">
                            <span className="text-red-600 font-bold text-xl">
                              {admin.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${admin.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                          >
                            {admin.is_active ? "Active" : "Deactivated"}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg mb-1">
                          {admin.full_name}
                        </h3>
                        <p className="text-sm text-gray-500 mb-2">
                          {admin.email}
                        </p>
                        <p className="text-xs text-gray-400">
                          Role: {admin.role}
                        </p>
                        <div className="mt-3 text-right">
                          <span className="text-xs text-gray-400 font-normal">
                            ID: {admin.id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ─── TABLE VIEW WITH HORIZONTAL SCROLL ─── */}
              {viewMode === "table" && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in-up">
                  <div className="table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Full Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAdmins.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="text-center py-12 text-gray-500 text-sm font-normal"
                            >
                              No platform admins found
                            </td>
                          </tr>
                        ) : (
                          filteredAdmins.map((admin) => (
                            <tr key={admin.id}>
                              <td className="font-semibold text-gray-900 whitespace-nowrap">
                                {admin.full_name}
                              </td>
                              <td className="email-cell text-gray-600">
                                {admin.email}
                              </td>
                              <td className="text-gray-600 whitespace-nowrap">
                                {admin.role}
                              </td>
                              <td className="whitespace-nowrap">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${admin.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                                >
                                  {admin.is_active ? "Active" : "Deactivated"}
                                </span>
                              </td>
                              <td className="whitespace-nowrap">
                                <div className="action-buttons">
                                  {admin.is_active ? (
                                    <button
                                      onClick={() => {
                                        setSelectedAdmin(admin);
                                        setShowDeleteConfirm(true);
                                      }}
                                      className="text-red-600 hover:text-red-800 text-sm font-semibold whitespace-nowrap"
                                    >
                                      Deactivate
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setSelectedAdmin(admin);
                                        setShowRestoreConfirm(true);
                                      }}
                                      className="text-green-600 hover:text-green-800 text-sm font-semibold whitespace-nowrap"
                                    >
                                      Restore
                                    </button>
                                  )}
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

          {/* Empty State */}
          {!loading && filteredAdmins.length === 0 && (
            <div className="text-center py-20 fade-in-up">
              <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="1.5"
                >
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                No platform admins found
              </h3>
              <p className="text-gray-500 mb-4 text-sm font-normal">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Add your first platform admin"}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold"
                >
                  + Add Admin
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Create Admin Modal ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Create Platform Admin
                </h2>
                <p className="text-sm text-gray-400 mt-0.5 font-normal">
                  Enter admin details below
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="cursor-pointer text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                <svg
                  width="16"
                  height="16"
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

            <form onSubmit={handleCreateAdmin}>
              <div className="modal-grid-2">
                <div className="full-width">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">👤</span>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) =>
                        setFormData({ ...formData, full_name: e.target.value })
                      }
                      required
                      autoComplete="off"
                      className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">✉️</span>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                      autoComplete="new-email"
                      className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                      placeholder="admin@assetiq.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🔒</span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required
                      autoComplete="new-password"
                      className="w-full px-4 py-2.5 pl-10 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                    Min 8 characters with uppercase, lowercase, and number
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-6 mt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="cursor-pointer flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="cursor-pointer flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Creating...
                    </>
                  ) : (
                    "Create Admin"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {showDeleteConfirm && selectedAdmin && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
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
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Deactivate Admin?
              </h3>
              <p className="text-gray-500 text-sm mb-4 font-normal">
                Are you sure you want to deactivate{" "}
                <span className="font-semibold text-gray-700">
                  {selectedAdmin.full_name}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivateAdmin}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Yes, Deactivate"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Restore Confirmation Modal ─── */}
      {showRestoreConfirm && selectedAdmin && (
        <div
          className="modal-overlay"
          onClick={() => setShowRestoreConfirm(false)}
        >
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="2"
                >
                  <path d="M20 12v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Restore Admin?
              </h3>
              <p className="text-gray-500 text-sm mb-4 font-normal">
                Are you sure you want to restore{" "}
                <span className="font-semibold text-gray-700">
                  {selectedAdmin.full_name}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRestoreConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestoreAdmin}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Yes, Restore"
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
