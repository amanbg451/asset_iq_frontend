"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import api from "@/app/lib/api";

interface Category {
  id: string;
  name: string;
  is_active: boolean;
}

interface AssetType {
  id: string;
  name: string;
  category_id: string;
  is_active: boolean;
}

interface Department {
  id: string;
  name: string;
  is_active: boolean;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

interface Asset {
  id: string;
  client_id: string;
  category_id: string;
  type_id: string;
  department_id: string | null;
  assigned_to_user_id: string | null;
  name: string;
  description: string | null;
  serial_number: string | null;
  model: string | null;
  manufacturer: string | null;
  purchase_date: string | null;
  purchase_value: number | null;
  status: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  created_image_url: string | null;
  latest_image_url: string | null;
  qr_code_url: string | null;
}

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

export default function AssetsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<AssetType[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<AssetType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [editImagePreview, setEditImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // ─── Form State ────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    category_id: "",
    type_id: "",
    department_id: "",
    assigned_to_user_id: "",
    name: "",
    description: "",
    serial_number: "",
    model: "",
    manufacturer: "",
    purchase_date: "",
    purchase_value: "",
    status: "AVAILABLE",
    image_url: "",
  });
  const [editFormData, setEditFormData] = useState({
    category_id: "",
    type_id: "",
    department_id: "",
    assigned_to_user_id: "",
    name: "",
    description: "",
    serial_number: "",
    model: "",
    manufacturer: "",
    purchase_date: "",
    purchase_value: "",
    status: "AVAILABLE",
    image_url: "",
  });

  // ─── Assign Form State ────────────────────────────────────────────────────
  const [assignFormData, setAssignFormData] = useState({
    user_id: "",
  });

  // ─── Set mounted state ────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // ─── Fetch Categories ─────────────────────────────────────────────────────
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

  // ─── Fetch Types ──────────────────────────────────────────────────────────
  const fetchTypes = useCallback(async () => {
    try {
      const response = await api.get("/asset-types");
      const activeTypes = (response.data || []).filter(
        (t: AssetType) => t.is_active !== false,
      );
      setTypes(activeTypes);
    } catch (error: any) {
      console.error("Error fetching types:", error);
    }
  }, []);

  // ─── Fetch Departments ────────────────────────────────────────────────────
  const fetchDepartments = useCallback(async () => {
    try {
      const response = await api.get("/departments");
      const activeDepts = (response.data || []).filter(
        (d: Department) => d.is_active !== false,
      );
      setDepartments(activeDepts);
    } catch (error: any) {
      // If 403, just set empty array - user doesn't have permission
      if (error.response?.status === 403) {
        console.warn("Departments fetch skipped - insufficient permissions");
        setDepartments([]);
        return;
      }
      console.error("Error fetching departments:", error);
    }
  }, []);

