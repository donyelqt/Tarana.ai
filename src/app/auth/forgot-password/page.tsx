"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AnimatePresence, motion } from "framer-motion"

const ForgotPassword = () => {
    const [email, setEmail] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setMessage(null)
        setIsLoading(true)

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            })

            const data = await response.json()

            if (response.ok) {
                setMessage(data.message)
                setEmail("") // Clear the form
            } else {
                setError(data.error || 'An error occurred')
            }
        } catch (error) {
            setError('Network error. Please try again.')
            console.error('Forgot password error:', error)
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
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password</h2>
                        <p className="text-sm text-gray-600 mb-6">
                            Enter your email address and we'll send you a link to reset your password.
                        </p>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <Label htmlFor="email" className="block text-sm font-medium text-black">
                                Email Address
                            </Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="mt-1 block w-full px-3 py-2 border bg-white rounded-xl shadow-sm focus:outline-none focus:ring-[#0066FF] focus:border-[#0066FF]"
                                placeholder="Enter your email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {message && (
                            <div className="bg-green-50 text-green-500 p-3 rounded-lg text-sm">
                                {message}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full flex justify-center py-3 px-4 rounded-2xl shadow-sm text-base font-medium text-white bg-gradient-to-r from-[#0066FF] to-[#1E90FF] hover:from-[#0052cc] hover:to-[#3388ff] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0066FF]"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Sending...' : 'Send Reset Link'}
                        </Button>
                    </form>

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

export default ForgotPassword
