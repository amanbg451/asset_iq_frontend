"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { z } from "zod";
import api, { formatValidationError } from "@/app/lib/api";

interface AuditSession {
  id: string;
  scheduled_date: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  assigned_to: string;
  started_at: string | null;
  completed_at: string | null;
  total_assets: number;
  audited_assets: number;
  tracking_session_id: string | null;
}

interface Audit {
  id: string;
  name: string;
  description: string;
  auditor_id: string;
  auditor_name: string;
  frequency_unit: "DAY" | "WEEK" | "MONTH";
  frequency_interval: number;
  start_date: string;
  end_date: string;
  next_run_date: string;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
  created_at: string;
  sessions: AuditSession[];
}

interface DashboardStats {
  total_audits: number;
  active_audits: number;
  completed_sessions: number;
  pending_sessions: number;
  in_progress_sessions: number;
  total_assets: number;
  audited_assets: number;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

interface Department {
  id: string;
  name: string;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
  is_active: boolean;
}

interface Asset {
  id: string;
  name: string;
  serial_number: string;
  category_id: string;
  type_id: string;
  department_id: string | null;
  location_id: string | null;
  assigned_to_user_id: string | null;
  status: string;
  is_active: boolean;
  created_image_url: string | null;
}

type TargetType = "DEPARTMENT" | "CATEGORY" | "ASSET";

interface Target {
  target_type: TargetType;
  target_id: string;
}

type FormStatus = "ACTIVE" | "INACTIVE";

interface FormState {
  name: string;
  description: string;
  auditor_id: string;
  frequency_unit: "DAY" | "WEEK" | "MONTH";
  frequency_interval: number;
  start_date: string;
  end_date: string;
  status: FormStatus;
  targets: Target[];
}

const auditSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(200, "Name must be at most 200 characters"),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .default(""),
  auditor_id: z.string().min(1, "Please select an auditor"),
  frequency_unit: z.enum(["DAY", "WEEK", "MONTH"]),
  frequency_interval: z.number().min(1, "Interval must be at least 1"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED"]),
  targets: z
    .array(
      z.object({
        target_type: z.enum(["DEPARTMENT", "CATEGORY", "ASSET"]),
        target_id: z.string().min(1, "Target is required"),
      }),
    )
    .min(1, "At least one target is required"),
});

