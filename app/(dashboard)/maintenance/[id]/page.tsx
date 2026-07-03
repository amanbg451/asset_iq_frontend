"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import api from "../../../lib/api";

interface MaintenanceTask {
  id: string;
  asset_id: string;
  client_id: string;
  raised_by: string;
  issue_description: string;
  photos_urls: string[];
  estimated_cost: number | null;
  is_emergency: boolean;
  status:
    | "pending_approval"
    | "approved"
    | "in_progress"
    | "completed"
    | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  vendor_name: string | null;
  parts_replaced: string[];
  created_at: string;
  rejection_reason?: string | null;
}

interface Asset {
  id: string;
  name: string;
  serial_number?: string;
  model?: string;
  manufacturer?: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pending_approval: "bg-yellow-100 text-yellow-700 border-yellow-200",
    approved: "bg-blue-100 text-blue-700 border-blue-200",
    in_progress: "bg-orange-100 text-orange-700 border-orange-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };
  return colors[status] || "bg-gray-100 text-gray-700 border-gray-200";
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending_approval: "Pending Approval",
    approved: "Approved",
    in_progress: "In Progress",
    completed: "Completed",
    rejected: "Rejected",
  };
  return labels[status] || status;
};

const getStatusIcon = (status: string) => {
  const icons: Record<string, string> = {
    pending_approval: "⏳",
    approved: "✅",
    in_progress: "🔧",
    completed: "✔️",
    rejected: "❌",
  };
  return icons[status] || "📋";
};

const formatDate = (date: string | null) => {
  if (!date) return "—";
  return new Date(date).toLocaleString();
};

