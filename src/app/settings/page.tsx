'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  image: string;
  location: string;
  bio: string;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);
  
  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (status !== 'authenticated') return;
      
      try {
        const response = await fetch('/api/profile');
        const data = await response.json();
        
        if (data.success && data.profile) {
          setProfile(data.profile);
          setFullName(data.profile.fullName);
          setLocation(data.profile.location);
          setBio(data.profile.bio);
        } else {
          toast({
            title: 'Error',
            description: 'Failed to load profile',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to load profile',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [status, toast]);

  // Track changes
  useEffect(() => {
    if (!profile) return;
    
    const changed = 
      fullName !== profile.fullName ||
      location !== profile.location ||
      bio !== profile.bio;
    
    setHasChanges(changed);
  }, [fullName, location, bio, profile]);

  // Handle save
  const handleSave = async () => {
    if (!hasChanges) return;
    
    // Validation
    if (!fullName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Full name is required',
        variant: 'destructive',
      });
      return;
    }

    if (fullName.length > 100) {
      toast({
        title: 'Validation Error',
        description: 'Full name must be less than 100 characters',
        variant: 'destructive',
      });
      return;
    }

    if (location.length > 200) {
      toast({
        title: 'Validation Error',
        description: 'Location must be less than 200 characters',
        variant: 'destructive',
      });
      return;
    }

    if (bio.length > 500) {
      toast({
        title: 'Validation Error',
        description: 'Bio must be less than 500 characters',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          location: location.trim(),
          bio: bio.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setProfile(data.profile);
        setHasChanges(false);
        toast({
          title: 'Success',
          description: 'Profile updated successfully',
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to update profile',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state
  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar />
        <main className="md:pl-72 flex-1 px-4 sm:px-6 md:px-8 py-6 md:py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content - add left padding on desktop to accommodate fixed sidebar */}
      <main className="md:pl-72 flex-1 bg-[#f7f9fb] px-4 sm:px-6 md:px-8 py-6 md:py-8">
        <div className="min-h-screen">
          <div className="max-w-6xl mx-auto w-full">
            {/* Page Title */}
            <div className="mb-6">
              <div className="bg-white w-full md:w-auto rounded-3xl px-5 sm:px-6 py-3 inline-flex items-center font-bold text-lg sm:text-xl md:text-2xl text-gray-900 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60 transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)]">
                Settings
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Profile Settings */}
              <div className="lg:col-span-2 space-y-6">
                {/* Profile Settings Card */}
                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60 transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)]">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Profile Settings</h2>

                  <div className="space-y-6">
                    {/* Avatar and Full Name */}
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                        <img
                          src={session?.user?.image || profile?.image || '/api/placeholder/64/64'}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Enter your full name"
                          maxLength={100}
                          className="w-full px-3 py-2 text-gray-900 bg-transparent border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 placeholder:text-gray-400 transition-shadow"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          {fullName.length}/100 characters
                        </div>
                      </div>
                    </div>

                    {/* Email Address */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={profile?.email || ''}
                        disabled
                        className="w-full px-3 py-2 text-gray-500 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-0 cursor-not-allowed"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Email cannot be changed
                      </div>
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Location
                      </label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g., Baguio City, Philippines"
                        maxLength={200}
                        className="w-full px-3 py-2 text-gray-900 bg-transparent border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 placeholder:text-gray-400 transition-shadow"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {location.length}/200 characters
                      </div>
                    </div>

                    {/* Bio */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Bio
                      </label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        rows={3}
                        maxLength={500}
                        className="w-full px-3 py-2 text-gray-900 bg-transparent border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-none placeholder:text-gray-400 transition-shadow"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {bio.length}/500 characters
                      </div>
                    </div>
                  </div>

                  {/* Save Changes Button */}
                  <div className="flex justify-end mt-8">
                    <button 
                      onClick={handleSave}
                      disabled={!hasChanges || isSaving}
                      className={`bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 py-3 rounded-xl font-medium shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 flex items-center gap-2 ${
                        (!hasChanges || isSaving) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                  </div>
                </div>

                {/* Notification Settings Card */}
                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60 transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)]">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Notification Settings</h2>

                  <div className="space-y-6">
                    {/* Email Notifications */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">Email Notifications</h3>
                        <p className="text-sm text-gray-600 mt-1">Receive updates about your trips via email</p>
                      </div>
                      <button
                        onClick={() => setEmailNotifications(!emailNotifications)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${emailNotifications ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        role="switch"
                        aria-checked={emailNotifications}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${emailNotifications ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                      </button>
                    </div>

                    {/* In-App Notifications */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">In-App Notifications</h3>
                        <p className="text-sm text-gray-600 mt-1">Receive notifications within the app</p>
                      </div>
                      <button
                        onClick={() => setInAppNotifications(!inAppNotifications)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${inAppNotifications ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        role="switch"
                        aria-checked={inAppNotifications}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${inAppNotifications ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Widgets */}
              <div className="space-y-6">
                {/* Baguio Weather Widget */}
                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60 transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)]">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Baguio Weather</h3>
                  <div className="flex items-center gap-3">
                    <Sun className="w-8 h-8 text-yellow-500" />
                    <div>
                      <div className="text-2xl font-semibold text-gray-900">18° C</div>
                      <div className="text-sm text-gray-600">Sunny</div>
                    </div>
                  </div>
                </div>

                {/* Recommended For You */}
                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60 transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)]">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommended For You</h3>
                  <div className="space-y-4">
                    <div className="bg-gray-200 rounded-2xl h-40 flex items-center justify-center">
                      <span className="text-gray-500 font-medium">Ad Space</span>
                    </div>
                    <div className="bg-gray-200 rounded-2xl h-40 flex items-center justify-center">
                      <span className="text-gray-500 font-medium">Ad Space</span>
                    </div>
                  </div>
                </div>

                {/* Upcoming Events */}
                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60 transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)]">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Events</h3>
                  <div className="bg-gray-200 rounded-2xl h-40 flex items-center justify-center">
                    <span className="text-gray-500 font-medium">Coming Soon</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
