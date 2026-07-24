"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import api, { formatValidationError } from "@/app/lib/api";

// ============= TYPE DEFINITIONS =============

interface AuditSession {
  id: string;
  scheduled_date: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  assigned_to: string;
  started_at: string | null;
  completed_at: string | null;
  total_assets: number;
  audited_assets: number;
  tracking_session_id: string | null;
}

interface Audit {
  id: string;
  name: string;
  description: string;
  auditor_id: string;
  auditor_name: string;
  frequency_unit: "DAY" | "WEEK" | "MONTH";
  frequency_interval: number;
  start_date: string;
  end_date: string;
  next_run_date: string;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
  created_at: string;
  sessions: AuditSession[];
}

interface SessionAsset {
  asset_id: string;
  asset_name: string;
  serial_number: string | null;
  status: string;
  condition_status: string;
  quantity_expected: number;
  quantity_found: number;
  remarks: string | null;
  photo_url: string | null;
  expected_location_id: string | null;
  expected_latitude: string | null;
  expected_longitude: string | null;
  audit_latitude: string | null;
  audit_longitude: string | null;
  location_status: string;
  audited_by: string | null;
  audited_at: string | null;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

// ============= MAIN COMPONENT =============

export default function AuditDetailPage() {
  const router = useRouter();
  const params = useParams();
  const auditId = params.id as string;

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedSession, setSelectedSession] = useState<AuditSession | null>(
    null,
  );
  const [sessionAssets, setSessionAssets] = useState<SessionAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // ============= FETCH FUNCTIONS =============

