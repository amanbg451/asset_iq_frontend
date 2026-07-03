"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
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

interface CreateServiceData {
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}

type ViewMode = "table" | "grid";

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
  is_active: z.boolean().default(true),
});

const exportToCSV = (data: Service[], filename: string) => {
  const headers = ["Name", "Code", "Description", "Status"];
  const rows = data.map((s) => [
    s.name,
    s.code,
    s.description || "",
    s.is_active ? "Active" : "Deactivated",
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

const exportToExcel = (data: Service[], filename: string) => {
  const headers = ["Name", "Code", "Description", "Status"];
  const rows = data.map((s) => [
    s.name,
    s.code,
    s.description || "",
    s.is_active ? "Active" : "Deactivated",
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

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [formData, setFormData] = useState<CreateServiceData>({
    code: "",
    name: "",
    description: "",
    is_active: true,
  });

  const exportButtonRef = useRef<HTMLButtonElement>(null);

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

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const url = showDeactivated ? "/services/deactivated" : "/services";
      const response = await api.get(url);
      setServices(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to fetch services");
    } finally {
      setLoading(false);
    }
  }, [showDeactivated]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchServices();
  }, [router, fetchServices]);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = serviceSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });
      setValidationErrors(errors);
      toast.error(result.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/services", result.data);
      toast.success("Service created successfully");
      setShowModal(false);
      setFormData({ code: "", name: "", description: "", is_active: true });
      setValidationErrors({});
      fetchServices();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to create service");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "name") {
      const code = value
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      setFormData((prev) => ({ ...prev, code }));
    }
  };

  const clearSearch = () => setSearchTerm("");

  const handleExportCSV = () => {
    exportToCSV(services, `services_${new Date().toISOString().split("T")[0]}`);
    setShowExportDropdown(false);
    toast.success("CSV exported successfully");
  };

  const handleExportExcel = () => {
    exportToExcel(
      services,
      `services_${new Date().toISOString().split("T")[0]}`,
    );
    setShowExportDropdown(false);
    toast.success("Excel exported successfully");
  };

  const filteredServices = services.filter(
    (service) =>
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleServiceClick = (serviceId: string) => {
    router.push(`/services/${serviceId}`);
  };

  const viewModeLabels: Record<ViewMode, string> = {
    table: "📋 Table",
    grid: "📊 Grid",
  };

  const totalServices = services.length;
  const activeServices = services.filter((s) => s.is_active).length;
  const deactivatedServices = totalServices - activeServices;
  const withDescription = services.filter((s) => s.description).length;

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

        .modal-content::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .modal-content::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 20px;
          margin: 12px 0;
        }
        .modal-content::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #dc2626, #ef4444);
          border-radius: 20px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .modal-content::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #b91c1c, #dc2626);
        }
        .modal-content {
          scrollbar-width: thin;
          scrollbar-color: #dc2626 #f1f5f9;
          scroll-behavior: smooth;
        }
        
        .card-3d {
          transition: all 0.4s cubic-bezier(0.2, 0.9, 0.4, 1.2);
          cursor: pointer;
        }
        .card-3d:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 35px -12px rgba(0, 0, 0, 0.15);
        }
        
        .stat-card-glass {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          transition: all 0.3s ease;
          cursor: pointer;
        }
        .stat-card-glass:hover {
          transform: translateY(-2px);
          background: rgba(255, 255, 255, 0.95);
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

        .service-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          font-weight: 400;
          min-width: 600px;
        }
        .service-table thead th {
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
        .service-table tbody td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #1f2937;
          font-size: 14px;
          font-weight: 400;
        }
        .service-table tbody tr {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .service-table tbody tr:hover {
          background: #fef2f2;
        }
        .service-table tbody tr:active {
          background: #fecaca;
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
          grid-template-columns: 1fr;
          gap: 14px 18px;
        }

        @media (min-width: 640px) {
          .modal-grid-2 {
            grid-template-columns: 1fr 1fr;
            gap: 18px 24px;
          }
          .modal-grid-2 .full-width {
            grid-column: 1 / -1;
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
        .input-icon-wrapper textarea {
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

        /* ─── Mobile Header ─── */
        @media (max-width: 480px) {
          .header-actions {
            flex-wrap: wrap;
            gap: 8px;
          }
          .header-actions button {
            font-size: 12px;
            padding: 6px 12px;
          }
          .stat-card-glass {
            padding: 10px 12px;
          }
          .stat-card-glass .stat-value {
            font-size: 18px;
          }
          .stat-card-glass .stat-label {
            font-size: 10px;
          }
        }

        @media (min-width: 481px) and (max-width: 768px) {
          .stat-card-glass .stat-value {
            font-size: 22px;
          }
        }

        /* ─── Table Scroll ─── */
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
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">
                  Services
                </h1>
              </div>
              <p className="text-gray-500 ml-[52px] sm:ml-[56px] text-xs sm:text-sm font-normal">
                Manage your platform services and features
              </p>
            </div>

            {/* ─── Header Actions ─── */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap header-actions w-full sm:w-auto">
              {/* View Toggle */}
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

              {/* Export */}
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

              {/* Add Button */}
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
                <span className="hidden xs:inline">Add New Service</span>
                <span className="xs:hidden">Add</span>
              </button>
            </div>
          </div>

          {/* ─── STATS ─── */}
          {!loading && services.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6 fade-in-up">
              <div className="stat-card-glass rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-4 shadow-sm">
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
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 stat-value">
                    {totalServices}
                  </p>
                  <p className="text-[9px] sm:text-xs lg:text-sm font-medium text-gray-500 stat-label">
                    Total Services
                  </p>
                </div>
              </div>

              <div className="stat-card-glass rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-4 shadow-sm">
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
                    {activeServices}
                  </p>
                  <p className="text-[9px] sm:text-xs lg:text-sm font-medium text-gray-500 stat-label">
                    Active
                  </p>
                </div>
              </div>

              <div className="stat-card-glass rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-4 shadow-sm">
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
                    {deactivatedServices}
                  </p>
                  <p className="text-[9px] sm:text-xs lg:text-sm font-medium text-gray-500 stat-label">
                    Deactivated
                  </p>
                </div>
              </div>

              <div className="stat-card-glass rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-4 shadow-sm">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="16"
                    height="16"
                    className="sm:w-[22px] sm:h-[22px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="1.8"
                  >
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 stat-value">
                    {withDescription}
                  </p>
                  <p className="text-[9px] sm:text-xs lg:text-sm font-medium text-gray-500 stat-label">
                    With Description
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── SEARCH ─── */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 fade-in-up">
            <div className="relative w-full sm:w-72 lg:w-96">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400"
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
                placeholder="Search services by name, code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 sm:pl-11 pr-8 sm:pr-10 py-2.5 sm:py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all shadow-sm text-gray-800 placeholder-gray-400 text-sm font-normal"
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
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
              )}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredServices.map((service, idx) => (
                    <div
                      key={service.id}
                      className="group relative fade-in-up"
                      style={{ animationDelay: `${idx * 70}ms` }}
                      onMouseEnter={() => setHoveredRow(service.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      onClick={() => handleServiceClick(service.id)}
                    >
                      <div
                        className={`absolute -inset-0.5 bg-gradient-to-r from-red-500 to-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md ${hoveredRow === service.id ? "opacity-100" : ""}`}
                      ></div>
                      <div className="relative bg-white rounded-xl border border-gray-100 shadow-sm card-3d overflow-hidden cursor-pointer">
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-red-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                        <div className="p-4 sm:p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-red-50 to-white flex items-center justify-center shadow-sm border border-red-100/50">
                              <svg
                                width="16"
                                height="16"
                                className="sm:w-[18px] sm:h-[18px]"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#dc2626"
                                strokeWidth="1.8"
                              >
                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                <rect
                                  x="14"
                                  y="3"
                                  width="7"
                                  height="7"
                                  rx="1"
                                />
                                <rect
                                  x="3"
                                  y="14"
                                  width="7"
                                  height="7"
                                  rx="1"
                                />
                                <rect
                                  x="14"
                                  y="14"
                                  width="7"
                                  height="7"
                                  rx="1"
                                />
                              </svg>
                            </div>
                            <span
                              className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${service.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                            >
                              {service.is_active ? "Active" : "Deactivated"}
                            </span>
                          </div>
                          <h3 className="font-bold text-gray-900 text-base sm:text-lg mb-1 line-clamp-1">
                            {service.name}
                          </h3>
                          <p className="text-xs text-gray-400 font-mono mb-2">
                            {service.code}
                          </p>
                          {service.description && (
                            <p className="text-sm text-gray-500 line-clamp-2 font-normal">
                              {service.description}
                            </p>
                          )}
                          <div className="mt-3 text-right">
                            <span className="text-xs text-gray-400 group-hover:text-red-500 transition-colors font-normal">
                              Click to view details →
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewMode === "table" && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in-up">
                  <div className="table-scroll">
                    <table className="service-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Code</th>
                          <th>Description</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredServices.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="text-center py-8 sm:py-12 text-gray-500 text-sm font-normal"
                            >
                              No services found
                            </td>
                          </tr>
                        ) : (
                          filteredServices.map((service) => (
                            <tr
                              key={service.id}
                              onClick={() => handleServiceClick(service.id)}
                              onMouseEnter={() => setHoveredRow(service.id)}
                              onMouseLeave={() => setHoveredRow(null)}
                              className="cursor-pointer hover:bg-red-50 transition-colors"
                            >
                              <td className="font-semibold text-gray-900">
                                {service.name}
                              </td>
                              <td className="text-gray-600 font-mono">
                                {service.code}
                              </td>
                              <td className="text-gray-600 text-sm max-w-[300px] truncate">
                                {service.description || "—"}
                              </td>
                              <td>
                                <span
                                  className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${service.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                                >
                                  {service.is_active ? "Active" : "Deactivated"}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── EMPTY STATE ─── */}
          {!loading && filteredServices.length === 0 && (
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
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                No services found
              </h3>
              <p className="text-gray-500 mb-4 text-sm font-normal">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Add your first service to get started"}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowModal(true)}
                  className="cursor-pointer px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold"
                >
                  + Add Service
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── MODAL ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                  Create New Service
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5 font-normal">
                  Enter the service details below
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

            <form onSubmit={handleCreateService}>
              <div className="modal-grid-2">
                <div className="full-width">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Service Name <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📋</span>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                        validationErrors.name
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="Asset Management"
                    />
                  </div>
                  {validationErrors.name && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {validationErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Service Code <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🔢</span>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleInputChange}
                      required
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 transition-all font-mono text-sm text-gray-700 placeholder-gray-400 ${
                        validationErrors.code
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="ASSET_MANAGEMENT"
                    />
                  </div>
                  {validationErrors.code && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {validationErrors.code}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                    Auto-generated from name
                  </p>
                </div>

                <div className="full-width">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Description
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon icon-top">📝</span>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={3}
                      className={`w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all resize-none input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal ${
                        validationErrors.description
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="Brief description of the service"
                    />
                  </div>
                  {validationErrors.description && (
                    <p className="text-red-500 text-xs mt-1.5 font-medium">
                      {validationErrors.description}
                    </p>
                  )}
                </div>
              </div>

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
                  disabled={submitting}
                  className="cursor-pointer flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Creating...
                    </>
                  ) : (
                    "Create Service"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
