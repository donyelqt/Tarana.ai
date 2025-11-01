import Link from "next/link"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { Facebook, Instagram, Mail, MapPin } from "lucide-react"

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <section className="space-y-10">
            <div className="space-y-6">
              <h1 className="text-4xl sm:text-5xl font-semibold text-gray-900">Contact Us</h1>
              <p className="text-lg leading-relaxed text-gray-600 max-w-xl">
                Whether you&apos;re a traveler, business owner, city official, or curious supporter —
                we&apos;re here to answer your questions and explore meaningful partnerships.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white">
                  <Mail className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.14em] text-gray-400">E-mail</p>
                  <Link
                    href="mailto:taranaai.travelplanner@gmail.com"
                    className="mt-1 block text-lg font-medium text-gray-900 hover:text-blue-600"
                  >
                    taranaai.travelplanner@gmail.com
                  </Link>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white">
                  <MapPin className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.14em] text-gray-400">Location</p>
                  <p className="mt-1 text-lg font-medium text-gray-900">
                    InTTO Office, UC Legarda, Baguio City, Philippines
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-gray-400">Stay Connected</p>
              <div className="flex items-center gap-4">
                <Link
                  href="https://www.facebook.com/tarana.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow Tarana.ai on Facebook"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-blue-300 text-blue-500 transition-colors hover:border-blue-500 hover:text-blue-600"
                >
                  <Facebook className="h-6 w-6" aria-hidden="true" />
                </Link>
                <Link
                  href="https://www.instagram.com/tarana.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow Tarana.ai on Instagram"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-blue-300 text-blue-500 transition-colors hover:border-blue-500 hover:text-blue-600"
                >
                  <Instagram className="h-6 w-6" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>

          <section>
            <div className="rounded-[32px] bg-[#F4F7FF] p-8 shadow-sm ring-1 ring-inset ring-blue-100">
              <form className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    className="w-full rounded-2xl border border-transparent bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    className="w-full rounded-2xl border border-transparent bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="subject" className="text-sm font-medium text-gray-700">
                    Subject
                  </label>
                  <input
                    id="subject"
                    type="text"
                    placeholder="e.g. Partnership Inquiry, Feedback, Support"
                    className="w-full rounded-2xl border border-transparent bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium text-gray-700">
                    Subject
                  </label>
                  <textarea
                    id="message"
                    placeholder="e.g. Partnership Inquiry, Feedback, Support"
                    rows={5}
                    className="w-full rounded-2xl border border-transparent bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-gradient-to-r from-[#0066FF] to-[#1E3CF3] px-4 py-3 text-base font-semibold text-white shadow-lg shadow-blue-200 transition-transform hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-blue-200"
                >
                  Submit
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
