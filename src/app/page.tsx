import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import Navbar from "@/components/Navbar";
import StickyDots from "@/components/StickyDots";
import TravelersSection from "@/components/TravelersSection";
import WhyUseSection from "@/components/WhyUseSection";


export default function Home() {
  return (
    <div className="font-sans">
      <Navbar />
      <StickyDots />
      <main>
        <HeroSection id="hero" />
        <HowItWorksSection id="how-it-works" />
        <WhyUseSection id="why-use" />
        <TravelersSection id="travelers" />
        <Footer />
      </main>
    </div>
  )
}
