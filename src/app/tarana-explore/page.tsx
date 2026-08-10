"use client"

import React, { Suspense } from "react"
import Sidebar from "@/components/Sidebar"
import RouteOptimizationWidget from "./components/RouteOptimizationWidget"
import { Route } from "lucide-react"

const ExploreContent = () => {
  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <main className="md:pl-64 flex-1 flex flex-col">
        <div className="flex-1 p-6 md:p-12 pt-16 md:pt-12 max-w-7xl mx-auto w-full">
          <div className="flex items-center space-x-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 bg-[#0066FF] rounded-xl shadow-md">
              <Route className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-2xl text-gray-900 tracking-tight">Tarana Explore</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Smart traffic-aware navigation for Baguio City
              </p>
            </div>
          </div>

          <div className="mt-8">
            <RouteOptimizationWidget />
          </div>
        </div>
      </main>
    </div>
  )
}

export default function TaranaExplorePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#0066FF] border-t-transparent"></div>
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <ExploreContent />
    </Suspense>
  )
}