export default function MaintenanceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<MaintenanceTask | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [raisedBy, setRaisedBy] = useState<User | null>(null);
  const [approvedBy, setApprovedBy] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const fetchTask = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/assets/maintenance/${taskId}`);
      setTask(response.data);
      if (response.data.asset_id) {
        try {
          const assetRes = await api.get(`/assets/${response.data.asset_id}`);
          setAsset(assetRes.data);
        } catch {
          setAsset(null);
        }
      }

      if (response.data.raised_by) {
        try {
          const userRes = await api.get(`/users/${response.data.raised_by}`);
          setRaisedBy(userRes.data);
        } catch {
          setRaisedBy(null);
        }
      }

      if (response.data.approved_by) {
        try {
          const userRes = await api.get(`/users/${response.data.approved_by}`);
          setApprovedBy(userRes.data);
        } catch {
          setApprovedBy(null);
        }
      }
    } catch (error: any) {
      console.error("Error fetching maintenance task:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch task");
      router.push("/maintenance");
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
    if (taskId) {
      fetchTask();
    }
  }, [taskId]);

  const handleApprove = async () => {
    if (!task) return;
    setSubmitting(true);
    try {
      await api.patch(`/assets/maintenance/${task.id}/approve`);
      toast.success("Maintenance approved successfully");
      fetchTask();
    } catch (error: any) {
      console.error("Error approving maintenance:", error);
      toast.error(error.response?.data?.detail || "Failed to approve");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async () => {
    if (!task) return;
    setSubmitting(true);
    try {
      await api.patch(`/assets/maintenance/${task.id}/start`);
      toast.success("Maintenance started successfully");
      fetchTask();
    } catch (error: any) {
      console.error("Error starting maintenance:", error);
      toast.error(error.response?.data?.detail || "Failed to start");
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!task) return;
    setSubmitting(true);
    try {
      await api.patch(`/assets/maintenance/${task.id}/complete`);
      toast.success("Maintenance completed successfully");
      fetchTask();
    } catch (error: any) {
      console.error("Error completing maintenance:", error);
      toast.error(error.response?.data?.detail || "Failed to complete");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!task) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/assets/maintenance/${task.id}/reject`, {
        rejection_reason: rejectionReason.trim(),
      });
      toast.success("Maintenance rejected successfully");
      setShowRejectModal(false);
      setRejectionReason("");
      fetchTask();
    } catch (error: any) {
      console.error("Error rejecting maintenance:", error);
      toast.error(error.response?.data?.detail || "Failed to reject");
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="text-center">
          <p className="text-gray-500">Maintenance task not found</p>
          <button
            onClick={() => router.push("/maintenance")}
            className="mt-4 text-red-600 hover:underline cursor-pointer"
          >
            Back to Maintenance
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
        .fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards; }

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
          max-width: 440px;
          animation: fadeInUp 0.35s ease;
          padding: 28px 32px;
          box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.4);
        }

        .status-badge {
          display: inline-block;
          padding: 6px 16px;
          border-radius: 99px;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid transparent;
        }

        .action-btn {
          padding: 10px 24px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        .action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-100/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative p-6 lg:p-8 max-w-5xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => router.push("/maintenance")}
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
            <span className="text-sm">Back to Maintenance</span>
          </button>

          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 fade-in-up">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-xl blur-md animate-pulse"></div>
                <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md">
                  <span className="text-white font-bold text-2xl">🔧</span>
                </div>
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                  Maintenance Request
                </h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span
                    className={`status-badge ${getStatusColor(task.status)}`}
                  >
                    {getStatusIcon(task.status)} {getStatusLabel(task.status)}
                  </span>
                  {task.is_emergency && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                      🚨 Emergency
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    Created: {formatDate(task.created_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              {task.status === "pending_approval" && (
                <>
                  <button
                    onClick={handleApprove}
                    disabled={submitting}
                    className="action-btn bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800"
                  >
                    {submitting ? "Processing..." : "✅ Approve"}
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={submitting}
                    className="action-btn bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800"
                  >
                    ❌ Reject
                  </button>
                </>
              )}
              {task.status === "approved" && (
                <button
                  onClick={handleStart}
                  disabled={submitting}
                  className="action-btn bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800"
                >
                  {submitting ? "Processing..." : "🔧 Start"}
                </button>
              )}
              {task.status === "in_progress" && (
                <button
                  onClick={handleComplete}
                  disabled={submitting}
                  className="action-btn bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800"
                >
                  {submitting ? "Processing..." : "✔️ Complete"}
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-in-up">
            {/* Issue Details */}
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
                Issue Details
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Issue Description
                  </p>
                  <p className="text-sm text-gray-800 mt-1 font-medium">
                    {task.issue_description}
                  </p>
                </div>
                {task.vendor_name && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Vendor
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      {task.vendor_name}
                    </p>
                  </div>
                )}
                {task.estimated_cost && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Estimated Cost
                    </p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">
                      ₹{task.estimated_cost}
                    </p>
                  </div>
                )}
                {task.photos_urls && task.photos_urls.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Photos
                    </p>
                    <div className="flex gap-2 mt-1">
                      {task.photos_urls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          📷 Photo {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Asset & People */}
            <div className="space-y-6">
              {/* Asset */}
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
                  Asset Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Asset ID
                    </p>
                    <p className="text-sm font-mono text-gray-700 mt-1">
                      {task.asset_id}
                    </p>
                  </div>
                  {asset && (
                    <>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">
                          Name
                        </p>
                        <p className="text-sm font-semibold text-gray-800 mt-1">
                          {asset.name}
                        </p>
                      </div>
                      {asset.serial_number && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide">
                            Serial Number
                          </p>
                          <p className="text-sm font-mono text-gray-700 mt-1">
                            {asset.serial_number}
                          </p>
                        </div>
                      )}
                      {asset.model && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide">
                            Model
                          </p>
                          <p className="text-sm text-gray-700 mt-1">
                            {asset.model}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => router.push(`/assets/${task.asset_id}`)}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    View Asset →
                  </button>
                </div>
              </div>

              {/* People */}
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
                  People
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Raised By
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      {raisedBy
                        ? raisedBy.full_name
                        : task.raised_by || "Unknown"}
                    </p>
                  </div>
                  {task.approved_by && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">
                        Approved By
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        {approvedBy ? approvedBy.full_name : task.approved_by}
                      </p>
                    </div>
                  )}
                  {task.rejection_reason && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">
                        Rejection Reason
                      </p>
                      <p className="text-sm text-red-600 mt-1">
                        {task.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="info-card p-6 mt-6 fade-in-up">
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
              Timeline
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span>📝</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Created</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(task.created_at)}
                  </p>
                </div>
              </div>

              {task.approved_at && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span>✅</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      Approved
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(task.approved_at)}
                    </p>
                  </div>
                </div>
              )}

              {task.started_at && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <span>🔧</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Started</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(task.started_at)}
                    </p>
                  </div>
                </div>
              )}

              {task.completed_at && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <span>✔️</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      Completed
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(task.completed_at)}
                    </p>
                  </div>
                </div>
              )}

              {task.status === "rejected" && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span>❌</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      Rejected
                    </p>
                    <p className="text-xs text-gray-500">
                      {task.rejection_reason || "No reason provided"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── REJECT MODAL ─── */}
      {showRejectModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowRejectModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  Reject Maintenance
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Provide a reason for rejection
                </p>
              </div>
              <button
                onClick={() => setShowRejectModal(false)}
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal resize-none"
                  placeholder="Why is this maintenance request being rejected?"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Reject Request"
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
