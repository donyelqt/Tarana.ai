"use client"

import Sidebar from "../../components/Sidebar"
import { useState, useEffect } from "react"
import Image from "next/image"
import { burnham, goodtaste } from "../../../public"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { saveItinerary } from "@/lib/savedItineraries"
import { useRouter } from "next/navigation"
import Toast from "@/components/ui/Toast"
import { fetchWeatherFromAPI, WeatherData, generateItinerary, ItineraryData } from "@/lib/utils"

const budgetOptions = [
  "less than ₱3,000/day",
  "₱3,000 - ₱5,000/day",
  "₱5,000 - ₱10,000/day",
  "₱10,000+/day"
]

const paxOptions = ["1", "2", "3-6", "6+"]
const durationOptions = ["1 Day", "2 Days", "3 Days", "4-5 Days"]
const interests = [
  { label: "Random", icon: "\uD83D\uDD0D" },
  { label: "Nature & Scenery", icon: "\uD83C\uDF3F" },
  { label: "Food & Culinary", icon: "\uD83C\uDF74" },
  { label: "Culture & Arts", icon: "\uD83C\uDFA8" },
  { label: "Shopping & Local Finds", icon: "\uD83D\uDED2" },
  { label: "Adventure", icon: "\u2699\uFE0F" }
]

// Sample itinerary data for preview
const sampleItinerary = {
  title: "Your 1 Day Itinerary",
  subtitle: "A preview of your Baguio Experience",
  items: [
    {
      period: "Morning (8AM-12NN)",
      activities: [
        {
          image: goodtaste,
          title: "Breakfast at Goodtaste",
          time: "7:30AM-9:00AM",
          desc: "Fuel up with a hearty Filipino-Chinese breakfast at Goodtaste, a Baguio favorite for generous portions and fast service.",
          tags: ["Food & Culinary"]
        },
        {
          image: burnham,
          title: "Burnham Park",
          time: "9:00AM-10:30AM",
          desc: "Start your day with a scenic boat ride or a relaxed stroll at Burnham Park.",
          tags: ["Nature & Scenery", "Adventure"]
        }
      ]
    }
  ]
}