  const fetchAuditDetails = useCallback(async () => {
    if (!auditId) return;

    try {
      setLoading(true);
      const response = await api.get(`/audits/${auditId}`);
      setAudit(response.data);
    } catch (error: any) {
      console.error("Error fetching audit details:", error);
      toast.error(
        formatValidationError(error) || "Failed to fetch audit details",
      );
      if (error.response?.status === 404) {
        router.push("/audits");
      }
    } finally {
      setLoading(false);
    }
  }, [auditId, router]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get("/users");
      const activeUsers = (response.data || []).filter(
        (u: User) => u.is_active !== false,
      );
      setUsers(activeUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
    }
  }, []);

  const fetchSessionAssets = useCallback(async (sessionId: string) => {
    try {
      setLoadingAssets(true);
      const response = await api.get(`/audits/sessions/${sessionId}/assets`);
      setSessionAssets(response.data || []);
    } catch (error: any) {
      console.error("Error fetching session assets:", error);
      toast.error("Failed to fetch session assets");
      setSessionAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  // ============= INITIAL LOAD =============

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }

    fetchAuditDetails();
    fetchUsers();
  }, [mounted, router, fetchAuditDetails, fetchUsers]);

  // ============= HELPER FUNCTIONS =============

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-700",
      INACTIVE: "bg-gray-100 text-gray-700",
      COMPLETED: "bg-blue-100 text-blue-700",
      PENDING: "bg-yellow-100 text-yellow-700",
      IN_PROGRESS: "bg-purple-100 text-purple-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const getFrequencyLabel = (unit: string, interval: number) => {
    const labels: Record<string, string> = {
      DAY: `Every ${interval} day${interval > 1 ? "s" : ""}`,
      WEEK: `Every ${interval} week${interval > 1 ? "s" : ""}`,
      MONTH: `Every ${interval} month${interval > 1 ? "s" : ""}`,
    };
    return labels[unit] || `${interval} ${unit}`;
  };

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user ? user.full_name : "Unknown";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ============= RENDER =============

  if (!mounted) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">Audit not found</h2>
          <button
            onClick={() => router.push("/audits")}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Back to Audits
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

        .status-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 600;
        }

        .info-row {
          display: flex;
          padding: 8px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .info-row .label {
          width: 140px;
          font-weight: 500;
          color: #6b7280;
          flex-shrink: 0;
        }
        .info-row .value {
          color: #1f2937;
          font-weight: 500;
        }

        .session-card {
          background: white;
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          padding: 16px;
          transition: all 0.2s ease;
        }
        .session-card:hover {
          border-color: #e5e7eb;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .asset-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        .asset-card {
          background: #fafbfc;
          border: 1px solid #f1f5f9;
          border-radius: 10px;
          padding: 12px;
          transition: all 0.2s ease;
        }
        .asset-card:hover {
          border-color: #e5e7eb;
          background: white;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* ===== BACK BUTTON ===== */}
          <button
            onClick={() => router.push("/audits")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors mb-6"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            <span>Back to Audits</span>
          </button>

          {/* ===== HEADER ===== */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 fade-in-up">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md flex-shrink-0">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">
                    {audit.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`status-badge ${getStatusBadge(audit.status)}`}
                    >
                      {audit.status}
                    </span>
                    <span className="text-sm text-gray-500">
                      Created {formatDate(audit.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/audits/${audit.id}/edit`)}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-semibold flex items-center gap-2"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
            </div>
          </div>

          {/* ===== AUDIT INFORMATION ===== */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6 fade-in-up">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Audit Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
              <div className="info-row">
                <span className="label">Description</span>
                <span className="value">
                  {audit.description || "No description"}
                </span>
              </div>
              <div className="info-row">
                <span className="label">Auditor</span>
                <span className="value">{audit.auditor_name}</span>
              </div>
              <div className="info-row">
                <span className="label">Frequency</span>
                <span className="value">
                  {getFrequencyLabel(
                    audit.frequency_unit,
                    audit.frequency_interval,
                  )}
                </span>
              </div>
              <div className="info-row">
                <span className="label">Next Run</span>
                <span className="value">{formatDate(audit.next_run_date)}</span>
              </div>
              <div className="info-row">
                <span className="label">Start Date</span>
                <span className="value">{formatDate(audit.start_date)}</span>
              </div>
              <div className="info-row">
                <span className="label">End Date</span>
                <span className="value">{formatDate(audit.end_date)}</span>
              </div>
              <div className="info-row">
                <span className="label">Total Sessions</span>
                <span className="value">{audit.sessions?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* ===== SESSIONS ===== */}
          <div className="fade-in-up">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Audit Sessions
            </h2>

            {!audit.sessions || audit.sessions.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-500">
                No sessions found for this audit.
              </div>
            ) : (
              <div className="space-y-4">
                {audit.sessions.map((session) => (
                  <div key={session.id} className="session-card">
                    <div className="flex flex-wrap justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className={`status-badge ${getStatusBadge(session.status)}`}
                          >
                            {session.status}
                          </span>
                          <span className="text-sm text-gray-500">
                            Scheduled: {formatDate(session.scheduled_date)}
                          </span>
                          {session.started_at && (
                            <span className="text-sm text-gray-500">
                              Started: {formatDateTime(session.started_at)}
                            </span>
                          )}
                          {session.completed_at && (
                            <span className="text-sm text-gray-500">
                              Completed: {formatDateTime(session.completed_at)}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Assets:</span>
                            <span className="ml-2 font-medium">
                              {session.total_assets}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Audited:</span>
                            <span className="ml-2 font-medium">
                              {session.audited_assets}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Assigned To:</span>
                            <span className="ml-2 font-medium">
                              {getUserName(session.assigned_to)}
                            </span>
                          </div>
                          {session.tracking_session_id && (
                            <div>
                              <span className="text-gray-500">Tracking:</span>
                              <span className="ml-2 font-medium text-xs">
                                {session.tracking_session_id}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedSession(
                            selectedSession?.id === session.id ? null : session,
                          );
                          if (selectedSession?.id !== session.id) {
                            fetchSessionAssets(session.id);
                          } else {
                            setSessionAssets([]);
                          }
                        }}
                        className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1 whitespace-nowrap"
                      >
                        {selectedSession?.id === session.id ? (
                          "Hide Assets"
                        ) : (
                          <>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            View Assets
                          </>
                        )}
                      </button>
                    </div>

                    {/* ===== SESSION ASSETS ===== */}
                    {selectedSession?.id === session.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        {loadingAssets ? (
                          <div className="flex justify-center py-4">
                            <div className="w-8 h-8 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
                          </div>
                        ) : sessionAssets.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No assets found in this session.
                          </p>
                        ) : (
                          <div className="asset-grid">
                            {sessionAssets.map((asset) => (
                              <div key={asset.asset_id} className="asset-card">
                                <div className="flex items-start gap-3">
                                  {asset.photo_url ? (
                                    <img
                                      src={asset.photo_url}
                                      alt={asset.asset_name}
                                      className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                                      onError={(e) =>
                                        (e.currentTarget.style.display = "none")
                                      }
                                    />
                                  ) : (
                                    <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="#9ca3af"
                                        strokeWidth="1.5"
                                      >
                                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                                        <line x1="7" y1="7" x2="7.01" y2="7" />
                                      </svg>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-gray-800 truncate">
                                      {asset.asset_name}
                                    </p>
                                    {asset.serial_number && (
                                      <p className="text-xs text-gray-500">
                                        SN: {asset.serial_number}
                                      </p>
                                    )}
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                      <span
                                        className={`text-xs px-2 py-0.5 rounded-full ${
                                          asset.status === "PENDING"
                                            ? "bg-yellow-100 text-yellow-700"
                                            : asset.status === "VERIFIED" ||
                                                asset.status === "COMPLETED"
                                              ? "bg-green-100 text-green-700"
                                              : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        {asset.status}
                                      </span>
                                      <span
                                        className={`text-xs px-2 py-0.5 rounded-full ${
                                          asset.location_status === "VERIFIED"
                                            ? "bg-green-100 text-green-700"
                                            : asset.location_status ===
                                                "MISMATCH"
                                              ? "bg-red-100 text-red-700"
                                              : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        {asset.location_status}
                                      </span>
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                        {asset.condition_status}
                                      </span>
                                    </div>
                                    {asset.remarks && (
                                      <p className="text-xs text-gray-500 mt-1 truncate">
                                        Note: {asset.remarks}
                                      </p>
                                    )}
                                    {asset.audited_at && (
                                      <p className="text-xs text-gray-400 mt-0.5">
                                        Audited:{" "}
                                        {new Date(
                                          asset.audited_at,
                                        ).toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
