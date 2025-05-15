"use client"

import Image from "next/image"
import { sampleprofile } from "../../../public"
import Sidebar from "../../components/Sidebar"

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-[#f7f9fb] flex">
      {/* Sidebar */}
      <Sidebar />
      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row">
        {/* Center Content */}
        <div className="flex-1 p-8 md:p-12">
          <div className="bg-blue-50 rounded-2xl p-6 flex items-center mb-8">
            <Image src={sampleprofile} alt="Profile" width={48} height={48} className="rounded-full mr-4" />
            <div>
              <div className="text-xl font-bold text-gray-900">Welcome Back, Carl!<span className="ml-1">👋</span></div>
              <div className="text-gray-500 text-sm">Ready to plan your next adventure?</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transition">
              <div className="text-3xl mb-2">+</div>
              <div className="font-semibold text-lg">Create New Itinerary</div>
              <div className="text-gray-500 text-sm mt-1">Create a personalized travel plan</div>
            </div>
            <div className="bg-white rounded-2xl shadow p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transition">
              <div className="mb-2">
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
              </div>
              <div className="font-semibold text-lg">View Saved Trips</div>
              <div className="text-gray-500 text-sm mt-1">Access your planned Itineraries</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 mb-8">
            <div className="font-semibold text-lg mb-4">Current Itinerary</div>
            <div className="bg-blue-50 rounded-xl p-4 flex items-center">
              <span className="mr-3">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 12.414a4 4 0 10-1.414 1.414l4.243 4.243a1 1 0 001.414-1.414z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </span>
              <div>
                <div className="font-medium text-gray-900">1 Day Itinerary <span className="text-xs text-gray-400 ml-2">#BC402</span></div>
                <div className="text-xs text-gray-500">April 26 - 27, 2025 | 7:30AM - 8:00PM</div>
              </div>
            </div>
          </div>
        </div>
        {/* Right Sidebar */}
        <div className="w-full md:w-80 bg-white rounded-2xl p-6 mt-8 md:mt-12 mr-0 md:mr-8 flex-shrink-0 h-full">
          <div className="mb-6">
            <div className="font-semibold text-lg mb-2">Baguio Weather</div>
            <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl font-bold mr-2">18° C</span>
                <span className="text-gray-500">Sunny</span>
              </div>
              <span>
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="5" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95 7.07l-1.41-1.41M6.34 6.34L4.93 4.93m12.02 0l-1.41 1.41M6.34 17.66l-1.41 1.41" /></svg>
              </span>
            </div>
          </div>
          <div className="mb-6">
            <div className="font-semibold text-lg mb-2">Recommended For You</div>
            <div className="space-y-4">
              <div className="bg-gray-200 rounded-xl h-20 flex items-center justify-center text-gray-500">Ad Space</div>
              <div className="bg-gray-200 rounded-xl h-20 flex items-center justify-center text-gray-500">Ad Space</div>
            </div>
          </div>
          <div>
            <div className="font-semibold text-lg mb-2">Upcoming Events</div>
            <div className="bg-gray-200 rounded-xl h-20 flex items-center justify-center text-gray-500">Coming Soon</div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard