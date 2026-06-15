"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";

interface User {
  id: string;
  client_id: string;
  email: string;
  full_name: string;
  phone: string;
  employee_id: string;
  department_id: string;
  role: string;
  is_active: boolean;
}

interface Department {
  id: string;
  name: string;
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

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [userType, setUserType] = useState<"user" | "manager">("user");
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    employee_id: "",
    department_id: "",
    client_id: "",
  });
  const [editFormData, setEditFormData] = useState({
    full_name: "",
    phone: "",
    department_id: "",
  });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/users");
      setUsers(response.data);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await api.get("/departments");
      setDepartments(response.data);
    } catch (error: any) {
      console.error("Error fetching departments:", error);
      // Don't show toast for this error - it's expected for Platform Admin
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchUsers();
    // fetchDepartments(); // Temporarily disabled - requires Client Admin token
  }, [router, fetchUsers]);

  const getClientIdFromToken = () => {
    const token = localStorage.getItem("access_token");
    if (!token) return "";
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.client_id || "";
    } catch {
      return "";
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const clientId = formData.client_id || getClientIdFromToken();

      if (!clientId) {
        toast.error("Client ID is required. Please enter a valid client ID.");
        setSubmitting(false);
        return;
      }

      const payloadData = {
        client_id: clientId,
        full_name: formData.full_name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        employee_id: formData.employee_id,
        department_id: formData.department_id,
      };

      if (userType === "manager") {
        await api.post("/users/managers", payloadData);
        toast.success("Manager created successfully");
      } else {
        await api.post("/users", {
          ...payloadData,
          role: {
            name: "USER",
            description: "Regular employee user",
            permissions: [],
          },
        });
        toast.success("User created successfully");
      }
      setShowModal(false);
      setFormData({
        full_name: "",
        email: "",
        password: "",
        phone: "",
        employee_id: "",
        department_id: "",
        client_id: "",
      });
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      const errorMsg = error.response?.data?.detail || error.message || "Failed to create user";
      toast.error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const endpoint =
        selectedUser.role === "MANAGER"
          ? `/users/managers/${selectedUser.id}`
          : `/users/${selectedUser.id}`;
      await api.patch(endpoint, editFormData);
      toast.success("User updated successfully");
      setShowEditModal(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error(error.response?.data?.detail || "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const endpoint =
        selectedUser.role === "MANAGER"
          ? `/users/managers/${selectedUser.id}`
          : `/users/${selectedUser.id}`;
      await api.delete(endpoint);
      toast.success("User deactivated successfully");
      setShowDeleteConfirm(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error deactivating user:", error);
      toast.error(error.response?.data?.detail || "Failed to deactivate user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreUser = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const endpoint =
        selectedUser.role === "MANAGER"
          ? `/users/managers/${selectedUser.id}/restore`
          : `/users/${selectedUser.id}/restore`;
      await api.patch(endpoint);
      toast.success("User restored successfully");
      setShowRestoreConfirm(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error restoring user:", error);
      toast.error(error.response?.data?.detail || "Failed to restore user");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditFormData({
      full_name: user.full_name,
      phone: user.phone || "",
      department_id: user.department_id || "",
    });
    setShowEditModal(true);
  };

  const filteredUsers = users.filter(
    (user) =>
      (showDeactivated ? !user.is_active : user.is_active) &&
      (user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const activeCount = users.filter((u) => u.is_active).length;
  const deactivatedCount = users.filter((u) => !u.is_active).length;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "MANAGER":
        return "bg-purple-100 text-purple-700";
      case "CLIENT_ADMIN":
        return "bg-red-100 text-red-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  // Helper text for department ID
  const departmentHelperText = "Use department ID from database. Example: 9d732b07-1a13-4ec3-8ee3-70fe55a62799";

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards; }
        
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
          animation: fadeInUp 0.35s ease;
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
        
        .user-card {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .user-card:hover {
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
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                    <path d="M17 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-800">
                  Users
                </h1>
              </div>
              <p className="text-gray-500 ml-14 pl-0.5 text-sm">
                Manage employees, managers, and system users
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
              <span>Add User</span>
            </button>
          </div>

          {/* Stats Cards */}
          {!loading && users.length > 0 && (
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
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">
                    {users.length}
                  </p>
                  <p className="text-sm text-gray-500 font-medium">
                    Total Users
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
                placeholder="Search users by name, email, or role..."
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

          {/* Users Grid */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map((user, idx) => {
                const department = departments.find(
                  (d) => d.id === user.department_id,
                );
                return (
                  <div
                    key={user.id}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm user-card fade-in-up"
                    style={{ animationDelay: `${idx * 70}ms` }}
                    onClick={() => router.push(`/users/${user.id}`)}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-50 to-white flex items-center justify-center shadow-sm border border-red-100/50">
                          <span className="text-red-600 font-bold text-xl">
                            {user.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(user.role)}`}
                        >
                          {user.role}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg mb-1">
                        {user.full_name}
                      </h3>
                      <p className="text-sm text-gray-500 mb-2">{user.email}</p>
                      {user.employee_id && (
                        <p className="text-xs text-gray-400 mb-1">
                          ID: {user.employee_id}
                        </p>
                      )}
                      {department && (
                        <p className="text-xs text-gray-400">
                          Dept: {department.name}
                        </p>
                      )}
                      <div className="mt-3 text-right">
                        <span className="text-xs text-gray-400 group-hover:text-red-500 transition-colors">
                          Click to view details →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredUsers.length === 0 && (
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
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                No users found
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Add your first user to get started"}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  + Add User
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Create User
                  </h2>
                  <p className="text-sm text-gray-400">
                    Enter user details below
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

              {/* User Type Toggle */}
              <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setUserType("user")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${userType === "user" ? "bg-red-600 text-white shadow-md" : "text-gray-600"}`}
                >
                  Regular User
                </button>
                <button
                  type="button"
                  onClick={() => setUserType("manager")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${userType === "manager" ? "bg-red-600 text-white shadow-md" : "text-gray-600"}`}
                >
                  Manager
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy"
                    placeholder="john@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy"
                    placeholder="••••••••"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Min 8 characters with uppercase, lowercase, and number
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy"
                    placeholder="+91 9876543210"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={formData.employee_id}
                    onChange={(e) =>
                      setFormData({ ...formData, employee_id: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy"
                    placeholder="EMP001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Department ID
                  </label>
                  <input
                    type="text"
                    value={formData.department_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        department_id: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy"
                    placeholder="Enter department UUID"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {departmentHelperText}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Client ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="client_id"
                    value={formData.client_id || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, client_id: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy"
                    placeholder="Enter client ID (e.g., 386f1886-8de5-461c-b7ef-67c4dfed4e0d)"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Leave empty to auto-detect from your login token
                  </p>
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
                      "Create User"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Edit User</h2>
                  <p className="text-sm text-gray-400">
                    Update user information
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
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.full_name}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        full_name: e.target.value,
                      })
                    }
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        phone: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Department ID
                  </label>
                  <input
                    type="text"
                    value={editFormData.department_id}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        department_id: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {departmentHelperText}
                  </p>
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
                      "Update User"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedUser && (
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
                Deactivate User?
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Are you sure you want to deactivate{" "}
                <span className="font-semibold text-gray-700">
                  {selectedUser.full_name}
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
                  onClick={handleDeleteUser}
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
      {showRestoreConfirm && selectedUser && (
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
                Restore User?
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Are you sure you want to restore{" "}
                <span className="font-semibold text-gray-700">
                  {selectedUser.full_name}
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
                  onClick={handleRestoreUser}
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