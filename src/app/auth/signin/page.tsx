"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { AnimatePresence, motion } from "framer-motion"

// Component that uses useSearchParams
function RegisteredMessage() {
    const [success, setSuccess] = useState<string | null>(null)
    const searchParams = useSearchParams()
    
    useEffect(() => {
        // Check if user has just registered
        if (searchParams?.get('registered') === 'true') {
            setSuccess('Account created successfully! Please sign in.')
        }
    }, [searchParams])
    
    if (!success) return null
    
    return (
        <div className="bg-green-50 text-green-500 p-3 rounded-lg text-sm mb-4">
            {success}
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
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)
        
        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false
            })
            
            if (result?.error) {
                setError('Invalid email or password')
                console.error('Authentication error:', result.error)
            } else {
                // Redirect to dashboard on success
                window.location.href = '/dashboard?signedin=true'
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
            <div className="hidden md:flex w-1/2 bg-[#0066FF] flex-col justify-center items-center text-white">
                <div className="max-w-xs text-left">
                    <div className="text-4xl font-bold mb-2">Tarana.ai</div>
                    <div className="mb-6 text-sm">Your ai-powered Baguio travel companion</div>
                    <Link href="/" className="inline-block bg-white text-[#0066FF] font-medium rounded-xl px-8 py-3 text-base shadow-md hover:bg-gray-100 transition">Back to Home</Link>
                </div>
            </div>
            {/* Right Panel */}
            <div className="flex flex-1 items-center justify-center bg-gray-100 relative">
                {/* Mobile Back to Home Button */}
                <Link href="/" className="md:hidden absolute top-4 left-4 bg-white text-[#0066FF] font-medium rounded-xl px-6 py-2 text-base shadow-md hover:bg-gray-100 transition z-10">Back to Home</Link>
                <div className="w-full max-w-md space-y-8 p-10 mx-4">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back to Tarana.ai</h2>
                        <p className="text-sm text-gray-600 mb-6">Please Sign in to Continue</p>
                        <div className="flex justify-center mb-6">
                            <AnimatePresence mode="wait">
                                <motion.button
                                    key="login-active"
                                    type="button"
                                    className="px-8 py-2 rounded-full bg-[#0066FF] text-white font-medium shadow-md focus:outline-none"
                                    initial={{ opacity: 0, x: 40 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -40 }}
                                    transition={{ duration: 0.4, ease: "easeInOut" }}
                                >
                                    Login
                                </motion.button>
                            </AnimatePresence>
                            <Link href="/auth/signup" className="px-8 py-2 rounded-full bg-blue-50 text-[#0066FF] font-medium ml-2 hover:bg-blue-100 transition">Register</Link>
                        </div>
                    </div>
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="email" className="block text-sm font-bold text-black">Email</Label>
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
                                <Label htmlFor="password" className="block text-sm font-bold text-black">Password</Label>
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
                            <Link href="#" className="text-gray-400 hover:text-[#0066FF]">Forgot Password ?</Link>
                        </div>
                        {error && (
                            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm mb-4">
                                {error}
                            </div>
                        )}
                        {/* Wrap the component that uses useSearchParams in Suspense */}
                        <Suspense fallback={<div className="h-10"></div>}>
                            <RegisteredMessage />
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