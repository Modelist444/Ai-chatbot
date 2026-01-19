
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TransactionInput, RiskAnalysisResponse } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are EthosShield, a specialized Web3 Security Agent powered by Ethos Network (ethos.network).
Your persona is a calm, MIT-style blockchain mentor. Your job is to translate technical scans and social sentiment into human-readable guidance.

ETHOS REPUTATION FRAMEWORK:
- Scores < 350: Low Trust (High anonymity or negative social attestations).
- Scores 351-650: Neutral/Emerging (Developing reputation).
- Scores > 650: High Credibility (Socially vouched by trusted peers).

CORE SECURITY LOGIC:
1. Map risk_score → risk_level: 0-30=LOW, 31-60=MEDIUM, 61-100=HIGH.
2. CONFLICT CHECK: If risk_level is LOW but flags include 'known_scam_contract', 'rugpull_indicators', or 'honeypot_risk', you MUST flag "Conflicting Signals" in the explanation.
3. SANDBOX SIMULATION: Calculate potential loss (e.g., "Entire balance of [Asset]" for unlimited approvals).

REQUIRED OUTPUT FORMAT (JSON):
{
  "risk_level": "LOW | MEDIUM | HIGH | null",
  "summary": "Concise overview.",
  "explanation": ["Bullet points explaining technical and social markers."],
  "recommendation": "DO NOT PROCEED | SAFE TO PROCEED | CAUTION",
  "education": "Context on specific scam mechanics (e.g. honeypots, approvals).",
  "tts_text": "EXTREMELY CONCISE direct audio instruction.",
  "enhanced_metadata": {
    "scenario_tags": ["scam", "approval", "reputation_low", etc],
    "social_verification": { "sentiment": "suspicious|neutral|positive", "sources": ["Twitter", "Discord"] },
    "sandbox_simulation": {
      "potential_loss": "String description of what is at stake",
      "flow": ["Step 1", "Step 2"]
    }
  }
}
`;

export const analyzeTransaction = async (input: any): Promise<RiskAnalysisResponse> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: typeof input === 'string' ? input : JSON.stringify(input),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            risk_level: { type: Type.STRING, nullable: true },
            summary: { type: Type.STRING },
            explanation: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendation: { type: Type.STRING },
            education: { type: Type.STRING },
            tts_text: { type: Type.STRING },
            enhanced_metadata: {
              type: Type.OBJECT,
              properties: {
                scenario_tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                social_verification: {
                  type: Type.OBJECT,
                  properties: {
                    sentiment: { type: Type.STRING },
                    sources: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                },
                sandbox_simulation: {
                  type: Type.OBJECT,
                  properties: {
                    potential_loss: { type: Type.STRING },
                    flow: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              }
            }
          },
          required: ["summary", "explanation", "recommendation", "tts_text"]
        }
      }
    });

    const result = JSON.parse(response.text);
    return result as RiskAnalysisResponse;
  } catch (error) {
    console.error("EthosShield Analysis Error:", error);
    return {
      risk_level: null as any,
      summary: "Protocol Error: Unable to parse telemetry.",
      explanation: ["The input provided does not follow the required JSON structure."],
      recommendation: "CAUTION" as any,
      education: "Expected format: { \"transaction_type\": \"...\", \"asset\": \"...\", \"ethos_score\": 0-1000, \"risk_score\": 0-100, \"flags\": [] }",
      tts_text: "Data error. Please provide a valid transaction scan."
    };
  }
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
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
