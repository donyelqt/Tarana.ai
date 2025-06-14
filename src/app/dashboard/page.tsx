"use client"

import Image from "next/image"
import { sampleprofile } from "../../../public"
import Sidebar from "../../components/Sidebar"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { BAGUIO_COORDINATES, WeatherData, fetchWeatherFromAPI, getWeatherIconUrl } from "@/lib/utils"

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
    <div className="min-h-screen bg-white">
      {/* Sidebar */}
      <Sidebar />
      {/* Main Content - add left padding on desktop to accommodate fixed sidebar */}
      <main className="md:pl-64 flex-1 flex flex-col md:flex-row">
        {/* Center Content */}
        <div className="flex-1 p-8 md:p-12 pt-16 md:pt-12">
          <div className="bg-blue-50 shadow-md rounded-2xl p-6 flex items-center mb-8">
            <Image src={sampleprofile} alt="Profile" width={48} height={48} className="rounded-full mr-4" />
            <div className="flex-grow">
              <div className="text-xl font-bold text-gray-900">Welcome Back, {session?.user?.name || 'Traveler'}!<span className="ml-1">👋</span></div>
              <div className="text-gray-500 text-sm">Ready to plan your next adventure?</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-md p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transition" onClick={() => router.push("/itinerary-generator")}>
              <div className="text-3xl mb-2">+</div>
              <div className="font-semibold text-lg">Create New Itinerary</div>
              <div className="text-gray-500 text-sm mt-1">Create a personalized travel plan</div>
            </div>
            <div className="bg-white rounded-2xl shadow-md p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transition" onClick={() => router.push("/saved-trips")}>
              <div className="mb-2">
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
              </div>
              <div className="font-semibold text-lg">View Saved Trips</div>
              <div className="text-gray-500 text-sm mt-1">Access your planned Itineraries</div>
            </div>
          </div>
          <div className="bg-white shadow-md rounded-2xl p-6 mb-8">
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

export default Dashboard