"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";

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

// ─── API Helper ──────────────────────────────────────────────────────────────
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

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [showDeactivated, setShowDeactivated] = useState(false);
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

  // ─── Fetch Clients (based on toggle) ───────────────────────────────────────
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

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.industry?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.contact_email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Navigate to client details page
  const handleClientClick = (clientId: string) => {
    router.push(`/clients/${clientId}`);
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
        .modal-content {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          border-radius: 28px;
          width: 90%;
          max-width: 560px;
          max-height: 85vh;
          overflow-y: auto;
          animation: fadeInScale 0.35s cubic-bezier(0.2, 0.9, 0.4, 1.2);
          box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(220, 38, 38, 0.1);
        }
        .modal-content::-webkit-scrollbar { width: 5px; }
        .modal-content::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; margin: 8px 0; }
        .modal-content::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #dc2626, #ef4444); border-radius: 10px; }
        
        .card-3d {
          transition: all 0.4s cubic-bezier(0.2, 0.9, 0.4, 1.2);
          transform-style: preserve-3d;
          perspective: 1000px;
          cursor: pointer;
        }
        .card-3d:hover {
          transform: translateY(-6px) rotateX(2deg);
          box-shadow: 0 20px 35px -12px rgba(0, 0, 0, 0.15);
        }
        
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
        
        .input-fancy {
          transition: all 0.2s ease;
          background: #fafbfc;
        }
        .input-fancy:focus {
          background: white;
          transform: scale(1.01);
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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 fade-in-up">
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
              <p className="text-gray-500 ml-14 pl-0.5 text-sm">
                Manage your client companies and professional relationships
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 via-red-500 to-red-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 btn-ripple overflow-hidden"
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

          {/* Stats Row */}
          {!loading && clients.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8 fade-in-up">
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
                  <p className="text-sm text-gray-500 font-medium">
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
                  <p className="text-sm text-gray-500 font-medium">
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
                  <p className="text-sm text-gray-500 font-medium">
                    With Email
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search and Toggle Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 fade-in-up">
            <div className="relative max-w-md w-full">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500/30 to-transparent rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
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
                className="w-full pl-11 pr-10 py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/50 transition-all duration-200 shadow-sm text-gray-800"
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

            {/* Toggle Switch for Active/Deactivated */}
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
              <p className="text-gray-500 font-medium tracking-wide">
                Loading your clients...
              </p>
            </div>
          )}

          {/* Clients Grid - Click to navigate */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClients.map((client, idx) => (
                <div
                  key={client.id}
                  className="group relative fade-in-up"
                  style={{ animationDelay: `${idx * 70}ms` }}
                  onMouseEnter={() => setHoveredCard(client.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => handleClientClick(client.id)}
                >
                  <div
                    className={`absolute -inset-0.5 bg-gradient-to-r from-red-500 via-rose-400 to-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md ${hoveredCard === client.id ? "opacity-100" : ""}`}
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
                        <p className="text-sm text-gray-500 mb-3 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                          {client.industry}
                        </p>
                      )}

                      <div className="space-y-2.5 text-sm">
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

                      {/* Click hint */}
                      <div className="mt-3 text-right">
                        <span className="text-xs text-gray-400 group-hover:text-red-500 transition-colors">
                          Click to view details →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
              <p className="text-gray-500 max-w-sm mx-auto mb-6">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Add your first client to get started"}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all"
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

      {/* ─── Add Client Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-red-400 to-red-500 rounded-t-2xl"></div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                      Create New Client
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                      Enter the client details below
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
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
                <form onSubmit={handleCreateClient} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Client Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all input-fancy text-gray-800"
                      placeholder="e.g., ABC Corporation"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Slug (URL identifier)
                    </label>
                    <input
                      type="text"
                      name="slug"
                      value={formData.slug}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all font-mono text-sm text-gray-700"
                      placeholder="auto-generated-from-name"
                    />
                    <p className="text-xs text-gray-400 mt-1.5 ml-1">
                      Unique URL-friendly identifier for this client
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Industry
                    </label>
                    <input
                      type="text"
                      name="industry"
                      value={formData.industry}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all input-fancy text-gray-800"
                      placeholder="e.g., Technology, Logistics, Healthcare"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Contact Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="contact_email"
                      value={formData.contact_email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all input-fancy text-gray-800"
                      placeholder="admin@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      name="contact_phone"
                      value={formData.contact_phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all input-fancy text-gray-800"
                      placeholder="+91 1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Address Line 1 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="address_line_1"
                      value={formData.address_line_1}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all input-fancy text-gray-800"
                      placeholder="Building/Flat number, Street"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      name="address_line_2"
                      value={formData.address_line_2}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all input-fancy text-gray-800"
                      placeholder="Area, Locality"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Address Line 3
                    </label>
                    <input
                      type="text"
                      name="address_line_3"
                      value={formData.address_line_3}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all input-fancy text-gray-800"
                      placeholder="City, State, PIN Code"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold shadow-md btn-ripple"
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
        </div>
      )}
    </>
  );
}
