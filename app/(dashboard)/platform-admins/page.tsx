"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const PlatformAdminsContent = dynamic(
  () => import("./PlatformAdminsContent"),
  { ssr: false }
);

export default function PlatformAdminsPage() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return <PlatformAdminsContent />;
}