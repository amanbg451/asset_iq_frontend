"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import api from "@/app/lib/api";

interface Role {
  id: string;
  client_id: string;
  name: string;
  description: string;
  is_active: boolean;
}

interface Service {
  id: string;
  name: string;
  code: string;
}

interface Permission {
  service_id: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

type ViewMode = "table" | "grid";

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

const exportToCSV = (data: Role[], filename: string) => {
  const headers = ["Role Name", "Description", "Client ID", "Status"];
  const rows = data.map((r) => [
    r.name,
    r.description || "",
    r.client_id || "",
    r.is_active ? "Active" : "Deactivated",
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

const exportToExcel = (data: Role[], filename: string) => {
  const headers = ["Role Name", "Description", "Client ID", "Status"];
  const rows = data.map((r) => [
    r.name,
    r.description || "",
    r.client_id || "",
    r.is_active ? "Active" : "Deactivated",
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

export default function RolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "deactivated"
  >("all");

  const [newRole, setNewRole] = useState({
    name: "",
    description: "",
  });
  const [newRoleErrors, setNewRoleErrors] = useState({
    name: "",
  });

  const exportButtonRef = useRef<HTMLButtonElement>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isClientAdmin, setIsClientAdmin] = useState(false);
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    setMounted(true);
    const role = getUserRoleFromToken();
    setIsAdmin(role === "ADMIN");
    setIsClientAdmin(role === "CLIENT_ADMIN");
    setClientId(getClientIdFromToken());
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
    if (!mounted) return;
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    if (!isAdmin && !isClientAdmin) {
      toast.error("Access denied. Admin or Client Admin only.");
      router.push("/dashboard");
      return;
    }
  }, [router, isAdmin, isClientAdmin, mounted]);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      let url = "/roles";
      if (isClientAdmin && clientId) {
        url = `/roles?client_id=${clientId}`;
      }
      const response = await api.get(url);
      setRoles(response.data);
    } catch (error: any) {
      console.error("Error fetching roles:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch roles");
    } finally {
      setLoading(false);
    }
  }, [isClientAdmin, clientId]);

  const fetchServices = useCallback(async () => {
    try {
      let url = "/services";
      if (isClientAdmin && clientId) {
        url = `/clients/${clientId}/subscriptions/services`;
      }
      const response = await api.get(url);
      setServices(response.data);
    } catch (error: any) {
      console.error("Error fetching services:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch services");
    }
  }, [isClientAdmin, clientId]);

  const fetchRolePermissions = async (roleId: string) => {
    try {
      setLoadingPermissions(true);
      const response = await api.get(`/roles/${roleId}/permissions`);

      const permMap: Record<string, Permission> = {};
      response.data.forEach((p: Permission) => {
        permMap[p.service_id] = p;
      });

      const allPermissions = services.map((service) => {
        const existing = permMap[service.id];
        if (existing) return existing;
        return {
          service_id: service.id,
          can_create: false,
          can_read: false,
          can_update: false,
          can_delete: false,
        };
      });

      setPermissions(allPermissions);
    } catch (error: any) {
      console.error("Error fetching permissions:", error);
      toast.error(
        error.response?.data?.detail || "Failed to fetch permissions",
      );
    } finally {
      setLoadingPermissions(false);
    }
  };

  // Fetch roles and services when the component mounts and when the user role changes

  useEffect(() => {
    if (mounted && (isAdmin || isClientAdmin)) {
      fetchRoles();
      fetchServices();
    }
  }, [fetchRoles, fetchServices, mounted, isAdmin, isClientAdmin]);

  // When a role is selected, fetch its permissions

