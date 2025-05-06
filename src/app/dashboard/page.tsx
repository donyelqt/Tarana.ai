"use client"

import Image from "next/image"
import Link from "next/link"
import { sampleprofile } from "../../../public"

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-[#f7f9fb] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between py-8 px-6 hidden md:flex">
        <div>
          <div className="text-2xl font-bold mb-12">
            Tarana.<span className="text-blue-500">ai</span>
          </div>
          <nav className="space-y-2">
            <Link href="/dashboard" className="flex items-center px-4 py-3 rounded-lg text-blue-600 bg-blue-50 font-medium">
              <span className="mr-3">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7m-9 2v8m4-8v8m5 0a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2h14z" /></svg>
              </span>
              Dashboard
            </Link>
            <Link href="#" className="flex items-center px-4 py-3 rounded-lg text-gray-700 hover:bg-blue-50 transition">
              <span className="mr-3">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h4m0 0V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h5" /></svg>
              </span>
              Itinerary Generator
            </Link>
            <Link href="#" className="flex items-center px-4 py-3 rounded-lg text-gray-700 hover:bg-blue-50 transition">
              <span className="mr-3">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </span>
              Saved Trips
            </Link>
            <Link href="#" className="flex items-center px-4 py-3 rounded-lg text-gray-700 hover:bg-blue-50 transition">
              <span className="mr-3">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </span>
              Settings
            </Link>
          </nav>
        </div>
        <button className="flex items-center text-gray-400 hover:text-blue-500 transition">
          <span className="mr-2">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>
          </span>
          Log out
        </button>
      </aside>

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
        <div className="w-full md:w-80 bg-white rounded-2xl p-6 mt-8 md:mt-12 mr-0 md:mr-8 flex-shrink-0 h-fit">
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