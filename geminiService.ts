
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TransactionInput, RiskAnalysisResponse } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are a Web3 Risk Explanation Chatbot called "Safe Send AI".
Your job is to explain the risk of blockchain transactions using structured JSON inputs.
You do NOT calculate risk; you ONLY interpret and provide clear, calm guidance.

RULES:
1. Map risk_score to risk_level: 0-30 = LOW, 31-60 = MEDIUM, 61-100 = HIGH.
2. Use flags to produce detailed explanations.
3. Tone: Calm, neutral, educational. No hype. No financial advice.
4. Deterministic logic based on input.

REQUIRED OUTPUT FORMAT (JSON):
{
  "risk_level": "LOW | MEDIUM | HIGH",
  "summary": "One sentence overview",
  "explanation": ["Bullet point 1", "Bullet point 2"],
  "recommendation": "DO NOT PROCEED | SAFE TO PROCEED | CAUTION",
  "education": "Brief context on scam mechanics if applicable"
}
`;

export const analyzeTransaction = async (input: TransactionInput): Promise<RiskAnalysisResponse> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: JSON.stringify(input),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            risk_level: { type: Type.STRING },
            summary: { type: Type.STRING },
            explanation: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            recommendation: { type: Type.STRING },
            education: { type: Type.STRING }
          },
          required: ["risk_level", "summary", "explanation", "recommendation"]
        }
      }
    });

    const result = JSON.parse(response.text);
    return result as RiskAnalysisResponse;
  } catch (error) {
    console.error("Analysis Error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this risk report calmly and clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS Error:", error);
    return undefined;
  }
};
