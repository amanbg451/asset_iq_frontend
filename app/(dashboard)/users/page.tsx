"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
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
}

interface Department {
  id: string;
  client_id: string;
  name: string;
  is_active: boolean;
}

interface Client {
  id: string;
  name: string;
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

type ViewMode = "table" | "grid";

// Zod Schemas for validation

const phoneSchema = z
  .string()
  .regex(/^[0-9]{10}$/, "Phone must be exactly 10 digits");

const userSchema = z.object({
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  phone: phoneSchema,
  employee_id: z.string().optional(),
  department_id: z.string().min(1, "Department is required"),
  client_id: z.string().optional(),
});

const editUserSchema = z.object({
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  phone: phoneSchema.optional(),
  department_id: z.string().min(1, "Department is required"),
});

const permissionSchema = z.object({
  service_id: z.string(),
  can_create: z.boolean().default(false),
  can_read: z.boolean().default(false),
  can_update: z.boolean().default(false),
  can_delete: z.boolean().default(false),
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

const exportToCSV = (data: User[], filename: string) => {
  const headers = [
    "Full Name",
    "Email",
    "Phone",
    "Employee ID",
    "Role",
    "Department ID",
    "Status",
  ];
  const rows = data.map((u) => [
    u.full_name,
    u.email,
    u.phone || "",
    u.employee_id || "",
    u.role,
    u.department_id || "",
    u.is_active ? "Active" : "Deactivated",
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

const exportToExcel = (data: User[], filename: string) => {
  const headers = [
    "Full Name",
    "Email",
    "Phone",
    "Employee ID",
    "Role",
    "Department ID",
    "Status",
  ];
  const rows = data.map((u) => [
    u.full_name,
    u.email,
    u.phone || "",
    u.employee_id || "",
    u.role,
    u.department_id || "",
    u.is_active ? "Active" : "Deactivated",
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

export default function UsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>(
    [],
  );
  const [clients, setClients] = useState<Client[]>([]);
  const [subscribedServices, setSubscribedServices] = useState<
    SubscribedService[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [fetchingClients, setFetchingClients] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [userType, setUserType] = useState<"user" | "manager">("user");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    employee_id: "",
    department_id: "",
    client_id: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editFormData, setEditFormData] = useState({
    full_name: "",
    phone: "",
    department_id: "",
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [permissions, setPermissions] = useState<Record<string, Permission>>(
    {},
  );
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const userRole = getUserRoleFromToken();
  const isPlatformAdmin = userRole === "ADMIN";

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

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const url = showDeactivated ? "/users/deactivated" : "/users";
      const response = await api.get(url);
      setUsers(response.data);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [showDeactivated]);

  const fetchDepartments = async () => {
    try {
      setDepartmentsLoading(true);
      const response = await api.get("/departments");
      setDepartments(response.data);
    } catch (error: any) {
      console.error("Error fetching departments:", error);
    } finally {
      setDepartmentsLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      setFetchingClients(true);
      const response = await api.get("/clients");
      setClients(response.data);
    } catch (error: any) {
      console.error("Error fetching clients:", error);
    } finally {
      setFetchingClients(false);
    }
  };

  const fetchSubscribedServices = async () => {
    try {
      const clientId = getClientIdFromToken() || formData.client_id;
      if (!clientId) {
        setSubscribedServices([]);
        return;
      }
      const response = await api.get(
        `/clients/${clientId}/subscriptions/services`,
      );
      setSubscribedServices(response.data || []);

      const initialPerms: Record<string, Permission> = {};
      (response.data || []).forEach((service: SubscribedService) => {
        initialPerms[service.id] = {
          service_id: service.id,
          can_create: false,
          can_read: false,
          can_update: false,
          can_delete: false,
        };
      });
      setPermissions(initialPerms);
    } catch (error: any) {
      console.error("Error fetching subscribed services:", error);
      setSubscribedServices([]);
    }
  };

  const generateEmployeeId = useCallback(() => {
    const existingIds = users
      .map((u) => u.employee_id)
      .filter((id) => id && id.startsWith("EMP"))
      .map((id) => parseInt(id.replace("EMP", "")))
      .filter((num) => !isNaN(num));

    let nextNumber = 1;
    if (existingIds.length > 0) {
      nextNumber = Math.max(...existingIds) + 1;
    }
    return `EMP${nextNumber.toString().padStart(6, "0")}`;
  }, [users]);

  // Filter departments based on selected client
  useEffect(() => {
    const tokenClientId = getClientIdFromToken();
    const isClientAdmin = getUserRoleFromToken() === "CLIENT_ADMIN";
    const effectiveClientId = isClientAdmin
      ? tokenClientId
      : formData.client_id;

    if (effectiveClientId) {
      const filtered = departments.filter(
        (dept) =>
          dept.client_id === effectiveClientId && dept.is_active !== false,
      );
      setFilteredDepartments(filtered);
      if (
        formData.department_id &&
        !filtered.some((d) => d.id === formData.department_id)
      ) {
        setFormData((prev) => ({ ...prev, department_id: "" }));
      }
    } else {
      setFilteredDepartments([]);
    }
  }, [formData.client_id, departments]);

  // Model Setup: When modal opens, generate employee ID and fetch departments/services/clients
  useEffect(() => {
    if (showModal) {
      setFormData((prev) => ({ ...prev, employee_id: generateEmployeeId() }));
      fetchDepartments();
      fetchSubscribedServices();
      if (isPlatformAdmin) {
        fetchClients();
      }
    } else {
      setPermissions({});
      setSubscribedServices([]);
      setFilteredDepartments([]);
      setFormErrors({});
      setShowPassword(false);
    }
  }, [showModal, isPlatformAdmin, generateEmployeeId]);

  // Initial fetch of users and departments on component mount
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchUsers();
    fetchDepartments();
  }, [router, fetchUsers]);

  const checkLicenceLimit = async (): Promise<boolean> => {
    try {
      const clientId = getClientIdFromToken();
      if (!clientId && formData.client_id) {
        try {
          const subRes = await api.get(
            `/clients/${formData.client_id}/subscriptions`,
          );
          const totalLicences = subRes.data?.licence_count || 0;
          const usedLicences = subRes.data?.used_licences || 0;

          if (usedLicences >= totalLicences && totalLicences > 0) {
            toast.error(
              `Licence limit reached (${totalLicences}/${totalLicences}). Please upgrade subscription.`,
            );
            return false;
          }
          const remaining = totalLicences - usedLicences;
          if (remaining <= 5 && remaining > 0) {
            toast(`Only ${remaining} licence(s) remaining`, { icon: "⚠️" });
          }
          return true;
        } catch (error: any) {
          if (error.response?.status === 403) return true;
          throw error;
        }
      }
      return true;
    } catch (error: any) {
      console.error("Error checking licence limit:", error);
      return true;
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = userSchema.safeParse(formData);
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

    const withinLimit = await checkLicenceLimit();
    if (!withinLimit) return;

    setSubmitting(true);
    try {
      const clientId = formData.client_id || getClientIdFromToken();
      if (!clientId) {
        toast.error("Client ID is required. Please select a client.");
        setSubmitting(false);
        return;
      }

      const payloadData = {
        client_id: clientId,
        full_name: result.data.full_name.trim(),
        email: result.data.email.trim(),
        password: result.data.password,
        phone: result.data.phone || "",
        employee_id: result.data.employee_id || generateEmployeeId(),
        department_id: result.data.department_id,
      };

      if (userType === "manager") {
        await api.post("/users/managers", payloadData);
        toast.success("Manager created successfully");
      } else {
        const permissionsArray = Object.values(permissions);
        await api.post("/users", {
          ...payloadData,
          role: {
            name: "USER",
            description: "Regular employee user",
            permissions: permissionsArray,
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
      setPermissions({});
      setFormErrors({});
      setShowPassword(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.response?.data?.detail || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

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
        selectedUser.role === "MANAGER"
          ? `/users/managers/${selectedUser.id}`
          : `/users/${selectedUser.id}`;
      await api.patch(endpoint, {
        full_name: result.data.full_name.trim(),
        phone: result.data.phone || "",
        department_id: result.data.department_id,
      });
      toast.success("User updated successfully");
      setShowEditModal(false);
      setEditErrors({});
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
    setEditErrors({});
    setShowEditModal(true);
  };

  const handlePermissionChange = (
    serviceId: string,
    permissionType: keyof Omit<Permission, "service_id">,
    checked: boolean,
  ) => {
    setPermissions((prev) => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        service_id: serviceId,
        [permissionType]: checked,
      },
    }));
  };

  const handleExportCSV = () => {
    exportToCSV(users, `users_${new Date().toISOString().split("T")[0]}`);
    setShowExportDropdown(false);
    toast.success("CSV exported successfully");
  };

  const handleExportExcel = () => {
    exportToExcel(users, `users_${new Date().toISOString().split("T")[0]}`);
    setShowExportDropdown(false);
    toast.success("Excel exported successfully");
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
          padding: 16px;
        }
        .modal-content {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          border-radius: 28px;
          width: 95%;
          max-width: 820px;
          max-height: 90vh;
          overflow-y: auto;
          animation: fadeInScale 0.35s cubic-bezier(0.2, 0.9, 0.4, 1.2);
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(220, 38, 38, 0.08);
          padding: 20px;
        }

        @media (min-width: 640px) {
          .modal-content {
            padding: 28px 32px;
            border-radius: 32px;
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
          flex-shrink: 0;
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

        .user-table {
          width: 100%;
          min-width: 700px;
          border-collapse: collapse;
          font-size: 14px;
          font-weight: 400;
        }
        .user-table thead th {
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
        .user-table tbody td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #1f2937;
          font-size: 14px;
          font-weight: 400;
        }
        .user-table tbody tr {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .user-table tbody tr:hover {
          background: #fef2f2;
        }
        .user-table tbody tr:active {
          background: #fecaca;
        }

        .table-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .table-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .table-scroll::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 20px;
        }
        .table-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 20px;
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

        .modal-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px 24px;
        }
        .modal-grid-2 .full-width {
          grid-column: 1 / -1;
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
        .password-toggle {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .password-toggle:hover {
          color: #6b7280;
          background: #f3f4f6;
        }
        .password-toggle svg {
          width: 18px;
          height: 18px;
        }
        .user-type-toggle {
          display: flex;
          gap: 8px;
          padding: 4px;
          background: #f1f5f9;
          border-radius: 12px;
        }
        .user-type-toggle button {
          flex: 1;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s ease;
          border: none;
          background: transparent;
          color: #64748b;
          cursor: pointer;
        }
        .user-type-toggle button.active {
          background: #dc2626;
          color: white;
          box-shadow: 0 2px 8px rgba(220,38,38,0.25);
        }
        .user-type-toggle button:hover:not(.active) {
          background: rgba(220,38,38,0.08);
        }
        .input-error {
          border-color: #ef4444 !important;
        }
        .input-error:focus {
          ring-color: #ef4444 !important;
          border-color: #ef4444 !important;
        }

        /* ─── RESPONSIVE ─── */
        @media (max-width: 480px) {
          .header-actions {
            flex-wrap: wrap;
            gap: 8px;
          }
          .header-actions button {
            font-size: 12px;
            padding: 6px 12px;
          }
          .stat-card {
            padding: 10px 12px;
          }
          .stat-card .stat-value {
            font-size: 18px;
          }
          .stat-card .stat-label {
            font-size: 10px;
          }
          .stats-grid {
            gap: 8px;
          }
        }

        @media (min-width: 481px) and (max-width: 768px) {
          .stat-card .stat-value {
            font-size: 22px;
          }
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-100/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {/* ─── HEADER ─── */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3 sm:gap-4 fade-in-up">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md">
                  <svg
                    width="18"
                    height="18"
                    className="sm:w-[20px] sm:h-[20px]"
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
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">
                  Users
                </h1>
              </div>
              <p className="text-gray-500 ml-[52px] sm:ml-[56px] text-xs sm:text-sm font-normal">
                Manage employees, managers, and system users
              </p>
            </div>

            {/* ─── Header Actions ─── */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap header-actions w-full sm:w-auto">
              <div className="flex bg-white/80 backdrop-blur-sm rounded-xl border border-gray-100 p-1 shadow-sm">
                {(["table", "grid"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={`view-toggle-btn text-xs sm:text-sm ${viewMode === mode ? "active" : ""}`}
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
                  className="cursor-pointer flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <svg
                    width="14"
                    height="14"
                    className="sm:w-[16px] sm:h-[16px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span className="hidden sm:inline">Export</span>
                  <svg
                    width="12"
                    height="12"
                    className="sm:w-[14px] sm:h-[14px]"
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
                        minWidth: "160px",
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

              <button
                onClick={() => setShowModal(true)}
                className="cursor-pointer group relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 overflow-hidden"
              >
                <svg
                  width="16"
                  height="16"
                  className="sm:w-[18px] sm:h-[18px] group-hover:rotate-90 transition-transform duration-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="hidden xs:inline">Add User</span>
                <span className="xs:hidden">Add</span>
              </button>
            </div>
          </div>

          {/* ─── STATS ─── */}
          {!loading && users.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6 fade-in-up stats-grid">
              <div className="stat-card p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="16"
                    height="16"
                    className="sm:w-[22px] sm:h-[22px]"
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
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 stat-value">
                    {users.length}
                  </p>
                  <p className="text-[9px] sm:text-xs lg:text-sm font-medium text-gray-500 stat-label">
                    Total Users
                  </p>
                </div>
              </div>
              <div className="stat-card p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="16"
                    height="16"
                    className="sm:w-[22px] sm:h-[22px]"
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
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 stat-value">
                    {activeCount}
                  </p>
                  <p className="text-[9px] sm:text-xs lg:text-sm font-medium text-gray-500 stat-label">
                    Active
                  </p>
                </div>
              </div>
              <div className="stat-card p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="16"
                    height="16"
                    className="sm:w-[22px] sm:h-[22px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6b7280"
                    strokeWidth="1.8"
                  >
                    <path d="M12 8v4l3 3" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 stat-value">
                    {deactivatedCount}
                  </p>
                  <p className="text-[9px] sm:text-xs lg:text-sm font-medium text-gray-500 stat-label">
                    Deactivated
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── SEARCH ─── */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 fade-in-up">
            <div className="relative w-full sm:w-72 lg:w-96">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-900 pointer-events-none"
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
                className="w-full pl-10 sm:pl-11 pr-8 sm:pr-10 py-2.5 sm:py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all shadow-sm text-gray-800 placeholder-gray-400 text-sm font-normal"
              />
            </div>

            <div className="flex items-center gap-2 sm:gap-3 bg-white/80 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-xl shadow-sm border border-gray-100 w-full sm:w-auto">
              <span
                className={`text-xs sm:text-sm font-medium ${!showDeactivated ? "text-red-600" : "text-gray-500"}`}
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
                className={`text-xs sm:text-sm font-medium ${showDeactivated ? "text-red-600" : "text-gray-500"}`}
              >
                Deactivated
              </span>
            </div>
          </div>

          {/* ─── LOADING ─── */}
          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* ─── CONTENT ─── */}
          {!loading && (
            <>
              {viewMode === "grid" && (
                <div className="card-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                        <div className="p-4 sm:p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-50 to-white flex items-center justify-center shadow-sm border border-red-100/50">
                              <span className="text-red-600 font-bold text-lg sm:text-xl">
                                {user.full_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${getRoleBadgeColor(user.role)}`}
                            >
                              {user.role}
                            </span>
                          </div>
                          <h3 className="font-bold text-gray-900 text-base sm:text-lg mb-1 line-clamp-1">
                            {user.full_name}
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-500 mb-2 truncate">
                            {user.email}
                          </p>
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
                            <span className="text-xs text-gray-400 group-hover:text-red-500 transition-colors font-normal">
                              Click to view details →
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {viewMode === "table" && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in-up">
                  <div className="table-scroll">
                    <table className="user-table">
                      <thead>
                        <tr>
                          <th>Full Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Employee ID</th>
                          <th>Role</th>
                          <th>Department</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="text-center py-8 sm:py-12 text-gray-500 text-sm font-normal"
                            >
                              No users found
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((user) => {
                            const department = departments.find(
                              (d) => d.id === user.department_id,
                            );
                            return (
                              <tr
                                key={user.id}
                                onClick={() => router.push(`/users/${user.id}`)}
                                onMouseEnter={() => setHoveredRow(user.id)}
                                onMouseLeave={() => setHoveredRow(null)}
                                className="cursor-pointer hover:bg-red-50 transition-colors"
                              >
                                <td className="font-semibold text-gray-900">
                                  {user.full_name}
                                </td>
                                <td className="text-gray-600">{user.email}</td>
                                <td className="text-gray-600">
                                  {user.phone || "—"}
                                </td>
                                <td className="text-gray-600 font-mono text-sm">
                                  {user.employee_id || "—"}
                                </td>
                                <td>
                                  <span
                                    className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${getRoleBadgeColor(user.role)}`}
                                  >
                                    {user.role}
                                  </span>
                                </td>
                                <td className="text-gray-600">
                                  {department?.name || "—"}
                                </td>
                                <td>
                                  <span
                                    className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${user.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                                  >
                                    {user.is_active ? "Active" : "Deactivated"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── EMPTY STATE ─── */}
          {!loading && filteredUsers.length === 0 && (
            <div className="text-center py-12 sm:py-20 fade-in-up">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  width="28"
                  height="28"
                  className="sm:w-[32px] sm:h-[32px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="1.5"
                >
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                No users found
              </h3>
              <p className="text-gray-500 mb-4 text-sm font-normal">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Add your first user to get started"}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowModal(true)}
                  className="cursor-pointer px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold"
                >
                  + Add User
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      // Create User Modal
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="flex justify-between items-start mb-4 sm:mb-6">
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                    Create User
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5 font-normal">
                    Enter user details below
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="cursor-pointer text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
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

              {/* User Type Toggle */}
              <div className="user-type-toggle mb-4 sm:mb-6">
                <button
                  type="button"
                  onClick={() => setUserType("user")}
                  className={userType === "user" ? "active" : ""}
                >
                  👤 Regular User
                </button>
                <button
                  type="button"
                  onClick={() => setUserType("manager")}
                  className={userType === "manager" ? "active" : ""}
                >
                  👔 Manager
                </button>
              </div>

              <form onSubmit={handleCreateUser}>
                <div className="modal-grid-2">
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">👤</span>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            full_name: e.target.value,
                          });
                          if (formErrors.full_name)
                            setFormErrors({ ...formErrors, full_name: "" });
                        }}
                        required
                        className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                          formErrors.full_name
                            ? "border-red-500 focus:ring-red-400/50"
                            : "border-gray-200 focus:ring-red-400/50"
                        }`}
                        placeholder="John Doe"
                      />
                    </div>
                    {formErrors.full_name && (
                      <p className="text-red-500 text-xs mt-1.5 font-medium">
                        {formErrors.full_name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">✉️</span>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({ ...formData, email: e.target.value });
                          if (formErrors.email)
                            setFormErrors({ ...formErrors, email: "" });
                        }}
                        required
                        className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                          formErrors.email
                            ? "border-red-500 focus:ring-red-400/50"
                            : "border-gray-200 focus:ring-red-400/50"
                        }`}
                        placeholder="john@company.com"
                      />
                    </div>
                    {formErrors.email && (
                      <p className="text-red-500 text-xs mt-1.5 font-medium">
                        {formErrors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🔒</span>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            password: e.target.value,
                          });
                          if (formErrors.password)
                            setFormErrors({ ...formErrors, password: "" });
                        }}
                        required
                        className={`w-full px-4 py-2.5 pl-10 pr-12 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                          formErrors.password
                            ? "border-red-500 focus:ring-red-400/50"
                            : "border-gray-200 focus:ring-red-400/50"
                        }`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {formErrors.password && (
                      <p className="text-red-500 text-xs mt-1.5 font-medium">
                        {formErrors.password}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                      Min 8 chars with uppercase, lowercase, and number
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📞</span>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => {
                          const sanitized = e.target.value.replace(
                            /[^0-9]/g,
                            "",
                          );
                          setFormData({ ...formData, phone: sanitized });
                          if (formErrors.phone)
                            setFormErrors({ ...formErrors, phone: "" });
                        }}
                        required
                        className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                          formErrors.phone
                            ? "border-red-500 focus:ring-red-400/50"
                            : "border-gray-200 focus:ring-red-400/50"
                        }`}
                        placeholder="9876543210"
                      />
                    </div>
                    {formErrors.phone && (
                      <p className="text-red-500 text-xs mt-1.5 font-medium">
                        {formErrors.phone}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                      Enter 10-digit mobile number
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Employee ID
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🆔</span>
                      <input
                        type="text"
                        value={formData.employee_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            employee_id: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all font-mono text-sm text-gray-700 placeholder-gray-400"
                        placeholder="Auto-generated"
                        readOnly
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                      Auto-generated employee ID
                    </p>
                  </div>

                  {isPlatformAdmin && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Client <span className="text-red-500">*</span>
                      </label>
                      <div className="input-icon-wrapper">
                        <span className="icon">🏢</span>
                        <select
                          value={formData.client_id}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              client_id: e.target.value,
                              department_id: "",
                            });
                            if (formErrors.client_id)
                              setFormErrors({ ...formErrors, client_id: "" });
                          }}
                          required
                          className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-sm font-normal ${
                            formErrors.client_id
                              ? "border-red-500 focus:ring-red-400/50"
                              : "border-gray-200 focus:ring-red-400/50"
                          }`}
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
                      {formErrors.client_id && (
                        <p className="text-red-500 text-xs mt-1.5 font-medium">
                          {formErrors.client_id}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                        Select the client for this user
                      </p>
                    </div>
                  )}

                  {!isPlatformAdmin && (
                    <div className="full-width">
                      <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
                        <p className="text-sm text-gray-500 font-normal">
                          User will be created under your client.
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏛️</span>
                      <select
                        value={formData.department_id}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            department_id: e.target.value,
                          });
                          if (formErrors.department_id)
                            setFormErrors({ ...formErrors, department_id: "" });
                        }}
                        required
                        className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-sm font-normal ${
                          formErrors.department_id
                            ? "border-red-500 focus:ring-red-400/50"
                            : "border-gray-200 focus:ring-red-400/50"
                        }`}
                        disabled={departmentsLoading}
                      >
                        <option value="">
                          {departmentsLoading
                            ? "⏳ Loading departments..."
                            : isPlatformAdmin && !formData.client_id
                              ? "Select a client first"
                              : filteredDepartments.length === 0
                                ? "No departments found"
                                : "Select Department"}
                        </option>
                        {filteredDepartments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {formErrors.department_id && (
                      <p className="text-red-500 text-xs mt-1.5 font-medium">
                        {formErrors.department_id}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                      {departmentsLoading
                        ? "Loading departments..."
                        : isPlatformAdmin && !formData.client_id
                          ? "Select a client to see departments"
                          : filteredDepartments.length === 0
                            ? "No departments available. Create one first."
                            : "Select a department for this user"}
                    </p>
                  </div>

                  {/* Permissions */}
                  {userType !== "manager" && subscribedServices.length > 0 && (
                    <div className="full-width">
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
                                          permissions[service.id]?.[
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

                  {userType === "manager" && (
                    <div className="full-width">
                      <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
                        <p className="text-sm text-gray-500 font-normal">
                          Managers have full permissions by default.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-6 mt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                        Creating...
                      </>
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
      // Edit User Modal
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400/60 via-amber-300/40 to-amber-400/60 rounded-t-2xl"></div>

              <div className="flex justify-between items-start mb-4 sm:mb-6">
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                    Edit User
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5 font-normal">
                    Update user information
                  </p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
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
                <div className="modal-grid-2">
                  <div className="full-width">
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📞</span>
                      <input
                        type="tel"
                        value={editFormData.phone}
                        onChange={(e) => {
                          const sanitized = e.target.value.replace(
                            /[^0-9]/g,
                            "",
                          );
                          setEditFormData({
                            ...editFormData,
                            phone: sanitized,
                          });
                          if (editErrors.phone)
                            setEditErrors({ ...editErrors, phone: "" });
                        }}
                        required
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
                      Select a department for this user
                    </p>
                  </div>
                </div>

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
                      "Update User"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      // Delete Confirmation Modal
      {showDeleteConfirm && selectedUser && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
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
              <p className="text-gray-500 text-sm mb-4 font-normal">
                Are you sure you want to deactivate{" "}
                <span className="font-semibold text-gray-700">
                  {selectedUser.full_name}
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
                  onClick={handleDeleteUser}
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
      // Restore Confirmation Modal
      {showRestoreConfirm && selectedUser && (
        <div
          className="modal-overlay"
          onClick={() => setShowRestoreConfirm(false)}
        >
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
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
              <p className="text-gray-500 text-sm mb-4 font-normal">
                Are you sure you want to restore{" "}
                <span className="font-semibold text-gray-700">
                  {selectedUser.full_name}
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
                  onClick={handleRestoreUser}
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
