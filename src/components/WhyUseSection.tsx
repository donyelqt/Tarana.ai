'use client'

import { useState, useEffect } from 'react'
import Image from "next/image"
import { local, personalized, traffic } from "../../public"

type CardData = {
    id: number
    title: string
    description: string
    icon: any
    iconAlt: string
    iconWidth: number
    iconHeight: number
    iconWidthMobile: number
    iconHeightMobile: number
}

// Desktop dimensions & transforms (≥768px)
const DESKTOP = {
    width: 320,
    height: 380,
    padding: 'p-12',
    slots: {
        0: { tx: -20, ty: 15, rot: -8, zIndex: 10, ml: '0px', mr: '-80px' },   // left
        1: { tx: 0, ty: 0, rot: 0, zIndex: 30, ml: '0px', mr: '0px' },        // center
        2: { tx: 20, ty: 15, rot: 8, zIndex: 10, ml: '-80px', mr: '0px' },    // right
    } as const,
}

// Mobile dimensions & transforms (<768px) — scaled-down replica of desktop scattered layout
// Cards sized to be readable while still fitting 3 overlapping cards in a 375px viewport
// Edges clip cleanly via overflow-hidden, creating the same "cards peeking out" aesthetic as Bryl Lim
const MOBILE = {
    width: 220,
    height: 240,
    padding: 'p-5',
    slots: {
        0: { tx: -10, ty: 10, rot: -5, zIndex: 10, ml: '0px', mr: '-80px' },   // left
        1: { tx: 0, ty: 0, rot: 0, zIndex: 30, ml: '0px', mr: '0px' },         // center
        2: { tx: 10, ty: 10, rot: 5, zIndex: 10, ml: '-80px', mr: '0px' },    // right
    } as const,
}

const BASE_CARD_CLASSES = "flex flex-col items-start text-start bg-white shadow-[5px_5px_10px_theme(colors.sky.300/50%),_-5px_-5px_10px_theme(colors.white/70%)] hover:shadow-[5px_5px_10px_rgb(0,0,255,0.5),_-5px_-5px_10px_rgb(255,255,255,0.7)] focus-visible:shadow-[5px_5px_10px_rgb(0,0,255,0.5),_-5px_-5px_10px_rgb(255,255,255,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 ease-out transform cursor-pointer rounded-2xl"

const WhyUseSection = ({ id }: { id?: string }) => {
    const [mounted, setMounted] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        setMounted(true)
        const checkViewport = () => setIsMobile(window.innerWidth < 768)
        checkViewport()
        window.addEventListener('resize', checkViewport)
        return () => window.removeEventListener('resize', checkViewport)
    }, [])

    const [slots, setSlots] = useState<CardData[]>([
        {
            id: 1,
            title: "Personalized Itinerary",
            description: "No more guesswork. Just tell us what you love — food, culture, nature, chill vibes — and we will do the rest.",
            icon: personalized,
            iconAlt: "personalized",
            iconWidth: 82,
            iconHeight: 42,
            iconWidthMobile: 60,
            iconHeightMobile: 32,
        },
        {
            id: 2,
            title: "Traffic-Smart Routes",
            description: "We use live traffic data to keep your day flowing smoothly. Less waiting. More exploring.",
            icon: traffic,
            iconAlt: "traffic",
            iconWidth: 52,
            iconHeight: 42,
            iconWidthMobile: 38,
            iconHeightMobile: 32,
        },
        {
            id: 3,
            title: "Local Hidden Gems",
            description: "Go beyond the usual. Discover authentic Baguio spots curated with help from locals, bloggers, and community partners.",
            icon: local,
            iconAlt: "local",
            iconWidth: 82,
            iconHeight: 42,
            iconWidthMobile: 60,
            iconHeightMobile: 32,
        },
    ])

    const handleCardClick = (slotIndex: number) => {
        if (slotIndex === 1) return // already center, no swap
        setSlots((prev) => {
            const next = [...prev]
            // Swap clicked slot with center slot (index 1)
            ;[next[slotIndex], next[1]] = [next[1], next[slotIndex]]
            return next
        })
    }

    // Use mobile config after hydration, desktop during SSR (prevents hydration mismatch)
    const config = mounted && isMobile ? MOBILE : DESKTOP
    const cardWidth = config.width
    const cardHeight = config.height
    const paddingClass = config.padding
    const slotStyles = config.slots

    return (
        <section id={id} className="py-20 px-4 overflow-hidden">
            <div className="max-w-6xl mx-auto">
                <h2 className="text-4xl md:text-5xl font-medium text-center mb-4">
                    Why use <span className="bg-gradient-to-b from-blue-700 to-blue-500 bg-clip-text text-transparent">Tarana.ai</span>?
                </h2>

                <p className="text-center text-sm text-gray-500 mb-16 md:mb-20">
                    Click any card to feature it
                </p>

                {/* Horizontal row on ALL breakpoints — same scattered layout, just scaled for mobile */}
                <div className="flex flex-row items-center justify-center">
                    {slots.map((card, slotIndex) => {
                        const style = slotStyles[slotIndex as 0 | 1 | 2]
                        const isCenter = slotIndex === 1

                        return (
                            <div
                                key={card.id}
                                className={`${BASE_CARD_CLASSES} ${paddingClass}`}
                                style={{
                                    width: `${cardWidth}px`,
                                    height: `${cardHeight}px`,
                                    transform: `translate(${style.tx}px, ${style.ty}px) rotate(${style.rot}deg)`,
                                    zIndex: style.zIndex,
                                    marginLeft: style.ml,
                                    marginRight: style.mr,
                                }}
                                onClick={() => handleCardClick(slotIndex)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        handleCardClick(slotIndex)
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label={
                                    isCenter
                                        ? `${card.title}. Currently featured.`
                                        : `${card.title}. Click to feature this card.`
                                }
                                aria-pressed={isCenter}
                            >
                                <div className="text-blue-500 mb-3 md:mb-6">
                                    <Image
                                        src={card.icon}
                                        alt={card.iconAlt}
                                        width={mounted && isMobile ? card.iconWidthMobile : card.iconWidth}
                                        height={mounted && isMobile ? card.iconHeightMobile : card.iconHeight}
                                        className="object-contain"
                                        quality={100}
                                    />
                                </div>
                                <h3 className="text-sm md:text-xl font-medium mb-1.5 md:mb-3">{card.title}</h3>
                                <p className="text-gray-600 text-[10px] md:text-sm leading-relaxed">{card.description}</p>
                                {isCenter && (
                                    <span className="mt-auto pt-2 md:pt-4 text-[10px] md:text-xs font-medium text-blue-500 tracking-wide uppercase">
                                        Featured
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}

export default WhyUseSection
