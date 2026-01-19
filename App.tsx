
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
      {/* Sidebar: Scanner Emulator */}
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
            <div className="relative group">
              <textarea
                value={inputJson}
                onChange={handleJsonChange}
                className="w-full h-80 bg-[#020617] border border-slate-800 rounded-xl p-4 text-indigo-300 mono text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none shadow-inner"
                placeholder="Paste transaction scanner data..."
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="p-1 bg-slate-800 rounded text-[10px] text-slate-400 uppercase font-mono">
                  Read Only / Edit
                </div>
              </div>
            </div>
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
            {isLoading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Terminal className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            )}
            {isLoading ? "INTERPRETING..." : "PROCESS SCAN"}
          </button>
        </div>
      </div>

      {/* Main: Chat View */}
      <div className="flex-1 flex flex-col relative bg-[#0a0f1d]">
        {/* Header */}
        <header className="h-16 border-b border-slate-800/60 flex items-center justify-between px-6 bg-slate-900/20 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-semibold text-slate-300">Live Risk Engine Active</span>
          </div>
          <button 
            onClick={clearHistory}
            className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </header>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4">
              <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-slate-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-200">Ready for Scan</h2>
              <p className="text-sm text-slate-500">
                Paste your transaction scanner output on the left and click "Process Scan" to receive a plain-language risk analysis.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'bg-indigo-600/10 border border-indigo-500/20' : 'glass'} rounded-2xl p-6 shadow-xl`}>
                <div className="flex items-center gap-2 mb-3">
                  {msg.role === 'user' ? (
                    <div className="bg-indigo-500/20 p-1 rounded">
                      <Database className="w-3 h-3 text-indigo-400" />
                    </div>
                  ) : (
                    <div className="bg-emerald-500/20 p-1 rounded">
                      <Shield className="w-3 h-3 text-emerald-400" />
                    </div>
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {msg.role === 'user' ? 'INPUT DATA' : 'EXPLANATION ENGINE'}
                  </span>
                </div>

                {msg.role === 'user' ? (
                  <div className="space-y-3">
                    <p className="text-slate-200 font-medium">{msg.content}</p>
                    {msg.rawInput && (
                      <div className="p-3 bg-black/40 rounded-lg mono text-[11px] text-indigo-300/80 border border-slate-800">
                        {msg.rawInput.transaction_type} • {msg.rawInput.asset} • Risk: {msg.rawInput.risk_score}
                      </div>
                    )}
                  </div>
                ) : msg.analysis ? (
                  <AnalysisCard analysis={msg.analysis} />
                ) : (
                  <p className="text-slate-300">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="glass rounded-2xl p-6 max-w-[70%] flex items-center gap-4">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                </div>
                <span className="text-sm font-medium text-slate-400">Decompiling signatures and reputation metrics...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer info */}
        <div className="p-4 text-center border-t border-slate-800/30">
          <p className="text-[10px] text-slate-600 font-medium uppercase tracking-[0.2em]">
            Safe Send AI does not provide financial advice. Verify all addresses before signing.
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
