"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, ReactNode } from "react";
import toast from "react-hot-toast";
import Image from "next/image";
import api from "@/app/lib/api";

// ─── Service Code to Menu Item Mapping ──────────────────────────────────────
interface ServiceMenuItem {
  code: string;
  name: string;
  path: string;
  icon: ReactNode;
}

// All possible service-based menu items
const serviceMenuMap: ServiceMenuItem[] = [
  {
    code: "USERS",
    name: "Users",
    path: "/users",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    code: "DEPARTMENTS",
    name: "Departments",
    path: "/departments",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 7h-4.18A3 3 0 0016 5.18V4a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2z" />
        <line x1="8" y1="12" x2="16" y2="12" />
        <line x1="8" y1="8" x2="16" y2="8" />
      </svg>
    ),
  },
  {
    code: "ASSET_MANAGEMENT",
    name: "Assets",
    path: "/assets",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
  {
    code: "TRACKING",
    name: "Tracking",
    path: "/tracking",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2a10 10 0 010 20A10 10 0 0112 2" />
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  {
    code: "REPORTS",
    name: "Reports",
    path: "/reports",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    code: "NOTIFICATIONS",
    name: "Notifications",
    path: "/notifications",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    code: "AUDITS",
    name: "Audits",
    path: "/audits",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="15" y2="17" />
        <polyline points="9 9 10 9 11 9" />
      </svg>
    ),
  },
  {
    code: "MAINTENANCE",
    name: "Maintenance",
    path: "/maintenance",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    code: "TRANSFERS",
    name: "Transfers",
    path: "/transfers",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8l4-4-4-4" />
        <path d="M6 16l-4 4 4 4" />
        <path d="M2 12h20" />
        <path d="M22 12H2" />
      </svg>
    ),
  },
];

// ─── Icon Helpers ────────────────────────────────────────────────────────────
const getDashboardIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const getSettingsIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

// ─── Platform Admin Only Menu Items ──────────────────────────────────────────
interface PlatformMenuItem {
  name: string;
  path: string;
  icon: ReactNode;
}

const platformAdminMenuItems: PlatformMenuItem[] = [
  {
    name: "Platform Admins",
    path: "/platform-admins",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    name: "Roles",
    path: "/roles",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" />
      </svg>
    ),
  },
  {
    name: "Clients",
    path: "/clients",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    name: "Services",
    path: "/services",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
];

// ─── Helper: Get user role from JWT token ───────────────────────────────────
const getUserRole = () => {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch {
    return null;
  }
};

// ─── Helper: Get client_id from JWT token ───────────────────────────────────
const getClientIdFromToken = () => {
  if (typeof window === "undefined") return "";
  const token = localStorage.getItem("access_token");
  if (!token) return "";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.client_id || "";
  } catch {
    return "";
  }
};

// ─── Menu Item Interface ─────────────────────────────────────────────────────
interface MenuItem {
  name: string;
  path: string;
  icon: ReactNode;
}

