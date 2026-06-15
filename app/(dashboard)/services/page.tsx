"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";

// Types
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
export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [formData, setFormData] = useState<CreateServiceData>({
    code: "",
    name: "",
    description: "",
    is_active: true,
  });

  // ─── Fetch Services (based on toggle) ──────────────────────────────────────
  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const url = showDeactivated ? "/services/deactivated" : "/services";
      const response = await api.get(url);
      setServices(response.data);
    } catch (error: any) {
      console.error("Error fetching services:", error);
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
  }, [router, fetchServices, showDeactivated]);

  // ─── Create Service ────────────────────────────────────────────────────────
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/services", formData);
      toast.success("Service created successfully");
      setShowModal(false);
      setFormData({
        code: "",
        name: "",
        description: "",
        is_active: true,
      });
      fetchServices();
    } catch (error: any) {
      console.error("Error creating service:", error);
      toast.error(error.response?.data?.detail || "Failed to create service");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Handle Input Change ──────────────────────────────────────────────────
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-generate code from name (uppercase, spaces to underscores)
    if (name === "name") {
      const code = value
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      setFormData((prev) => ({ ...prev, code }));
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  const filteredServices = services.filter(
    (service) =>
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Navigate to service details page
  const handleServiceClick = (serviceId: string) => {
    router.push(`/services/${serviceId}`);
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
        .modal-content {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          border-radius: 28px;
          width: 90%;
          max-width: 560px;
          max-height: 85vh;
          overflow-y: auto;
          animation: fadeInScale 0.35s cubic-bezier(0.2, 0.9, 0.4, 1.2);
          box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.4);
        }
        
        .card-3d {
          transition: all 0.4s cubic-bezier(0.2, 0.9, 0.4, 1.2);
          cursor: pointer;
        }
        .card-3d:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 35px -12px rgba(0, 0, 0, 0.15);
        }
        
        .btn-ripple {
          position: relative;
          overflow: hidden;
        }
        .btn-ripple:active::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 200px;
          height: 200px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          transition: width 0.5s, height 0.5s;
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
        
        .input-fancy {
          transition: all 0.2s ease;
          background: #fafbfc;
        }
        .input-fancy:focus {
          background: white;
          transform: scale(1.01);
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-100/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative p-6 lg:p-8 max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 fade-in-up">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-800">Services</h1>
              </div>
              <p className="text-gray-500 ml-14 pl-0.5 text-sm">
                Manage your platform services and features
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 overflow-hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:rotate-90 transition-transform duration-300">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add New Service</span>
            </button>
          </div>

          {/* Stats Row */}
          {!loading && services.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8 fade-in-up">
              <div className="stat-card-glass rounded-xl p-4 flex items-center gap-4 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">{services.length}</p>
                  <p className="text-sm text-gray-500 font-medium">Total Services</p>
                </div>
              </div>
              <div className="stat-card-glass rounded-xl p-4 flex items-center gap-4 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">{services.filter((s) => s.is_active).length}</p>
                  <p className="text-sm text-gray-500 font-medium">Active Services</p>
                </div>
              </div>
            </div>
          )}

          {/* Search and Toggle Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 fade-in-up">
            <div className="relative max-w-md w-full">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search services by name, code, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all shadow-sm text-gray-800"
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Toggle Switch for Active/Deactivated */}
            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-gray-100">
              <span className={`text-sm font-medium ${!showDeactivated ? "text-red-600" : "text-gray-500"}`}>Active</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showDeactivated}
                  onChange={() => setShowDeactivated(!showDeactivated)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className={`text-sm font-medium ${showDeactivated ? "text-red-600" : "text-gray-500"}`}>Deactivated</span>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* Services Grid */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map((service, idx) => (
                <div
                  key={service.id}
                  className="group relative fade-in-up"
                  style={{ animationDelay: `${idx * 70}ms` }}
                  onMouseEnter={() => setHoveredCard(service.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => handleServiceClick(service.id)}
                >
                  <div className={`absolute -inset-0.5 bg-gradient-to-r from-red-500 to-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md ${hoveredCard === service.id ? "opacity-100" : ""}`}></div>

                  <div className="relative bg-white rounded-xl border border-gray-100 shadow-sm card-3d overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-red-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>

                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-50 to-white flex items-center justify-center shadow-sm border border-red-100/50">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8">
                            <rect x="3" y="3" width="7" height="7" rx="1" />
                            <rect x="14" y="3" width="7" height="7" rx="1" />
                            <rect x="3" y="14" width="7" height="7" rx="1" />
                            <rect x="14" y="14" width="7" height="7" rx="1" />
                          </svg>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${service.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {service.is_active ? "Active" : "Deactivated"}
                        </span>
                      </div>

                      <h3 className="font-bold text-gray-900 text-lg mb-1">{service.name}</h3>
                      <p className="text-xs text-gray-400 font-mono mb-2">{service.code}</p>
                      {service.description && (
                        <p className="text-sm text-gray-500 line-clamp-2">{service.description}</p>
                      )}

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
          {!loading && filteredServices.length === 0 && (
            <div className="text-center py-20 fade-in-up">
              <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No services found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm ? "Try adjusting your search" : "Add your first service to get started"}
              </p>
              {!searchTerm && (
                <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                  + Add Service
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Add Service Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 to-red-600 rounded-t-2xl"></div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Create New Service</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Enter the service details below</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-all">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleCreateService} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Service Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all input-fancy text-gray-800"
                      placeholder="e.g., Asset Management"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Service Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all font-mono text-sm text-gray-800"
                      placeholder="e.g., ASSET_MANAGEMENT"
                    />
                    <p className="text-xs text-gray-400 mt-1.5 ml-1">Unique identifier (auto-generated from name)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all resize-none input-fancy text-gray-800"
                      placeholder="Service description"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold shadow-md"
                    >
                      {submitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating...
                        </>
                      ) : (
                        <>Create Service</>
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