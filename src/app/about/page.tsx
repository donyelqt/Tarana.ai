'use client';

import Navbar from "@/components/Navbar";
import AboutIntro from "@/components/about/AboutIntro";
import AboutTeam from "@/components/about/AboutTeam";
import AboutSmartTravel from "@/components/about/AboutSmartTravel";
import AboutPotentialImpact from "@/components/about/AboutPotentialImpact";
import Footer from "@/components/Footer";

export default function AboutPage() {
  return (
    <div className="font-sans bg-white min-h-screen">
      <Navbar />
      <main>
        <AboutIntro onJoinWaitlistClick={() => {}} />
        <AboutSmartTravel />
        <AboutPotentialImpact />
        <AboutTeam />
        <Footer />
      </main>
    </div>
  );
} 