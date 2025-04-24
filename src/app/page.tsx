import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import Navbar from "@/components/Navbar";
import TravelersSection from "@/components/TravelersSection";
import WhyUseSection from "@/components/WhyUseSection";


export default function Home() {
  return (
    <div className="font-sans">
      <Navbar />
      <main>
        <HeroSection />
        <WhyUseSection />
        <TravelersSection />
        <HowItWorksSection />
        <Footer />
      </main>
    </div>
  )
}
