import Footer from "./components/Footer"
import TravelersSection from "./components/TravelersSection"
import HowItWorksSection from "./components/HowItWorksSection"
import WhyUseSection from "./components/WhyUseSection"
import HeroSection from "./components/HeroSection"
import Navbar from "./components/Navbar"

function App() {
  return (
    <div className="font-sans">
      <Navbar />
      <main>
        <HeroSection />
        <WhyUseSection />
        <HowItWorksSection />
        <TravelersSection />
        <Footer />
      </main>
    </div>
  )
}

export default App
