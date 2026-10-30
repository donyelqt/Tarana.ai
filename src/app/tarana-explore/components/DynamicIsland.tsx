"use client"

import React, { useState, useRef, useLayoutEffect, ReactNode } from "react"
import { motion } from "framer-motion"


const DI_SPRING = { type: "spring" as const, stiffness: 210, damping: 23, mass: 1 }

const COMPACT_HEIGHT = 52
const COMPACT_MIN_WIDTH = 240

export interface DynamicIslandProps {
  expanded: boolean
  children: ReactNode
  compact: ReactNode
  compactWidth?: number
  compactLabel?: string
  maxWidth?: number
  onCompactClick?: () => void
}

const DynamicIsland: React.FC<DynamicIslandProps> = ({
  expanded,
  children,
  compact,
  compactWidth = COMPACT_MIN_WIDTH,
  compactLabel = "Open search",
  maxWidth = 448,
  onCompactClick,
}) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [availW, setAvailW] = useState(maxWidth)
  const [contentH, setContentH] = useState(COMPACT_HEIGHT)
  const [clip, setClip] = useState(true)

  useLayoutEffect(() => {
    const recompute = () => {
      const vw = typeof window !== "undefined" ? window.innerWidth : maxWidth
      setAvailW(Math.min(maxWidth, Math.max(COMPACT_MIN_WIDTH, vw - 24)))
    }
    recompute()
    window.addEventListener("resize", recompute)
    return () => window.removeEventListener("resize", recompute)
  }, [maxWidth])

  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContentH(el.offsetHeight))
    ro.observe(el)
    setContentH(el.offsetHeight)
    return () => ro.disconnect()
  }, [])

  const target = expanded
    ? { width: availW, height: Math.max(contentH, COMPACT_HEIGHT) }
    : { width: Math.min(compactWidth, availW), height: COMPACT_HEIGHT }

  return (
    <motion.div
      initial={false}
      animate={{
        width: target.width,
        height: target.height,
        borderRadius: expanded ? 28 : 9999,
      }}
      transition={DI_SPRING}
      onAnimationStart={() => setClip(true)}
      onAnimationComplete={() => setClip(false)}
      className="relative mx-auto"
      style={{
        borderRadius: 9999,
        overflow: expanded ? "visible" : clip ? "hidden" : "visible",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
        border: "1px solid rgba(229,231,235,1)",
      }}
    >
      {}
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

      {}
      {!expanded && (
        <button
          type="button"
          onClick={onCompactClick}
          className="pointer-events-auto absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-gray-600"
          aria-label={compactLabel}
          style={{ borderRadius: 'inherit' }}
        >
          {compact}
        </button>
      )}
    </motion.div>
  )
}

export default DynamicIsland
