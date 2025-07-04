"use client"
import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import TaranaEatsForm from "@/components/tarana-eats/TaranaEatsForm";
import FoodMatchesPreview from "@/components/tarana-eats/FoodMatchesPreview";

export default function TaranaEatsPage() {
  const [results, setResults] = useState(null);

  return (
    <div className="bg-white">
      <Sidebar />
      <main className="md:h-screen md:overflow-hidden md:pl-64 flex flex-col md:flex-row">
        <div className="flex-1 md:overflow-y-auto">
          <TaranaEatsForm onGenerate={setResults} />
        </div>
        <div className="w-full md:w-[450px] border-l md:overflow-y-auto">
          <FoodMatchesPreview results={results} />
        </div>
      </main>
    </div>
  );
}