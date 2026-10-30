import { useEffect, useState } from "react";

declare global {
  interface Window {
    puter?: any;
  }
}

export default function usePuter() {
  const [puter, setPuter] = useState<any | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.puter) {
      setPuter(window.puter);
      return;
    }

    const scriptId = "puter-js-sdk";
    if (document.getElementById(scriptId)) {
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://js.puter.com/v2/";
    script.async = true;
    script.onload = () => {
      setPuter(window.puter);
    };
    script.onerror = () => {
      console.error("Failed to load Puter.js");
    };

    document.body.appendChild(script);
  }, []);

  return puter;
} 