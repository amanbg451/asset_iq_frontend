"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";

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

const getAuthToken = () => localStorage.getItem("access_token");

const api = axios.create({
  baseURL: "http://localhost:8000",
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default function DepartmentDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const departmentId = params.id as string;

  const [department, setDepartment] = useState<Department | null>(null);
  const [manager, setManager] = useState<Manager | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [selectedManagerId, setSelectedManagerId] = useState("");

  const fetchDepartment = async () => {
    try {
      setLoading(true);
      const [deptRes, managerRes, managersRes] = await Promise.all([
        api.get(`/departments/${departmentId}`),
        api
          .get(`/departments/${departmentId}/manager`)
          .catch(() => ({ data: null })),
        api.get("/users/managers").catch(() => ({ data: [] })),
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
    setSubmitting(true);
    try {
      await api.patch(`/departments/${department.id}`, editFormData);
      toast.success("Department updated successfully");
      setShowEditModal(false);
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
    setSubmitting(true);
    try {
      await api.patch(`/departments/${department.id}/assign-manager`, {
        manager_id: selectedManagerId,
      });
      toast.success("Manager assigned successfully");
      setShowManagerModal(false);
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
      setShowEditModal(true);
    }
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
            className="mt-4 text-red-600 hover:underline"
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
            className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors mb-6 group fade-in-up"
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

          {/* Header Section */}
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
                  className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold"
                >
                  Restore
                </button>
              )}
              <button
                onClick={openEditModal}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold"
              >
                Edit
              </button>
              {department.is_active && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold"
                >
                  Deactivate
                </button>
              )}
            </div>
          </div>

          {/* Department Info Cards */}
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
                    Description
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    {department.description || "No description provided"}
                  </p>
                </div>
              </div>
            </div>

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
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Name
                    </p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">
                      {manager.full_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Email
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      {manager.email}
                    </p>
                  </div>
                  {manager.phone && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">
                        Phone
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        {manager.phone}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowManagerModal(true)}
                      className="text-sm text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-1"
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
                      className="text-sm text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
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
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm mb-3">
                    No manager assigned to this department
                  </p>
                  <button
                    onClick={() => setShowManagerModal(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition"
                  >
                    + Assign Manager
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Department Modal */}
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
                  className="text-gray-400 hover:text-gray-600"
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
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, name: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Department Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.code}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, code: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all resize-none input-fancy"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold shadow-md"
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

      {/* Assign Manager Modal */}
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
                  className="text-gray-400 hover:text-gray-600"
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
                    Select Manager
                  </label>
                  <select
                    value={selectedManagerId}
                    onChange={(e) => setSelectedManagerId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all bg-white"
                  >
                    <option value="">-- Select a manager --</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowManagerModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold shadow-md"
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

      {/* Delete Confirmation Modal */}
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
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteDepartment}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
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
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestoreDepartment}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
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
