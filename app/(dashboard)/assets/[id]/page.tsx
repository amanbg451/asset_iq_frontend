"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import api from "@/app/lib/api";

interface AssetDetail {
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
  qr_code_url: string | null;
  created_image_url: string | null;
  latest_image_url: string | null;
  current_latitude: number | null;
  current_longitude: number | null;
  last_scanned_at: string | null;
  last_scanned_by: string | null;
  remarks: string | null;
  created_by: string;
  created_at: string;
}

interface Audit {
  id: string;
  asset_id: string;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  remarks: string | null;
  asset_condition: string;
  tag_state: string;
  scanned_by: string;
  scanned_at: string;
}

interface Category {
  id: string;
  name: string;
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
}

interface User {
  id: string;
  full_name: string;
  email: string;
}

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams();
  const assetId = params.id as string;

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<AssetType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"info" | "audits" | "location">(
    "info",
  );
  const [mounted, setMounted] = useState(false);

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editImagePreview, setEditImagePreview] = useState("");

  // Form states
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
    status: "",
    image_url: "",
  });
  const [assignFormData, setAssignFormData] = useState({
    user_id: "",
  });
  const [verifyFormData, setVerifyFormData] = useState({
    latitude: "",
    longitude: "",
    asset_condition: "ACTIVE",
    remarks: "",
    image_url: "",
  });

  // ─── Set mounted state ────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // ─── Fetch Asset Data ──────────────────────────────────────────────────────
  const fetchAssetData = async () => {
    try {
      setLoading(true);

      const [assetRes, auditsRes, categoriesRes, typesRes, deptsRes, usersRes] =
        await Promise.all([
          api.get(`/assets/${assetId}`).catch(() => ({ data: null })),
          api.get(`/assets/${assetId}/audits`).catch(() => ({ data: [] })),
          api.get("/asset-categories").catch(() => ({ data: [] })),
          api.get("/asset-types").catch(() => ({ data: [] })),
          api.get("/departments").catch(() => ({ data: [] })),
          api.get("/users").catch(() => ({ data: [] })),
        ]);

      setAsset(assetRes.data);
      setAudits(auditsRes.data || []);
      setCategories(categoriesRes.data || []);
      setTypes(typesRes.data || []);
      setDepartments(deptsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error: any) {
      console.error("Error fetching asset:", error);
      toast.error("Failed to load asset details");
      router.push("/assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    if (assetId) {
      fetchAssetData();
    }
  }, [assetId, mounted]);

  // ─── Get Helper Names ──────────────────────────────────────────────────────
  const getCategoryName = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? cat.name : "Unknown";
  };

  const getTypeName = (id: string) => {
    const type = types.find((t) => t.id === id);
    return type ? type.name : "Unknown";
  };

  const getDepartmentName = (id: string | null) => {
    if (!id) return "—";
    const dept = departments.find((d) => d.id === id);
    return dept ? dept.name : "Unknown";
  };

  const getUserName = (id: string | null) => {
    if (!id) return "—";
    const user = users.find((u) => u.id === id);
    return user ? user.full_name : "Unknown";
  };

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

  const getConditionBadge = (condition: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-700",
      MAINTENANCE: "bg-yellow-100 text-yellow-700",
      DECOMMISSIONED: "bg-red-100 text-red-700",
      DAMAGED: "bg-red-100 text-red-700",
    };
    return colors[condition] || "bg-gray-100 text-gray-700";
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString();
  };

  // ─── Format Purchase Value ──────────────────────────────────────────────────
  const formatPurchaseValue = (value: string | number | null) => {
    if (!value) return "—";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "—";
    return `$${num.toFixed(2)}`;
  };

  // ─── Edit Asset ────────────────────────────────────────────────────────────
  const openEditModal = () => {
    if (!asset) return;
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

  // ─── Image URL handler with preview ──────────────────────────────────────
  const handleEditImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setEditFormData({ ...editFormData, image_url: url });
    setEditImagePreview(url);
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;
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
      if (editFormData.image_url) payload.created_image_url = editFormData.image_url;

      await api.patch(`/assets/${asset.id}`, payload);
      toast.success("Asset updated successfully");
      setShowEditModal(false);
      setEditImagePreview("");
      fetchAssetData();
    } catch (error: any) {
      console.error("Error updating asset:", error);
      toast.error(error.response?.data?.detail || "Failed to update asset");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete Asset ──────────────────────────────────────────────────────────
  const handleDeleteAsset = async () => {
    if (!asset) return;
    setSubmitting(true);
    try {
      await api.delete(`/assets/${asset.id}`);
      toast.success("Asset deactivated successfully");
      setShowDeleteConfirm(false);
      router.push("/assets");
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
    if (!asset) return;
    setSubmitting(true);
    try {
      await api.post(`/assets/${asset.id}/assign`, {
        user_id: assignFormData.user_id,
      });
      toast.success("Asset assigned successfully");
      setShowAssignModal(false);
      setAssignFormData({ user_id: "" });
      fetchAssetData();
    } catch (error: any) {
      console.error("Error assigning asset:", error);
      toast.error(error.response?.data?.detail || "Failed to assign asset");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Unassign Asset ──────────────────────────────────────────────────────
  const handleUnassignAsset = async () => {
    if (!asset) return;
    setSubmitting(true);
    try {
      await api.post(`/assets/${asset.id}/unassign`);
      toast.success("Asset unassigned successfully");
      fetchAssetData();
    } catch (error: any) {
      console.error("Error unassigning asset:", error);
      toast.error(error.response?.data?.detail || "Failed to unassign asset");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Verify Asset ──────────────────────────────────────────────────────────
  const handleVerifyAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;
    setSubmitting(true);
    try {
      const payload: any = {
        latitude: parseFloat(verifyFormData.latitude) || 0,
        longitude: parseFloat(verifyFormData.longitude) || 0,
        asset_condition: verifyFormData.asset_condition,
        remarks: verifyFormData.remarks || "",
      };
      if (verifyFormData.image_url)
        payload.image_url = verifyFormData.image_url;

      await api.post(`/assets/${asset.id}/verify`, payload);
      toast.success("Asset verified successfully");
      setShowVerifyModal(false);
      setVerifyFormData({
        latitude: "",
        longitude: "",
        asset_condition: "ACTIVE",
        remarks: "",
        image_url: "",
      });
      fetchAssetData();
    } catch (error: any) {
      console.error("Error verifying asset:", error);
      toast.error(error.response?.data?.detail || "Failed to verify asset");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Regenerate QR ────────────────────────────────────────────────────────
  const handleRegenerateQR = async () => {
    if (!asset) return;
    setSubmitting(true);
    try {
      const response = await api.post(`/assets/${asset.id}/regenerate-qr`);
      toast.success("QR code regenerated successfully");
      setAsset((prev) =>
        prev ? { ...prev, qr_code_url: response.data.qr_code_url } : null,
      );
    } catch (error: any) {
      console.error("Error regenerating QR:", error);
      toast.error(error.response?.data?.detail || "Failed to regenerate QR");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading State ────────────────────────────────────────────────────────
  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="text-center">
          <p className="text-gray-500">Asset not found</p>
          <button
            onClick={() => router.push("/assets")}
            className="mt-4 text-red-600 hover:underline cursor-pointer"
          >
            Back to Assets
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
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          border-radius: 32px;
          width: 95%;
          max-width: 820px;
          max-height: 90vh;
          overflow-y: auto;
          animation: fadeInScale 0.35s cubic-bezier(0.2, 0.9, 0.4, 1.2);
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(220, 38, 38, 0.08);
          padding: 24px 28px 28px;
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

        .info-card {
          background: white;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
          transition: all 0.3s ease;
          cursor: default;
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

        .tab-btn {
          padding: 7px 18px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          background: transparent;
          color: #64748b;
        }
        .tab-btn:hover {
          background: #f1f5f9;
          color: #1e293b;
        }
        .tab-btn.active {
          background: #dc2626;
          color: white;
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.25);
        }

        .audit-item {
          padding: 10px 14px;
          border-left: 3px solid #e2e8f0;
          margin-bottom: 10px;
          background: #fafbfc;
          border-radius: 0 10px 10px 0;
          transition: background 0.2s ease;
          cursor: default;
        }
        .audit-item:hover {
          background: #f1f5f9;
        }

        .qr-code-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          background: #fafbfc;
          border-radius: 16px;
          border: 2px dashed #e2e8f0;
        }
        .qr-code-container img {
          max-width: 200px;
          height: auto;
        }

        .modal-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px 20px;
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
          font-size: 15px;
          line-height: 1;
        }
        .input-icon-wrapper input,
        .input-icon-wrapper textarea,
        .input-icon-wrapper select {
          padding-left: 40px;
        }
        .input-icon-wrapper textarea {
          padding-top: 10px;
          padding-bottom: 10px;
          resize: vertical;
          min-height: 48px;
        }
        .input-icon-wrapper .icon-top {
          top: 14px;
          transform: none;
        }
        .input-icon-wrapper select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 40px;
        }
        .modal-label {
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 4px;
          display: block;
        }
        .modal-input,
        .modal-select,
        .modal-textarea {
          width: 100%;
          padding: 8px 12px 8px 40px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          font-size: 13px;
          transition: all 0.2s ease;
          background: #fafbfc;
          color: #1f2937;
        }
        .modal-input:focus,
        .modal-select:focus,
        .modal-textarea:focus {
          outline: none;
          ring: 2px solid rgba(220, 38, 38, 0.4);
          border-color: #dc2626;
          background: white;
        }
        .modal-input::placeholder,
        .modal-textarea::placeholder {
          color: #9ca3af;
          font-weight: 400;
          opacity: 0.9;
        }
        .modal-select {
          padding-right: 40px;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
        }
        .modal-textarea {
          padding-top: 10px;
          padding-bottom: 10px;
          resize: vertical;
          min-height: 48px;
        }
        .modal-input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
          font-size: 15px;
          line-height: 1;
        }
        .modal-input-icon-top {
          top: 14px;
          transform: none;
        }

        .asset-image-container {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fafbfc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          min-height: 120px;
        }
        .asset-image-container img {
          width: 100%;
          max-height: 200px;
          object-fit: contain;
        }
        .asset-image-container .no-image {
          color: #9ca3af;
          font-size: 13px;
          padding: 20px;
          text-align: center;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-100/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative p-6 lg:p-8 max-w-6xl mx-auto">
          {/* ─── Back Button ─── */}
          <button
            onClick={() => router.push("/assets")}
            className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors mb-6 group fade-in-up cursor-pointer"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span className="text-sm">Back to Assets</span>
          </button>

          {/* ─── Header ─── */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 fade-in-up">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-xl blur-md animate-pulse"></div>
                <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                  >
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                  {asset.name}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${asset.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {asset.is_active ? "Active" : "Deactivated"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusBadge(asset.status)}`}
                  >
                    {asset.status || "AVAILABLE"}
                  </span>
                  {asset.serial_number && (
                    <span className="text-xs font-mono text-gray-400">
                      SN: {asset.serial_number}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!asset.is_active && (
                <button
                  onClick={() => router.push("/assets")}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold text-xs cursor-pointer"
                >
                  Restore
                </button>
              )}
              <button
                onClick={() => setShowQRModal(true)}
                className="px-3 py-1.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-semibold text-xs cursor-pointer"
              >
                QR Code
              </button>
              <button
                onClick={() => setShowVerifyModal(true)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-xs cursor-pointer"
              >
                Verify
              </button>
              <button
                onClick={openEditModal}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold text-xs cursor-pointer"
              >
                Edit
              </button>
              {asset.is_active && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold text-xs cursor-pointer"
                >
                  Deactivate
                </button>
              )}
            </div>
          </div>

          {/* ─── Tabs ─── */}
          <div className="flex gap-1 mb-6 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-100 p-1 shadow-sm fade-in-up">
            {[
              { key: "info", label: "📋 Information" },
              { key: "audits", label: `📜 Audits (${audits.length})` },
              { key: "location", label: "📍 Location" },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key as any)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── Tab Content ─── */}
          <div className="fade-in-up">
            {/* ─── INFO TAB ─── */}
            {activeTab === "info" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Asset Image Card */}
                  <div className="info-card p-6">
                    <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="2"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      Asset Image
                    </h3>
                    <div className="asset-image-container">
                      {asset.created_image_url ? (
                        <img
                          src={asset.created_image_url}
                          alt={asset.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) {
                              const fallback = document.createElement("div");
                              fallback.className = "no-image";
                              fallback.textContent = "Image failed to load";
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      ) : (
                        <div className="no-image">
                          <div className="text-4xl mb-2">🖼️</div>
                          <p>No image available</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Add an image by editing the asset
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="info-card p-6">
                    <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4l3 3" />
                      </svg>
                      Asset Details
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Asset ID
                        </p>
                        <p className="text-xs font-mono text-gray-700 mt-1">
                          {asset.id}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Name
                        </p>
                        <p className="text-sm font-semibold text-gray-800 mt-1">
                          {asset.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Description
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {asset.description || "No description"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Serial Number
                        </p>
                        <p className="text-xs font-mono text-gray-700 mt-1">
                          {asset.serial_number || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Model
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {asset.model || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Manufacturer
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {asset.manufacturer || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="info-card p-6">
                    <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <svg
                        width="18"
                        height="18"
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
                      Purchase Info
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Purchase Date
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {asset.purchase_date
                            ? new Date(asset.purchase_date).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Purchase Value
                        </p>
                        <p className="text-sm font-semibold text-gray-800 mt-1">
                          {formatPurchaseValue(asset.purchase_value)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <div className="info-card p-6">
                    <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="2"
                      >
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Assignment
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Department
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {getDepartmentName(asset.department_id)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Assigned To
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {getUserName(asset.assigned_to_user_id)}
                        </p>
                      </div>
                      <div className="flex gap-3 pt-2">
                        {asset.assigned_to_user_id ? (
                          <button
                            onClick={handleUnassignAsset}
                            disabled={submitting}
                            className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
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
                            Unassign
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowAssignModal(true)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 00-3-3.87" />
                              <path d="M16 3.13a4 4 0 010 7.75" />
                            </svg>
                            Assign
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="info-card p-6">
                    <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="2"
                      >
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                      </svg>
                      Category & Type
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Category
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {getCategoryName(asset.category_id)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Type
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {getTypeName(asset.type_id)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Tag State
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {asset.qr_code_url ? "TAGGED" : "UNTAGGED"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="info-card p-6">
                    <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      Last Scan
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Scanned At
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {formatDate(asset.last_scanned_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Scanned By
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {getUserName(asset.last_scanned_by)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Remarks
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {asset.remarks || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── AUDITS TAB ─── */}
            {activeTab === "audits" && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="9" y1="13" x2="15" y2="13" />
                      <line x1="9" y1="17" x2="15" y2="17" />
                    </svg>
                    Audit History
                  </h3>
                  <span className="text-xs text-gray-400 font-normal">
                    {audits.length} records
                  </span>
                </div>

                {audits.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-sm font-normal">
                    No audit records found for this asset.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {audits.map((audit, index) => (
                      <div
                        key={audit.id}
                        className="audit-item fade-in-up"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getConditionBadge(audit.asset_condition)}`}
                              >
                                {audit.asset_condition}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {audit.tag_state}
                              </span>
                            </div>
                            {audit.remarks && (
                              <p className="text-sm text-gray-700 font-normal">
                                {audit.remarks}
                              </p>
                            )}
                            {audit.latitude && audit.longitude && (
                              <p className="text-[10px] text-gray-400 font-normal mt-1">
                                📍 {audit.latitude}, {audit.longitude}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <p className="text-[10px] text-gray-400 font-normal">
                              {new Date(audit.scanned_at).toLocaleString()}
                            </p>
                            <p className="text-[10px] text-gray-400 font-normal">
                              By: {getUserName(audit.scanned_by)}
                            </p>
                          </div>
                        </div>
                        {audit.image_url && (
                          <div className="mt-2">
                            <img
                              src={audit.image_url}
                              alt="Audit"
                              className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── LOCATION TAB ─── */}
            {activeTab === "location" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth="2"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    Current Location
                  </h3>
                  {asset.current_latitude && asset.current_longitude ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Latitude
                        </p>
                        <p className="text-xs font-mono text-gray-700 mt-1">
                          {asset.current_latitude}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Longitude
                        </p>
                        <p className="text-xs font-mono text-gray-700 mt-1">
                          {asset.current_longitude}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Last Updated
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {formatDate(asset.last_scanned_at)}
                        </p>
                      </div>
                      <div className="pt-2">
                        <a
                          href={`https://www.google.com/maps?q=${asset.current_latitude},${asset.current_longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition cursor-pointer"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          Open in Google Maps
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-sm font-normal">
                      No location data available for this asset.
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    Location History
                  </h3>
                  {audits.filter((a) => a.latitude && a.longitude).length ===
                  0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm font-normal">
                      No location history available.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {audits
                        .filter((a) => a.latitude && a.longitude)
                        .slice(0, 10)
                        .map((audit) => (
                          <div
                            key={audit.id}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs font-mono text-gray-600">
                                  📍 {audit.latitude}, {audit.longitude}
                                </p>
                                {audit.remarks && (
                                  <p className="text-[10px] text-gray-400 mt-1">
                                    {audit.remarks}
                                  </p>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400 font-normal">
                                {new Date(
                                  audit.scanned_at,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── ENHANCED: EDIT MODAL with Image ─── */}
      {showEditModal && asset && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    Edit Asset
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5 font-normal">
                    Update asset details
                  </p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  <svg
                    width="14"
                    height="14"
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
                    <label className="modal-label">
                      Asset Name <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">🏷️</span>
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
                        className="modal-input"
                        placeholder="Asset name"
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="modal-label">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">📂</span>
                      <select
                        value={editFormData.category_id}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            category_id: e.target.value,
                          })
                        }
                        required
                        className="modal-select"
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Type */}
                  <div>
                    <label className="modal-label">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">🔧</span>
                      <select
                        value={editFormData.type_id}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            type_id: e.target.value,
                          })
                        }
                        required
                        className="modal-select"
                      >
                        <option value="">Select Type</option>
                        {types
                          .filter(
                            (t) => t.category_id === editFormData.category_id,
                          )
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Serial Number */}
                  <div>
                    <label className="modal-label">Serial Number</label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">🔢</span>
                      <input
                        type="text"
                        value={editFormData.serial_number}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            serial_number: e.target.value,
                          })
                        }
                        className="modal-input"
                        placeholder="SN-12345"
                      />
                    </div>
                  </div>

                  {/* Model */}
                  <div>
                    <label className="modal-label">Model</label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">📟</span>
                      <input
                        type="text"
                        value={editFormData.model}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            model: e.target.value,
                          })
                        }
                        className="modal-input"
                        placeholder="Model name"
                      />
                    </div>
                  </div>

                  {/* Manufacturer */}
                  <div>
                    <label className="modal-label">Manufacturer</label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">🏭</span>
                      <input
                        type="text"
                        value={editFormData.manufacturer}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            manufacturer: e.target.value,
                          })
                        }
                        className="modal-input"
                        placeholder="Manufacturer"
                      />
                    </div>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="modal-label">Department</label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">🏛️</span>
                      <select
                        value={editFormData.department_id}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            department_id: e.target.value,
                          })
                        }
                        className="modal-select"
                      >
                        <option value="">Select Department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Assigned To */}
                  <div>
                    <label className="modal-label">Assigned To</label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">👤</span>
                      <select
                        value={editFormData.assigned_to_user_id}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            assigned_to_user_id: e.target.value,
                          })
                        }
                        className="modal-select"
                      >
                        <option value="">Select User</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Purchase Date */}
                  <div>
                    <label className="modal-label">Purchase Date</label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">📅</span>
                      <input
                        type="date"
                        value={editFormData.purchase_date}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            purchase_date: e.target.value,
                          })
                        }
                        className="modal-input"
                      />
                    </div>
                  </div>

                  {/* Purchase Value */}
                  <div>
                    <label className="modal-label">Purchase Value ($)</label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">💰</span>
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
                        className="modal-input"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Image URL - full width */}
                  <div className="full-width">
                    <label className="modal-label">Image URL</label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">🖼️</span>
                      <input
                        type="text"
                        value={editFormData.image_url}
                        onChange={handleEditImageUrlChange}
                        className="modal-input"
                        placeholder="https://example.com/asset-image.jpg"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 font-normal">
                      Enter a URL for the asset image (optional)
                    </p>
                  </div>

                  {/* Image Preview */}
                  {editImagePreview && (
                    <div className="full-width">
                      <div className="image-preview p-2 border border-gray-200 rounded-xl bg-gray-50">
                        <img
                          src={editImagePreview}
                          alt="Asset preview"
                          className="w-full max-h-40 object-contain rounded-lg"
                          onError={() => setEditImagePreview("")}
                        />
                      </div>
                    </div>
                  )}

                  {/* Description - full width */}
                  <div className="full-width">
                    <label className="modal-label">Description</label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon modal-input-icon-top">
                        📝
                      </span>
                      <textarea
                        value={editFormData.description}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            description: e.target.value,
                          })
                        }
                        rows={2}
                        className="modal-textarea"
                        placeholder="Optional description"
                      />
                    </div>
                  </div>

                  {/* Status - full width */}
                  <div className="full-width">
                    <label className="modal-label">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">📊</span>
                      <select
                        value={editFormData.status}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            status: e.target.value,
                          })
                        }
                        required
                        className="modal-select"
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

                <div className="flex gap-3 pt-5 mt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
                  >
                    {submitting ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

      {/* ─── ASSIGN MODAL ─── */}
      {showAssignModal && asset && (
        <div
          className="modal-overlay"
          onClick={() => setShowAssignModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-400/60 via-green-300/40 to-green-400/60 rounded-t-2xl"></div>

              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    Assign Asset
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5 font-normal">
                    Assign <span className="font-semibold">{asset.name}</span>{" "}
                    to a user
                  </p>
                </div>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  <svg
                    width="14"
                    height="14"
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
                <div className="space-y-4">
                  <div>
                    <label className="modal-label">
                      Select User <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">👤</span>
                      <select
                        value={assignFormData.user_id}
                        onChange={(e) =>
                          setAssignFormData({
                            ...assignFormData,
                            user_id: e.target.value,
                          })
                        }
                        required
                        className="modal-select"
                      >
                        <option value="">Select a user</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                    <p className="text-xs text-green-700 font-medium">
                      ⚠️ Assigning will change status to "ASSIGNED"
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-5 mt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
                  >
                    {submitting ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

      {/* ─── VERIFY MODAL ─── */}
      {showVerifyModal && asset && (
        <div
          className="modal-overlay"
          onClick={() => setShowVerifyModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400/60 via-blue-300/40 to-blue-400/60 rounded-t-2xl"></div>

              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    Verify Asset
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5 font-normal">
                    Record verification of{" "}
                    <span className="font-semibold">{asset.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => setShowVerifyModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  <svg
                    width="14"
                    height="14"
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

              <form onSubmit={handleVerifyAsset}>
                <div className="modal-grid-2">
                  <div>
                    <label className="modal-label">Latitude</label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">📍</span>
                      <input
                        type="number"
                        step="any"
                        value={verifyFormData.latitude}
                        onChange={(e) =>
                          setVerifyFormData({
                            ...verifyFormData,
                            latitude: e.target.value,
                          })
                        }
                        className="modal-input"
                        placeholder="28.6219"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="modal-label">Longitude</label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">📍</span>
                      <input
                        type="number"
                        step="any"
                        value={verifyFormData.longitude}
                        onChange={(e) =>
                          setVerifyFormData({
                            ...verifyFormData,
                            longitude: e.target.value,
                          })
                        }
                        className="modal-input"
                        placeholder="77.2195"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="modal-label">
                      Condition <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">📊</span>
                      <select
                        value={verifyFormData.asset_condition}
                        onChange={(e) =>
                          setVerifyFormData({
                            ...verifyFormData,
                            asset_condition: e.target.value,
                          })
                        }
                        required
                        className="modal-select"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="DECOMMISSIONED">Decommissioned</option>
                        <option value="DAMAGED">Damaged</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="modal-label">Image URL</label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon">🖼️</span>
                      <input
                        type="text"
                        value={verifyFormData.image_url}
                        onChange={(e) =>
                          setVerifyFormData({
                            ...verifyFormData,
                            image_url: e.target.value,
                          })
                        }
                        className="modal-input"
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                  </div>
                  <div className="full-width">
                    <label className="modal-label">Remarks</label>
                    <div className="input-icon-wrapper">
                      <span className="modal-input-icon modal-input-icon-top">
                        📝
                      </span>
                      <textarea
                        value={verifyFormData.remarks}
                        onChange={(e) =>
                          setVerifyFormData({
                            ...verifyFormData,
                            remarks: e.target.value,
                          })
                        }
                        rows={2}
                        className="modal-textarea"
                        placeholder="Optional remarks"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-5 mt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowVerifyModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
                  >
                    {submitting ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Verify Asset"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── QR CODE MODAL ─── */}
      {showQRModal && asset && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">QR Code</h2>
                  <p className="text-xs text-gray-400 mt-0.5 font-normal">
                    {asset.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  <svg
                    width="14"
                    height="14"
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

              <div className="qr-code-container">
                {asset.qr_code_url ? (
                  <img
                    src={asset.qr_code_url}
                    alt="QR Code"
                    className="rounded-lg"
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No QR code available
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-3 font-normal">
                  Scan this QR to verify the asset
                </p>
                <button
                  onClick={handleRegenerateQR}
                  disabled={submitting}
                  className="mt-4 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Regenerate QR"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION ─── */}
      {showDeleteConfirm && asset && (
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
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                Deactivate Asset?
              </h3>
              <p className="text-gray-500 text-sm mb-2 font-normal">
                Are you sure you want to deactivate{" "}
                <span className="font-semibold text-gray-700">
                  {asset.name}
                </span>
                ?
              </p>
              <p className="text-[10px] text-gray-400 mb-4 font-normal">
                This will hide the asset from active lists. This action can be
                reversed.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAsset}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
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