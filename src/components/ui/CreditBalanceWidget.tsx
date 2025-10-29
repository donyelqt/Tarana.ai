"use client"

import React, { useState, useEffect } from 'react'
import { Zap, RefreshCw, Info } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/core/utils'

interface CreditBalance {
  totalCredits: number
  usedToday: number
  remainingToday: number
  tier: string
  nextRefresh: string
  dailyLimit: number
}

interface CreditBalanceWidgetProps {
  className?: string
  compact?: boolean
  showDetails?: boolean
  onRefresh?: () => void
}

export const CreditBalanceWidget: React.FC<CreditBalanceWidgetProps> = ({
  className,
  compact = false,
  showDetails = true,
  onRefresh,
}) => {
  const { data: session } = useSession()
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = async () => {
    if (!session?.user) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/credits/balance')
      if (response.ok) {
        const data = await response.json()
        setBalance(data.balance)
        setError(null)
      } else {
        setError('Failed to load credits')
      }
    } catch (err) {
      console.error('Error fetching credit balance:', err)
      setError('Error loading credits')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalance()
    // Refresh every minute to keep balance updated
    const interval = setInterval(fetchBalance, 60000)
    return () => clearInterval(interval)
  }, [session])

  const handleRefresh = () => {
    fetchBalance()
    onRefresh?.()
  }

  if (!session?.user) {
    return null
  }

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 p-3 bg-gray-100 rounded-lg animate-pulse', className)}>
        <div className="h-8 w-8 bg-gray-300 rounded-full" />
        <div className="flex-1">
          <div className="h-4 bg-gray-300 rounded w-20 mb-1" />
          <div className="h-3 bg-gray-300 rounded w-16" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg', className)}>
        <Info className="h-4 w-4" />
        <span className="text-sm">{error}</span>
      </div>
    )
  }

  if (!balance) {
    return null
  }

  const percentage = (balance.remainingToday / balance.totalCredits) * 100
  const getColorClasses = () => {
    if (percentage > 50) return 'bg-green-500'
    if (percentage > 25) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 p-2 bg-blue-50 rounded-lg', className)}>
        <div className="relative">
          <Zap className="h-5 w-5 text-blue-600 fill-blue-600" />
          {balance.remainingToday === 0 && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-blue-900 text-sm">
            {balance.remainingToday} / {balance.totalCredits}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200', className)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Zap className="h-5 w-5 text-white fill-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Daily Credits</h3>
            <p className="text-xs text-gray-600">{balance.tier} Tier</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="p-1 hover:bg-blue-200 rounded-md transition-colors"
          title="Refresh balance"
        >
          <RefreshCw className="h-4 w-4 text-blue-600" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Credit Display */}
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-gray-900">
            {balance.remainingToday}
          </span>
          <span className="text-lg text-gray-600 mb-1">
            / {balance.totalCredits}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn('h-full transition-all duration-300', getColorClasses())}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>{balance.usedToday} used</span>
            <span>{balance.remainingToday} remaining</span>
          </div>
        </div>

        {showDetails && (
          <>
            {/* Next Refresh */}
            <div className="pt-3 border-t border-blue-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Next refresh</span>
                <span className="font-medium text-gray-900">
                  {new Date(balance.nextRefresh).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            {/* Low Credit Warning */}
            {balance.remainingToday <= 1 && balance.remainingToday > 0 && (
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  ⚠️ Low credits! Invite friends to earn more daily credits.
                </p>
              </div>
            )}

            {/* No Credits Warning */}
            {balance.remainingToday === 0 && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-800">
                  🚫 No credits remaining. Credits refresh at midnight or invite friends for more!
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default CreditBalanceWidget
