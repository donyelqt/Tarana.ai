"use client"

import { useState } from "react"
import Link from "next/link"

const SignUp = () => {
    const [fullName, setFullName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        // Handle sign up logic here
        console.log({ fullName, email, password, confirmPassword })
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
            <div className="flex flex-1 items-center justify-center bg-gray-50">
                <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-3xl shadow-lg mx-4">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Tarana.ai</h2>
                        <p className="text-sm text-gray-600 mb-6">Please Sign up to Continue</p>
                        <div className="flex justify-center mb-6">
                            <Link href="/auth/signin" className="px-8 py-2 rounded-full bg-blue-50 text-[#0066FF] font-medium hover:bg-blue-100 transition">Login</Link>
                            <button type="button" className="px-8 py-2 rounded-full bg-[#0066FF] text-white font-medium shadow-md focus:outline-none ml-2">Register</button>
                        </div>
                    </div>
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">Full Name</label>
                                <input
                                    id="fullName"
                                    name="fullName"
                                    type="text"
                                    autoComplete="name"
                                    required
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-[#0066FF] focus:border-[#0066FF]"
                                    placeholder="Enter your Full Name"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-[#0066FF] focus:border-[#0066FF]"
                                    placeholder="Enter your Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-[#0066FF] focus:border-[#0066FF] pr-10"
                                        placeholder="Enter your Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <span className="absolute inset-y-0 right-3 flex items-center text-gray-400 cursor-pointer">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.832-.67 1.613-1.176 2.318M15.362 17.362A9.953 9.953 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368" /></svg>
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm Password</label>
                                <div className="relative">
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-[#0066FF] focus:border-[#0066FF] pr-10"
                                        placeholder="Re-enter your Password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                    <span className="absolute inset-y-0 right-3 flex items-center text-gray-400 cursor-pointer">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.832-.67 1.613-1.176 2.318M15.362 17.362A9.953 9.953 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368" /></svg>
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full flex justify-center py-3 px-4 rounded-2xl shadow-sm text-base font-medium text-white bg-gradient-to-r from-[#0066FF] to-[#1E90FF] hover:from-[#0052cc] hover:to-[#3388ff] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0066FF] mt-2"
                        >
                            Create Account
                        </button>
                        <div className="text-center">
                            <p className="text-sm text-gray-600">
                                Already have an account?{' '}
                                <Link href="/auth/signin" className="font-medium text-[#0066FF] hover:text-[#0066FF]/80">Sign in</Link>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default SignUp