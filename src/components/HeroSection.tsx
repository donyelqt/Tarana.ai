"use client"

import Image from "next/image"
import Link from "next/link"
import { baguio_panorama } from "../../public"
import { ArrowRight } from "lucide-react"

const HeroSection = () => {
    return (
        <section className="w-full px-4 py-8">
            <div className="max-w-7xl mx-auto">
                <div className="bg-gray-50 rounded-[2rem] overflow-hidden shadow-sm relative">
                    {/* Hero content container */}
                    <div className="relative z-10 px-8 pt-16 pb-20 md:px-16 md:pt-16 md:pb-24 flex flex-col items-center">
                        {/* Heading */}
                        <h1 className="text-4xl md:text-6xl font-medium text-center mb-6 max-w-4xl">
                            Plan Your Perfect <span className="bg-gradient-to-b from-blue-700 to-blue-500 bg-clip-text text-transparent font-bold">Baguio Trip</span>
                            <br />
                            in Seconds
                        </h1>

                        {/* Description */}
                        <p className="text-lg text-gray-700 text-center max-w-3xl mb-12">
                            We craft your perfect itinerary — personalized to your budget, interests, group size, and real-time
                            traffic conditions — so you can focus on the adventure, not the stress.
                        </p>

                        {/* CTA Button */}
                        <div className="absolute bottom-0">
                            <Link
                                href="/auth/signup"
                                className="bg-gradient-to-b from-blue-700 to-blue-500 text-white px-8 py-3 rounded-2xl text-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
                            >
                                Plan My Baguio Trip
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                        </div>
                    </div>

                    {/* Background Image */}
                    <div className="rounded-xl overflow-hidden shadow-2xl h-[130px]">
                        <div className="absolute inset-0 w-full h-full">
                            <Image
                                src={baguio_panorama}
                                alt="Baguio City Panorama"
                                fill
                                className="object-cover"
                                priority
                            />
                            {/* Semi-transparent overlay for better text readability */}
                            <div className="absolute inset-0"></div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default HeroSection

