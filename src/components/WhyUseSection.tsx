'use client'

import { useState } from 'react'
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
}

// Fixed card dimensions — all 3 cards will be exactly this size
const CARD_WIDTH = 320 // max-w-xs
const CARD_HEIGHT = 380

const BASE_CARD_CLASSES = "flex flex-col items-start text-start bg-white shadow-[5px_5px_10px_theme(colors.sky.300/50%),_-5px_-5px_10px_theme(colors.white/70%)] hover:shadow-[5px_5px_10px_rgb(0,0,255,0.5),_-5px_-5px_10px_rgb(255,255,255,0.7)] focus-visible:shadow-[5px_5px_10px_rgb(0,0,255,0.5),_-5px_-5px_10px_rgb(255,255,255,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 ease-out transform cursor-pointer rounded-2xl p-12"

const getSlotStyle = (slot: number) => {
    switch (slot) {
        case 0: // left slot
            return {
                transform: 'translate(-20px, 15px) rotate(-8deg)',
                zIndex: 10,
                marginLeft: '0px',
                marginRight: '-80px',
            }
        case 1: // center slot
            return {
                transform: 'translate(0px, 0px) rotate(0deg)',
                zIndex: 30,
                marginLeft: '0px',
                marginRight: '0px',
            }
        case 2: // right slot
            return {
                transform: 'translate(20px, 15px) rotate(8deg)',
                zIndex: 10,
                marginLeft: '-80px',
                marginRight: '0px',
            }
        default:
            return {}
    }
}

const WhyUseSection = ({ id }: { id?: string }) => {
    const [slots, setSlots] = useState<CardData[]>([
        {
            id: 1,
            title: "Personalized Itinerary",
            description: "No more guesswork. Just tell us what you love — food, culture, nature, chill vibes — and we will do the rest.",
            icon: personalized,
            iconAlt: "personalized",
            iconWidth: 82,
            iconHeight: 42,
        },
        {
            id: 2,
            title: "Traffic-Smart Routes",
            description: "We use live traffic data to keep your day flowing smoothly. Less waiting. More exploring.",
            icon: traffic,
            iconAlt: "traffic",
            iconWidth: 52,
            iconHeight: 42,
        },
        {
            id: 3,
            title: "Local Hidden Gems",
            description: "Go beyond the usual. Discover authentic Baguio spots curated with help from locals, bloggers, and community partners.",
            icon: local,
            iconAlt: "local",
            iconWidth: 82,
            iconHeight: 42,
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

    return (
        <section id={id} className="py-20 px-4 overflow-hidden">
            <div className="max-w-6xl mx-auto">
                <h2 className="text-4xl md:text-5xl font-medium text-center mb-4">
                    Why use <span className="bg-gradient-to-b from-blue-700 to-blue-500 bg-clip-text text-transparent">Tarana.ai</span>?
                </h2>

                <p className="text-center text-sm text-gray-500 mb-20">
                    Click any card to feature it
                </p>

                <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-0">
                    {slots.map((card, slotIndex) => {
                        const style = getSlotStyle(slotIndex)
                        const isCenter = slotIndex === 1

                        return (
                            <div
                                key={card.id}
                                className={BASE_CARD_CLASSES}
                                style={{
                                    width: `${CARD_WIDTH}px`,
                                    height: `${CARD_HEIGHT}px`,
                                    transform: style.transform,
                                    zIndex: style.zIndex,
                                    marginLeft: style.marginLeft,
                                    marginRight: style.marginRight,
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
                                <div className="text-blue-500 mb-6">
                                    <Image
                                        src={card.icon}
                                        alt={card.iconAlt}
                                        width={card.iconWidth}
                                        height={card.iconHeight}
                                        className="object-contain"
                                        quality={100}
                                    />
                                </div>
                                <h3 className="text-xl font-medium mb-3">{card.title}</h3>
                                <p className="text-gray-600 text-sm leading-relaxed">{card.description}</p>
                                {isCenter && (
                                    <span className="mt-auto pt-4 text-xs font-medium text-blue-500 tracking-wide uppercase">
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