export default function ItineraryGenerator() {
  const [budget, setBudget] = useState(budgetOptions[0])
  const [pax, setPax] = useState("")
  const [duration, setDuration] = useState("")
  const [dates, setDates] = useState({ start: "", end: "" })
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedItinerary, setGeneratedItinerary] = useState<ItineraryData | null>(null)
  const router = useRouter()
  
  // Fetch weather data on component mount
  useEffect(() => {
    const getWeather = async () => {
      try {
        const data = await fetchWeatherFromAPI()
        setWeatherData(data)
        console.log("Weather data fetched:", data)
      } catch (error) {
        console.error("Failed to fetch weather data:", error)
      }
    }
    
    getWeather()
  }, [])

  const handleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    
    try {
      // Construct a prompt for Gemini based on user preferences
      const interestsText = selectedInterests.length > 0 
        ? `with interests in ${selectedInterests.join(', ')}` 
        : 'with general interests';
      
      const budgetText = `on a budget of ${budget}`;
      const paxText = pax ? `for ${pax} ${parseInt(pax) === 1 ? 'person' : 'people'}` : '';
      const durationText = duration ? `for ${duration}` : 'for a day';
      
      const prompt = `Generate a detailed Baguio City itinerary ${durationText} ${paxText} ${budgetText} ${interestsText}. Include specific places, activities, and time allocations.`;
      
      console.log('Generating itinerary with prompt:', prompt);
      
      // Call the Gemini API through our utility function
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          weatherData
        })
      });
      
      if (!response.ok) {
        console.log(`API returned status: ${response.status}. Using sample itinerary as fallback.`);
        // Instead of throwing an error, we'll use the sample itinerary as fallback
        setGeneratedItinerary(sampleItinerary);
        setShowPreview(true);
        return;
      }
      
      const data = await response.json();
      const generatedText = data.candidates[0]?.content.parts[0]?.text;
      
      if (!generatedText) {
        throw new Error('No content generated');
      }
      
      console.log('Generated text:', generatedText);
      
      // For now, we'll use the sample itinerary data structure
      // In a production app, you would parse the Gemini response into the proper format
      // This would require more sophisticated parsing logic
      
      // Show the preview with sample data for now
      setGeneratedItinerary(sampleItinerary);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating itinerary:', error);
      // Use sample itinerary as fallback when any error occurs
      setGeneratedItinerary(sampleItinerary);
      setShowPreview(true);
      setToastMessage('Using sample itinerary as API request failed.');
      setShowToast(true);
    } finally {
      setIsGenerating(false);
    }
  }

  const handleSave = () => {
    try {
      // Compose the itinerary object
      const itineraryToSave = {
        title: duration ? `Your ${duration} Itinerary` : "Your Itinerary",
        date: dates.start && dates.end ? `${dates.start} - ${dates.end}` : "Date not specified",
        budget,
        image: generatedItinerary?.items[0]?.activities[0]?.image || sampleItinerary.items[0].activities[0].image, // Use first activity image as cover
        tags: selectedInterests.length > 0 ? selectedInterests : (generatedItinerary?.items.flatMap(i => i.activities.flatMap(a => a.tags)) || sampleItinerary.items.flatMap(i => i.activities.flatMap(a => a.tags))),
        formData: {
          budget,
          pax,
          duration,
          dates,
          selectedInterests,
        },
        weatherData: weatherData ? {
          temp: weatherData.main.temp,
          condition: weatherData.weather[0].main,
          description: weatherData.weather[0].description,
          icon: weatherData.weather[0].icon
        } : null,
        itineraryData: generatedItinerary || sampleItinerary,
      }
      saveItinerary(itineraryToSave)
      setToastMessage("Itinerary saved!")
      setShowToast(true)
      setTimeout(() => {
        router.push("/saved-trips")
      }, 1200)
    } catch (error) {
      console.error("Failed to save itinerary:", error)
      setToastMessage("Failed to save itinerary. Please try again.")
      setShowToast(true)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <Toast message={toastMessage} show={showToast} onClose={() => setShowToast(false)} type="success" />
      <Sidebar />
      <main className="md:pl-64 flex-1 flex flex-col md:flex-row items-start justify-start gap-8 p-4 md:p-12 pt-16 md:pt-12">
        {/* Left: Form */}
        <div className={cn(
          "w-full bg-white rounded-2xl p-8 shadow-md",
          showPreview ? "lg:max-w-2xl" : "max-w-2xl"
        )}>
          <div className="text-2xl font-bold mb-6 text-gray-900">Let&apos;s Plan Your Baguio Adventure</div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Budget Range */}
            <div>
              <Label htmlFor="budget" className="block font-bold mb-2 text-gray-700">Budget Range</Label>
              <select
                id="budget"
                className={cn(
                  "w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2",
                  showPreview ? 'border-gray-300' : 'border-gray-300 focus:ring-blue-200'
                )}
                value={budget}
                onChange={e => setBudget(e.target.value)}
                disabled={showPreview}
              >
                {budgetOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            {/* Number of Pax */}
            <div>
              <Label className="block font-bold mb-2 text-gray-700">Number of Pax.</Label>
              <div className="grid grid-cols-4 gap-3 lg:mr-48">
                {paxOptions.map(opt => (
                  <Button
                    type="button"
                    key={opt}
                    variant="outline"
                    className={cn(
                      "py-2 font-medium transition",
                      pax === opt ? 'bg-blue-500 text-white border-blue-500' : 'bg-white border-gray-300 text-gray-700',
                      showPreview ? 'cursor-not-allowed' : ''
                    )}
                    onClick={() => !showPreview && setPax(opt)}
                    disabled={showPreview}
                  >{opt}</Button>
                ))}
              </div>
            </div>
            {/* Duration */}
            <div>
              <Label className="block font-bold mb-2 text-gray-700">Duration</Label>
              <div className="grid grid-cols-4 gap-3 lg:mr-48">
                {durationOptions.map(opt => (
                  <Button
                    type="button"
                    key={opt}
                    variant="outline"
                    className={cn(
                      "py-2 font-medium transition",
                      duration === opt ? 'bg-blue-500 text-white border-blue-500' : 'bg-white border-gray-300 text-gray-700',
                      showPreview ? 'cursor-not-allowed' : ''
                    )}
                    onClick={() => !showPreview && setDuration(opt)}
                    disabled={showPreview}
                  >{opt}</Button>
                ))}
              </div>
            </div>
            {/* Travel Dates */}
            <div>
              <Label className="block font-bold mb-2 text-gray-700">Travel Dates</Label>
              <div className="flex gap-3 lg:mr-48">
                <Input
                  type="date"
                  className={cn(
                    "border rounded-lg px-4 py-2 w-full focus:outline-none focus:ring-2",
                    showPreview ? 'border-gray-300' : 'border-gray-300 focus:ring-blue-200'
                  )}
                  value={dates.start}
                  onChange={e => setDates({ ...dates, start: e.target.value })}
                  disabled={showPreview}
                  placeholder="mm/dd/yyyy"
                />
                <Input
                  type="date"
                  className={cn(
                    "border rounded-lg px-4 py-2 w-full focus:outline-none focus:ring-2",
                    showPreview ? 'border-gray-300' : 'border-gray-300 focus:ring-blue-200'
                  )}
                  value={dates.end}
                  onChange={e => setDates({ ...dates, end: e.target.value })}
                  disabled={showPreview}
                  placeholder="mm/dd/yyyy"
                />
              </div>
            </div>
            {/* Travel Interests */}
            <div>
              <Label className="block font-bold mb-2 text-gray-700">Travel Interests</Label>
              <div className="grid grid-cols-2 gap-3">
                {interests.map(({ label, icon }) => (
                  <Button
                    type="button"
                    key={label}
                    variant="outline"
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 font-medium transition",
                      selectedInterests.includes(label) ? 'bg-blue-500 text-white border-blue-500' : 'bg-white border-gray-300 text-gray-700',
                      showPreview ? 'cursor-not-allowed' : ''
                    )}
                    onClick={() => !showPreview && handleInterest(label)}
                    disabled={showPreview}
                  >
                    <span>{icon}</span>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {/* Generate Button */}
            <div>
              <Button
                type="submit"
                className={cn(
                  "w-full font-semibold rounded-xl py-3 text-lg flex items-center justify-center gap-2 transition",
                  showPreview ? 'bg-blue-500 text-white shadow-lg' : 'bg-blue-500 hover:bg-blue-600 text-white',
                  (showPreview || isGenerating) ? 'cursor-not-allowed' : ''
                )}
                disabled={showPreview || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <span className="animate-pulse">Generating Itinerary...</span>
                    <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  </>
                ) : (
                  <>
                    Generate My Itinerary
                    <span className="ml-2">→</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
        {/* Right: Results Panel */}
        {showPreview && (
          <aside className={cn(
            "w-full lg:w-[370px] lg:ml-4",
            showPreview ? "block" : "hidden"
          )}>
            <div className="bg-white rounded-2xl shadow-md p-6 sticky top-8 mt-8 lg:mt-0">
              <div className="mb-2 text-sm text-gray-500 font-medium">{generatedItinerary?.title || sampleItinerary.title}</div>
              <div className="mb-4 text-xs text-gray-400">{generatedItinerary?.subtitle || sampleItinerary.subtitle}</div>
              
              {/* Weather information */}
              {weatherData && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center">
                  <div className="flex-shrink-0 mr-2">
                    <Image 
                      src={`https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png`} 
                      alt={weatherData.weather[0].description}
                      width={40}
                      height={40}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Current Weather in Baguio</div>
                    <div className="text-xs text-gray-500">
                      {weatherData.weather[0].main}, {Math.round(weatherData.main.temp)}°C
                    </div>
                    <div className="text-xs text-gray-400 italic mt-1">
                      Itinerary adapted to current weather conditions
                    </div>
                  </div>
                </div>
              )}
              {(generatedItinerary?.items || sampleItinerary.items).map((section, idx) => (
                <div key={idx} className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold">{section.period}</span>
                  </div>
                  {section.activities.map((act, i) => (
                    <div key={i} className="bg-white rounded-xl shadow-sm mb-4 overflow-hidden border border-gray-100">
                      <Image src={act.image} alt={act.title} width={400} height={128} className="w-full h-32 object-cover" />
                      <div className="p-4">
                        <div className="font-semibold text-gray-900 text-base mb-1">{act.title}</div>
                        <div className="text-xs text-gray-500 mb-2">{act.time}</div>
                        <div className="text-sm text-gray-700 mb-3">{act.desc}</div>
                        <div className="flex gap-2 flex-wrap">
                          {act.tags.map((tag, t) => (
                            <span key={t} className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <Button
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl py-3 text-lg flex items-center justify-center gap-2 transition mt-4"
                onClick={handleSave}
              >
                Save Itinerary
              </Button>
            </div>
          </aside>
        )}
      </main>
    </div>
  )
}