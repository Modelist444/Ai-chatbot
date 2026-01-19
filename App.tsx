import React, { useState, useRef, useEffect } from 'react';
import { Shield, Terminal, RefreshCw, Trash2, Mic, MicOff, X, Activity, Radar, Fingerprint, Globe, ShieldAlert, Users } from 'lucide-react';
import { TransactionInput, Message } from './types';
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
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState<{user: string, ai: string}>({user: '', ai: ''});
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>(["[SYS] OS Kernel Loaded", "[NET] Connecting to Ethos P2P Node..."]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const sessionRef = useRef<any>(null);
  const audioContextsRef = useRef<{input: AudioContext, output: AudioContext} | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const log = [
        `[NET] Received Attestation 0x${Math.random().toString(16).slice(2, 10)}`,
        `[SCAN] Analyzing Contract Memory...`,
        `[ETHOS] Score Updated: +${(Math.random()*2).toFixed(1)} Social Weight`,
        `[THREAT] Monitor Active: ${Math.floor(Math.random()*500)} req/s`
      ][Math.floor(Math.random()*4)];
      setTelemetryLogs(prev => [log, ...prev].slice(0, 15));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: any) => {
            const audioBase64 = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioBase64) {
              nextStartTime = Math.max(nextStartTime, outputCtx.currentTime);
              const buffer = await decodeAudioData(decodeBase64(audioBase64), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.start(nextStartTime);
              nextStartTime += buffer.duration;
              sources.add(source);
            }
            if (message.serverContent?.interrupted) { sources.forEach(s => s.stop()); sources.clear(); nextStartTime = 0; }
            if (message.serverContent?.inputTranscription) setLiveTranscription(prev => ({ ...prev, user: prev.user + message.serverContent.inputTranscription.text }));
            if (message.serverContent?.outputTranscription) setLiveTranscription(prev => ({ ...prev, ai: prev.ai + message.serverContent.outputTranscription.text }));
            if (message.serverContent?.turnComplete) setLiveTranscription({ user: '', ai: '' });
          },
          onclose: () => stopLiveSession(),
          onerror: () => stopLiveSession()
        },
        config: {
          responseModalities: ['AUDIO' as any],
          systemInstruction: `You are EthosShield, a tactical AI security operative. Your tone is sharp and professional. Context: ${inputJson}`,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsLiveActive(false);
    }
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      const parsedInput = JSON.parse(inputJson);
      const analysis = await analyzeTransaction(parsedInput);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: analysis.summary,
        analysis,
        rawInput: parsedInput,
        timestamp: Date.now()
      }]);
      const audio = await generateSpeech(analysis.tts_text);
      if (audio) await playPCM(audio);
    } catch (e) {
      setMessages(prev => [...prev, { id: 'err', role: 'assistant', content: "CRITICAL PARSE ERROR: Telemetry malformed.", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#020617] text-slate-100 overflow-hidden">
      <aside className="w-full md:w-[480px] flex flex-col glass-heavy border-r border-slate-800 z-20">
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-4">
            <Shield className="w-8 h-8 text-indigo-400" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic glow-text">EthosShield</h1>
              <p className="text-[10px] text-indigo-400 font-bold tracking-[0.3em] uppercase opacity-70">Defense Intelligence</p>
            </div>
          </div>
          <Radar className="w-5 h-5 text-indigo-500/50 animate-spin-slow" />
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth">
          <button
            onClick={isLiveActive ? stopLiveSession : startLiveSession}
            className={`w-full py-5 rounded-2xl flex items-center justify-center gap-4 transition-all border-2 font-black uppercase text-sm tracking-[0.2em] shadow-2xl ${
              isLiveActive ? 'bg-rose-950/40 border-rose-500/50 text-rose-400' : 'bg-indigo-950/40 border-indigo-500/50 text-indigo-400'
            }`}
          >
            {isLiveActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            {isLiveActive ? "Abort Connection" : "Voice War Room"}
          </button>

          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3 px-1">
              <Terminal className="w-4 h-4 text-indigo-500" /> Raw Telemetry Data
            </label>
            <textarea
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              className="w-full h-80 bg-black/40 border border-slate-800 rounded-2xl p-6 text-indigo-300 mono text-[13px] outline-none shadow-2xl"
              spellCheck={false}
            />
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
              <Activity className="w-4 h-4 text-indigo-400" /> Sub-Network Feed
            </h4>
            <div className="bg-black/40 border border-slate-800 rounded-2xl p-4 h-40 overflow-hidden relative">
              <div className="space-y-1">
                {telemetryLogs.map((log, i) => (
                  <div key={i} className="text-[10px] mono text-slate-500 font-medium truncate">{log}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 border-t border-white/5 bg-white/5">
          <button
            onClick={handleAnalyze}
            disabled={isLoading || isLiveActive}
            className="w-full h-16 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-4 border border-indigo-400/30 uppercase text-xs tracking-[0.3em] shadow-indigo-900/40"
          >
            {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Radar className="w-5 h-5" />}
            Execute Clearance
          </button>
        </div>
      </aside>

      <main className="flex-1 relative flex flex-col bg-[#020617] overflow-hidden">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 bg-black/20 backdrop-blur-xl z-30">
          <div className="flex items-center gap-6">
            <div className={`w-3 h-3 rounded-full ${isLiveActive ? 'bg-rose-500 animate-ping shadow-[0_0_12px_#f43f5e]' : 'bg-indigo-500 shadow-[0_0_12px_#6366f1]'}`} />
            <span className="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">
              {isLiveActive ? 'Secured Voice Channel 402' : 'Threat Intelligence Core'}
            </span>
          </div>
          <button onClick={() => setMessages([])} className="p-3 text-slate-600 hover:text-rose-400 transition-all">
            <Trash2 className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-10 space-y-12 z-20">
          {isLiveActive && (
            <div className="fixed inset-0 top-20 z-50 bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-500">
              <div className="max-w-4xl w-full space-y-16">
                <div className="relative flex justify-center gap-3 h-24 items-center">
                  {[...Array(24)].map((_, i) => (
                    <div key={i} className="w-2 bg-indigo-400/80 rounded-full animate-waveform" style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.04}s` }} />
                  ))}
                </div>
                <p className="text-4xl font-black text-slate-100 min-h-[5rem] tracking-tight">{liveTranscription.user || "Awaiting Voice Command..."}</p>
                {liveTranscription.ai && <div className="p-10 bg-indigo-500/5 border border-indigo-500/20 rounded-[40px]"><p className="text-2xl text-indigo-100 font-semibold">{liveTranscription.ai}</p></div>}
                <button onClick={stopLiveSession} className="bg-rose-500 text-white px-12 py-5 rounded-2xl font-black flex items-center gap-4 mx-auto uppercase text-xs tracking-[0.3em]"><X className="w-5 h-5" /> Termination</button>
              </div>
            </div>
          )}

          {messages.length === 0 && !isLiveActive && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-10 opacity-50">
              <Radar className="w-16 h-16 text-indigo-500/20" />
              <h3 className="text-3xl font-black uppercase italic">Protocol Standby</h3>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className="flex justify-start">
              <div className="w-full bg-slate-900/40 border border-white/5 rounded-[48px] p-10 shadow-3xl backdrop-blur-xl">
                {msg.analysis && <AnalysisCard analysis={msg.analysis} ethosScore={msg.rawInput?.ethos_score} />}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>
    </div>
  );
};

export default App;