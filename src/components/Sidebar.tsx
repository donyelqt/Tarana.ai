"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { signOut } from "next-auth/react"
import { useInterfaceSound } from '@/lib/sound/SoundProvider'
import { motion, useReducedMotion } from "framer-motion"
import { Settings, Donut, Utensils, MapPinCheck, Route, LogOut, LayoutDashboard, Sparkles, Volume2, VolumeX } from 'lucide-react'

import Image from "next/image"
import taranaai2 from "../../public/images/taranaai2.png"

const Sidebar = () => {

  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { enabled: soundOn, setEnabled: setSoundOn } = useInterfaceSound()

  // Shared-layout indicator: framer-motion measures + springs the pill between
  // links automatically (layoutId). Direction-aware by geometry; bounce = overshoot.
  const reduceMotion = useReducedMotion()
  const pillTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, bounce: 0.18, duration: 0.55 }
  const ActivePill = () => (
    <motion.span
      layoutId="sidebar-active-pill"
      aria-hidden="true"
      className="absolute inset-0 -z-10 rounded-lg bg-blue-50 pointer-events-none"
      transition={pillTransition}
    />
  )

  // Close the mobile drawer when resizing up to desktop
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
        className="md:hidden fixed top-4 right-4 z-50 flex flex-col justify-center items-center w-10 h-10 rounded-lg bg-white shadow-md transition-all duration-200 focus:outline-none"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle sidebar"
        aria-expanded={isMobileMenuOpen}
      >
        <span className={`block w-5 h-0.5 bg-gray-900 transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'transform rotate-45 translate-y-1' : 'mb-1'}`}></span>
        <span className={`block w-5 h-0.5 bg-gray-900 transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'opacity-0' : 'mb-1'}`}></span>
        <span className={`block w-5 h-0.5 bg-gray-900 transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'transform -rotate-45 -translate-y-1' : ''}`}></span>
      </button>
      {/* Mobile hamburger button */}

      {/* Sidebar - hidden on mobile unless toggled */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col justify-between p-6`}>
        <div>
          <div className="text-2xl font-bold mb-12">
            <Image src={taranaai2} alt="Logo" width={120} height={120} />
          </div>
          <nav className="space-y-2 relative">
            <Link href="/dashboard" className={`relative isolate group flex items-center px-4 py-3 rounded-lg font-medium text-sm tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${pathname === "/dashboard" ? "text-blue-600 nav-item-active" : "text-gray-700 hover:bg-gray-100"}`}>
              {pathname === "/dashboard" && <ActivePill />}
              <span className="mr-3 transition-transform duration-200 ease-out group-hover:scale-110 group-hover:translate-x-0.5 motion-reduce:transform-none"><LayoutDashboard size={20} strokeWidth={2} /></span>
              Dashboard
            </Link>
            <Link href="/itinerary-generator" className={`relative isolate group flex items-center px-4 py-3 rounded-lg font-medium text-sm tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${pathname === "/itinerary-generator" ? "text-blue-600 nav-item-active" : "text-gray-700 hover:bg-gray-100"}`}>
              {pathname === "/itinerary-generator" && <ActivePill />}
              <span className="mr-3 transition-transform duration-200 ease-out group-hover:scale-110 group-hover:translate-x-0.5 motion-reduce:transform-none"><Sparkles size={20} strokeWidth={2} /></span>
              Tarana Gala
            </Link>
            <Link href="/tarana-eats" className={`relative isolate group flex items-center px-4 py-3 rounded-lg font-medium text-sm tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${pathname === "/tarana-eats" ? "text-blue-600 nav-item-active" : "text-gray-700 hover:bg-gray-100"}`}>
              {pathname === "/tarana-eats" && <ActivePill />}
              <span className="mr-3 transition-transform duration-200 ease-out group-hover:scale-110 group-hover:translate-x-0.5 motion-reduce:transform-none">
                <Donut size={20} />
              </span>
              Tarana Eats
            </Link>
            <Link href="/tarana-explore" className={`relative isolate group flex items-center px-4 py-3 rounded-lg font-medium text-sm tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${pathname === "/tarana-explore" ? "text-blue-600 nav-item-active" : "text-gray-700 hover:bg-gray-100"}`}>
              {pathname === "/tarana-explore" && <ActivePill />}
              <span className="mr-3 transition-transform duration-200 ease-out group-hover:scale-110 group-hover:translate-x-0.5 motion-reduce:transform-none">
                <Route size={20} />
              </span>
              Tarana Explore
            </Link>
            {/* SAVED PLANS section */}
            <div className="px-4 pt-4 pb-2 text-[11px] font-medium text-gray-400 tracking-wide">Saved Plans</div>
            <Link href="/saved-trips" className={`relative isolate group flex items-center px-4 py-3 rounded-lg font-medium text-sm tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${pathname === "/saved-trips" ? "text-blue-600 nav-item-active" : "text-gray-700 hover:bg-gray-100"}`}>
              {pathname === "/saved-trips" && <ActivePill />}
              <span className="mr-3 transition-transform duration-200 ease-out group-hover:scale-110 group-hover:translate-x-0.5 motion-reduce:transform-none">
                <MapPinCheck size={20} />
              </span>
              Itineraries
            </Link>
            <Link href="/saved-meals" className={`relative isolate group flex items-center px-4 py-3 rounded-lg font-medium text-sm tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${pathname === "/saved-meals" ? "text-blue-600 nav-item-active" : "text-gray-700 hover:bg-gray-100"}`}>
              {pathname === "/saved-meals" && <ActivePill />}
              <span className="mr-3 transition-transform duration-200 ease-out group-hover:scale-110 group-hover:translate-x-0.5 motion-reduce:transform-none">
                <Utensils size={20} />
              </span>
              Meals
            </Link>
            <div className="pt-4">
              <Link href="/settings" className={`relative isolate group flex items-center px-4 py-3 rounded-lg font-medium text-sm tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${pathname === "/settings" ? "text-blue-600 nav-item-active" : "text-gray-700 hover:bg-gray-100"}`}>
                {pathname === "/settings" && <ActivePill />}
                <span className="mr-3 transition-transform duration-200 ease-out group-hover:scale-110 group-hover:translate-x-0.5 motion-reduce:transform-none">
                  <Settings size={20} />
                </span>
                Settings
              </Link>
            </div>
          </nav>
        </div>
        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => setSoundOn(!soundOn)}
            role="switch"
            aria-checked={soundOn}
            aria-label="Interface sounds"
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium tracking-tight text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            <span className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${soundOn ? 'bg-blue-100 text-blue-600 group-hover:bg-blue-200' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-900'}`}>
              {soundOn ? <Volume2 size={14} strokeWidth={2} /> : <VolumeX size={14} strokeWidth={2} />}
            </span>
            Sounds
            <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider ${soundOn ? 'text-blue-600' : 'text-gray-400'}`}>
              {soundOn ? 'On' : 'Off'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium tracking-tight text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-500 transition-colors group-hover:bg-gray-200 group-hover:text-gray-900">
              <LogOut size={14} strokeWidth={2} />
            </span>
            Log out
          </button>
        </div>
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