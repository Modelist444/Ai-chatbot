# Safe Send AI - Full Source Code

This document contains the complete source code for the Safe Send AI Web3 Risk Interpreter. You can copy these blocks into their respective files to recreate the application.

## 1. metadata.json
```json
{
  "name": "Safe Send AI",
  "description": "A Web3 Risk Explanation Chatbot that interprets blockchain transaction scans into human-readable, actionable security guidance.",
  "requestFramePermissions": []
}
```

## 2. index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Safe Send AI</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #0f172a;
            color: #f8fafc;
        }
        .mono {
            font-family: 'JetBrains Mono', monospace;
        }
        .glass {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
    </style>
<script type="importmap">
{
  "imports": {
    "lucide-react": "https://esm.sh/lucide-react@^0.562.0",
    "react/": "https://esm.sh/react@^19.2.3/",
    "react": "https://esm.sh/react@^19.2.3",
    "react-dom/": "https://esm.sh/react-dom@^19.2.3/",
    "@google/genai": "https://esm.sh/@google/genai@^1.37.0"
  }
}
</script>
</head>
<body>
    <div id="root"></div>
</body>
</html>
```

## 3. index.tsx
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## 4. types.ts
```ts
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export enum Recommendation {
  DO_NOT_PROCEED = 'DO NOT PROCEED',
  SAFE_TO_PROCEED = 'SAFE TO PROCEED',
  CAUTION = 'CAUTION'
}

export interface TransactionInput {
  transaction_type: string;
  asset: string;
  ethos_score: number;
  risk_score: number;
  flags: string[];
}

export interface RiskAnalysisResponse {
  risk_level: RiskLevel;
  summary: string;
  explanation: string[];
  recommendation: Recommendation;
  education?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  analysis?: RiskAnalysisResponse;
  rawInput?: TransactionInput;
  timestamp: number;
}
```

## 5. audioUtils.ts
```ts
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export async function playPCM(base64Audio: string) {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const bytes = decodeBase64(base64Audio);
  const audioBuffer = await decodeAudioData(bytes, audioContext);
  
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();
}
```

## 6. geminiService.ts
```ts
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
```

## 7. App.tsx
```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Shield, Send, Terminal, Cpu, Database, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';
import { TransactionInput, Message } from './types';
import { analyzeTransaction } from './geminiService';
import { AnalysisCard } from './components/AnalysisCard';

const INITIAL_INPUT: TransactionInput = {
  transaction_type: "ERC20_APPROVAL",
  asset: "USDC",
  ethos_score: 320,
  risk_score: 78,
  flags: ["unlimited_approval", "known_scam_contract"]
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputJson, setInputJson] = useState(JSON.stringify(INITIAL_INPUT, null, 2));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleAnalyze = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const parsedInput: TransactionInput = JSON.parse(inputJson);
      
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: `Analyzing ${parsedInput.transaction_type} for ${parsedInput.asset}...`,
        rawInput: parsedInput,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, userMessage]);

      const analysis = await analyzeTransaction(parsedInput);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: analysis.summary,
        analysis: analysis,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e: any) {
      setError(e.message || "Invalid JSON or network error. Please check your scanner input.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    setError(null);
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputJson(e.target.value);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-[#0a0f1d] selection:bg-indigo-500/30">
      <div className="w-full md:w-[400px] border-b md:border-b-0 md:border-r border-slate-800 flex flex-col bg-[#0f172a] shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <Shield className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-white">Safe Send AI</h1>
            <p className="text-xs text-slate-500 font-medium">BLOCKCHAIN RISK INTERPRETER</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Database className="w-3 h-3" />
                Scanner Input (JSON)
              </label>
              <button 
                onClick={() => setInputJson(JSON.stringify(INITIAL_INPUT, null, 2))}
                className="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors uppercase font-bold"
              >
                Reset Example
              </button>
            </div>
            <textarea
              value={inputJson}
              onChange={handleJsonChange}
              className="w-full h-80 bg-[#020617] border border-slate-800 rounded-xl p-4 text-indigo-300 mono text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none shadow-inner"
              placeholder="Paste transaction scanner data..."
            />
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400 font-medium animate-pulse">
                {error}
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Cpu className="w-3 h-3" />
              Scan Parameters
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-slate-800/50 rounded border border-slate-700/50">
                <span className="block text-slate-500 mb-1">Ethos Reputation</span>
                <span className="text-indigo-300 font-mono">SOCIAL SIGS</span>
              </div>
              <div className="p-2 bg-slate-800/50 rounded border border-slate-700/50">
                <span className="block text-slate-500 mb-1">Risk Heuristics</span>
                <span className="text-indigo-300 font-mono">ALGO ANALYSIS</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800">
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 group"
          >
            {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Terminal className="w-5 h-5" />}
            {isLoading ? "INTERPRETING..." : "PROCESS SCAN"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative bg-[#0a0f1d]">
        <header className="h-16 border-b border-slate-800/60 flex items-center justify-between px-6 bg-slate-900/20 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-semibold text-slate-300">Live Risk Engine Active</span>
          </div>
          <button 
            onClick={clearHistory}
            className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'bg-indigo-600/10 border border-indigo-500/20' : 'glass'} rounded-2xl p-6 shadow-xl`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {msg.role === 'user' ? 'INPUT DATA' : 'EXPLANATION ENGINE'}
                  </span>
                </div>
                {msg.analysis ? <AnalysisCard analysis={msg.analysis} /> : <p className="text-slate-300">{msg.content}</p>}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};

export default App;
```

## 8. components/RiskBadge.tsx
```tsx
import React from 'react';
import { RiskLevel } from '../types';

interface RiskBadgeProps {
  level: RiskLevel;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level }) => {
  const styles = {
    [RiskLevel.LOW]: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50',
    [RiskLevel.MEDIUM]: 'bg-amber-500/10 text-amber-400 border-amber-500/50',
    [RiskLevel.HIGH]: 'bg-rose-500/10 text-rose-400 border-rose-500/50',
  };

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-bold border uppercase tracking-wider ${styles[level]}`}>
      {level} RISK
    </span>
  );
};
```

## 9. components/AnalysisCard.tsx
```tsx
import React, { useState } from 'react';
import { RiskAnalysisResponse, Recommendation, RiskLevel } from '../types';
import { RiskBadge } from './RiskBadge';
import { AlertTriangle, ShieldCheck, Info, BookOpen, Volume2, Loader2, Copy, Check } from 'lucide-react';
import { generateSpeech } from '../geminiService';
import { playPCM } from '../audioUtils';

interface AnalysisCardProps {
  analysis: RiskAnalysisResponse;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ analysis }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSpeak = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const speechText = `Risk level is ${analysis.risk_level}. ${analysis.summary} My recommendation is: ${analysis.recommendation}.`;
      const audioData = await generateSpeech(speechText);
      if (audioData) await playPCM(audioData);
    } catch (error) {
      console.error("Failed to play audio", error);
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleCopy = () => {
    const reportText = `🛡️ Safe Send AI Report\nLevel: ${analysis.risk_level}\nSummary: ${analysis.summary}\nGuidance: ${analysis.recommendation}`;
    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg text-slate-100">Analysis</h3>
          <button onClick={handleSpeak} disabled={isSpeaking} className="p-1.5 rounded-lg bg-slate-800"><Volume2 className="w-4 h-4" /></button>
          <button onClick={handleCopy} className="p-1.5 rounded-lg bg-slate-800">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
        </div>
        <RiskBadge level={analysis.risk_level} />
      </div>
      <p className="text-slate-300 italic text-sm italic">"{analysis.summary}"</p>
      <ul className="space-y-2">
        {analysis.explanation.map((item, i) => (
          <li key={i} className="text-sm text-slate-300 flex gap-2"><span>•</span> {item}</li>
        ))}
      </ul>
      <div className="p-4 rounded-xl border bg-slate-800/50">
        <p className="font-bold">{analysis.recommendation}</p>
      </div>
    </div>
  );
};
```
