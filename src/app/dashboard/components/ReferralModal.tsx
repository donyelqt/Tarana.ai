"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Gift, Zap, Copy, Facebook, Instagram, Linkedin, Loader2, Sparkles, Utensils } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { CreditTiersContent } from "@/components/ui/credit-tiers-content"
import { useSession } from "next-auth/react"
import type { UserTier } from "@/lib/referral-system/types"

interface ReferralModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userReferralCode?: string
}

interface ReferralStats {
  totalReferrals: number
  activeReferrals: number
  currentTier: string
  nextTierRequirement: number
  totalBonusCredits: number
  recentReferrals: any[]
}

interface CreditBalance {
  totalCredits: number
  usedToday: number
  remainingToday: number
  tier: string
  dailyLimit: number
}

export const ReferralModal: React.FC<ReferralModalProps> = ({
  open,
  onOpenChange,
  userReferralCode: propReferralCode
}) => {
  const { toast } = useToast()
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState("share")
  const [loading, setLoading] = useState(true)
  const [referralCode, setReferralCode] = useState(propReferralCode || "")
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  
  // Fetch referral data when modal opens
  useEffect(() => {
    if (open && session?.user) {
      fetchReferralData()
    }
  }, [open, session])

  const fetchReferralData = async () => {
    setLoading(true)
    try {
      // Fetch referral stats and credit balance in parallel
      const [statsRes, balanceRes] = await Promise.all([
        fetch('/api/referrals/stats'),
        fetch('/api/credits/balance')
      ])

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData.stats)
        setReferralCode(statsData.referralCode || propReferralCode || "")
      }

      if (balanceRes.ok) {
        const balanceData = await balanceRes.json()
        setBalance(balanceData.balance)
      }
    } catch (error) {
      console.error('Error fetching referral data:', error)
      toast({
        title: "Error",
        description: "Failed to load referral data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  const referralLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/signup?ref=${referralCode}`
  
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: `${type} copied to clipboard`,
      duration: 2000,
    })
  }

  const shareOnSocial = (platform: string) => {
    const message = encodeURIComponent("Join me on Tarana AI! Use my referral code to get bonus credits.")
    const url = encodeURIComponent(referralLink)
    
    const urls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      instagram: `https://www.instagram.com/`, // Instagram doesn't support direct sharing URLs
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
    }
    
    window.open(urls[platform as keyof typeof urls], '_blank', 'width=600,height=400')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg p-0 gap-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-6 pb-4 sm:px-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Gift className="h-5 w-5 text-blue-600" />
            </div>
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Credit Tier System
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-600 leading-relaxed">
            Invite friends and earn extra daily credits for Tarana Gala and Tarana Eats!
          </DialogDescription>
        </DialogHeader>

        {/* Credits Card */}
        <div className="px-5 sm:px-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-blue-700 to-blue-500 p-5 text-white shadow-[0_18px_35px_-18px_rgba(37,99,235,0.7)]">
            {/* Background pattern effect */}
            <div className="absolute top-0 right-0 h-32 w-32 -translate-y-16 translate-x-16 rounded-full bg-white/10" />
            <div className="absolute bottom-0 left-0 h-24 w-24 translate-y-12 -translate-x-12 rounded-full bg-white/10" />

            <div className="relative z-10">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm opacity-90 mb-1">Your Daily Credits</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold">{balance?.totalCredits || 5}</span>
                        <span className="text-sm opacity-90">credits/day</span>
                      </div>
                      <div className="text-xs opacity-75 mt-1">
                        {balance?.remainingToday || 0} remaining today
                      </div>
                    </div>
                    <div className="bg-blue-600/50 p-3 rounded-full">
                      <Zap className="h-7 w-7 fill-white" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                    <div>
                      <div className="text-xs opacity-75 mb-1">Current Tier</div>
                      <div className="text-lg font-bold">{balance?.tier || 'Default'}</div>
                    </div>
                    <div>
                      <div className="text-xs opacity-75 mb-1">Active Referrals</div>
                      <div className="text-lg font-bold text-yellow-300">{stats?.activeReferrals || 0}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4 sm:px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="share" className="flex-1">Share</TabsTrigger>
              <TabsTrigger value="credit-tiers" className="flex-1">Credit Tiers</TabsTrigger>
              <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
            </TabsList>

            {/* Share Tab */}
            <TabsContent value="share" className="space-y-4 mt-4 pb-6">
              {/* Referral Link */}
              <div>
                <label className="text-sm font-semibold text-gray-900 mb-2 block">
                  Your Referral Link
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <Input
                    readOnly
                    value={referralLink}
                    onFocus={(event) => event.target.select()}
                    className="h-10 sm:h-11 bg-gray-50 border border-gray-200 text-xs sm:text-sm font-mono text-gray-700"
                    aria-label="Referral link"
                  />
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => copyToClipboard(referralLink, "Link")}
                    className="w-full sm:w-auto sm:flex-shrink-0 h-10 text-sm"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>

              {/* Referral Code */}
              <div>
                <label className="text-sm font-semibold text-gray-900 mb-2 block">
                  Referral Code
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <Input
                    readOnly
                    value={referralCode}
                    onFocus={(event) => event.target.select()}
                    className="h-10 sm:h-11 bg-gray-50 border border-gray-200 text-xs sm:text-sm font-mono text-gray-700"
                    aria-label="Referral code"
                  />
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => copyToClipboard(referralCode, "Code")}
                    className="w-full sm:w-auto sm:flex-shrink-0 h-10 text-sm"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Your friends can use this code during signup to get their welcome bonus
                </p>
              </div>

              {/* Social Media Share */}
              <div>
                <label className="text-sm font-semibold text-gray-900 mb-3 block">
                  Share on Social Media
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button
                    variant="outline"
                    className="w-full justify-center sm:justify-start h-10 text-sm"
                    onClick={() => shareOnSocial('facebook')}
                  >
                    <Facebook className="h-4 w-4 mr-2 sm:h-5 sm:w-5" />
                    Facebook
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-center sm:justify-start h-10 text-sm"
                    onClick={() => shareOnSocial('instagram')}
                  >
                    <Instagram className="h-4 w-4 mr-2 sm:h-5 sm:w-5" />
                    Instagram
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-center sm:justify-start h-10 text-sm"
                    onClick={() => shareOnSocial('linkedin')}
                  >
                    <Linkedin className="h-4 w-4 mr-2 sm:h-5 sm:w-5" />
                    LinkedIn
                  </Button>
                </div>
              </div>

              {/* How It Works */}
              <div className="bg-blue-50 rounded-xl p-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-blue-600 rounded-lg">
                    <Gift className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900">How It Works</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      1
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">Share your link</div>
                      <div className="text-xs text-gray-600">Send your unique referral link to friends</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      2
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">Friend signs up</div>
                      <div className="text-xs text-gray-600">They create an account and get +2 bonus daily credits</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      3
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">You earn credits</div>
                      <div className="text-xs text-gray-600">Get +5 bonus daily credits for each active friend</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Credit Usage Containers */}
              <div className="grid grid-cols-1 gap-3 mt-4 sm:grid-cols-2">
                {/* Smart Plans Container */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-blue-600 rounded-lg flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-base">Smart Plans</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                    Use credits to generate AI-powered itineraries tailored to your preferences
                  </p>
                  <div className="text-sm font-medium text-blue-600">
                    1 credit = 1 plan generation
                  </div>
                </div>

                {/* Tarana Eats Container */}
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-orange-500 rounded-lg flex-shrink-0">
                      <Utensils className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-base">Tarana Eats</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                    Unlock personalized restaurant recommendations and food guides
                  </p>
                  <div className="text-sm font-medium text-orange-600">
                    1 credit = 1 food guide
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Credit Tiers Tab */}
            <TabsContent value="credit-tiers" className="space-y-3 mt-4">
              <CreditTiersContent
                loading={loading}
                activeReferrals={stats?.activeReferrals}
                currentTier={(balance?.tier || stats?.currentTier) as UserTier | undefined}
              />
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-4 mt-4">
              {/* Referral Statistics */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Referral Statistics</h3>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-3 px-4 bg-white border border-gray-100 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">Total Referrals</div>
                        <div className="text-xs text-gray-500">All time</div>
                      </div>
                      <div className="text-blue-600 text-2xl font-bold">
                        {stats?.totalReferrals || 0}
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-3 px-4 bg-white border border-gray-100 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">Active Referrals</div>
                        <div className="text-xs text-gray-500">Currently active</div>
                      </div>
                      <div className="text-green-600 text-2xl font-bold">
                        {stats?.activeReferrals || 0}
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-3 px-4 bg-white border border-gray-100 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">Current Tier</div>
                        <div className="text-xs text-gray-500">Your membership level</div>
                      </div>
                      <div className="text-purple-600 text-lg font-bold">
                        {stats?.currentTier || 'Default'}
                      </div>
                    </div>

                    {stats && stats.nextTierRequirement > 0 && (
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          Next Tier Progress
                        </div>
                        <div className="text-xs text-gray-600">
                          Refer {stats.nextTierRequirement} more friend{stats.nextTierRequirement !== 1 ? 's' : ''} to unlock the next tier!
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* How Credits Work */}
              <div className="bg-blue-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">How Credits Work</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-700">Everyone starts with 5 free credits per day</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-700">Earn bonus credits/day for each active referred friend</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-700">Credits refresh daily at midnight</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-700">Unused credits don't roll over to the next day</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-700">Credits can be used for Tarana Gala and Tarana Eats</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>


      </DialogContent>
    </Dialog>
  )
}
