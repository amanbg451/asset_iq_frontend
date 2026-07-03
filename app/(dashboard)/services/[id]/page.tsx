"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import { z } from "zod";
import api from "@/app/lib/api";

interface Service {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}

const serviceSchema = z.object({
  code: z
    .string()
    .min(3, "Code must be at least 3 characters")
    .max(50, "Code must be at most 50 characters")
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      "Code must start with letter and contain only uppercase, numbers, underscores",
    ),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .default(""),
});

export default function ServiceDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const serviceId = params.id as string;

  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Service>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const fetchService = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/services/${serviceId}`);
      setService(response.data);
    } catch (error: any) {
      console.error("Error fetching service:", error);
      if (error.response?.status === 404) {
        toast.error("Service not found or has been deactivated");
      } else {
        toast.error(error.response?.data?.detail || "Failed to fetch service");
      }
      router.push("/services");
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
    if (serviceId) {
      fetchService();
    }
  }, [serviceId]);

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service) return;

    const result = serviceSchema.safeParse(editFormData);
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
      await api.patch(`/services/${service.id}`, result.data);
      toast.success("Service updated successfully");
      setShowEditModal(false);
      setEditErrors({});
      fetchService();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to update service");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteService = async () => {
    if (!service) return;
    setSubmitting(true);
    try {
      await api.delete(`/services/${service.id}`);
      toast.success("Service deactivated successfully");
      setShowDeleteConfirm(false);
      router.push("/services");
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail || "Failed to deactivate service",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreService = async () => {
    if (!service) return;
    setSubmitting(true);
    try {
      await api.patch(`/services/${service.id}/restore`, {});
      toast.success("Service restored successfully");
      setShowRestoreConfirm(false);
      fetchService();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to restore service");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = () => {
    if (service) {
      setEditFormData({
        name: service.name,
        code: service.code,
        description: service.description,
      });
      setEditErrors({});
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

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="text-center">
          <p className="text-gray-500">Service not found</p>
          <button
            onClick={() => router.push("/services")}
            className="mt-4 text-red-600 hover:underline cursor-pointer"
          >
            Back to Services
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
        .fade-in-up { animation: fadeInUp 0.5s ease forwards; }
        
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
          max-width: 640px;
          max-height: 85vh;
          overflow-y: auto;
          animation: fadeInUp 0.35s ease;
          box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.4);
          padding: 20px;
        }

        @media (min-width: 640px) {
          .modal-content {
            padding: 24px;
            border-radius: 28px;
          }
        }

        @media (max-width: 640px) {
          .modal-content {
            border-radius: 20px;
            padding: 16px;
          }
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
        
        .input-fancy {
          transition: all 0.2s ease;
          background: #fafbfc;
        }
        .input-fancy:focus {
          background: white;
          transform: scale(1.01);
        }
        
        /* Scrollbar */
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
        .modal-content {
          scrollbar-width: thin;
          scrollbar-color: #dc2626 #f1f5f9;
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-100/30 rounded-full blur-3xl animate-pulse"></div>
        </div>

        <div className="relative p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => router.push("/services")}
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
            <span>Back to Services</span>
          </button>

          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 fade-in-up">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-xl blur-md animate-pulse"></div>
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md">
                  <svg
                    width="24"
                    height="24"
                    className="sm:w-[28px] sm:h-[28px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.8"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                  {service.name}
                </h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${service.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {service.is_active ? "Active" : "Deactivated"}
                  </span>
                  <span className="text-sm font-mono text-gray-400">
                    {service.code}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3 flex-wrap">
              {!service.is_active && (
                <button
                  onClick={() => setShowRestoreConfirm(true)}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold text-sm cursor-pointer"
                >
                  Restore Service
                </button>
              )}
              <button
                onClick={openEditModal}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all font-semibold text-sm cursor-pointer"
              >
                Edit
              </button>
              {service.is_active && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-semibold text-sm cursor-pointer"
                >
                  Deactivate
                </button>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 gap-6 fade-in-up">
            <div className="stat-card p-4 sm:p-6">
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
                Service Information
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Service Name
                  </p>
                  <p className="text-gray-800 font-medium mt-1">
                    {service.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Service Code
                  </p>
                  <p className="text-gray-800 font-mono text-sm mt-1">
                    {service.code}
                  </p>
                </div>
                {service.description && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Description
                    </p>
                    <p className="text-gray-600 text-sm mt-1 whitespace-pre-wrap">
                      {service.description}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Service ID
                  </p>
                  <p className="text-xs font-mono text-gray-400 mt-1">
                    {service.id}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      // Edit Modal
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                  Edit Service
                </h2>
                <p className="text-xs sm:text-sm text-gray-400">
                  Update service information
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
              >
                <svg
                  width="16"
                  height="16"
                  className="sm:w-[20px] sm:h-[20px]"
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

            <form onSubmit={handleUpdateService} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Service Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.name || ""}
                  onChange={(e) => {
                    setEditFormData({ ...editFormData, name: e.target.value });
                    if (editErrors.name)
                      setEditErrors({ ...editErrors, name: "" });
                  }}
                  className={`w-full px-4 py-2.5 sm:py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm ${
                    editErrors.name
                      ? "border-red-500 focus:ring-red-500/40"
                      : "border-gray-200 focus:ring-red-500/40"
                  }`}
                  placeholder="Enter service name"
                />
                {editErrors.name && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium">
                    {editErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Service Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.code || ""}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setEditFormData({ ...editFormData, code: val });
                    if (editErrors.code)
                      setEditErrors({ ...editErrors, code: "" });
                  }}
                  className={`w-full px-4 py-2.5 sm:py-3 border rounded-xl bg-gray-50 focus:outline-none focus:ring-2 transition-all font-mono text-sm text-gray-800 placeholder-gray-400 ${
                    editErrors.code
                      ? "border-red-500 focus:ring-red-500/40"
                      : "border-gray-200 focus:ring-red-500/40"
                  }`}
                  placeholder="Enter service code"
                />
                {editErrors.code && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium">
                    {editErrors.code}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  value={editFormData.description || ""}
                  onChange={(e) => {
                    setEditFormData({
                      ...editFormData,
                      description: e.target.value,
                    });
                    if (editErrors.description)
                      setEditErrors({ ...editErrors, description: "" });
                  }}
                  rows={3}
                  className={`w-full px-4 py-2.5 sm:py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all resize-none input-fancy text-gray-800 placeholder-gray-400 text-sm ${
                    editErrors.description
                      ? "border-red-500 focus:ring-red-500/40"
                      : "border-gray-200 focus:ring-red-500/40"
                  }`}
                  placeholder="Enter service description"
                />
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
                  className="flex-1 px-4 py-2.5 sm:py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 sm:py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Update Service"
                  )}
                </button>
              </div>
            </form>
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
                Deactivate Service?
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Are you sure you want to deactivate{" "}
                <span className="font-semibold text-gray-700">
                  {service.name}
                </span>
                ? This action can be reversed later.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 sm:py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteService}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 sm:py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm cursor-pointer"
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
                Restore Service?
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Are you sure you want to restore{" "}
                <span className="font-semibold text-gray-700">
                  {service.name}
                </span>
                ? The service will become active again.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRestoreConfirm(false)}
                  className="flex-1 px-4 py-2.5 sm:py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestoreService}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 sm:py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm cursor-pointer"
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
