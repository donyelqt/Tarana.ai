"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { signOut } from "next-auth/react"
import { Bookmark, Settings, Settings2, Coffee, Donut } from 'lucide-react'
import Image from "next/image"
import taranaai2 from "../../public/images/taranaai2.png"

const Sidebar = () => {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Close menu when resizing to desktop view
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false)
      }
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMobileMenuOpen])

  return (
    <>
      {/* Mobile hamburger button */}
      <button 
        className="md:hidden fixed top-4 left-4 z-50 flex flex-col justify-center items-center w-10 h-10 rounded-lg bg-white shadow-md transition-all duration-200 focus:outline-none" 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle sidebar"
        aria-expanded={isMobileMenuOpen}
      >
        <span className={`block w-5 h-0.5 bg-gray-900 transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'transform rotate-45 translate-y-1' : 'mb-1'}`}></span>
        <span className={`block w-5 h-0.5 bg-gray-900 transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'opacity-0' : 'mb-1'}`}></span>
        <span className={`block w-5 h-0.5 bg-gray-900 transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'transform -rotate-45 -translate-y-1' : ''}`}></span>
      </button>

      {/* Sidebar - hidden on mobile unless toggled */}
      <aside className={`w-64 ${pathname === "/itinerary-generator" ? "bg-[#f7f9fb]" : "bg-white"} border-r border-gray-200 flex flex-col justify-between py-8 px-6 fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out z-40`}>
        <div>
          <div className="text-2xl font-bold mb-12">
            <Image src={taranaai2} alt="Logo" width={120} height={120} />
          </div>
          <nav className="space-y-2">
            <Link href="/dashboard" className={`flex items-center px-4 py-3 rounded-lg font-medium transition ${pathname === "/dashboard" ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-blue-50"}`}>
              <span className="mr-3">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7m-9 2v8m4-8v8m5 0a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2h14z" /></svg>
              </span>
              Dashboard
            </Link>
            <Link href="/itinerary-generator" className={`flex items-center px-4 py-3 rounded-lg font-medium transition ${pathname === "/itinerary-generator" ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-blue-50"}`}>
              <span className="mr-3">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h4m0 0V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h5" /></svg>
              </span>
              Itinerary Generator
            </Link>
            <Link href="/tarana-eats" className={`flex items-center px-4 py-3 rounded-lg font-medium transition ${pathname === "/tarana-eats" ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-blue-50"}`}>
              <span className="mr-3">
                <Donut size={20} />
              </span>
              Tarana Eats
            </Link>
            <Link href="/saved-trips" className={`flex items-center px-4 py-3 rounded-lg font-medium transition ${pathname === "/saved-trips" ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-blue-50"}`}>
              <span className="mr-3">
                <Bookmark size={20} />
              </span>
              Saved Trips
            </Link>
            <Link href="#" className="flex items-center px-4 py-3 rounded-lg font-medium text-gray-700 hover:bg-blue-50 transition">
              <span className="mr-3">
                <Settings size={20} />
              </span>
              Settings
            </Link>
          </nav>
        </div>
        <button 
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="flex items-center text-gray-400 hover:text-blue-500 transition"
        >
          <span className="mr-2">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>
          </span>
          Log out
        </button>
      </aside>

      {/* Overlay for mobile when sidebar is open */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`}
        onClick={() => setIsMobileMenuOpen(false)}
      ></div>
    </>
  )
}

export default Sidebar