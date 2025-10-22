"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Gift, Zap, Copy, Facebook, Instagram, Linkedin } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface ReferralModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userReferralCode?: string
}

export const ReferralModal: React.FC<ReferralModalProps> = ({
  open,
  onOpenChange,
  userReferralCode = "LRG2024"
}) => {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("share")
  
  const referralLink = `https://tarana-ai/invite/${userReferralCode}`
  
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
      <DialogContent className="w-full max-w-[min(440px,calc(100vw-2rem))] sm:max-w-[480px] p-0 gap-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-6 pb-4 sm:px-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Gift className="h-5 w-5 text-blue-600" />
            </div>
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Refer Friends & Earn Credits
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-600 leading-relaxed">
            Invite friends and earn extra daily credits for Tarana Gala and Tarana Eats!
          </DialogDescription>
        </DialogHeader>

        {/* Credits Card */}
        <div className="px-5 sm:px-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 text-white relative overflow-hidden">
            {/* Background pattern effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm opacity-90 mb-1">Your Daily Credits</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">5</span>
                    <span className="text-sm opacity-90">credits/day</span>
                  </div>
                </div>
                <div className="bg-blue-600/50 p-3 rounded-full">
                  <Zap className="h-7 w-7 fill-white" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                <div>
                  <div className="text-xs opacity-75 mb-1">Base Credits</div>
                  <div className="text-2xl font-bold">5</div>
                </div>
                <div>
                  <div className="text-xs opacity-75 mb-1">Referral Bonus</div>
                  <div className="text-2xl font-bold text-yellow-300">+10</div>
                </div>
              </div>
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
            <TabsContent value="share" className="space-y-4 mt-4">
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
                    value={userReferralCode}
                    onFocus={(event) => event.target.select()}
                    className="h-10 sm:h-11 bg-gray-50 border border-gray-200 text-xs sm:text-sm font-mono text-gray-700"
                    aria-label="Referral code"
                  />
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => copyToClipboard(userReferralCode, "Code")}
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
            </TabsContent>

            {/* Credit Tiers Tab */}
            <TabsContent value="credit-tiers" className="space-y-3 mt-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Credit Tier System</h3>
                <p className="text-sm text-gray-600">
                  Earn more credits as you refer more friends! Each active referral increases your daily credit bonus.
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                    <span className="text-sm font-medium">0-2 referrals</span>
                    <span className="text-sm text-blue-600 font-semibold">+5 credits/day</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                    <span className="text-sm font-medium">3-5 referrals</span>
                    <span className="text-sm text-blue-600 font-semibold">+10 credits/day</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                    <span className="text-sm font-medium">6+ referrals</span>
                    <span className="text-sm text-blue-600 font-semibold">+15 credits/day</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-3 mt-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Recent Activity</h3>
                <p className="text-sm text-gray-600 mb-4">Track your referrals and earned credits</p>
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <Gift className="h-12 w-12 mx-auto opacity-50" />
                  </div>
                  <p className="text-sm text-gray-500">No activity yet</p>
                  <p className="text-xs text-gray-400 mt-1">Start referring friends to see activity here</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Bottom Cards */}
        <div className="px-6 pb-6 pt-2">
          <div className="grid grid-cols-2 gap-3">
            {/* Smart Plans Card */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="bg-blue-600 rounded-lg p-2 w-fit mb-2">
                <Gift className="h-5 w-5 text-white" />
              </div>
              <h4 className="font-semibold text-sm text-gray-900 mb-1">Smart Plans</h4>
              <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                Use credits to generate AI-powered itineraries tailored to your preferences
              </p>
              <p className="text-xs text-blue-600 font-semibold">
                1 credit = 1 plan generation
              </p>
            </div>

            {/* Tarana Eats Card */}
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <div className="bg-orange-500 rounded-lg p-2 w-fit mb-2">
                <Gift className="h-5 w-5 text-white" />
              </div>
              <h4 className="font-semibold text-sm text-gray-900 mb-1">Tarana Eats</h4>
              <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                Unlock personalized restaurant recommendations and food guides
              </p>
              <p className="text-xs text-orange-600 font-semibold">
                1 credit = 1 food guide
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
