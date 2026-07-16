
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedGameIdea } from "../types";

export const generateGameIdeas = async (
  duration: number,
  intensity: 'Low' | 'Medium' | 'High'
): Promise<GeneratedGameIdea> => {

  // Robust check for API key availability
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    console.warn("Gemini API Key missing or placeholder. Returning fallback content.");
    return {
      title: "Obstacle Course Relay",
      description: "A classic obstacle course where teams compete to finish fastest. Includes jumping jacks, crawling, and balancing.",
      suggestedDuration: duration || 10
    };
  }

  try {
    // Initialize inside function to avoid module-level crashes
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Create a fun, creative fitness game for children (ages 6-12) for a fitness academy. 
    Duration: ${duration} minutes. 
    Intensity: ${intensity}. 
    Focus on teamwork and movement.
    Return ONLY JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            suggestedDuration: { type: Type.NUMBER },
          },
          required: ["title", "description", "suggestedDuration"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as GeneratedGameIdea;

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
       title: "Tag (Offline Mode)",
       description: "Classic tag game. (AI currently unavailable)",
       suggestedDuration: 15
    }
  }
};
