"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import api from "@/app/lib/api";

interface Department {
  id: string;
  client_id: string;
  name: string;
  code: string;
  description: string;
  manager_id: string | null;
  is_active: boolean;
}

interface Manager {
  id: string;
  full_name: string;
  email: string;
}

interface Client {
  id: string;
  name: string;
}

type ViewMode = "table" | "grid";

// ─── Helper: Export to CSV ──────────────────────────────────────────────────
const exportToCSV = (data: Department[], filename: string) => {
  const headers = [
    "Name",
    "Code",
    "Client ID",
    "Description",
    "Manager",
    "Status",
  ];
  const rows = data.map((d) => [
    d.name,
    d.code,
    d.client_id || "",
    d.description || "",
    d.manager_id || "",
    d.is_active ? "Active" : "Deactivated",
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

// ─── Helper: Export to Excel ────────────────────────────────────────────────
const exportToExcel = (data: Department[], filename: string) => {
  const headers = [
    "Name",
    "Code",
    "Client ID",
    "Description",
    "Manager",
    "Status",
  ];
  const rows = data.map((d) => [
    d.name,
    d.code,
    d.client_id || "",
    d.description || "",
    d.manager_id || "",
    d.is_active ? "Active" : "Deactivated",
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

// ─── Helper: Get client_id from JWT token ───────────────────────────────────
const getClientIdFromToken = () => {
  if (typeof window === "undefined") return "";
  const token = localStorage.getItem("access_token");
  if (!token) return "";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.client_id || "";
  } catch {
    return "";
  }
};

// ─── Helper: Get user role from JWT token ───────────────────────────────────
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

export default function DepartmentsPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingClients, setFetchingClients] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [selectedDepartment, setSelectedDepartment] =
    useState<Department | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    client_id: "",
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [selectedManagerId, setSelectedManagerId] = useState("");

  const [selectedClientForDeactivated, setSelectedClientForDeactivated] =
    useState<string>("");

  const userRole = getUserRoleFromToken();
  const isPlatformAdmin = userRole === "ADMIN";

  // ─── Set mounted state ─────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // ─── Position dropdown when it opens ──────────────────────────────────────
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

  // ─── Fetch Departments with Deactivated Support ──────────────────────────
  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      let url = "/departments";

      if (showDeactivated) {
        const clientId = getClientIdFromToken();
        if (clientId) {
          url = `/departments/clients/${clientId}/deactivated`;
        } else if (formData.client_id) {
          url = `/departments/clients/${formData.client_id}/deactivated`;
        } else {
          setDepartments([]);
          setLoading(false);
          return;
        }
      }

      const response = await api.get(url);
      setDepartments(response.data);
    } catch (error: any) {
      console.error("Error fetching departments:", error);
      toast.error(
        error.response?.data?.detail || "Failed to fetch departments",
      );
    } finally {
      setLoading(false);
    }
  }, [showDeactivated, formData.client_id]);

  // ─── Fetch managers ─────────────────────────────────────────────────────────
  const fetchManagers = async () => {
    try {
      const clientId = getClientIdFromToken();
      const role = getUserRoleFromToken();

      // For Client Admin, use the regular /users/managers endpoint
      // The client-specific endpoint (/users/clients/{clientId}/managers) is for Platform Admin only
      let url = "/users/managers";

      // Only use client-specific endpoint if NOT Client Admin
      if (clientId && role !== "CLIENT_ADMIN") {
        url = `/users/clients/${clientId}/managers`;
      }

      const response = await api.get(url);
      setManagers(response.data);
    } catch (error: any) {
      // If we get 403, it's expected - Client Admin doesn't have permission
      if (error.response?.status === 403) {
        console.warn("Managers endpoint not accessible - skipping");
        setManagers([]);
        return;
      }
      console.error("Error fetching managers:", error);
    }
  };

  // ─── Fetch clients for dropdown ──────────────────────────────────────────
  const fetchClients = async () => {
    try {
      setFetchingClients(true);
      const response = await api.get("/clients");
      setClients(response.data);
    } catch (error: any) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to fetch clients");
    } finally {
      setFetchingClients(false);
    }
  };

  // ─── Check department limit before creation ──────────────────────────────
  const checkDepartmentLimit = async (): Promise<boolean> => {
    try {
      const clientId = getClientIdFromToken();
      if (!clientId) {
        if (formData.client_id) {
          const [subRes, deptRes] = await Promise.all([
            api.get(`/clients/${formData.client_id}/subscriptions`),
            api.get("/departments"),
          ]);

          const subscription = subRes.data;
          const maxDepartments = subscription?.max_departments || 0;
          const activeDepartments = deptRes.data.filter(
            (d: Department) =>
              d.is_active && d.client_id === formData.client_id,
          ).length;

          if (activeDepartments >= maxDepartments && maxDepartments > 0) {
            toast.error(
              `Maximum ${maxDepartments} departments allowed. Please upgrade subscription.`,
            );
            return false;
          }
          return true;
        }
        return true;
      }

      const [subRes, deptRes] = await Promise.all([
        api.get(`/clients/${clientId}/subscriptions`),
        api.get("/departments"),
      ]);

      const subscription = subRes.data;
      const maxDepartments = subscription?.max_departments || 0;
      const activeDepartments = deptRes.data.filter(
        (d: Department) => d.is_active,
      ).length;

      if (activeDepartments >= maxDepartments && maxDepartments > 0) {
        toast.error(
          `Maximum ${maxDepartments} departments allowed. Please upgrade your subscription.`,
        );
        return false;
      }

      const remaining = maxDepartments - activeDepartments;
      if (remaining <= 5 && remaining > 0) {
        toast(`Only ${remaining} department slots remaining`, { icon: "⚠️" });
      }

      return true;
    } catch (error) {
      console.error("Error checking department limit:", error);
      return true;
    }
  };

  // ─── Handle client selection for deactivated view ────────────────────────
  const handleClientSelectForDeactivated = (clientId: string) => {
    setSelectedClientForDeactivated(clientId);
    setFormData((prev) => ({ ...prev, client_id: clientId }));
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchDepartments();
    fetchManagers();
  }, [router, fetchDepartments]);

  useEffect(() => {
    if (showModal && isPlatformAdmin) {
      fetchClients();
    }
  }, [showModal, isPlatformAdmin]);

  useEffect(() => {
    if (showDeactivated && isPlatformAdmin && clients.length === 0) {
      fetchClients();
    }
  }, [showDeactivated, isPlatformAdmin]);

  // ─── Create Department ────────────────────────────────────────────────────
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();

    const withinLimit = await checkDepartmentLimit();
    if (!withinLimit) return;

    setSubmitting(true);
    try {
      let endpoint = "/departments";
      const payload: any = {
        name: formData.name,
        code: formData.code,
        description: formData.description,
      };

      const clientId = getClientIdFromToken();
      const role = getUserRoleFromToken();

      if (role === "ADMIN" && formData.client_id) {
        endpoint = `/departments/clients/${formData.client_id}/departments`;
      } else if (clientId) {
        payload.client_id = clientId;
      } else {
        toast.error("Client ID is required");
        setSubmitting(false);
        return;
      }

      await api.post(endpoint, payload);
      toast.success("Department created successfully");
      setShowModal(false);
      setFormData({ name: "", code: "", description: "", client_id: "" });
      fetchDepartments();
    } catch (error: any) {
      console.error("Error creating department:", error);
      toast.error(
        error.response?.data?.detail || "Failed to create department",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDepartment) return;
    setSubmitting(true);
    try {
      await api.patch(`/departments/${selectedDepartment.id}`, editFormData);
      toast.success("Department updated successfully");
      setShowEditModal(false);
      fetchDepartments();
    } catch (error: any) {
      console.error("Error updating department:", error);
      toast.error(
        error.response?.data?.detail || "Failed to update department",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDepartment) return;
    setSubmitting(true);
    try {
      await api.patch(`/departments/${selectedDepartment.id}/assign-manager`, {
        manager_id: selectedManagerId,
      });
      toast.success("Manager assigned successfully");
      setShowManagerModal(false);
      fetchDepartments();
    } catch (error: any) {
      console.error("Error assigning manager:", error);
      toast.error(error.response?.data?.detail || "Failed to assign manager");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveManager = async () => {
    if (!selectedDepartment) return;
    setSubmitting(true);
    try {
      await api.patch(`/departments/${selectedDepartment.id}/remove-manager`);
      toast.success("Manager removed successfully");
      setShowManagerModal(false);
      fetchDepartments();
    } catch (error: any) {
      console.error("Error removing manager:", error);
      toast.error(error.response?.data?.detail || "Failed to remove manager");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!selectedDepartment) return;
    setSubmitting(true);
    try {
      await api.delete(`/departments/${selectedDepartment.id}`);
      toast.success("Department deactivated successfully");
      setShowDeleteConfirm(false);
      fetchDepartments();
    } catch (error: any) {
      console.error("Error deactivating department:", error);
      toast.error(
        error.response?.data?.detail || "Failed to deactivate department",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreDepartment = async () => {
    if (!selectedDepartment) return;
    setSubmitting(true);
    try {
      await api.patch(`/departments/${selectedDepartment.id}/restore`);
      toast.success("Department restored successfully");
      setShowRestoreConfirm(false);
      fetchDepartments();
    } catch (error: any) {
      console.error("Error restoring department:", error);
      toast.error(
        error.response?.data?.detail || "Failed to restore department",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (dept: Department) => {
    setSelectedDepartment(dept);
    setEditFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || "",
    });
    setShowEditModal(true);
  };

  const openManagerModal = (dept: Department) => {
    setSelectedDepartment(dept);
    setSelectedManagerId(dept.manager_id || "");
    setShowManagerModal(true);
  };

  // ─── Export Handlers ──────────────────────────────────────────────────────
  const handleExportCSV = () => {
    exportToCSV(
      departments,
      `departments_${new Date().toISOString().split("T")[0]}`,
    );
    setShowExportDropdown(false);
    toast.success("CSV exported successfully");
  };

  const handleExportExcel = () => {
    exportToExcel(
      departments,
      `departments_${new Date().toISOString().split("T")[0]}`,
    );
    setShowExportDropdown(false);
    toast.success("Excel exported successfully");
  };

  const filteredDepartments = departments.filter(
    (dept) =>
      (showDeactivated ? !dept.is_active : dept.is_active) &&
      (dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.code.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const activeCount = departments.filter((d) => d.is_active).length;
  const deactivatedCount = departments.filter((d) => !d.is_active).length;

  // ─── View Mode Labels ──────────────────────────────────────────────────────
  const viewModeLabels: Record<ViewMode, string> = {
    table: "📋 Table",
    grid: "📊 Grid",
  };

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
        /* Enhanced modal: bigger, two-column layout */
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

        /* ─── Beautiful Rounded Scrollbar ──────────────────────────────────── */
        .modal-content::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .modal-content::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 20px;
          margin: 12px 0;
          box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.02);
        }

        .modal-content::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #dc2626, #ef4444);
          border-radius: 20px;
          border: 2px solid transparent;
          background-clip: padding-box;
          transition: all 0.2s ease;
        }

        .modal-content::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #b91c1c, #dc2626);
          border: 1px solid transparent;
          background-clip: padding-box;
          transform: scale(1.05);
        }

        /* Firefox scrollbar support */
        .modal-content {
          scrollbar-width: thin;
          scrollbar-color: #dc2626 #f1f5f9;
          scroll-behavior: smooth;
        }

        .modal-content::-webkit-scrollbar-track:hover {
          background: #e8edf4;
        }
        
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
        
        .dept-card {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .dept-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px -12px rgba(0,0,0,0.15);
        }
        
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 24px;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.3s;
          border-radius: 24px;
        }
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }
        input:checked + .toggle-slider {
          background-color: #dc2626;
        }
        input:checked + .toggle-slider:before {
          transform: translateX(26px);
        }
        
        /* Softer placeholder color */
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

        /* ─── Table Styles ──────────────────────────────────────────────────── */
        .dept-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          font-weight: 400;
        }
        .dept-table thead th {
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
        .dept-table tbody td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #1f2937;
          font-size: 14px;
          font-weight: 400;
        }
        .dept-table tbody tr {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .dept-table tbody tr:hover {
          background: #fef2f2;
        }
        .dept-table tbody tr:active {
          background: #fecaca;
        }

        /* ─── View Toggle Buttons ──────────────────────────────────────────── */
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

        /* Two-column grid for modal fields */
        .modal-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px 24px;
        }
        .modal-grid-2 .full-width {
          grid-column: 1 / -1;
        }
        /* Icon inside input */
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
        .input-icon-wrapper select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 40px;
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
                    <path d="M20 7h-4.18A3 3 0 0016 5.18V4a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2z" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                    <line x1="8" y1="8" x2="16" y2="8" />
                  </svg>
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-800">
                  Departments
                </h1>
              </div>
              <p className="text-gray-500 ml-14 pl-0.5 text-sm font-normal">
                Manage your organizational departments and managers
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
                  className=" cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
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

              {/* ─── Add Department Button ─── */}
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
                <span>Add Department</span>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {!loading && departments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6 fade-in-up">
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
                    <path d="M20 7h-4.18A3 3 0 0016 5.18V4a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">
                    {departments.length}
                  </p>
                  <p className="text-sm font-medium text-gray-500">
                    Total Departments
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
              <div className="stat-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6b7280"
                    strokeWidth="1.8"
                  >
                    <path d="M12 8v4l3 3" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">
                    {deactivatedCount}
                  </p>
                  <p className="text-sm font-medium text-gray-500">
                    Deactivated
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search and Toggle */}
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
                placeholder="Search departments by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all shadow-sm text-gray-800 placeholder-gray-400 text-sm font-normal"
              />
            </div>

            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-gray-100">
              <span
                className={`text-sm font-medium ${!showDeactivated ? "text-red-600" : "text-gray-500"}`}
              >
                Active
              </span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showDeactivated}
                  onChange={() => setShowDeactivated(!showDeactivated)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span
                className={`text-sm font-medium ${showDeactivated ? "text-red-600" : "text-gray-500"}`}
              >
                Deactivated
              </span>
            </div>
          </div>

          {/* ─── Client Selector for Deactivated View ─── */}
          {isPlatformAdmin && showDeactivated && (
            <div className="mb-6 p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                  Select Client:
                </label>
                <select
                  value={selectedClientForDeactivated}
                  onChange={(e) =>
                    handleClientSelectForDeactivated(e.target.value)
                  }
                  className="w-full sm:max-w-md px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all bg-white text-gray-800"
                >
                  <option value="">-- Select a client --</option>
                  {fetchingClients ? (
                    <option value="" disabled>
                      Loading clients...
                    </option>
                  ) : (
                    clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))
                  )}
                </select>
                {selectedClientForDeactivated && (
                  <button
                    onClick={() => {
                      setSelectedClientForDeactivated("");
                      setFormData((prev) => ({ ...prev, client_id: "" }));
                    }}
                    className="text-sm text-red-600 hover:text-red-800 font-semibold"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Select a client to view their deactivated departments
              </p>
            </div>
          )}

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
                <>
                  {!isPlatformAdmin &&
                    showDeactivated &&
                    departments.length === 0 && (
                      <div className="text-center py-8 text-gray-500 text-sm font-normal">
                        No deactivated departments found for your client.
                      </div>
                    )}

                  {isPlatformAdmin &&
                    showDeactivated &&
                    !selectedClientForDeactivated && (
                      <div className="text-center py-8 text-gray-500 text-sm font-normal">
                        Please select a client to view deactivated departments.
                      </div>
                    )}

                  {!(
                    (isPlatformAdmin &&
                      showDeactivated &&
                      !selectedClientForDeactivated) ||
                    (!isPlatformAdmin &&
                      showDeactivated &&
                      departments.length === 0)
                  ) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredDepartments.map((dept, idx) => (
                        <div
                          key={dept.id}
                          className="bg-white rounded-xl border border-gray-100 shadow-sm dept-card fade-in-up"
                          style={{ animationDelay: `${idx * 70}ms` }}
                          onClick={() => router.push(`/departments/${dept.id}`)}
                        >
                          <div className="p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-50 to-white flex items-center justify-center shadow-sm border border-red-100/50">
                                <svg
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#dc2626"
                                  strokeWidth="1.8"
                                >
                                  <path d="M20 7h-4.18A3 3 0 0016 5.18V4a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2z" />
                                  <line x1="8" y1="12" x2="16" y2="12" />
                                  <line x1="8" y1="8" x2="16" y2="8" />
                                </svg>
                              </div>
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${dept.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                              >
                                {dept.is_active ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <h3 className="font-bold text-gray-900 text-lg mb-1">
                              {dept.name}
                            </h3>
                            <p className="text-xs text-gray-400 font-mono mb-2">
                              {dept.code}
                            </p>
                            {dept.description && (
                              <p className="text-sm text-gray-500 line-clamp-2 font-normal">
                                {dept.description}
                              </p>
                            )}
                            <div className="mt-3 text-right">
                              <span className="text-xs text-gray-400 group-hover:text-red-500 transition-colors font-normal">
                                Click to view details →
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ─── TABLE VIEW ─── */}
              {viewMode === "table" && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in-up">
                  <div className="overflow-x-auto">
                    <table className="dept-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Code</th>
                          <th>Client ID</th>
                          <th>Description</th>
                          <th>Manager</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDepartments.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="text-center py-12 text-gray-500 text-sm font-normal"
                            >
                              No departments found
                            </td>
                          </tr>
                        ) : (
                          filteredDepartments.map((dept) => (
                            <tr
                              key={dept.id}
                              onClick={() =>
                                router.push(`/departments/${dept.id}`)
                              }
                              onMouseEnter={() => setHoveredRow(dept.id)}
                              onMouseLeave={() => setHoveredRow(null)}
                            >
                              <td className="font-semibold text-gray-900">
                                {dept.name}
                              </td>
                              <td className="text-gray-600 font-mono">
                                {dept.code}
                              </td>
                              <td className="text-gray-600 text-sm font-mono">
                                {dept.client_id}
                              </td>
                              <td className="text-gray-600 text-sm max-w-[200px] truncate">
                                {dept.description || "—"}
                              </td>
                              <td className="text-gray-600">
                                {dept.manager_id || "—"}
                              </td>
                              <td>
                                <span
                                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${dept.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                                >
                                  {dept.is_active ? "Active" : "Deactivated"}
                                </span>
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
          {!loading &&
            filteredDepartments.length === 0 &&
            !(
              isPlatformAdmin &&
              showDeactivated &&
              !selectedClientForDeactivated
            ) &&
            !(isPlatformAdmin && showDeactivated && departments.length === 0) &&
            !(
              !isPlatformAdmin &&
              showDeactivated &&
              departments.length === 0
            ) && (
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
                    <path d="M20 7h-4.18A3 3 0 0016 5.18V4a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  No departments found
                </h3>
                <p className="text-gray-500 mb-4 text-sm font-normal">
                  {searchTerm
                    ? "Try adjusting your search"
                    : "Add your first department to get started"}
                </p>
                {!searchTerm && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="cursor-pointer px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold"
                  >
                    + Add Department
                  </button>
                )}
              </div>
            )}
        </div>
      </div>

      {/* ─── ENHANCED: Create Department Modal ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              {/* Subtle accent line */}
              {/* <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-400/60 via-red-300/40 to-red-400/60 rounded-t-2xl"></div> */}

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Create Department
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5 font-normal">
                    Enter department details below
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

              <form onSubmit={handleCreateDepartment}>
                <div className="modal-grid-2">
                  {/* Department Name - full width */}
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Department Name <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏢</span>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                        autoComplete="off"
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Information Technology"
                      />
                    </div>
                  </div>

                  {/* Department Code */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Department Code <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🔢</span>
                      <input
                        type="text"
                        name="code"
                        value={formData.code}
                        onChange={(e) =>
                          setFormData({ ...formData, code: e.target.value })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="IT001"
                      />
                    </div>
                  </div>

                  {/* Client Dropdown - Platform Admin only */}
                  {isPlatformAdmin && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Client <span className="text-red-500">*</span>
                      </label>
                      <div className="input-icon-wrapper">
                        <span className="icon">🏛️</span>
                        <select
                          name="client_id"
                          value={formData.client_id}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              client_id: e.target.value,
                            })
                          }
                          required
                          className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all bg-white text-gray-800 text-sm font-normal"
                        >
                          <option value="">Select a client</option>
                          {fetchingClients ? (
                            <option value="" disabled>
                              Loading clients...
                            </option>
                          ) : (
                            clients.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.name}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                        Select the client for this department
                      </p>
                    </div>
                  )}

                  {!isPlatformAdmin && (
                    <div className="full-width">
                      <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
                        <p className="text-sm text-gray-500 font-normal">
                          Department will be created under your client.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Description - full width */}
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Description
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon icon-top">📝</span>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        rows={3}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all resize-none input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Brief description of the department"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
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
                      "Create Department"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── ENHANCED: Edit Department Modal ─── */}
      {showEditModal && selectedDepartment && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400/60 via-amber-300/40 to-amber-400/60 rounded-t-2xl"></div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Edit Department
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5 font-normal">
                    Update department information
                  </p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
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

              <form onSubmit={handleUpdateDepartment}>
                <div className="modal-grid-2">
                  {/* Department Name - full width */}
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Department Name <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏢</span>
                      <input
                        type="text"
                        value={editFormData.name}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            name: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Enter department name"
                      />
                    </div>
                  </div>

                  {/* Department Code */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Department Code <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🔢</span>
                      <input
                        type="text"
                        value={editFormData.code}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            code: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Enter department code"
                      />
                    </div>
                  </div>

                  {/* Description - full width */}
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Description
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon icon-top">📝</span>
                      <textarea
                        value={editFormData.description}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            description: e.target.value,
                          })
                        }
                        rows={3}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all resize-none input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Department description"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-6 mt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                        Updating...
                      </>
                    ) : (
                      "Update Department"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
