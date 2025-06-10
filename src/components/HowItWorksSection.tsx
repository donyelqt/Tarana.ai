import Image from 'next/image';
import { explore, letai, set } from '../../public';

const HowItWorksSection = () => {
  return (
    <section className="bg-gradient-to-b from-blue-700 md:h-[80vh] to-blue-500 text-white py-20">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 font-sans">How it Works</h2>

        <div className="relative">
          {/* S-shaped Dotted line connecting the steps - refined based on image */}
          <div className="hidden md:block absolute top-0 left-0 right-0 w-full h-full z-0 pointer-events-none">
            <div className="relative w-full h-full flex items-center justify-center" style={{ top: 'calc(47% - 185px)' }}>
              <svg width="1500px" height="100px" viewBox="0 0 800 100" preserveAspectRatio="xMidYMid meet" className="overflow-visible">
                <path
                  d="M30,35 C150,-80 250,-80 400,35 S600,150 770,45"
                  stroke="#ffff"
                  strokeWidth="2.5"
                  fill="none"
                  strokeDasharray="2,8"
                />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10"> {/* Removed pt-10, rely on item spacing and line position */}
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="p-4 mb-6 w-64 h-34 flex items-center justify-center">
                <Image
                  src={set}
                  alt="Step 1: Set Your Trip Details"
                  width={120}
                  height={100}
                  className="object-contain"
                />
              </div>
              <h3 className="text-xl font-bold mt-10 mb-3 font-sans">Set Your Trip Details</h3>
              <p className="text-blue-100 font-sans">
                Input your budget, number of people, stay duration, and what you love.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="p-4 mb-6 w-64 h-34 flex items-center justify-center">
                <Image
                  src={letai}
                  alt="Step 2: Let AI Handle the Planning"
                  width={120}
                  height={100}
                  className="object-contain"
                />
              </div>
              <h3 className="text-xl font-bold mt-10 mb-3 font-sans">Let AI Handle the Planning</h3>
              <p className="text-blue-100 font-sans">
                We instantly create a day-by-day itinerary optimized for your style and the citys real-time conditions.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="p-4 mb-6 w-64 h-34 flex items-center justify-center">
                <Image
                  src={explore}
                  alt="Step 3: Explore Baguio Effortlessly"
                  width={120}
                  height={100}
                  className="object-contain"
                />
              </div>
              <h3 className="text-xl font-bold mt-10 mb-3 font-sans">Explore Baguio Effortlessly</h3>
              <p className="text-blue-100 font-sans">
                Get a beautiful, ready-to-go plan — from places to eat to shortcuts around traffic. All on one screen.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;