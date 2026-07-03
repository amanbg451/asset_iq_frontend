"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { z } from "zod";
import api from "../../lib/api";

interface MaintenanceTask {
  id: string;
  asset_id: string;
  client_id: string;
  raised_by: string;
  issue_description: string;
  photos_urls: string[];
  estimated_cost: number | null;
  is_emergency: boolean;
  status:
    | "pending_approval"
    | "approved"
    | "in_progress"
    | "completed"
    | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  vendor_name: string | null;
  parts_replaced: string[];
  created_at: string;
  rejection_reason?: string | null;
}

interface Asset {
  id: string;
  name: string;
  serial_number?: string;
}

interface CreateMaintenanceData {
  issue_description: string;
  photos_urls: string[];
  estimated_cost: number | null;
  is_emergency: boolean;
  vendor_name: string | null;
}

type ViewMode = "table" | "grid";

// Zod schema for validating maintenance request data

const maintenanceSchema = z.object({
  issue_description: z
    .string()
    .min(5, "Issue description must be at least 5 characters")
    .max(1000, "Issue description must be at most 1000 characters"),
  photos_urls: z.array(z.string().url("Invalid URL")).default([]),
  estimated_cost: z
    .number()
    .min(0, "Estimated cost must be at least 0")
    .nullable()
    .optional()
    .default(null),
  is_emergency: z.boolean().default(false),
  vendor_name: z
    .string()
    .max(100, "Vendor name must be at most 100 characters")
    .nullable()
    .optional()
    .default(null),
});

