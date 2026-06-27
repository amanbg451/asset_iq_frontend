"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import api from "@/app/lib/api";

interface MaintenanceTask {
  id: string;
  asset_id: string;
  client_id: string;
  raised_by: string;
  issue_description: string;
  photos_urls: string[];
  estimated_cost: number | null;
  is_emergency: boolean;
  status: "pending_approval" | "approved" | "in_progress" | "completed";
  vendor_name: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Asset {
  id: string;
  name: string;
  asset_condition: string;
}

export default function MaintenancePage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // ─── Form State for Creating Task ────────────────────────────────────────
  const [formData, setFormData] = useState({
    asset_id: "",
    issue_description: "",
    is_emergency: false,
    vendor_name: "",
    estimated_cost: "",
  });

  // ─── Helper: Get user role from JWT ──────────────────────────────────────
  const getUserRole = () => {
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

  const userRole = getUserRole();
  const isManagerOrAdmin = userRole === "MANAGER" || userRole === "ADMIN" || userRole === "CLIENT_ADMIN";

  // ─── Set mounted state ────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // ─── Fetch Tasks ──────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/assets/maintenance");
      setTasks(response.data || []);
    } catch (error: any) {
      console.error("Error fetching maintenance tasks:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Fetch Assets for Dropdown ───────────────────────────────────────────
  const fetchAssets = useCallback(async () => {
    try {
      const response = await api.get("/assets");
      setAssets(response.data || []);
    } catch (error: any) {
      console.error("Error fetching assets:", error);
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
    fetchTasks();
    fetchAssets();
  }, [router, fetchTasks, fetchAssets]);

  // ─── Helper: Format estimated cost ──────────────────────────────────────
  const formatEstimatedCost = (cost: number | string | null): string => {
    if (!cost) return "";
    const num = typeof cost === "string" ? parseFloat(cost) : cost;
    if (isNaN(num)) return "";
    return `$${num.toFixed(2)}`;
  };

  // ─── Check if asset is already under maintenance ──────────────────────────
  const checkAssetMaintenanceStatus = async (assetId: string): Promise<boolean> => {
    try {
      const response = await api.get(`/assets/${assetId}`);
      const asset = response.data;
      if (asset.asset_condition === "UNDER_MAINTENANCE") {
        toast.error(`"${asset.name}" is already under maintenance. Please complete the existing task first.`);
        return false;
      }
      return true;
    } catch (error) {
      return true;
    }
  };

  // ─── Handle Approve ──────────────────────────────────────────────────────
  const handleApprove = async (taskId: string) => {
    setSubmitting(true);
    try {
      await api.post(`/assets/maintenance/${taskId}/approve`);
      toast.success("Task approved successfully");
      fetchTasks();
    } catch (error: any) {
      console.error("Error approving task:", error);
      toast.error(error.response?.data?.detail || "Failed to approve task");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Handle Start ────────────────────────────────────────────────────────
  const handleStart = async (taskId: string) => {
    setSubmitting(true);
    try {
      await api.post(`/assets/maintenance/${taskId}/start`);
      toast.success("Task started successfully");
      fetchTasks();
    } catch (error: any) {
      console.error("Error starting task:", error);
      toast.error(error.response?.data?.detail || "Failed to start task");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Handle Complete ──────────────────────────────────────────────────────
  const handleComplete = async (taskId: string) => {
    setSubmitting(true);
    try {
      await api.post(`/assets/maintenance/${taskId}/complete`);
      toast.success("Task completed successfully");
      fetchTasks();
    } catch (error: any) {
      console.error("Error completing task:", error);
      toast.error(error.response?.data?.detail || "Failed to complete task");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Handle Create Task ──────────────────────────────────────────────────
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.asset_id) {
      toast.error("Please select an asset");
      return;
    }
    if (!formData.issue_description.trim()) {
      toast.error("Please describe the issue");
      return;
    }

    const isAssetAvailable = await checkAssetMaintenanceStatus(formData.asset_id);
    if (!isAssetAvailable) {
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/assets/${formData.asset_id}/maintenance`, {
        issue_description: formData.issue_description.trim(),
        is_emergency: formData.is_emergency,
        vendor_name: formData.vendor_name || null,
        estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
      });
      toast.success("Maintenance task created successfully");
      setShowCreateModal(false);
      setFormData({
        asset_id: "",
        issue_description: "",
        is_emergency: false,
        vendor_name: "",
        estimated_cost: "",
      });
      fetchTasks();
    } catch (error: any) {
      console.error("Error creating task:", error);
      const errorMsg = error.response?.data?.detail || error.message || "Failed to create task";
      
      if (typeof errorMsg === "string" && errorMsg.includes("already under maintenance")) {
        const assetName = getAssetName(formData.asset_id);
        toast.error(`"${assetName}" is already under maintenance. Please complete the existing task first.`);
      } else {
        toast.error(typeof errorMsg === "string" ? errorMsg : "Failed to create task");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Get Asset Name ──────────────────────────────────────────────────────
  const getAssetName = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    return asset ? asset.name : "Unknown Asset";
  };

  // ─── Get Status Badge ────────────────────────────────────────────────────
  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending_approval: "bg-yellow-100 text-yellow-700 border-yellow-200",
      approved: "bg-blue-100 text-blue-700 border-blue-200",
      in_progress: "bg-purple-100 text-purple-700 border-purple-200",
      completed: "bg-green-100 text-green-700 border-green-200",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  // ─── Get Status Label ────────────────────────────────────────────────────
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending_approval: "Pending Approval",
      approved: "Approved",
      in_progress: "In Progress",
      completed: "Completed",
    };
    return labels[status] || status;
  };

  // ─── Filter Tasks ────────────────────────────────────────────────────────
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = statusFilter === "" || task.status === statusFilter;
    const matchesSearch =
      task.issue_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getAssetName(task.asset_id).toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending_approval").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };

  if (!mounted) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
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
        .fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards; }

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
          background: white;
          border-radius: 28px;
          width: 95%;
          max-width: 560px;
          max-height: 90vh;
          overflow-y: auto;
          animation: fadeInUp 0.35s ease;
          box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.4);
          padding: 28px 32px;
        }

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

        .task-card {
          background: white;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .task-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px -8px rgba(0,0,0,0.1);
        }

        .input-fancy {
          transition: all 0.2s ease;
          background: #fafbfc;
        }
        .input-fancy:focus {
          background: white;
          transform: scale(1.01);
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
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }

        .status-badge {
          display: inline-block;
          padding: 3px 12px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 600;
          border: 1px solid;
        }

        .action-btn {
          padding: 5px 12px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.15s;
        }
        .action-btn:hover {
          transform: scale(1.05);
        }
        .action-btn.approve {
          background: #dbeafe;
          color: #2563eb;
        }
        .action-btn.approve:hover {
          background: #bfdbfe;
        }
        .action-btn.start {
          background: #fef3c7;
          color: #d97706;
        }
        .action-btn.start:hover {
          background: #fde68a;
        }
        .action-btn.complete {
          background: #d1fae5;
          color: #059669;
        }
        .action-btn.complete:hover {
          background: #a7f3d0;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-white via-indigo-50/15 to-white">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-100/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-violet-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative p-6 lg:p-8 max-w-7xl mx-auto">
          {/* ─── Header ─── */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 fade-in-up">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                  </svg>
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-800">
                  Maintenance
                </h1>
              </div>
              <p className="text-gray-500 ml-14 pl-0.5 text-sm font-normal">
                Manage asset maintenance tasks and service requests
              </p>
            </div>

            {(userRole === "USER" || isManagerOrAdmin) && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 overflow-hidden"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:rotate-90 transition-transform duration-300">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Create Task</span>
              </button>
            )}
          </div>

          {/* ─── Stats ─── */}
          {!loading && tasks.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 fade-in-up">
              <div className="stat-card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                  <p className="text-xs text-gray-500 font-medium">Total Tasks</p>
                </div>
              </div>
              <div className="stat-card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4l3 3" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
                  <p className="text-xs text-gray-500 font-medium">Pending</p>
                </div>
              </div>
              <div className="stat-card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4l3 3" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{stats.inProgress}</p>
                  <p className="text-xs text-gray-500 font-medium">In Progress</p>
                </div>
              </div>
              <div className="stat-card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{stats.completed}</p>
                  <p className="text-xs text-gray-500 font-medium">Completed</p>
                </div>
              </div>
            </div>
          )}

          {/* ─── Search & Filter ─── */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 fade-in-up">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative max-w-md w-full sm:w-72">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all shadow-sm text-gray-800 placeholder-gray-400 text-sm font-normal"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Status</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="text-sm text-gray-500 font-normal">
              {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"} found
            </div>
          </div>

          {/* ─── Loading State ─── */}
          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="w-12 h-12 border-3 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* ─── Task List ─── */}
          {!loading && (
            <div className="space-y-4">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">No tasks found</h3>
                  <p className="text-gray-500 text-sm">
                    {searchTerm || statusFilter
                      ? "Try adjusting your filters"
                      : "Create your first maintenance task"}
                  </p>
                  {!searchTerm && !statusFilter && (userRole === "USER" || isManagerOrAdmin) && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-semibold"
                    >
                      + Create Task
                    </button>
                  )}
                </div>
              ) : (
                filteredTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="task-card p-5 fade-in-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => router.push(`/maintenance/${task.id}`)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <span className="font-semibold text-gray-900">
                            {getAssetName(task.asset_id)}
                          </span>
                          {task.is_emergency && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                              🚨 Emergency
                            </span>
                          )}
                          <span className={`status-badge ${getStatusBadge(task.status)}`}>
                            {getStatusLabel(task.status)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {task.issue_description}
                        </p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-400">
                          <span>📅 {new Date(task.created_at).toLocaleDateString()}</span>
                          {task.vendor_name && <span>🏷️ {task.vendor_name}</span>}
                          {task.estimated_cost && <span>💰 {formatEstimatedCost(task.estimated_cost)}</span>}
                          {task.completed_at && <span>✅ {new Date(task.completed_at).toLocaleDateString()}</span>}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        {isManagerOrAdmin && (
                          <>
                            {task.status === "pending_approval" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(task.id);
                                }}
                                disabled={submitting}
                                className="action-btn approve"
                              >
                                Approve
                              </button>
                            )}
                            {task.status === "approved" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStart(task.id);
                                }}
                                disabled={submitting}
                                className="action-btn start"
                              >
                                Start
                              </button>
                            )}
                            {task.status === "in_progress" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleComplete(task.id);
                                }}
                                disabled={submitting}
                                className="action-btn complete"
                              >
                                Complete
                              </button>
                            )}
                          </>
                        )}
                        {!isManagerOrAdmin && task.status !== "completed" && (
                          <span className="text-sm text-gray-500 font-medium flex items-center gap-1">
                            ⏳ Waiting for approval
                          </span>
                        )}
                        {task.status === "completed" && (
                          <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                            ✅ Done
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Create Task Modal ─── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Create Maintenance Task</h2>
                <p className="text-sm text-gray-400 mt-0.5">Raise a maintenance request for an asset</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-all duration-200"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Asset <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.asset_id}
                  onChange={(e) => setFormData({ ...formData, asset_id: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white text-gray-800 text-sm font-normal"
                >
                  <option value="">Select an asset</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                      {asset.asset_condition === "UNDER_MAINTENANCE" && " 🔧 (Under Maintenance)"}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1.5">
                  Assets already under maintenance will be marked with 🔧
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Issue Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.issue_description}
                  onChange={(e) => setFormData({ ...formData, issue_description: e.target.value })}
                  required
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                  placeholder="Describe the issue with the asset..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Vendor Name
                  </label>
                  <input
                    type="text"
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                    placeholder="Service provider"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Estimated Cost ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.estimated_cost}
                    onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_emergency"
                  checked={formData.is_emergency}
                  onChange={(e) => setFormData({ ...formData, is_emergency: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="is_emergency" className="text-sm font-medium text-gray-700">
                  This is an emergency request
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Create Task"
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