import { GoogleGenAI } from "@google/genai";
import { NarrativeLog } from '../types';

// Safely access the API key
const apiKey = process.env.API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const SYSTEM_INSTRUCTION = `
You are the "Central Command" AI for the Void Harvester Corps. 
You communicate with a "Shepherd" pilot towing asteroids into black holes.
Your tone is cold, corporate, slightly ominous, and sci-fi.
Keep messages short (under 25 words).
React to the pilot's performance (level completion, game over, high score).
Mention "Exotic Matter", "The Singularity", "Quotas", and "Event Horizons".
`;

export const generateMissionBriefing = async (level: number, score: number, type: 'start' | 'success' | 'fail'): Promise<NarrativeLog> => {
  if (!ai) {
    return {
      sender: 'SYS_OFFLINE',
      message: 'Neural link severed. Local protocols engaged.',
      timestamp: new Date().toLocaleTimeString()
    };
  }

  const prompt = `
    Context: Sci-fi game "Singularity Shepherd".
    Current Status: Level ${level}, Score ${score}.
    Event Type: ${type}.
    
    Write a short transmission message to the pilot.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: 50,
        temperature: 0.8,
      },
    });

    return {
      sender: 'CENTRAL_CMD',
      message: response.text ? response.text.trim() : 'Transmission corrupted.',
      timestamp: new Date().toLocaleTimeString()
    };
  } catch (error) {
    console.error("AI Generation Error:", error);
    return {
      sender: 'ERROR',
      message: 'Subspace interference detected.',
      timestamp: new Date().toLocaleTimeString()
    };
  }
};