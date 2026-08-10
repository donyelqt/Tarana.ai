"use client"

import React, { Suspense } from "react"
import Sidebar from "@/components/Sidebar"
import ExploreMapView from "./components/ExploreMapView"

export default function TaranaExplorePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    }>
      <div className="h-screen w-screen overflow-hidden bg-[#f5f5f5] flex">
        <Sidebar />
        <div className="flex-1 md:ml-64 h-full relative">
          <ExploreMapView />
        </div>
      </div>
    </Suspense>
  )
}