// ─── User Profile Interface ──────────────────────────────────────────────────
interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  client_id?: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("User");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userInitials, setUserInitials] = useState<string>("U");
  const [dynamicMenuItems, setDynamicMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Fetch User Profile ─────────────────────────────────────────────────────
  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const role = payload.role || null;
        setUserRole(role);

        const name =
          payload.full_name || payload.name || payload.email || "User";
        setUserName(name);
        setUserEmail(payload.email || "");
        setUserInitials(name.charAt(0).toUpperCase());
      } catch {
        // JWT decode failed
      }

      try {
        let profileData: UserProfile | null = null;
        const role = getUserRole();

        if (role === "ADMIN") {
          try {
            const response = await api.get("/platform-admins/me");
            profileData = response.data;
          } catch {
            // Endpoint might not exist
          }
        } else if (role === "CLIENT_ADMIN") {
          try {
            const response = await api.get("/client/me");
            profileData = response.data;
          } catch {
            // Fallback
          }
        } else {
          try {
            const response = await api.get("/users/me");
            profileData = response.data;
          } catch {
            // Fallback
          }
        }

        if (profileData) {
          const name = profileData.full_name || profileData.email || "User";
          setUserName(name);
          setUserEmail(profileData.email || "");
          setUserInitials(name.charAt(0).toUpperCase());
          setUserRole(profileData.role || userRole);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    } catch (error) {
      console.error("Error in fetchUserProfile:", error);
    }
  };

  // ─── Fetch services and build dynamic menu ─────────────────────────────────
  const fetchServicesAndBuildMenu = async () => {
    try {
      const role = getUserRole();
      setUserRole(role);

      if (role === "ADMIN") {
        const allItems: MenuItem[] = [
          { name: "Dashboard", path: "/dashboard", icon: getDashboardIcon() },
          ...platformAdminMenuItems,
          ...serviceMenuMap.map((s) => ({
            name: s.name,
            path: s.path,
            icon: s.icon,
          })),
          { name: "Settings", path: "/settings", icon: getSettingsIcon() },
        ];
        setDynamicMenuItems(allItems);
        setLoading(false);
        return;
      }

      if (role === "CLIENT_ADMIN") {
        const clientId = getClientIdFromToken();
        if (!clientId) {
          setLoading(false);
          return;
        }

        const response = await api.get(
          `/clients/${clientId}/subscriptions/services`,
        );
        const purchasedServices = response.data || [];

        const menuItems: MenuItem[] = [
          { name: "Dashboard", path: "/dashboard", icon: getDashboardIcon() },
        ];

        purchasedServices.forEach((service: { code: string }) => {
          const menuItem = serviceMenuMap.find((s) => s.code === service.code);
          if (menuItem) {
            menuItems.push({
              name: menuItem.name,
              path: menuItem.path,
              icon: menuItem.icon,
            });
          }
        });

        menuItems.push({
          name: "Settings",
          path: "/settings",
          icon: getSettingsIcon(),
        });

        setDynamicMenuItems(menuItems);
        setLoading(false);
        return;
      }

      setDynamicMenuItems([
        { name: "Dashboard", path: "/dashboard", icon: getDashboardIcon() },
      ]);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching services:", error);
      setDynamicMenuItems([
        { name: "Dashboard", path: "/dashboard", icon: getDashboardIcon() },
      ]);
      setLoading(false);
    }
  };

  // ─── Initialize sidebar on mount ───────────────────────────────────────────
  useEffect(() => {
    fetchUserProfile();
    fetchServicesAndBuildMenu();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    toast.success("Logged out successfully");
    router.push("/login");
  };

  if (loading) {
    return (
      <aside
        className="sidebar-root flex flex-col h-screen sticky top-0 select-none"
        style={{ width: collapsed ? "72px" : "240px" }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </aside>
    );
  }

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.1); }
          50% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sidebar-item-enter {
          animation: slideIn 0.2s ease forwards;
        }
        .sidebar-root {
          background: #ffffff;
          border-radius: 16px;
          margin: 8px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03);
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                      transform 0.4s ease,
                      box-shadow 0.4s ease;
          position: sticky;
          top: 8px;
          height: calc(100vh - 16px);
          overflow: hidden;
          z-index: 50;
          border: 1px solid rgba(0,0,0,0.04);
          transform: perspective(800px) rotateY(0.5deg);
          transform-style: preserve-3d;
        }
        .sidebar-root:hover {
          transform: perspective(800px) rotateY(1deg);
          box-shadow: 0 8px 40px rgba(0,0,0,0.08), 0 2px 12px rgba(0,0,0,0.04);
        }
        .sidebar-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 0% 0%, rgba(220,38,38,0.02) 0%, transparent 70%);
          pointer-events: none;
          border-radius: 16px;
        }
        .nav-item {
          position: relative;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 10px;
          cursor: pointer;
          margin-bottom: 2px;
          transform: translateX(0);
        }
        .nav-item:hover {
          transform: translateX(4px);
        }
        .nav-item-active {
          transform: translateX(0);
        }
        .nav-item::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(220,38,38,0.06);
          opacity: 0;
          transition: opacity 0.25s ease, transform 0.25s ease;
          border-radius: 10px;
          transform: scale(0.95);
        }
        .nav-item:hover::before {
          opacity: 1;
          transform: scale(1);
        }
        .nav-item-active {
          background: rgba(220,38,38,0.08) !important;
          box-shadow: 0 2px 12px rgba(220,38,38,0.06);
        }
        .nav-item-active::after {
          content: '';
          position: absolute;
          left: 0;
          top: 20%;
          height: 60%;
          width: 3px;
          background: #dc2626;
          border-radius: 0 4px 4px 0;
          box-shadow: 0 0 12px rgba(220,38,38,0.3);
        }
        .nav-icon {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          color: #dc2626;
        }
        .nav-item:hover .nav-icon {
          transform: scale(1.1) rotate(-2deg);
          filter: drop-shadow(0 2px 4px rgba(220,38,38,0.15));
        }
        .nav-item-active .nav-icon {
          color: #dc2626;
          transform: scale(1.05);
        }
        .nav-label {
          color: #1f2937;
          font-weight: 650;
          font-size: 0.85rem;
          transition: color 0.2s ease;
        }
        .nav-item:hover .nav-label {
          color: #dc2626;
        }
        .nav-item-active .nav-label {
          color: #dc2626;
          font-weight: 600;
        }
        .tooltip {
          position: absolute;
          left: calc(100% + 12px);
          top: 50%;
          transform: translateY(-50%) scale(0.95);
          background: #1f2937;
          color: white;
          font-size: 12px;
          font-weight: 500;
          padding: 5px 12px;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: 999;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .tooltip::before {
          content: '';
          position: absolute;
          right: 100%;
          top: 50%;
          transform: translateY(-50%);
          border: 5px solid transparent;
          border-right-color: #1f2937;
        }
        .nav-item:hover .tooltip {
          opacity: 1;
          transform: translateY(-50%) scale(1);
        }
        .logo-glow {
          animation: glow-pulse 3s ease-in-out infinite;
          border-radius: 12px;
        }
        .logo-container {
          transition: transform 0.3s ease;
        }
        .logo-container:hover {
          transform: scale(1.02) rotate(-2deg);
        }
        .collapse-btn {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 8px;
          padding: 4px;
          color: #9ca3af;
        }
        .collapse-btn:hover {
          background: rgba(220,38,38,0.06);
          color: #dc2626;
          transform: rotate(180deg);
        }
        .online-dot {
          animation: pulse-dot 2s ease-in-out infinite;
        }
        .divider {
          height: 1px;
          background: linear-gradient(90deg, 
            transparent, 
            rgba(0,0,0,0.05) 20%, 
            rgba(0,0,0,0.05) 80%, 
            transparent
          );
          margin: 6px 16px;
        }
        .user-card {
          background: rgba(255,255,255,0.8);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(220,38,38,0.06);
          border-radius: 12px;
          transition: all 0.3s ease;
        }
        .user-card:hover {
          background: rgba(255,255,255,0.95);
          box-shadow: 0 4px 12px rgba(220,38,38,0.06);
          border-color: rgba(220,38,38,0.12);
        }
        .logout-btn {
          transition: all 0.25s ease;
          border-radius: 8px;
          color: #dc2626;
        }
        .logout-btn:hover {
          background: rgba(220,38,38,0.05);
          color: #dc2626;
        }
        .logout-btn:hover .logout-icon {
          color: #dc2626;
        }
        .logout-icon {
          transition: color 0.2s ease;
          color: #dc2626;
        }
        .nav-scroll {
          scrollbar-width: thin;
          scrollbar-color: #e5e7eb transparent;
        }
        .nav-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .nav-scroll::-webkit-scrollbar-track {
          background: transparent;
          margin: 8px 0;
        }
        .nav-scroll::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 20px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .nav-scroll::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }

        /* ─── Powered By Styles ─── */
        .powered-by {
          padding: 2px 10px 5px;
          border-top: 1px solid rgba(0,0,0,0.04);
          margin: 0 12px 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.3s ease;
        }
        .powered-by:hover {
          background: rgba(220,38,38,0.03);
          border-radius: 8px;
          border-color: rgba(220,38,38,0.08);
        }
        .powered-by-text {
          margin-top: 7px;
          font-size: 10px;
          font-weight: 700;
          color: #000000;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .powered-by-logo {
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .powered-by:hover .powered-by-logo {
          opacity: 0.9;
          transform: scale(1.02);
        }
        .powered-by-collapsed {
          padding: 8px 0;
          margin: 0 4px 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
        }
        .powered-by-collapsed .powered-by-text {
          font-size: 7px;
        }
        .powered-by-collapsed .powered-by-logo {
          width: 20px;
          height: 20px;
        }
      `}</style>

      <aside
        className="sidebar-root flex flex-col select-none"
        style={{ width: collapsed ? "72px" : "240px" }}
      >
        {/* Header / Logo */}
        <div
          className="flex items-center justify-between px-4 py-4 flex-shrink-0"
          style={{ minHeight: 64 }}
        >
          <div className="flex items-center gap-3 overflow-hidden logo-container">
            <div
              className="logo-glow flex-shrink-0 rounded-xl flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                background: "rgba(220,38,38,0.08)",
                border: "1.5px solid rgba(220,38,38,0.12)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                  fill="#dc2626"
                  opacity="0.9"
                />
                <path
                  d="M9 12l2 2 4-4"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            {!collapsed && (
              <div className="sidebar-item-enter">
                <span className="text-black font-bold text-lg tracking-tight leading-none">
                  AssetIQ
                </span>
                <p
                  className="text-[10px] mt-0.5 font-medium tracking-wider uppercase"
                  style={{ color: "#9ca3af" }}
                >
                  Management Suite
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="collapse-btn flex-shrink-0"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              {collapsed ? (
                <path d="M9 18l6-6-6-6" />
              ) : (
                <path d="M15 18l-6-6 6-6" />
              )}
            </svg>
          </button>
        </div>

        <div className="divider" />

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto nav-scroll">
          {dynamicMenuItems.map((item, i) => {
            const isActive =
              pathname === item.path || pathname.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                href={item.path}
                onMouseEnter={() => setHoveredItem(item.path)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`nav-item flex items-center gap-3 px-3 py-2.5 ${isActive ? "nav-item-active" : ""}`}
                style={{
                  animationDelay: `${i * 30}ms`,
                  textDecoration: "none",
                }}
              >
                <span
                  className="nav-icon flex-shrink-0"
                  style={{
                    transform:
                      hoveredItem === item.path
                        ? "scale(1.1) rotate(-2deg)"
                        : "scale(1)",
                  }}
                >
                  {item.icon}
                </span>

                {!collapsed && (
                  <span className="nav-label sidebar-item-enter truncate">
                    {item.name}
                  </span>
                )}

                {collapsed && <span className="tooltip">{item.name}</span>}

                {isActive && !collapsed && (
                  <span className="ml-auto flex-shrink-0">
                    <span
                      className="block rounded-full online-dot"
                      style={{
                        width: 5,
                        height: 5,
                        background: "#dc2626",
                        boxShadow: "0 0 8px rgba(220,38,38,0.3)",
                      }}
                    />
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="divider" />

        {/* User Profile & Logout */}
        <div className="px-3 pb-2 flex-shrink-0 space-y-1">
          <button
            onClick={handleLogout}
            className="logout-btn w-full flex items-center gap-3 px-3 py-1.5 cursor-pointer"
            style={{
              background: "none",
              border: "none",
              width: "100%",
            }}
          >
            <span className="logout-icon flex-shrink-0">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            {!collapsed && <span className="text-sm font-bold">Logout</span>}
            {collapsed && <span className="tooltip">Logout</span>}
          </button>
        </div>

        {/* ─── Powered By Section ─── */}
        <div className={collapsed ? "powered-by-collapsed" : "powered-by"}>
          <span className="powered-by-text">Powered By</span>
          <div className="powered-by-logo">
            <Image
              src="/asset/logo.png"
              alt="Leidtech"
              width={collapsed ? 20 : 55}
              height={collapsed ? 20 : 28}
              className="object-contain"
            />
          </div>
        </div>
      </aside>
    </>
  );
}
