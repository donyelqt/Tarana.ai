"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'

/**
 * React Query Provider with optimized caching configuration
 * 
 * Cache Strategy:
 * - staleTime: 5 minutes - Data considered fresh for 5 minutes
 * - cacheTime: 10 minutes - Unused data kept in memory for 10 minutes
 * - refetchOnWindowFocus: false - Don't refetch when user returns to tab
 * - retry: 1 - Only retry failed requests once to avoid excessive Supabase calls
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data stays fresh for 5 minutes (no refetch needed)
            staleTime: 5 * 60 * 1000,
            
            // Cached data kept in memory for 10 minutes after last use (renamed from cacheTime in v5)
            gcTime: 10 * 60 * 1000,
            
            // Don't refetch when user switches back to browser tab
            refetchOnWindowFocus: false,
            
            // Don't refetch when component mounts if data exists
            refetchOnMount: false,
            
            // Retry failed requests only once
            retry: 1,
            
            // Use cache while revalidating in background
            refetchOnReconnect: 'always',
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
