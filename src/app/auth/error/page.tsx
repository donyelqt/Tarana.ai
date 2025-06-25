"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"

const errorMessages: { [key: string]: string } = {
  AccessDenied:
    "Access Denied. You have not granted the necessary permissions to sign in. Please try again.",
  Configuration:
    "There is a problem with the server configuration. Please contact support.",
  Verification:
    "The token could not be verified. Please try signing in again.",
  Default: "Sorry, we were unable to sign you in. Please try again.",
}

const AuthErrorPage = () => {
  const searchParams = useSearchParams()
  const error = searchParams.get("error") || "Default"
  const errorMessage =
    errorMessages[error as keyof typeof errorMessages] || errorMessages.Default

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-md rounded-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Authentication Error
        </h1>
        <p className="text-gray-700 mb-6">{errorMessage}</p>
        <Link
          href="/auth/signin"
          className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Return to Sign In
        </Link>
      </div>
    </div>
  )
}

export default AuthErrorPage 