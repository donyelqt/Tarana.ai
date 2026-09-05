"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

function safeCallbackUrl(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

function ConsentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useSession();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = safeCallbackUrl(searchParams?.get("callbackUrl"));

  const handleAccept = async () => {
    setBusy("accept");
    setError(null);
    try {
      const response = await fetch("/api/auth/consent", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not record acceptance");
      }
      // Refresh the JWT so the tosAccepted claim takes effect without re-login.
      try {
        await update();
      } catch {
        // Non-fatal: middleware re-checks on the next navigation.
      }
      router.push(callbackUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(null);
    }
  };

  const handleDecline = async () => {
    setBusy("decline");
    await signOut({ callbackUrl: "/" });
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="h-1 w-8 rounded-full bg-blue-600" />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900">
          Before you continue <span className="text-blue-600">— Tarana.ai</span>
        </h1>
        <p className="mt-6 text-sm leading-6 text-gray-600">
          To use Tarana.ai, please accept our Terms of Service and Privacy Policy.
          This keeps your account, itineraries, and credits covered by the same
          agreement as everyone else — including accounts created with Google sign-in.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            href="/terms"
            className="rounded-full bg-blue-50 px-5 py-2 font-medium text-[#0066FF] transition hover:bg-blue-100"
          >
            Read Terms of Service
          </Link>
          <Link
            href="/privacy"
            className="rounded-full bg-blue-50 px-5 py-2 font-medium text-[#0066FF] transition hover:bg-blue-100"
          >
            Read Privacy Policy
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-500">
            {error}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleAccept}
            disabled={busy !== null}
            className="flex-1 rounded-2xl bg-gradient-to-r from-[#0066FF] to-[#1E90FF] px-4 py-3 text-base font-medium text-white shadow-sm transition hover:from-[#0052cc] hover:to-[#3388ff] focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:ring-offset-2 disabled:opacity-60"
          >
            {busy === "accept" ? "Recording…" : "Accept and continue"}
          </button>
          <button
            type="button"
            onClick={handleDecline}
            disabled={busy !== null}
            className="flex-1 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-base font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-60"
          >
            {busy === "decline" ? "Signing out…" : "Decline and sign out"}
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-gray-500">
          Declining signs you out and returns you to the home page. You can
          accept at any time by signing in again.
        </p>
      </div>
    </main>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white p-10">Loading…</div>}>
      <ConsentForm />
    </Suspense>
  );
}
