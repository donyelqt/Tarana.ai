const WhyUseSection = () => {
    return (
        <section className="py-20 px-4">
            <div className="max-w-6xl mx-auto">
                <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
                    Why use <span className="text-blue-500">Tarana.ai</span>?
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Feature 1 */}
                    <div className="flex flex-col items-start text-start bg-white shadow-lg rounded-2xl p-12">
                        <div className="text-blue-500 mb-6">
                            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold mb-3">Personalized Itinerary</h3>
                        <p className="text-gray-600">
                            No more guesswork. Just tell us what you love — food, culture, nature, chill vibes — and we will do the rest.
                        </p>
                    </div>

                    {/* Feature 2 */}
                    <div className="flex flex-col items-start text-start bg-white shadow-lg rounded-2xl p-12">
                        <div className="text-blue-500 mb-6">
                            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold mb-3">Traffic-Smart Routes</h3>
                        <p className="text-gray-600">
                            We use live traffic data to keep your day flowing smoothly. Less waiting. More exploring.
                        </p>
                    </div>

                    {/* Feature 3 */}
                    <div className="flex flex-col items-start text-start bg-white shadow-lg rounded-2xl p-12">
                        <div className="text-blue-500 mb-6">
                            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                            </svg>
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
