"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Component that uses useSearchParams
function ResetPasswordForm() {
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    
    const searchParams = useSearchParams()
    const token = searchParams?.get('token')

    useEffect(() => {
        if (!token) {
            setError('Invalid reset link. Please request a new password reset.')
        }
    }, [token])

    const validatePassword = (password: string) => {
        if (password.length < 8) {
            return 'Password must be at least 8 characters long'
        }
        if (!/(?=.*[a-z])/.test(password)) {
            return 'Password must contain at least one lowercase letter'
        }
        if (!/(?=.*[A-Z])/.test(password)) {
            return 'Password must contain at least one uppercase letter'
        }
        if (!/(?=.*\d)/.test(password)) {
            return 'Password must contain at least one number'
        }
        return null
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setMessage(null)

        if (!token) {
            setError('Invalid reset link')
            return
        }

        const passwordError = validatePassword(password)
        if (passwordError) {
            setError(passwordError)
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        setIsLoading(true)

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token, password }),
            })

            const data = await response.json()

            if (response.ok) {
                setMessage(data.message)
                setPassword("")
                setConfirmPassword("")
                // Redirect to signin after 3 seconds
                setTimeout(() => {
                    window.location.href = '/auth/signin?reset=success'
                }, 3000)
            } else {
                setError(data.error || 'An error occurred')
            }
        } catch (error) {
            setError('Network error. Please try again.')
            console.error('Reset password error:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (!token) {
        return (
            <div className="bg-red-50 text-red-500 p-4 rounded-lg text-center">
                <p className="font-medium">Invalid Reset Link</p>
                <p className="text-sm mt-1">This password reset link is invalid or has expired.</p>
                <Link 
                    href="/auth/forgot-password" 
                    className="text-[#0066FF] hover:underline mt-2 inline-block"
                >
                    Request a new reset link
                </Link>
            </div>
        )
    }

    return (
        <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
                <Label htmlFor="password" className="block text-sm font-medium text-black">
                    New Password
                </Label>
                <div className="relative">
                    <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        className="mt-1 block w-full px-3 py-2 border bg-white rounded-xl shadow-sm focus:outline-none focus:ring-[#0066FF] focus:border-[#0066FF] pr-10"
                        placeholder="Enter new password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                    />
                    <span 
                        className="absolute inset-y-0 right-3 flex items-center text-gray-400 cursor-pointer" 
                        onClick={() => setShowPassword(!showPassword)}
                    >
                        {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368m1.671-2.195C7.523 5 12 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.832-.67 1.613-1.176 2.318M15.362 17.362A9.953 9.953 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368M3 3l18 18" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.832-.67 1.613-1.176 2.318M15.362 17.362A9.953 9.953 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368" />
                            </svg>
                        )}
                    </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    Must be at least 8 characters with uppercase, lowercase, and number
                </p>
            </div>

            <div>
                <Label htmlFor="confirmPassword" className="block text-sm font-medium text-black">
                    Confirm New Password
                </Label>
                <div className="relative">
                    <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        className="mt-1 block w-full px-3 py-2 border bg-white rounded-xl shadow-sm focus:outline-none focus:ring-[#0066FF] focus:border-[#0066FF] pr-10"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isLoading}
                    />
                    <span 
                        className="absolute inset-y-0 right-3 flex items-center text-gray-400 cursor-pointer" 
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                        {showConfirmPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368m1.671-2.195C7.523 5 12 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.832-.67 1.613-1.176 2.318M15.362 17.362A9.953 9.953 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368M3 3l18 18" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.832-.67 1.613-1.176 2.318M15.362 17.362A9.953 9.953 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368" />
                            </svg>
                        )}
                    </span>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {message && (
                <div className="bg-green-50 text-green-500 p-3 rounded-lg text-sm">
                    {message}
                    <p className="text-xs mt-1">Redirecting to sign in...</p>
                </div>
            )}

            <Button
                type="submit"
                className="w-full flex justify-center py-3 px-4 rounded-2xl shadow-sm text-base font-medium text-white bg-gradient-to-r from-[#0066FF] to-[#1E90FF] hover:from-[#0052cc] hover:to-[#3388ff] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0066FF]"
                disabled={isLoading}
            >
                {isLoading ? 'Resetting...' : 'Reset Password'}
            </Button>
        </form>
    )
}

const ResetPassword = () => {
    return (
        <div className="min-h-screen flex">
            {/* Left Panel */}
            <div className="hidden md:flex w-1/2 bg-[#0066FF] flex-col justify-center items-center text-white">
                <div className="max-w-xs text-left">
                    <div className="text-4xl font-bold mb-2">Tarana.ai</div>
                    <div className="mb-6 text-sm">Your ai-powered Baguio travel companion</div>
                    <Link href="/" className="inline-block bg-white text-[#0066FF] font-medium rounded-xl px-8 py-3 text-base shadow-md hover:bg-gray-100 transition">
                        Back to Home
                    </Link>
                </div>
            </div>
            
            {/* Right Panel */}
            <div className="flex flex-1 items-center justify-center bg-gray-100 relative">
                {/* Mobile Back to Home Button */}
                <Link href="/" className="md:hidden absolute top-4 left-4 bg-white text-[#0066FF] font-medium rounded-xl px-6 py-2 text-base shadow-md hover:bg-gray-100 transition z-10">
                    Back to Home
                </Link>
                
                <div className="w-full max-w-md space-y-8 p-10 mx-4">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h2>
                        <p className="text-sm text-gray-600 mb-6">
                            Enter your new password below.
                        </p>
                    </div>

                    <Suspense fallback={<div className="h-10">Loading...</div>}>
                        <ResetPasswordForm />
                    </Suspense>

                    <div className="text-center">
                        <Link 
                            href="/auth/signin" 
                            className="text-sm text-[#0066FF] hover:underline"
                        >
                            Back to Sign In
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ResetPassword
