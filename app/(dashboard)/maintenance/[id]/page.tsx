"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import api from "@/app/lib/api";

interface MaintenanceTask {
  id: string;
  asset_id: string;
  client_id: string;
  raised_by: string;
  raised_by_user?: {
    full_name: string;
    email: string;
  };
  issue_description: string;
  photos_urls: string[];
  estimated_cost: number | null;
  is_emergency: boolean;
  status: "pending_approval" | "approved" | "in_progress" | "completed";
  approved_by: string | null;
  approved_by_user?: {
    full_name: string;
    email: string;
  };
  vendor_name: string | null;
  parts_replaced: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Asset {
  id: string;
  name: string;
  serial_number: string;
  asset_condition: string;
}

export default function MaintenanceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<MaintenanceTask | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const fetchTaskDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/assets/maintenance/${taskId}`);
      const taskData = response.data;
      setTask(taskData);

      if (taskData.asset_id) {
        const assetRes = await api.get(`/assets/${taskData.asset_id}`);
        setAsset(assetRes.data);
      }
    } catch (error: any) {
      console.error("Error fetching task details:", error);
      toast.error("Failed to load task details");
      router.push("/maintenance");
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
    if (taskId) {
      fetchTaskDetails();
    }
  }, [taskId, mounted]);

  // ─── Helper: Get user role ──────────────────────────────────────────────
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

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending_approval: "bg-yellow-100 text-yellow-700 border-yellow-200",
      approved: "bg-blue-100 text-blue-700 border-blue-200",
      in_progress: "bg-purple-100 text-purple-700 border-purple-200",
      completed: "bg-green-100 text-green-700 border-green-200",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending_approval: "Pending Approval",
      approved: "Approved",
      in_progress: "In Progress",
      completed: "Completed",
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, string> = {
      pending_approval: "⏳",
      approved: "✅",
      in_progress: "🔧",
      completed: "🎯",
    };
    return icons[status] || "📋";
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString();
  };

  const formatCost = (cost: number | string | null) => {
    if (!cost) return "—";
    const num = typeof cost === "string" ? parseFloat(cost) : cost;
    if (isNaN(num)) return "—";
    return `$${num.toFixed(2)}`;
  };

  // ─── Action Handlers ─────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!task) return;
    setSubmitting(true);
    try {
      await api.post(`/assets/maintenance/${task.id}/approve`);
      toast.success("Task approved successfully");
      fetchTaskDetails();
    } catch (error: any) {
      console.error("Error approving task:", error);
      toast.error(error.response?.data?.detail || "Failed to approve task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async () => {
    if (!task) return;
    setSubmitting(true);
    try {
      await api.post(`/assets/maintenance/${task.id}/start`);
      toast.success("Task started successfully");
      fetchTaskDetails();
    } catch (error: any) {
      console.error("Error starting task:", error);
      toast.error(error.response?.data?.detail || "Failed to start task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!task) return;
    setSubmitting(true);
    try {
      await api.post(`/assets/maintenance/${task.id}/complete`);
      toast.success("Task completed successfully");
      fetchTaskDetails();
    } catch (error: any) {
      console.error("Error completing task:", error);
      toast.error(error.response?.data?.detail || "Failed to complete task");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Build Timeline ──────────────────────────────────────────────────────
  const getTimeline = () => {
    if (!task) return [];

    const events = [
      {
        type: "created",
        label: "Task Created",
        description: task.issue_description,
        user: task.raised_by_user?.full_name || "Unknown",
        date: task.created_at,
        icon: "📝",
        color: "bg-gray-100 border-gray-300",
      },
    ];

    if (task.status === "approved" || task.status === "in_progress" || task.status === "completed") {
      events.push({
        type: "approved",
        label: "Task Approved",
        description: task.approved_by_user?.full_name 
          ? `Approved by ${task.approved_by_user.full_name}` 
          : "Approved",
        user: task.approved_by_user?.full_name || "Manager",
        date: task.created_at,
        icon: "✅",
        color: "bg-blue-100 border-blue-300",
      });
    }

    if (task.status === "in_progress" || task.status === "completed") {
      events.push({
        type: "started",
        label: "Work Started",
        description: "Maintenance work has begun",
        user: "Assigned technician",
        date: task.created_at,
        icon: "🔧",
        color: "bg-purple-100 border-purple-300",
      });
    }

    if (task.status === "completed") {
      events.push({
        type: "completed",
        label: "Task Completed",
        description: task.parts_replaced || "Maintenance completed successfully",
        user: "Team",
        date: task.completed_at || task.created_at,
        icon: "🎯",
        color: "bg-green-100 border-green-300",
      });
    }

    return events;
  };

  if (!mounted || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Task not found</p>
          <button
            onClick={() => router.push("/maintenance")}
            className="mt-4 text-indigo-600 hover:underline"
          >
            Back to Maintenance
          </button>
        </div>
      </div>
    );
  }

  const timeline = getTimeline();

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards; }

        .timeline-item {
          position: relative;
          padding-left: 28px;
          padding-bottom: 24px;
          border-left: 2px solid #e5e7eb;
        }
        .timeline-item:last-child {
          border-left: 2px solid transparent;
          padding-bottom: 0;
        }
        .timeline-item .timeline-dot {
          position: absolute;
          left: -9px;
          top: 4px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid #e5e7eb;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
        }
        .timeline-item.active .timeline-dot {
          border-color: #6366f1;
          background: #6366f1;
        }
        .timeline-item.completed .timeline-dot {
          border-color: #22c55e;
          background: #22c55e;
        }

        .info-card {
          background: white;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
          transition: all 0.3s ease;
        }
        .info-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px -8px rgba(0,0,0,0.1);
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-white via-indigo-50/15 to-white p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {/* ─── Back Button ─── */}
          <button
            onClick={() => router.push("/maintenance")}
            className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors mb-6"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to Maintenance</span>
          </button>

          {/* ─── Header ─── */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 fade-in-up">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">
                  Maintenance Task
                </h1>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(task.status)}`}>
                  {getStatusIcon(task.status)} {getStatusLabel(task.status)}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                Asset: <span className="font-medium text-gray-700">{asset?.name || "Unknown"}</span>
                {asset?.serial_number && ` · SN: ${asset.serial_number}`}
              </p>
            </div>

            {isManagerOrAdmin && (
              <div className="flex gap-2 flex-wrap">
                {task.status === "pending_approval" && (
                  <button
                    onClick={handleApprove}
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-sm transition disabled:opacity-50"
                  >
                    {submitting ? "Processing..." : "✅ Approve"}
                  </button>
                )}
                {task.status === "approved" && (
                  <button
                    onClick={handleStart}
                    disabled={submitting}
                    className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-semibold text-sm transition disabled:opacity-50"
                  >
                    {submitting ? "Processing..." : "🔧 Start Work"}
                  </button>
                )}
                {task.status === "in_progress" && (
                  <button
                    onClick={handleComplete}
                    disabled={submitting}
                    className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold text-sm transition disabled:opacity-50"
                  >
                    {submitting ? "Processing..." : "🎯 Complete"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ─── Two Column Layout ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-in-up">
            {/* ─── Left Column: Details ─── */}
            <div className="lg:col-span-2 space-y-6">
              <div className="info-card p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  📋 Task Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Issue Description</p>
                    <p className="text-sm text-gray-800 mt-1">{task.issue_description}</p>
                  </div>
                  {task.vendor_name && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Vendor</p>
                      <p className="text-sm text-gray-700 mt-1">{task.vendor_name}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Estimated Cost</p>
                      <p className="text-sm font-semibold text-gray-800 mt-1">{formatCost(task.estimated_cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Emergency</p>
                      <p className="text-sm text-gray-700 mt-1">{task.is_emergency ? "🚨 Yes" : "No"}</p>
                    </div>
                  </div>
                  {task.parts_replaced && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Parts Replaced</p>
                      <p className="text-sm text-gray-700 mt-1">{task.parts_replaced}</p>
                    </div>
                  )}
                </div>
              </div>

              {task.photos_urls && task.photos_urls.length > 0 && (
                <div className="info-card p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    🖼️ Photos
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {task.photos_urls.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Maintenance photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ─── Right Column: Timeline ─── */}
            <div className="space-y-6">
              <div className="info-card p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  📜 Activity Timeline
                </h3>
                <div className="space-y-0">
                  {timeline.map((event, index) => (
                    <div
                      key={index}
                      className={`timeline-item ${index === timeline.length - 1 ? "" : "active"}`}
                    >
                      <div className={`timeline-dot ${event.type === "completed" ? "completed" : ""}`}>
                        <span className="text-[8px]">{event.icon}</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{event.label}</p>
                          <p className="text-xs text-gray-600">{event.description}</p>
                          <p className="text-xs text-gray-400 mt-1">By: {event.user}</p>
                        </div>
                        <p className="text-xs text-gray-400 whitespace-nowrap ml-4">
                          {formatDate(event.date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {asset && (
                <div className="info-card p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    🔗 Asset Details
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Name</p>
                      <p className="text-sm font-medium text-gray-800">{asset.name}</p>
                    </div>
                    {asset.serial_number && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Serial Number</p>
                        <p className="text-sm text-gray-700">{asset.serial_number}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Condition</p>
                      <p className="text-sm text-gray-700">{asset.asset_condition}</p>
                    </div>
                    <button
                      onClick={() => router.push(`/assets/${asset.id}`)}
                      className="mt-2 text-sm text-indigo-600 hover:underline font-medium"
                    >
                      View Asset →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}