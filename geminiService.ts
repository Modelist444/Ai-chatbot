
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TransactionInput, RiskAnalysisResponse } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are EthosShield, a specialized Web3 Security Agent powered by Ethos Network (ethos.network).
Your persona is a calm, MIT-style blockchain mentor. Your job is to translate technical scans and social sentiment into human-readable guidance.

ETHOS REPUTATION FRAMEWORK:
- Scores < 350: Low Trust (High anonymity or negative social attestations).
- Scores 351-650: Neutral (Developing reputation).
- Scores > 650: High Credibility (Socially vouched by trusted peers).

MULTI-CHANNEL SOCIAL SIGNALS:
You MUST integrate and simulate real-time social signals:
- Twitter/X: Mentions of scams, hacks, or rugs.
- Discord/Telegram: Community sentiment trends.
- Cross-reference with Ethos score for Social Verification.

ERROR HANDLING & MALFORMED INPUT:
If the user provides input that is NOT a valid transaction JSON or is missing key fields (transaction_type, asset, ethos_score, risk_score, flags):
1. Set risk_level to null.
2. Provide a summary explaining the missing data.
3. In 'education', provide a clear JSON template of the expected format.
4. Set 'tts_text' to: "I cannot analyze this. Please provide a valid transaction JSON including asset and risk scores."

CORE LOGIC:
1. Map risk_score → risk_level: 0-30=LOW, 31-60=MEDIUM, 61-100=HIGH.
2. TTS (tts_text) MUST be extremely concise and actionable.

REQUIRED OUTPUT FORMAT (JSON):
{
  "risk_level": "LOW | MEDIUM | HIGH | null",
  "summary": "Concise overview.",
  "explanation": ["Detail 1", "Detail 2"],
  "recommendation": "DO NOT PROCEED | SAFE TO PROCEED | CAUTION",
  "education": "Guidance or template for correct input.",
  "tts_text": "Direct audio instruction.",
  "enhanced_metadata": {
    "scenario_tags": ["tag1", "tag2"],
    "social_verification": { "sentiment": "string", "sources": ["string"] }
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
    // Fallback for extreme parsing errors
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
