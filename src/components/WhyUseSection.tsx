import Image from "next/image"
import { local, personalized, traffic } from "../../public"

const WhyUseSection = () => {
    return (
        <section className="py-20 px-4">
            <div className="max-w-6xl mx-auto">
                <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
                    Why use <span className="bg-gradient-to-b from-blue-700 to-blue-500 bg-clip-text text-transparent">Tarana.ai</span>?
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Feature 1 */}
                    <div className="flex flex-col items-start text-start bg-white shadow-md rounded-2xl p-12">
                        <div className="text-blue-500 mb-6">
                            <Image src={personalized}
                                alt="personalized"
                                width={82}
                                height={42}
                                className="object-contain"
                                quality={100}
                            />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Personalized Itinerary</h3>
                        <p className="text-gray-600">
                            No more guesswork. Just tell us what you love — food, culture, nature, chill vibes — and we will do the rest.
                        </p>
                    </div>

                    {/* Feature 2 */}
                    <div className="flex flex-col items-start text-start bg-white shadow-md rounded-2xl p-12">
                        <div className="text-blue-500 mb-11">
                            <Image src={traffic}
                                alt="traffic"
                                width={52}
                                height={42}
                                className="object-contain"
                                quality={100}
                            />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Traffic-Smart Routes</h3>
                        <p className="text-gray-600">
                            We use live traffic data to keep your day flowing smoothly. Less waiting. More exploring.
                        </p>
                    </div>

                    {/* Feature 3 */}
                    <div className="flex flex-col items-start text-start bg-white shadow-md rounded-2xl p-12">
                        <div className="text-blue-500 mb-6">
                            <Image src={local}
                                alt="local"
                                width={82}
                                height={42}
                                className="object-contain"
                                quality={100}
                            />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Local Hidden Gems</h3>
                        <p className="text-gray-600">
                            Go beyond the usual. Discover authentic Baguio spots curated with help from locals, bloggers, and community partners.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default WhyUseSection
