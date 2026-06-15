"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

const menuItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
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
  {
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
  {
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
    name: "Settings",
    path: "/settings",
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
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.3); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .sidebar-item-enter {
          animation: slideIn 0.2s ease forwards;
        }
        .active-pill {
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.2);
          box-shadow: 0 2px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        .sidebar-root {
          background: linear-gradient(170deg, #c0152a 0%, #8b0000 55%, #6b0000 100%);
          box-shadow: 4px 0 24px rgba(0,0,0,0.18);
          transition: width 0.3s cubic-bezier(0.4,0,0.2,1);
        }
        .nav-item {
          position: relative;
          overflow: hidden;
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        .nav-item::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0.08);
          opacity: 0;
          transition: opacity 0.2s;
          border-radius: 10px;
        }
        .nav-item:hover::before {
          opacity: 1;
        }
        .nav-item-active::after {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 60%;
          background: white;
          border-radius: 0 3px 3px 0;
        }
        .tooltip {
          position: absolute;
          left: calc(100% + 12px);
          top: 50%;
          transform: translateY(-50%);
          background: #1a1a1a;
          color: white;
          font-size: 12px;
          font-weight: 500;
          padding: 5px 10px;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s;
          z-index: 999;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .tooltip::before {
          content: '';
          position: absolute;
          right: 100%;
          top: 50%;
          transform: translateY(-50%);
          border: 5px solid transparent;
          border-right-color: #1a1a1a;
        }
        .nav-item:hover .tooltip {
          opacity: 1;
        }
        .logo-glow {
          box-shadow: 0 0 0 0 rgba(255,255,255,0.4);
          animation: logo-pulse 3s ease-in-out infinite;
        }
        @keyframes logo-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.1); }
          50% { box-shadow: 0 0 0 6px rgba(255,255,255,0); }
        }
        .collapse-btn {
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        .collapse-btn:hover {
          background: rgba(255,255,255,0.15);
        }
        .online-dot {
          animation: pulse-dot 2s ease-in-out infinite;
        }
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          margin: 8px 16px;
        }
      `}</style>

      <aside
        className="sidebar-root flex flex-col h-screen sticky top-0 select-none"
        style={{ width: collapsed ? "72px" : "240px" }}
      >
        {/* Header / Logo */}
        <div
          className="flex items-center justify-between px-4 py-5"
          style={{ minHeight: 72 }}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className="logo-glow flex-shrink-0 rounded-xl flex items-center justify-center"
              style={{
                width: 38,
                height: 38,
                background: "rgba(255,255,255,0.18)",
                border: "1.5px solid rgba(255,255,255,0.3)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                  fill="white"
                  opacity="0.9"
                />
                <path
                  d="M9 12l2 2 4-4"
                  stroke="#c0152a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            {!collapsed && (
              <div className="sidebar-item-enter">
                <span className="text-white font-bold text-lg tracking-tight leading-none">
                  AssetIQ
                </span>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  Management Suite
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="collapse-btn flex-shrink-0 rounded-lg p-1.5"
            style={{ color: "rgba(255,255,255,0.6)" }}
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
                <>
                  <path d="M9 18l6-6-6-6" />
                </>
              ) : (
                <>
                  <path d="M15 18l-6-6 6-6" />
                </>
              )}
            </svg>
          </button>
        </div>

        <div className="divider" />

        {/* Nav Items */}
        <nav
          className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {menuItems.map((item, i) => {
            const isActive =
              pathname === item.path || pathname.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                href={item.path}
                onMouseEnter={() => setHoveredItem(item.path)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer ${isActive ? "nav-item-active active-pill" : ""}`}
                style={{
                  animationDelay: `${i * 40}ms`,
                  color: isActive ? "white" : "rgba(255,255,255,0.65)",
                  textDecoration: "none",
                }}
              >
                <span
                  className="flex-shrink-0 transition-transform duration-200"
                  style={{
                    color: isActive ? "white" : "rgba(255,255,255,0.7)",
                    transform:
                      hoveredItem === item.path ? "scale(1.15)" : "scale(1)",
                  }}
                >
                  {item.icon}
                </span>

                {!collapsed && (
                  <span
                    className="text-sm font-medium sidebar-item-enter truncate"
                    style={{
                      color: isActive ? "white" : "rgba(255,255,255,0.75)",
                    }}
                  >
                    {item.name}
                  </span>
                )}

                {collapsed && <span className="tooltip">{item.name}</span>}

                {/* Active indicator dot */}
                {isActive && !collapsed && (
                  <span className="ml-auto flex-shrink-0">
                    <span
                      className="block rounded-full online-dot"
                      style={{
                        width: 6,
                        height: 6,
                        background: "rgba(255,255,255,0.8)",
                      }}
                    />
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="divider" />

        {/* User + Logout */}
        <div className="px-3 pb-4 space-y-1">
          {/* User profile row */}
          {!collapsed && (
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl sidebar-item-enter"
              style={{ background: "rgba(0,0,0,0.15)" }}
            >
              <div
                className="flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  width: 32,
                  height: 32,
                  background: "linear-gradient(135deg, #ff6b6b, #c0152a)",
                  color: "white",
                  border: "2px solid rgba(255,255,255,0.3)",
                }}
              >
                AU
              </div>
              <div className="overflow-hidden">
                <p
                  className="text-xs font-semibold truncate"
                  style={{ color: "white" }}
                >
                  Admin User
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  Super Admin
                </p>
              </div>
              <span
                className="ml-auto flex-shrink-0 rounded-full online-dot"
                style={{
                  width: 8,
                  height: 8,
                  background: "#4ade80",
                  border: "1.5px solid rgba(255,255,255,0.4)",
                }}
              />
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
            style={{
              color: "rgba(255,255,255,0.6)",
              background: "none",
              border: "none",
            }}
          >
            <span className="flex-shrink-0 transition-transform duration-200">
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
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            {!collapsed && (
              <span
                className="text-sm font-medium sidebar-item-enter"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                Logout
              </span>
            )}
            {collapsed && <span className="tooltip">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
