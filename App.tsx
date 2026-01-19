
import React, { useState, useRef, useEffect } from 'react';
import { Shield, Send, Terminal, Cpu, Database, ChevronRight, RefreshCw, Trash2, Volume2, VolumeX, Mic, MicOff, X, AudioLines } from 'lucide-react';
import { TransactionInput, Message, Modality } from './types';
import { analyzeTransaction, generateSpeech } from './geminiService';
import { AnalysisCard } from './components/AnalysisCard';
import { playPCM, decodeBase64, decodeAudioData, encode } from './audioUtils';
import { GoogleGenAI } from "@google/genai";

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
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState<{user: string, ai: string}>({user: '', ai: ''});
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Live API Refs
  const sessionRef = useRef<any>(null);
  const audioContextsRef = useRef<{input: AudioContext, output: AudioContext} | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, liveTranscription]);

  const stopLiveSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close?.();
      sessionRef.current = null;
    }
    if (audioContextsRef.current) {
      audioContextsRef.current.input.close();
      audioContextsRef.current.output.close();
      audioContextsRef.current = null;
    }
    setIsLiveActive(false);
    setLiveTranscription({user: '', ai: ''});
  };

  const startLiveSession = async () => {
    try {
      setIsLiveActive(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };

      let nextStartTime = 0;
      const sources = new Set<AudioBufferSourceNode>();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get current dashboard data to inject into context
      let currentDashboardContext = "No scan data provided yet.";
      try {
        const parsed = JSON.parse(inputJson);
        currentDashboardContext = `The current transaction scan on the user's dashboard is: ${JSON.stringify(parsed)}. Please use this data to answer the user's questions specifically about this transaction.`;
      } catch (e) {
        currentDashboardContext = "The user has provided invalid JSON on their dashboard, please help them fix it or speak generally.";
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: any) => {
            // Handle Audio
            const audioBase64 = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioBase64) {
              nextStartTime = Math.max(nextStartTime, outputCtx.currentTime);
              const bytes = decodeBase64(audioBase64);
              const buffer = await decodeAudioData(bytes, outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.start(nextStartTime);
              nextStartTime += buffer.duration;
              sources.add(source);
              source.onended = () => sources.delete(source);
            }

            // Handle Interrupts
            if (message.serverContent?.interrupted) {
              sources.forEach(s => s.stop());
              sources.clear();
              nextStartTime = 0;
            }

            // Handle Transcriptions
            if (message.serverContent?.inputTranscription) {
              setLiveTranscription(prev => ({ ...prev, user: prev.user + message.serverContent.inputTranscription.text }));
            }
            if (message.serverContent?.outputTranscription) {
              setLiveTranscription(prev => ({ ...prev, ai: prev.ai + message.serverContent.outputTranscription.text }));
            }
            if (message.serverContent?.turnComplete) {
              setLiveTranscription({ user: '', ai: '' });
            }
          },
          onclose: () => stopLiveSession(),
          onerror: (e) => {
            console.error("Live Error", e);
            stopLiveSession();
          }
        },
        config: {
          responseModalities: ['AUDIO' as any],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are Safe Send AI. You help users understand Web3 risks through natural voice conversation. Be calm, professional, and educational. 
          
          DASHBOARD CONTEXT:
          ${currentDashboardContext}
          
          When users speak, prioritize interpreting the dashboard data above. Explain potential risks and give guidance. Do not calculate exact scores, but interpret the context safely based on the flags and risk levels provided in the context.`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Failed to start voice session", err);
      setIsLiveActive(false);
    }
  };

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

      if (isVoiceEnabled) {
        const speechText = `Risk level is ${analysis.risk_level}. ${analysis.summary} My recommendation is: ${analysis.recommendation}.`;
        const audioData = await generateSpeech(speechText);
        if (audioData) await playPCM(audioData);
      }
    } catch (e: any) {
      setError(e.message || "Invalid JSON or network error.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-[#0a0f1d] selection:bg-indigo-500/30 text-slate-100">
      {/* Sidebar */}
      <div className="w-full md:w-[400px] border-b md:border-b-0 md:border-r border-slate-800 flex flex-col bg-[#0f172a] shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Shield className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-white uppercase italic">Safe Send</h1>
            <p className="text-[10px] text-indigo-400/60 font-bold tracking-[0.2em]">WEB3 SECURITY LAYER</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Voice Live Button */}
          <div className="space-y-2">
            <button
              onClick={isLiveActive ? stopLiveSession : startLiveSession}
              className={`w-full py-4 rounded-xl border flex items-center justify-center gap-3 transition-all duration-500 group relative overflow-hidden ${
                isLiveActive 
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' 
                  : 'bg-indigo-600 border-indigo-500 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40'
              }`}
            >
              {isLiveActive ? (
                <>
                  <div className="absolute inset-0 bg-rose-500/5 animate-pulse" />
                  <MicOff className="w-5 h-5 animate-bounce" />
                  <span className="font-bold tracking-tight">STOP VOICE MODE</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="font-bold tracking-tight">START VOICE MODE</span>
                  <div className="ml-2 flex gap-0.5">
                    <div className="w-1 h-3 bg-white/40 rounded-full animate-[bounce_1s_infinite_0s]" />
                    <div className="w-1 h-3 bg-white/40 rounded-full animate-[bounce_1s_infinite_0.2s]" />
                    <div className="w-1 h-3 bg-white/40 rounded-full animate-[bounce_1s_infinite_0.4s]" />
                  </div>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-500 font-medium px-2">
              Voice mode links directly to the scanner data below.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Database className="w-3 h-3 text-indigo-400" />
                Scanner Input
              </label>
            </div>
            <textarea
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              className="w-full h-64 bg-[#020617] border border-slate-800 rounded-xl p-4 text-indigo-300 mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none shadow-inner"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Volume2 className="w-3 h-3" />
                Auto-TTS
              </h4>
              <button 
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${isVoiceEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${isVoiceEnabled ? 'translate-x-5.5' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 bg-[#0f172a]">
          <button
            onClick={handleAnalyze}
            disabled={isLoading || isLiveActive}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-700"
          >
            {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Terminal className="w-5 h-5" />}
            RUN MANUAL SCAN
          </button>
        </div>
      </div>

      {/* Main View */}
      <div className="flex-1 flex flex-col relative bg-[#0a0f1d]">
        <header className="h-16 border-b border-slate-800/60 flex items-center justify-between px-6 bg-[#0f172a]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
            <span className="text-sm font-bold tracking-tight text-slate-300">
              {isLiveActive ? 'Live Voice Session' : 'Safe Send Analysis Engine'}
            </span>
          </div>
          <button onClick={clearHistory} className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
          {/* Live Overlay */}
          {isLiveActive && (
            <div className="fixed inset-0 top-16 z-50 bg-[#0a0f1d]/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
              <div className="max-w-xl w-full space-y-12">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-full" />
                  <div className="relative flex justify-center gap-1.5 h-16 items-center">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className={`w-1.5 bg-indigo-400 rounded-full animate-waveform`} style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Voice Transcription</p>
                    <p className="text-2xl font-medium text-slate-200 min-h-[3rem]">
                      {liveTranscription.user || "Listening for transaction details..."}
                    </p>
                  </div>
                  
                  {liveTranscription.ai && (
                    <div className="p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl animate-in slide-in-from-bottom-4">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-3">AI Response</p>
                      <p className="text-lg text-indigo-100 leading-relaxed">{liveTranscription.ai}</p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={stopLiveSession}
                  className="bg-rose-600 hover:bg-rose-500 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-rose-900/20 transition-all flex items-center gap-2 mx-auto"
                >
                  <X className="w-5 h-5" /> END SESSION
                </button>
              </div>
            </div>
          )}

          {messages.length === 0 && !isLiveActive && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4 opacity-50">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700">
                <Shield className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-sm font-medium">Ready for real-time risk assessment.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'bg-slate-800 border border-slate-700' : 'glass'} rounded-2xl p-6 shadow-xl`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {msg.role === 'user' ? 'SCANNED DATA' : 'EXPLANATION'}
                  </span>
                </div>
                {msg.analysis ? <AnalysisCard analysis={msg.analysis} /> : <p className="text-slate-300 leading-relaxed">{msg.content}</p>}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 text-center border-t border-slate-800/30 bg-[#0a0f1d]/50">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">
            Verified Security Protocol V2.5.0
          </p>
        </div>
      </div>

      <style>{`
        @keyframes waveform {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.5); }
        }
        .animate-waveform {
          animation: waveform 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
