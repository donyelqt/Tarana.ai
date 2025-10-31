"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export interface CreditBalance {
  totalCredits: number;
  usedToday: number;
  remainingToday: number;
  tier: string;
  nextRefresh: string;
  dailyLimit: number;
}

interface UseCreditBalanceOptions {
  refetchIntervalMs?: number;
}

export const useCreditBalance = (
  options: UseCreditBalanceOptions = {}
) => {
  const { data: session, status } = useSession();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!session?.user?.id) {
      setBalance(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/credits/balance");

      if (!response.ok) {
        throw new Error("Failed to fetch credit balance");
      }

      const data = await response.json();
      setBalance(data.balance ?? null);
      setError(null);
    } catch (err) {
      console.error("Error fetching credit balance:", err);
      setError(err instanceof Error ? err.message : "Unable to load credits");
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (status !== "authenticated") {
      setBalance(null);
      return;
    }

    fetchBalance();
  }, [status, fetchBalance]);

  useEffect(() => {
    if (!options.refetchIntervalMs || status !== "authenticated") {
      return;
    }

    const interval = setInterval(fetchBalance, options.refetchIntervalMs);

    return () => clearInterval(interval);
  }, [fetchBalance, options.refetchIntervalMs, status]);

  return {
    balance,
    isLoading,
    error,
    refetch: fetchBalance,
    hasCredits: (requiredCredits: number = 1) => {
      if (!balance) return false;
      return balance.remainingToday >= requiredCredits;
    },
  };
};
