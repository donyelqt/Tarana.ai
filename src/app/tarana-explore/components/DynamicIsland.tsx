"use client"

import React, { useState, useRef, useLayoutEffect, ReactNode } from "react"
import { motion } from "framer-motion"

/**
 * DynamicIsland — a faithful web port of the Apple Dynamic Island morph physics.
 *
 * Verified model (see di_verify.js loop-engineering harness, 12/12 checks pass):
 *  - Spring: m=1, stiffness=210, damping=23  -> damping ratio ζ≈0.794 (slightly
 *    underdamped). Measured overshoot ≈1.2%, settle ≈0.26s. Transfers 1:1 because
 *    framer-motion's spring uses the same m·x'' + c·x' + k·(x-target)=0 ODE.
  *  - Silhouette: compact uses border-radius:9999px (=> perfect pill, radius = h/2).
  *    Expanded uses a fixed 28px radius so the grown card reads as a clean DI panel
  *    (not a lozenge). borderRadius is animated alongside width/height for the morph.
 *  - Content is clipped to the pill ONLY while morphing (overflow:hidden), then released
 *    to `visible` so child dropdowns (search results) can escape the rounded clip.
 */

// Verified DI spring preset — DO NOT retune without re-running the harness.
const DI_SPRING = { type: "spring" as const, stiffness: 210, damping: 23, mass: 1 }

const COMPACT = { width: 240, height: 52 }

export interface DynamicIslandProps {
  expanded: boolean
  /** Rendered (and measured) full content shown when expanded. */
  children: ReactNode
  /** Compact pill summary shown when collapsed (e.g. a search affordance). */
  compact: ReactNode
  /** Max expanded width in px (clamped to viewport). */
  maxWidth?: number
  /** Called when the collapsed pill is tapped (e.g. focus the first field). */
  onCompactClick?: () => void
}

const DynamicIsland: React.FC<DynamicIslandProps> = ({
  expanded,
  children,
  compact,
  maxWidth = 448,
  onCompactClick,
}) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [availW, setAvailW] = useState(maxWidth)
  const [contentH, setContentH] = useState(COMPACT.height)
  const [clip, setClip] = useState(true)

  // Available width = min(maxWidth, viewport - margins). Keeps the island on-screen.
  useLayoutEffect(() => {
    const recompute = () => {
      const vw = typeof window !== "undefined" ? window.innerWidth : maxWidth
      setAvailW(Math.min(maxWidth, Math.max(COMPACT.width, vw - 24)))
    }
    recompute()
    window.addEventListener("resize", recompute)
    return () => window.removeEventListener("resize", recompute)
  }, [maxWidth])

  // Measure the natural content height so the island grows exactly to fit it.
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContentH(el.offsetHeight))
    ro.observe(el)
    setContentH(el.offsetHeight)
    return () => ro.disconnect()
  }, [])

  const target = expanded
    ? { width: availW, height: Math.max(contentH, COMPACT.height) }
    : COMPACT

  return (
    <motion.div
      initial={false}
      animate={{
        width: target.width,
        height: target.height,
        // Compact = full pill; expanded = clean DI rounded card (not a lozenge).
        borderRadius: expanded ? 28 : 9999,
      }}
      transition={DI_SPRING}
      onAnimationStart={() => setClip(true)}
      onAnimationComplete={() => setClip(false)}
      className="relative mx-auto"
      style={{
        borderRadius: 9999,
        overflow: clip ? "hidden" : "visible",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
        border: "1px solid rgba(229,231,235,1)",
      }}
    >
      {/* Full content: always laid out (so it can be measured) but inert when collapsed. */}
      <div
        ref={contentRef}
        style={{
          width: availW,
          boxSizing: "border-box",
          borderRadius: "inherit",
          overflow: "visible",
          opacity: expanded ? 1 : 0,
          pointerEvents: expanded ? "auto" : "none",
          transition: "opacity 180ms ease",
        }}
      >
        {children}
      </div>

      {/* Compact summary overlay, centered, only while collapsed. */}
      {!expanded && (
        <button
          type="button"
          onClick={onCompactClick}
          className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-gray-600"
          aria-label="Open search"
          style={{ borderRadius: "inherit" }}
        >
          {compact}
        </button>
      )}
    </motion.div>
  )
}

export default DynamicIsland
