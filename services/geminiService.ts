
import { GoogleGenAI } from "@google/genai";
import { User } from "../types";

// Always use process.env.API_KEY directly in the constructor as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getPerformanceInsights = async (user: User) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this trader's performance and provide a short, motivating summary for a Telegram bot:
        - Trades taken: ${user.tradesCount}
        - Total Points: ${user.points}
        - Trial Goal: 10 Trades & 10 Points
        - History: ${JSON.stringify(user.history)}`,
      config: {
        systemInstruction: "You are a professional trading coach. Keep responses brief (under 100 words), direct, and in English. Focus on the risk-reward ratio and the path to trial completion.",
      },
    });

    // Access the .text property directly as it is a getter, not a method.
    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error analyzing performance data.";
  }
};