const exportToCSV = (data: MaintenanceTask[], filename: string) => {
  const headers = ["Asset", "Issue", "Status", "Cost", "Vendor", "Created"];
  const rows = data.map((t) => [
    t.asset_id,
    t.issue_description,
    t.status,
    t.estimated_cost?.toString() || "",
    t.vendor_name || "",
    new Date(t.created_at).toLocaleDateString(),
  ]);

  let csv = headers.join(",") + "\n";
  rows.forEach((row) => {
    csv +=
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",") +
      "\n";
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const exportToExcel = (data: MaintenanceTask[], filename: string) => {
  const headers = ["Asset", "Issue", "Status", "Cost", "Vendor", "Created"];
  const rows = data.map((t) => [
    t.asset_id,
    t.issue_description,
    t.status,
    t.estimated_cost?.toString() || "",
    t.vendor_name || "",
    new Date(t.created_at).toLocaleDateString(),
  ]);

  let csv = "\uFEFF";
  csv += headers.join(",") + "\n";
  rows.forEach((row) => {
    csv +=
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",") +
      "\n";
  });

  const blob = new Blob([csv], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pending_approval: "bg-yellow-100 text-yellow-700 border-yellow-200",
    approved: "bg-blue-100 text-blue-700 border-blue-200",
    in_progress: "bg-orange-100 text-orange-700 border-orange-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };
  return colors[status] || "bg-gray-100 text-gray-700 border-gray-200";
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending_approval: "Pending Approval",
    approved: "Approved",
    in_progress: "In Progress",
    completed: "Completed",
    rejected: "Rejected",
  };
  return labels[status] || status;
};

export default function MaintenancePage() {
  const router = useRouter();

  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const [formData, setFormData] = useState<CreateMaintenanceData>({
    issue_description: "",
    photos_urls: [],
    estimated_cost: null,
    is_emergency: false,
    vendor_name: null,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedAssetId, setSelectedAssetId] = useState("");

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

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const url = statusFilter
        ? `/assets/maintenance?status=${statusFilter}`
        : "/assets/maintenance";
      const response = await api.get(url);
      setTasks(response.data || []);
    } catch (error: any) {
      console.error("Error fetching maintenance tasks:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchAssets = useCallback(async () => {
    try {
      const response = await api.get("/assets");
      setAssets(response.data || []);
    } catch (error: any) {
      console.error("Error fetching assets:", error);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchTasks();
    fetchAssets();
  }, [router, fetchTasks, fetchAssets]);

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAssetId) {
      toast.error("Please select an asset");
      return;
    }

    const result = maintenanceSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });
      setFormErrors(errors);
      toast.error(result.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/assets/${selectedAssetId}/maintenance`, result.data);
      toast.success("Maintenance request created successfully");
      setShowModal(false);
      setFormData({
        issue_description: "",
        photos_urls: [],
        estimated_cost: null,
        is_emergency: false,
        vendor_name: null,
      });
      setFormErrors({});
      setSelectedAssetId("");
      fetchTasks();
    } catch (error: any) {
      console.error("Error creating maintenance:", error);
      toast.error(
        error.response?.data?.detail || "Failed to create maintenance request",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (task: MaintenanceTask) => {
    setSubmitting(true);
    try {
      await api.patch(`/assets/maintenance/${task.id}/approve`);
      toast.success("Maintenance approved successfully");
      fetchTasks();
    } catch (error: any) {
      console.error("Error approving maintenance:", error);
      toast.error(
        error.response?.data?.detail || "Failed to approve maintenance",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async (task: MaintenanceTask) => {
    setSubmitting(true);
    try {
      await api.patch(`/assets/maintenance/${task.id}/start`);
      toast.success("Maintenance started successfully");
      fetchTasks();
    } catch (error: any) {
      console.error("Error starting maintenance:", error);
      toast.error(
        error.response?.data?.detail || "Failed to start maintenance",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (task: MaintenanceTask) => {
    setSubmitting(true);
    try {
      await api.patch(`/assets/maintenance/${task.id}/complete`);
      toast.success("Maintenance completed successfully");
      fetchTasks();
    } catch (error: any) {
      console.error("Error completing maintenance:", error);
      toast.error(
        error.response?.data?.detail || "Failed to complete maintenance",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (task: MaintenanceTask) => {
    setSubmitting(true);
    try {
      await api.patch(`/assets/maintenance/${task.id}/reject`, {
        rejection_reason: "Rejected by user",
      });
      toast.success("Maintenance rejected successfully");
      fetchTasks();
    } catch (error: any) {
      console.error("Error rejecting maintenance:", error);
      toast.error(
        error.response?.data?.detail || "Failed to reject maintenance",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    exportToCSV(tasks, `maintenance_${new Date().toISOString().split("T")[0]}`);
    setShowExportDropdown(false);
    toast.success("CSV exported successfully");
  };

  const handleExportExcel = () => {
    exportToExcel(
      tasks,
      `maintenance_${new Date().toISOString().split("T")[0]}`,
    );
    setShowExportDropdown(false);
    toast.success("Excel exported successfully");
  };

  const filteredTasks = tasks.filter(
    (task) =>
      (task.issue_description
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
        task.asset_id.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === "" || task.status === statusFilter),
  );

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending_approval").length,
    approved: tasks.filter((t) => t.status === "approved").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    rejected: tasks.filter((t) => t.status === "rejected").length,
  };

  const getAssetName = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    return asset ? asset.name : "Unknown Asset";
  };

  if (!mounted) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
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
          padding: 28px 32px 32px;
        }

        .modal-content::-webkit-scrollbar { width: 6px; }
        .modal-content::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 20px; margin: 12px 0; }
        .modal-content::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #dc2626, #ef4444); border-radius: 20px; border: 2px solid transparent; background-clip: padding-box; }
        .modal-content::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #b91c1c, #dc2626); }
        .modal-content { scrollbar-width: thin; scrollbar-color: #dc2626 #f1f5f9; scroll-behavior: smooth; }

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

        .maintenance-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          font-weight: 400;
        }
        .maintenance-table thead th {
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
        .maintenance-table tbody td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #1f2937;
          font-size: 14px;
          font-weight: 400;
        }
        .maintenance-table tbody tr {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .maintenance-table tbody tr:hover {
          background: #fef2f2;
        }

        .action-btn {
          padding: 4px 8px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
          font-size: 13px;
          background: transparent;
        }
        .action-btn:hover {
          transform: scale(1.1);
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

        .modal-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px 24px;
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
        .input-icon-wrapper input,
        .input-icon-wrapper textarea,
        .input-icon-wrapper select {
          padding-left: 42px;
        }
        .input-icon-wrapper textarea {
          padding-top: 12px;
          padding-bottom: 12px;
          resize: vertical;
          min-height: 52px;
        }
        .input-icon-wrapper .icon-top {
          top: 16px;
          transform: none;
        }
        .input-icon-wrapper select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 40px;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 600;
          border: 1px solid transparent;
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

        .filter-select {
          padding: 9px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: white;
          font-size: 13px;
          color: #1f2937;
          outline: none;
          transition: all 0.2s;
          cursor: pointer;
          min-width: 140px;
        }
        .filter-select:focus {
          border-color: #dc2626;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.2);
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
                    strokeWidth="2"
                  >
                    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                  </svg>
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-800">
                  Maintenance
                </h1>
              </div>
              <p className="text-gray-500 ml-14 pl-0.5 text-sm font-normal">
                Manage maintenance requests and tasks
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* View Toggle */}
              <div className="flex bg-white/80 backdrop-blur-sm rounded-xl border border-gray-100 p-1 shadow-sm">
                {(["table", "grid"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={`view-toggle-btn ${viewMode === mode ? "active" : ""}`}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode === "table" ? "📋 Table" : "📊 Grid"}
                  </button>
                ))}
              </div>

              {/* Export Dropdown */}
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
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-2"
                      >
                        <span>📊</span> Export to Excel
                      </button>
                      <button
                        onClick={handleExportCSV}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-2"
                      >
                        <span>📄</span> Export to CSV
                      </button>
                    </div>,
                    document.body,
                  )}
              </div>

              {/* Add Button */}
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
                <span>Raise Request</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          {!loading && tasks.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6 fade-in-up">
              <div className="stat-card p-3 text-center">
                <p className="text-xl font-bold text-gray-800">{stats.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="stat-card p-3 text-center border-yellow-200">
                <p className="text-xl font-bold text-yellow-600">
                  {stats.pending}
                </p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
              <div className="stat-card p-3 text-center border-blue-200">
                <p className="text-xl font-bold text-blue-600">
                  {stats.approved}
                </p>
                <p className="text-xs text-gray-500">Approved</p>
              </div>
              <div className="stat-card p-3 text-center border-orange-200">
                <p className="text-xl font-bold text-orange-600">
                  {stats.inProgress}
                </p>
                <p className="text-xs text-gray-500">In Progress</p>
              </div>
              <div className="stat-card p-3 text-center border-green-200">
                <p className="text-xl font-bold text-green-600">
                  {stats.completed}
                </p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
              <div className="stat-card p-3 text-center border-red-200">
                <p className="text-xl font-bold text-red-600">
                  {stats.rejected}
                </p>
                <p className="text-xs text-gray-500">Rejected</p>
              </div>
            </div>
          )}

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 fade-in-up">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative max-w-md w-full sm:w-64">
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
                  placeholder="Search maintenance..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all shadow-sm text-gray-800 placeholder-gray-400 text-sm font-normal"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Status</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="text-sm text-gray-500 font-normal">
              {filteredTasks.length}{" "}
              {filteredTasks.length === 1 ? "task" : "tasks"}
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* Content */}
          {!loading && (
            <>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => router.push(`/maintenance/${task.id}`)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                          {task.issue_description}
                        </h3>
                        <span
                          className={`status-badge ${getStatusColor(task.status)}`}
                        >
                          {getStatusLabel(task.status)}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p className="text-xs text-gray-500">
                          Asset:{" "}
                          <span className="font-medium text-gray-700">
                            {getAssetName(task.asset_id)}
                          </span>
                        </p>
                        {task.vendor_name && (
                          <p className="text-xs text-gray-500">
                            Vendor:{" "}
                            <span className="font-medium text-gray-700">
                              {task.vendor_name}
                            </span>
                          </p>
                        )}
                        {task.estimated_cost && (
                          <p className="text-xs text-gray-500">
                            Cost:{" "}
                            <span className="font-medium text-gray-700">
                              ₹{task.estimated_cost}
                            </span>
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(task.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in-up">
                  <div className="overflow-x-auto">
                    <table className="maintenance-table">
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th>Issue</th>
                          <th>Status</th>
                          <th>Cost</th>
                          <th>Vendor</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTasks.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="text-center py-12 text-gray-500 text-sm font-normal"
                            >
                              {searchTerm || statusFilter
                                ? "No tasks match your filters"
                                : "No maintenance tasks found"}
                            </td>
                          </tr>
                        ) : (
                          filteredTasks.map((task) => (
                            <tr
                              key={task.id}
                              onMouseEnter={() => setHoveredRow(task.id)}
                              onMouseLeave={() => setHoveredRow(null)}
                            >
                              <td className="font-medium text-gray-900">
                                {getAssetName(task.asset_id)}
                              </td>
                              <td className="text-gray-600 max-w-[200px] truncate">
                                {task.issue_description}
                              </td>
                              <td>
                                <span
                                  className={`status-badge ${getStatusColor(task.status)}`}
                                >
                                  {getStatusLabel(task.status)}
                                </span>
                              </td>
                              <td className="text-gray-600">
                                {task.estimated_cost
                                  ? `₹${task.estimated_cost}`
                                  : "—"}
                              </td>
                              <td className="text-gray-600">
                                {task.vendor_name || "—"}
                              </td>
                              <td>
                                <div className="flex items-center justify-end gap-1">
                                  {task.status === "pending_approval" && (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleApprove(task);
                                        }}
                                        disabled={submitting}
                                        className="action-btn text-green-600 hover:bg-green-50"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReject(task);
                                        }}
                                        disabled={submitting}
                                        className="action-btn text-red-600 hover:bg-red-50"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                  {task.status === "approved" && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStart(task);
                                      }}
                                      disabled={submitting}
                                      className="action-btn text-blue-600 hover:bg-blue-50"
                                    >
                                      Start
                                    </button>
                                  )}
                                  {task.status === "in_progress" && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleComplete(task);
                                      }}
                                      disabled={submitting}
                                      className="action-btn text-green-600 hover:bg-green-50"
                                    >
                                      Complete
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/maintenance/${task.id}`);
                                    }}
                                    className="action-btn text-blue-600 hover:bg-blue-50"
                                  >
                                    View
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

          {/* Empty State */}
          {!loading && filteredTasks.length === 0 && (
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
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                No maintenance tasks
              </h3>
              <p className="text-gray-500 mb-4 text-sm font-normal">
                {searchTerm || statusFilter
                  ? "Try adjusting your filters"
                  : "Raise your first maintenance request"}
              </p>
              {!searchTerm && !statusFilter && (
                <button
                  onClick={() => setShowModal(true)}
                  className="cursor-pointer px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold"
                >
                  + Raise Request
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── CREATE MAINTENANCE MODAL ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Raise Maintenance Request
                </h2>
                <p className="text-sm text-gray-400 mt-0.5 font-normal">
                  Create a new maintenance request
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

            <form onSubmit={handleCreateMaintenance}>
              <div className="modal-grid-2">
                {/* Asset Selection */}
                <div className="full-width">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Asset <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📦</span>
                    <select
                      value={selectedAssetId}
                      onChange={(e) => {
                        setSelectedAssetId(e.target.value);
                        if (formErrors.asset_id)
                          setFormErrors({ ...formErrors, asset_id: "" });
                      }}
                      required
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-sm font-normal ${
                        formErrors.asset_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                    >
                      <option value="">Select an asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name}{" "}
                          {asset.serial_number
                            ? `(${asset.serial_number})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formErrors.asset_id && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {formErrors.asset_id}
                    </p>
                  )}
                </div>

                {/* Issue Description */}
                <div className="full-width">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Issue Description <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon icon-top">📝</span>
                    <textarea
                      value={formData.issue_description}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          issue_description: e.target.value,
                        });
                        if (formErrors.issue_description)
                          setFormErrors({
                            ...formErrors,
                            issue_description: "",
                          });
                      }}
                      required
                      rows={3}
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all resize-none input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                        formErrors.issue_description
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="Describe the issue..."
                    />
                  </div>
                  {formErrors.issue_description && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {formErrors.issue_description}
                    </p>
                  )}
                </div>

                {/* Estimated Cost */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Estimated Cost (₹)
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">💰</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.estimated_cost ?? ""}
                      onChange={(e) => {
                        const val = e.target.value
                          ? parseFloat(e.target.value)
                          : null;
                        setFormData({ ...formData, estimated_cost: val });
                        if (formErrors.estimated_cost)
                          setFormErrors({ ...formErrors, estimated_cost: "" });
                      }}
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                        formErrors.estimated_cost
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="0.00"
                    />
                  </div>
                  {formErrors.estimated_cost && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {formErrors.estimated_cost}
                    </p>
                  )}
                </div>

                {/* Vendor Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Vendor Name
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🏭</span>
                    <input
                      type="text"
                      value={formData.vendor_name ?? ""}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          vendor_name: e.target.value || null,
                        });
                        if (formErrors.vendor_name)
                          setFormErrors({ ...formErrors, vendor_name: "" });
                      }}
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                        formErrors.vendor_name
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="Vendor name"
                    />
                  </div>
                  {formErrors.vendor_name && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {formErrors.vendor_name}
                    </p>
                  )}
                </div>

                {/* Emergency */}
                <div className="full-width">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_emergency}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_emergency: e.target.checked,
                        })
                      }
                      className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Mark as Emergency
                    </span>
                    <span className="text-xs text-red-500 font-medium">
                      (Priority approval)
                    </span>
                  </label>
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
                      Raising...
                    </>
                  ) : (
                    "Raise Request"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
