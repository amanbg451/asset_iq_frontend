"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { z } from "zod";
import api from "@/app/lib/api";

interface Category {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string;
}

// zod schema for category validation

const categorySchema = z.object({
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

export default function AssetCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const getToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  };

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/asset-categories");
      setCategories(response.data || []);
    } catch (error: any) {
      console.error("Error fetching categories:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch categories");
    } finally {
      setLoading(false);
    }
  }, []);

  // Check authentication and fetch categories on mount
  useEffect(() => {
    if (!mounted) return;

    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    fetchCategories();
  }, [router, fetchCategories, mounted]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = categorySchema.safeParse(formData);
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

    setSubmitting(true);
    try {
      await api.post("/asset-categories", {
        name: result.data.name.trim(),
        description: result.data.description.trim() || null,
      });
      toast.success("Category created successfully");
      setShowModal(false);
      setFormData({ name: "", description: "" });
      setFormErrors({});
      fetchCategories();
    } catch (error: any) {
      console.error("Error creating category:", error);
      toast.error(error.response?.data?.detail || "Failed to create category");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;

    const result = categorySchema.safeParse(editFormData);
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
      await api.patch(`/asset-categories/${selectedCategory.id}`, {
        name: result.data.name.trim(),
        description: result.data.description.trim() || null,
      });
      toast.success("Category updated successfully");
      setShowEditModal(false);
      setSelectedCategory(null);
      setEditErrors({});
      fetchCategories();
    } catch (error: any) {
      console.error("Error updating category:", error);
      toast.error(error.response?.data?.detail || "Failed to update category");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;

    setSubmitting(true);
    try {
      await api.delete(`/asset-categories/${selectedCategory.id}`);
      toast.success("Category deactivated successfully");
      setShowDeleteConfirm(false);
      setSelectedCategory(null);
      fetchCategories();
    } catch (error: any) {
      console.error("Error deleting category:", error);
      toast.error(error.response?.data?.detail || "Failed to delete category");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (category: Category) => {
    setSelectedCategory(category);
    setEditFormData({
      name: category.name,
      description: category.description || "",
    });
    setEditErrors({});
    setShowEditModal(true);
  };

  const openDeleteConfirm = (category: Category) => {
    setSelectedCategory(category);
    setShowDeleteConfirm(true);
  };

  const filteredCategories = categories.filter(
    (category) =>
      (showDeactivated
        ? category.is_active === false
        : category.is_active !== false) &&
      (category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (category.description &&
          category.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase()))),
  );

  const activeCount = categories.filter((c) => c.is_active !== false).length;
  const deactivatedCount = categories.filter(
    (c) => c.is_active === false,
  ).length;
  const withDescriptionCount = categories.filter(
    (c) => c.is_active !== false && c.description,
  ).length;

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
          padding: 16px;
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
          padding: 24px 20px 28px;
        }

        @media (min-width: 640px) {
          .modal-content {
            padding: 28px 32px 32px;
          }
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

        /* ─── TABLE WITH HORIZONTAL SCROLL ─── */
        .table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }

        .table-wrapper::-webkit-scrollbar {
          height: 8px;
        }
        .table-wrapper::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 20px;
        }
        .table-wrapper::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, #dc2626, #ef4444);
          border-radius: 20px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .table-wrapper::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(90deg, #b91c1c, #dc2626);
        }

        .category-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          font-weight: 400;
          min-width: 500px;
        }
        @media (min-width: 1024px) {
          .category-table {
            min-width: auto;
          }
        }

        .category-table thead th {
          text-align: left;
          padding: 10px 12px;
          font-weight: 600;
          font-size: 11px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid #f1f5f9;
          background: #fafbfc;
          white-space: nowrap;
          vertical-align: middle;
        }
        @media (min-width: 640px) {
          .category-table thead th {
            padding: 12px 16px;
            font-size: 12px;
          }
        }

        .category-table tbody td {
          padding: 10px 12px;
          border-bottom: 1px solid #f1f5f9;
          color: #1f2937;
          font-size: 13px;
          font-weight: 400;
          vertical-align: middle;
        }
        @media (min-width: 640px) {
          .category-table tbody td {
            padding: 12px 16px;
            font-size: 14px;
          }
        }

        .category-table tbody tr {
          cursor: default;
          transition: background 0.15s ease;
        }
        .category-table tbody tr:hover {
          background: #fef2f2;
        }

        /* ─── COLUMN WIDTHS FOR PROPER ALIGNMENT ─── */
        .category-table th:first-child,
        .category-table td:first-child {
          width: 25%;
          min-width: 100px;
        }
        .category-table th:nth-child(2),
        .category-table td:nth-child(2) {
          width: 45%;
          min-width: 150px;
        }
        .category-table th:nth-child(3),
        .category-table td:nth-child(3) {
          width: 15%;
          min-width: 80px;
          text-align: center;
        }
        .category-table th:last-child,
        .category-table td:last-child {
          width: 15%;
          min-width: 80px;
          text-align: right;
        }

        /* ─── STATUS CELL - CENTERED ─── */
        .category-table .status-cell {
          text-align: center;
        }
        .category-table .status-cell .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 600;
          text-align: center;
        }
        @media (max-width: 639px) {
          .category-table .status-cell .status-badge {
            padding: 3px 8px;
            font-size: 10px;
          }
        }

        /* ─── ACTION BUTTONS ─── */
        .action-btn {
          padding: 4px 8px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
          font-size: 13px;
          background: transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        @media (max-width: 639px) {
          .action-btn {
            padding: 3px 6px;
            font-size: 11px;
          }
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

        .action-btn svg {
          width: 18px;
          height: 18px;
        }
        @media (max-width: 639px) {
          .action-btn svg {
            width: 14px;
            height: 14px;
          }
        }

        /* ─── ACTIONS CELL - RIGHT ALIGNED ─── */
        .category-table .actions-cell {
          text-align: right;
        }
        .category-table .actions-cell .action-group {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
        }
        @media (max-width: 639px) {
          .category-table .actions-cell .action-group {
            gap: 2px;
          }
        }

        .modal-grid-2 {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 640px) {
          .modal-grid-2 {
            grid-template-columns: 1fr 1fr;
            gap: 18px 24px;
          }
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
        .input-icon-wrapper textarea {
          padding-left: 42px;
          padding-right: 12px;
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

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 42px;
          height: 22px;
        }
        @media (min-width: 640px) {
          .toggle-switch {
            width: 50px;
            height: 24px;
          }
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
          height: 16px;
          width: 16px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }
        @media (min-width: 640px) {
          .toggle-slider:before {
            height: 18px;
            width: 18px;
          }
        }
        input:checked + .toggle-slider {
          background-color: #dc2626;
        }
        input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }
        @media (min-width: 640px) {
          input:checked + .toggle-slider:before {
            transform: translateX(26px);
          }
        }

        /* ─── RESPONSIVE: STATS GRID ─── */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        @media (min-width: 640px) {
          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }
        }

        /* ─── RESPONSIVE: SEARCH AND FILTERS ─── */
        .search-filters {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }
        @media (min-width: 640px) {
          .search-filters {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 sm:mb-6 gap-3 sm:gap-4 fade-in-up">
            <div className="w-full md:w-auto">
              <div className="flex items-center gap-2 sm:gap-3 mb-0.5">
                <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md flex-shrink-0">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    className="sm:w-5 sm:h-5"
                  >
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">
                    Asset Categories
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5 font-normal">
                    Manage asset categories like Laptops, Vehicles, Equipment,
                    etc.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="cursor-pointer group relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 overflow-hidden w-full sm:w-auto justify-center"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="group-hover:rotate-90 transition-transform duration-300 sm:w-4.5 sm:h-4.5"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add Category</span>
            </button>
          </div>

          {/* ─── STATS ─── */}
          {!loading && categories.length > 0 && (
            <div className="stats-grid fade-in-up">
              <div className="stat-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="1.8"
                    className="sm:w-5.5 sm:h-5.5"
                  >
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-bold text-gray-800">
                    {activeCount}
                  </p>
                  <p className="text-[10px] sm:text-sm font-medium text-gray-500">
                    Active Categories
                  </p>
                </div>
              </div>
              <div className="stat-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6b7280"
                    strokeWidth="1.8"
                    className="sm:w-5.5 sm:h-5.5"
                  >
                    <path d="M12 8v4l3 3" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-bold text-gray-800">
                    {deactivatedCount}
                  </p>
                  <p className="text-[10px] sm:text-sm font-medium text-gray-500">
                    Deactivated
                  </p>
                </div>
              </div>
              <div className="stat-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="1.8"
                    className="sm:w-5.5 sm:h-5.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-bold text-gray-800">
                    {withDescriptionCount}
                  </p>
                  <p className="text-[10px] sm:text-sm font-medium text-gray-500">
                    With Description
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── SEARCH ─── */}
          <div className="search-filters fade-in-up">
            <div className="relative w-full sm:max-w-md">
              <svg
                className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-900 pointer-events-none"
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
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all shadow-sm text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-3 bg-white/80 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl shadow-sm border border-gray-100 flex-shrink-0">
              <span
                className={`text-[10px] sm:text-sm font-medium ${!showDeactivated ? "text-red-600" : "text-gray-500"}`}
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
                className={`text-[10px] sm:text-sm font-medium ${showDeactivated ? "text-red-600" : "text-gray-500"}`}
              >
                Deactivated
              </span>
            </div>
          </div>

          {/* ─── LOADING STATE ─── */}
          {loading && (
            <div className="flex justify-center items-center py-16 sm:py-20">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* ─── TABLE ─── */}
          {!loading && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in-up">
              <div className="table-wrapper">
                <table className="category-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th className="text-center">Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-center py-8 sm:py-12 text-gray-500 text-xs sm:text-sm font-normal"
                        >
                          {searchTerm
                            ? "No categories match your search"
                            : showDeactivated
                              ? "No deactivated categories found"
                              : "No categories found. Create your first category!"}
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map((category) => (
                        <tr
                          key={category.id}
                          onMouseEnter={() => setHoveredRow(category.id)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <td className="font-semibold text-gray-900 text-xs sm:text-sm whitespace-nowrap">
                            {category.name}
                          </td>
                          <td className="text-gray-600 text-xs sm:text-sm">
                            {category.description || "—"}
                          </td>
                          <td className="status-cell whitespace-nowrap">
                            <span
                              className={`status-badge ${
                                category.is_active !== false
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {category.is_active !== false
                                ? "Active"
                                : "Deactivated"}
                            </span>
                          </td>
                          <td className="actions-cell">
                            <div className="action-group">
                              <button
                                onClick={() => openEditModal(category)}
                                className="action-btn edit"
                                title="Edit"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              {category.is_active !== false && (
                                <button
                                  onClick={() => openDeleteConfirm(category)}
                                  className="action-btn delete"
                                  title="Deactivate"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                  </svg>
                                </button>
                              )}
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

      {/* ─── CREATE CATEGORY MODAL ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                  Create Category
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5 font-normal">
                  Add a new asset category
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="cursor-pointer text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100 flex-shrink-0"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="sm:w-4 sm:h-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateCategory}>
              <div className="modal-grid-2">
                <div className="full-width">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Category Name <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📂</span>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        if (formErrors.name)
                          setFormErrors({ ...formErrors, name: "" });
                      }}
                      required
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        formErrors.name
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="Laptops"
                    />
                  </div>
                  {formErrors.name && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.name}
                    </p>
                  )}
                </div>

                <div className="full-width">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Description
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon icon-top">📝</span>
                    <textarea
                      value={formData.description}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        });
                        if (formErrors.description)
                          setFormErrors({ ...formErrors, description: "" });
                      }}
                      rows={3}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all resize-none input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        formErrors.description
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="Optional description"
                    />
                  </div>
                  {formErrors.description && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-6 mt-2 sm:mt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="cursor-pointer flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-xs sm:text-sm order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="cursor-pointer flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm shadow-md order-1 sm:order-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Creating...
                    </>
                  ) : (
                    "Create Category"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT CATEGORY MODAL ─── */}
      {showEditModal && selectedCategory && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                  Edit Category
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5 font-normal">
                  Update category details
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="cursor-pointer text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100 flex-shrink-0"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="sm:w-4 sm:h-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateCategory}>
              <div className="modal-grid-2">
                <div className="full-width">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Category Name <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📂</span>
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
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        editErrors.name
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                      placeholder="Category name"
                    />
                  </div>
                  {editErrors.name && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.name}
                    </p>
                  )}
                </div>

                <div className="full-width">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
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
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all resize-none input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        editErrors.description
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                      placeholder="Optional description"
                    />
                  </div>
                  {editErrors.description && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-6 mt-2 sm:mt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="cursor-pointer flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-xs sm:text-sm order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="cursor-pointer flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm shadow-md order-1 sm:order-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Updating...
                    </>
                  ) : (
                    "Update Category"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION ─── */}
      {showDeleteConfirm && selectedCategory && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                  className="sm:w-7 sm:h-7"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-1.5 sm:mb-2">
                Deactivate Category?
              </h3>
              <p className="text-gray-500 text-xs sm:text-sm mb-2 font-normal">
                Are you sure you want to deactivate{" "}
                <span className="font-semibold text-gray-700">
                  {selectedCategory.name}
                </span>
                ?
              </p>
              <p className="text-[10px] sm:text-xs text-gray-400 mb-3 sm:mb-4 font-normal">
                This will hide the category from active lists. Existing assets
                will not be affected.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-xs sm:text-sm order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCategory}
                  disabled={submitting}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm shadow-md order-1 sm:order-2"
                >
                  {submitting ? (
                    <span className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