export default function AuditsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Data states
  const [audits, setAudits] = useState<Audit[]>([]);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  // UI states
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);

  // Form states
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormState>({
    name: "",
    description: "",
    auditor_id: "",
    frequency_unit: "WEEK",
    frequency_interval: 1,
    start_date: "",
    end_date: "",
    status: "ACTIVE",
    targets: [{ target_type: "DEPARTMENT", target_id: "" }],
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [editFormData, setEditFormData] = useState<FormState>({
    name: "",
    description: "",
    auditor_id: "",
    frequency_unit: "WEEK",
    frequency_interval: 1,
    start_date: "",
    end_date: "",
    status: "ACTIVE",
    targets: [{ target_type: "DEPARTMENT", target_id: "" }],
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const fetchAudits = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/audits");
      setAudits(response.data?.items || []);
    } catch (error: any) {
      console.error("Error fetching audits:", error);
      toast.error(formatValidationError(error) || "Failed to fetch audits");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await api.get("/audits/dashboard");
      setDashboard(response.data || null);
    } catch (error: any) {
      console.error("Error fetching dashboard:", error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get("/users");
      const activeUsers = (response.data || []).filter(
        (u: User) => u.is_active !== false,
      );
      setUsers(activeUsers);
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.warn("Users fetch skipped - insufficient permissions");
        setUsers([]);
        return;
      }
      console.error("Error fetching users:", error);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await api.get("/departments");
      const activeDepts = (response.data || []).filter(
        (d: Department) => d.is_active !== false,
      );
      setDepartments(activeDepts);
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.warn("Departments fetch skipped - insufficient permissions");
        setDepartments([]);
        return;
      }
      console.error("Error fetching departments:", error);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get("/asset-categories");
      const activeCategories = (response.data || []).filter(
        (c: Category) => c.is_active !== false,
      );
      setCategories(activeCategories);
    } catch (error: any) {
      console.error("Error fetching categories:", error);
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const response = await api.get("/assets");
      setAssets(response.data || []);
    } catch (error: any) {
      console.error("Error fetching assets:", error);
    }
  }, []);

  // ============= INITIAL LOAD =============

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }

    Promise.all([
      fetchAudits(),
      fetchDashboard(),
      fetchUsers(),
      fetchDepartments(),
      fetchCategories(),
      fetchAssets(),
    ]);
  }, [
    mounted,
    router,
    fetchAudits,
    fetchDashboard,
    fetchUsers,
    fetchDepartments,
    fetchCategories,
    fetchAssets,
  ]);

  // ============= CRUD OPERATIONS =============

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      auditor_id: "",
      frequency_unit: "WEEK",
      frequency_interval: 1,
      start_date: "",
      end_date: "",
      status: "ACTIVE",
      targets: [{ target_type: "DEPARTMENT", target_id: "" }],
    });
    setFormErrors({});
  };

  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate dates
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      if (end < start) {
        toast.error("End date must be after start date");
        return;
      }
    }

    // Get client_id from localStorage or JWT
    let clientId = "28de6c32-2d60-4abf-a978-24323b7546c8"; // Default from your token
    try {
      const token = localStorage.getItem("access_token");
      if (token) {
        const parts = token.split(".");
        if (parts.length > 1) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.client_id) clientId = payload.client_id;
        }
      }
    } catch (e) {
      console.warn("Could not parse client_id from token");
    }

    const payload = {
      client_id: clientId,
      ...formData,
    };

    const result = auditSchema.safeParse(payload);
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
      await api.post("/audits", payload);
      toast.success("Audit created successfully");
      setShowCreateModal(false);
      resetForm();
      fetchAudits();
      fetchDashboard();
    } catch (error: any) {
      console.error("Error creating audit:", error);
      toast.error(formatValidationError(error) || "Failed to create audit");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (audit: Audit) => {
    setSelectedAudit(audit);
    // Convert status to FormStatus (ACTIVE/INACTIVE only for editing)
    const status = audit.status === "COMPLETED" ? "INACTIVE" : audit.status;
    setEditFormData({
      name: audit.name,
      description: audit.description || "",
      auditor_id: audit.auditor_id,
      frequency_unit: audit.frequency_unit,
      frequency_interval: audit.frequency_interval,
      start_date: audit.start_date,
      end_date: audit.end_date,
      status: status as FormStatus,
      targets: [{ target_type: "DEPARTMENT", target_id: "" }],
    });
    setEditErrors({});
    setShowEditModal(true);
  };

  const handleUpdateAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAudit) return;

    if (editFormData.start_date && editFormData.end_date) {
      const start = new Date(editFormData.start_date);
      const end = new Date(editFormData.end_date);
      if (end < start) {
        toast.error("End date must be after start date");
        return;
      }
    }

    const result = auditSchema.safeParse(editFormData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });
      setEditErrors(errors);
      toast.error(result.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/audits/${selectedAudit.id}`, editFormData);
      toast.success("Audit updated successfully");
      setShowEditModal(false);
      setSelectedAudit(null);
      fetchAudits();
      fetchDashboard();
    } catch (error: any) {
      console.error("Error updating audit:", error);
      toast.error(formatValidationError(error) || "Failed to update audit");
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteConfirm = (audit: Audit) => {
    setSelectedAudit(audit);
    setShowDeleteConfirm(true);
  };

  const handleDeleteAudit = async () => {
    if (!selectedAudit) return;

    setSubmitting(true);
    try {
      await api.delete(`/audits/${selectedAudit.id}`);
      toast.success("Audit deleted successfully");
      setShowDeleteConfirm(false);
      setSelectedAudit(null);
      fetchAudits();
      fetchDashboard();
    } catch (error: any) {
      console.error("Error deleting audit:", error);
      toast.error(formatValidationError(error) || "Failed to delete audit");
    } finally {
      setSubmitting(false);
    }
  };

  // ============= HELPER FUNCTIONS =============

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-700",
      INACTIVE: "bg-gray-100 text-gray-700",
      COMPLETED: "bg-blue-100 text-blue-700",
      PENDING: "bg-yellow-100 text-yellow-700",
      IN_PROGRESS: "bg-purple-100 text-purple-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const getFrequencyLabel = (unit: string, interval: number) => {
    const labels: Record<string, string> = {
      DAY: `Every ${interval} day${interval > 1 ? "s" : ""}`,
      WEEK: `Every ${interval} week${interval > 1 ? "s" : ""}`,
      MONTH: `Every ${interval} month${interval > 1 ? "s" : ""}`,
    };
    return labels[unit] || `${interval} ${unit}`;
  };

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user ? user.full_name : "Unknown";
  };

  const getDepartmentName = (departmentId: string) => {
    const dept = departments.find((d) => d.id === departmentId);
    return dept ? dept.name : "Unknown";
  };

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    return cat ? cat.name : "Unknown";
  };

  const getAssetName = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    return asset ? asset.name : "Unknown";
  };

  // ============= FILTERING =============

  const filteredAudits = audits.filter((audit) => {
    const matchesSearch =
      audit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      audit.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      audit.auditor_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "" || audit.status === statusFilter;
    const matchesActive = showInactive
      ? audit.status === "INACTIVE"
      : audit.status === "ACTIVE" || audit.status === "COMPLETED";
    return matchesSearch && matchesStatus && matchesActive;
  });

  // ============= RENDER =============

  if (!mounted) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Helper to get options based on target type
  const getTargetOptions = (targetType: TargetType) => {
    if (targetType === "DEPARTMENT") return departments;
    if (targetType === "CATEGORY") return categories;
    if (targetType === "ASSET") return assets;
    return [];
  };

  const getTargetLabel = (targetType: TargetType) => {
    if (targetType === "DEPARTMENT") return "department";
    if (targetType === "CATEGORY") return "category";
    if (targetType === "ASSET") return "asset";
    return "";
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
          .modal-content { padding: 28px 32px 32px; }
        }
        .modal-content::-webkit-scrollbar {
          width: 6px;
        }
        .modal-content::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 20px;
        }
        .modal-content::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #dc2626, #ef4444);
          border-radius: 20px;
        }

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

        .input-fancy {
          transition: all 0.2s ease;
          background: #fafbfc;
        }
        .input-fancy:focus {
          background: white;
          transform: scale(1.01);
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
        }
        .input-icon-wrapper .icon-top {
          top: 16px;
          transform: none;
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
        .input-icon-wrapper select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 40px;
        }

        .status-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 600;
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
        .action-btn.view:hover {
          background: #dbeafe;
          color: #2563eb;
        }
        .action-btn.edit:hover {
          background: #dbeafe;
          color: #2563eb;
        }
        .action-btn.delete:hover {
          background: #fee2e2;
          color: #dc2626;
        }

        .filter-select {
          padding: 8px 14px;
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

        .table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
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
        }

        .audit-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          min-width: 1000px;
        }
        .audit-table thead th {
          text-align: left;
          padding: 10px 16px;
          font-weight: 600;
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid #f1f5f9;
          background: #fafbfc;
          white-space: nowrap;
        }
        .audit-table tbody td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #1f2937;
          font-size: 14px;
          vertical-align: middle;
        }
        .audit-table tbody tr {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .audit-table tbody tr:hover {
          background: #fef2f2;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
        }

        .search-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
          align-items: center;
        }
        .search-filters .search-input {
          flex: 1;
          min-width: 200px;
        }
        .search-filters .filter-group {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .action-cell {
          display: flex;
          gap: 4px;
          justify-content: flex-end;
        }

        .target-badge {
          display: inline-block;
          padding: 1px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
          background: #f1f5f9;
          color: #475569;
        }

        .delete-modal { max-width: 440px; }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white">
        {/* Background decorative elements */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-100/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {/* ===== HEADER ===== */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 fade-in-up">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md flex-shrink-0">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">Audits</h1>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Manage and monitor audit plans
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="cursor-pointer group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
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
              <span>Create Audit</span>
            </button>
          </div>

          {/* ===== DASHBOARD STATS ===== */}
          {dashboard && (
            <div className="stats-grid fade-in-up">
              <div className="stat-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="1.8"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">
                    {dashboard.total_audits}
                  </p>
                  <p className="text-sm font-medium text-gray-500">
                    Total Audits
                  </p>
                </div>
              </div>
              <div className="stat-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="20"
                    height="20"
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
                    {dashboard.active_audits}
                  </p>
                  <p className="text-sm font-medium text-gray-500">Active</p>
                </div>
              </div>
              <div className="stat-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-100 to-yellow-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#eab308"
                    strokeWidth="1.8"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">
                    {dashboard.pending_sessions}
                  </p>
                  <p className="text-sm font-medium text-gray-500">
                    Pending Sessions
                  </p>
                </div>
              </div>
              <div className="stat-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="1.8"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">
                    {dashboard.completed_sessions}
                  </p>
                  <p className="text-sm font-medium text-gray-500">Completed</p>
                </div>
              </div>
            </div>
          )}

          {/* ===== SEARCH & FILTERS ===== */}
          <div className="search-filters fade-in-up">
            <div className="search-input relative">
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
                placeholder="Search audits..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all shadow-sm text-gray-800 placeholder-gray-400 text-sm"
              />
            </div>
            <div className="filter-group">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="COMPLETED">Completed</option>
              </select>
              <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-4 py-1.5 rounded-xl shadow-sm border border-gray-100">
                <span
                  className={`text-sm font-medium ${!showInactive ? "text-red-600" : "text-gray-500"}`}
                >
                  Active
                </span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={() => setShowInactive(!showInactive)}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span
                  className={`text-sm font-medium ${showInactive ? "text-red-600" : "text-gray-500"}`}
                >
                  Inactive
                </span>
              </div>
            </div>
          </div>

          {/* ===== TABLE ===== */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in-up">
              <div className="table-wrapper">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Auditor</th>
                      <th>Frequency</th>
                      <th>Next Run</th>
                      <th>Sessions</th>
                      <th>Targets</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudits.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-center py-12 text-gray-500"
                        >
                          {searchTerm || statusFilter
                            ? "No audits match your filters"
                            : "No audits found. Create your first audit!"}
                        </td>
                      </tr>
                    ) : (
                      filteredAudits.map((audit) => (
                        <tr
                          key={audit.id}
                          onClick={() => router.push(`/audits/${audit.id}`)}
                        >
                          <td>
                            <div>
                              <div className="font-semibold text-gray-900">
                                {audit.name}
                              </div>
                              {audit.description && (
                                <div className="text-xs text-gray-400 truncate max-w-[200px]">
                                  {audit.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>{audit.auditor_name}</td>
                          <td>
                            <span className="text-sm">
                              {getFrequencyLabel(
                                audit.frequency_unit,
                                audit.frequency_interval,
                              )}
                            </span>
                          </td>
                          <td>
                            <span className="text-sm">
                              {new Date(
                                audit.next_run_date,
                              ).toLocaleDateString()}
                            </span>
                          </td>
                          <td>
                            <span className="text-sm">
                              {audit.sessions?.length || 0}
                            </span>
                          </td>
                          <td>
                            <span className="target-badge">
                              {audit.sessions?.length || 0} targets
                            </span>
                          </td>
                          <td>
                            <span
                              className={`status-badge ${getStatusBadge(audit.status)}`}
                            >
                              {audit.status}
                            </span>
                          </td>
                          <td>
                            <div
                              className="action-cell"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() =>
                                  router.push(`/audits/${audit.id}`)
                                }
                                className="action-btn view"
                                title="View Details"
                              >
                                <svg
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openEditModal(audit)}
                                className="action-btn edit"
                                title="Edit"
                              >
                                <svg
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openDeleteConfirm(audit)}
                                className="action-btn delete"
                                title="Delete"
                              >
                                <svg
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M3 6h18" />
                                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                </svg>
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
        </div>
      </div>

      {/* ===== CREATE AUDIT MODAL ===== */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Create Audit
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Create a new audit plan
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 flex-shrink-0"
              >
                <svg
                  width="18"
                  height="18"
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

            <form onSubmit={handleCreateAudit}>
              <div className="space-y-4">
                {/* Audit Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Audit Name <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📋</span>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        if (formErrors.name)
                          setFormErrors({ ...formErrors, name: "" });
                      }}
                      required
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm ${
                        formErrors.name
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="Monthly IT Audit"
                    />
                  </div>
                  {formErrors.name && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {formErrors.name}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Description
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon icon-top">📝</span>
                    <textarea
                      value={formData.description}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        });
                        if (formErrors.description)
                          setFormErrors({ ...formErrors, description: "" });
                      }}
                      rows={2}
                      className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all resize-none input-fancy text-gray-800 placeholder-gray-400 text-sm"
                      placeholder="Optional description"
                    />
                  </div>
                  {formErrors.description && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {formErrors.description}
                    </p>
                  )}
                </div>

                {/* Auditor */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Auditor <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">👤</span>
                    <select
                      value={formData.auditor_id}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          auditor_id: e.target.value,
                        });
                        if (formErrors.auditor_id)
                          setFormErrors({ ...formErrors, auditor_id: "" });
                      }}
                      required
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-sm ${
                        formErrors.auditor_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                    >
                      <option value="">Select Auditor</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formErrors.auditor_id && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {formErrors.auditor_id}
                    </p>
                  )}
                </div>

                {/* Frequency */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Frequency Unit <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🔄</span>
                      <select
                        value={formData.frequency_unit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            frequency_unit: e.target.value as any,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all bg-white text-gray-800 text-sm"
                      >
                        <option value="DAY">Daily</option>
                        <option value="WEEK">Weekly</option>
                        <option value="MONTH">Monthly</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Interval <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🔢</span>
                      <input
                        type="number"
                        min="1"
                        value={formData.frequency_interval}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            frequency_interval: parseInt(e.target.value) || 1,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all input-fancy text-gray-800 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📅</span>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            start_date: e.target.value,
                          });
                          if (formErrors.start_date)
                            setFormErrors({ ...formErrors, start_date: "" });
                        }}
                        required
                        className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 text-sm ${
                          formErrors.start_date
                            ? "border-red-500 focus:ring-red-400/50"
                            : "border-gray-200 focus:ring-red-400/50"
                        }`}
                      />
                    </div>
                    {formErrors.start_date && (
                      <p className="text-red-500 text-xs mt-1.5 font-medium">
                        {formErrors.start_date}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📅</span>
                      <input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            end_date: e.target.value,
                          });
                          if (formErrors.end_date)
                            setFormErrors({ ...formErrors, end_date: "" });
                        }}
                        required
                        className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 text-sm ${
                          formErrors.end_date
                            ? "border-red-500 focus:ring-red-400/50"
                            : "border-gray-200 focus:ring-red-400/50"
                        }`}
                      />
                    </div>
                    {formErrors.end_date && (
                      <p className="text-red-500 text-xs mt-1.5 font-medium">
                        {formErrors.end_date}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Status
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📊</span>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as FormStatus,
                        })
                      }
                      className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all bg-white text-gray-800 text-sm"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Targets - Fixed TypeScript errors */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Targets <span className="text-red-500">*</span>
                  </label>
                  {formData.targets.map((target, index) => {
                    const targetType = target.target_type;
                    const options = getTargetOptions(targetType);
                    const label = getTargetLabel(targetType);

                    return (
                      <div key={index} className="grid grid-cols-2 gap-3 mb-2">
                        <select
                          value={targetType}
                          onChange={(e) => {
                            const newTargets = [...formData.targets];
                            newTargets[index] = {
                              target_type: e.target.value as TargetType,
                              target_id: "",
                            };
                            setFormData({ ...formData, targets: newTargets });
                          }}
                          className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all bg-white text-gray-800 text-sm"
                        >
                          <option value="DEPARTMENT">Department</option>
                          <option value="CATEGORY">Category</option>
                          <option value="ASSET">Asset</option>
                        </select>
                        <select
                          value={target.target_id}
                          onChange={(e) => {
                            const newTargets = [...formData.targets];
                            newTargets[index].target_id = e.target.value;
                            setFormData({ ...formData, targets: newTargets });
                          }}
                          className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all bg-white text-gray-800 text-sm"
                        >
                          <option value="">Select {label}</option>
                          {options.map((item: any) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                  {formData.targets.length < 5 && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          targets: [
                            ...formData.targets,
                            { target_type: "DEPARTMENT", target_id: "" },
                          ],
                        })
                      }
                      className="text-sm text-red-600 hover:text-red-700 font-medium mt-1"
                    >
                      + Add Target
                    </button>
                  )}
                  {formErrors.targets && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {formErrors.targets}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md order-1 sm:order-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Creating...
                    </>
                  ) : (
                    "Create Audit"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== EDIT AUDIT MODAL ===== */}
      {showEditModal && selectedAudit && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Edit Audit</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Update audit plan
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 flex-shrink-0"
              >
                <svg
                  width="18"
                  height="18"
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

            <form onSubmit={handleUpdateAudit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Audit Name <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📋</span>
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          name: e.target.value,
                        });
                        if (editErrors.name)
                          setEditErrors({ ...editErrors, name: "" });
                      }}
                      required
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 text-sm ${
                        editErrors.name
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                    />
                  </div>
                  {editErrors.name && (
                    <p className="text-red-500 text-xs mt-1.5">
                      {editErrors.name}
                    </p>
                  )}
                </div>

                <div>
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
                      rows={2}
                      className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all resize-none input-fancy text-gray-800 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Auditor <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">👤</span>
                    <select
                      value={editFormData.auditor_id}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          auditor_id: e.target.value,
                        })
                      }
                      required
                      className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all bg-white text-gray-800 text-sm"
                    >
                      <option value="">Select Auditor</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Frequency Unit
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🔄</span>
                      <select
                        value={editFormData.frequency_unit}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            frequency_unit: e.target.value as any,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all bg-white text-gray-800 text-sm"
                      >
                        <option value="DAY">Daily</option>
                        <option value="WEEK">Weekly</option>
                        <option value="MONTH">Monthly</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Interval
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🔢</span>
                      <input
                        type="number"
                        min="1"
                        value={editFormData.frequency_interval}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            frequency_interval: parseInt(e.target.value) || 1,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all input-fancy text-gray-800 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Start Date
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📅</span>
                      <input
                        type="date"
                        value={editFormData.start_date}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            start_date: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all input-fancy text-gray-800 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      End Date
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📅</span>
                      <input
                        type="date"
                        value={editFormData.end_date}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            end_date: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all input-fancy text-gray-800 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Status
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📊</span>
                    <select
                      value={editFormData.status}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          status: e.target.value as FormStatus,
                        })
                      }
                      className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all bg-white text-gray-800 text-sm"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md order-1 sm:order-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Updating...
                    </>
                  ) : (
                    "Update Audit"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRMATION ===== */}
      {showDeleteConfirm && selectedAudit && (
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
                Delete Audit?
              </h3>
              <p className="text-gray-500 text-sm mb-2">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-700">
                  {selectedAudit.name}
                </span>
                ?
              </p>
              <p className="text-xs text-gray-400 mb-6">
                This action can be reversed.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAudit}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md order-1 sm:order-2"
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Yes, Delete"
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
