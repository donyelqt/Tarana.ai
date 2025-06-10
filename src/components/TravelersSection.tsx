"use client";

import { useState } from "react";
import Image, { StaticImageData } from "next/image";
import { barkadas, couples, family, solo_travel } from "../../public";

interface TravelerType {
  title: string;
  description: string;
  image: StaticImageData;
}

const TravelersSection = () => {
  const [travelers] = useState<TravelerType[]>([
    {
      title: "Solo Traveler",
      description:
        "Go at your own pace and discover hidden gems, peaceful trails, and cozy cafés — all tailored to your vibe.",
      image: solo_travel,
    },
    {
      title: "Families",
      description:
        "Kid-friendly activities, safety-first recommendations, and flexible schedules perfect for family bonding.",
      image: family,
    },
    {
      title: "Couples",
      description:
        "From scenic walks to hidden date spots, Tarana.ai helps you focus on each other while we take care of the route.",
      image: couples,
    },
    {
      title: "Barkadas",
      description:
        "Whether its food trips or thrill spots, Tarana.ai keeps your crew in sync. Real-time updates, shared plans, zero chaos.",
      image: barkadas,
    },
  ]);

  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-5xl font-bold text-center mb-16 bg-gradient-to-b from-blue-700 to-blue-500 bg-clip-text text-transparent">Perfect for All Travelers</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {travelers.map((traveler, index) => (
            <div
              key={index}
              className="bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-[5px_5px_10px_theme(colors.sky.300/50%),_-5px_-5px_10px_theme(colors.white/70%)] transition-shadow"
            >
              {/* Image container with exact same width as the card */}
              <div className="aspect-[4/3] relative w-full h-40">
                <Image
                  src={traveler.image || "/placeholder.svg"}
                  alt={traveler.title}
                  fill
                  className="object-cover w-full h-full"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                />
              </div>

              {/* Title and description */}
              <div className="p-6 text-center h-44">
                <h3 className="text-2xl font-bold mb-3">{traveler.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{traveler.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default TravelersSection
