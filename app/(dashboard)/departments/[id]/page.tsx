"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import { z } from "zod";
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
  phone: string;
  role: string;
  is_active: boolean;
}

// ZOD VALIDATION SCHEMAS

const departmentSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(20, "Code must be at most 20 characters")
    .regex(
      /^[A-Z0-9_]+$/,
      "Code must contain only uppercase letters, numbers, and underscores",
    ),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .default(""),
});

const assignManagerSchema = z.object({
  manager_id: z.string().min(1, "Please select a manager"),
});

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

export default function DepartmentDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const departmentId = params.id as string;

  const [department, setDepartment] = useState<Department | null>(null);
  const [manager, setManager] = useState<Manager | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [managerErrors, setManagerErrors] = useState<Record<string, string>>(
    {},
  );

  const fetchDepartment = async () => {
    try {
      setLoading(true);

      const clientId = getClientIdFromToken();
      const role = getUserRoleFromToken();

      let managersUrl = "/users/managers";
      if (clientId && role !== "CLIENT_ADMIN") {
        managersUrl = `/users/clients/${clientId}/managers`;
      }

      const [deptRes, managerRes, managersRes] = await Promise.all([
        api.get(`/departments/${departmentId}`),
        api
          .get(`/departments/${departmentId}/manager`)
          .catch(() => ({ data: null })),
        api.get(managersUrl).catch(() => ({ data: [] })),
      ]);

      setDepartment(deptRes.data);
      setManager(managerRes.data);
      setManagers(managersRes.data);
    } catch (error: any) {
      console.error("Error fetching department:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch department");
      router.push("/departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    if (departmentId) {
      fetchDepartment();
    }
  }, [departmentId]);

  const handleUpdateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!department) return;

    const result = departmentSchema.safeParse(editFormData);
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
      await api.patch(`/departments/${department.id}`, result.data);
      toast.success("Department updated successfully");
      setShowEditModal(false);
      setEditErrors({});
      fetchDepartment();
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
    if (!department) return;

    const result = assignManagerSchema.safeParse({
      manager_id: selectedManagerId,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });
      setManagerErrors(errors);
      toast.error(result.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/departments/${department.id}/assign-manager`, {
        manager_id: selectedManagerId,
      });
      toast.success("Manager assigned successfully");
      setShowManagerModal(false);
      setManagerErrors({});
      fetchDepartment();
    } catch (error: any) {
      console.error("Error assigning manager:", error);
      toast.error(error.response?.data?.detail || "Failed to assign manager");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveManager = async () => {
    if (!department) return;
    setSubmitting(true);
    try {
      await api.patch(`/departments/${department.id}/remove-manager`);
      toast.success("Manager removed successfully");
      fetchDepartment();
    } catch (error: any) {
      console.error("Error removing manager:", error);
      toast.error(error.response?.data?.detail || "Failed to remove manager");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!department) return;
    setSubmitting(true);
    try {
      await api.delete(`/departments/${department.id}`);
      toast.success("Department deactivated successfully");
      setShowDeleteConfirm(false);
      router.push("/departments");
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
    if (!department) return;
    setSubmitting(true);
    try {
      await api.patch(`/departments/${department.id}/restore`);
      toast.success("Department restored successfully");
      setShowRestoreConfirm(false);
      fetchDepartment();
    } catch (error: any) {
      console.error("Error restoring department:", error);
      toast.error(
        error.response?.data?.detail || "Failed to restore department",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = () => {
    if (department) {
      setEditFormData({
        name: department.name,
        code: department.code,
        description: department.description || "",
      });
      setEditErrors({});
      setShowEditModal(true);
    }
  };

  const openManagerModal = () => {
    setSelectedManagerId(manager?.id || "");
    setManagerErrors({});
    setShowManagerModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="text-center">
          <p className="text-gray-500">Department not found</p>
          <button
            onClick={() => router.push("/departments")}
            className="mt-4 text-red-600 hover:underline cursor-pointer"
          >
            Back to Departments
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
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
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
          background: white;
          border-radius: 28px;
          width: 90%;
          max-width: 560px;
          max-height: 85vh;
          overflow-y: auto;
          animation: fadeInScale 0.35s cubic-bezier(0.2, 0.9, 0.4, 1.2);
          box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.4);
        }
        .delete-modal { max-width: 400px; }
        
        .info-card {
          background: white;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
          transition: all 0.3s ease;
        }
        .info-card:hover {
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
        .input-fancy::placeholder {
          color: #9ca3af;
          font-weight: 400;
          opacity: 0.9;
        }

        .manager-card {
          background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%);
          border: 1px solid rgba(220,38,38,0.08);
          border-radius: 16px;
          padding: 20px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .manager-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #dc2626, #ef4444, #dc2626);
          background-size: 200% 100%;
          animation: shimmer 2s linear infinite;
        }
        .manager-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(220,38,38,0.08);
          border-color: rgba(220,38,38,0.15);
        }
        .manager-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 700;
          color: white;
          background: linear-gradient(135deg, #dc2626, #991b1b);
          box-shadow: 0 4px 16px rgba(220,38,38,0.25);
          flex-shrink: 0;
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
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-100/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative p-6 lg:p-8 max-w-5xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => router.push("/departments")}
            className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors mb-6 group fade-in-up cursor-pointer"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to Departments</span>
          </button>

          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 fade-in-up">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-xl blur-md animate-pulse"></div>
                <div className="relative w-16 h-16 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.8"
                  >
                    <path d="M20 7h-4.18A3 3 0 0016 5.18V4a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2z" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                  {department.name}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${department.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {department.is_active ? "Active" : "Deactivated"}
                  </span>
                  <span className="text-sm font-mono text-gray-400">
                    {department.code}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              {!department.is_active && (
                <button
                  onClick={() => setShowRestoreConfirm(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold transition cursor-pointer"
                >
                  Restore
                </button>
              )}
              <button
                onClick={openEditModal}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold transition cursor-pointer"
              >
                Edit
              </button>
              {department.is_active && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold transition cursor-pointer"
                >
                  Deactivate
                </button>
              )}
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 fade-in-up">
            <div className="info-card p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4l3 3" />
                </svg>
                Department Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Department ID
                  </p>
                  <p className="text-sm font-mono text-gray-700 mt-1">
                    {department.id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Department Code
                  </p>
                  <p className="text-sm font-mono text-gray-700 mt-1">
                    {department.code}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Client ID
                  </p>
                  <p className="text-sm font-mono text-gray-700 mt-1">
                    {department.client_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Description
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    {department.description || "No description provided"}
                  </p>
                </div>
              </div>
            </div>

            {/* Manager Card */}
            <div className="info-card p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                >
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Department Manager
              </h3>
              {manager ? (
                <div className="manager-card">
                  <div className="flex items-start gap-4">
                    <div className="manager-avatar">
                      {manager.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-gray-900 truncate">
                          {manager.full_name}
                        </h4>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${manager.is_active !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                        >
                          {manager.is_active !== false ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="space-y-1.5 mt-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                          </svg>
                          <span className="truncate">{manager.email}</span>
                        </div>
                        {manager.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                            </svg>
                            <span>{manager.phone}</span>
                          </div>
                        )}
                        {manager.role && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" />
                            </svg>
                            <span>{manager.role}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={openManagerModal}
                      className="text-sm text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M17 3l4 4-7 7H10v-4l7-7z" />
                      </svg>
                      Change Manager
                    </button>
                    <button
                      onClick={handleRemoveManager}
                      disabled={submitting}
                      className="text-sm text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Remove Manager
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#9ca3af"
                      strokeWidth="1.5"
                    >
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm mb-3">
                    No manager assigned to this department
                  </p>
                  <button
                    onClick={openManagerModal}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition cursor-pointer"
                  >
                    + Assign Manager
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      // Edit Department Modal
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Edit Department
                  </h2>
                  <p className="text-sm text-gray-400">
                    Update department information
                  </p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
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

              <form onSubmit={handleUpdateDepartment} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Department Name <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🏢</span>
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
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                        editErrors.name
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-500/40"
                      }`}
                      placeholder="Enter department name"
                    />
                  </div>
                  {editErrors.name && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {editErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Department Code <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🔢</span>
                    <input
                      type="text"
                      value={editFormData.code}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          code: e.target.value.toUpperCase(),
                        });
                        if (editErrors.code)
                          setEditErrors({ ...editErrors, code: "" });
                      }}
                      required
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                        editErrors.code
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-500/40"
                      }`}
                      placeholder="Enter department code"
                    />
                  </div>
                  {editErrors.code && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {editErrors.code}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                    Uppercase letters, numbers, and underscores only
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Description
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon icon-top">📝</span>
                    <textarea
                      value={editFormData.description}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          description: e.target.value,
                        });
                        if (editErrors.description)
                          setEditErrors({ ...editErrors, description: "" });
                      }}
                      rows={3}
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all resize-none input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                        editErrors.description
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-500/40"
                      }`}
                      placeholder="Enter department description"
                    />
                  </div>
                  {editErrors.description && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {editErrors.description}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold shadow-md cursor-pointer"
                  >
                    {submitting ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
      // Assign Manager Modal
      {showManagerModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowManagerModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Assign Manager
                  </h2>
                  <p className="text-sm text-gray-400">
                    Select a manager for this department
                  </p>
                </div>
                <button
                  onClick={() => setShowManagerModal(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
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

              <form onSubmit={handleAssignManager} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Select Manager <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">👤</span>
                    <select
                      value={selectedManagerId}
                      onChange={(e) => {
                        setSelectedManagerId(e.target.value);
                        if (managerErrors.manager_id)
                          setManagerErrors({
                            ...managerErrors,
                            manager_id: "",
                          });
                      }}
                      required
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-sm font-normal ${
                        managerErrors.manager_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-500/40"
                      }`}
                    >
                      <option value="">-- Select a manager --</option>
                      {managers
                        .filter((m) => m.is_active !== false)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name} ({m.email})
                          </option>
                        ))}
                    </select>
                  </div>
                  {managerErrors.manager_id && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {managerErrors.manager_id}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Only active managers are shown
                  </p>
                </div>

                {manager && (
                  <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                    <p className="text-sm text-yellow-700">
                      Current manager will be replaced.
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowManagerModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  {manager && (
                    <button
                      type="button"
                      onClick={handleRemoveManager}
                      disabled={submitting}
                      className="px-4 py-2.5 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-all font-semibold text-sm cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? "Removing..." : "Remove Manager"}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold shadow-md cursor-pointer"
                  >
                    {submitting ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Assign Manager"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      // Delete Confirmation Modal
      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
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
                Deactivate Department?
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Are you sure you want to deactivate{" "}
                <span className="font-semibold text-gray-700">
                  {department.name}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteDepartment}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold cursor-pointer"
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
      // Restore Confirmation Modal
      {showRestoreConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowRestoreConfirm(false)}
        >
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
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
                Restore Department?
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Are you sure you want to restore{" "}
                <span className="font-semibold text-gray-700">
                  {department.name}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRestoreConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestoreDepartment}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold cursor-pointer"
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