  useEffect(() => {
    if (selectedRole && services.length > 0) {
      fetchRolePermissions(selectedRole.id);
    }
  }, [selectedRole, services]);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newRole.name.trim()) {
      setNewRoleErrors({ name: "Role name is required" });
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: newRole.name.trim(),
        description: newRole.description.trim() || null,
      };

      if (isClientAdmin && clientId) {
        payload.client_id = clientId;
      }

      await api.post("/roles", payload);
      toast.success("Role created successfully");
      setShowCreateModal(false);
      setNewRole({ name: "", description: "" });
      setNewRoleErrors({ name: "" });
      fetchRoles();
    } catch (error: any) {
      console.error("Error creating role:", error);
      toast.error(error.response?.data?.detail || "Failed to create role");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    setSubmitting(true);
    try {
      await api.patch(`/roles/${selectedRole.id}/permissions`, {
        permissions: permissions,
      });
      toast.success("Permissions updated successfully");
      setShowEditModal(false);
      fetchRolePermissions(selectedRole.id);
    } catch (error: any) {
      console.error("Error updating permissions:", error);
      toast.error(
        error.response?.data?.detail || "Failed to update permissions",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPermissions = () => {
    const resetPermissions = services.map((service) => ({
      service_id: service.id,
      can_create: false,
      can_read: false,
      can_update: false,
      can_delete: false,
    }));
    setPermissions(resetPermissions);
    toast.success("Permissions reset to default");
  };

  const handleDeactivateRole = async () => {
    if (!selectedRole) return;
    setSubmitting(true);
    try {
      await api.delete(`/roles/${selectedRole.id}`);
      toast.success("Role deactivated successfully");
      setShowDeleteConfirm(false);
      fetchRoles();
    } catch (error: any) {
      console.error("Error deactivating role:", error);
      toast.error(error.response?.data?.detail || "Failed to deactivate role");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreRole = async () => {
    if (!selectedRole) return;
    setSubmitting(true);
    try {
      await api.patch(`/roles/${selectedRole.id}/restore`);
      toast.success("Role restored successfully");
      setShowRestoreConfirm(false);
      fetchRoles();
    } catch (error: any) {
      console.error("Error restoring role:", error);
      toast.error(error.response?.data?.detail || "Failed to restore role");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePermissionChange = (
    serviceId: string,
    field: keyof Omit<Permission, "service_id">,
    checked: boolean,
  ) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.service_id === serviceId ? { ...p, [field]: checked } : p,
      ),
    );
  };

  const handleExportCSV = () => {
    exportToCSV(
      filteredRoles,
      `roles_${new Date().toISOString().split("T")[0]}`,
    );
    setShowExportDropdown(false);
    toast.success("CSV exported successfully");
  };

  const handleExportExcel = () => {
    exportToExcel(
      filteredRoles,
      `roles_${new Date().toISOString().split("T")[0]}`,
    );
    setShowExportDropdown(false);
    toast.success("Excel exported successfully");
  };

  const filteredRoles = roles.filter((role) => {
    const matchesSearch =
      role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && role.is_active) ||
      (statusFilter === "deactivated" && !role.is_active);

    return matchesSearch && matchesStatus;
  });

  const activeCount = roles.filter((r) => r.is_active).length;
  const deactivatedCount = roles.filter((r) => !r.is_active).length;

  const viewModeLabels: Record<ViewMode, string> = {
    table: "📋 Table",
    grid: "📊 Grid",
  };

  if (!mounted) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAdmin && !isClientAdmin) {
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
        
        .role-card {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .role-card:hover {
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

        .role-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          font-weight: 400;
          min-width: 700px;
        }
        @media (min-width: 1024px) {
          .role-table {
            min-width: auto;
          }
        }
        .role-table thead th {
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
        .role-table tbody td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #1f2937;
          font-size: 14px;
          font-weight: 400;
        }
        .role-table tbody tr {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .role-table tbody tr:hover {
          background: #fef2f2;
        }
        .role-table tbody tr:active {
          background: #fecaca;
        }

        .role-table .description-cell {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        @media (min-width: 1024px) {
          .role-table .description-cell {
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

        .status-filter-btn {
          padding: 6px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          border: 1px solid #e2e8f0;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #64748b;
        }
        .status-filter-btn:hover {
          border-color: #dc2626;
          color: #dc2626;
        }
        .status-filter-btn.active {
          background: #dc2626;
          color: white;
          border-color: #dc2626;
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
        .input-icon-wrapper input,
        .input-icon-wrapper textarea,
        .input-icon-wrapper select {
          padding-left: 42px;
          padding-right: 12px;
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

        /* Responsive action buttons */
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
                    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" />
                  </svg>
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-800">
                  Roles & Permissions
                </h1>
              </div>
              <p className="text-gray-500 ml-14 pl-0.5 text-sm font-normal">
                {isClientAdmin
                  ? "Manage roles for your organization"
                  : "Manage roles and their permissions"}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
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

              {isAdmin && (
                <button
                  onClick={() => setShowCreateModal(true)}
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
                  <span>Create Role</span>
                </button>
              )}
            </div>
          </div>

          {/* Stats Cards - Compact */}
          {!loading && roles.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 fade-in-up">
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
                    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">
                    {roles.length}
                  </p>
                  <p className="text-sm font-medium text-gray-500">
                    Total Roles
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

          {/* Search & Filters */}
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
                placeholder="Search roles by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all shadow-sm text-gray-800 placeholder-gray-400 text-sm font-normal"
              />
            </div>
            <div className="flex gap-2">
              <button
                className={`status-filter-btn ${statusFilter === "all" ? "active" : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                All
              </button>
              <button
                className={`status-filter-btn ${statusFilter === "active" ? "active" : ""}`}
                onClick={() => setStatusFilter("active")}
              >
                Active
              </button>
              <button
                className={`status-filter-btn ${statusFilter === "deactivated" ? "active" : ""}`}
                onClick={() => setStatusFilter("deactivated")}
              >
                Deactivated
              </button>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* ─── Content ─── */}
          {!loading && (
            <>
              {viewMode === "grid" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredRoles.map((role, idx) => (
                    <div
                      key={role.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm role-card fade-in-up"
                      style={{ animationDelay: `${idx * 70}ms` }}
                      onClick={() => {
                        setSelectedRole(role);
                        setShowEditModal(true);
                      }}
                      onMouseEnter={() => setHoveredRow(role.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-50 to-white flex items-center justify-center shadow-sm border border-red-100/50">
                            <span className="text-red-600 font-bold text-xl">
                              {role.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${role.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                          >
                            {role.is_active ? "Active" : "Deactivated"}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg mb-1">
                          {role.name}
                        </h3>
                        {role.description && (
                          <p className="text-sm text-gray-500 font-normal">
                            {role.description}
                          </p>
                        )}
                        <div className="mt-3 text-right">
                          <span className="text-xs text-gray-400 font-normal">
                            Click to edit permissions →
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewMode === "table" && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in-up">
                  <div className="table-wrapper">
                    <table className="role-table">
                      <thead>
                        <tr>
                          <th>Role Name</th>
                          <th>Description</th>
                          {isAdmin && <th>Client ID</th>}
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRoles.length === 0 ? (
                          <tr>
                            <td
                              colSpan={isAdmin ? 5 : 4}
                              className="text-center py-12 text-gray-500 text-sm font-normal"
                            >
                              No roles found
                            </td>
                          </tr>
                        ) : (
                          filteredRoles.map((role) => (
                            <tr key={role.id}>
                              <td className="font-semibold text-gray-900 whitespace-nowrap">
                                {role.name}
                              </td>
                              <td className="description-cell text-gray-600">
                                {role.description || "—"}
                              </td>
                              {isAdmin && (
                                <td className="text-gray-600 text-sm font-mono whitespace-nowrap">
                                  {role.client_id || "—"}
                                </td>
                              )}
                              <td className="whitespace-nowrap">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${role.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                                >
                                  {role.is_active ? "Active" : "Deactivated"}
                                </span>
                              </td>
                              <td className="whitespace-nowrap">
                                <div className="action-buttons">
                                  <button
                                    onClick={() => {
                                      setSelectedRole(role);
                                      setShowEditModal(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-800 text-sm font-semibold whitespace-nowrap"
                                  >
                                    Edit Permissions
                                  </button>
                                  {role.is_active ? (
                                    <button
                                      onClick={() => {
                                        setSelectedRole(role);
                                        setShowDeleteConfirm(true);
                                      }}
                                      className="text-red-600 hover:text-red-800 text-sm font-semibold whitespace-nowrap"
                                    >
                                      Deactivate
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setSelectedRole(role);
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
          {!loading && filteredRoles.length === 0 && roles.length > 0 && (
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
                  <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                No roles match your filters
              </h3>
              <p className="text-gray-500 text-sm font-normal">
                Try adjusting your search or status filter
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Create Role Modal ─── */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Create New Role
                </h2>
                <p className="text-sm text-gray-400 mt-0.5 font-normal">
                  {isClientAdmin
                    ? "Create a role for your organization"
                    : "Create a new role"}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewRole({ name: "", description: "" });
                  setNewRoleErrors({ name: "" });
                }}
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

            <form onSubmit={handleCreateRole}>
              <div className="modal-grid-2">
                <div className="full-width">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Role Name <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🏷️</span>
                    <input
                      type="text"
                      value={newRole.name}
                      onChange={(e) => {
                        setNewRole({ ...newRole, name: e.target.value });
                        if (e.target.value.trim()) {
                          setNewRoleErrors({ ...newRoleErrors, name: "" });
                        }
                      }}
                      required
                      autoComplete="off"
                      className={`w-full px-4 py-2.5 pl-10 border ${newRoleErrors.name ? "border-red-500 focus:ring-red-500/50" : "border-gray-200 focus:ring-red-400/50"} rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal`}
                      placeholder="Asset Manager"
                    />
                  </div>
                  {newRoleErrors.name && (
                    <p className="text-red-500 text-xs mt-1.5 ml-1 font-normal">
                      {newRoleErrors.name}
                    </p>
                  )}
                </div>

                <div className="full-width">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Description
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon icon-top">📝</span>
                    <textarea
                      value={newRole.description}
                      onChange={(e) =>
                        setNewRole({
                          ...newRole,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all resize-none input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                      placeholder="Describe the purpose of this role..."
                    />
                  </div>
                </div>

                {isClientAdmin && clientId && (
                  <div className="full-width">
                    <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
                      <p className="text-sm text-gray-500 font-normal">
                        <span className="font-semibold">Organization:</span>{" "}
                        This role will be created for your client
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-6 mt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewRole({ name: "", description: "" });
                    setNewRoleErrors({ name: "" });
                  }}
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
                    "Create Role"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Permissions Modal ─── */}
      {showEditModal && selectedRole && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Edit Permissions: {selectedRole.name}
                </h2>
                <p className="text-sm text-gray-400 mt-0.5 font-normal">
                  {selectedRole.description || "No description"}
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

            {loadingPermissions ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-8 h-8 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
              </div>
            ) : (
              <form onSubmit={handleUpdatePermissions}>
                <div className="border border-gray-200 rounded-xl p-4 max-h-96 overflow-y-auto">
                  {services.length === 0 ? (
                    <p className="text-center text-gray-500 text-sm font-normal py-8">
                      {isClientAdmin
                        ? "No services subscribed to your organization"
                        : "No services available"}
                    </p>
                  ) : (
                    services.map((service) => {
                      const perm = permissions.find(
                        (p) => p.service_id === service.id,
                      );
                      return (
                        <div
                          key={service.id}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded-lg transition-all"
                        >
                          <span className="text-sm font-medium text-gray-700 min-w-[120px] mb-2 sm:mb-0">
                            {service.name}
                          </span>
                          <div className="flex flex-wrap gap-3 sm:gap-4">
                            {[
                              "can_create",
                              "can_read",
                              "can_update",
                              "can_delete",
                            ].map((field) => (
                              <label
                                key={field}
                                className="flex items-center gap-1.5 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={!!perm?.[field as keyof Permission]}
                                  onChange={(e) =>
                                    handlePermissionChange(
                                      service.id,
                                      field as keyof Omit<
                                        Permission,
                                        "service_id"
                                      >,
                                      e.target.checked,
                                    )
                                  }
                                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                />
                                <span className="text-xs text-gray-600 font-medium">
                                  {field.replace("can_", "").toUpperCase()}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleResetPermissions}
                    className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm order-2 sm:order-1"
                  >
                    Reset to Default
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm order-1 sm:order-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md order-3"
                  >
                    {submitting ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Save Permissions"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {showDeleteConfirm && selectedRole && (
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
                Deactivate Role?
              </h3>
              <p className="text-gray-500 text-sm mb-4 font-normal">
                Are you sure you want to deactivate{" "}
                <span className="font-semibold text-gray-700">
                  {selectedRole.name}
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
                  onClick={handleDeactivateRole}
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
      {showRestoreConfirm && selectedRole && (
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
                Restore Role?
              </h3>
              <p className="text-gray-500 text-sm mb-4 font-normal">
                Are you sure you want to restore{" "}
                <span className="font-semibold text-gray-700">
                  {selectedRole.name}
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
                  onClick={handleRestoreRole}
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
