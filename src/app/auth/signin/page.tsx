"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { AnimatePresence, motion } from "framer-motion"
import { GeminiSparkles, FadingDotGrid } from "@/components/auth/GeminiSparkles"
import { Home } from "lucide-react"

// Component that uses useSearchParams
function StatusMessage() {
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null)
    const searchParams = useSearchParams()
    
    useEffect(() => {
        // Check if user has just registered
        if (searchParams?.get('registered') === 'true') {
            setMessage({ text: 'Account created successfully! Please sign in.', type: 'success' })
        }
        // Check if password was reset successfully
        else if (searchParams?.get('reset') === 'success') {
            setMessage({ text: 'Password reset successfully! Please sign in with your new password.', type: 'success' })
        }
    }, [searchParams])
    
    if (!message) return null
    
    const bgColor = message.type === 'success' ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-500'
    
    return (
        <div className={`${bgColor} p-3 rounded-lg text-sm mb-4`}>
            {message.text}
        </div>
    )
}

const SignIn = () => {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [rememberMe, setRememberMe] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    
    // Load remembered email on component mount
    useEffect(() => {
        const rememberedEmail = localStorage.getItem('rememberedEmail')
        const shouldRemember = localStorage.getItem('rememberMe') === 'true'
        
        if (shouldRemember && rememberedEmail) {
            setEmail(rememberedEmail)
            setRememberMe(true)
        }
    }, [])
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)
        
        try {
            // Handle remember me by setting session duration
            const callbackUrl = '/dashboard?signedin=true'
            
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
                callbackUrl
            })
            
            if (result?.error) {
                setError('Invalid email or password')
                console.error('Authentication error:', result.error)
            } else {
                // Store remember me preference in localStorage for future sessions
                if (rememberMe) {
                    localStorage.setItem('rememberMe', 'true')
                    localStorage.setItem('rememberedEmail', email)
                } else {
                    localStorage.removeItem('rememberMe')
                    localStorage.removeItem('rememberedEmail')
                }
                
                // Redirect to dashboard on success
                window.location.href = callbackUrl
            }
        } catch (error) {
            setError('An unexpected error occurred')
            console.error('Sign in error:', error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex">
            {/* Left Panel */}
            <div className="hidden md:flex w-1/2 bg-[#0066FF] flex-col justify-center items-center text-white relative overflow-hidden">
              {/* ── Apple Liquid Glass coating ── */}
              <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
                {/* 1. Glass tint — slightly lighter blue simulating glass thickness over solid color */}
                <div className="absolute inset-0" style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                }} />

                {/* 2. Top-edge specular highlight — Apple's signature: a thin bright line at the very top where virtual light hits the glass surface */}
                <div className="absolute top-0 left-0 right-0 h-px" style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
                  boxShadow: '0 1px 12px rgba(255,255,255,0.4)',
                }} />
              </div>
              {/* ── End Liquid Glass coating ── */}

              {/* Gemini sparkles — sparse white dots on blue (texture, not competing with grid) */}
              <GeminiSparkles variant="white" count={20} minSize={2} maxSize={7} />

              {/* Fading dot grid — top-left, mirrors right panel's top-right; primary texture layer */}
              <FadingDotGrid dotColor="#cce4ff" dotSize={3} gap={14} widthFraction={0.55} heightFraction={0.6} corner="top-left" />

              {/* Referral logo watermark — matches dashboard styling */}
              <img
                src="/images/referafriend.png"
                alt=""
                className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/4 h-[100%] w-auto z-0 opacity-35"
                style={{
                  filter:
                    'brightness(0) saturate(100%) invert(70%) sepia(79%) saturate(2351%) hue-rotate(185deg) brightness(102%) contrast(101%)',
                }}
              />

              <div className="max-w-xs text-left relative z-10">
                <div className="mb-4">
                  <div className="bg-white rounded-xl p-4 shadow-md inline-block">
                    <Image src="/images/taranaai2.png" alt="Tarana.ai" width={125} height={125} priority />
                  </div>
                </div>
                <div className="mb-6 text-sm">Your ai-powered Baguio travel companion</div>
                <Link href="/" className="inline-block bg-white text-[#0066FF] font-medium rounded-xl px-7 py-3 text-base shadow-md hover:bg-gray-100 transition">Back to Home</Link>
              </div>
            </div>
            {/* Right Panel */}
            <div className="flex flex-1 items-center justify-center bg-white relative">
              {/* Gemini sparkles — blue/violet dots on white */}
              <GeminiSparkles variant="blue" count={35} minSize={2} maxSize={7} />
              {/* Fading dot grid — top-right, matches bryllim.com reference */}
              <FadingDotGrid dotColor="#93c5fd" dotSize={3} gap={14} widthFraction={0.55} heightFraction={0.6} />

              {/* Mobile Back to Home */}
              <Link
                href="/"
                className="md:hidden absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 bg-[#0066FF] text-white font-medium rounded-full px-4 py-1.5 text-sm shadow-sm active:scale-95 transition-transform"
              >
                <Home size={16} strokeWidth={2.5} />
                Home
              </Link>
              <div className="w-full max-w-md space-y-8 p-10 mx-4 relative z-10">
                    <div className="text-center mb-8">
                      {/* Brand accent */}
                      <div className="w-8 h-1 bg-[#0066FF] rounded-full mx-auto mb-5" />
                      <h2 className="text-[28px] font-semibold text-gray-900 tracking-tight leading-tight">
                        Welcome back<span className="text-[#0066FF]"> to Tarana.ai</span>
                      </h2>
                      <p className="text-sm text-gray-500 mt-2">Sign in to your account</p>
                      <div className="flex justify-center gap-2 mt-6">
                          <AnimatePresence mode="wait">
                              <motion.button
                                  key="login-active"
                                  type="button"
                                  className="px-7 py-2 rounded-full bg-[#0066FF] text-white font-medium text-sm focus:outline-none"
                                  initial={{ opacity: 0, x: 40 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -40 }}
                                  transition={{ duration: 0.4, ease: "easeInOut" }}
                              >
                                  Login
                              </motion.button>
                          </AnimatePresence>
                          <Link href="/auth/signup" className="px-7 py-2 rounded-full bg-blue-50 text-[#0066FF] font-medium text-sm hover:bg-blue-100 transition">Register</Link>
                      </div>
                    </div>
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="mt-1 block w-full px-3 py-2 border bg-white rounded-xl shadow-sm focus:outline-none focus:ring-[#0066FF] focus:border-[#0066FF]"
                                    placeholder="Enter your Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                    <Label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        required
                                        className="mt-1 block w-full px-3 py-2 border bg-white rounded-xl shadow-sm focus:outline-none focus:ring-[#0066FF] focus:border-[#0066FF] pr-10"
                                        placeholder="Enter your Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <span className="absolute inset-y-0 right-3 flex items-center text-gray-400 cursor-pointer" onClick={() => setShowPassword((prev) => !prev)}>
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368m1.671-2.195C7.523 5 12 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.832-.67 1.613-1.176 2.318M15.362 17.362A9.953 9.953 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368M3 3l18 18" /></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.832-.67 1.613-1.176 2.318M15.362 17.362A9.953 9.953 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368" /></svg>
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <Checkbox
                                    id="remember-me"
                                    name="remember-me"
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    checked={rememberMe}
                                    onCheckedChange={setRememberMe}
                                />
                                <Label htmlFor="remember-me" className="ml-2 block text-gray-900">Remember me</Label>
                            </div>
                            <Link href="/auth/forgot-password" className="text-gray-400 hover:text-[#0066FF]">Forgot Password ?</Link>
                        </div>
                        {error && (
                            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm mb-4">
                                {error}
                            </div>
                        )}
                        {/* Wrap the component that uses useSearchParams in Suspense */}
                        <Suspense fallback={<div className="h-10"></div>}>
                            <StatusMessage />
                        </Suspense>
                        <Button
                            type="submit"
                            className="w-full flex justify-center py-3 px-4 rounded-2xl shadow-sm text-base font-medium text-white bg-gradient-to-r from-[#0066FF] to-[#1E90FF] hover:from-[#0052cc] hover:to-[#3388ff] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0066FF] mt-2"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing in...' : 'Login'}
                        </Button>
                    </form>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-400"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-gray-100 text-gray-600">Or continue with</span>
                        </div>
                    </div>

                    <div>
                        <Button
                            variant="outline"
                            className="w-full bg-white"
                            onClick={() => signIn("google", { callbackUrl: "/dashboard?signedin=true" })}
                        >
                            <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.46 1.22 8.47 3.23l6.32-6.32C34.91 2.69 29.89 0 24 0 14.82 0 6.73 5.82 2.69 14.09l7.75 6.02C12.13 13.62 17.57 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.21-.43-4.73H24v9.01h12.41c-.54 2.9-2.18 5.36-4.64 7.01l7.17 5.57C43.93 37.19 46.1 31.38 46.1 24.55z"/><path fill="#FBBC05" d="M10.44 28.11a14.5 14.5 0 010-8.22l-7.75-6.02A23.97 23.97 0 000 24c0 3.77.9 7.34 2.69 10.23l7.75-6.12z"/><path fill="#EA4335" d="M24 48c6.49 0 11.94-2.15 15.92-5.86l-7.17-5.57c-2.01 1.35-4.59 2.16-8.75 2.16-6.43 0-11.87-4.12-13.56-9.61l-7.75 6.12C6.73 42.18 14.82 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></g></svg>
                            Google
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SignIn