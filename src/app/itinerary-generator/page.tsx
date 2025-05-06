"use client"

import Sidebar from "../../components/Sidebar"
import { useState } from "react"
import Image from "next/image"

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
          image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
          title: "Breakfast at Goodtaste",
          time: "7:30AM-9:00AM",
          desc: "Fuel up with a hearty Filipino-Chinese breakfast at Goodtaste, a Baguio favorite for generous portions and fast service.",
          tags: ["Food & Culinary"]
        },
        {
          image: "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=400&q=80",
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
    // Save itinerary logic here
    alert("Itinerary saved!")
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex">
      <Sidebar />
      <main className="flex-1 flex flex-row items-start justify-start gap-8 p-4 md:p-12">
        {/* Left: Form */}
        <div className="w-full max-w-2xl bg-white rounded-2xl p-8 shadow-md">
          <div className="text-2xl font-bold mb-6 text-gray-900">Let’s Plan Your Baguio Adventure</div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Budget Range */}
            <div>
              <label className="block font-medium mb-2 text-gray-700">Budget Range</label>
              <select
                className={`w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 ${showPreview ? 'border-gray-300' : 'border-gray-300 focus:ring-blue-200'}`}
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
              <label className="block font-medium mb-2 text-gray-700">Number of Pax.</label>
              <div className="grid grid-cols-4 gap-3">
                {paxOptions.map(opt => (
                  <button
                    type="button"
                    key={opt}
                    className={`border rounded-lg py-2 font-medium transition ${pax === opt ? (showPreview ? 'bg-blue-600 border-blue-700 text-white' : 'bg-blue-100 border-blue-400 text-blue-700') : 'bg-white border-gray-300 text-gray-700'} ${showPreview ? 'cursor-not-allowed' : ''}`}
                    onClick={() => !showPreview && setPax(opt)}
                    disabled={showPreview}
                  >{opt}</button>
                ))}
              </div>
            </div>
            {/* Duration */}
            <div>
              <label className="block font-medium mb-2 text-gray-700">Duration</label>
              <div className="grid grid-cols-4 gap-3">
                {durationOptions.map(opt => (
                  <button
                    type="button"
                    key={opt}
                    className={`border rounded-lg py-2 font-medium transition ${duration === opt ? (showPreview ? 'bg-blue-600 border-blue-700 text-white' : 'bg-blue-100 border-blue-400 text-blue-700') : 'bg-white border-gray-300 text-gray-700'} ${showPreview ? 'cursor-not-allowed' : ''}`}
                    onClick={() => !showPreview && setDuration(opt)}
                    disabled={showPreview}
                  >{opt}</button>
                ))}
              </div>
            </div>
            {/* Travel Dates */}
            <div>
              <label className="block font-medium mb-2 text-gray-700">Travel Dates</label>
              <div className="flex gap-3">
                <input
                  type="date"
                  className={`border rounded-lg px-4 py-2 w-full focus:outline-none focus:ring-2 ${showPreview ? 'border-gray-300' : 'border-gray-300 focus:ring-blue-200'}`}
                  value={dates.start}
                  onChange={e => setDates({ ...dates, start: e.target.value })}
                  disabled={showPreview}
                />
                <input
                  type="date"
                  className={`border rounded-lg px-4 py-2 w-full focus:outline-none focus:ring-2 ${showPreview ? 'border-gray-300' : 'border-gray-300 focus:ring-blue-200'}`}
                  value={dates.end}
                  onChange={e => setDates({ ...dates, end: e.target.value })}
                  disabled={showPreview}
                />
              </div>
            </div>
            {/* Travel Interests */}
            <div>
              <label className="block font-medium mb-2 text-gray-700">Travel Interests</label>
              <div className="grid grid-cols-2 gap-3">
                {interests.map(({ label, icon }) => (
                  <button
                    type="button"
                    key={label}
                    className={`flex items-center justify-center gap-2 border rounded-lg py-2 font-medium transition ${selectedInterests.includes(label) ? (showPreview ? 'bg-blue-600 border-blue-700 text-white' : 'bg-blue-100 border-blue-400 text-blue-700') : 'bg-white border-gray-300 text-gray-700'} ${showPreview ? 'cursor-not-allowed' : ''}`}
                    onClick={() => !showPreview && handleInterest(label)}
                    disabled={showPreview}
                  >
                    <span>{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Generate Button */}
            <div>
              <button
                type="submit"
                className={`w-full font-semibold rounded-xl py-3 text-lg flex items-center justify-center gap-2 transition ${showPreview ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg' : 'bg-gray-600 hover:bg-gray-700 text-white'} ${showPreview ? 'cursor-not-allowed' : ''}`}
                disabled={showPreview}
              >
                Generate My Itinerary
                <span className="ml-2">→</span>
              </button>
            </div>
          </form>
        </div>
        {/* Right: Results Panel */}
        <aside className="hidden lg:block w-[370px] ml-4">
          {showPreview && (
            <div className="bg-white rounded-2xl shadow-md p-6 sticky top-8">
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
              <button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 text-lg flex items-center justify-center gap-2 transition mt-4"
                onClick={handleSave}
              >
                Save Itinerary
              </button>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}