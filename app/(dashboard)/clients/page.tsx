"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import api from "@/app/lib/api";

// Types
interface Client {
  id: string;
  name: string;
  industry: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  logo_url: string | null;
  is_active: boolean;
  created_at?: string;
  address_line_1?: string;
  address_line_2?: string;
  address_line_3?: string;
}

interface CreateClientData {
  name: string;
  slug: string;
  industry: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  address_line_1: string;
  address_line_2: string;
  address_line_3: string;
}

type ViewMode = "table" | "grid";

// ─── Helper: Export to CSV ──────────────────────────────────────────────────
const exportToCSV = (data: Client[], filename: string) => {
  const headers = ["Name", "Industry", "Email", "Phone", "Address", "Status"];
  const rows = data.map((c) => [
    c.name,
    c.industry || "",
    c.contact_email || "",
    c.contact_phone || "",
    c.address || "",
    c.is_active ? "Active" : "Deactivated",
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
const exportToExcel = (data: Client[], filename: string) => {
  const headers = ["Name", "Industry", "Email", "Phone", "Address", "Status"];
  const rows = data.map((c) => [
    c.name,
    c.industry || "",
    c.contact_email || "",
    c.contact_phone || "",
    c.address || "",
    c.is_active ? "Active" : "Deactivated",
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

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const [formData, setFormData] = useState<CreateClientData>({
    name: "",
    slug: "",
    industry: "",
    contact_email: "",
    contact_phone: "",
    address: "",
    address_line_1: "",
    address_line_2: "",
    address_line_3: "",
  });

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

  // ─── Fetch Clients ─────────────────────────────────────────────────────────
  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const url = showDeactivated ? "/clients/deactivated" : "/clients";
      const response = await api.get(url);
      setClients(response.data);
    } catch (error: any) {
      console.error("Error fetching clients:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch clients");
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
    fetchClients();
  }, [router, fetchClients, showDeactivated]);

  // ─── Create Client ─────────────────────────────────────────────────────────
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/clients/create", formData);
      toast.success("Client created successfully");
      setShowModal(false);
      setFormData({
        name: "",
        slug: "",
        industry: "",
        contact_email: "",
        contact_phone: "",
        address: "",
        address_line_1: "",
        address_line_2: "",
        address_line_3: "",
      });
      fetchClients();
    } catch (error: any) {
      console.error("Error creating client:", error);
      toast.error(error.response?.data?.detail || "Failed to create client");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Handle Input Change ───────────────────────────────────────────────────
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "name") {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setFormData((prev) => ({ ...prev, slug }));
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  // ─── Filtered Clients ──────────────────────────────────────────────────────
  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.industry?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.contact_email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // ─── Navigate to client details page ──────────────────────────────────────
  const handleClientClick = (clientId: string) => {
    router.push(`/clients/${clientId}`);
  };

  // ─── Export Handlers ──────────────────────────────────────────────────────
  const handleExportCSV = () => {
    exportToCSV(
      filteredClients,
      `clients_${new Date().toISOString().split("T")[0]}`,
    );
    setShowExportDropdown(false);
    toast.success("CSV exported successfully");
  };

  const handleExportExcel = () => {
    exportToExcel(
      filteredClients,
      `clients_${new Date().toISOString().split("T")[0]}`,
    );
    setShowExportDropdown(false);
    toast.success("Excel exported successfully");
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
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes borderFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
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
        .modal-content::-webkit-scrollbar { width: 6px; }
        .modal-content::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; margin: 8px 0; }
        .modal-content::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #dc2626, #ef4444); border-radius: 10px; }
        
        .btn-ripple {
          position: relative;
          overflow: hidden;
        }
        .btn-ripple::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          transform: translate(-50%, -50%);
          transition: width 0.5s, height 0.5s;
        }
        .btn-ripple:active::after {
          width: 200px;
          height: 200px;
        }
        
        .gradient-text {
          background: linear-gradient(135deg, #1f2937 0%, #374151 50%, #1f2937 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: borderFlow 3s linear infinite;
        }
        
        /* Softer placeholder color: light black / gray-500 */
        .input-fancy {
          transition: all 0.2s ease;
          background: #fafbfc;
        }
        .input-fancy:focus {
          background: white;
          transform: scale(1.01);
        }
        .input-fancy::placeholder {
          color: #9ca3af; /* light gray, not full black */
          font-weight: 400;
          opacity: 0.9;
        }
        
        .stat-card-glass {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          transition: all 0.3s ease;
        }
        .stat-card-glass:hover {
          transform: translateY(-2px);
          background: rgba(255, 255, 255, 0.95);
          border-color: rgba(220, 38, 38, 0.2);
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

        /* ─── Table Styles ──────────────────────────────────────────────────── */
        .client-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          font-weight: 400;
        }
        .client-table thead th {
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
        .client-table tbody td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #1f2937;
          font-size: 14px;
          font-weight: 400;
        }
        .client-table tbody tr {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .client-table tbody tr:hover {
          background: #fef2f2;
        }
        .client-table tbody tr:active {
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
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-100/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-red-50/10 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="relative p-6 lg:p-8 max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 fade-in-up">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="relative">
                  <div className="absolute inset-0 bg-red-500/20 rounded-xl blur-md animate-pulse"></div>
                  <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="1.8"
                    >
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87" />
                      <path d="M16 3.13a4 4 0 010 7.75" />
                    </svg>
                  </div>
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold">
                  <span className="gradient-text">Clients</span>
                </h1>
              </div>
              <p className="text-gray-500 ml-14 pl-0.5 text-sm font-normal">
                Manage your client companies and professional relationships
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

              {/* ─── Add Client Button ─── */}
              <button
                onClick={() => setShowModal(true)}
                className="cursor-pointer group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 via-red-500 to-red-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 btn-ripple overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
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
                <span>Add New Client</span>
              </button>
            </div>
          </div>

          {/* Stats Row */}
          {!loading && clients.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6 fade-in-up">
              <div className="stat-card-glass rounded-xl p-4 flex items-center gap-4 shadow-sm">
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#dc2626"
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
                    {clients.length}
                  </p>
                  <p className="text-sm font-medium text-gray-500">
                    Total Clients
                  </p>
                </div>
              </div>
              <div className="stat-card-glass rounded-xl p-4 flex items-center gap-4 shadow-sm">
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
                    {clients.filter((c) => c.is_active).length}
                  </p>
                  <p className="text-sm font-medium text-gray-500">
                    Active Clients
                  </p>
                </div>
              </div>
              <div className="stat-card-glass rounded-xl p-4 flex items-center gap-4 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="1.8"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">
                    {clients.filter((c) => c.contact_email).length}
                  </p>
                  <p className="text-sm font-medium text-gray-500">
                    With Email
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search and Controls Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 fade-in-up">
            <div className="relative max-w-md w-full">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-red-500 transition-all duration-200 z-10"
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
                placeholder="Search clients by name, industry, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/50 transition-all duration-200 shadow-sm text-gray-800 placeholder-gray-500 text-sm font-normal"
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-full hover:bg-gray-100"
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
              )}
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
            <div className="flex flex-col justify-center items-center py-20 gap-3 fade-in-up">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-3 border-gray-200"></div>
                <div className="absolute inset-0 rounded-full border-3 border-t-red-600 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
              </div>
              <p className="text-gray-500 font-medium tracking-wide text-sm">
                Loading your clients...
              </p>
            </div>
          )}

          {/* ─── Content Based on View Mode ─── */}
          {!loading && (
            <>
              {/* ─── GRID VIEW ─── */}
              {viewMode === "grid" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredClients.map((client, idx) => (
                    <div
                      key={client.id}
                      className="group relative fade-in-up"
                      style={{ animationDelay: `${idx * 70}ms` }}
                      onMouseEnter={() => setHoveredRow(client.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      onClick={() => handleClientClick(client.id)}
                    >
                      <div
                        className={`absolute -inset-0.5 bg-gradient-to-r from-red-500 via-rose-400 to-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md ${hoveredRow === client.id ? "opacity-100" : ""}`}
                      ></div>

                      <div className="relative bg-white rounded-xl border border-gray-100 shadow-sm card-3d overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-red-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>

                        <div className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="relative">
                              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-red-50 to-white flex items-center justify-center shadow-sm border border-red-100/50">
                                <span className="text-red-600 font-bold text-xl group-hover:scale-110 transition-transform duration-300">
                                  {client.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${client.is_active ? "bg-green-100 text-green-700 border border-green-200" : "bg-gray-100 text-gray-500 border border-gray-200"}`}
                            >
                              {client.is_active ? "Active" : "Deactivated"}
                            </span>
                          </div>

                          <h3 className="font-bold text-gray-900 text-lg mb-1 tracking-tight">
                            {client.name}
                          </h3>
                          {client.industry && (
                            <p className="text-sm text-gray-500 mb-3 flex items-center gap-2 font-normal">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                              {client.industry}
                            </p>
                          )}

                          <div className="space-y-2.5 text-sm font-normal">
                            {client.contact_email && (
                              <div className="flex items-center gap-2.5 text-gray-600 p-1.5 rounded-lg -mx-1.5 hover:bg-gray-50/50 transition-all">
                                <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center">
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                  </svg>
                                </div>
                                <span className="truncate font-mono text-xs">
                                  {client.contact_email}
                                </span>
                              </div>
                            )}
                            {client.contact_phone && (
                              <div className="flex items-center gap-2.5 text-gray-600 p-1.5 rounded-lg -mx-1.5 hover:bg-gray-50/50 transition-all">
                                <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center">
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                                  </svg>
                                </div>
                                <span>{client.contact_phone}</span>
                              </div>
                            )}
                            {client.address && (
                              <div className="flex items-start gap-2.5 text-gray-500 text-xs pt-2 mt-1 border-t border-gray-100 p-1.5 rounded-lg -mx-1.5">
                                <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                  </svg>
                                </div>
                                <span className="line-clamp-2 leading-relaxed">
                                  {client.address}
                                </span>
                              </div>
                            )}
                          </div>

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

              {/* ─── TABLE VIEW ─── */}
              {viewMode === "table" && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in-up">
                  <div className="overflow-x-auto">
                    <table className="client-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Industry</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Address</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClients.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="text-center py-12 text-gray-500 text-sm font-normal"
                            >
                              No clients found
                            </td>
                          </tr>
                        ) : (
                          filteredClients.map((client) => (
                            <tr
                              key={client.id}
                              onClick={() => handleClientClick(client.id)}
                              onMouseEnter={() => setHoveredRow(client.id)}
                              onMouseLeave={() => setHoveredRow(null)}
                            >
                              <td className="font-semibold text-gray-900">
                                {client.name}
                              </td>
                              <td className="text-gray-600">
                                {client.industry || "—"}
                              </td>
                              <td className="text-gray-600">
                                {client.contact_email || "—"}
                              </td>
                              <td className="text-gray-600">
                                {client.contact_phone || "—"}
                              </td>
                              <td className="text-gray-500 text-sm max-w-[200px] truncate">
                                {client.address || "—"}
                              </td>
                              <td>
                                <span
                                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${client.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                                >
                                  {client.is_active ? "Active" : "Deactivated"}
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

          {/* Empty State */}
          {!loading && filteredClients.length === 0 && (
            <div className="text-center py-20 fade-in-up">
              <div className="relative w-28 h-28 mx-auto mb-6">
                <div className="absolute inset-0 bg-white rounded-2xl shadow-md flex items-center justify-center">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="1.2"
                  >
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                No clients found
              </h3>
              <p className="text-gray-500 max-w-sm mx-auto mb-6 text-sm font-normal">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Add your first client to get started"}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowModal(true)}
                  className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Your First Client
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── ENHANCED ADD CLIENT MODAL ──────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              {/* Subtle accent line - softer and more elegant */}
              {/* <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-400/60 via-red-300/40 to-red-400/60 rounded-t-2xl"></div> */}

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Create New Client
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5 font-normal">
                    Enter the client details below
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

              <form onSubmit={handleCreateClient}>
                {/* Two-column grid layout */}
                <div className="modal-grid-2">
                  {/* Client Name - full width */}
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Client Name <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏢</span>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="ABC Corporation"
                      />
                    </div>
                  </div>

                  {/* Slug */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Slug{" "}
                      <span className="text-gray-400 text-xs font-normal">
                        (URL)
                      </span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🔗</span>
                      <input
                        type="text"
                        name="slug"
                        value={formData.slug}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all font-mono text-sm text-gray-700 placeholder-gray-400"
                        placeholder="auto-generated"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                      Unique URL-friendly identifier
                    </p>
                  </div>

                  {/* Industry */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Industry
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏭</span>
                      <input
                        type="text"
                        name="industry"
                        value={formData.industry}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Technology, Logistics, Healthcare"
                      />
                    </div>
                  </div>

                  {/* Contact Email */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Contact Email <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">✉️</span>
                      <input
                        type="email"
                        name="contact_email"
                        value={formData.contact_email}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="admin@company.com"
                      />
                    </div>
                  </div>

                  {/* Contact Phone */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Contact Phone
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📞</span>
                      <input
                        type="tel"
                        name="contact_phone"
                        value={formData.contact_phone}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="+91 1234567890"
                      />
                    </div>
                  </div>

                  {/* Address Line 1 */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Address Line 1 <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📍</span>
                      <input
                        type="text"
                        name="address_line_1"
                        value={formData.address_line_1}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Building / Flat, Street"
                      />
                    </div>
                  </div>

                  {/* Address Line 2 */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Address Line 2
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏠</span>
                      <input
                        type="text"
                        name="address_line_2"
                        value={formData.address_line_2}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Area / Locality"
                      />
                    </div>
                  </div>

                  {/* Address Line 3 - full width */}
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Address Line 3
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🗺️</span>
                      <input
                        type="text"
                        name="address_line_3"
                        value={formData.address_line_3}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="City, State, PIN Code"
                      />
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
                    disabled={submitting}
                    className="cursor-pointer flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md btn-ripple"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                        Creating...
                      </>
                    ) : (
                      <>Create Client</>
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
