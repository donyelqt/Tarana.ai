"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { goodtaste, taranaai2 } from "../../public"

const HeroSection = ({ id }: { id?: string }) => {
    return (
        <section id={id} className="w-full bg-white relative overflow-hidden">
            {/* Flat 4-layer dot lines aligned with text */}
            {/* Above "Your 1 Day Itinerary" - outside mockup, aligned with right panel */}
            <div
                className="absolute pointer-events-none flex flex-col top-[360px] -right-[20px] md:top-[440px] md:right-[340px]"
            >
                <div className="relative w-[200px] h-[52px] md:w-[280px] md:h-[52px]" style={{ maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 70%)' }}>
                    {[0, 13, 26, 39].map((y, i) => (
                        <div key={i} className="absolute left-0 w-full" style={{
                            top: `${y}px`,
                            height: '13px',
                            backgroundImage: 'radial-gradient(circle, #0066FF 1.5px, transparent 1.5px)',
                            backgroundSize: '16px 13px',
                            opacity: 0.4
                        }} />
                    ))}
                </div>
            </div>

            {/* Above "Plan Your" - aligned with heading text */}
            <div
                className="absolute pointer-events-none flex flex-col top-[70px] -left-[50px] md:left-[320px] md:top-[100px]"
            >
                <div className="relative w-[200px] h-[52px] md:w-[280px] md:h-[52px]" style={{ maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 70%)' }}>
                    {[0, 13, 26, 39].map((y, i) => (
                        <div key={i} className="absolute left-0 w-full" style={{
                            top: `${y}px`,
                            height: '13px',
                            backgroundImage: 'radial-gradient(circle, #0066FF 1.5px, transparent 1.5px)',
                            backgroundSize: '16px 13px',
                            opacity: 0.4
                        }} />
                    ))}
                </div>
            </div>

            {/* Hero content */}
            <div className="max-w-7xl mx-auto px-4 pt-32 pb-12 md:pt-40 md:pb-16">
                <div className="flex flex-col items-center text-center">
                    {/* Heading */}
                    <h1 className="text-4xl md:text-6xl font-bold text-center mb-6 max-w-4xl">
                        Plan Your Perfect{" "}
                        <span className="bg-gradient-to-b from-blue-700 to-blue-500 bg-clip-text text-transparent">Baguio Trip</span>
                        <br />
                        in Seconds
                    </h1>

                    {/* Description */}
                    <p className="text-lg text-gray-700 text-center max-w-3xl mb-12">
                        We craft your perfect itinerary — personalized to your budget, interests, group size, and real-time
                        traffic conditions — so you can focus on the adventure, not the stress.
                    </p>

                    {/* CTA Button */}
                    <div className="group">
                        <Link
                            href="/auth/signup"
                            className="inline-flex items-center bg-gradient-to-b from-blue-700 to-blue-500 text-white px-8 py-3 rounded-2xl text-lg font-medium transition-colors group-hover:from-blue-800 group-hover:to-blue-600"
                        >
                            Plan My Baguio Trip
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* App Preview Mockup */}
            <div className="max-w-6xl mx-auto px-4 pb-0 md:pb-0">
                <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 overflow-hidden">
                    <div className="flex flex-col md:flex-row">
                        {/* Mobile horizontal nav / Desktop vertical sidebar */}
                        <div className="md:w-64 bg-gray-50">
                            {/* Mobile: horizontal scrollable nav */}
                            <div className="flex md:hidden items-center gap-2 p-3 border-b border-gray-100 overflow-x-auto">
                                <div className="flex items-center mr-2 flex-shrink-0">
                                    <Image src={taranaai2} alt="Tarana.ai" width={80} height={14} />
                                </div>
                                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 text-xs whitespace-nowrap flex-shrink-0">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                    Dashboard
                                </div>
                                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 font-medium text-xs whitespace-nowrap flex-shrink-0">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                    Itinerary Generator
                                </div>
                                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 text-xs whitespace-nowrap flex-shrink-0">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                                    Saved Trips
                                </div>
                                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 text-xs whitespace-nowrap flex-shrink-0">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l-.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                                    Settings
                                </div>
                            </div>
                            {/* Desktop: vertical sidebar */}
                            <div className="hidden md:block p-6">
                                <div className="flex items-center mb-8">
                                    <Image src={taranaai2} alt="Tarana.ai" width={120} height={20} />
                                </div>
                                <nav className="space-y-1">
                                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 text-sm whitespace-nowrap">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                        Dashboard
                                    </div>
                                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 font-medium text-sm whitespace-nowrap">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                        Itinerary Generator
                                    </div>
                                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 text-sm whitespace-nowrap">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                                        Saved Trips
                                    </div>
                                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 text-sm whitespace-nowrap">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l-.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                                        Settings
                                    </div>
                                </nav>
                            </div>
                        </div>

                        {/* Center Form */}
                        <div className="flex-1 p-6 md:p-8">
                            <h3 className="text-lg font-semibold text-gray-900 mb-6">Let&apos;s Plan Your Baguio Adventure</h3>
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Budget Range</label>
                                    <div className="relative">
                                        <select className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                            <option>less than ₱3,000/day</option>
                                            <option>₱3,000 - ₱5,000/day</option>
                                            <option>₱5,000 - ₱10,000/day</option>
                                            <option>₱10,000+/day</option>
                                        </select>
                                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Number of Pax.</label>
                                    <div className="flex gap-2">
                                        {["1", "2", "3-5", "6+"].map((n) => (
                                            <button
                                                key={n}
                                                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all active:scale-95 cursor-pointer ${
                                                    n === "2"
                                                        ? "bg-[#0066FF] text-white border-[#0066FF] shadow-sm shadow-blue-500/20"
                                                        : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-sm"
                                                }`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                                    <div className="flex gap-2">
                                        {["1 Day", "2 Days", "3 Days", "4-5 Days"].map((d) => (
                                            <button
                                                key={d}
                                                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all active:scale-95 cursor-pointer ${
                                                    d === "1 Day"
                                                        ? "bg-[#0066FF] text-white border-[#0066FF] shadow-sm shadow-blue-500/20"
                                                        : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-sm"
                                                }`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Travel Dates</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value="04/26/2025"
                                                readOnly
                                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none"
                                            />
                                            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                        </div>
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value="04/27/2025"
                                                readOnly
                                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none"
                                            />
                                            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Preview */}
                        <div className="w-full md:w-80 bg-gray-50 p-6 border-t md:border-t-0 md:border-l border-gray-100">
                            <div className="text-xs text-gray-500 mb-1">Your 1 Day Itinerary</div>
                            <div className="text-xs text-gray-400 mb-4">A preview of your Baguio Experience</div>
                            <div className="bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full inline-flex items-center mb-4">
                                <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><polyline points="12 2 12 6"/><polyline points="12 18 12 22"/><polyline points="4.93 4.93 7.76 7.76"/><polyline points="16.24 16.24 19.07 19.07"/></svg>
                                Morning (8AM-12NN)
                            </div>
                            <div className="bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-1.5 rounded-full inline-flex items-center mb-4">
                                <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                                Low Traffic
                            </div>
                            <div className="rounded-xl overflow-hidden mb-3">
                                <Image src={goodtaste} alt="Breakfast at Goodtaste" width={320} height={180} className="w-full h-40 object-cover" />
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-1">Breakfast at Goodtaste</h4>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                7:30AM-9:00AM
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">
                                Fuel up with a hearty Filipino-Chinese breakfast at Goodtaste, a Baguio favorite known for generous portions and fast service.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default HeroSection
