"use client"

import Link from "next/link"

const Sidebar = () => {
  return (
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
  )
}

export default Sidebar