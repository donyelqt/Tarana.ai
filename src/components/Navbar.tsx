"use client"

import { useState } from "react"
import Link from "next/link"

const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    return (
        <nav className="flex items-center justify-between p-4 max-w-7xl mx-auto">
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
                <Link href="/auth/signin" className="bg-gray-100 text-gray-900 px-3 py-2 rounded-2xl hover:text-blue-500">
                    Sign In
                </Link>
                <Link href="/auth/signup" className="bg-blue-500 text-white px-4 py-2 rounded-2xl hover:bg-blue-600 transition-colors">
                    Get Started
                </Link>
            </div>

            {/* Mobile menu button */}
            <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>

            {/* Mobile Navigation */}
            {isMenuOpen && (
                <div className="absolute top-16 left-0 right-0 bg-white shadow-md p-4 md:hidden z-50">
                    <div className="flex flex-col space-y-4">
                        <Link href="#" className="text-gray-900 hover:text-blue-500">
                            Home
                        </Link>
                        <Link href="#" className="text-gray-900 hover:text-blue-500">
                            About
                        </Link>
                        <Link href="#" className="text-gray-900 hover:text-blue-500">
                            Contact
                        </Link>
                        <Link href="/auth/signin" className="text-gray-900 hover:text-blue-500">
                            Sign In
                        </Link>
                        <Link
                            href="/auth/signup"
                            className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition-colors text-center"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            )}
        </nav>
    )
}

export default Navbar
