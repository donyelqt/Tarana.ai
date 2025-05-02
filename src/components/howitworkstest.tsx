import Image from 'next/image';
import step1 from '@/public/images/step1.png';
import step2 from '@/public/images/step2.png';
import step3 from '@/public/images/step3.png';

const HowItWorksSection = () => {
    return (
        <section className="bg-blue-500 text-white py-20">
            <div className="max-w-7xl mx-auto px-4">
                <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 font-sans">How it Works</h2>

                <div className="relative">
                    {/* Dotted line connecting the steps */}
                    <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 border-t-2 border-dashed border-white/30 z-0"></div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {/* Step 1 */}
                        <div className="flex flex-col items-center text-center">
                            <div className="bg-white/20 p-4 rounded-full mb-6 w-16 h-16 flex items-center justify-center">
                                <Image
                                    src={step1}
                                    alt="Step 1: Set Your Trip Details"
                                    width={32}
                                    height={32}
                                    className="object-contain"
                                />
                            </div>
                            <h3 className="text-xl font-bold mb-3 font-sans">Set Your Trip Details</h3>
                            <p className="text-blue-100 font-sans">
                                Input your budget, number of people, stay duration, and what you love.
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="flex flex-col items-center text-center">
                            <div className="bg-white/20 p-4 rounded-full mb-6 w-16 h-16 flex items-center justify-center">
                                <Image
                                    src={step2}
                                    alt="Step 2: Let AI Handle the Planning"
                                    width={32}
                                    height={32}
                                    className="object-contain"
                                />
                            </div>
                            <h3 className="text-xl font-bold mb-3 font-sans">Let AI Handle the Planning</h3>
                            <p className="text-blue-100 font-sans">
                                We instantly create a day-by-day itinerary optimized for your style and the city's real-time conditions.
                            </p>
                        </div>

                        {/* Step 3 */}
                        <div className="flex flex-col items-center text-center">
                            <div className="bg-white/20 p-4 rounded-full mb-6 w-16 h-16 flex items-center justify-center">
                                <Image
                                    src={step3}
                                    alt="Step 3: Explore Baguio Effortlessly"
                                    width={32}
                                    height={32}
                                    className="object-contain"
                                />
                            </div>
                            <h3 className="text-xl font-bold mb-3 font-sans">Explore Baguio Effortlessly</h3>
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