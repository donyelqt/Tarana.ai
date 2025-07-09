export const puterConfig = {
  // Disable any default UI widgets or pop-ups provided by Puter.js
  ui: {
    showWidget: false, // hypothetical flag to hide the default popup badge
  },
  // Default AI settings – used wherever we invoke puter.ai.chat
  ai: {
    // Use the lightweight flash-lite model for speed
    model: "google/gemini-2.0-flash-lite-001",
    temperature: 0.2,      // lower => more deterministic & fewer tokens
    topK: 16,              // smaller candidate set speeds up generation
    topP: 0.8,             // limit nucleus sampling for faster convergence
    maxOutputTokens: 1024, // smaller responses generate quicker
    stream: false,         // disable streaming to reduce overhead
  },
}; 