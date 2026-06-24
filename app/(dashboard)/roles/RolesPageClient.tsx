"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import api from "@/app/lib/api";
import styles from "./RolesPage.module.css";

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

// ─── Helper: Export to CSV ──────────────────────────────────────────────────
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

// ─── Helper: Export to Excel ────────────────────────────────────────────────
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

export default function RolesPageClient() {
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
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "deactivated">("all");
  const [isClient, setIsClient] = useState(false);

  // New role form state
  const [newRole, setNewRole] = useState({
    name: "",
    description: "",
  });
  const [newRoleErrors, setNewRoleErrors] = useState({
    name: "",
  });

  const exportButtonRef = useRef<HTMLButtonElement>(null);

  // Only run these on the client
  const userRole = isClient ? getUserRoleFromToken() : "";
  const clientId = isClient ? getClientIdFromToken() : "";
  const isAdmin = userRole === "ADMIN";
  const isClientAdmin = userRole === "CLIENT_ADMIN";

  // ─── Set mounted and client state ─────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    setIsClient(true);
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

  // ─── Redirect if not ADMIN or CLIENT_ADMIN ────────────────────────────────
  useEffect(() => {
    if (!isClient) return;
    
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
  }, [router, isAdmin, isClientAdmin, isClient]);

  // ─── Fetch Roles with client filtering ────────────────────────────────────
  const fetchRoles = useCallback(async () => {
    if (!isClient) return;
    
    try {
      setLoading(true);
      // Build URL with client_id filter for CLIENT_ADMIN
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
  }, [isClientAdmin, clientId, isClient]);

  // ─── Fetch Services ────────────────────────────────────────────────────────
  const fetchServices = useCallback(async () => {
    if (!isClient) return;
    
    try {
      let url = "/services";
      // If client admin, only get subscribed services
      if (isClientAdmin && clientId) {
        url = `/clients/${clientId}/subscriptions/services`;
      }
      const response = await api.get(url);
      setServices(response.data);
    } catch (error: any) {
      console.error("Error fetching services:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch services");
    }
  }, [isClientAdmin, clientId, isClient]);

  // ─── Fetch Permissions for a Role ─────────────────────────────────────────
  const fetchRolePermissions = async (roleId: string) => {
    try {
      setLoadingPermissions(true);
      const response = await api.get(`/roles/${roleId}/permissions`);
      
      // Build full permission object for all services
      const permMap: Record<string, Permission> = {};
      response.data.forEach((p: Permission) => {
        permMap[p.service_id] = p;
      });

      // Ensure all services have permission entries
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
      toast.error(error.response?.data?.detail || "Failed to fetch permissions");
    } finally {
      setLoadingPermissions(false);
    }
  };

  // ─── Initial data fetch ────────────────────────────────────────────────────
  useEffect(() => {
    if (isClient) {
      fetchRoles();
      fetchServices();
    }
  }, [fetchRoles, fetchServices, isClient]);

  // ─── When a role is selected, fetch its permissions ──────────────────────
  useEffect(() => {
    if (selectedRole && services.length > 0) {
      fetchRolePermissions(selectedRole.id);
    }
  }, [selectedRole, services]);

  // ─── Create New Role ──────────────────────────────────────────────────────
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
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
      
      // If client admin, attach client_id
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

  // ─── Update Permissions ────────────────────────────────────────────────────
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
      // Refresh permissions
      fetchRolePermissions(selectedRole.id);
    } catch (error: any) {
      console.error("Error updating permissions:", error);
      toast.error(error.response?.data?.detail || "Failed to update permissions");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Reset Permissions to Default (all false) ────────────────────────────
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

  // ─── Deactivate Role ──────────────────────────────────────────────────────
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

  // ─── Restore Role ──────────────────────────────────────────────────────────
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

  // ─── Handle Permission Checkbox Change ────────────────────────────────────
  const handlePermissionChange = (
    serviceId: string,
    field: keyof Omit<Permission, 'service_id'>,
    checked: boolean
  ) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.service_id === serviceId ? { ...p, [field]: checked } : p
      )
    );
  };

  // ─── Export Handlers ──────────────────────────────────────────────────────
  const handleExportCSV = () => {
    exportToCSV(filteredRoles, `roles_${new Date().toISOString().split("T")[0]}`);
    setShowExportDropdown(false);
    toast.success("CSV exported successfully");
  };

  const handleExportExcel = () => {
    exportToExcel(filteredRoles, `roles_${new Date().toISOString().split("T")[0]}`);
    setShowExportDropdown(false);
    toast.success("Excel exported successfully");
  };

  // ─── Filter roles ─────────────────────────────────────────────────────────
  const filteredRoles = roles.filter((role) => {
    // Search filter
    const matchesSearch = role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === "all" ||
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

  // Show loading while checking auth
  if (!isClient) {
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
    <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-red-100/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className={`flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 ${styles.fadeInUp}`}>
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
              {isClientAdmin ? "Manage roles for your organization" : "Manage roles and their permissions"}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* View Toggle */}
            <div className="flex bg-white/80 backdrop-blur-sm rounded-xl border border-gray-100 p-1 shadow-sm">
              {(["table", "grid"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`${styles.viewToggleBtn} ${viewMode === mode ? styles.viewToggleBtnActive : ""}`}
                  onClick={() => setViewMode(mode)}
                >
                  {viewModeLabels[mode]}
                </button>
              ))}
            </div>

            {/* Create Role Button - Only for ADMIN */}
            {isAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create Role
              </button>
            )}

            {/* Export Button */}
            <div className="relative">
              <button
                ref={exportButtonRef}
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showExportDropdown && mounted && dropdownPosition && (
                createPortal(
                  <div 
                    className="fixed bg-white rounded-xl shadow-2xl border border-gray-100 py-1"
                    style={{
                      zIndex: 999999,
                      minWidth: '180px',
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                      transform: 'translateX(-50%)',
                      animation: 'fadeInUp 0.2s ease',
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
                  document.body
                )
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {!loading && roles.length > 0 && (
          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6 ${styles.fadeInUp}`}>
            <div className={`${styles.statCard} p-4 flex items-center gap-4`}>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8">
                  <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">{roles.length}</p>
                <p className="text-sm font-medium text-gray-500">Total Roles</p>
              </div>
            </div>
            <div className={`${styles.statCard} p-4 flex items-center gap-4`}>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">{activeCount}</p>
                <p className="text-sm font-medium text-gray-500">Active</p>
              </div>
            </div>
            <div className={`${styles.statCard} p-4 flex items-center gap-4`}>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8">
                  <path d="M12 8v4l3 3" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">{deactivatedCount}</p>
                <p className="text-sm font-medium text-gray-500">Deactivated</p>
              </div>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 ${styles.fadeInUp}`}>
          <div className="relative max-w-md w-full">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search roles by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all shadow-sm text-gray-800 placeholder-gray-500 text-sm font-normal"
            />
          </div>
          <div className="flex gap-2">
            <button
              className={`${styles.statusFilterBtn} ${statusFilter === "all" ? styles.statusFilterBtnActive : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All
            </button>
            <button
              className={`${styles.statusFilterBtn} ${statusFilter === "active" ? styles.statusFilterBtnActive : ""}`}
              onClick={() => setStatusFilter("active")}
            >
              Active
            </button>
            <button
              className={`${styles.statusFilterBtn} ${statusFilter === "deactivated" ? styles.statusFilterBtnActive : ""}`}
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
                    className={`bg-white rounded-xl border border-gray-100 shadow-sm ${styles.roleCard} ${styles.fadeInUp}`}
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
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${styles.fadeInUp}">
                <div className="overflow-x-auto">
                  <table className={styles.roleTable}>
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
                          <td colSpan={isAdmin ? 5 : 4} className="text-center py-12 text-gray-500 text-sm font-normal">
                            No roles found
                          </td>
                        </tr>
                      ) : (
                        filteredRoles.map((role) => (
                          <tr key={role.id}>
                            <td className="font-semibold text-gray-900">{role.name}</td>
                            <td className="text-gray-600">{role.description || "—"}</td>
                            {isAdmin && (
                              <td className="text-gray-600 text-sm font-mono">{role.client_id || "—"}</td>
                            )}
                            <td>
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${role.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                              >
                                {role.is_active ? "Active" : "Deactivated"}
                              </span>
                            </td>
                            <td>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedRole(role);
                                    setShowEditModal(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                                >
                                  Edit Permissions
                                </button>
                                {role.is_active ? (
                                  <button
                                    onClick={() => {
                                      setSelectedRole(role);
                                      setShowDeleteConfirm(true);
                                    }}
                                    className="text-red-600 hover:text-red-800 text-sm font-semibold"
                                  >
                                    Deactivate
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setSelectedRole(role);
                                      setShowRestoreConfirm(true);
                                    }}
                                    className="text-green-600 hover:text-green-800 text-sm font-semibold"
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
          <div className={`text-center py-20 ${styles.fadeInUp}`}>
            <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
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

      {/* ─── Create Role Modal ─── */}
      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div className={`${styles.modalContent} ${styles.createModal}`} onClick={(e) => e.stopPropagation()}>
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Create New Role
                  </h2>
                  <p className="text-sm text-gray-400 font-normal">
                    {isClientAdmin ? "Create a role for your organization" : "Create a new role"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewRole({ name: "", description: "" });
                    setNewRoleErrors({ name: "" });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateRole}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Role Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newRole.name}
                      onChange={(e) => {
                        setNewRole({ ...newRole, name: e.target.value });
                        if (e.target.value.trim()) {
                          setNewRoleErrors({ ...newRoleErrors, name: "" });
                        }
                      }}
                      placeholder="e.g., Asset Manager, Auditor, Admin"
                      className={`w-full px-4 py-3 border ${newRoleErrors.name ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all text-gray-800 text-sm font-normal`}
                    />
                    {newRoleErrors.name && (
                      <p className="text-red-500 text-xs mt-1">{newRoleErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newRole.description}
                      onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                      placeholder="Describe the purpose of this role..."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all text-gray-800 text-sm font-normal resize-none"
                    />
                  </div>

                  {isClientAdmin && clientId && (
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <p className="text-sm text-gray-600 font-normal">
                        <span className="font-semibold">Organization:</span> This role will be created for your client (ID: {clientId.substring(0, 8)}...)
                      </p>
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
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
                  >
                    {submitting ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Create Role"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Permissions Modal ─── */}
      {showEditModal && selectedRole && (
        <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Edit Permissions: {selectedRole.name}
                  </h2>
                  <p className="text-sm text-gray-400 font-normal">
                    {selectedRole.description || "No description"}
                  </p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
                <form onSubmit={handleUpdatePermissions} className="space-y-4">
                  <div className="border border-gray-200 rounded-xl p-4 max-h-96 overflow-y-auto">
                    {services.length === 0 ? (
                      <p className="text-center text-gray-500 text-sm font-normal">
                        {isClientAdmin ? "No services subscribed to your organization" : "No services available"}
                      </p>
                    ) : (
                      services.map((service) => {
                        const perm = permissions.find(
                          (p) => p.service_id === service.id
                        );
                        return (
                          <div
                            key={service.id}
                            className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded-lg transition-all"
                          >
                            <span className="text-sm font-medium text-gray-700 min-w-[120px]">
                              {service.name}
                            </span>
                            <div className="flex gap-4">
                              {['can_create', 'can_read', 'can_update', 'can_delete'].map((field) => (
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
                                        field as keyof Omit<Permission, 'service_id'>,
                                        e.target.checked
                                      )
                                    }
                                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                  />
                                  <span className="text-xs text-gray-600 font-medium">
                                    {field.replace('can_', '').toUpperCase()}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleResetPermissions}
                      className="px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm"
                    >
                      Reset to Default
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
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
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedRole && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div className={`${styles.modalContent} ${styles.deleteModal}`} onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
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
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivateRole}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm"
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

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && selectedRole && (
        <div className={styles.modalOverlay} onClick={() => setShowRestoreConfirm(false)}>
          <div className={`${styles.modalContent} ${styles.deleteModal}`} onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
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
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestoreRole}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm"
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
    </div>
  );
}