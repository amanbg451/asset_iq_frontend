"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SubscriptionExpiredPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/login");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-red-50/15 to-white">
      <div className="text-center p-8 max-w-md">
        {/* Animated icon */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-75"></div>
          <div className="relative w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <svg
              width="48"
              height="48"
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
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-3">Subscription Expired</h1>
        
        <p className="text-gray-500 mb-2">
          Your client subscription has expired or is no longer active.
        </p>
        
        <p className="text-gray-400 text-sm mb-6">
          Please contact your administrator to renew the subscription.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => router.push("/login")}
            className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-800 transition-all shadow-md"
          >
            Go to Login
          </button>
          
          <p className="text-xs text-gray-400">
            Redirecting in {countdown} seconds...
          </p>
        </div>
      </div>
    </div>
  );
}