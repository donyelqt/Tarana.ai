"use client"

import { useEffect, useState } from "react"

type SectionBackground = "white" | "blue"

const NUM_BANDS = 16

const StickyDots = () => {
    const [topRightBands, setTopRightBands] = useState<SectionBackground[]>(
        Array(NUM_BANDS).fill("white")
    )
    const [bottomLeftBands, setBottomLeftBands] = useState<SectionBackground[]>(
        Array(NUM_BANDS).fill("white")
    )

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
            // Top-right grid is fixed at top-0 right-0, height = 96px on md+
            // Sample y-coordinates within the top grid's area
            const topGridHeight = window.innerWidth >= 768 ? 96 : 48
            const newTopRight: SectionBackground[] = []
            for (let i = 0; i < NUM_BANDS; i++) {
                const y = (topGridHeight / NUM_BANDS) * i + 1
                const bg = getSectionAtY(y)
                newTopRight.push(bg ?? "white")
            }
            setTopRightBands((prev) => {
                if (prev.every((v, i) => v === newTopRight[i])) return prev
                return newTopRight
            })

            // Bottom-left grid is fixed at bottom-0 left-0, height = 64px on md+
            const bottomGridHeight = window.innerWidth >= 768 ? 64 : 32
            const viewportHeight = window.innerHeight
            const newBottomLeft: SectionBackground[] = []
            for (let i = 0; i < NUM_BANDS; i++) {
                // Bottom band is closest to the bottom of the viewport
                const y = viewportHeight - bottomGridHeight + (bottomGridHeight / NUM_BANDS) * i + 1
                const bg = getSectionAtY(y)
                newBottomLeft.push(bg ?? "white")
            }
            setBottomLeftBands((prev) => {
                if (prev.every((v, i) => v === newBottomLeft[i])) return prev
                return newBottomLeft
            })
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

    return (
        <>
            {/* Top-right fading dot grid - rendered as horizontal bands for real-time color transition */}
            <div
                className="fixed top-0 right-0 w-48 h-48 md:w-96 md:h-96 pointer-events-none z-50"
                style={{
                    maskImage: "radial-gradient(circle at top right, black 0%, transparent 70%)",
                    WebkitMaskImage: "radial-gradient(circle at top right, black 0%, transparent 70%)",
                }}
            >
                {topRightBands.map((bg, i) => {
                    const style = getDotStyle(bg)
                    return (
                        <div
                            key={`tr-${i}`}
                            className="absolute left-0 w-full"
                            style={{
                                top: `${(100 / NUM_BANDS) * i}%`,
                                height: `${100 / NUM_BANDS}%`,
                                backgroundImage: `radial-gradient(circle, ${style.color} 1.5px, transparent 1.5px)`,
                                backgroundSize: "24px 24px",
                                opacity: style.opacity,
                            }}
                        />
                    )
                })}
            </div>

            {/* Bottom-left fading dot grid - rendered as horizontal bands for real-time color transition */}
            <div
                className="fixed bottom-0 left-0 w-32 h-32 md:w-64 md:h-64 pointer-events-none z-50"
                style={{
                    maskImage: "radial-gradient(circle at bottom left, black 0%, transparent 70%)",
                    WebkitMaskImage: "radial-gradient(circle at bottom left, black 0%, transparent 70%)",
                }}
            >
                {bottomLeftBands.map((bg, i) => {
                    const style = getDotStyle(bg)
                    return (
                        <div
                            key={`bl-${i}`}
                            className="absolute left-0 w-full"
                            style={{
                                top: `${(100 / NUM_BANDS) * i}%`,
                                height: `${100 / NUM_BANDS}%`,
                                backgroundImage: `radial-gradient(circle, ${style.color} 1.5px, transparent 1.5px)`,
                                backgroundSize: "24px 24px",
                                opacity: style.opacity,
                            }}
                        />
                    )
                })}
            </div>
        </>
    )
}

export default StickyDots
