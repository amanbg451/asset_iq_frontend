"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import api from "../lib/api";

const decodeToken = (token: string) => {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch (error) {
    console.error("Failed to decode token", error);
    return null;
  }
};

function AnimatedDots() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 28 }).map((_, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-red-400 opacity-20"
          style={{
            width: `${3 + (i % 4)}px`,
            height: `${3 + (i % 4)}px`,
            left: `${(i * 37 + 5) % 100}%`,
            top: `${(i * 53 + 10) % 100}%`,
            animation: `floatDot ${5 + (i % 5)}s ease-in-out ${(i * 0.3) % 3}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

function DashboardIllustration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden select-none">
      {/* Ambient glow blob */}
      <div
        className="absolute w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(220,38,38,0.35) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          filter: "blur(60px)",
          animation: "pulseBlob 6s ease-in-out infinite alternate",
        }}
      />

      {/* Main dashboard card */}
      <div
        className="relative z-10"
        style={{ animation: "floatCard 5s ease-in-out infinite alternate" }}
      >
        {/* Dashboard window mock */}
        <div
          className="rounded-2xl overflow-hidden shadow-2xl"
          style={{
            width: 420,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.15)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Title bar */}
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <span className="w-3 h-3 rounded-full bg-red-500 opacity-80" />
            <span className="w-3 h-3 rounded-full bg-yellow-400 opacity-80" />
            <span className="w-3 h-3 rounded-full bg-green-400 opacity-80" />
            <span className="ml-3 text-xs text-white/50 font-mono">
              AssetAi - Dashboard
            </span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 px-4 pt-4 pb-2">
            {[
              {
                label: "Total Assets",
                value: "12,483",
                delta: "+4.2%",
                color: "#EF4444",
              },
              {
                label: "Active",
                value: "9,741",
                delta: "+1.8%",
                color: "#10B981",
              },
              { label: "Alerts", value: "37", delta: "-12%", color: "#F59E0B" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl p-3"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                <div className="text-white/40 text-[10px] mb-1">{s.label}</div>
                <div className="text-white font-bold text-lg leading-none">
                  {s.value}
                </div>
                <div
                  className="text-[10px] mt-1 font-medium"
                  style={{ color: s.color }}
                >
                  {s.delta}
                </div>
              </div>
            ))}
          </div>

          {/* Mini chart bars */}
          <div className="px-4 pb-3 pt-1">
            <div
              className="rounded-xl p-3"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="text-white/40 text-[10px] mb-2">
                Asset Activity — Last 7 Days
              </div>
              <div className="flex items-end gap-1.5 h-14">
                {[42, 68, 55, 80, 63, 91, 74].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm"
                    style={{
                      height: `${h}%`,
                      background:
                        i === 5
                          ? "linear-gradient(to top, #DC2626, #F87171)"
                          : "rgba(255,255,255,0.15)",
                      animation: `barGrow 0.8s ease-out ${i * 0.08}s both`,
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span
                    key={i}
                    className="flex-1 text-center text-white/30 text-[9px]"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Asset list rows */}
          <div className="px-4 pb-4 space-y-2">
            {[
              {
                name: "Server Rack A-01",
                loc: "Data Center 1",
                status: "Online",
              },
              {
                name: "HVAC Unit B-12",
                loc: "Building B",
                status: "Maintenance",
              },
              { name: "UPS Module C-03", loc: "Server Room", status: "Online" },
            ].map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  animation: `slideInRow 0.5s ease-out ${0.2 + i * 0.1}s both`,
                }}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold text-white"
                  style={{
                    background: "linear-gradient(135deg, #DC2626, #991B1B)",
                  }}
                >
                  {a.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white/80 text-[11px] font-medium truncate">
                    {a.name}
                  </div>
                  <div className="text-white/35 text-[10px] truncate">
                    {a.loc}
                  </div>
                </div>
                <span
                  className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background:
                      a.status === "Online"
                        ? "rgba(16,185,129,0.18)"
                        : "rgba(245,158,11,0.18)",
                    color: a.status === "Online" ? "#34D399" : "#FBBF24",
                  }}
                >
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating badge: Map pin */}
      <div
        className="absolute z-20 rounded-2xl px-3 py-2 flex items-center gap-2 shadow-lg"
        style={{
          top: "18%",
          right: "8%",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          backdropFilter: "blur(10px)",
          animation: "floatBadge1 4s ease-in-out infinite alternate",
        }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#DC2626,#991B1B)" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
          >
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        </div>
        <div>
          <div className="text-white text-[10px] font-semibold">
            Live Tracking
          </div>
          <div className="text-white/50 text-[9px]">248 assets online</div>
        </div>
      </div>

      {/* Floating badge: Alert */}
      <div
        className="absolute z-20 rounded-2xl px-3 py-2 flex items-center gap-2 shadow-lg"
        style={{
          bottom: "18%",
          left: "5%",
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.15)",
          backdropFilter: "blur(10px)",
          animation: "floatBadge2 5s ease-in-out infinite alternate",
        }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: "rgba(245,158,11,0.25)" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FBBF24"
            strokeWidth="2.5"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <div className="text-white text-[10px] font-semibold">New Alert</div>
          <div className="text-white/50 text-[9px]">HVAC maintenance due</div>
        </div>
      </div>

      {/* Floating badge: Check */}
      <div
        className="absolute z-20 rounded-2xl px-3 py-2 flex items-center gap-2 shadow-lg"
        style={{
          top: "62%",
          right: "5%",
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.15)",
          backdropFilter: "blur(10px)",
          animation: "floatBadge3 6s ease-in-out infinite alternate",
        }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: "rgba(16,185,129,0.2)" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#34D399"
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <div className="text-white text-[10px] font-semibold">
            Audit Complete
          </div>
          <div className="text-white/50 text-[9px]">Q2 report ready</div>
        </div>
      </div>
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  useEffect(() => {
    setMounted(true);

    const savedEmail = localStorage.getItem("remembered_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    try {
      const response = await api.post("/auth/login", {
        email,
        password,
      });

      const { access_token, user } = response.data;

      localStorage.setItem("access_token", access_token);

      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      }

      if (rememberMe) {
        localStorage.setItem("remembered_email", email);
      } else {
        localStorage.removeItem("remembered_email");
      }

      const payload = decodeToken(access_token);
      const role = payload?.role || user?.role || "USER";

      toast.success(`Welcome ${user?.name || role}!`);
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Login error:", error);

      if (error.response?.status === 401) {
        setError(true);
        toast.error("Invalid email or password");
        setTimeout(() => setError(false), 600);
      } else if (error.response?.status === 403) {
        const message = error.response?.data?.detail || "";
        if (
          message.toLowerCase().includes("subscription") ||
          message.toLowerCase().includes("expired") ||
          message.toLowerCase().includes("inactive")
        ) {
          toast.error("Subscription expired. Please contact support.");
          router.push("/subscription-expired");
        } else {
          toast.error(message || "Access forbidden");
        }
      } else if (error.response?.status === 422) {
        const detail = error.response?.data?.detail;
        if (Array.isArray(detail)) {
          const messages = detail.map((err: any) => err.msg).join(", ");
          toast.error(messages || "Validation error");
        } else {
          toast.error(detail || "Invalid input");
        }
      } else {
        toast.error(
          error.response?.data?.detail || "Login failed. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        body { font-family: 'Inter', sans-serif; }

        @keyframes floatDot {
          0%   { transform: translateY(0px) scale(1); opacity: 0.15; }
          100% { transform: translateY(-18px) scale(1.4); opacity: 0.35; }
        }
        @keyframes pulseBlob {
          0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.3; }
          100% { transform: translate(-50%,-50%) scale(1.15); opacity: 0.5; }
        }
        @keyframes floatCard {
          0%   { transform: translateY(0px) rotate(-0.5deg); }
          100% { transform: translateY(-14px) rotate(0.5deg); }
        }
        @keyframes floatBadge1 {
          0%   { transform: translateY(0px) translateX(0px); }
          100% { transform: translateY(-10px) translateX(4px); }
        }
        @keyframes floatBadge2 {
          0%   { transform: translateY(0px) translateX(0px); }
          100% { transform: translateY(-8px) translateX(-3px); }
        }
        @keyframes floatBadge3 {
          0%   { transform: translateY(0px); }
          100% { transform: translateY(-12px); }
        }
        @keyframes barGrow {
          from { transform: scaleY(0); transform-origin: bottom; }
          to   { transform: scaleY(1); transform-origin: bottom; }
        }
        @keyframes slideInRow {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(32px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-7px); }
          30%     { transform: translateX(7px); }
          45%     { transform: translateX(-5px); }
          60%     { transform: translateX(5px); }
          75%     { transform: translateX(-3px); }
          90%     { transform: translateX(3px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes gridPan {
          0%   { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
        @keyframes gradientShift {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes logoGlow {
          0%,100% { filter: drop-shadow(0 0 6px rgba(220,38,38,0.5)); }
          50%      { filter: drop-shadow(0 0 14px rgba(220,38,38,0.9)); }
        }

        .card-enter {
          animation: cardIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .shake {
          animation: shake 0.45s ease both;
        }
        .logo-glow {
          animation: logoGlow 2.5s ease-in-out infinite;
        }

        .input-wrapper:focus-within .input-icon {
          color: #DC2626;
          transition: color 0.2s;
        }
        .input-field {
          transition: box-shadow 0.25s, transform 0.2s, border-color 0.25s;
        }
        .input-field:focus {
          outline: none;
          transform: scale(1.015);
          box-shadow: 0 0 0 3px rgba(220,38,38,0.25), 0 1px 3px rgba(0,0,0,0.06);
          border-color: #DC2626 !important;
        }

        .btn-signin {
          transition: transform 0.18s, box-shadow 0.18s, filter 0.18s;
          background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%);
          background-size: 200% 200%;
          animation: gradientShift 4s ease infinite;
        }
        .btn-signin:hover:not(:disabled) {
          transform: scale(1.025);
          box-shadow: 0 8px 28px rgba(220,38,38,0.45);
          filter: brightness(1.08);
        }
        .btn-signin:active:not(:disabled) {
          transform: scale(0.975);
        }

        .social-btn {
          transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
        }
        .social-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 14px rgba(0,0,0,0.08);
          border-color: #DC2626 !important;
        }

        .checkbox-custom:checked {
          accent-color: #DC2626;
        }

        .stagger-1 { animation: fadeInUp 0.4s ease 0.15s both; }
        .stagger-2 { animation: fadeInUp 0.4s ease 0.22s both; }
        .stagger-3 { animation: fadeInUp 0.4s ease 0.29s both; }
        .stagger-4 { animation: fadeInUp 0.4s ease 0.36s both; }
        .stagger-5 { animation: fadeInUp 0.4s ease 0.43s both; }
        .stagger-6 { animation: fadeInUp 0.4s ease 0.50s both; }
        .stagger-7 { animation: fadeInUp 0.4s ease 0.57s both; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 767px) {
          .left-panel { display: none !important; }
          .right-panel { width: 100% !important; }
        }
      `}</style>
  
      {/* ── Root ── */}
      <div
        className="relative flex min-h-screen overflow-hidden"
        style={{ fontFamily: "'Inter', sans-serif", background: "#FFFFFF" }}
      >
        {/* ── Background: subtle grid ── */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(220,38,38,0.045) 1px, transparent 1px),
              linear-gradient(90deg, rgba(220,38,38,0.045) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
            animation: "gridPan 8s linear infinite",
          }}
        />

        {/* ── Background: red gradient blob ── */}
        <div
          className="absolute pointer-events-none z-0"
          style={{
            width: 700,
            height: 700,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(220,38,38,0.18) 0%, transparent 65%)",
            top: "-180px",
            left: "-180px",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute pointer-events-none z-0"
          style={{
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(153,27,27,0.13) 0%, transparent 65%)",
            bottom: "-120px",
            right: "-80px",
            filter: "blur(50px)",
          }}
        />

        {/* ── Animated background dots ── */}
        <AnimatedDots />

        {/* ════════════ LEFT PANEL ════════════ */}
        <div
          className="left-panel relative z-10 flex items-center justify-center"
          style={{
            width: "50%",
            background:
              "linear-gradient(135deg, #DC2626 0%, #7F1D1D 55%, #450A0A 100%)",
            overflow: "hidden",
          }}
        >
          {/* Inner grid on dark background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
              `,
              backgroundSize: "36px 36px",
            }}
          />

          {/* Brand watermark top-left */}
          <div className="absolute top-7 left-8 flex items-center gap-2.5 z-20">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center logo-glow"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.2"
              >
                <rect x="2" y="3" width="7" height="7" rx="1" />
                <rect x="15" y="3" width="7" height="7" rx="1" />
                <rect x="2" y="14" width="7" height="7" rx="1" />
                <rect x="15" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">
              AssetAi
            </span>
          </div>

          {/* Tagline bottom-left */}
          <div className="absolute bottom-8 left-8 right-8 z-20">
            <p className="text-white/40 text-xs leading-relaxed max-w-xs">
              Real-time asset intelligence for enterprise operations. Track,
              manage, and optimize - all in one place.
            </p>
          </div>

          <DashboardIllustration />
        </div>

        {/* ════════════ RIGHT PANEL ════════════ */}
        <div
          className="right-panel relative z-10 flex items-center justify-center px-8 py-10"
          style={{ width: "50%" }}
        >
          <div className={`w-full max-w-md card-enter ${error ? "shake" : ""}`}>
            {/* Gradient border wrapper */}
            <div
              className="rounded-3xl p-px"
              style={{
                background:
                  "linear-gradient(135deg, rgba(220,38,38,0.55) 0%, rgba(220,38,38,0.08) 50%, transparent 100%)",
                boxShadow:
                  "0 32px 80px rgba(220,38,38,0.12), 0 8px 32px rgba(0,0,0,0.06)",
              }}
            >
              <div className="rounded-3xl bg-white px-8 py-9 relative overflow-hidden">
                {/* Subtle inner glow */}
                <div
                  className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle at top right, rgba(254,226,226,0.5) 0%, transparent 65%)",
                  }}
                />

                {/* ─ Logo ─ */}
                <div className="stagger-1 flex items-center gap-3 mb-7">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center logo-glow flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #DC2626, #991B1B)",
                    }}
                  >
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.2"
                    >
                      <rect x="2" y="3" width="7" height="7" rx="1" />
                      <rect x="15" y="3" width="7" height="7" rx="1" />
                      <rect x="2" y="14" width="7" height="7" rx="1" />
                      <rect x="15" y="14" width="7" height="7" rx="1" />
                    </svg>
                  </div>
                  <span
                    className="text-2xl font-extrabold tracking-tight"
                    style={{
                      background:
                        "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    AssetAi
                  </span>
                </div>

                {/* ─ Heading ─ */}
                <div className="stagger-2 mb-6">
                  <h1 className="text-[28px] font-bold text-gray-900 leading-tight">
                    Welcome back
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Sign in to continue to your dashboard
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  {/* ─ Email ─ */}
                  <div className="stagger-3 input-wrapper">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide uppercase">
                      Email address
                    </label>
                    <div className="relative">
                      <span
                        className="input-icon absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200"
                        style={{ color: emailFocused ? "#DC2626" : "#9CA3AF" }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                        placeholder="admin@company.com"
                        className="input-field w-full pl-10 pr-4 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400"
                        style={{
                          border: "1.5px solid #E5E7EB",
                          background: emailFocused ? "#FFFBFB" : "#F9FAFB",
                        }}
                      />
                    </div>
                  </div>

                  {/* ─ Password ─ */}
                  <div className="stagger-4 input-wrapper">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide uppercase">
                      Password
                    </label>
                    <div className="relative">
                      <span
                        className="input-icon absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200"
                        style={{ color: passFocused ? "#DC2626" : "#9CA3AF" }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect
                            x="3"
                            y="11"
                            width="18"
                            height="11"
                            rx="2"
                            ry="2"
                          />
                          <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setPassFocused(true)}
                        onBlur={() => setPassFocused(false)}
                        placeholder="••••••••••••"
                        className="input-field w-full pl-10 pr-11 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400"
                        style={{
                          border: "1.5px solid #E5E7EB",
                          background: passFocused ? "#FFFBFB" : "#F9FAFB",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="cursor-pointer absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200"
                        style={{ color: "#9CA3AF" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#DC2626")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "#9CA3AF")
                        }
                      >
                        <EyeIcon open={showPassword} />
                      </button>
                    </div>
                  </div>

                  {/* ─ Remember me + Forgot ─ */}
                  <div className="stagger-5 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="sr-only"
                        />
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center transition-all duration-200"
                          style={{
                            background: rememberMe
                              ? "linear-gradient(135deg,#DC2626,#991B1B)"
                              : "white",
                            border: rememberMe ? "none" : "1.5px solid #D1D5DB",
                            boxShadow: rememberMe
                              ? "0 0 0 3px rgba(220,38,38,0.2)"
                              : "none",
                          }}
                          onClick={() => setRememberMe(!rememberMe)}
                        >
                          {rememberMe && (
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 12 12"
                              fill="none"
                              stroke="white"
                              strokeWidth="2.2"
                            >
                              <polyline points="2,6 5,9 10,3" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 font-medium">
                        Remember me
                      </span>
                    </label>
                    <button
                      type="button"
                      className="cursor-pointer text-xs font-semibold transition-colors duration-200"
                      style={{ color: "#9CA3AF" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "#DC2626")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "#9CA3AF")
                      }
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* ─ Sign In Button ─ */}
                  <div className="stagger-6 pt-1">
                    <button
                      type="submit"
                      disabled={loading}
                      className="cursor-pointer btn-signin w-full h-12 rounded-xl text-white font-semibold text-sm tracking-wide flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <span
                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                            style={{ animation: "spin 0.7s linear infinite" }}
                          />
                          Signing in…
                        </>
                      ) : (
                        <>
                          Sign In
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="2.2"
                          >
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12,5 19,12 12,19" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* ─ Footer ─ */}
                <div className="stagger-7 mt-6 text-center">
                  <p className="text-[11px] text-gray-400">
                    Secured with enterprise-grade encryption
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
