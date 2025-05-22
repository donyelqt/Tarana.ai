"use client"

import Image from "next/image"
import { sampleprofile } from "../../../public"
import Sidebar from "../../components/Sidebar"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { BAGUIO_COORDINATES, WeatherData, fetchWeatherData, getWeatherIconUrl } from "@/lib/utils"

const Dashboard = () => {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Redirect to login if not authenticated
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    
    const getWeather = async () => {
      try {
        setLoading(true)
        const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY
        
        if (!apiKey) {
          throw new Error("API key not found")
        }
        
        const data = await fetchWeatherData(
          BAGUIO_COORDINATES.lat,
          BAGUIO_COORDINATES.lon,
          apiKey
        )
        
        setWeatherData(data)
      } catch (err) {
        console.error("Failed to fetch weather:", err)
        setError("Could not load weather data")
      } finally {
        setLoading(false)
      }
    }
    
    getWeather()
  }, [status, router])

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f9fb]">
        <div className="text-center">
          <div className="text-2xl font-semibold mb-2">Loading...</div>
          <p className="text-gray-500">Please wait while we load your dashboard</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* Sidebar */}
      <Sidebar />
      {/* Main Content - add left padding on desktop to accommodate fixed sidebar */}
      <main className="md:pl-64 flex-1 flex flex-col md:flex-row">
        {/* Center Content */}
        <div className="flex-1 p-8 md:p-12 pt-16 md:pt-12">
          <div className="bg-blue-50 rounded-2xl p-6 flex items-center mb-8">
            <Image src={sampleprofile} alt="Profile" width={48} height={48} className="rounded-full mr-4" />
            <div className="flex-grow">
              <div className="text-xl font-bold text-gray-900">Welcome Back, {session?.user?.name || 'Traveler'}!<span className="ml-1">👋</span></div>
              <div className="text-gray-500 text-sm">Ready to plan your next adventure?</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transition" onClick={() => router.push("/itinerary-generator")}>
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
        <div className="w-full md:w-80 bg-white rounded-2xl p-6 mt-8 md:mt-12 mr-0 md:mr-8 flex-shrink-0 h-full">
          <div className="mb-6">
            <div className="font-semibold text-lg mb-2">Baguio Weather</div>
            {loading ? (
              <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-center h-24">
                <div className="animate-pulse text-gray-500">Loading weather data...</div>
              </div>
            ) : error ? (
              <div className="bg-red-50 rounded-xl p-4 flex items-center justify-center h-24">
                <div className="text-red-500">{error}</div>
              </div>
            ) : weatherData ? (
              <div className="bg-blue-50 rounded-xl p-4 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <span className="text-3xl font-bold mr-2">{Math.round(weatherData.main.temp)}° C</span>
                    <span className="text-gray-500 capitalize">{weatherData.weather[0].description}</span>
                  </div>
                  {weatherData.weather[0].icon && (
                    <Image 
                      src={getWeatherIconUrl(weatherData.weather[0].icon)} 
                      alt={weatherData.weather[0].description} 
                      width={50} 
                      height={50} 
                      className="object-contain"
                    />
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Feels like:</span>
                    <span className="font-medium">{Math.round(weatherData.main.feels_like)}° C</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Humidity:</span>
                    <span className="font-medium">{weatherData.main.humidity}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Location:</span>
                    <span className="font-medium">{BAGUIO_COORDINATES.name}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl font-bold mr-2">18° C</span>
                  <span className="text-gray-500">Sunny</span>
                </div>
                <span>
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="5" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95 7.07l-1.41-1.41M6.34 6.34L4.93 4.93m12.02 0l-1.41 1.41M6.34 17.66l-1.41 1.41" /></svg>
                </span>
              </div>
            )}
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