"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import { z } from "zod";
import api from "@/app/lib/api";

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
  custom_role_id: string | null;
}

interface Department {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface SubscribedService {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface Permission {
  service_id: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

// ZOD VALIDATION SCHEMAS

const phoneSchema = z
  .string()
  .regex(/^[0-9]{10}$/, "Phone must be exactly 10 digits")
  .optional();

const editUserSchema = z.object({
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  phone: phoneSchema,
  department_id: z.string().min(1, "Department is required"),
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

export default function UserDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  // State
  const [user, setUser] = useState<User | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subscribedServices, setSubscribedServices] = useState<
    SubscribedService[]
  >([]);
  const [editPermissions, setEditPermissions] = useState<
    Record<string, Permission>
  >({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [editFormData, setEditFormData] = useState({
    full_name: "",
    phone: "",
    department_id: "",
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const fetchSubscribedServices = async () => {
    try {
      const clientId = getClientIdFromToken();
      if (!clientId) {
        setSubscribedServices([]);
        return;
      }
      const response = await api.get(
        `/clients/${clientId}/subscriptions/services`,
      );
      setSubscribedServices(response.data || []);
    } catch (error: any) {
      console.error("Error fetching subscribed services:", error);
      setSubscribedServices([]);
    }
  };

  const fetchUserPermissions = async () => {
    if (!user || !user.custom_role_id) {
      const initialPerms: Record<string, Permission> = {};
      subscribedServices.forEach((service) => {
        initialPerms[service.id] = {
          service_id: service.id,
          can_create: false,
          can_read: false,
          can_update: false,
          can_delete: false,
        };
      });
      setEditPermissions(initialPerms);
      return;
    }

    try {
      const response = await api.get(
        `/roles/${user.custom_role_id}/permissions`,
      );
      const perms: Record<string, Permission> = {};
      (response.data || []).forEach((p: any) => {
        perms[p.service_id] = {
          service_id: p.service_id,
          can_create: p.can_create,
          can_read: p.can_read,
          can_update: p.can_update,
          can_delete: p.can_delete,
        };
      });
      setEditPermissions(perms);
    } catch (error: any) {
      console.error("Error fetching permissions:", error);
      const initialPerms: Record<string, Permission> = {};
      subscribedServices.forEach((service) => {
        initialPerms[service.id] = {
          service_id: service.id,
          can_create: false,
          can_read: false,
          can_update: false,
          can_delete: false,
        };
      });
      setEditPermissions(initialPerms);
    }
  };

  const fetchUser = async () => {
    try {
      setLoading(true);
      const userRes = await api.get(`/users/${userId}`);
      setUser(userRes.data);

      if (userRes.data.department_id) {
        try {
          const deptRes = await api.get(
            `/departments/${userRes.data.department_id}`,
          );
          setDepartment(deptRes.data);
        } catch {
          setDepartment(null);
        }
      }

      await fetchSubscribedServices();
    } catch (error: any) {
      console.error("Error fetching user:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch user");
      router.push("/users");
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get("/departments");
      setDepartments(response.data);
    } catch (error: any) {
      console.error("Error fetching departments:", error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    if (userId) {
      fetchUser();
      fetchDepartments();
    }
  }, [userId]);

  useEffect(() => {
    if (showEditModal && user) {
      fetchUserPermissions();
    }
  }, [showEditModal, user]);

  const handlePermissionChange = (
    serviceId: string,
    permissionType: keyof Omit<Permission, "service_id">,
    checked: boolean,
  ) => {
    setEditPermissions((prev) => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        service_id: serviceId,
        [permissionType]: checked,
      },
    }));
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const result = editUserSchema.safeParse(editFormData);
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
      const endpoint =
        user.role === "MANAGER"
          ? `/users/managers/${user.id}`
          : `/users/${user.id}`;

      await api.patch(endpoint, {
        full_name: result.data.full_name.trim(),
        phone: result.data.phone || "",
        department_id: result.data.department_id,
      });

      if (user.custom_role_id) {
        const permissionsArray = Object.values(editPermissions);
        await api.patch(`/roles/${user.custom_role_id}/permissions`, {
          permissions: permissionsArray,
        });
      } else if (user.role === "USER" && subscribedServices.length > 0) {
        toast.error(
          "User doesn't have a custom role. Permissions cannot be updated.",
        );
      }

      toast.success("User updated successfully");
      setShowEditModal(false);
      setEditErrors({});
      fetchUser();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error(error.response?.data?.detail || "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const endpoint =
        user.role === "MANAGER"
          ? `/users/managers/${user.id}`
          : `/users/${user.id}`;
      await api.delete(endpoint);
      toast.success("User deactivated successfully");
      setShowDeleteConfirm(false);
      router.push("/users");
    } catch (error: any) {
      console.error("Error deactivating user:", error);
      toast.error(error.response?.data?.detail || "Failed to deactivate user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreUser = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const endpoint =
        user.role === "MANAGER"
          ? `/users/managers/${user.id}/restore`
          : `/users/${user.id}/restore`;
      await api.patch(endpoint);
      toast.success("User restored successfully");
      setShowRestoreConfirm(false);
      fetchUser();
    } catch (error: any) {
      console.error("Error restoring user:", error);
      toast.error(error.response?.data?.detail || "Failed to restore user");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = () => {
    if (user) {
      setEditFormData({
        full_name: user.full_name,
        phone: user.phone || "",
        department_id: user.department_id || "",
      });
      setEditErrors({});
      setShowEditModal(true);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="text-center">
          <p className="text-gray-500">User not found</p>
          <button
            onClick={() => router.push("/users")}
            className="mt-4 text-red-600 hover:underline cursor-pointer"
          >
            Back to Users
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
          padding: 16px;
        }
        .modal-content {
          background: white;
          border-radius: 28px;
          width: 95%;
          max-width: 720px;
          max-height: 85vh;
          overflow-y: auto;
          animation: fadeInScale 0.35s cubic-bezier(0.2, 0.9, 0.4, 1.2);
          box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.4);
          padding: 16px;
        }

        @media (min-width: 640px) {
          .modal-content {
            padding: 24px 28px;
            border-radius: 28px;
          }
        }

        @media (max-width: 640px) {
          .modal-content {
            border-radius: 20px;
            padding: 16px;
          }
          .modal-grid-2 {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .modal-grid-2 .full-width {
            grid-column: 1 / -1;
          }
        }

        .modal-content::-webkit-scrollbar { width: 6px; }
        .modal-content::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 20px; margin: 12px 0; }
        .modal-content::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #dc2626, #ef4444); border-radius: 20px; border: 2px solid transparent; background-clip: padding-box; }
        .modal-content::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #b91c1c, #dc2626); }
        .modal-content { scrollbar-width: thin; scrollbar-color: #dc2626 #f1f5f9; scroll-behavior: smooth; }
        
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

        .perm-checkbox {
          accent-color: #dc2626;
        }
        .perm-label {
          font-size: 12px;
          font-weight: 500;
          color: #374151;
        }

        .modal-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px 20px;
        }

        @media (max-width: 640px) {
          .modal-grid-2 {
            grid-template-columns: 1fr;
            gap: 12px;
          }
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

        @media (max-width: 640px) {
          .info-card {
            padding: 16px;
          }
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-100/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
          {/* ─── BACK BUTTON ─── */}
          <button
            onClick={() => router.push("/users")}
            className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors mb-6 group fade-in-up cursor-pointer"
          >
            <svg
              width="18"
              height="18"
              className="sm:w-[20px] sm:h-[20px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span className="text-sm">Back to Users</span>
          </button>

          {/* ─── HEADER ─── */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 fade-in-up">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-xl blur-md animate-pulse"></div>
                <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md">
                  <span className="text-white font-bold text-xl sm:text-2xl">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                  {user.full_name}
                </h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getRoleBadgeColor(user.role)}`}
                  >
                    {user.role}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${user.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {user.is_active ? "Active" : "Deactivated"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3 flex-wrap">
              {!user.is_active && (
                <button
                  onClick={() => setShowRestoreConfirm(true)}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold text-sm cursor-pointer"
                >
                  Restore
                </button>
              )}
              <button
                onClick={openEditModal}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold text-sm cursor-pointer"
              >
                Edit
              </button>
              {user.is_active && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold text-sm cursor-pointer"
                >
                  Deactivate
                </button>
              )}
            </div>
          </div>

          {/* ─── USER INFO CARDS ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 fade-in-up">
            <div className="info-card p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg
                  width="18"
                  height="18"
                  className="sm:w-[20px] sm:h-[20px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4l3 3" />
                </svg>
                Personal Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">
                    Full Name
                  </p>
                  <p className="text-sm sm:text-base font-semibold text-gray-800 mt-1">
                    {user.full_name}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">
                    Email
                  </p>
                  <p className="text-sm sm:text-base text-gray-700 mt-1">
                    {user.email}
                  </p>
                </div>
                {user.phone && (
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">
                      Phone
                    </p>
                    <p className="text-sm sm:text-base text-gray-700 mt-1">
                      {user.phone}
                    </p>
                  </div>
                )}
                {user.employee_id && (
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">
                      Employee ID
                    </p>
                    <p className="text-sm font-mono text-gray-700 mt-1">
                      {user.employee_id}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="info-card p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg
                  width="18"
                  height="18"
                  className="sm:w-[20px] sm:h-[20px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Work Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">
                    User ID
                  </p>
                  <p className="text-sm font-mono text-gray-700 mt-1">
                    {user.id}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">
                    Role
                  </p>
                  <p className="text-sm sm:text-base font-semibold text-gray-800 mt-1">
                    {user.role}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">
                    Department
                  </p>
                  <p className="text-sm sm:text-base text-gray-700 mt-1">
                    {department
                      ? department.name
                      : user.department_id
                        ? "Loading..."
                        : "Not assigned"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      // Edit User Modal
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 sm:mb-5">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                  Edit User
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Update user information and permissions
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
              >
                <svg
                  width="14"
                  height="14"
                  className="sm:w-[16px] sm:h-[16px]"
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

            <form onSubmit={handleUpdateUser}>
              <div className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">👤</span>
                    <input
                      type="text"
                      value={editFormData.full_name}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          full_name: e.target.value,
                        });
                        if (editErrors.full_name)
                          setEditErrors({ ...editErrors, full_name: "" });
                      }}
                      required
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                        editErrors.full_name
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                      placeholder="Enter full name"
                    />
                  </div>
                  {editErrors.full_name && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {editErrors.full_name}
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Phone
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📞</span>
                    <input
                      type="tel"
                      value={editFormData.phone}
                      onChange={(e) => {
                        const sanitized = e.target.value.replace(/[^0-9]/g, "");
                        setEditFormData({ ...editFormData, phone: sanitized });
                        if (editErrors.phone)
                          setEditErrors({ ...editErrors, phone: "" });
                      }}
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                        editErrors.phone
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                      placeholder="9876543210"
                    />
                  </div>
                  {editErrors.phone && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {editErrors.phone}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                    Enter 10-digit mobile number
                  </p>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🏛️</span>
                    <select
                      value={editFormData.department_id}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          department_id: e.target.value,
                        });
                        if (editErrors.department_id)
                          setEditErrors({ ...editErrors, department_id: "" });
                      }}
                      required
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-sm font-normal ${
                        editErrors.department_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                    >
                      <option value="">Select Department</option>
                      {departments
                        .filter((dept) => dept.is_active !== false)
                        .map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  {editErrors.department_id && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {editErrors.department_id}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                    Only active departments are shown
                  </p>
                </div>

                {/* Permissions Section */}
                {user.role === "USER" && subscribedServices.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Service Permissions
                    </label>
                    <div className="border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto">
                      <div className="grid grid-cols-1 gap-3">
                        {subscribedServices.map((service) => (
                          <div
                            key={service.id}
                            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-all"
                          >
                            <span className="text-sm font-medium text-gray-700 min-w-[100px]">
                              {service.name}
                            </span>
                            <div className="flex gap-3">
                              {["create", "read", "update", "delete"].map(
                                (perm) => (
                                  <label
                                    key={perm}
                                    className="flex items-center gap-1 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={
                                        editPermissions[service.id]?.[
                                          `can_${perm}` as keyof Omit<
                                            Permission,
                                            "service_id"
                                          >
                                        ] || false
                                      }
                                      onChange={(e) =>
                                        handlePermissionChange(
                                          service.id,
                                          `can_${perm}` as keyof Omit<
                                            Permission,
                                            "service_id"
                                          >,
                                          e.target.checked,
                                        )
                                      }
                                      className="w-4 h-4 text-red-600 rounded focus:ring-red-500 perm-checkbox"
                                    />
                                    <span className="text-xs text-gray-600 font-medium">
                                      {perm.charAt(0).toUpperCase() +
                                        perm.slice(1)}
                                    </span>
                                  </label>
                                ),
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                      Select permissions for each service. Only purchased
                      services are shown.
                    </p>
                  </div>
                )}

                {user.role === "MANAGER" && (
                  <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
                    <p className="text-sm text-gray-500 font-normal">
                      Managers have full permissions by default. Permissions
                      cannot be modified.
                    </p>
                  </div>
                )}

                {user.role === "CLIENT_ADMIN" && (
                  <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
                    <p className="text-sm text-gray-500 font-normal">
                      Client Admins have full permissions by default.
                      Permissions cannot be modified.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
                  >
                    {submitting ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Update User"
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      // Delete User Confirmation Modal
      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  className="sm:w-[28px] sm:h-[28px]"
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
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">
                Deactivate User?
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Are you sure you want to deactivate{" "}
                <span className="font-semibold text-gray-700">
                  {user.full_name}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
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
      // Restore User Confirmation Modal
      {showRestoreConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowRestoreConfirm(false)}
        >
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  className="sm:w-[28px] sm:h-[28px]"
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
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">
                Restore User?
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Are you sure you want to restore{" "}
                <span className="font-semibold text-gray-700">
                  {user.full_name}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRestoreConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestoreUser}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
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
