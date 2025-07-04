"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AnimatePresence, motion } from "framer-motion"

// Component that uses useRouter
function SignUpForm() {
    const [fullName, setFullName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const router = useRouter()
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)
        
        // Basic validation
        if (password !== confirmPassword) {
            setError("Passwords do not match")
            setIsLoading(false)
            return
        }
        
        if (password.length < 6) {
            setError("Password must be at least 6 characters long")
            setIsLoading(false)
            return
        }
        
        try {
            // Make API call to register the user
            const response = await fetch('/api/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fullName, email, password }),
            })
            
            const data = await response.json()
            
            if (!response.ok) {
              throw new Error(data.error || 'Registration failed')
            }
            
            // Redirect to sign in page after successful registration
            router.push('/auth/signin?registered=true')
        } catch (error: unknown) {
            console.error('Registration error:', error)
            setError(error instanceof Error ? error.message : 'Registration failed. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
                <div>
                    <Label htmlFor="fullName" className="block text-sm font-medium text-black">Full Name</Label>
                    <Input
                        id="fullName"
                        name="fullName"
                        type="text"
                        autoComplete="name"
                        required
                        className="mt-1 block w-full px-3 py-2 border bg-white rounded-xl shadow-sm focus:outline-none focus:ring-[#0066FF] focus:border-[#0066FF]"
                        placeholder="Enter your Full Name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                    />
                </div>
                <div>
                    <Label htmlFor="email" className="block text-sm font-medium text-black">Email</Label>
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
                    <Label htmlFor="password" className="block text-sm font-medium text-black">Password</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
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
                <div>
                    <Label htmlFor="confirmPassword" className="block text-sm font-medium text-black">Confirm Password</Label>
                    <div className="relative">
                        <Input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            autoComplete="new-password"
                            required
                            className="mt-1 block w-full px-3 py-2 border bg-white rounded-xl shadow-sm focus:outline-none focus:ring-[#0066FF] focus:border-[#0066FF] pr-10"
                            placeholder="Re-enter your Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <span className="absolute inset-y-0 right-3 flex items-center text-gray-400 cursor-pointer" onClick={() => setShowConfirmPassword((prev) => !prev)}>
                            {showConfirmPassword ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368m1.671-2.195C7.523 5 12 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.832-.67 1.613-1.176 2.318M15.362 17.362A9.953 9.953 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368M3 3l18 18" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.832-.67 1.613-1.176 2.318M15.362 17.362A9.953 9.953 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368" /></svg>
                            )}
                        </span>
                    </div>
                </div>
            </div>
            {error && (
                <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm mb-4">
                    {error}
                </div>
            )}
            <Button
                type="submit"
                className="w-full flex justify-center py-3 px-4 rounded-2xl shadow-sm text-base font-medium text-white bg-gradient-to-r from-[#0066FF] to-[#1E90FF] hover:from-[#0052cc] hover:to-[#3388ff] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0066FF] mt-2"
                disabled={isLoading}
            >
                {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
            <div className="text-center">
                <p className="text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link href="/auth/signin" className="font-medium text-[#0066FF] hover:text-[#0066FF]/80">Sign in</Link>
                </p>
            </div>
        </form>
    )
}

const SignUp = () => {
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
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Tarana.ai</h2>
                        <p className="text-sm text-gray-600 mb-6">Please Sign up to Continue</p>
                        <div className="flex justify-center mb-6">
                            <Link href="/auth/signin" className="px-8 py-2 rounded-full bg-blue-50 text-[#0066FF] font-medium hover:bg-blue-100 transition">Login</Link>
                            <AnimatePresence mode="wait">
                                <motion.button
                                    key="register-active"
                                    type="button"
                                    className="px-8 py-2 rounded-full bg-[#0066FF] text-white font-medium shadow-md focus:outline-none ml-2"
                                    initial={{ opacity: 0, x: 40 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -40 }}
                                    transition={{ duration: 0.4, ease: "easeInOut" }}
                                >
                                    Register
                                </motion.button>
                            </AnimatePresence>
                        </div>
                    </div>
                    {/* Wrap the component that uses useRouter in Suspense */}
                    <Suspense fallback={<div className="h-10">Loading...</div>}>
                        <SignUpForm />
                    </Suspense>
                </div>
            </div>
        </div>
    )
}

export default SignUp