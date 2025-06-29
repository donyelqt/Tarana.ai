"use client"

import Image from "next/image"
import sampleprofile from "../../../public/images/sampleprofile.png"
import Sidebar from "../../components/Sidebar"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { useSession } from "next-auth/react"
import { BAGUIO_COORDINATES, WeatherData, fetchWeatherFromAPI, getWeatherIconUrl } from "@/lib/utils"
import { Bookmark, Plus, MapPin } from "lucide-react"

const DashboardContent = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSplash, setShowSplash] = useState(false)

  useEffect(() => {
    if (searchParams.get('signedin') === 'true') {
      setShowSplash(true)
      const timer = setTimeout(() => {
        setShowSplash(false)
        // Clean up the URL
        router.replace('/dashboard', { scroll: false })
      }, 4000) // Keep splash screen for 4 seconds

      return () => clearTimeout(timer)
    }
  }, [searchParams, router])

  useEffect(() => {
    // Redirect to login if not authenticated
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    
    const getWeather = async () => {
      try {
        setLoading(true)
        
        // Use the secure API endpoint instead of exposing API key on client
        const data = await fetchWeatherFromAPI()
        
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

  // Show loading state while checking authentication or if splash screen is active
  if (status === 'loading' || showSplash) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f9fb]">
        <div className="relative flex items-center justify-center">
          {/* Pulsing rings */}
          <div className="absolute h-48 w-48 rounded-full bg-blue-200/50 animate-pulse-ring"></div>
          <div className="absolute h-48 w-48 rounded-full bg-blue-200/50 animate-pulse-ring-delayed"></div>
          <div className="absolute h-48 w-48 rounded-full bg-blue-200/50 animate-pulse-ring-delayed-more"></div>
          
          {/* Logo */}
          <Image 
            src="/images/taranaai2.png" 
            alt="Loading..." 
            width={200} 
            height={200} 
            className="animate-reveal-and-pulse"
            priority 
          />
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-white">
      {/* Sidebar */}
      <Sidebar />
      {/* Main Content - add left padding on desktop to accommodate fixed sidebar */}
      <main className="md:pl-64 flex-1 flex flex-col md:flex-row">
        {/* Center Content */}
        <div className="flex-1 p-8 md:p-12 pt-16 md:pt-12">
          <div className="bg-gradient-to-br from-blue-300 to-blue-600 shadow-md rounded-2xl p-6 flex items-center mb-8">
            <Image src={session?.user?.image || sampleprofile} alt="Profile" width={48} height={48} className="rounded-full mr-4" />
            <div className="flex-grow">
              <div className="text-xl font-bold text-white">Welcome Back, {session?.user?.name || 'Traveler'}!<span className="ml-1">👋</span></div>
              <div className="text-gray-200 text-sm">Ready to plan your next adventure?</div>
              {/*<div className="text-gray-500 text-sm">{session?.user?.email}</div>*/}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-md p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transition" onClick={() => router.push("/itinerary-generator")}>
              <Plus size={28} className="mb-2" />
              <div className="font-semibold text-lg">Create New Itinerary</div>
              <div className="text-gray-500 text-sm mt-1">Create a personalized travel plan</div>
            </div>
            <div className="bg-white rounded-2xl shadow-md p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transition" onClick={() => router.push("/saved-trips")}>
              <div className="mb-2">
                <Bookmark size={28} />
              </div>
              <div className="font-semibold text-lg">View Saved Trips</div>
              <div className="text-gray-500 text-sm mt-1">Access your planned Itineraries</div>
            </div>
          </div>
          <div className="bg-white shadow-md rounded-2xl p-6 mb-8">
            <div className="font-semibold text-lg mb-4">Current Itinerary</div>
            <div className="bg-blue-50 rounded-xl p-4 flex items-center">
              <MapPin size={24} className="mr-3 flex-shrink-0 text-blue-500 fill-white" />
              <div>
                <div className="font-medium text-gray-900">1 Day Itinerary <span className="text-xs text-gray-400 ml-2">#BC402</span></div>
                <div className="text-xs text-gray-500">April 26 - 27, 2025 | 7:30AM - 8:00PM</div>
              </div>
            </div>
          </div>
        </div>
        {/* Right Sidebar */}
        <div className="w-full md:w-80 bg-white shadow-md rounded-2xl p-6 mt-8 md:mt-12 mr-0 md:mr-8 flex-shrink-0 h-full">
          <div className="mb-6">
            <div className="font-semibold text-lg mb-2">Baguio Weather</div>
            {loading ? (
              <div className="bg-gray-100 rounded-xl p-4 flex flex-col items-center justify-center h-32 text-center"> 
                <svg className="animate-spin h-8 w-8 text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="text-gray-600">Loading weather data...</div>
              </div>
            ) : error ? (
              <div className="bg-red-50 rounded-xl p-4 flex flex-col items-center justify-center h-32 text-center">
                <svg className="h-8 w-8 text-red-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div className="text-red-600 font-medium">Failed to load weather</div>
                <div className="text-red-500 text-sm">{error}</div>
              </div>
            ) : weatherData ? (
              <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-4 flex flex-col text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <span className="text-4xl font-bold mr-2">{Math.round(weatherData.main.temp)}°C</span>
                    <span className="capitalize text-sm opacity-90">{weatherData.weather[0].description}</span>
                  </div>
                  {weatherData.weather[0].icon && (
                    <Image 
                      src={getWeatherIconUrl(weatherData.weather[0].icon)} 
                      alt={weatherData.weather[0].description} 
                      width={50} 
                      height={50} 
                      className="object-contain drop-shadow-md"
                    />
                  )}
                </div>
                <div className="text-sm opacity-90 space-y-1 mb-3">
                  <div className="flex justify-between">
                    <span>Feels like:</span>
                    <span className="font-medium">{Math.round(weatherData.main.feels_like)}°C</span>
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
                <div className="text-xs opacity-70 text-right mt-auto">
                  {/* Placeholder for last updated time - implement logic to update this */}
                  Last updated: {weatherData.dt ? new Date(weatherData.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                </div>
              </div>
            ) : (
              // Fallback UI if weatherData is null and not loading/error
              <div className="bg-gray-100 rounded-xl p-4 flex flex-col items-center justify-center h-32 text-center">
                <svg className="h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.485-8.485h-1M4.515 12H3.5m14.97-7.485l-.707-.707M6.222 6.222l-.707-.707m12.026 12.026l-.707.707M6.222 17.778l-.707.707" /></svg>
                <div className="text-gray-500">Weather data unavailable</div>
                <div className="text-sm text-gray-400">Displaying default</div>
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

const Dashboard = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  )
}

export default Dashboard