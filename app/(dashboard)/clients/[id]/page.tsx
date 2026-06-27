"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import api from "@/app/lib/api";

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

interface Department {
  id: string;
  client_id: string;
  name: string;
  code: string;
  description: string;
  manager_id: string | null;
  is_active: boolean;
}

interface Subscription {
  id: string;
  client_id: string;
  licence_count: number;
  used_licences: number;
  max_assets: number;
  max_departments: number;
  price: number;
  status: string;
  starts_at: string;
  ends_at: string;
  auto_renew: boolean;
}

interface SubscribedService {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface ClientAdmin {
  id: string;
  client_id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  is_active: boolean;
}

export default function ClientDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscribedServices, setSubscribedServices] = useState<
    SubscribedService[]
  >([]);
  const [clientAdmin, setClientAdmin] = useState<ClientAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "details" | "departments" | "subscription" | "admins"
  >("details");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showCreateSubscriptionModal, setShowCreateSubscriptionModal] =
    useState(false);
  const [showEditSubscriptionModal, setShowEditSubscriptionModal] =
    useState(false);
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [showEditAdminModal, setShowEditAdminModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Client>>({});
  const [editAdminFormData, setEditAdminFormData] = useState<
    Partial<ClientAdmin>
  >({});
  const [createAdminForm, setCreateAdminForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [subscriptionFormData, setSubscriptionFormData] = useState({
    licence_count: 100,
    max_assets: 500,
    max_departments: 20,
    price: 50000,
    starts_at: new Date().toISOString().split("T")[0],
    ends_at: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      .toISOString()
      .split("T")[0],
    auto_renew: true,
    services: [] as string[],
  });
  const [servicesList, setServicesList] = useState<SubscribedService[]>([]);
  const [editSubscriptionFormData, setEditSubscriptionFormData] = useState({
    licence_count: 0,
    max_assets: 0,
    max_departments: 0,
    price: 0,
    starts_at: "",
    ends_at: "",
    auto_renew: false,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const fetchClient = async () => {
    try {
      setLoading(true);
      const [clientRes, deptRes, subRes] = await Promise.all([
        api.get(`/clients/${clientId}`),
        api.get(`/clients/${clientId}/departments`),
        api
          .get(`/clients/${clientId}/subscriptions`)
          .catch(() => ({ data: null })),
      ]);
      setClient(clientRes.data);
      setDepartments(deptRes.data);

      if (subRes.data && subRes.data.subscription) {
        setSubscription(subRes.data.subscription);
        setSubscribedServices(subRes.data.services || []);
      } else if (subRes.data && subRes.data.id) {
        setSubscription(subRes.data);
      } else {
        setSubscription(null);
        setSubscribedServices([]);
      }
    } catch (error: any) {
      console.error("Error fetching client:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch client");
      router.push("/clients");
    } finally {
      setLoading(false);
    }
  };

  const fetchServicesList = async () => {
    try {
      const response = await api.get("/services");
      setServicesList(response.data);
    } catch (error: any) {
      console.error("Error fetching services:", error);
    }
  };

  const fetchClientAdmin = async () => {
    try {
      const response = await api
        .get(`/client/${clientId}/admin`)
        .catch(() => ({ data: null }));
      setClientAdmin(response.data);
    } catch (error) {
      console.error("Error fetching client admin:", error);
      setClientAdmin(null);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    if (clientId) {
      fetchClient();
      fetchServicesList();
      fetchClientAdmin();
    }
  }, [clientId]);

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setSubmitting(true);
    try {
      await api.patch(`/clients/${client.id}`, editFormData);
      toast.success("Client updated successfully");
      setShowEditModal(false);
      fetchClient();
    } catch (error: any) {
      console.error("Error updating client:", error);
      toast.error(error.response?.data?.detail || "Failed to update client");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!client) return;
    setSubmitting(true);
    try {
      await api.delete(`/clients/${client.id}`);
      toast.success("Client deactivated successfully");
      setShowDeleteConfirm(false);
      router.push("/clients");
    } catch (error: any) {
      console.error("Error deactivating client:", error);
      toast.error(
        error.response?.data?.detail || "Failed to deactivate client",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreClient = async () => {
    if (!client) return;
    setSubmitting(true);
    try {
      await api.patch(`/clients/${client.id}/restore`, {});
      toast.success("Client restored successfully");
      setShowRestoreConfirm(false);
      fetchClient();
    } catch (error: any) {
      console.error("Error restoring client:", error);
      toast.error(error.response?.data?.detail || "Failed to restore client");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setSubmitting(true);
    try {
      await api.post(
        `/clients/${client.id}/subscriptions`,
        subscriptionFormData,
      );
      toast.success("Subscription created successfully");
      setShowCreateSubscriptionModal(false);
      fetchClient();
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      toast.error(
        error.response?.data?.detail || "Failed to create subscription",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscription) return;
    setSubmitting(true);
    try {
      await api.patch(`/clients/subscriptions/${subscription.id}`, editSubscriptionFormData);
      toast.success("Subscription updated successfully");
      setShowEditSubscriptionModal(false);
      fetchClient();
    } catch (error: any) {
      console.error("Error updating subscription:", error);
      toast.error(
        error.response?.data?.detail || "Failed to update subscription",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuspendSubscription = async () => {
    if (!subscription) return;
    setSubmitting(true);
    try {
      await api.patch(`/clients/subscriptions/${subscription.id}/suspend`);
      toast.success("Subscription suspended");
      fetchClient();
    } catch (error: any) {
      console.error("Error suspending subscription:", error);
      toast.error(
        error.response?.data?.detail || "Failed to suspend subscription",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!subscription) return;
    setSubmitting(true);
    try {
      await api.patch(`/clients/subscriptions/${subscription.id}/reactivate`);
      toast.success("Subscription reactivated");
      fetchClient();
    } catch (error: any) {
      console.error("Error reactivating subscription:", error);
      toast.error(
        error.response?.data?.detail || "Failed to reactivate subscription",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateClientAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    if (clientAdmin) {
      toast.error(
        "This client already has an administrator. Only one client admin can be assigned per client.",
      );
      setShowCreateAdminModal(false);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/client/create-admin", {
        client_id: client.id,
        ...createAdminForm,
      });
      toast.success("Client admin created successfully");
      setShowCreateAdminModal(false);
      setCreateAdminForm({ full_name: "", email: "", password: "", phone: "" });
      fetchClientAdmin();
    } catch (error: any) {
      console.error("Error creating client admin:", error);
      toast.error(
        error.response?.data?.detail || "Failed to create client admin",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateClientAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientAdmin) return;
    setSubmitting(true);
    try {
      await api.patch(`/client/admin/${clientAdmin.id}`, editAdminFormData);
      toast.success("Client admin updated successfully");
      setShowEditAdminModal(false);
      fetchClientAdmin();
    } catch (error: any) {
      console.error("Error updating client admin:", error);
      toast.error(
        error.response?.data?.detail || "Failed to update client admin",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = () => {
    if (client) {
      setEditFormData({
        name: client.name,
        industry: client.industry,
        contact_email: client.contact_email,
        contact_phone: client.contact_phone,
        address: client.address,
        address_line_1: client.address_line_1,
        address_line_2: client.address_line_2,
        address_line_3: client.address_line_3,
      });
      setShowEditModal(true);
    }
  };

  const openEditAdminModal = () => {
    if (clientAdmin) {
      setEditAdminFormData({
        full_name: clientAdmin.full_name,
        phone: clientAdmin.phone,
      });
      setShowEditAdminModal(true);
    }
  };

  const openEditSubscriptionModal = () => {
    if (subscription) {
      setEditSubscriptionFormData({
        licence_count: subscription.licence_count,
        max_assets: subscription.max_assets,
        max_departments: subscription.max_departments,
        price: subscription.price,
        starts_at: subscription.starts_at.split("T")[0],
        ends_at: subscription.ends_at.split("T")[0],
        auto_renew: subscription.auto_renew,
      });
      setShowEditSubscriptionModal(true);
    }
  };

  const handleServiceToggle = (serviceId: string) => {
    setSubscriptionFormData((prev) => ({
      ...prev,
      services: prev.services.includes(serviceId)
        ? prev.services.filter((id) => id !== serviceId)
        : [...prev.services, serviceId],
    }));
  };

  const formatAddress = [
    client?.address_line_1,
    client?.address_line_2,
    client?.address_line_3,
  ]
    .filter(Boolean)
    .join(", ");

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="text-center">
          <p className="text-gray-500">Client not found</p>
          <button
            onClick={() => router.push("/clients")}
            className="mt-4 text-red-600 hover:underline cursor-pointer"
          >
            Back to Clients
          </button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-700";
      case "SUSPENDED":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
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
          border-radius: 32px;
          width: 95%;
          max-width: 820px;
          max-height: 90vh;
          overflow-y: auto;
          animation: fadeInScale 0.35s cubic-bezier(0.2, 0.9, 0.4, 1.2);
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(220, 38, 38, 0.08);
          padding: 28px 32px 32px;
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
          cursor: default;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px -8px rgba(0,0,0,0.1);
        }
        
        .tab-btn {
          padding: 8px 20px;
          border-radius: 30px;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s ease;
          cursor: pointer;
          background: transparent;
          border: none;
        }
        .tab-btn.active {
          background: #dc2626;
          color: white;
          box-shadow: 0 2px 8px rgba(220,38,38,0.25);
        }
        .tab-btn.inactive {
          color: #6b7280;
          background: #f3f4f6;
        }
        .tab-btn.inactive:hover {
          background: #e5e7eb;
          color: #374151;
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
        
        .admin-card {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .admin-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -6px rgba(0,0,0,0.15);
        }

        .modal-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px 24px;
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
        .input-icon-wrapper textarea,
        .input-icon-wrapper select {
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
        .input-icon-wrapper select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 40px;
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
            onClick={() => router.push("/clients")}
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
            <span>Back to Clients</span>
          </button>

          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 fade-in-up">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-xl blur-md animate-pulse"></div>
                <div className="relative w-16 h-16 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md">
                  <span className="text-white font-bold text-2xl">
                    {client.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                  {client.name}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${client.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {client.is_active ? "Active" : "Deactivated"}
                  </span>
                  {client.industry && (
                    <span className="text-sm text-gray-500">
                      {client.industry}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              {!client.is_active && (
                <button
                  onClick={() => setShowRestoreConfirm(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold text-sm cursor-pointer"
                >
                  Restore Client
                </button>
              )}
              <button
                onClick={openEditModal}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold text-sm cursor-pointer"
              >
                Edit
              </button>
              {client.is_active && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold text-sm cursor-pointer"
                >
                  Deactivate
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 fade-in-up">
            <button
              onClick={() => setActiveTab("details")}
              className={`tab-btn ${activeTab === "details" ? "active" : "inactive"}`}
            >
              Contact & Address
            </button>
            <button
              onClick={() => setActiveTab("departments")}
              className={`tab-btn ${activeTab === "departments" ? "active" : "inactive"}`}
            >
              Departments ({departments.length})
            </button>
            <button
              onClick={() => setActiveTab("subscription")}
              className={`tab-btn ${activeTab === "subscription" ? "active" : "inactive"}`}
            >
              Subscription {subscription ? "✓" : ""}
            </button>
            <button
              onClick={() => setActiveTab("admins")}
              className={`tab-btn ${activeTab === "admins" ? "active" : "inactive"}`}
            >
              Admins {clientAdmin ? "(1/1)" : "(0/1)"}
            </button>
          </div>

          {/* Tab Content: Details */}
          {activeTab === "details" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-in-up">
              <div className="stat-card p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4l3 3" />
                  </svg>
                  Contact Information
                </h3>
                <div className="space-y-3">
                  {client.contact_email && (
                    <div className="flex items-center gap-3">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#6b7280"
                        strokeWidth="2"
                      >
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      <span className="text-gray-700">
                        {client.contact_email}
                      </span>
                    </div>
                  )}
                  {client.contact_phone && (
                    <div className="flex items-center gap-3">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#6b7280"
                        strokeWidth="2"
                      >
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                      </svg>
                      <span className="text-gray-700">
                        {client.contact_phone}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="stat-card p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <svg
                    width="20"
                    height="20"
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
                  Address Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Client ID
                    </p>
                    <p className="text-sm font-mono text-gray-700 mt-1">
                      {client.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Address
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      {formatAddress || "Not specified"}
                    </p>
                  </div>
                  {client.created_at && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">
                        Created At
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        {new Date(client.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab Content: Departments */}
          {activeTab === "departments" && (
            <div className="stat-card p-6 fade-in-up">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                >
                  <path d="M20 7h-4.18A3 3 0 0016 5.18V4a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2z" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                  <line x1="8" y1="8" x2="16" y2="8" />
                </svg>
                Departments ({departments.length})
              </h3>
              {departments.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No departments found for this client.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-800">
                            {dept.name}
                          </p>
                          {dept.code && (
                            <p className="text-xs text-gray-400 font-mono mt-0.5">
                              {dept.code}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${dept.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                        >
                          {dept.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {dept.description && (
                        <p className="text-xs text-gray-500 mt-2">
                          {dept.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Subscription */}
          {activeTab === "subscription" && (
            <div className="fade-in-up">
              {!subscription ? (
                <div className="stat-card p-8 text-center">
                  <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#9ca3af"
                      strokeWidth="1.5"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    No Active Subscription
                  </h3>
                  <p className="text-gray-500 mb-4">
                    This client doesn't have a subscription yet.
                  </p>
                  <button
                    onClick={() => setShowCreateSubscriptionModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    + Create Subscription
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(subscription.status)}`}
                      >
                        {subscription.status}
                      </span>
                      {subscription.auto_renew && (
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-700">
                          Auto Renew
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      {subscription.status === "ACTIVE" ? (
                        <button
                          onClick={handleSuspendSubscription}
                          disabled={submitting}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-xl hover:bg-yellow-700 font-semibold text-sm cursor-pointer"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={handleReactivateSubscription}
                          disabled={submitting}
                          className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold text-sm cursor-pointer"
                        >
                          Reactivate
                        </button>
                      )}
                      <button
                        onClick={openEditSubscriptionModal}
                        className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold text-sm cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <div className="stat-card p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">
                        {subscription.licence_count}
                      </p>
                      <p className="text-xs text-gray-500">Licences</p>
                    </div>
                    <div className="stat-card p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">
                        {subscription.used_licences}
                      </p>
                      <p className="text-xs text-gray-500">Used Licences</p>
                    </div>
                    <div className="stat-card p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">
                        {subscription.licence_count -
                          subscription.used_licences}
                      </p>
                      <p className="text-xs text-gray-500">Remaining</p>
                    </div>
                    <div className="stat-card p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">
                        {subscription.max_assets}
                      </p>
                      <p className="text-xs text-gray-500">Max Assets</p>
                    </div>
                    <div className="stat-card p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">
                        {subscription.max_departments}
                      </p>
                      <p className="text-xs text-gray-500">Max Departments</p>
                    </div>
                    <div className="stat-card p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">
                        ₹{subscription.price.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">Price</p>
                    </div>
                  </div>

                  <div className="stat-card p-6 mb-6">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">
                      Subscription Period
                    </h3>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-400">Start Date</p>
                        <p className="text-gray-800 font-medium">
                          {new Date(
                            subscription.starts_at,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="2"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400">End Date</p>
                        <p className="text-gray-800 font-medium">
                          {new Date(subscription.ends_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="stat-card p-6">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">
                      Services Included
                    </h3>
                    {subscribedServices.length === 0 ? (
                      <p className="text-gray-500 text-sm">
                        No services included in this subscription.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {subscribedServices.map((service) => (
                          <span
                            key={service.id}
                            className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium"
                          >
                            {service.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab Content: Client Admins */}
          {activeTab === "admins" && (
            <div className="fade-in-up">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Client Administrator
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {clientAdmin
                      ? "1 of 1 admin assigned"
                      : "No admin assigned yet"}
                  </p>
                </div>

                {!clientAdmin && (
                  <button
                    onClick={() => setShowCreateAdminModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    + Create Admin
                  </button>
                )}
              </div>

              {!clientAdmin ? (
                <div className="stat-card p-8 text-center">
                  <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#9ca3af"
                      strokeWidth="1.5"
                    >
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    No Client Admin
                  </h3>
                  <p className="text-gray-500 mb-4">
                    This client doesn't have an administrator yet.
                  </p>
                  <button
                    onClick={() => setShowCreateAdminModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    + Create Client Admin
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  <div
                    className="stat-card p-5 admin-card"
                    onClick={openEditAdminModal}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center">
                        <svg
                          width="26"
                          height="26"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#dc2626"
                          strokeWidth="1.8"
                        >
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-800 text-lg">
                              {clientAdmin.full_name}
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {clientAdmin.email}
                            </p>
                            {clientAdmin.phone && (
                              <p className="text-sm text-gray-400 mt-1">
                                📞 {clientAdmin.phone}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${clientAdmin.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                            >
                              {clientAdmin.is_active ? "Active" : "Inactive"}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditAdminModal();
                              }}
                              className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-200 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M17 3l4 4-7 7H10v-4l7-7z" />
                                <path d="M4 20h16" />
                              </svg>
                              Edit
                            </button>
                          </div>
                        </div>
                        <div className="mt-3">
                          <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-medium">
                            {clientAdmin.role || "CLIENT_ADMIN"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── ENHANCED: Edit Client Modal ─── */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400/60 via-amber-300/40 to-amber-400/60 rounded-t-2xl"></div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Edit Client</h2>
                  <p className="text-sm text-gray-400 mt-0.5 font-normal">Update client information</p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleUpdateClient}>
                <div className="modal-grid-2">
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Client Name <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏢</span>
                      <input
                        type="text"
                        value={editFormData.name || ""}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, name: e.target.value })
                        }
                        required
                        autoComplete="off"
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="ABC Corporation"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Industry
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏭</span>
                      <input
                        type="text"
                        value={editFormData.industry || ""}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            industry: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Technology, Logistics, Healthcare"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Contact Email
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">✉️</span>
                      <input
                        type="email"
                        value={editFormData.contact_email || ""}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            contact_email: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="admin@company.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Contact Phone
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📞</span>
                      <input
                        type="tel"
                        value={editFormData.contact_phone || ""}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            contact_phone: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="+91 1234567890"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Address Line 1
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📍</span>
                      <input
                        type="text"
                        value={editFormData.address_line_1 || ""}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            address_line_1: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Building/Flat number, Street"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Address Line 2
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏠</span>
                      <input
                        type="text"
                        value={editFormData.address_line_2 || ""}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            address_line_2: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Area, Locality"
                      />
                    </div>
                  </div>

                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Address Line 3
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🗺️</span>
                      <input
                        type="text"
                        value={editFormData.address_line_3 || ""}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            address_line_3: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="City, State, PIN Code"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-6 mt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Updating...
                      </>
                    ) : (
                      "Update Client"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── ENHANCED: Edit Client Admin Modal ─── */}
      {showEditAdminModal && clientAdmin && (
        <div
          className="modal-overlay"
          onClick={() => setShowEditAdminModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400/60 via-amber-300/40 to-amber-400/60 rounded-t-2xl"></div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Edit Client Admin</h2>
                  <p className="text-sm text-gray-400 mt-0.5 font-normal">Update administrator information</p>
                </div>
                <button
                  onClick={() => setShowEditAdminModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleUpdateClientAdmin}>
                <div className="modal-grid-2">
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">👤</span>
                      <input
                        type="text"
                        value={editAdminFormData.full_name || ""}
                        onChange={(e) =>
                          setEditAdminFormData({
                            ...editAdminFormData,
                            full_name: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Enter full name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Email
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">✉️</span>
                      <input
                        type="email"
                        value={clientAdmin.email}
                        disabled
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                      Email cannot be changed
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Phone
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📞</span>
                      <input
                        type="tel"
                        value={editAdminFormData.phone || ""}
                        onChange={(e) =>
                          setEditAdminFormData({
                            ...editAdminFormData,
                            phone: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="+91 9876543210"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-6 mt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowEditAdminModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Updating...
                      </>
                    ) : (
                      "Update Admin"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── ENHANCED: Create Subscription Modal ─── */}
      {showCreateSubscriptionModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateSubscriptionModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-400/60 via-red-300/40 to-red-400/60 rounded-t-2xl"></div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Create Subscription</h2>
                  <p className="text-sm text-gray-400 mt-0.5 font-normal">Assign licences and services</p>
                </div>
                <button
                  onClick={() => setShowCreateSubscriptionModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateSubscription}>
                <div className="modal-grid-2">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Licence Count
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🪪</span>
                      <input
                        type="number"
                        value={subscriptionFormData.licence_count || ""}
                        onChange={(e) =>
                          setSubscriptionFormData({
                            ...subscriptionFormData,
                            licence_count:
                              e.target.value === ""
                                ? 0
                                : parseInt(e.target.value),
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Max Assets
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📦</span>
                      <input
                        type="number"
                        value={subscriptionFormData.max_assets || ""}
                        onChange={(e) =>
                          setSubscriptionFormData({
                            ...subscriptionFormData,
                            max_assets:
                              e.target.value === ""
                                ? 0
                                : parseInt(e.target.value),
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Max Departments
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏛️</span>
                      <input
                        type="number"
                        value={subscriptionFormData.max_departments || ""}
                        onChange={(e) =>
                          setSubscriptionFormData({
                            ...subscriptionFormData,
                            max_departments:
                              e.target.value === ""
                                ? 0
                                : parseInt(e.target.value),
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Price (₹)
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">💰</span>
                      <input
                        type="number"
                        value={subscriptionFormData.price || ""}
                        onChange={(e) =>
                          setSubscriptionFormData({
                            ...subscriptionFormData,
                            price:
                              e.target.value === ""
                                ? 0
                                : parseInt(e.target.value),
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="50000"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Start Date
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📅</span>
                      <input
                        type="date"
                        value={subscriptionFormData.starts_at}
                        onChange={(e) =>
                          setSubscriptionFormData({
                            ...subscriptionFormData,
                            starts_at: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 text-sm font-normal"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      End Date
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📅</span>
                      <input
                        type="date"
                        value={subscriptionFormData.ends_at}
                        onChange={(e) =>
                          setSubscriptionFormData({
                            ...subscriptionFormData,
                            ends_at: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 text-sm font-normal"
                      />
                    </div>
                  </div>

                  <div className="full-width">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={subscriptionFormData.auto_renew}
                        onChange={(e) =>
                          setSubscriptionFormData({
                            ...subscriptionFormData,
                            auto_renew: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">Auto Renew</span>
                    </label>
                  </div>

                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Services to Include
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 border border-gray-200 rounded-xl">
                      {servicesList
                        .filter((service) => service.is_active !== false)
                        .map((service) => (
                          <label
                            key={service.id}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={subscriptionFormData.services.includes(
                                service.id,
                              )}
                              onChange={() => handleServiceToggle(service.id)}
                              className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                            />
                            <span className="text-sm text-gray-700">
                              {service.name}
                            </span>
                          </label>
                        ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                      Only active services are shown
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-6 mt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateSubscriptionModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating...
                      </>
                    ) : (
                      "Create Subscription"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── ENHANCED: Edit Subscription Modal ─── */}
      {showEditSubscriptionModal && subscription && (
        <div
          className="modal-overlay"
          onClick={() => setShowEditSubscriptionModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400/60 via-amber-300/40 to-amber-400/60 rounded-t-2xl"></div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Edit Subscription</h2>
                  <p className="text-sm text-gray-400 mt-0.5 font-normal">Update subscription details</p>
                </div>
                <button
                  onClick={() => setShowEditSubscriptionModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleEditSubscription}>
                <div className="modal-grid-2">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Licence Count
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🪪</span>
                      <input
                        type="number"
                        value={editSubscriptionFormData.licence_count}
                        onChange={(e) =>
                          setEditSubscriptionFormData({
                            ...editSubscriptionFormData,
                            licence_count: parseInt(e.target.value) || 0,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Enter licence count"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Max Assets
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📦</span>
                      <input
                        type="number"
                        value={editSubscriptionFormData.max_assets}
                        onChange={(e) =>
                          setEditSubscriptionFormData({
                            ...editSubscriptionFormData,
                            max_assets: parseInt(e.target.value) || 0,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Enter max assets"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Max Departments
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🏛️</span>
                      <input
                        type="number"
                        value={editSubscriptionFormData.max_departments}
                        onChange={(e) =>
                          setEditSubscriptionFormData({
                            ...editSubscriptionFormData,
                            max_departments: parseInt(e.target.value) || 0,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Enter max departments"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Price (₹)
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">💰</span>
                      <input
                        type="number"
                        value={editSubscriptionFormData.price}
                        onChange={(e) =>
                          setEditSubscriptionFormData({
                            ...editSubscriptionFormData,
                            price: parseInt(e.target.value) || 0,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="Enter price"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Start Date
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📅</span>
                      <input
                        type="date"
                        value={editSubscriptionFormData.starts_at}
                        onChange={(e) =>
                          setEditSubscriptionFormData({
                            ...editSubscriptionFormData,
                            starts_at: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 text-sm font-normal"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      End Date
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📅</span>
                      <input
                        type="date"
                        value={editSubscriptionFormData.ends_at}
                        onChange={(e) =>
                          setEditSubscriptionFormData({
                            ...editSubscriptionFormData,
                            ends_at: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all input-fancy text-gray-800 text-sm font-normal"
                      />
                    </div>
                  </div>

                  <div className="full-width">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editSubscriptionFormData.auto_renew}
                        onChange={(e) =>
                          setEditSubscriptionFormData({
                            ...editSubscriptionFormData,
                            auto_renew: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">Auto Renew</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-6 mt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowEditSubscriptionModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Updating...
                      </>
                    ) : (
                      "Update Subscription"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── ENHANCED: Create Client Admin Modal ─── */}
      {showCreateAdminModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateAdminModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-400/60 via-red-300/40 to-red-400/60 rounded-t-2xl"></div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Create Client Admin</h2>
                  <p className="text-sm text-gray-400 mt-0.5 font-normal">Assign an administrator for this client</p>
                </div>
                <button
                  onClick={() => setShowCreateAdminModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateClientAdmin}>
                <div className="modal-grid-2">
                  <div className="full-width">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">👤</span>
                      <input
                        type="text"
                        name="full_name"
                        value={createAdminForm.full_name}
                        onChange={(e) =>
                          setCreateAdminForm({
                            ...createAdminForm,
                            full_name: e.target.value,
                          })
                        }
                        required
                        autoComplete="off"
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">✉️</span>
                      <input
                        type="email"
                        name="email"
                        value={createAdminForm.email}
                        onChange={(e) =>
                          setCreateAdminForm({
                            ...createAdminForm,
                            email: e.target.value,
                          })
                        }
                        required
                        autoComplete="new-email"
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="admin@company.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">🔒</span>
                      <input
                        type="password"
                        name="password"
                        value={createAdminForm.password}
                        onChange={(e) =>
                          setCreateAdminForm({
                            ...createAdminForm,
                            password: e.target.value,
                          })
                        }
                        required
                        autoComplete="new-password"
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="••••••••"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 ml-1 font-normal">
                      Min 8 characters with uppercase, lowercase, and number
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Phone
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="icon">📞</span>
                      <input
                        type="tel"
                        name="phone"
                        value={createAdminForm.phone}
                        onChange={(e) =>
                          setCreateAdminForm({
                            ...createAdminForm,
                            phone: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all input-fancy text-gray-800 placeholder-gray-400 text-sm font-normal"
                        placeholder="+91 9876543210"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-6 mt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateAdminModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating...
                      </>
                    ) : (
                      "Create Admin"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── ENHANCED: Delete Confirmation Modal ─── */}
      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  width="28"
                  height="28"
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
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Deactivate Client?
              </h3>
              <p className="text-gray-500 text-sm mb-2 font-normal">
                Are you sure you want to deactivate{" "}
                <span className="font-semibold text-gray-700">
                  {client.name}
                </span>
                ?
              </p>
              <p className="text-xs text-gray-400 mb-4 font-normal">
                This action can be reversed later.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteClient}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
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

      {/* ─── ENHANCED: Restore Confirmation Modal ─── */}
      {showRestoreConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowRestoreConfirm(false)}
        >
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  width="28"
                  height="28"
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
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Restore Client?
              </h3>
              <p className="text-gray-500 text-sm mb-2 font-normal">
                Are you sure you want to restore{" "}
                <span className="font-semibold text-gray-700">
                  {client.name}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRestoreConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestoreClient}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm shadow-md cursor-pointer"
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