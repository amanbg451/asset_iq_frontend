"use client";

import dynamic from 'next/dynamic';

// Dynamically import the main client component with SSR disabled
const RolesPageClient = dynamic(
  () => import('./RolesPageClient'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    )
  }
);

export default function RolesPageWrapper() {
  return <RolesPageClient />;
}