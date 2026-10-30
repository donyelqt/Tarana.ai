"use client"

import { useMemo } from "react"

type SparkleVariant = "blue" | "white"

interface GeminiSparklesProps {
  variant?: SparkleVariant
  count?: number
  minSize?: number
  maxSize?: number
  className?: string
}

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function GeminiSparkles({
  variant = "blue",
  count = 40,
  minSize = 3,
  maxSize = 8,
  className = "",
}: GeminiSparklesProps) {
  const dots = useMemo(() => {
    const rng = seededRandom(42)
    const arr: { key: number; x: number; y: number; size: number; delay: number; opacity: number }[] = []
    for (let i = 0; i < count; i++) {
      arr.push({
        key: i,
        x: rng() * 100,
        y: rng() * 100,
        size: minSize + rng() * (maxSize - minSize),
        delay: rng() * 6,
        opacity: 0.18 + rng() * 0.45,
      })
    }
    return arr
  }, [count, minSize, maxSize])

  const isWhite = variant === "white"

  return (
    <div
      className={`gemini-sparkles ${className}`}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {dots.map((dot) => {
        const color = isWhite
          ? `rgba(255,255,255,${dot.opacity})`
          : `rgba(96,165,250,${dot.opacity})`

        return (
          <span
            key={dot.key}
            className="gemini-dot"
            style={{
              position: "absolute",
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              width: dot.size,
              height: dot.size,
              borderRadius: "50%",
              backgroundColor: color,
              boxShadow: isWhite
                ? `0 0 ${dot.size * 2}px rgba(255,255,255,${dot.opacity * 0.8})`
                : `0 0 ${dot.size * 2.5}px rgba(96,165,250,${dot.opacity * 0.9}), 0 0 ${dot.size * 5}px rgba(37,99,235,${dot.opacity * 0.4})`,
              animationDelay: `${dot.delay}s`,
              animationDuration: `${4 + (dot.delay % 4)}s`,
              willChange: "transform, opacity",
            }}
          />
        )
      })}
    </div>
  )
}

interface FadingDotGridProps {
  dotColor?: string
  dotSize?: number
  gap?: number
  widthFraction?: number
  heightFraction?: number
  corner?: "top-right" | "top-left"
  className?: string
}

export function FadingDotGrid({
  dotColor = "#93c5fd",
  dotSize = 3,
  gap = 14,
  widthFraction = 0.55,
  heightFraction = 0.6,
  corner = "top-right",
  className = "",
}: FadingDotGridProps) {
  const dotPattern = useMemo(() => {
    const half = dotSize / 2
    return `radial-gradient(circle at ${half}px ${half}px, ${dotColor} ${half}px, transparent ${half}px)`
  }, [dotColor, dotSize])

  const isLeft = corner === "top-left"

  const style: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: isLeft ? 0 : "auto",
    right: isLeft ? "auto" : 0,
    width: `${widthFraction * 100}%`,
    height: `${heightFraction * 100}%`,
    backgroundImage: dotPattern,
    backgroundSize: `${gap}px ${gap}px`,
    backgroundPosition: isLeft ? "top left" : "top right",
    backgroundRepeat: "repeat",
    WebkitMaskImage: isLeft
      ? "radial-gradient(ellipse 70% 70% at 30% 20%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)"
      : "radial-gradient(ellipse 70% 70% at 70% 20%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)",
    maskImage: isLeft
      ? "radial-gradient(ellipse 70% 70% at 30% 20%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)"
      : "radial-gradient(ellipse 70% 70% at 70% 20%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)",
    pointerEvents: "none",
    zIndex: 0,
  }

  return <div aria-hidden="true" className={className} style={style} />
}

