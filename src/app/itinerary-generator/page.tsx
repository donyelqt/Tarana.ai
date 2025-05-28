"use client"

import Sidebar from "../../components/Sidebar"
import { useState } from "react"
import Image from "next/image"
import { burnham, goodtaste } from "../../../public"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { saveItinerary } from "@/lib/savedItineraries"
import { useRouter } from "next/navigation"
import Toast from "@/components/ui/Toast"

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
  const router = useRouter()

  const handleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowPreview(true)
  }

  const handleSave = () => {
    try {
      // Compose the itinerary object
      const itineraryToSave = {
        title: duration ? `Your ${duration} Itinerary` : "Your Itinerary",
        date: dates.start && dates.end ? `${dates.start} - ${dates.end}` : "Date not specified",
        budget,
        image: sampleItinerary.items[0].activities[0].image, // Use first activity image as cover
        tags: selectedInterests.length > 0 ? selectedInterests : sampleItinerary.items.flatMap(i => i.activities.flatMap(a => a.tags)),
        formData: {
          budget,
          pax,
          duration,
          dates,
          selectedInterests,
        },
        itineraryData: sampleItinerary,
      }
      saveItinerary(itineraryToSave)
      setToastMessage("Itinerary saved!")
      setShowToast(true)
      setTimeout(() => {
        router.push("/saved-trips")
      }, 1200)
    } catch {
      alert("Failed to save itinerary. Please try again.")
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
                  showPreview ? 'cursor-not-allowed' : ''
                )}
                disabled={showPreview}
              >
                Generate My Itinerary
                <span className="ml-2">→</span>
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
              <div className="mb-2 text-sm text-gray-500 font-medium">{sampleItinerary.title}</div>
              <div className="mb-4 text-xs text-gray-400">{sampleItinerary.subtitle}</div>
              {sampleItinerary.items.map((section, idx) => (
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