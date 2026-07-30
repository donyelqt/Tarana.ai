"use client"

import { useEffect, useState } from "react"

type SectionBackground = "white" | "blue"

const StickyDots = () => {
    const [topRightColor, setTopRightColor] = useState<SectionBackground>("white")
    const [bottomLeftColor, setBottomLeftColor] = useState<SectionBackground>("white")

    useEffect(() => {
        const sectionIds = [
            "hero",
            "how-it-works",
            "why-use",
            "travelers",
        ]

        const sectionBgs: Record<string, SectionBackground> = {
            "hero": "white",
            "how-it-works": "blue",
            "why-use": "white",
            "travelers": "white",
        }

        // Directly check which section a given y-coordinate falls into.
        // This is independent of overlays, pointer-events, or z-index stacking.
        const getSectionAtY = (y: number): SectionBackground | null => {
            for (const id of sectionIds) {
                const el = document.getElementById(id)
                if (!el) continue
                const rect = el.getBoundingClientRect()
                if (y >= rect.top && y <= rect.bottom) {
                    return sectionBgs[id]
                }
            }
            return null
        }

        const handleScroll = () => {
            // Top-right dot grid: use a y-coordinate near the top of the viewport
            // where the top-right grid sits (well above any section content)
            const topRightY = 48
            const topRightBg = getSectionAtY(topRightY)
            if (topRightBg) {
                setTopRightColor((prev) => (prev !== topRightBg ? topRightBg : prev))
            }

            // Bottom-left dot grid: use a y-coordinate near the bottom of the viewport
            // where the bottom-left grid sits
            const bottomLeftY = window.innerHeight - 32
            const bottomLeftBg = getSectionAtY(bottomLeftY)
            if (bottomLeftBg) {
                setBottomLeftColor((prev) => (prev !== bottomLeftBg ? bottomLeftBg : prev))
            }
        }

        handleScroll()
        window.addEventListener("scroll", handleScroll, { passive: true })
        window.addEventListener("resize", handleScroll)

        return () => {
            window.removeEventListener("scroll", handleScroll)
            window.removeEventListener("resize", handleScroll)
        }
    }, [])

    const getDotStyle = (bg: SectionBackground) => {
        const color = bg === "blue" ? "#FFFFFF" : "#0066FF"
        const opacity = bg === "blue" ? 0.55 : 0.25
        return { color, opacity }
    }

    const topRightStyle = getDotStyle(topRightColor)
    const bottomLeftStyle = getDotStyle(bottomLeftColor)

    return (
        <>
            {/* Top-right fading dot grid */}
            <div
                className="fixed top-0 right-0 w-48 h-48 md:w-96 md:h-96 pointer-events-none z-50"
                style={{
                    backgroundImage: `radial-gradient(circle, ${topRightStyle.color} 1.5px, transparent 1.5px)`,
                    backgroundSize: "24px 24px",
                    opacity: topRightStyle.opacity,
                    maskImage: "radial-gradient(circle at top right, black 0%, transparent 70%)",
                    WebkitMaskImage: "radial-gradient(circle at top right, black 0%, transparent 70%)",
                }}
            />
            {/* Bottom-left fading dot grid */}
            <div
                className="fixed bottom-0 left-0 w-32 h-32 md:w-64 md:h-64 pointer-events-none z-50"
                style={{
                    backgroundImage: `radial-gradient(circle, ${bottomLeftStyle.color} 1.5px, transparent 1.5px)`,
                    backgroundSize: "24px 24px",
                    opacity: bottomLeftStyle.opacity,
                    maskImage: "radial-gradient(circle at bottom left, black 0%, transparent 70%)",
                    WebkitMaskImage: "radial-gradient(circle at bottom left, black 0%, transparent 70%)",
                }}
            />
        </>
    )
}

export default StickyDots
