"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import taranaai2 from "../../public/images/taranaai2.png"

type SectionBackground = "white" | "blue"

const NAVBAR_HEIGHT = 64

const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [bg, setBg] = useState<SectionBackground>("white")
    const pathname = usePathname();

    // Close menu when resizing to desktop view
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768 && isMenuOpen) {
                setIsMenuOpen(false)
            }
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [isMenuOpen])

    // Navbar changes color based on section behind it, not scroll position
    useEffect(() => {
        const sectionIds = [
            "hero",
            "how-it-works",
            "why-use",
            "travelers",
        ]

        const sectionBgs: Record<string, SectionBackground> = {
            "hero": "white",
            "how-it-works": "blue",
            "why-use": "white",
            "travelers": "white",
        }

        const getSectionAtNavbar = (): SectionBackground => {
            // Check the top of the viewport (where navbar sits)
            const y = NAVBAR_HEIGHT / 2
            for (const id of sectionIds) {
                const el = document.getElementById(id)
                if (!el) continue
                const rect = el.getBoundingClientRect()
                if (y >= rect.top && y <= rect.bottom) {
                    return sectionBgs[id]
                }
            }
            return "white"
        }

        const handleScroll = () => {
            const newBg = getSectionAtNavbar()
            setBg((prev) => prev === newBg ? prev : newBg)
        }

        handleScroll()
        window.addEventListener("scroll", handleScroll, { passive: true })
        window.addEventListener("resize", handleScroll)

        return () => {
            window.removeEventListener("scroll", handleScroll)
            window.removeEventListener("resize", handleScroll)
        }
    }, [])

    const isBlue = bg === "blue"

    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isBlue ? 'bg-blue-600/80 backdrop-blur-md shadow-lg' : 'bg-white/80 backdrop-blur-md shadow-sm'}`}>
            <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
                <div className="flex items-center">
                    <Link href="/" className="flex items-center">
                        <Image 
                            src={taranaai2} 
                            alt="Tarana.ai" 
                            width={120} 
                            height={20} 
                            className={`transition-all duration-300 ${isBlue ? 'brightness-0 invert' : ''}`}
                        />
                    </Link>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center justify-center space-x-10 ml-16">
                    <Link href="/" className={`${isBlue ? "text-white hover:text-blue-200" : "text-gray-900 hover:text-blue-500"} ${pathname === "/" && !isBlue ? "font-bold !text-blue-600" : pathname === "/" ? "font-bold" : ""}`}>Home</Link>
                    <Link href="/about" className={`${isBlue ? "text-white hover:text-blue-200" : "text-gray-900 hover:text-blue-500"} ${pathname === "/about" && !isBlue ? "font-bold !text-blue-600" : pathname === "/about" ? "font-bold" : ""}`}>About</Link>
                    <Link href="/contact" className={`${isBlue ? "text-white hover:text-blue-200" : "text-gray-900 hover:text-blue-500"} ${pathname === "/contact" && !isBlue ? "font-bold !text-blue-600" : pathname === "/contact" ? "font-bold" : ""}`}>Contact</Link>
                </div>

                <div className="hidden md:flex items-center space-x-4">
                    <Link href="/auth/signin" className={`px-4 py-2 rounded-xl transition-colors ${isBlue ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-100 text-gray-900 hover:text-blue-500'}`}>
                        Sign In
                    </Link>
                    <div className="group">
                      <Link href="/auth/signup" className={`px-4 py-2 rounded-xl transition-colors duration-200 ${isBlue ? 'bg-gradient-to-b from-gray-800 to-gray-600 text-white hover:from-gray-900 hover:to-gray-700' : 'bg-gradient-to-b from-blue-700 to-blue-500 text-white group-hover:from-blue-800 group-hover:to-blue-600'}`}>
                          Get Started
                      </Link>
                    </div>
                </div>

                {/* Mobile menu button */}
                <button
                    className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-lg transition-all duration-200 focus:outline-none"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="Toggle menu"
                    aria-expanded={isMenuOpen}
                >
                    <span className={`block w-5 h-0.5 transition-all duration-300 ease-in-out ${isMenuOpen ? 'transform rotate-45 translate-y-1' : 'mb-1'} ${isBlue ? 'bg-white' : 'bg-gray-900'}`}></span>
                    <span className={`block w-5 h-0.5 transition-all duration-300 ease-in-out ${isMenuOpen ? 'opacity-0' : 'mb-1'} ${isBlue ? 'bg-white' : 'bg-gray-900'}`}></span>
                    <span className={`block w-5 h-0.5 transition-all duration-300 ease-in-out ${isMenuOpen ? 'transform -rotate-45 -translate-y-1' : ''} ${isBlue ? 'bg-white' : 'bg-gray-900'}`}></span>
                </button>

                {/* Mobile Navigation */}
                <div
                    className={`absolute top-16 left-0 right-0 bg-white shadow-md p-6 md:hidden z-50 transition-all duration-300 ease-in-out ${isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
                >
                    <div className="flex flex-col space-y-5 max-w-7xl mx-auto">
                        <Link href="/" className={`font-medium py-2 border-b border-gray-100 ${pathname === "/" ? "text-blue-500 font-bold" : "text-gray-900 hover:text-blue-500"}`}>Home</Link>
                        <Link href="/about" className={`font-medium py-2 border-b border-gray-100 ${pathname === "/about" ? "text-blue-500 font-bold" : "text-gray-900 hover:text-blue-500"}`}>About</Link>
                        <Link href="/contact" className={`font-medium py-2 border-b border-gray-100 ${pathname === "/contact" ? "text-blue-500 font-bold" : "text-gray-900 hover:text-blue-500"}`}>Contact</Link>
                        <div className="flex flex-col space-y-3 pt-2">
                            <Link href="/auth/signin" className="text-gray-900 hover:text-blue-500 font-medium py-2">
                                Sign In
                            </Link>
                            <Link
                                href="/auth/signup"
                                className="bg-gradient-to-b from-blue-700 to-blue-500 text-white px-4 py-3 rounded-xl hover:bg-blue-600 transition-colors text-center font-medium"
                            >
                                Get Started
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    )
}

export default Navbar
