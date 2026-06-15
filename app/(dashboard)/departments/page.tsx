"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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

export default function DepartmentsPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [selectedManagerId, setSelectedManagerId] = useState("");

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/departments");
      setDepartments(response.data);
    } catch (error: any) {
      console.error("Error fetching departments:", error);
      toast.error(
        error.response?.data?.detail || "Failed to fetch departments",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchManagers = async () => {
    try {
      const response = await api.get("/users/managers");
      setManagers(response.data);
    } catch (error: any) {
      console.error("Error fetching managers:", error);
    }
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

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/departments", formData);
      toast.success("Department created successfully");
      setShowModal(false);
      setFormData({ name: "", code: "", description: "" });
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

  const filteredDepartments = departments.filter(
    (dept) =>
      (showDeactivated ? !dept.is_active : dept.is_active) &&
      (dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.code.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const activeCount = departments.filter((d) => d.is_active).length;
  const deactivatedCount = departments.filter((d) => !d.is_active).length;

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

        <div className="relative p-6 lg:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 fade-in-up">
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
              <p className="text-gray-500 ml-14 pl-0.5 text-sm">
                Manage your organizational departments and managers
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 overflow-hidden"
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

          {/* Stats Cards */}
          {!loading && departments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8 fade-in-up">
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
                  <p className="text-sm text-gray-500 font-medium">
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
                  <p className="text-sm text-gray-500 font-medium">Active</p>
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
                  <p className="text-sm text-gray-500 font-medium">
                    Deactivated
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search and Toggle */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 fade-in-up">
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
                className="w-full pl-11 pr-4 py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all shadow-sm text-gray-800"
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

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* Departments Grid */}
          {!loading && (
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
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {dept.description}
                      </p>
                    )}
                    <div className="mt-3 text-right">
                      <span className="text-xs text-gray-400 group-hover:text-red-500 transition-colors">
                        Click to view details →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredDepartments.length === 0 && (
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
              <p className="text-gray-500 mb-4">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Add your first department to get started"}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  + Add Department
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Department Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Create Department
                  </h2>
                  <p className="text-sm text-gray-400">
                    Enter department details below
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
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
              <form onSubmit={handleCreateDepartment} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Department Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy"
                    placeholder="e.g., Information Technology"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Department Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy"
                    placeholder="e.g., IT001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all resize-none input-fancy"
                    placeholder="Department description"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
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
                      "Create Department"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {showEditModal && selectedDepartment && (
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
    </>
  );
}
