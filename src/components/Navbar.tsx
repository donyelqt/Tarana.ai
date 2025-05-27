"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    
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

    return (
        <nav className="flex items-center justify-between p-4 max-w-7xl mx-auto relative">
            <div className="flex items-center">
                <Link href="/" className="text-2xl font-bold">
                    Tarana.<span className="text-blue-500">ai</span>
                </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center justify-center space-x-10 ml-16">
                <Link href="#" className="text-gray-900 hover:text-blue-500">
                    Home
                </Link>
                <Link href="#" className="text-gray-900 hover:text-blue-500">
                    About
                </Link>
                <Link href="#" className="text-gray-900 hover:text-blue-500">
                    Contact
                </Link>
            </div>

            <div className="hidden md:flex items-center space-x-4">
                <Link href="/auth/signin" className="bg-gray-100 text-gray-900 px-4 py-2 rounded-xl hover:text-blue-500">
                    Sign In
                </Link>
                <Link href="/auth/signup" className="bg-gradient-to-b from-blue-700 to-blue-500 text-white px-4 py-2 rounded-xl hover:bg-blue-600 transition-colors">
                    Get Started
                </Link>
            </div>

            {/* Mobile menu button */}
            <button 
                className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-all duration-200 focus:outline-none" 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Toggle menu"
                aria-expanded={isMenuOpen}
            >
                <span className={`block w-5 h-0.5 bg-gray-900 transition-all duration-300 ease-in-out ${isMenuOpen ? 'transform rotate-45 translate-y-1' : 'mb-1'}`}></span>
                <span className={`block w-5 h-0.5 bg-gray-900 transition-all duration-300 ease-in-out ${isMenuOpen ? 'opacity-0' : 'mb-1'}`}></span>
                <span className={`block w-5 h-0.5 bg-gray-900 transition-all duration-300 ease-in-out ${isMenuOpen ? 'transform -rotate-45 -translate-y-1' : ''}`}></span>
            </button>

            {/* Mobile Navigation */}
            <div 
                className={`absolute top-16 left-0 right-0 bg-white shadow-md p-6 md:hidden z-50 transition-all duration-300 ease-in-out ${isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
            >
                <div className="flex flex-col space-y-5 max-w-7xl mx-auto">
                    <Link href="#" className="text-gray-900 hover:text-blue-500 font-medium py-2 border-b border-gray-100">
                        Home
                    </Link>
                    <Link href="#" className="text-gray-900 hover:text-blue-500 font-medium py-2 border-b border-gray-100">
                        About
                    </Link>
                    <Link href="#" className="text-gray-900 hover:text-blue-500 font-medium py-2 border-b border-gray-100">
                        Contact
                    </Link>
                    <div className="flex flex-col space-y-3 pt-2">
                        <Link href="/auth/signin" className="text-gray-900 hover:text-blue-500 font-medium py-2">
                            Sign In
                        </Link>
                        <Link
                            href="/auth/signup"
                            className="bg-blue-500 text-white px-4 py-3 rounded-xl hover:bg-blue-600 transition-colors text-center font-medium"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    )
}

export default Navbar
