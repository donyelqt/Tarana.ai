import { MapPin, TargetIcon, UsersIcon } from 'lucide-react';
import React from 'react';

const AboutSmartTravel = () => {
  return (
    <section className="bg-white pt-16 pb-8">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start">
          {/* Left: Heading */}
          <div className="md:w-1/2">
            <h1 className="text-5xl md:text-6xl font-medium text-gray-900 leading-tight mb-6">
              Smarter Travel.<br />
              <span className="text-blue-600">Better Cities.</span>
            </h1>
          </div>
          {/* Right: Supporting Paragraph */}
          <div className="md:w-1/2 flex md:justify-end">
            <p className="max-w-md text-gray-600 text-lg md:text-base mt-2 md:mt-0 md:text-left">
              We&apos;re here to make every city more livable and sustainable—by guiding travelers smarter, easing overcrowding, and uplifting local communities through data-driven, personalized journeys.
            </p>
          </div>
        </div>
        {/* Cards Row */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Our Story */}
          <div className="flex flex-col items-start text-left">
            <div className="bg-blue-600 rounded-full w-20 h-20 flex items-center justify-center mb-6">
              <UsersIcon className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-xl font-medium mb-2 text-gray-900">Our Story</h3>
            <p className="text-gray-600 text-base max-w-xs">
              Born from the overcrowded streets of Baguio, we built Tarana.ai to rethink how cities and tourists move together.
            </p>
          </div>
          {/* Our Mission */}
          <div className="flex flex-col items-start text-left">
            <div className="bg-blue-600 rounded-full w-20 h-20 flex items-center justify-center mb-6">
              <TargetIcon className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-xl font-medium mb-2 text-gray-900">Our Mission</h3>
            <p className="text-gray-600 text-base max-w-xs">
              To make travel smarter and cities more sustainable—one personalized itinerary at a time.
            </p>
          </div>
          {/* What Makes us Unique? */}
          <div className="flex flex-col items-start text-left">
            <div className="bg-blue-600 rounded-full w-20 h-20 flex items-center justify-center mb-6">
              <MapPin className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-xl font-medium mb-2 text-gray-900">What Makes us Unique?</h3>
            <p className="text-gray-600 text-base max-w-xs">
              We combine real-time data with AI to create dynamic itineraries that ease congestion, surface hidden gems, and reshape urban tourism.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSmartTravel; 