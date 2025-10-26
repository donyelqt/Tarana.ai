"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { signOut } from "next-auth/react"
import { motion, Variants } from "framer-motion"
import { Settings, Donut, Utensils, MapPinCheck } from 'lucide-react'

import Image from "next/image"
import taranaai2 from "../../public/images/taranaai2.png"

const Sidebar = () => {

  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const [activeTop, setActiveTop] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const prevActiveTopRef = useRef(0)
  const [isMovingUp, setIsMovingUp] = useState(false)
  const [isFloating, setIsFloating] = useState(false)

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

  useEffect(() => {
    if (navRef.current) {
      const activeLink = navRef.current.querySelector<HTMLElement>('.bg-blue-50')
      if (activeLink) {
        setIsFloating(false); // Stop floating on navigation
        const newActiveTop = activeLink.offsetTop + activeLink.offsetHeight / 2
        
        setIsMovingUp(newActiveTop < prevActiveTopRef.current)
        
        setActiveTop(newActiveTop)
        setIsActive(true)

        prevActiveTopRef.current = newActiveTop
      } else {
        setIsActive(false)
      }
    }
  }, [pathname])

  const variants: Variants = {
    up: (y: number) => ({
      y,
      opacity: 0.75,
      transition: {
        y: { type: 'spring', stiffness: 100, damping: 20, mass: 0.5 },
        opacity: { duration: 0.2 },
      },
    }),
    floating: (y: number) => ({
      y: [y, y - 10, y],
      opacity: 0.75,
      transition: {
        y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
      },
    }),
    down: (y: number) => ({
      y,
      opacity: 0.75,
      transition: {
        y: { type: 'spring', stiffness: 200, damping: 30, mass: 0.8 },
        opacity: { duration: 0.2 },
      },
    }),
    hidden: {
      opacity: 0,
      transition: { opacity: { duration: 0.2 } },
    },
  }

  const getAnimationState = () => {
    if (!isActive) return 'hidden';
    if (isFloating) return 'floating';
    return isMovingUp ? 'up' : 'down';
  }

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

      {/* Sidebar - hidden on mobile unless toggled */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col justify-between p-6`}>
        <div>
          <div className="text-2xl font-bold mb-12">
            <Image src={taranaai2} alt="Logo" width={120} height={120} />
          </div>
          <nav ref={navRef} className="space-y-2 relative">
            <motion.div
              className="absolute left-0 w-full h-40 animate-blob rounded-full bg-gradient-to-br from-sky-200 to-blue-300 opacity-65 blur-2xl pointer-events-none"
              variants={variants}
              custom={activeTop}
              animate={getAnimationState()}
              onAnimationComplete={(definition) => {
                if (definition === 'up') {
                  setIsFloating(true)
                }
              }}
              style={{ transform: 'translateY(-50%)' }}
            />
            <Link href="/dashboard" className={`flex items-center px-4 py-3 rounded-lg font-medium transition ${pathname === "/dashboard" ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-blue-50"}`}>
              <span className="mr-3 animate-icon-interactive">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7m-9 2v8m4-8v8m5 0a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2h14z" /></svg>
              </span>
              Dashboard
            </Link>
            <Link href="/itinerary-generator" className={`flex items-center px-4 py-3 rounded-lg font-medium transition ${pathname === "/itinerary-generator" ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-blue-50"}`}>
              <span className="mr-3 animate-icon-interactive">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h4m0 0V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h5" /></svg>
              </span>
              Tarana Gala
            </Link>
            <Link href="/tarana-eats" className={`flex items-center px-4 py-3 rounded-lg font-medium transition ${pathname === "/tarana-eats" ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-blue-50"}`}>
              <span className="mr-3 animate-icon-interactive">
                <Donut size={20} />
              </span>
              Tarana Eats
            </Link>
            {/* SAVED PLANS section */}
            <div className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Saved Plans</div>
            <Link href="/saved-trips" className={`flex items-center px-4 py-3 rounded-lg font-medium transition ${pathname === "/saved-trips" ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-blue-50"}`}>
              <span className="mr-3 animate-icon-interactive">
                <MapPinCheck size={20} />
              </span>
              Itineraries
            </Link>
            <Link href="/saved-meals" className={`flex items-center px-4 py-3 rounded-lg font-medium transition ${pathname === "/saved-meals" ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-blue-50"}`}>
              <span className="mr-3 animate-icon-interactive">
                <Utensils size={20} />
              </span>
              Meals
            </Link>
            <div className="pt-4">
              <Link href="#" className="flex items-center px-4 py-3 rounded-lg font-medium text-gray-700 hover:bg-blue-50 transition">
                <span className="mr-3 animate-icon-interactive">
                  <Settings size={20} />
                </span>
                Settings
              </Link>
            </div>
          </nav>
        </div>
        <div className="relative">
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="flex items-center text-gray-400 hover:text-blue-500 transition"
          >
            <span className="mr-2">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>
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