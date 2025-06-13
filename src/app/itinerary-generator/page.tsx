"use client"

import Sidebar from "../../components/Sidebar"
import { useState, useEffect } from "react"
import Image from "next/image"
import { baguio_panorama, bencab, burnham, caferuins, goodtaste, hillstation, 
  mtulap, nightmarket, tamawan, taranaai, treetopcampjohnhay, viewspark, 
  vizcossessionroad} from "../../../public"
import globeIcon from '/public/globe.svg';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { saveItinerary } from "@/lib/savedItineraries"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { fetchWeatherFromAPI, WeatherData, ItineraryData } from "@/lib/utils"

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

// Enhanced sample itinerary data with detailed information for Google Gemini
const sampleItinerary = {
  title: "Your 1 Day Itinerary",
  subtitle: "A personalized Baguio Experience",
  items: [
    {
      period: "Morning (8AM-12NN)",
      activities: [
        {
          image: goodtaste,
          title: "Breakfast at Good Taste Restaurant",
          time: "7:30AM-9:00AM",
          desc: "Fuel up with a hearty Filipino-Chinese breakfast at Good Taste, a Baguio favorite known for generous portions and affordable prices. Try their famous buttered chicken (₱180-250) and pancit canton (₱150-200). Located at Carino St., this 24-hour restaurant is perfect for early risers. Budget-friendly with meals averaging ₱150-300 per person. Travel time from city center: 5-10 minutes by taxi (₱70-100).",
          tags: ["Food & Culinary", "Budget-friendly", "Local Favorite", "Indoor-Friendly"]
        },
        {
          image: burnham,
          title: "Burnham Park Activities",
          time: "9:15AM-11:00AM",
          desc: "Enjoy boating on the man-made lake (₱150/hour) or rent a bike (₱60-100/hour) to tour this historic park at the heart of the city. The rose garden and orchidarium are perfect for nature lovers. Street food vendors offer affordable snacks (₱20-50). Located at the city center, it's easily accessible by walking from most downtown hotels. Duration: 1.5-2 hours including walking around. Perfect for both sunny and cloudy weather.",
          tags: ["Nature & Scenery", "Adventure", "Budget-friendly", "Family-friendly", "Outdoor-Friendly"]
        },
        {
          image: bencab,
          title: "BenCab Museum Visit",
          time: "9:30AM-12:00PM",
          desc: "Explore the works of National Artist Benedicto Cabrera at this world-class museum featuring Filipino art, indigenous artifacts, and a serene garden with duck ponds and eco-trail. Entrance fee: ₱150 (adults), ₱120 (students). Located in Tuba, Benguet, about 15-20 minutes from city center by taxi (₱200-250). The on-site Café Sabel offers farm-to-table dishes (₱250-450) with ingredients from their own garden. Perfect indoor activity for rainy days. Duration: 2-2.5 hours including garden walk.",
          tags: ["Culture & Arts", "Museum", "Indoor-Friendly", "Mid-range Budget", "Educational"]
        },
        {
          image: mtulap,
          title: "Mt. Ulap Eco-Trail (Half-Day Hike)",
          time: "8:00AM-12:30PM",
          desc: "Experience this popular day hike on the Ampucao-Sta Fe ridge with stunning views of the Cordillera mountains. Visit highlights like Gungal Rock and Ambanao Paoay Peak. Guide fee: ₱600 + ₱100/person. Transportation: Jeepney from Baguio (₱30) or taxi (₱350-400). Duration: 4-5 hours for the beginner trail. Difficulty: Moderate. Best during clear weather. Bring: 1L water, trail snacks, sunscreen, hat, light jacket. Not recommended during rainy season due to slippery trails.",
          tags: ["Nature & Scenery", "Adventure", "Hiking", "Outdoor-Friendly", "Physical Activity", "Clear Weather Only"]
        }
      ]
    },
    {
      period: "Afternoon (12NN-6PM)",
      activities: [
        {
          image: hillstation,
          title: "Lunch at Hill Station",
          time: "12:45PM-2:00PM",
          desc: "Enjoy international cuisine with a Filipino twist at this award-winning restaurant located in Casa Vallejo, a historic hotel built in 1909. Known for its cozy ambiance and historic setting. Try their US Angus Beef Salpicao (₱650) or Cordillera Chicken Roulade (₱450). Reservation recommended. Price range: ₱450-800 per person. Located at Upper Session Road, 5-minute walk from SM Baguio. Perfect for any weather condition. Duration: 1-1.5 hours for a leisurely meal.",
          tags: ["Food & Culinary", "Fine Dining", "Historic Site", "Indoor-Friendly", "High-end Budget"]
        },
        {
          image: tamawan,
          title: "Tam-awan Village Cultural Experience",
          time: "2:30PM-4:30PM",
          desc: "Immerse yourself in Cordilleran culture at this reconstructed indigenous village featuring traditional Ifugao and Kalinga huts, art galleries, and cultural workshops. Enjoy scenic viewpoints and local crafts. Entrance fee: ₱60 (adults), ₱50 (students). Art workshops available (₱250-500). Located in Pinsao Proper, 15-20 minutes from city center by taxi (₱150-200). Has covered walkways between huts, making it suitable for light rain. Duration: 1.5-2 hours for a complete tour. Cultural performances on weekends (additional ₱100).",
          tags: ["Culture & Arts", "Local Heritage", "Shopping & Local Finds", "Educational", "Weather-Flexible", "Mid-range Budget"]
        },
        {
          image: treetopcampjohnhay,
          title: "Tree Top Adventure at Camp John Hay",
          time: "4:45PM-6:00PM",
          desc: "Experience thrilling activities like the Superman Ride (₱300), Canopy Ride (₱250), or Silver Surfer (₱200). Perfect for adventure seekers looking for an adrenaline rush. Located in Camp John Hay Special Economic Zone, 10-15 minutes from city center by taxi (₱120-150). Package deals available: ₱650 for 3 rides. Height and weight restrictions apply. Not operational during heavy rain or strong winds. Duration: 1-1.5 hours for multiple activities. Last ride usually at 5:30PM.",
          tags: ["Nature & Scenery", "Adventure", "Adrenaline & Extreme", "Outdoor-Friendly", "Mid-range Budget", "Clear Weather Only"]
        },
        {
          image: viewspark,
          title: "Mines View Park Scenic Overlook",
          time: "3:00PM-4:30PM",
          desc: "Visit this famous lookout point offering panoramic views of the Cordillera mountains and the abandoned gold and copper mines. Entrance is free. Souvenir shops and food stalls line the approach to the park. Try on traditional Igorot attire for photos (₱20-50). Sample strawberry taho (₱30-50) or fresh strawberries when in season. Located 15-20 minutes from city center by jeepney (₱10) or taxi (₱120-150). Best visited on clear days for optimal views. Duration: 1-1.5 hours including shopping. Crowded on weekends and holidays.",
          tags: ["Nature & Scenery", "Shopping & Local Finds", "Photography Spot", "Budget-friendly", "Outdoor-Friendly", "Family-friendly"]
        }
      ]
    },
    {
      period: "Evening (6PM onwards)",
      activities: [
        {
          image: caferuins,
          title: "Dinner at Café by the Ruins",
          time: "6:30PM-8:00PM",
          desc: "Experience farm-to-table dining at this iconic Baguio restaurant located at 25 Shuntug Road (across City Hall). Founded by artists in the 1980s, it's built on actual ruins of a historic building. Try their signature dishes made with locally-sourced ingredients - from Warm Shiitake Salad (₱280) to Pasta Carbonara (₱240). Don't miss their famous Camote Bread (₱100) with homemade spreads. Average meal cost: ₱350-500 per person. Reservation recommended on weekends. Open daily from 7AM to 9PM. Duration: 1.5 hours for a relaxed dinner. Indoor seating available for rainy evenings.",
          tags: ["Food & Culinary", "Culture & Arts", "Local Heritage", "Indoor-Friendly", "Mid-range Budget", "Romantic"]
        },
        {
          image: nightmarket,
          title: "Night Market on Harrison Road",
          time: "9:00PM-11:00PM",
          desc: "End your day at the vibrant Night Market along Harrison Road near Burnham Park (open 9PM-2AM). Find ukay-ukay (thrift clothes) for ₱50-250, local handicrafts, souvenirs, and delicious street food. Enjoy Filipino street food like fishballs (₱15), isaw (₱15), and sisig rice meals (₱60-80), or try the popular strawberry taho (₱25-35). Bring small bills and be prepared to haggle. Located at the city center, easily accessible by walking from most downtown hotels. Not recommended during heavy rain as it's an open-air market. Duration: 1-2 hours for shopping and snacking. Security is present but watch your belongings in crowds.",
          tags: ["Shopping & Local Finds", "Food & Culinary", "Budget-friendly", "Local Experience", "Night Activity", "Weather-Dependent"]
        },
        {
          image: vizcossessionroad,
          title: "Dessert at Vizco's Restaurant & Cake Shop",
          time: "8:15PM-9:30PM",
          desc: "Satisfy your sweet tooth at this famous Baguio bakery known for their signature strawberry shortcake (₱120/slice, ₱650 whole). Also try their blueberry cheesecake (₱130/slice) or ube cake (₱110/slice). Located at Session Road, 5-minute walk from Burnham Park. Also serves meals (₱180-350) if you prefer a full dinner. Indoor seating makes it perfect for any weather. Duration: 45 minutes to 1 hour. Two branches available: Session Road and SM Baguio. Take-out boxes available for bringing cakes back to your accommodation.",
          tags: ["Food & Culinary", "Desserts", "Local Favorite", "Indoor-Friendly", "Budget-friendly", "Family-friendly"]
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
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingItinerary, setIsLoadingItinerary] = useState<boolean>(false);
  const [generatedItinerary, setGeneratedItinerary] = useState<ItineraryData | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  
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
    e.preventDefault()
    setIsGenerating(true)
    setIsLoadingItinerary(true); // Start loading itinerary

    try {
      // Validate form
      if (!budget || !pax || !duration || selectedInterests.length === 0) {
        toast({
          title: "Missing Information",
          description: "Please fill in all fields",
          variant: "destructive"
        })
        setIsGenerating(false)
        return
      }

      // Construct a simple prompt for Gemini API
      const prompt = `Create a personalized ${duration}-day itinerary for Baguio City, Philippines based on the user preferences and current weather conditions.`

      // Call Gemini API with all user preferences and sample itinerary data
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          weatherData,
          interests: selectedInterests,
          duration,
          budget,
          pax,
          sampleItinerary // Pass the sample itinerary data to the API
        }),
      })

      if (!response.ok) {
        console.error(`API responded with status ${response.status}`)
        toast({
          title: "API Error",
          description: "Failed to connect to the itinerary generator. Using sample data instead.",
          variant: "destructive"
        })
        setGeneratedItinerary(sampleItinerary)
        setShowPreview(true)
        setIsGenerating(false)
        return
      }

      const data = await response.json()
      const responseText = data.text

      if (!responseText) {
        console.error("Empty response from API")
        toast({
          title: "API Error",
          description: "Received empty response from the itinerary generator. Using sample data instead.",
          variant: "destructive"
        })
        setGeneratedItinerary(sampleItinerary)
        setShowPreview(true)
        setIsGenerating(false)
        return
      }

      let parsedData
      try {
        // The API now returns pre-cleaned JSON
        parsedData = typeof responseText === 'string' ? JSON.parse(responseText) : responseText
      } catch (e) {
        console.error("Failed to parse JSON from response:", e)
        
        // Fallback: Try to extract JSON from the response if direct parsing fails
        try {
          const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                          responseText.match(/```([\s\S]*?)```/) ||
                          responseText.match(/{[\s\S]*?}/)
          
          if (jsonMatch) {
            // If we found a JSON block, parse it
            parsedData = JSON.parse(jsonMatch[1] || jsonMatch[0])
          } else {
            throw new Error("No JSON found in response")
          }
        } catch (extractError) {
          console.error("Extraction fallback also failed:", extractError)
          toast({
            title: "Parsing Error",
            description: "Failed to parse the generated itinerary. Using sample data instead.",
            variant: "destructive"
          })
          // Fall back to sample data
          parsedData = sampleItinerary
        }
      }

      // Validate the structure of the parsed data
      if (!parsedData || !parsedData.items || !Array.isArray(parsedData.items)) {
        console.error("Invalid itinerary structure")
        toast({
          title: "Structure Error",
          description: "The generated itinerary has an invalid structure. Using sample data instead.",
          variant: "destructive"
        })
        // Fall back to sample data
        parsedData = sampleItinerary
      }

      // Process the generated itinerary
      const processedItinerary = {
        ...parsedData,
        items: parsedData.items.map((section: ItineraryData['items'][0]) => ({
          ...section,
          activities: section.activities.map((activity: ItineraryData['items'][0]['activities'][0]) => {
            // Find a matching image from the sample itinerary based on tags and title
            let matchingImage = burnham // Default image
            let bestMatchScore = 0
            
            // Try to find a matching activity in the sample itinerary
            for (const sampleSection of sampleItinerary.items) {
              for (const sampleActivity of sampleSection.activities) {
                let currentScore = 0
                
                // Check for title match (highest priority)
                if (activity.title && sampleActivity.title) {
                  const activityTitle = activity.title.toLowerCase()
                  const sampleTitle = sampleActivity.title.toLowerCase()
                  
                  // Exact title match
                  if (activityTitle === sampleTitle) {
                    currentScore += 10
                  } 
                  // Partial title match
                  else if (activityTitle.includes(sampleTitle) || sampleTitle.includes(activityTitle)) {
                    currentScore += 5
                  }
                  // Word match in title
                  else {
                    const activityWords = activityTitle.split(/\s+/)
                    const sampleWords = sampleTitle.split(/\s+/)
                    
                    for (const word of activityWords) {
                      if (word.length > 3 && sampleWords.includes(word)) { // Only consider words longer than 3 chars
                        currentScore += 2
                      }
                    }
                  }
                }
                
                // Check for tag matches
                if (activity.tags && sampleActivity.tags) {
                  for (const tag of activity.tags) {
                    if (sampleActivity.tags.includes(tag)) {
                      currentScore += 3
                    }
                  }
                }
                
                // Update best match if this activity has a higher score
                if (currentScore > bestMatchScore) {
                  bestMatchScore = currentScore
                  matchingImage = sampleActivity.image
                }
              }
            }
            
            // Add weather-appropriate tags if not already present
            const tags = [...(activity.tags || [])]
            const weatherCondition = weatherData?.weather?.[0]?.main?.toLowerCase() || ""
            
            // Add weather tags if they don't already exist
            if (weatherCondition.includes("rain") && !tags.includes("Indoor-Friendly")) {
              tags.push("Indoor-Friendly")
            } else if (weatherCondition.includes("clear") && !tags.includes("Outdoor-Friendly")) {
              tags.push("Outdoor-Friendly")
            } else if (!tags.includes("Weather-Flexible")) {
              tags.push("Weather-Flexible")
            }
            
            return {
              ...activity,
              image: matchingImage,
              tags: tags
            }
          })
        }))
      }

      setGeneratedItinerary(processedItinerary)
      setShowPreview(true)
    } catch (error) {
      console.error("Error generating itinerary:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Using sample data instead.",
        variant: "destructive"
      })
      setGeneratedItinerary(sampleItinerary)
      setShowPreview(true)
    } finally {
      setIsGenerating(false)
      setIsLoadingItinerary(false);
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
        weatherData: weatherData ? weatherData : undefined, // Corrected line
        itineraryData: generatedItinerary || sampleItinerary,
      }
      saveItinerary(itineraryToSave)
      toast({
        title: "Success",
        description: "Itinerary saved!",
        variant: "success"
      })
      setTimeout(() => {
        router.push("/saved-trips")
      }, 1200)
    } catch (error) {
      console.error("Failed to save itinerary:", error)
      toast({
        title: "Error",
        description: "Failed to save itinerary. Please try again.",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <main className="md:pl-64 flex-1 flex flex-col md:flex-row md:items-stretch justify-start gap-8 p-4 md:p-12 pt-16 md:pt-12">
        {/* Left: Form */}
        <div className={cn(
          "w-full bg-white rounded-2xl h-full p-8 shadow-md",
          showPreview ? "lg:max-w-3xl" : "max-w-3xl"
        )}>
          <div className="text-lg bg-white font-extrabold mb-6 text-black">Let&apos;s Plan Your Baguio Adventure</div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Budget Range */}
            <div>
              <Label htmlFor="budget" className="block font-bold mb-2 text-gray-900">Budget Range</Label>
              <select
                id="budget"
                className={cn(
                  "w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2",
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
              <Label className="block font-bold mb-2 text-gray-900">Number of Pax.</Label>
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
              <Label className="block font-bold mb-2 text-gray-900">Duration</Label>
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
              <Label className="block font-bold mb-2 text-gray-900">Travel Dates</Label>
              <div className="flex gap-3 lg:mr-48">
                <Input
                  type="date"
                  className={cn(
                    "border rounded-xl px-4 py-2 w-full focus:outline-none focus:ring-2",
                    showPreview
                      ? 'border-gray-300'
                      : dates.start
                        ? 'border-blue-500 focus:ring-blue-400'
                        : 'border-gray-300 focus:ring-blue-400 hover:border-blue-500'
                  )}
                  value={dates.start}
                  onChange={e => setDates({ ...dates, start: e.target.value })}
                  disabled={showPreview}
                  placeholder="mm/dd/yyyy"
                />
                <Input
                  type="date"
                  className={cn(
                    "border rounded-xl px-4 py-2 w-full focus:outline-none focus:ring-2",
                    showPreview
                      ? 'border-gray-300'
                      : dates.end
                        ? 'border-blue-500 focus:ring-blue-400'
                        : 'border-gray-300 focus:ring-blue-400 hover:border-blue-500'
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
                      "flex items-center justify-center gap-2 py-3 font-medium transition",
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
        {/* Conditional rendering for loading, error, or itinerary data */}
        {isLoadingItinerary ? (
          <div className="w-full lg:w-[370px] lg:ml-4 flex flex-col items-center justify-center bg-white/80 z-10 rounded-2xl shadow-md p-6 h-[90vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg font-semibold text-gray-700">Generating your itinerary...</p>
            <p className="text-md font-semibold text-gray-700">Thinking mode...</p>
            <p className="text-sm text-gray-500">This might take a moment. Please wait.</p>
          </div>
        ) : showPreview && generatedItinerary ? (
          <aside className={cn(
            "w-full lg:w-[370px] lg:ml-4 h-[90vh] overflow-y-auto", // Changed max-h to h-[80vh]
            showPreview ? "block" : "hidden"
          )}>
            <div className="bg-white rounded-2xl shadow-md p-6"> 
              <div className="mb-2 text-sm text-gray-900 font-bold">{generatedItinerary?.title || sampleItinerary.title}</div>
              <div className="mb-4 text-xs text-gray-700">{generatedItinerary?.subtitle || sampleItinerary.subtitle}</div>
              
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
                    <div key={i} className="bg-white rounded-xl shadow-md mb-4 overflow-hidden border border-gray-100">
                      <Image src={act.image} alt={act.title} width={400} height={128} className="w-full h-32 object-cover" />
                      <div className="p-4">
                        <div className="font-semibold text-gray-900 text-base mb-1">{act.title}</div>
                        <div className="text-xs text-gray-500 mb-2">{act.time}</div>
                        <div className="text-sm text-gray-700 mb-3">{act.desc}</div>
                        <div className="flex gap-2 flex-wrap">
                          {act.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-block bg-white rounded-lg px-2 py-1 text-xs font-medium text-gray-500 border border-gray-300"
                            >
                              {tag}
                            </span>
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
        ) : (
          <aside className={cn(
            "w-full lg:w-[370px] lg:ml-4 h-full",
            !showPreview ? "block" : "hidden" /* Show when not previewing */
          )}>
            <div className="bg-white rounded-2xl shadow-md p-6 h-[90vh] overflow-y-auto flex flex-col items-center justify-center">
                <Image src={taranaai} alt="Plan your trip icon" width={100} height={100} className="text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Plan Your Perfect Trip</h3>
                <p className="text-gray-500 text-center">Fill in the details on the left to generate your personalized Baguio itinerary.</p>
            </div>
          </aside>
        )}
      </main>
    </div>
  )
}
