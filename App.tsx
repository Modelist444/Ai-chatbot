
import React, { useState, useRef, useEffect } from 'react';
import { Shield, Send, Terminal, Cpu, Database, ChevronRight, RefreshCw, Trash2, Volume2, VolumeX, Mic, MicOff, X, AudioLines, ExternalLink, Activity, AlertCircle } from 'lucide-react';
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

      let currentDashboardContext = "User is currently providing data.";
      try {
        const parsed = JSON.parse(inputJson);
        currentDashboardContext = `Current telemetry: ${JSON.stringify(parsed)}`;
      } catch (e) {
        currentDashboardContext = "Dashboard contains malformed text.";
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

            if (message.serverContent?.interrupted) {
              sources.forEach(s => s.stop());
              sources.clear();
              nextStartTime = 0;
            }

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
          systemInstruction: `You are EthosShield, a calm MIT-style blockchain mentor. 
          Help users understand transaction risks. 
          Context: ${currentDashboardContext}. 
          If the context is invalid, ask the user to provide a correct JSON scan.`,
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
    setError(null);
    setIsLoading(true);
    let parsedInput: any;
    let rawScore: number | undefined;
    
    try {
      parsedInput = JSON.parse(inputJson);
      rawScore = parsedInput.ethos_score;
    } catch (e) {
      // Send the raw string to Gemini to get a friendly error analysis
      parsedInput = inputJson;
    }

    try {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: `Executing Reputation Scan...`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMessage]);

      const analysis = await analyzeTransaction(parsedInput);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: analysis.summary,
        analysis: analysis,
        rawInput: typeof parsedInput === 'object' ? parsedInput : undefined,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (isVoiceEnabled) {
        const audioData = await generateSpeech(analysis.tts_text);
        if (audioData) await playPCM(audioData);
      }
    } catch (e: any) {
      setError("Critical Engine Failure. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-[#020617] selection:bg-indigo-500/30 text-slate-100">
      <div className="w-full md:w-[420px] border-b md:border-b-0 md:border-r border-slate-800 flex flex-col bg-[#0b0f1a] shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg shadow-[0_0_20px_rgba(99,102,241,0.2)]">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tighter text-white italic uppercase">EthosShield</h1>
              <p className="text-[10px] text-indigo-400/60 font-bold tracking-[0.2em]">SECURITY MENTOR</p>
            </div>
          </div>
          <Activity className="w-4 h-4 text-emerald-500/50" />
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-3">
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
                  <MicOff className="w-5 h-5 animate-pulse" />
                  <span className="font-bold tracking-tight text-sm uppercase">End Session</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="font-bold tracking-tight text-sm uppercase">Voice Mentor Mode</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Database className="w-3 h-3 text-indigo-400" />
                Telemetry Input
              </label>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-bold text-slate-600 uppercase">Live Node</span>
              </div>
            </div>
            <div className="relative group">
              <textarea
                value={inputJson}
                onChange={(e) => setInputJson(e.target.value)}
                className={`w-full h-72 bg-[#020617] border rounded-xl p-4 text-indigo-300 mono text-xs focus:ring-1 outline-none transition-all resize-none shadow-inner ${
                  error ? 'border-rose-500/50 focus:ring-rose-500' : 'border-slate-800 focus:ring-indigo-500'
                }`}
                placeholder='Paste transaction JSON here...'
              />
              {error && (
                <div className="absolute top-2 right-2 text-rose-500">
                  <AlertCircle className="w-4 h-4" />
                </div>
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Volume2 className="w-3 h-3" />
                Auto-Narration
              </h4>
              <button 
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${isVoiceEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${isVoiceEnabled ? 'translate-x-5.5' : 'translate-x-1'}`} />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Narrate risk findings using the modular tts engine.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 bg-[#0b0f1a]">
          <button
            onClick={handleAnalyze}
            disabled={isLoading || isLiveActive}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-700 uppercase text-xs tracking-widest"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
            Analyze Telemetry
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative bg-[#020617]">
        <header className="h-16 border-b border-slate-800/60 flex items-center justify-between px-6 bg-[#0b0f1a]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
              <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                {isLiveActive ? 'Secure Channel' : 'Engine Ready'}
              </span>
            </div>
          </div>
          <button onClick={() => setMessages([])} className="p-2 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-10">
          {isLiveActive && (
            <div className="fixed inset-0 top-16 z-50 bg-[#020617]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
              <div className="max-w-2xl w-full space-y-12">
                <div className="relative group">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-[120px] rounded-full group-hover:bg-indigo-500/30 transition-all duration-1000" />
                  <div className="relative flex justify-center gap-2 h-20 items-center">
                    {[...Array(16)].map((_, i) => (
                      <div key={i} className={`w-1.5 bg-indigo-500/60 rounded-full animate-waveform`} style={{ height: `${30 + Math.random() * 70}%`, animationDelay: `${i * 0.05}s` }} />
                    ))}
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em]">Listening</p>
                    <p className="text-3xl font-light text-slate-200 min-h-[4rem] leading-tight tracking-tight">
                      {liveTranscription.user || "EthosShield standby..."}
                    </p>
                  </div>
                  
                  {liveTranscription.ai && (
                    <div className="p-8 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl animate-in slide-in-from-bottom-8">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-4">Mentor Feedback</p>
                      <p className="text-xl text-indigo-100 leading-relaxed font-medium">{liveTranscription.ai}</p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={stopLiveSession}
                  className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 px-10 py-4 rounded-full font-bold transition-all flex items-center gap-3 mx-auto uppercase text-xs tracking-[0.2em]"
                >
                  <X className="w-4 h-4" /> Disconnect
                </button>
              </div>
            </div>
          )}

          {messages.length === 0 && !isLiveActive && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-6">
              <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center border border-slate-800 shadow-2xl relative">
                <div className="absolute inset-0 bg-indigo-500/5 blur-xl rounded-full" />
                <Shield className="w-10 h-10 text-slate-700 relative z-10" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-400 tracking-wider uppercase">Vault Secure</p>
                <p className="text-xs text-slate-600 leading-relaxed">System ready for evaluation. Paste a scan to begin.</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] md:max-w-[75%] ${msg.role === 'user' ? 'bg-indigo-500/5 border border-indigo-500/10' : 'glass'} rounded-[32px] p-8 shadow-2xl transition-all hover:border-indigo-500/20`}>
                <div className="flex items-center gap-3 mb-6">
                   <div className={`w-1.5 h-1.5 rounded-full ${msg.role === 'user' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                    {msg.role === 'user' ? 'Signal Received' : 'Security Analysis'}
                  </span>
                </div>
                {msg.analysis ? <AnalysisCard analysis={msg.analysis} ethosScore={msg.rawInput?.ethos_score} /> : <p className="text-slate-300 leading-relaxed font-medium">{msg.content}</p>}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 text-center border-t border-slate-800/50 bg-[#020617]">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-4">
            <span>Verified node</span>
            <span className="w-1 h-1 rounded-full bg-slate-800" />
            <span>Ethos network v2</span>
            <span className="w-1 h-1 rounded-full bg-slate-800" />
            <span>AI monitoring active</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes waveform {
          0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
          50% { transform: scaleY(1.2); opacity: 1; }
        }
        .animate-waveform {
          animation: waveform 0.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
