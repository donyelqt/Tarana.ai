"use client"

import React from "react"
import Image from "next/image"
import Sidebar from "../../components/Sidebar"
import { useSidebarCollapsed } from "@/components/Sidebar";
import SuggestedSpots from "./components/SuggestedSpots"
import RecommendedCafes from "./components/RecommendedCafes"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useRef, Suspense } from "react"
import { useSession } from "next-auth/react"
import { BAGUIO_COORDINATES, WeatherData, getWeatherIconUrl } from "@/lib/core/utils"
import { Bookmark, Plus, MapPin, Car, Utensils, Wand2, Link, Share2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { noProfile } from "public"
import { ReferralModal } from "./components/ReferralModal"
import { useToast } from "@/components/ui/use-toast"
import { trackReferralAfterSignup } from "@/lib/referral-system/client/referralTracking"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  buildInviteLink,  getReferralDisplay,
  isFallbackWeather,
  referralCodeQueryOptions,
  referralQueryOptions,
  taranaStatsQueryOptions,
  weatherQueryOptions,
} from "./utils"

const DashboardContent = () => {
  const { contentClass } = useSidebarCollapsed();
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const reduceMotion = useReducedMotion()
  const [showSplash, setShowSplash] = useState(false)
  const [isWelcomeCardAnimated, setIsWelcomeCardAnimated] = useState(false)
  // While hovered, the 2s auto-toggle pauses so it never yanks the card
  // mid-hover (the jank). Tracked in a ref — no re-render needed.
  const welcomeHoverRef = useRef(false)
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false)
  const [referralTracked, setReferralTracked] = useState(false)
  // Real DB-issued code (8-char trigger output). The old `${EMAIL}2024`
  // fabrication matched no user_profiles row — every copied link was dead.
  const { data: referralCodeData } = useQuery(
    referralCodeQueryOptions(status, session?.user?.id)
  )
  const referralCode = referralCodeData ?? ""
  const referralLink =
    typeof window !== "undefined" && referralCode
      ? buildInviteLink(window.location.origin, referralCode)
      : ""

  const handleCopyInviteLink = () => {
    if (!referralLink) return
    navigator.clipboard.writeText(referralLink)
    toast({
      title: "Copied!",
      description: "Invite link copied to clipboard.",
      duration: 2000,
    })
  }

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (welcomeHoverRef.current) return
      setIsWelcomeCardAnimated((prev) => !prev)
    }, 2000)

    return () => clearInterval(intervalId)
  }, [])

  // Baguio weather: 10-minute staleTime is appropriate for weather (doesn't change  // minute-to-minute); useQuery replaces the manual useState/useEffect/useLoading
  // trio and prevents a refetch on every dashboard remount.
  const {
    data: weatherData,
    isLoading: loading,
    isError: weatherIsError,
  } = useQuery<WeatherData | null>(
    weatherQueryOptions(status === "authenticated")
  )
  // fetchWeatherFromAPI swallows errors and returns a fallback WeatherData, so
  // weatherIsError is effectively unreachable in practice. Keep the local string
  // for any future queryFn change that lets the error propagate.
  const error = weatherIsError ? "Could not load weather data" : null

  // Referral stats: /api/referrals/stats is the production-safe endpoint
  // (/api/referrals/debug 404s in production — debug/route.ts:10-12).
  // Config lives in ./utils (unit-tested, shared with the cache test).
  // Cached 60s; invalidated after a successful trackReferralAfterSignup.
  const { data: referralStats } = useQuery(
    referralQueryOptions(status, session?.user?.id)
  )

  // Tarana Stats: public aggregates from GET /api/stats (exact-count head
  // queries + static cafes length). dataUpdatedAt powers the freshness line.
  const { data: taranaStats, dataUpdatedAt: statsUpdatedAt } = useQuery(
    taranaStatsQueryOptions(status)
  )
  const statsUpdatedLabel = statsUpdatedAt
    ? new Date(statsUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  // Track referral after signup (with delay to allow profile creation)
  useEffect(() => {
    if (status === 'authenticated' && !referralTracked) {
      // Wait 2 seconds to ensure user profile is created
      const timer = setTimeout(() => {
        trackReferralAfterSignup()
          .then((result) => {
            if (result.success) {
              console.log('✅ Referral tracked successfully!');
              toast({
                title: "Referral Applied! 🎉",
                description: "Your friend will receive bonus credits. Thanks for joining!",
                duration: 4000,
              });
              // Invalidate the cached referral-stats so the new tier is
              // reflected on the next render without a manual re-fetch.
              queryClient.invalidateQueries({ queryKey: ["referral-stats", session?.user?.id] });
            } else if (result.error && !result.error.includes('No referral code')) {
              console.log('ℹ️ Referral tracking result:', result.error);
            }
            setReferralTracked(true);
          })
          .catch((err) => {
            console.error('Failed to track referral:', err);
            setReferralTracked(true);
          });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [status, referralTracked, toast, queryClient, session?.user?.id])

  useEffect(() => {
    if (searchParams.get('signedin') === 'true') {
      setShowSplash(true)
      const timer = setTimeout(() => {
        setShowSplash(false)
        router.replace('/dashboard', { scroll: false })
      }, 4000)
      const onEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowSplash(false)
          router.replace('/dashboard', { scroll: false })
        }
      }
      window.addEventListener('keydown', onEsc)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('keydown', onEsc)
      }
    }
  }, [searchParams, router])

  useEffect(() => {
    // Redirect to login if not authenticated
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
  }, [status, router])

  // Premium splash — modernized 2026: same 4s, now design-system native (rounded-3xl, soft shadows, springs)
  if (status === 'loading' || showSplash) {
    if (status === 'loading') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f7f9fb]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        </div>
      )
    }
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => { setShowSplash(false); router.replace('/dashboard', { scroll: false }) }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#f7f9fb] p-6 cursor-pointer"
          aria-label="Welcome — click to continue"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[420px] rounded-[32px] bg-white border border-gray-200/60 shadow-[0_20px_60px_rgba(0,0,0,0.08),0_8px_30px_rgba(0,0,0,0.06)] p-10 text-center overflow-hidden cursor-default"
          >
            <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-blue-50 via-transparent to-blue-50/50 pointer-events-none" />
            <div className="relative">
              <div className="relative mx-auto w-[200px] h-[200px] flex items-center justify-center">
                <motion.div
                  initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={reduceMotion ? { duration: 0 } : { delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-100 to-blue-50"
                  aria-hidden="true"
                />
                <motion.div
                  animate={reduceMotion ? {} : { scale: [1, 1.06, 1] }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full border border-blue-200/50"
                  aria-hidden="true"
                />
                <Image src="/images/taranaai2.png" alt="Tarana.ai" width={160} height={160} className="relative z-10" priority />
              </div>
              <motion.h1
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { delay: 0.35, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="mt-6 text-xl font-bold tracking-tight text-gray-900"
              >
                Welcome back, {session?.user?.name || 'Traveler'}!
              </motion.h1>
              <motion.p
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduceMotion ? { duration: 0 } : { delay: 0.5, duration: 0.5 }}
                className="mt-2 text-sm text-gray-500"
              >
                Your Baguio workspace is ready
              </motion.p>
              <div className="mt-8 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4, ease: "linear" }}
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
                />
              </div>
              <p className="mt-3 text-[11px] tracking-[0.12em] uppercase text-gray-400">Tarana.ai — Baguio, Philippines</p>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }
  
  return (
    <div className="min-h-screen bg-white">
      {/* Sidebar */}
      <Sidebar />
      {/* Main Content - add left padding on desktop to accommodate fixed sidebar */}
      <main className={`${contentClass('md:pl-64')} flex-1 flex flex-col md:flex-row`}>
        {/* Center Content */}
        <div className="flex-1 p-8 md:p-12 pt-16 md:pt-12">
          <div
            onMouseEnter={() => { welcomeHoverRef.current = true }}
            onMouseLeave={() => { welcomeHoverRef.current = false }}
            className={`bg-gradient-to-br from-blue-300 to-blue-600 rounded-2xl p-6 flex items-center mb-8 shadow-[0_0_18px_rgba(59,130,246,0.35),0_0_55px_rgba(59,130,246,0.22)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-safe:hover:-translate-y-2 motion-safe:hover:shadow-[0_0_28px_rgba(96,165,250,0.65),0_0_80px_rgba(59,130,246,0.4),0_16px_48px_rgba(29,78,216,0.5)] ${isWelcomeCardAnimated ? 'animate-none -translate-y-2 shadow-3xl shadow-blue-500' : ''}`}>
            <Image src={session?.user?.image || noProfile} alt="Profile" width={48} height={48} className="rounded-full mr-4" />
            <div className="flex-grow">
              <h1 className="text-xl font-bold text-white text-balance">Welcome Back, {session?.user?.name || 'Traveler'}!<span className="wave ml-1 text-3xl" aria-hidden="true">👋</span></h1>
              <div className="text-gray-200 text-sm">Ready to plan your next adventure?</div>
              {/*<div className="text-gray-500 text-sm">{session?.user?.email}</div>*/}
            </div>
          </div> 
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="bg-white rounded-2xl border-2 border-gray-200 p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <Plus size={28} className="mb-2 text-blue-700 feature-icon-float" aria-hidden="true" />
                  <div className="font-semibold text-lg">Create New Plan</div>
                  <div className="text-gray-500 text-sm mt-1">AI-powered trip and food planning</div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2">
                <div className="grid gap-2">
                  <div className="px-2 pt-1 text-lg font-semibold">What to create?</div>
                  <button
                    type="button"
                    className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-blue-50 text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    onClick={() => router.push("/itinerary-generator")}
                  >
                    <div className="flex items-center">
                      <Wand2 className="mr-3 h-5 w-5 text-blue-500" aria-hidden="true" />
                      <div>
                        <div className="font-medium">New Itinerary</div>
                        <div className="text-xs text-gray-500">
                          Generate a personalized travel plan.
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-blue-50 text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    onClick={() => router.push("/tarana-eats")}
                  >
                    <div className="flex items-center">
                      <Utensils className="mr-3 h-5 w-5 text-green-500" aria-hidden="true" />
                      <div>
                        <div className="font-medium">Food Recommendations</div>
                        <div className="text-xs text-gray-500">
                          Discover your next favorite meal.
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="bg-white rounded-2xl border-2 border-gray-200 p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <div className="mb-2 feature-icon-float" style={{ animationDelay: '0.8s' }}>
                    <Bookmark size={28} className="text-blue-700 fill-blue-700" aria-hidden="true" />
                  </div>
                  <div className="font-semibold text-lg">View Saved Plans</div>
                  <div className="text-gray-500 text-sm mt-1">Access your planned Itineraries and meals</div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2">
                <div className="grid gap-2">
                  <div className="px-2 pt-1 text-lg font-semibold"> Select Plans to View</div>
                  <button
                    type="button"
                    className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-blue-50 text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    onClick={() => router.push("/saved-trips")}
                  >
                    <div className="flex items-center">
                      <Car className="mr-3 h-5 w-5 text-blue-500" aria-hidden="true" />
                      <div>
                        <div className="font-medium">Saved Trips</div>
                        <div className="text-xs text-gray-500">
                          Access your travel itineraries.
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-blue-50 text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    onClick={() => router.push("/saved-meals")}
                  >
                    <div className="flex items-center">
                      <Utensils className="mr-3 h-5 w-5 text-green-500" aria-hidden="true" />
                      <div>
                        <div className="font-medium">Saved Meals</div>
                        <div className="text-xs text-gray-500">
                          Revisit your food recommendations.
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <SuggestedSpots />

          {/* Tarana Explore navigation card */}
          <button
            type="button"
            onClick={() => router.push("/tarana-explore")}
            className="bg-white rounded-2xl border-2 border-gray-200 p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transition-shadow mb-8 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <MapPin size={28} className="mb-2 text-blue-500 feature-icon-float" style={{ animationDelay: '1.6s' }} aria-hidden="true" />
            <div className="font-semibold text-lg">Explore Routes</div>
            <div className="text-gray-500 text-sm mt-1">Smart traffic-aware navigation</div>
          </button>

          <RecommendedCafes />
        </div>
        {/* Right Sidebar */}
        <div className="w-full md:w-80 border-2 border-gray-200 bg-white rounded-2xl p-6 mt-8 md:mt-12 mr-0 md:mr-8 flex-shrink-0 h-full">
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
              <div className="bg-gradient-to-b from-blue-700 to-blue-500 rounded-xl p-4 flex flex-col text-white shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-4xl font-bold tracking-tight leading-none tabular-nums">{Math.round(weatherData.main.temp)}°C</div>
                    <div className="capitalize text-sm font-medium opacity-90 mt-1">{weatherData.weather[0].description}</div>
                  </div>
                  {weatherData.weather[0].icon && (
                    <Image
                      src={getWeatherIconUrl(weatherData.weather[0].icon)}
                      alt={weatherData.weather[0].description}
                      width={52}
                      height={52}
                      className="object-contain drop-shadow-md"
                    />
                  )}
                </div>
                <div className="mt-3 divide-y divide-white/10 text-sm">
                  <div className="flex items-center justify-between py-1">
                    <span className="opacity-80">Feels like:</span>
                    <span className="font-semibold tabular-nums">{Math.round(weatherData.main.feels_like)}°C</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="opacity-80">Humidity:</span>
                    <span className="font-semibold tabular-nums">{weatherData.main.humidity}%</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="opacity-80">Location:</span>
                    <span className="font-semibold">{BAGUIO_COORDINATES.name}</span>
                  </div>
                </div>
                <div className="mt-2 pt-2 text-xs opacity-70 text-right border-t border-white/10 tabular-nums">
                  Last updated: {weatherData.dt ? new Date(weatherData.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                </div>
                {isFallbackWeather(weatherData) && (
                  <div
                    className="mt-2 rounded-lg bg-yellow-400/20 border border-yellow-200/40 px-2 py-1 text-center text-xs font-medium text-white"
                    title={weatherData.fallbackReason ? `Why: ${weatherData.fallbackReason}` : undefined}
                  >
                    Typical Baguio weather — live data unavailable
                  </div>
                )}
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
            <div className="font-semibold text-lg mb-2">Tarana Stats</div>
            <div className="bg-blue-600 rounded-xl p-3 text-white shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm opacity-90 tabular-nums">
                  {statsUpdatedLabel ? `Updated ${statsUpdatedLabel}` : 'Updating…'}
                </div>
                <div className="flex items-center bg-slate-900 text-green-700 border-2 border-green-800 rounded-full px-3 py-1 text-xs font-bold" aria-hidden="true">

                  <span className="w-2 h-2 bg-green-700 rounded-full mr-2"></span>
                  LIVE
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-500/80 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold tabular-nums inline-block min-w-[4ch]">{taranaStats?.itineraries.toLocaleString() ?? "…"}</div>
                  <div className="text-xs opacity-90">ITINERARIES GENERATED</div>
                </div>
                <div className="bg-blue-500/80 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold tabular-nums inline-block min-w-[4ch]">{taranaStats?.cafes.toLocaleString() ?? "…"}</div>
                  <div className="text-xs opacity-90">CAFES LISTED</div>
                </div>
                <div className="bg-blue-500/80 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold tabular-nums inline-block min-w-[4ch]">{taranaStats?.meals.toLocaleString() ?? "…"}</div>
                  <div className="text-xs opacity-90">MEALS SAVED</div>
                </div>
                <div className="bg-blue-500/80 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold tabular-nums inline-block min-w-[4ch]">{taranaStats?.explorers.toLocaleString() ?? "…"}</div>
                  <div className="text-xs opacity-90">EXPLORERS</div>
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="font-semibold text-lg mb-2">Refer a Friend</div>
            <div
              className="rounded-2xl lg:px-5 lg:py-3 p-8 text-white relative overflow-hidden"
              style={{ backgroundImage: `linear-gradient(to bottom, #3b82f6, #1d4ed8)` }}
            >
              <img
                src="/images/referafriend.png"
                alt=""
                className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/4 h-[100%] w-auto z-0 opacity-35"
                style={{
                  filter:
                    'brightness(0) saturate(100%) invert(70%) sepia(79%) saturate(2351%) hue-rotate(185deg) brightness(102%) contrast(101%)',
                }}
              />
              <div className="relative z-10">
                <h3 className="text-lg font-medium">Refer a Friend.</h3>
                <h3 className="text-lg font-medium">Earn rewards.</h3>
                <p className="text-slate-200 text-sm mt-1 mb-4">Invite friends. They get a welcome perk, you earn points and rewards.</p>

                <div className="font-medium text-md mb-2">Your invite link</div>
                <div className="flex space-x-2 mb-4">
                  <Button
                    variant="outline"
                    className="border border-gray-300 bg-white text-xs text-blue-700 px-3 py-1.5 hover:bg-blue-50 whitespace-nowrap"
                    onClick={handleCopyInviteLink}
                    disabled={!referralLink}
                  >
                    <Link size={16} className="mr-1" aria-hidden="true" />
                    Copy invite link
                  </Button>
                  <Button
                    variant="secondary"
                    className="bg-slate-900 text-white hover:bg-slate-800 text-xs px-3 py-1.5"
                    onClick={() => setIsReferralModalOpen(true)}
                  >
                    <Share2 size={16} className="mr-2" aria-hidden="true" />
                    Invite Friends
                  </Button>
                </div>

                {referralStats ? (() => {
                  const display = getReferralDisplay(referralStats);

                  return (
                    <>
                      <div className="text-sm mb-1">{display.label} referrals - {display.tier} Tier</div>
                      <div className="w-full bg-blue-500/50 rounded-full h-2.5 mb-1">
                        <div className="bg-yellow-400 h-2.5 rounded-full transition-all" style={{ width: `${display.progress}%` }}></div>
                      </div>
                      <div className="text-xs text-blue-200">
                        {display.isMaxed
                          ? '🎉 Maximum tier achieved!'
                          : `Invite ${display.invitesNeeded} more to unlock ${display.nextTierName} (${display.nextBenefit})`
                        }
                      </div>
                    </>
                  );
                })() : (
                  <>
                    <div className="text-sm mb-1">Loading referrals...</div>
                    <div className="w-full bg-blue-500/50 rounded-full h-2.5 mb-1">
                      <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: "0%" }}></div>
                    </div>
                    <div className="text-xs text-blue-200">Invite friends to unlock higher tiers & more credits</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Referral Modal */}
      <ReferralModal 
        open={isReferralModalOpen} 
        onOpenChange={setIsReferralModalOpen}
        userReferralCode={referralCode}
      />
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