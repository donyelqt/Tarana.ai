export const puterConfig = {
  ui: {
    showWidget: false, 
  },
  ai: {
    model: "google/gemini-2.0-flash-lite-001",
    temperature: 0.2,      
    topK: 16,              
    topP: 0.8,             
    maxOutputTokens: 1024, 
    stream: false,         
  },
}; 