  // ─── Fetch Users ──────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get("/users");
      const activeUsers = (response.data || []).filter(
        (u: User) => u.is_active !== false,
      );
      setUsers(activeUsers);
    } catch (error: any) {
      // If 403, just set empty array - user doesn't have permission
      if (error.response?.status === 403) {
        console.warn("Users fetch skipped - insufficient permissions");
        setUsers([]);
        return;
      }
      console.error("Error fetching users:", error);
    }
  }, []);

  // ─── Fetch Assets ──────────────────────────────────────────────────────────
  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/assets");
      setAssets(response.data || []);
    } catch (error: any) {
      console.error("Error fetching assets:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch assets");
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Initial fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    Promise.all([
      fetchCategories(),
      fetchTypes(),
      fetchDepartments(),
      fetchUsers(),
      fetchAssets(),
    ]);
  }, [
    router,
    fetchCategories,
    fetchTypes,
    fetchDepartments,
    fetchUsers,
    fetchAssets,
  ]);

  // ─── Filter types when category changes ──────────────────────────────────
  useEffect(() => {
    if (formData.category_id) {
      const filtered = types.filter(
        (t) => t.category_id === formData.category_id && t.is_active !== false,
      );
      setFilteredTypes(filtered);
      if (
        formData.type_id &&
        !filtered.some((t) => t.id === formData.type_id)
      ) {
        setFormData((prev) => ({ ...prev, type_id: "" }));
      }
    } else {
      setFilteredTypes([]);
    }
  }, [formData.category_id, types]);

  useEffect(() => {
    if (editFormData.category_id) {
      const filtered = types.filter(
        (t) =>
          t.category_id === editFormData.category_id && t.is_active !== false,
      );
      setFilteredTypes(filtered);
      if (
        editFormData.type_id &&
        !filtered.some((t) => t.id === editFormData.type_id)
      ) {
        setEditFormData((prev) => ({ ...prev, type_id: "" }));
      }
    }
  }, [editFormData.category_id, types]);

  // ─── Image Upload Handler ──────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const response = await api.post("/upload/asset-image", uploadFormData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const imageUrl = response.data.url;
      setFormData((prev) => ({ ...prev, image_url: imageUrl }));
      toast.success("Image uploaded successfully");
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error(error.response?.data?.detail || "Failed to upload image");
      setImagePreview("");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleEditImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setEditUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const response = await api.post("/upload/asset-image", uploadFormData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const imageUrl = response.data.url;
      setEditFormData((prev) => ({ ...prev, image_url: imageUrl }));
      toast.success("Image uploaded successfully");
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error(error.response?.data?.detail || "Failed to upload image");
      setEditImagePreview("");
    } finally {
      setEditUploading(false);
      if (editFileInputRef.current) {
        editFileInputRef.current.value = "";
      }
    }
  };

  // ─── Image URL handler with preview (fallback) ──────────────────────────
  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFormData({ ...formData, image_url: url });
    setImagePreview(url);
  };

  const handleEditImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setEditFormData({ ...editFormData, image_url: url });
    setEditImagePreview(url);
  };

  // ─── Remove Image ──────────────────────────────────────────────────────────
  const removeImage = () => {
    setFormData({ ...formData, image_url: "" });
    setImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeEditImage = () => {
    setEditFormData({ ...editFormData, image_url: "" });
    setEditImagePreview("");
    if (editFileInputRef.current) {
      editFileInputRef.current.value = "";
    }
  };

  // ─── Create Asset ──────────────────────────────────────────────────────────
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.category_id) {
      toast.error("Please select a category");
      return;
    }
    if (!formData.type_id) {
      toast.error("Please select a type");
      return;
    }
    if (!formData.name.trim()) {
      toast.error("Asset name is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        category_id: formData.category_id,
        type_id: formData.type_id,
        name: formData.name.trim(),
        status: formData.status,
      };

      if (formData.department_id)
        payload.department_id = formData.department_id;
      if (formData.assigned_to_user_id)
        payload.assigned_to_user_id = formData.assigned_to_user_id;
      if (formData.description) payload.description = formData.description;
      if (formData.serial_number)
        payload.serial_number = formData.serial_number;
      if (formData.model) payload.model = formData.model;
      if (formData.manufacturer) payload.manufacturer = formData.manufacturer;
      if (formData.purchase_date)
        payload.purchase_date = formData.purchase_date;
      if (formData.purchase_value)
        payload.purchase_value = parseFloat(formData.purchase_value);
      if (formData.image_url) payload.created_image_url = formData.image_url;

      await api.post("/assets", payload);
      toast.success("Asset created successfully");
      setShowModal(false);
      setFormData({
        category_id: "",
        type_id: "",
        department_id: "",
        assigned_to_user_id: "",
        name: "",
        description: "",
        serial_number: "",
        model: "",
        manufacturer: "",
        purchase_date: "",
        purchase_value: "",
        status: "AVAILABLE",
        image_url: "",
      });
      setImagePreview("");
      fetchAssets();
    } catch (error: any) {
      console.error("Error creating asset:", error);
      toast.error(error.response?.data?.detail || "Failed to create asset");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Update Asset ──────────────────────────────────────────────────────────
  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAsset) return;
    if (!editFormData.category_id) {
      toast.error("Please select a category");
      return;
    }
    if (!editFormData.type_id) {
      toast.error("Please select a type");
      return;
    }
    if (!editFormData.name.trim()) {
      toast.error("Asset name is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        category_id: editFormData.category_id,
        type_id: editFormData.type_id,
        name: editFormData.name.trim(),
        status: editFormData.status,
      };

      if (editFormData.department_id)
        payload.department_id = editFormData.department_id;
      if (editFormData.assigned_to_user_id)
        payload.assigned_to_user_id = editFormData.assigned_to_user_id;
      if (editFormData.description)
        payload.description = editFormData.description;
      if (editFormData.serial_number)
        payload.serial_number = editFormData.serial_number;
      if (editFormData.model) payload.model = editFormData.model;
      if (editFormData.manufacturer)
        payload.manufacturer = editFormData.manufacturer;
      if (editFormData.purchase_date)
        payload.purchase_date = editFormData.purchase_date;
      if (editFormData.purchase_value)
        payload.purchase_value = parseFloat(editFormData.purchase_value);
      if (editFormData.image_url)
        payload.created_image_url = editFormData.image_url;

      await api.patch(`/assets/${selectedAsset.id}`, payload);
      toast.success("Asset updated successfully");
      setShowEditModal(false);
      setSelectedAsset(null);
      setEditImagePreview("");
      fetchAssets();
    } catch (error: any) {
      console.error("Error updating asset:", error);
      toast.error(error.response?.data?.detail || "Failed to update asset");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete Asset ──────────────────────────────────────────────────────────
  const handleDeleteAsset = async () => {
    if (!selectedAsset) return;

    setSubmitting(true);
    try {
      await api.delete(`/assets/${selectedAsset.id}`);
      toast.success("Asset deactivated successfully");
      setShowDeleteConfirm(false);
      setSelectedAsset(null);
      fetchAssets();
    } catch (error: any) {
      console.error("Error deleting asset:", error);
      toast.error(error.response?.data?.detail || "Failed to delete asset");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Assign Asset ──────────────────────────────────────────────────────────
  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAsset) return;
    if (!assignFormData.user_id) {
      toast.error("Please select a user");
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/assets/${selectedAsset.id}/assign`, {
        user_id: assignFormData.user_id,
      });
      toast.success("Asset assigned successfully");
      setShowAssignModal(false);
      setAssignFormData({ user_id: "" });
      setSelectedAsset(null);
      fetchAssets();
    } catch (error: any) {
      console.error("Error assigning asset:", error);
      toast.error(error.response?.data?.detail || "Failed to assign asset");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Unassign Asset ──────────────────────────────────────────────────────
  const handleUnassignAsset = async (asset: Asset) => {
    setSubmitting(true);
    try {
      await api.post(`/assets/${asset.id}/unassign`);
      toast.success("Asset unassigned successfully");
      fetchAssets();
    } catch (error: any) {
      console.error("Error unassigning asset:", error);
      toast.error(error.response?.data?.detail || "Failed to unassign asset");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Open Edit Modal ──────────────────────────────────────────────────────
  const openEditModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setEditFormData({
      category_id: asset.category_id,
      type_id: asset.type_id,
      department_id: asset.department_id || "",
      assigned_to_user_id: asset.assigned_to_user_id || "",
      name: asset.name,
      description: asset.description || "",
      serial_number: asset.serial_number || "",
      model: asset.model || "",
      manufacturer: asset.manufacturer || "",
      purchase_date: asset.purchase_date || "",
      purchase_value: asset.purchase_value?.toString() || "",
      status: asset.status || "AVAILABLE",
      image_url: asset.created_image_url || "",
    });
    setEditImagePreview(asset.created_image_url || "");
    setShowEditModal(true);
  };

  // ─── Open Assign Modal ──────────────────────────────────────────────────
  const openAssignModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setAssignFormData({ user_id: "" });
    setShowAssignModal(true);
  };

  // ─── Open Delete Confirm ──────────────────────────────────────────────────
  const openDeleteConfirm = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowDeleteConfirm(true);
  };

  // ─── Get Category Name ────────────────────────────────────────────────────
  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.name : "Unknown";
  };

  // ─── Get Type Name ────────────────────────────────────────────────────────
  const getTypeName = (typeId: string) => {
    const type = types.find((t) => t.id === typeId);
    return type ? type.name : "Unknown";
  };

  // ─── Get Department Name ──────────────────────────────────────────────────
  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return "—";
    const dept = departments.find((d) => d.id === departmentId);
    return dept ? dept.name : "Unknown";
  };

  // ─── Get User Name ────────────────────────────────────────────────────────
  const getUserName = (userId: string | null) => {
    if (!userId) return "—";
    const user = users.find((u) => u.id === userId);
    return user ? user.full_name : "Unknown";
  };

  // ─── Get Status Badge Color ──────────────────────────────────────────────
  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      AVAILABLE: "bg-green-100 text-green-700",
      ASSIGNED: "bg-blue-100 text-blue-700",
      MAINTENANCE: "bg-yellow-100 text-yellow-700",
      TRANSIT: "bg-purple-100 text-purple-700",
      DECOMMISSIONED: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  // ─── Filter Assets ─────────────────────────────────────────────────────────
  const filteredAssets = assets.filter(
    (asset) =>
      asset.is_active !== false &&
      (statusFilter === "" || asset.status === statusFilter) &&
      (asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.serial_number &&
          asset.serial_number
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        getCategoryName(asset.category_id)
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        getTypeName(asset.type_id)
          .toLowerCase()
          .includes(searchTerm.toLowerCase())),
  );

  if (!mounted) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
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

        .asset-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          font-weight: 400;
        }
        .asset-table thead th {
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
        .asset-table tbody td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #1f2937;
          font-size: 14px;
          font-weight: 400;
        }
        .asset-table tbody tr {
          cursor: default;
          transition: background 0.15s ease;
        }
        .asset-table tbody tr:hover {
          background: #fef2f2;
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
        .action-btn.edit:hover {
          background: #dbeafe;
          color: #2563eb;
        }
        .action-btn.delete:hover {
          background: #fee2e2;
          color: #dc2626;
        }
        .action-btn.assign:hover {
          background: #d1fae5;
          color: #059669;
        }
        .action-btn.unassign:hover {
          background: #fef3c7;
          color: #d97706;
        }

        .status-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 600;
        }

        .filter-select {
          padding: 9px 14px;
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

        .image-preview {
          border-radius: 12px;
          overflow: hidden;
          background: #fafbfc;
          border: 1px solid #e2e8f0;
        }
        .image-preview img {
          width: 100%;
          max-height: 200px;
          object-fit: contain;
        }
        .image-thumbnail {
          width: 48px;
          height: 48px;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .upload-dropzone {
          border: 2px dashed #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #fafbfc;
        }
        .upload-dropzone:hover {
          border-color: #dc2626;
          background: #fef2f2;
        }
        .upload-dropzone.dragging {
          border-color: #dc2626;
          background: #fef2f2;
        }
        .upload-dropzone .upload-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }
        .upload-dropzone .upload-text {
          color: #64748b;
          font-size: 14px;
        }
        .upload-dropzone .upload-subtext {
          color: #94a3b8;
          font-size: 12px;
          margin-top: 4px;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-100/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative p-6 lg:p-8 max-w-7xl mx-auto">
          {/* ─── Header ─── */}
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
                    strokeWidth="2"
                  >
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-800">
                  Assets
                </h1>
              </div>
              <p className="text-gray-500 ml-14 pl-0.5 text-sm font-normal">
                Manage all company assets, assign to departments and users
              </p>
            </div>

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
              <span>Add Asset</span>
            </button>
          </div>

          {/* ─── Stats ─── */}
          {!loading && assets.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-6 fade-in-up">
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
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">
                    {assets.filter((a) => a.is_active !== false).length}
                  </p>
                  <p className="text-sm font-medium text-gray-500">
                    Total Assets
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
                    {
                      assets.filter(
                        (a) =>
                          a.is_active !== false && a.status === "AVAILABLE",
                      ).length
                    }
                  </p>
                  <p className="text-sm font-medium text-gray-500">Available</p>
                </div>
              </div>
              <div className="stat-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="1.8"
                  >
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">
                    {
                      assets.filter(
                        (a) => a.is_active !== false && a.status === "ASSIGNED",
                      ).length
                    }
                  </p>
                  <p className="text-sm font-medium text-gray-500">Assigned</p>
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
                    {assets.filter((a) => a.is_active === false).length}
                  </p>
                  <p className="text-sm font-medium text-gray-500">
                    Deactivated
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── Search & Filter ─── */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 fade-in-up">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative max-w-md w-full sm:w-72">
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
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all shadow-sm text-gray-800 placeholder-gray-400 text-sm font-normal"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Status</option>
                <option value="AVAILABLE">Available</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="TRANSIT">In Transit</option>
                <option value="DECOMMISSIONED">Decommissioned</option>
              </select>
            </div>
            <div className="text-sm text-gray-500 font-normal">
              {filteredAssets.length}{" "}
              {filteredAssets.length === 1 ? "asset" : "assets"} found
            </div>
          </div>

          {/* ─── Loading State ─── */}
          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* ─── Table ─── */}
          {!loading && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in-up">
              <div className="overflow-x-auto">
                <table className="asset-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Type</th>
                      <th>Department</th>
                      <th>Assigned To</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-center py-12 text-gray-500 text-sm font-normal"
                        >
                          {searchTerm || statusFilter
                            ? "No assets match your filters"
                            : "No assets found. Create your first asset!"}
                        </td>
                      </tr>
                    ) : (
                      filteredAssets.map((asset) => (
                        <tr
                          key={asset.id}
                          onClick={() => router.push(`/assets/${asset.id}`)}
                          className="cursor-pointer hover:bg-red-50 transition-colors"
                        >
                          <td>
                            {asset.created_image_url ? (
                              <img
                                src={asset.created_image_url}
                                alt={asset.name}
                                className="image-thumbnail"
                                onError={(e) =>
                                  ((
                                    e.target as HTMLImageElement
                                  ).style.display = "none")
                                }
                              />
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="font-semibold text-gray-900">
                            {asset.name}
                          </td>
                          <td className="text-gray-600">
                            {getCategoryName(asset.category_id)}
                          </td>
                          <td className="text-gray-600">
                            {getTypeName(asset.type_id)}
                          </td>
                          <td className="text-gray-600">
                            {getDepartmentName(asset.department_id)}
                          </td>
                          <td className="text-gray-600">
                            {getUserName(asset.assigned_to_user_id)}
                          </td>
                          <td>
                            <span
                              className={`status-badge ${getStatusBadge(asset.status)}`}
                            >
                              {asset.status || "AVAILABLE"}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1">
                              {asset.assigned_to_user_id ? (
                                <button
                                  onClick={() => handleUnassignAsset(asset)}
                                  className="action-btn unassign"
                                  title="Unassign"
                                  disabled={submitting}
                                >
                                  <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                                    <path d="M16 3.13a4 4 0 010 7.75" />
                                    <line x1="16" y1="8" x2="22" y2="14" />
                                    <line x1="22" y1="8" x2="16" y2="14" />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  onClick={() => openAssignModal(asset)}
                                  className="action-btn assign"
                                  title="Assign"
                                >
                                  <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                                    <path d="M16 3.13a4 4 0 010 7.75" />
                                    <path d="M16 8l6 6" />
                                    <path d="M22 8l-6 6" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={() => openEditModal(asset)}
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
                                onClick={() => openDeleteConfirm(asset)}
                                className="action-btn delete"
                                title="Deactivate"
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

      {/* ─── ENHANCED: Create Asset Modal with Image Upload ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Create Asset
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5 font-normal">
                    Add a new asset to the system
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

              <form onSubmit={handleCreateAsset}>
                <div className="modal-grid-2">
                  {/* Asset Name - full width */}
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Asset Name <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏷️</span>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                        autoComplete="off"
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Dell Latitude 5440"
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📂</span>
                      <select
                        value={formData.category_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            category_id: e.target.value,
                            type_id: "",
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all bg-white text-gray-800 text-sm font-normal"
                      >
                        <option value="">Select Category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🔧</span>
                      <select
                        value={formData.type_id}
                        onChange={(e) =>
                          setFormData({ ...formData, type_id: e.target.value })
                        }
                        required
                        disabled={!formData.category_id}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all bg-white text-gray-800 text-sm font-normal disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">
                          {formData.category_id
                            ? "Select Type"
                            : "Select Category First"}
                        </option>
                        {filteredTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description - full width */}
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Description
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon icon-top">📝</span>
                      <textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        rows={2}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all resize-none input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Optional description"
                      />
                    </div>
                  </div>

                  {/* Serial Number */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Serial Number
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🔢</span>
                      <input
                        type="text"
                        value={formData.serial_number}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            serial_number: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="SN-12345"
                      />
                    </div>
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Model
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📟</span>
                      <input
                        type="text"
                        value={formData.model}
                        onChange={(e) =>
                          setFormData({ ...formData, model: e.target.value })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Latitude 5440"
                      />
                    </div>
                  </div>

                  {/* Manufacturer */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Manufacturer
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏭</span>
                      <input
                        type="text"
                        value={formData.manufacturer}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            manufacturer: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Dell"
                      />
                    </div>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Department
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
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all bg-white text-gray-800 text-sm font-normal"
                      >
                        <option value="">Select Department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Assigned To */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Assigned To
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">👤</span>
                      <select
                        value={formData.assigned_to_user_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            assigned_to_user_id: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all bg-white text-gray-800 text-sm font-normal"
                      >
                        <option value="">Select User</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Purchase Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Purchase Date
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📅</span>
                      <input
                        type="date"
                        value={formData.purchase_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            purchase_date: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 text-sm font-normal"
                      />
                    </div>
                  </div>

                  {/* Purchase Value */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Purchase Value ($)
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">💰</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.purchase_value}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            purchase_value: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Image Upload - full width */}
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Asset Image
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <div
                      className="upload-dropzone"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add("dragging");
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove("dragging");
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove("dragging");
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          const inputEvent = new Event("change", {
                            bubbles: true,
                          });
                          Object.defineProperty(inputEvent, "target", {
                            value: { files: [file] },
                          });
                          handleImageUpload(inputEvent as any);
                        }
                      }}
                    >
                      {uploading ? (
                        <div className="flex items-center justify-center gap-3 py-4">
                          <span className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></span>
                          <span className="text-sm text-gray-500">
                            Uploading...
                          </span>
                        </div>
                      ) : formData.image_url ? (
                        <div className="flex items-center justify-center gap-3 py-2">
                          <span className="text-green-500 text-lg">✅</span>
                          <span className="text-sm text-gray-600">
                            Image uploaded successfully
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage();
                            }}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="upload-icon">🖼️</div>
                          <p className="upload-text">
                            Click or drag to upload image
                          </p>
                          <p className="upload-subtext">
                            PNG, JPG, JPEG up to 5MB
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Image Preview */}
                    {imagePreview && (
                      <div className="image-preview p-2 mt-3">
                        <img
                          src={imagePreview}
                          alt="Asset preview"
                          className="w-full max-h-48 object-contain"
                          onError={() => setImagePreview("")}
                        />
                      </div>
                    )}

                    {/* Fallback URL input */}
                    <div className="mt-3">
                      <p className="text-xs text-gray-400 mb-1">
                        Or enter image URL directly
                      </p>
                      <input
                        type="text"
                        value={formData.image_url}
                        onChange={handleImageUrlChange}
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 text-sm"
                        placeholder="https://example.com/asset-image.jpg"
                        disabled={uploading}
                      />
                    </div>
                  </div>

                  {/* Status - full width */}
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📊</span>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all bg-white text-gray-800 text-sm font-normal"
                      >
                        <option value="AVAILABLE">Available</option>
                        <option value="ASSIGNED">Assigned</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="TRANSIT">In Transit</option>
                        <option value="DECOMMISSIONED">Decommissioned</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-6 mt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="cursor-pointer flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || uploading}
                    className="cursor-pointer flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                        Creating...
                      </>
                    ) : (
                      "Create Asset"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── ENHANCED: Edit Asset Modal with Image Upload ─── */}
      {showEditModal && selectedAsset && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Edit Asset
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5 font-normal">
                    Update asset details
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

              <form onSubmit={handleUpdateAsset}>
                <div className="modal-grid-2">
                  {/* Asset Name - full width */}
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Asset Name <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏷️</span>
                      <input
                        type="text"
                        value={editFormData.name}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            name: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📂</span>
                      <select
                        value={editFormData.category_id}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            category_id: e.target.value,
                            type_id: "",
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all bg-white text-gray-800 text-sm font-normal"
                      >
                        <option value="">Select Category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🔧</span>
                      <select
                        value={editFormData.type_id}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            type_id: e.target.value,
                          })
                        }
                        required
                        disabled={!editFormData.category_id}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all bg-white text-gray-800 text-sm font-normal disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">
                          {editFormData.category_id
                            ? "Select Type"
                            : "Select Category First"}
                        </option>
                        {filteredTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description - full width */}
                  <div className="full-width">
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
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all resize-none input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Optional description"
                      />
                    </div>
                  </div>

                  {/* Serial Number */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Serial Number
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🔢</span>
                      <input
                        type="text"
                        value={editFormData.serial_number}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            serial_number: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                      />
                    </div>
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Model
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📟</span>
                      <input
                        type="text"
                        value={editFormData.model}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            model: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                      />
                    </div>
                  </div>

                  {/* Manufacturer */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Manufacturer
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏭</span>
                      <input
                        type="text"
                        value={editFormData.manufacturer}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            manufacturer: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                      />
                    </div>
                  </div>

                  {/* Department */}
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
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Assigned To */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Assigned To
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">👤</span>
                      <select
                        value={editFormData.assigned_to_user_id}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            assigned_to_user_id: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all bg-white text-gray-800 text-sm font-normal"
                      >
                        <option value="">Select User</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Purchase Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Purchase Date
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📅</span>
                      <input
                        type="date"
                        value={editFormData.purchase_date}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            purchase_date: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 text-sm font-normal"
                      />
                    </div>
                  </div>

                  {/* Purchase Value */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Purchase Value ($)
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">💰</span>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.purchase_value}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            purchase_value: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Image Upload - full width */}
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Asset Image
                    </label>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleEditImageUpload}
                      className="hidden"
                      disabled={editUploading}
                    />
                    <div
                      className="upload-dropzone"
                      onClick={() => editFileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add("dragging");
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove("dragging");
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove("dragging");
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          const inputEvent = new Event("change", {
                            bubbles: true,
                          });
                          Object.defineProperty(inputEvent, "target", {
                            value: { files: [file] },
                          });
                          handleEditImageUpload(inputEvent as any);
                        }
                      }}
                    >
                      {editUploading ? (
                        <div className="flex items-center justify-center gap-3 py-4">
                          <span className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                          <span className="text-sm text-gray-500">
                            Uploading...
                          </span>
                        </div>
                      ) : editFormData.image_url ? (
                        <div className="flex items-center justify-center gap-3 py-2">
                          <span className="text-green-500 text-lg">✅</span>
                          <span className="text-sm text-gray-600">
                            Image uploaded successfully
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeEditImage();
                            }}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="upload-icon">🖼️</div>
                          <p className="upload-text">
                            Click or drag to upload image
                          </p>
                          <p className="upload-subtext">
                            PNG, JPG, JPEG up to 5MB
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Image Preview */}
                    {editImagePreview && (
                      <div className="image-preview p-2 mt-3">
                        <img
                          src={editImagePreview}
                          alt="Asset preview"
                          className="w-full max-h-48 object-contain"
                          onError={() => setEditImagePreview("")}
                        />
                      </div>
                    )}

                    {/* Fallback URL input */}
                    <div className="mt-3">
                      <p className="text-xs text-gray-400 mb-1">
                        Or enter image URL directly
                      </p>
                      <input
                        type="text"
                        value={editFormData.image_url}
                        onChange={handleEditImageUrlChange}
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 text-sm"
                        placeholder="https://example.com/asset-image.jpg"
                        disabled={editUploading}
                      />
                    </div>
                  </div>

                  {/* Status - full width */}
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📊</span>
                      <select
                        value={editFormData.status}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            status: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all bg-white text-gray-800 text-sm font-normal"
                      >
                        <option value="AVAILABLE">Available</option>
                        <option value="ASSIGNED">Assigned</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="TRANSIT">In Transit</option>
                        <option value="DECOMMISSIONED">Decommissioned</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Actions */}
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
                    disabled={submitting || editUploading}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                        Updating...
                      </>
                    ) : (
                      "Update Asset"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── ENHANCED: Assign Modal ─── */}
      {showAssignModal && selectedAsset && (
        <div
          className="modal-overlay"
          onClick={() => setShowAssignModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-400/60 via-green-300/40 to-green-400/60 rounded-t-2xl"></div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Assign Asset
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5 font-normal">
                    Assign{" "}
                    <span className="font-semibold">{selectedAsset.name}</span>{" "}
                    to a user
                  </p>
                </div>
                <button
                  onClick={() => setShowAssignModal(false)}
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

              <form onSubmit={handleAssignAsset}>
                <div className="modal-grid-2">
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Select User <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">👤</span>
                      <select
                        value={assignFormData.user_id}
                        onChange={(e) =>
                          setAssignFormData({
                            ...assignFormData,
                            user_id: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400 transition-all bg-white text-gray-800 text-sm font-normal"
                      >
                        <option value="">Select a user</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.full_name} ({user.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="full-width">
                    <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                      <p className="text-sm text-green-700 font-medium">
                        <span className="font-bold">Note:</span> Assigning this
                        asset will change its status to "ASSIGNED".
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-6 mt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                        Assigning...
                      </>
                    ) : (
                      "Assign Asset"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── ENHANCED: Delete Confirmation ─── */}
      {showDeleteConfirm && selectedAsset && (
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
                Deactivate Asset?
              </h3>
              <p className="text-gray-500 text-sm mb-2 font-normal">
                Are you sure you want to deactivate{" "}
                <span className="font-semibold text-gray-700">
                  {selectedAsset.name}
                </span>
                ?
              </p>
              <p className="text-xs text-gray-400 mb-4 font-normal">
                This will hide the asset from active lists. This action can be
                reversed.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAsset}
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
    </>
  );
}
