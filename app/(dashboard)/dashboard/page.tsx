"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import React from "react";
import toast from "react-hot-toast";
import api from "@/app/lib/api";

// ─── Animated counter ─────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1300, delay = 0, run: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    let start: number | null = null;
    let raf: number;
    const timeout = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.floor(eased * target));
        if (progress < 1) raf = requestAnimationFrame(step);
        else setValue(target);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay, run]);
  return value;
}

function AnimatedNumber({
  value,
  delay = 0,
}: {
  value: number;
  delay?: number;
}) {
  const v = useCountUp(value, 1300, delay, true);
  return <>{v.toLocaleString()}</>;
}

// ─── Memoized Sparkline ────────────────────────────────────────────────────────
const Sparkline = React.memo(function Sparkline({
  data,
  color,
}: {
  data: number[];
  color: string;
}) {
  const min = Math.min(...data),
    max = Math.max(...data),
    range = max - min || 1;
  const w = 70,
    h = 24;
  const pts = data
    .map(
      (v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`,
    )
    .join(" ");
  const id = `sp${color.replace("#", "")}`;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={w}
        cy={h - ((data[data.length - 1] - min) / range) * h}
        r="3"
        fill={color}
      />
    </svg>
  );
});

// ─── Memoized Icon ─────────────────────────────────────────────────────────────
const Icon = React.memo(function Icon({
  name,
  size = 18,
  color = "currentColor",
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const p: Record<string, React.ReactNode> = {
    tag: (
      <>
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </>
    ),
    truck: (
      <>
        <rect x="1" y="3" width="15" height="13" rx="2" />
        <path d="M16 8h4l3 3v5h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </>
    ),
    wrench: (
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    ),
    gps: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
      </>
    ),
    clipboard: (
      <>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="15" y2="17" />
      </>
    ),
    alertc: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
    chevdown: <polyline points="6 9 12 15 18 9" />,
    x: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
    plus: (
      <>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </>
    ),
    audit: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </>
    ),
    flash: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    arrow: (
      <>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </>
    ),
    refresh: (
      <>
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
      </>
    ),
    check: <polyline points="20 6 9 17 4 12" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {p[name]}
    </svg>
  );
});

// ─── Helper: Get client_id from JWT token ───────────────────────────────────
const getClientIdFromToken = () => {
  const token = localStorage.getItem("access_token");
  if (!token) return "";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.client_id || "";
  } catch {
    return "";
  }
};

// ─── Helper: Get user role from JWT token ───────────────────────────────────
const getUserRoleFromToken = () => {
  const token = localStorage.getItem("access_token");
  if (!token) return "";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || "";
  } catch {
    return "";
  }
};

// ─── Dashboard Stats Interface ───────────────────────────────────────────────
interface DashboardStats {
  departments: number;
  managers: number;
  users: number;
  licencesUsed: number;
  licencesTotal: number;
  licenceRemaining: number;
  enabledServices: Array<{ id: string; name: string; code: string }>;
  subscriptionStatus: string;
  subscriptionEndsAt: string | null;
}

// ─── Platform Admin Stats (from API) ─────────────────────────────────────────
const ADMIN_STATS_CONFIG = [
  {
    label: "Total Clients",
    key: "totalClients",
    icon: "tag",
    accent: "#c0152a",
    spark: [0, 0, 0, 0, 0, 0, 0],
  },
  {
    label: "Active Clients",
    key: "activeClients",
    icon: "gps",
    accent: "#10b981",
    spark: [0, 0, 0, 0, 0, 0, 0],
  },
  {
    label: "Active Subscriptions",
    key: "activeSubscriptions",
    icon: "clipboard",
    accent: "#0ea5e9",
    spark: [0, 0, 0, 0, 0, 0, 0],
  },
  {
    label: "Total Services",
    key: "totalServices",
    icon: "tag",
    accent: "#8b5cf6",
    spark: [0, 0, 0, 0, 0, 0, 0],
  },
  {
    label: "Total Users",
    key: "totalUsers",
    icon: "gps",
    accent: "#f59e0b",
    spark: [0, 0, 0, 0, 0, 0, 0],
  },
  {
    label: "Total Departments",
    key: "totalDepartments",
    icon: "clipboard",
    accent: "#ef4444",
    spark: [0, 0, 0, 0, 0, 0, 0],
  },
];

const NOTIFICATIONS = [
  {
    id: 1,
    type: "critical",
    title: "GPS signal lost — Truck-089",
    time: "2 min ago",
    read: false,
  },
  {
    id: 2,
    type: "warning",
    title: "Maintenance overdue — Crane-14",
    time: "1 hr ago",
    read: false,
  },
  {
    id: 3,
    type: "warning",
    title: "Battery low on tracker — Forklift-07",
    time: "3 hr ago",
    read: false,
  },
  {
    id: 4,
    type: "info",
    title: "Audit #A2026 completed",
    time: "5 hr ago",
    read: true,
  },
  {
    id: 5,
    type: "info",
    title: "New asset added — Excavator-15",
    time: "9 hr ago",
    read: true,
  },
  {
    id: 6,
    type: "success",
    title: "Transfer to Mumbai confirmed",
    time: "12 hr ago",
    read: true,
  },
];

const ACTIVITIES = [
  {
    id: 1,
    type: "truck",
    title: "Truck-101 dispatched to Mumbai",
    sub: "",
    time: "10 May, 10:30 AM",
  },
  {
    id: 2,
    type: "audit",
    title: "Audit #A2026 completed",
    sub: "",
    time: "10 May, 09:15 AM",
  },
  {
    id: 3,
    type: "wrench",
    title: "Maintenance approved",
    sub: "Pump-001",
    time: "09 May, 04:45 PM",
  },
  {
    id: 4,
    type: "flash",
    title: "Generator-05 received at site",
    sub: "",
    time: "09 May, 03:20 PM",
  },
  {
    id: 5,
    type: "plus",
    title: "New asset added",
    sub: "Excavator-15",
    time: "09 May, 11:10 AM",
  },
];

const ALERTS = [
  {
    id: 1,
    level: "critical",
    message: "GPS signal lost",
    asset: "Truck-089",
    time: "2 min ago",
  },
  {
    id: 2,
    level: "warning",
    message: "Maintenance overdue",
    asset: "Crane-14",
    time: "1 hr ago",
  },
  {
    id: 3,
    level: "warning",
    message: "Battery low on tracker",
    asset: "Forklift-07",
    time: "3 hr ago",
  },
  {
    id: 4,
    level: "info",
    message: "Transfer pending approval",
    asset: "Generator-03",
    time: "5 hr ago",
  },
];

const CATEGORIES = [
  { label: "Vehicles", value: 38, color: "#c0152a" },
  { label: "Equipment", value: 27, color: "#0ea5e9" },
  { label: "Electronics", value: 18, color: "#8b5cf6" },
  { label: "Tools", value: 11, color: "#f59e0b" },
  { label: "Other", value: 6, color: "#10b981" },
];

const MONTHLY = [
  { m: "Dec", v: 210 },
  { m: "Jan", v: 265 },
  { m: "Feb", v: 238 },
  { m: "Mar", v: 290 },
  { m: "Apr", v: 315 },
  { m: "May", v: 347 },
];

const PERIODS = [
  "Jan 2026",
  "Feb 2026",
  "Mar 2026",
  "Apr 2026",
  "May 2026",
  "Jun 2026",
  "Q1 2026",
  "Q2 2026",
  "FY 2026",
];
const SEARCH_SUGGESTIONS = [
  { type: "asset", label: "Truck-101", sub: "In Transit · Delhi" },
  { type: "asset", label: "Excavator-15", sub: "Active · Mumbai" },
  { type: "asset", label: "Generator-05", sub: "Idle · Pune" },
  { type: "audit", label: "Audit #A2026", sub: "Completed" },
  { type: "transfer", label: "Transfer #T891", sub: "Pending" },
];

// ─── Lazy load AssetMap ────────────────────────────────────────────────────────
const AssetMap = dynamic(() => import("./AssetMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 270,
        background: "#f1f5f9",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: 13 }}>Loading map…</div>
    </div>
  ),
});

// ─── Error Boundary Component ───────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: 270,
            background: "#f1f5f9",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <Icon name="alertc" size={24} color="#ef4444" />
          <div style={{ color: "#64748b", fontSize: 13 }}>
            Map failed to load
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ fontSize: 12, color: "#c0152a", cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Main Dashboard Component ───────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState(NOTIFICATIONS);
  const [showDateOverlay, setShowDate] = useState(false);
  const [selectedPeriod, setPeriod] = useState("May 2026");
  const [mapFilter, setMapFilter] = useState<
    "all" | "transit" | "idle" | "maintenance"
  >("all");
  const [activeTab, setActiveTab] = useState<"activity" | "alerts">("activity");
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [barsVisible, setBarsVisible] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // ─── NEW: Real dashboard stats state ─────────────────────────────────────────
  const [clientStats, setClientStats] = useState<DashboardStats>({
    departments: 0,
    managers: 0,
    users: 0,
    licencesUsed: 0,
    licencesTotal: 0,
    licenceRemaining: 0,
    enabledServices: [],
    subscriptionStatus: "",
    subscriptionEndsAt: null,
  });

  const [adminStats, setAdminStats] = useState({
    totalClients: 0,
    activeClients: 0,
    activeSubscriptions: 0,
    totalServices: 0,
    totalUsers: 0,
    totalDepartments: 0,
  });

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const unread = useMemo(() => notifs.filter((n) => !n.read).length, [notifs]);

  // ─── Fetch dashboard data using new endpoints ──────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    try {
      setDashboardLoading(true);
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const payload = JSON.parse(atob(token.split(".")[1]));
      const role = payload.role || "";
      setUserRole(role);
      setUserEmail(payload.email || payload.name || "");

      // Determine which dashboard endpoint to call based on role
      let endpoint = "";
      if (role === "ADMIN") {
        endpoint = "/dashboard/admin";
      } else if (role === "CLIENT_ADMIN") {
        endpoint = "/dashboard/client";
      } else if (role === "MANAGER") {
        endpoint = "/dashboard/manager";
      } else {
        // Fallback for other roles
        endpoint = "/dashboard/client";
      }

      const response = await api.get(endpoint);
      const data = response.data;

      // Map API response to state based on role
      if (role === "ADMIN") {
        setAdminStats({
          totalClients: data.total_clients || 0,
          activeClients: data.active_clients || 0,
          activeSubscriptions: data.active_subscriptions || 0,
          totalServices: data.total_services || 0,
          totalUsers: data.total_users || 0,
          totalDepartments: data.total_departments || 0,
        });
      } else if (role === "CLIENT_ADMIN") {
        setClientStats({
          departments: data.total_departments || 0,
          managers: data.total_managers || 0,
          users: data.total_users || 0,
          licencesUsed: data.subscription?.used_licences || 0,
          licencesTotal: data.subscription?.licence_count || 0,
          licenceRemaining:
            (data.subscription?.licence_count || 0) -
            (data.subscription?.used_licences || 0),
          enabledServices: [], // Will be fetched separately if needed
          subscriptionStatus: data.subscription?.status || "INACTIVE",
          subscriptionEndsAt: data.subscription?.ends_at || null,
        });
      } else if (role === "MANAGER") {
        // Manager stats - map to client stats structure for display
        setClientStats({
          departments: 1, // Manager belongs to one department
          managers: 0,
          users: data.total_team_members || 0,
          licencesUsed: 0,
          licencesTotal: 0,
          licenceRemaining: 0,
          enabledServices: [],
          subscriptionStatus: "ACTIVE",
          subscriptionEndsAt: null,
        });
      }
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      toast.error(
        error.response?.data?.detail || "Failed to load dashboard data",
      );
    } finally {
      setDashboardLoading(false);
    }
  }, [router]);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => setBarsVisible(true), 200);
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchDashboardData();
  }, [router, fetchDashboardData]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotif(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Build stats array based on role and real data ───────────────────────────
const STATS = useMemo(() => {
  if (userRole === "ADMIN") {
    return [
      {
        label: "Total Clients",
        value: adminStats.totalClients,
        change: 0,
        accent: "#c0152a",
        icon: "tag",
        spark: [0, 0, 0, 0, 0, 0, adminStats.totalClients],
      },
      {
        label: "Active Clients",
        value: adminStats.activeClients,
        change: 0,
        accent: "#0ea5e9",
        icon: "gps",
        spark: [0, 0, 0, 0, 0, 0, adminStats.activeClients],
      },
      {
        label: "Active Subscriptions",
        value: adminStats.activeSubscriptions,
        change: 0,
        accent: "#f59e0b",
        icon: "wrench",
        spark: [0, 0, 0, 0, 0, 0, adminStats.activeSubscriptions],
      },
      {
        label: "Total Services",
        value: adminStats.totalServices,
        change: 0,
        accent: "#10b981",
        icon: "gps",
        spark: [0, 0, 0, 0, 0, 0, adminStats.totalServices],
      },
      {
        label: "Total Users",
        value: adminStats.totalUsers,
        change: 0,
        accent: "#8b5cf6",
        icon: "clipboard",
        spark: [0, 0, 0, 0, 0, 0, adminStats.totalUsers],
      },
      {
        label: "Total Departments",
        value: adminStats.totalDepartments,
        change: 0,
        accent: "#ef4444",
        icon: "alertc",
        spark: [0, 0, 0, 0, 0, 0, adminStats.totalDepartments],
      },
    ];
  }

  // ─── NEW: Manager Stats ──────────────────────────────────────────────────────
  if (userRole === "MANAGER") {
    return [
      {
        label: "Team Members",
        value: clientStats.users,
        change: 0,
        accent: "#8b5cf6",
        icon: "users",  // Note: Make sure 'users' icon exists in your Icon component
        spark: [0, 0, 0, 0, 0, 0, clientStats.users],
      },
      {
        label: "Department Assets",
        value: clientStats.departments,
        change: 0,
        accent: "#0ea5e9",
        icon: "box",  // Note: Make sure 'box' icon exists in your Icon component
        spark: [0, 0, 0, 0, 0, 0, clientStats.departments],
      },
    ];
  }

  // Client Admin Stats
  return [
    {
      label: "Departments",
      value: clientStats.departments,
      change: 0,
      accent: "#c0152a",
      icon: "tag",
      spark: [0, 0, 0, 0, 0, 0, clientStats.departments],
    },
    {
      label: "Managers",
      value: clientStats.managers,
      change: 0,
      accent: "#0ea5e9",
      icon: "truck",
      spark: [0, 0, 0, 0, 0, 0, clientStats.managers],
    },
    {
      label: "Active Users",
      value: clientStats.users,
      change: 0,
      accent: "#10b981",
      icon: "gps",
      spark: [0, 0, 0, 0, 0, 0, clientStats.users],
    },
    {
      label: "Licences Used",
      value: clientStats.licencesUsed,
      change: 0,
      accent: "#8b5cf6",
      icon: "clipboard",
      spark: [0, 0, 0, 0, 0, 0, clientStats.licencesUsed],
    },
    {
      label: "Licences Remaining",
      value: clientStats.licenceRemaining,
      change: 0,
      accent: "#f59e0b",
      icon: "alertc",
      spark: [0, 0, 0, 0, 0, 0, clientStats.licenceRemaining],
    },
    {
      label: "Enabled Services",
      value: clientStats.enabledServices.length,
      change: 0,
      accent: "#10b981",
      icon: "check",
      spark: [0, 0, 0, 0, 0, 0, clientStats.enabledServices.length],
    },
  ];
}, [userRole, adminStats, clientStats]);

  const markAllRead = useCallback(
    () => setNotifs((n) => n.map((x) => ({ ...x, read: true }))),
    [],
  );
  const markRead = useCallback(
    (id: number) =>
      setNotifs((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x))),
    [],
  );

  const filteredSuggestions = useMemo(() => {
    return searchQuery
      ? SEARCH_SUGGESTIONS.filter((s) =>
          s.label.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : SEARCH_SUGGESTIONS;
  }, [searchQuery]);

  const handleAction = useCallback(
    (path: string, label: string) => {
      setLoadingAction(label);
      setTimeout(() => {
        setLoadingAction(null);
        router.push(path);
      }, 600);
    },
    [router],
  );

  const maxBar = useMemo(() => Math.max(...MONTHLY.map((d) => d.v)), []);

  const notifColors: Record<string, { bg: string; dot: string }> = {
    critical: { bg: "#fff1f2", dot: "#ef4444" },
    warning: { bg: "#fffbeb", dot: "#f59e0b" },
    info: { bg: "#eff6ff", dot: "#3b82f6" },
    success: { bg: "#f0fdf4", dot: "#10b981" },
  };

  const alertColors: Record<
    string,
    { bg: string; dot: string; border: string; label: string }
  > = {
    critical: {
      bg: "#fff1f2",
      dot: "#ef4444",
      border: "#fecdd3",
      label: "Critical",
    },
    warning: {
      bg: "#fffbeb",
      dot: "#f59e0b",
      border: "#fde68a",
      label: "Warning",
    },
    info: { bg: "#eff6ff", dot: "#3b82f6", border: "#bfdbfe", label: "Info" },
  };

  const actCfg: Record<string, { bg: string; icon: string; col: string }> = {
    truck: { bg: "#dbeafe", icon: "truck", col: "#3b82f6" },
    audit: { bg: "#dcfce7", icon: "audit", col: "#10b981" },
    wrench: { bg: "#fee2e2", icon: "wrench", col: "#ef4444" },
    flash: { bg: "#fef9c3", icon: "flash", col: "#f59e0b" },
    plus: { bg: "#f3e8ff", icon: "plus", col: "#8b5cf6" },
  };

  if (dashboardLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink     { 0%,100%{opacity:1}50%{opacity:0.2} }
        @keyframes pulse     { 0%,100%{transform:scale(1)}50%{transform:scale(1.12)} }
        @keyframes spin      { from{transform:rotate(0)} to{transform:rotate(360deg)} }

        .dash-card {
          background:#fff; border-radius:16px;
          border:1px solid #f1f5f9;
          box-shadow:0 1px 4px rgba(0,0,0,0.05),0 4px 16px rgba(0,0,0,0.04);
          transition:box-shadow .22s,transform .22s;
        }
        .dash-card:hover { box-shadow:0 6px 30px rgba(0,0,0,0.09); transform:translateY(-2px); }

        .fade-up  { animation:fadeUp 0.5s ease both; }
        .fade-in  { animation:fadeIn 0.25s ease both; }
        .slide-dn { animation:slideDown 0.2s cubic-bezier(0.4,0,0.2,1) both; }

        .stat-card { cursor:pointer; }
        .stat-card:hover .si { transform:scale(1.12) rotate(-5deg); }
        .si { transition:transform 0.2s; display:flex;align-items:center;justify-content:center; }

        .map-filter-btn {
          padding:5px 12px; border-radius:8px; font-size:12px; font-weight:600;
          border:1px solid #e2e8f0; background:white; cursor:pointer;
          transition:all 0.18s; color:#64748b;
        }
        .map-filter-btn:hover  { border-color:#c0152a; color:#c0152a; }
        .map-filter-btn.active { background:#c0152a; color:white; border-color:#c0152a; box-shadow:0 2px 8px rgba(192,21,42,.3); }

        .tab-pill { padding:6px 14px; border-radius:8px; font-size:12px; font-weight:600; border:none; cursor:pointer; transition:all 0.2s; }
        .tab-pill.on  { background:#c0152a; color:white; box-shadow:0 2px 8px rgba(192,21,42,.25); }
        .tab-pill.off { background:transparent; color:#64748b; }
        .tab-pill.off:hover { color:#1e293b; background:#f1f5f9; }

        .act-row { display:flex;align-items:flex-start;gap:10px;padding:9px 8px;border-radius:10px;transition:background 0.15s;cursor:default; }
        .act-row:hover { background:#fafafa; }

        .notif-item { display:flex;align-items:flex-start;gap:10px;padding:10px 14px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #f8fafc; }
        .notif-item:hover { background:#fafafa; }
        .notif-item:last-child { border-bottom:none; }

        .notif-panel {
          position:absolute;top:calc(100% + 8px);right:0;width:360px;
          background:white;border-radius:16px;border:1px solid #f1f5f9;
          box-shadow:0 16px 50px rgba(0,0,0,.15);z-index:300;overflow:hidden;
          animation:slideDown 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        .notif-badge {
          position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;
          background:#ef4444;color:white;font-size:10px;font-weight:700;
          display:flex;align-items:center;justify-content:center;border:2px solid white;
          animation:pulse 2s ease-in-out infinite;
        }
        .search-panel {
          position:absolute;top:calc(100% + 6px);left:0;right:0;
          background:white;border-radius:14px;border:1px solid #f1f5f9;
          box-shadow:0 12px 40px rgba(0,0,0,.12);z-index:300;overflow:hidden;
          animation:slideDown 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        .search-item { display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #f8fafc; }
        .search-item:hover { background:#fef9f9; }
        .search-item:last-child { border-bottom:none; }

        .date-backdrop { position:fixed;inset:0;background:rgba(15,23,42,.35);backdrop-filter:blur(3px);z-index:200;animation:fadeIn 0.2s ease; }
        .date-panel {
          position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:201;
          background:white;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.2);
          padding:28px;width:500px;max-width:92vw;
          animation:slideDown 0.25s cubic-bezier(0.34,1.2,0.64,1);
        }

        .export-btn {
          background:linear-gradient(135deg,#c0152a 0%,#8b0000 100%);
          color:white;border:none;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:600;
          display:flex;align-items:center;gap:6px;cursor:pointer;
          transition:all 0.2s;box-shadow:0 2px 10px rgba(192,21,42,.35);
        }
        .export-btn:hover { transform:translateY(-1px); box-shadow:0 4px 16px rgba(192,21,42,.45); }

        .period-trigger {
          background:white;border:1px solid #e2e8f0;border-radius:10px;
          padding:8px 12px;font-size:13px;color:#475569;
          display:flex;align-items:center;gap:6px;cursor:pointer;transition:all 0.2s;font-weight:500;
        }
        .period-trigger:hover,
        .period-trigger.open { border-color:#c0152a;color:#c0152a; }
        .period-trigger.open { box-shadow:0 0 0 3px rgba(192,21,42,.1); }

        .period-opt {
          padding:10px 14px;font-size:13px;cursor:pointer;color:#374151;
          transition:background 0.15s;border-radius:8px;font-weight:500;
          border:1px solid transparent;text-align:center;
        }
        .period-opt:hover { background:#fef2f2;color:#c0152a; }
        .period-opt.sel   { background:#fff1f2;color:#c0152a;font-weight:700;border-color:#fecdd3; }

        .quick-btn {
          display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:11px;
          border:1px solid #f1f5f9;background:white;cursor:pointer;width:100%;text-align:left;
          transition:all 0.18s;position:relative;overflow:hidden;
        }
        .quick-btn:hover { box-shadow:0 3px 12px rgba(0,0,0,.08);transform:translateX(3px); }
        .quick-btn:active { transform:translateX(1px) scale(.99); }

        .progress-wrap { height:7px;background:#f1f5f9;border-radius:99px;overflow:hidden; }
        .progress-fill { height:100%;border-radius:99px;transition:width 1.1s cubic-bezier(0.4,0,0.2,1); }

        .blink-dot { animation:blink 1.4s ease-in-out infinite; }
        .spin      { animation:spin 0.7s linear infinite; }

        input[type=text]:focus,input[type=text] { outline:none;border:none;background:transparent;font-size:13.5px;color:#1e293b;width:100%; }
        input[type=text]::placeholder { color:#94a3b8; }

        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#e2e8f0;border-radius:99px; }
      `}</style>

      {showDateOverlay && (
        <>
          <div className="date-backdrop" onClick={() => setShowDate(false)} />
          <div className="date-panel">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: "#0f172a",
                    margin: 0,
                  }}
                >
                  Select Period
                </h3>
                <p
                  style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0" }}
                >
                  Dashboard KPIs will update
                </p>
              </div>
              <button
                onClick={() => setShowDate(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  border: "1px solid #e2e8f0",
                  background: "white",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94a3b8",
                }}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
            <div
              style={{
                background: "linear-gradient(135deg,#fff1f2,#fef2f2)",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 20,
                display: "flex",
                gap: 16,
              }}
            >
              {STATS.slice(0, 3).map((s) => (
                <div key={s.label} style={{ flex: 1, textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#94a3b8",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "#0f172a",
                      margin: "2px 0",
                    }}
                  >
                    {s.value.toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: s.change >= 0 ? "#10b981" : "#ef4444",
                    }}
                  >
                    {s.change >= 0 ? "↑" : "↓"} {Math.abs(s.change)}%
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 8,
              }}
            >
              {PERIODS.map((p) => (
                <button
                  key={p}
                  className={`period-opt${selectedPeriod === p ? " sel" : ""}`}
                  onClick={() => {
                    setPeriod(p);
                    setShowDate(false);
                  }}
                >
                  {selectedPeriod === p && (
                    <span style={{ marginRight: 4 }}>✓</span>
                  )}
                  {p}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
        {/* Sticky header */}
        <div
          className="fade-up"
          style={{
            background: "white",
            borderBottom: "1px solid #f1f5f9",
            padding: "14px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            position: "sticky",
            top: 0,
            zIndex: 100,
            boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ flexShrink: 0 }}>
            <h1
              style={{
                fontSize: 19,
                fontWeight: 800,
                color: "#0f172a",
                margin: 0,
                letterSpacing: "-0.3px",
              }}
            >
              Dashboard
            </h1>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
              Welcome back,{" "}
              <span style={{ color: "#c0152a", fontWeight: 600 }}>
                {userEmail}
              </span>
            </p>
          </div>

          <div
            ref={searchRef}
            style={{ flex: 1, maxWidth: 420, position: "relative" }}
          >
            <div
              onClick={() => setSearchOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                background: searchOpen ? "white" : "#f8fafc",
                border: searchOpen
                  ? "1.5px solid #c0152a"
                  : "1.5px solid #f1f5f9",
                borderRadius: 12,
                padding: "8px 13px",
                boxShadow: searchOpen ? "0 0 0 3px rgba(192,21,42,.1)" : "none",
                transition: "all 0.2s",
                cursor: "text",
              }}
            >
              <Icon name="search" size={15} color="#94a3b8" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                placeholder="Search assets, tags, QR, RFID…"
              />
              {searchQuery && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    display: "flex",
                  }}
                >
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
            {searchOpen && (
              <div className="search-panel">
                <div
                  style={{
                    padding: "8px 14px 4px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                  }}
                >
                  {searchQuery ? "Results" : "Recent searches"}
                </div>
                {filteredSuggestions.length === 0 ? (
                  <div
                    style={{
                      padding: "14px",
                      fontSize: 13,
                      color: "#94a3b8",
                      textAlign: "center",
                    }}
                  >
                    No results found
                  </div>
                ) : (
                  filteredSuggestions.map((s, i) => (
                    <div
                      key={i}
                      className="search-item"
                      onClick={() => {
                        setSearchQuery(s.label);
                        setSearchOpen(false);
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background:
                            s.type === "asset"
                              ? "#fff1f2"
                              : s.type === "audit"
                                ? "#f0fdf4"
                                : "#eff6ff",
                          color:
                            s.type === "asset"
                              ? "#c0152a"
                              : s.type === "audit"
                                ? "#10b981"
                                : "#3b82f6",
                        }}
                      >
                        <Icon
                          name={
                            s.type === "asset"
                              ? "tag"
                              : s.type === "audit"
                                ? "audit"
                                : "truck"
                          }
                          size={13}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#1e293b",
                          }}
                        >
                          {s.label}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          {s.sub}
                        </div>
                      </div>
                      <Icon name="arrow" size={12} color="#cbd5e1" />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
            }}
          >
            <div ref={notifRef} style={{ position: "relative" }}>
              <button
                onClick={() => {
                  setShowNotif((v) => !v);
                  setShowDate(false);
                }}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: showNotif ? "#fff1f2" : "#f8fafc",
                  border: showNotif
                    ? "1.5px solid #fecdd3"
                    : "1.5px solid #f1f5f9",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: showNotif ? "#c0152a" : "#64748b",
                  position: "relative",
                  transition: "all .2s",
                }}
              >
                <Icon name="bell" size={17} />
                {unread > 0 && <span className="notif-badge">{unread}</span>}
              </button>
              {showNotif && (
                <div className="notif-panel">
                  <div
                    style={{
                      padding: "14px 16px 10px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        Notifications
                      </span>
                      {unread > 0 && (
                        <span
                          style={{
                            marginLeft: 7,
                            background: "#c0152a",
                            color: "white",
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 99,
                          }}
                        >
                          {unread} new
                        </span>
                      )}
                    </div>
                    <button
                      onClick={markAllRead}
                      style={{
                        fontSize: 12,
                        color: "#c0152a",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Mark all read
                    </button>
                  </div>
                  <div style={{ maxHeight: 310, overflowY: "auto" }}>
                    {notifs.map((n) => {
                      const c = notifColors[n.type];
                      return (
                        <div
                          key={n.id}
                          className="notif-item"
                          style={{ background: n.read ? "white" : c.bg }}
                          onClick={() => markRead(n.id)}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: n.read ? "#e2e8f0" : c.dot,
                              flexShrink: 0,
                              marginTop: 5,
                              display: "inline-block",
                              ...(!n.read && n.type === "critical"
                                ? {
                                    animation:
                                      "blink 1.4s ease-in-out infinite",
                                  }
                                : {}),
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: n.read ? 500 : 700,
                                color: n.read ? "#64748b" : "#1e293b",
                                lineHeight: 1.3,
                              }}
                            >
                              {n.title}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "#94a3b8",
                                marginTop: 1,
                              }}
                            >
                              {n.time}
                            </div>
                          </div>
                          {!n.read && (
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                background: c.dot,
                                flexShrink: 0,
                                marginTop: 5,
                                display: "inline-block",
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div
                    style={{
                      padding: "10px 16px",
                      borderTop: "1px solid #f1f5f9",
                      textAlign: "center",
                    }}
                  >
                    <button
                      onClick={() => {
                        router.push("/notifications");
                        setShowNotif(false);
                      }}
                      style={{
                        fontSize: 12,
                        color: "#c0152a",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      View all →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              className={`period-trigger${showDateOverlay ? " open" : ""}`}
              onClick={() => {
                setShowDate((v) => !v);
                setShowNotif(false);
              }}
            >
              <Icon name="calendar" size={14} /> {selectedPeriod}
              <span
                style={{
                  display: "inline-flex",
                  transition: "transform .2s",
                  transform: showDateOverlay ? "rotate(180deg)" : "rotate(0)",
                }}
              >
                <Icon name="chevdown" size={13} />
              </span>
            </button>

            <button
              className="export-btn"
              onClick={() => toast.success("Report generation started")}
            >
              <Icon name="download" size={15} color="white" /> Export Report
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "22px 28px", maxWidth: 1440 }}>
          {/* KPI row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6,1fr)",
              gap: 13,
              marginBottom: 20,
            }}
          >
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className="dash-card stat-card fade-up"
                style={{
                  padding: "15px 13px",
                  animationDelay: `${80 + i * 50}ms`,
                }}
                onClick={() =>
                  router.push(`/${s.label.toLowerCase().replace(/ /g, "-")}`)
                }
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {s.label}
                  </span>
                  <div
                    className="si"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      background: `${s.accent}18`,
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={s.icon} size={15} color={s.accent} />
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 23,
                    fontWeight: 800,
                    color: "#0f172a",
                    letterSpacing: "-0.5px",
                    lineHeight: 1,
                  }}
                >
                  {mounted ? (
                    <AnimatedNumber value={s.value} delay={100 + i * 50} />
                  ) : (
                    "0"
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    marginTop: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: s.change >= 0 ? "#10b981" : "#ef4444",
                      background: s.change >= 0 ? "#f0fdf4" : "#fff1f2",
                      padding: "2px 6px",
                      borderRadius: 6,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    {s.change >= 0 ? "↑" : "↓"} {Math.abs(s.change)}%
                  </span>
                  <Sparkline data={s.spark} color={s.accent} />
                </div>
              </div>
            ))}
          </div>

          {/* Map + Panel */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 330px",
              gap: 18,
              marginBottom: 18,
            }}
          >
            <div
              className="dash-card fade-up"
              style={{ padding: 18, animationDelay: "400ms" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#0f172a",
                      margin: 0,
                    }}
                  >
                    Live Asset Tracking
                  </h2>
                  <p
                    style={{
                      fontSize: 11,
                      color: "#94a3b8",
                      margin: "2px 0 0",
                    }}
                  >
                    OpenStreetMap · Delhi NCR
                  </p>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {(["all", "transit", "idle", "maintenance"] as const).map(
                    (f) => (
                      <button
                        key={f}
                        className={`map-filter-btn${mapFilter === f ? " active" : ""}`}
                        onClick={() => setMapFilter(f)}
                      >
                        {f === "all"
                          ? "All"
                          : f === "transit"
                            ? "In Transit"
                            : f === "idle"
                              ? "Idle"
                              : "Maint."}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <ErrorBoundary>
                <AssetMap filter={mapFilter} />
              </ErrorBoundary>
            </div>

            <div
              className="dash-card fade-up"
              style={{
                padding: 18,
                animationDelay: "450ms",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    background: "#f8fafc",
                    borderRadius: 10,
                    padding: 3,
                    gap: 2,
                  }}
                >
                  {(["activity", "alerts"] as const).map((t) => (
                    <button
                      key={t}
                      className={`tab-pill ${activeTab === t ? "on" : "off"}`}
                      onClick={() => setActiveTab(t)}
                    >
                      {t === "alerts"
                        ? `Alerts (${ALERTS.length})`
                        : "Activity"}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() =>
                    router.push(
                      activeTab === "activity" ? "/reports" : "/audits",
                    )
                  }
                  style={{
                    fontSize: 12,
                    color: "#c0152a",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  View all →
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {activeTab === "activity"
                  ? ACTIVITIES.map((a, i) => {
                      const c = actCfg[a.type];
                      return (
                        <div
                          key={a.id}
                          className="act-row fade-up"
                          style={{ animationDelay: `${i * 55}ms` }}
                        >
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              background: c.bg,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Icon name={c.icon} size={15} color={c.col} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#1e293b",
                                margin: 0,
                                lineHeight: 1.3,
                              }}
                            >
                              {a.title}
                            </p>
                            {a.sub && (
                              <p
                                style={{
                                  fontSize: 11,
                                  color: "#94a3b8",
                                  margin: "1px 0 0",
                                }}
                              >
                                {a.sub}
                              </p>
                            )}
                            <p
                              style={{
                                fontSize: 11,
                                color: "#cbd5e1",
                                margin: "2px 0 0",
                              }}
                            >
                              {a.time}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  : ALERTS.map((a, i) => {
                      const c = alertColors[a.level];
                      return (
                        <div
                          key={a.id}
                          className="fade-up"
                          onClick={() => router.push("/audits")}
                          style={{
                            background: c.bg,
                            border: `1px solid ${c.border}`,
                            borderRadius: 11,
                            padding: "10px 12px",
                            marginBottom: 8,
                            animationDelay: `${i * 60}ms`,
                            cursor: "pointer",
                            transition: "transform 0.15s",
                          }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLElement).style.transform =
                              "translateX(4px)")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLElement).style.transform =
                              "translateX(0)")
                          }
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginBottom: 3,
                            }}
                          >
                            <span
                              className={
                                a.level === "critical" ? "blink-dot" : ""
                              }
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                background: c.dot,
                                display: "inline-block",
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: c.dot,
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                              }}
                            >
                              {c.label}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: "#94a3b8",
                                marginLeft: "auto",
                              }}
                            >
                              {a.time}
                            </span>
                          </div>
                          <p
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#1e293b",
                              margin: 0,
                            }}
                          >
                            {a.message}
                          </p>
                          <p
                            style={{
                              fontSize: 11,
                              color: "#64748b",
                              margin: "1px 0 0",
                            }}
                          >
                            {a.asset}
                          </p>
                        </div>
                      );
                    })}
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 270px 220px",
              gap: 18,
            }}
          >
            <div
              className="dash-card fade-up"
              style={{ padding: 20, animationDelay: "520ms" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 18,
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#0f172a",
                      margin: 0,
                    }}
                  >
                    Transfer Volume
                  </h2>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#94a3b8",
                      margin: "2px 0 0",
                    }}
                  >
                    Monthly asset transfers
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      color: "#0f172a",
                      letterSpacing: "-0.5px",
                    }}
                  >
                    347
                  </div>
                  <div
                    style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}
                  >
                    ↑ 10.2% vs last month
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 10,
                  height: 130,
                }}
              >
                {MONTHLY.map((d, i) => {
                  const barH = Math.round((d.v / maxBar) * 110);
                  const isLast = i === MONTHLY.length - 1;
                  return (
                    <div
                      key={d.m}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 5,
                        cursor: "pointer",
                        position: "relative",
                      }}
                      onMouseEnter={() => setHoveredBar(i)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {hoveredBar === i && (
                        <div
                          className="slide-dn"
                          style={{
                            position: "absolute",
                            top: -32,
                            fontSize: 11,
                            fontWeight: 700,
                            color: "white",
                            background: "#1e293b",
                            padding: "3px 8px",
                            borderRadius: 6,
                            whiteSpace: "nowrap",
                            zIndex: 5,
                          }}
                        >
                          {d.v} transfers
                        </div>
                      )}
                      <div
                        style={{
                          width: "100%",
                          height: mounted ? barH : 0,
                          background:
                            hoveredBar === i
                              ? "#c0152a"
                              : isLast
                                ? "linear-gradient(180deg,#c0152a,#8b0000)"
                                : "#f1f5f9",
                          borderRadius: "7px 7px 0 0",
                          transition:
                            "height 0.8s cubic-bezier(0.34,1.4,0.64,1),background 0.2s",
                          boxShadow:
                            hoveredBar === i || isLast
                              ? "0 4px 14px rgba(192,21,42,.3)"
                              : "none",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          color: isLast ? "#c0152a" : "#94a3b8",
                          fontWeight: isLast ? 700 : 500,
                        }}
                      >
                        {d.m}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="dash-card fade-up"
              style={{ padding: 18, animationDelay: "560ms" }}
            >
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: "0 0 14px",
                }}
              >
                Asset Categories
              </h2>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 11 }}
              >
                {CATEGORIES.map((c) => (
                  <div
                    key={c.label}
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push("/assets")}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#475569",
                        }}
                      >
                        {c.label}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        {c.value}%
                      </span>
                    </div>
                    <div className="progress-wrap">
                      <div
                        className="progress-fill"
                        style={{
                          width: barsVisible ? `${c.value}%` : "0%",
                          background: c.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="dash-card fade-up"
              style={{ padding: 18, animationDelay: "600ms" }}
            >
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: "0 0 12px",
                }}
              >
                Quick Actions
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  {
                    label: "Add New Asset",
                    icon: "plus",
                    bg: "#fff1f2",
                    col: "#c0152a",
                    path: "/assets/new",
                  },
                  {
                    label: "Schedule Audit",
                    icon: "audit",
                    bg: "#f0fdf4",
                    col: "#10b981",
                    path: "/audits/new",
                  },
                  {
                    label: "New Transfer",
                    icon: "truck",
                    bg: "#eff6ff",
                    col: "#3b82f6",
                    path: "/transfers/new",
                  },
                  {
                    label: "Log Maintenance",
                    icon: "wrench",
                    bg: "#fffbeb",
                    col: "#f59e0b",
                    path: "/maintenance/new",
                  },
                  {
                    label: "View Reports",
                    icon: "download",
                    bg: "#f5f3ff",
                    col: "#8b5cf6",
                    path: "/reports",
                  },
                ].map((a) => (
                  <button
                    key={a.label}
                    className="quick-btn"
                    onClick={() => handleAction(a.path, a.label)}
                  >
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: a.bg,
                        color: a.col,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {loadingAction === a.label ? (
                        <span className="spin">
                          <Icon name="refresh" size={13} color={a.col} />
                        </span>
                      ) : (
                        <Icon name={a.icon} size={14} color={a.col} />
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#374151",
                        flex: 1,
                      }}
                    >
                      {a.label}
                    </span>
                    <Icon name="arrow" size={12} color="#cbd5e1" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
