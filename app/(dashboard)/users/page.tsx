"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
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

// ─── Helper: Export to CSV ──────────────────────────────────────────────────
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

// ─── Helper: Validate Phone Number ──────────────────────────────────────────
const validatePhoneNumber = (phone: string): boolean => {
  // Remove all spaces, dashes, parentheses, and plus sign
  const cleanPhone = phone.replace(/[\s\-()]/g, "");

  // Check if phone is exactly 10 digits
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(cleanPhone);
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
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  // ─── Password visibility states ────────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // ─── Phone validation error states ────────────────────────────────────────
  const [phoneError, setPhoneError] = useState("");
  const [editPhoneError, setEditPhoneError] = useState("");

  const exportButtonRef = useRef<HTMLButtonElement>(null);
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

  // ─── Permissions state ──────────────────────────────────────────────────────
  const [permissions, setPermissions] = useState<Record<string, Permission>>(
    {},
  );

  // ─── Get user role ──────────────────────────────────────────────────────────
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

  // ─── Fetch users with deactivated support ────────────────────────────────
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

  // ─── Fetch departments ──────────────────────────────────────────────────────
  const fetchDepartments = async () => {
    try {
      const response = await api.get("/departments");
      setDepartments(response.data);
    } catch (error: any) {
      console.error("Error fetching departments:", error);
    }
  };

  // ─── Fetch clients for dropdown ────────────────────────────────────────────
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

  // ─── Fetch subscribed services for permissions ─────────────────────────────
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

  // ─── Check licence limit before creating user ─────────────────────────────
  const checkLicenceLimit = async (): Promise<boolean> => {
    try {
      const clientId = getClientIdFromToken();
      const isClientAdmin = getUserRoleFromToken() === "CLIENT_ADMIN";

      // For Platform Admin with manual client selection
      if (!clientId) {
        if (formData.client_id) {
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
            // If we can't access subscription (403), skip the check
            if (error.response?.status === 403) {
              console.warn(
                "Subscription check skipped - insufficient permissions",
              );
              return true;
            }
            throw error;
          }
        }
        return true;
      }

      // For Client Admin, try to fetch subscription, but handle 403 gracefully
      try {
        const subRes = await api.get(`/clients/${clientId}/subscriptions`);
        const totalLicences = subRes.data?.licence_count || 0;
        const usedLicences = subRes.data?.used_licences || 0;

        if (usedLicences >= totalLicences && totalLicences > 0) {
          toast.error(
            `Licence limit reached (${totalLicences}/${totalLicences}). Please upgrade your subscription.`,
          );
          return false;
        }

        const remaining = totalLicences - usedLicences;
        if (remaining <= 5 && remaining > 0) {
          toast(`Only ${remaining} licence(s) remaining`, { icon: "⚠️" });
        }

        return true;
      } catch (error: any) {
        // If we can't access subscription (403), skip the check
        if (error.response?.status === 403) {
          console.warn("Subscription check skipped - insufficient permissions");
          return true;
        }
        throw error;
      }
    } catch (error: any) {
      console.error("Error checking licence limit:", error);
      // If there's any error, allow the user creation to proceed
      // The backend will enforce the limit anyway
      return true;
    }
  };

  // ─── Auto-generate Sequential Employee ID ──────────────────────────────────
  const generateEmployeeId = useCallback(() => {
    // Get the highest existing employee ID
    const existingIds = users
      .map((u) => u.employee_id)
      .filter((id) => id && id.startsWith("EMP"))
      .map((id) => parseInt(id.replace("EMP", "")))
      .filter((num) => !isNaN(num));

    let nextNumber = 1;
    if (existingIds.length > 0) {
      nextNumber = Math.max(...existingIds) + 1;
    }

    // Pad with leading zeros to make it 6 digits
    const paddedNumber = nextNumber.toString().padStart(6, "0");
    return `EMP${paddedNumber}`;
  }, [users]);

  // ─── Filter departments when client changes ────────────────────────────────
  useEffect(() => {
    // Get client_id from token for Client Admin
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

    const tokenClientId = getClientIdFromToken();
    const isClientAdmin = getUserRoleFromToken() === "CLIENT_ADMIN";

    // Use token client_id for Client Admin, or formData.client_id for Platform Admin
    const effectiveClientId = isClientAdmin
      ? tokenClientId
      : formData.client_id;

    if (effectiveClientId) {
      const filtered = departments.filter(
        (dept) =>
          dept.client_id === effectiveClientId && dept.is_active !== false,
      );
      setFilteredDepartments(filtered);
      // Reset department if current selection is not in filtered list
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

  useEffect(() => {
    if (showModal) {
      setFormData((prev) => ({
        ...prev,
        employee_id: generateEmployeeId(),
      }));
      fetchSubscribedServices();
      if (isPlatformAdmin) {
        fetchClients();
      }
    } else {
      setPermissions({});
      setSubscribedServices([]);
      setFilteredDepartments([]);
      setPhoneError("");
      setShowPassword(false);
    }
  }, [showModal, isPlatformAdmin, generateEmployeeId]);

  // ─── Initial data fetch ────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchUsers();
    fetchDepartments();
  }, [router, fetchUsers]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow digits
    const sanitized = value.replace(/[^0-9]/g, "");
    setFormData({ ...formData, phone: sanitized });

    // Validate - exactly 10 digits
    if (sanitized && sanitized.length !== 10) {
      setPhoneError("Phone number must be exactly 10 digits");
    } else {
      setPhoneError("");
    }
  };

  const handleEditPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const sanitized = value.replace(/[^0-9]/g, "");
    setEditFormData({ ...editFormData, phone: sanitized });

    if (sanitized && sanitized.length !== 10) {
      setEditPhoneError("Phone number must be exactly 10 digits");
    } else {
      setEditPhoneError("");
    }
  };

  // ─── Create User with permissions ──────────────────────────────────────────
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!formData.password || formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!formData.department_id) {
      toast.error("Please select a department");
      return;
    }

    // ─── Phone validation ───
    if (!formData.phone || formData.phone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    // ─── Phone validation ───
    if (!editFormData.phone || editFormData.phone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
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
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone || "",
        employee_id: formData.employee_id || generateEmployeeId(),
        department_id: formData.department_id,
      };

      const permissionsArray = Object.values(permissions);

      if (userType === "manager") {
        await api.post("/users/managers", payloadData);
        toast.success("Manager created successfully");
      } else {
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
      setPhoneError("");
      setShowPassword(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      const errorMsg =
        error.response?.data?.detail ||
        error.message ||
        "Failed to create user";
      toast.error(
        typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!editFormData.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!editFormData.department_id) {
      toast.error("Please select a department");
      return;
    }

    // ─── Phone validation ───
    if (editFormData.phone && !validatePhoneNumber(editFormData.phone)) {
      toast.error("Please enter a valid phone number (10-15 digits)");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint =
        selectedUser.role === "MANAGER"
          ? `/users/managers/${selectedUser.id}`
          : `/users/${selectedUser.id}`;
      await api.patch(endpoint, {
        full_name: editFormData.full_name.trim(),
        phone: editFormData.phone || "",
        department_id: editFormData.department_id,
      });
      toast.success("User updated successfully");
      setShowEditModal(false);
      setEditPhoneError("");
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
    setEditPhoneError("");
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

  // ─── Export Handlers ──────────────────────────────────────────────────────
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
        
        .perm-checkbox {
          accent-color: #dc2626;
        }
        .perm-label {
          font-size: 12px;
          font-weight: 500;
          color: #374151;
        }

        /* ─── Table Styles ──────────────────────────────────────────────────── */
        .user-table {
          width: 100%;
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
        /* Password toggle button */
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
        /* User type toggle */
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
        /* Phone input with error state */
        .input-error {
          border-color: #ef4444 !important;
        }
        .input-error:focus {
          ring-color: #ef4444 !important;
          border-color: #ef4444 !important;
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
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                    <path d="M17 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-800">
                  Users
                </h1>
              </div>
              <p className="text-gray-500 ml-14 pl-0.5 text-sm font-normal">
                Manage employees, managers, and system users
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

              {/* ─── Add User Button ─── */}
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
                <span>Add User</span>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {!loading && users.length > 0 && (
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
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">
                    {users.length}
                  </p>
                  <p className="text-sm font-medium text-gray-500">
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
                placeholder="Search users by name, email, or role..."
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
                          <p className="text-sm text-gray-500 mb-2">
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

              {/* ─── TABLE VIEW ─── */}
              {viewMode === "table" && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in-up">
                  <div className="overflow-x-auto">
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
                              className="text-center py-12 text-gray-500 text-sm font-normal"
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
                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(user.role)}`}
                                  >
                                    {user.role}
                                  </span>
                                </td>
                                <td className="text-gray-600">
                                  {department?.name || "—"}
                                </td>
                                <td>
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${user.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
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

      {/* ─── ENHANCED: Create User Modal ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Create User
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5 font-normal">
                    Enter user details below
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

              {/* User Type Toggle */}
              <div className="user-type-toggle mb-6">
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
                  {/* Full Name - full width */}
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">👤</span>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            full_name: e.target.value,
                          })
                        }
                        required
                        autoComplete="off"
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">✉️</span>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                        autoComplete="new-email"
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>

                  {/* Password with show/hide */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🔒</span>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        required
                        autoComplete="new-password"
                        className="w-full px-4 py-2.5 pl-10 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
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
                    <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                      Min 8 characters with uppercase, lowercase, and number
                    </p>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📞</span>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        required
                        autoComplete="new-phone"
                        className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                          phoneError
                            ? "border-red-500 focus:ring-red-500/50 focus:border-red-500"
                            : "border-gray-200 focus:ring-red-400/50 focus:border-red-400"
                        }`}
                        placeholder="9876543210"
                      />
                    </div>
                    {phoneError && (
                      <p className="text-xs text-red-500 mt-1.5 ml-1 font-normal">
                        {phoneError}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                      Enter 10-digit mobile number
                    </p>
                  </div>

                  {/* Employee ID */}
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

                  {/* Client Dropdown - Platform Admin only */}
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
                          }}
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

                  {/* Department Dropdown */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏛️</span>
                      <select
                        value={formData.department_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            department_id: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all bg-white text-gray-800 text-sm font-normal"
                      >
                        <option value="">
                          {isPlatformAdmin && !formData.client_id
                            ? "Select a client first"
                            : filteredDepartments.length === 0 &&
                                !isPlatformAdmin
                              ? "Create a department first"
                              : "Select Department"}
                        </option>
                        {filteredDepartments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                      {isPlatformAdmin && !formData.client_id
                        ? "Select a client to see departments"
                        : filteredDepartments.length === 0 && !isPlatformAdmin
                          ? "Create a department first in the Departments section"
                          : "Select a department for this user"}
                    </p>
                  </div>

                  {/* Permissions UI - full width */}
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

                {/* Actions */}
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

      {/* Edit User Modal - Enhanced */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400/60 via-amber-300/40 to-amber-400/60 rounded-t-2xl"></div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Edit User
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5 font-normal">
                    Update user information
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
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            full_name: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Enter full name"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📞</span>
                      <input
                        type="tel"
                        value={editFormData.phone}
                        onChange={handleEditPhoneChange}
                        required
                        className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                          editPhoneError
                            ? "border-red-500 focus:ring-red-500/50 focus:border-red-500"
                            : "border-gray-200 focus:ring-amber-400/50 focus:border-amber-400"
                        }`}
                        placeholder="9876543210"
                      />
                    </div>
                    {editPhoneError && (
                      <p className="text-xs text-red-500 mt-1.5 ml-1 font-normal">
                        {editPhoneError}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                      Enter 10-digit mobile number
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Department
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏛️</span>
                      <select
                        value={editFormData.department_id}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            department_id: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all bg-white text-gray-800 text-sm font-normal"
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

      {/* Delete Confirmation Modal - Enhanced */}
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

      {/* Restore Confirmation Modal - Enhanced */}
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
