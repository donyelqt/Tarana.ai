"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            
            gcTime: 10 * 60 * 1000,
            
            refetchOnWindowFocus: false,
            
            refetchOnMount: false,
            
            retry: 1,
            
            refetchOnReconnect: 'always',
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
