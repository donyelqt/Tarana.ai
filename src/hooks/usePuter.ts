import { useEffect, useState } from "react";

// Expose the puter namespace on the Window interface
declare global {
  interface Window {
    puter?: any;
  }
}

/**
 * usePuter
 * ---------
 * Dynamically injects the Puter.js script (https://js.puter.com/v2/) on first mount
 * and returns the `window.puter` object once the script has finished loading.
 *
 * Components can call the hook and then invoke `puter.ai.chat(...)` once the
 * returned object is non-null.
 */
export default function usePuter() {
  const [puter, setPuter] = useState<any | null>(null);

  useEffect(() => {
    // If it's already loaded, just use it
    if (typeof window !== "undefined" && window.puter) {
      setPuter(window.puter);
      return;
    }

    // Otherwise, inject the script tag exactly once
    const scriptId = "puter-js-sdk";
    if (document.getElementById(scriptId)) {
      // Script tag is already in the document but not yet loaded
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://js.puter.com/v2/";
    script.async = true;
    script.onload = () => {
      // After loading, window.puter should be available
      setPuter(window.puter);
    };
    script.onerror = () => {
      console.error("Failed to load Puter.js");
    };

    document.body.appendChild(script);
  }, []);

  return puter;
} 