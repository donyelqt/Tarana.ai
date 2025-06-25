'use client';

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AboutIntro from "@/components/about/AboutIntro";
import AboutMission from "@/components/about/AboutMission";
import AboutHowItWorks from "@/components/about/AboutHowItWorks";
import AboutTeam from "@/components/about/AboutTeam";
import AboutSmartTravel from "@/components/about/AboutSmartTravel";

export default function AboutPage() {
  return (
    <div className="font-sans bg-white min-h-screen">
      <Navbar />
      <main>
        <AboutIntro onJoinWaitlistClick={() => {}} />
        <AboutSmartTravel />
        <AboutMission />
        <AboutHowItWorks />
        <AboutTeam />
      </main>
      <Footer />
    </div>
  );
} 