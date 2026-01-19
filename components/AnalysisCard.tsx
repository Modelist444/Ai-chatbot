
import React, { useState } from 'react';
import { RiskAnalysisResponse, Recommendation, RiskLevel } from '../types';
import { AlertTriangle, ShieldCheck, Info, BookOpen, Volume2, Loader2, Copy, Check, Users, ShieldAlert, Zap, Box, ArrowRight, TrendingUp, Search } from 'lucide-react';
import { generateSpeech } from '../geminiService';
import { playPCM } from '../audioUtils';

interface AnalysisCardProps {
  analysis: RiskAnalysisResponse;
  ethosScore?: number;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ analysis, ethosScore }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSpeak = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const audioData = await generateSpeech(analysis.tts_text);
      if (audioData) await playPCM(audioData);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleCopy = () => {
    const reportText = `[ETHOS SHIELD REPORT]\nSTATUS: ${analysis.risk_level}\nRECOMMENDATION: ${analysis.recommendation}\nETHOS SCORE: ${ethosScore || 'N/A'}\n${analysis.summary}`;
    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getRecIcon = () => {
    switch (analysis.recommendation) {
      case Recommendation.SAFE_TO_PROCEED: return <ShieldCheck className="w-8 h-8 text-emerald-400" />;
      case Recommendation.DO_NOT_PROCEED: return <AlertTriangle className="w-8 h-8 text-rose-400" />;
      default: return <Info className="w-8 h-8 text-amber-400" />;
    }
  };

  const getEthosColor = (score: number) => {
    if (score > 650) return 'text-emerald-400';
    if (score > 350) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getEthosTier = (score: number) => {
    if (score > 650) return 'High Social Trust Tier';
    if (score > 350) return 'Neutral Credibility Tier';
    return 'Low Trust / Anonymized Tier';
  };

  const metadata = analysis.enhanced_metadata;

  return (
    <div className="space-y-12 animate-in fade-in duration-1000">
      {/* Header View */}
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className={`p-8 rounded-[40px] border-4 flex flex-col items-center justify-center gap-4 transition-all duration-700 min-w-[240px] shadow-2xl ${
          analysis.risk_level === RiskLevel.HIGH ? 'bg-rose-500/10 border-rose-500/40 shadow-rose-900/20' :
          analysis.risk_level === RiskLevel.MEDIUM ? 'bg-amber-500/10 border-amber-500/40 shadow-amber-900/20' :
          'bg-emerald-500/10 border-emerald-500/40 shadow-emerald-900/20'
        }`}>
          {getRecIcon()}
          <div className="text-center">
             <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 mb-1">Threat Assessment</p>
             <p className="text-3xl font-black tracking-tighter uppercase italic">{analysis.risk_level || 'UNKNOWN'}</p>
          </div>
        </div>

        <div className="flex-1 space-y-6 pt-2">
          <div className="flex flex-wrap gap-2">
            {metadata?.scenario_tags?.map((tag, i) => (
              <span key={i} className="px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-3 h-3" />
                {tag.replace('_', ' ')}
              </span>
            ))}
          </div>
          <p className="text-2xl font-bold text-slate-100 leading-snug tracking-tight">
            "{analysis.summary}"
          </p>
          <div className="flex items-center gap-4">
             <button onClick={handleSpeak} disabled={isSpeaking} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all disabled:opacity-50 border border-white/5">
                {isSpeaking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5 text-indigo-400" />}
             </button>
             <button onClick={handleCopy} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all text-slate-400 border border-white/5">
                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
             </button>
          </div>
        </div>
      </div>

      {/* Ethos Reputation Gauge */}
      {ethosScore !== undefined && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-8 rounded-[40px] bg-black/40 border border-white/5 space-y-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Users className="w-32 h-32 text-indigo-500" />
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                  <Users className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Ethos Reputation Framework</h4>
                  <p className="text-sm font-bold text-slate-300 italic">{getEthosTier(ethosScore)}</p>
                </div>
              </div>
              <div className={`text-5xl font-black font-mono tracking-tighter glow-text ${getEthosColor(ethosScore)}`}>
                {ethosScore}<span className="text-slate-700 text-xl ml-1">/1000</span>
              </div>
            </div>
            <div className="space-y-4 relative z-10">
              <div className="relative h-6 w-full bg-slate-950 rounded-full border border-slate-800 p-1.5 shadow-inner">
                <div 
                  className={`absolute top-1.5 bottom-1.5 left-1.5 rounded-full transition-all duration-[2500ms] ease-out shadow-[0_0_25px_rgba(99,102,241,0.6)] ${
                    ethosScore > 650 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 
                    ethosScore > 350 ? 'bg-gradient-to-r from-amber-600 to-amber-400' : 
                    'bg-gradient-to-r from-rose-600 to-rose-400'
                  }`}
                  style={{ width: `calc(${(ethosScore / 1000) * 100}% - 12px)` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">
                <span>Low Social Trust</span>
                <span>Neutral/Emerging</span>
                <span>High Credibility</span>
              </div>
            </div>
          </div>
          <div className="p-8 rounded-[40px] bg-indigo-600/10 border border-indigo-500/20 flex flex-col justify-center items-center text-center space-y-2 group hover:bg-indigo-600/20 transition-all">
            <TrendingUp className="w-10 h-10 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Network Confidence</p>
            <p className="text-5xl font-black text-white italic glow-text">{Math.floor((ethosScore / 1000) * 100)}%</p>
            <p className="text-xs text-indigo-400/60 font-bold tracking-tight">Social Weight Index</p>
          </div>
        </div>
      )}

      {/* Narrative & Simulation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
             <Search className="w-5 h-5 text-indigo-500" />
             <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Logic Breakdown</h4>
          </div>
          <ul className="space-y-4">
            {analysis.explanation.map((item, i) => (
              <li key={i} className="p-6 rounded-3xl bg-white/5 border border-white/5 flex items-start gap-4 group hover:bg-white/10 transition-all">
                <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.6)] ${item.toLowerCase().includes('conflicting') ? 'bg-rose-500 animate-pulse' : 'bg-indigo-500'}`} />
                <span className="text-sm font-semibold text-slate-300 leading-relaxed tracking-tight group-hover:text-white">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        {metadata?.sandbox_simulation && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 px-2">
               <Box className="w-5 h-5 text-rose-500" />
               <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Attack Sandbox</h4>
            </div>
            <div className="p-10 rounded-[48px] bg-rose-500/5 border border-rose-500/10 space-y-8 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <ShieldAlert className="w-32 h-32 text-rose-500" />
               </div>
               <div className="space-y-2 relative z-10">
                  <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Exposure Simulation</p>
                  <p className="text-5xl font-black text-white tracking-tighter glow-text drop-shadow-lg">{metadata.sandbox_simulation.potential_loss}</p>
               </div>
               <div className="flex items-center gap-3 flex-wrap relative z-10">
                  {metadata.sandbox_simulation.flow.map((step, i) => (
                    <React.Fragment key={i}>
                      <div className="px-5 py-2.5 bg-black/40 rounded-xl border border-white/10 text-[11px] font-black text-slate-300 uppercase tracking-widest shadow-lg">
                        {step}
                      </div>
                      {i < metadata.sandbox_simulation.flow.length - 1 && <ArrowRight className="w-4 h-4 text-slate-600" />}
                    </React.Fragment>
                  ))}
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Directive Footer */}
      <div className={`p-10 rounded-[48px] border-4 flex flex-col md:flex-row items-center gap-8 transition-all shadow-3xl ${
        analysis.recommendation === Recommendation.DO_NOT_PROCEED ? 'bg-rose-950/40 border-rose-500/50 shadow-rose-900/40' :
        analysis.recommendation === Recommendation.SAFE_TO_PROCEED ? 'bg-emerald-950/40 border-emerald-500/50 shadow-emerald-900/40' :
        'bg-amber-950/40 border-amber-500/50 shadow-amber-900/40'
      }`}>
        <div className="p-6 rounded-3xl bg-black/40 border border-white/10 shadow-xl">
          {getRecIcon()}
        </div>
        <div className="flex-1 text-center md:text-left">
          <p className="text-[10px] uppercase font-black tracking-[0.6em] text-slate-500 mb-2">Primary Protocol Directive</p>
          <p className="text-5xl font-black italic tracking-tighter uppercase text-white glow-text">{analysis.recommendation}</p>
        </div>
        <button onClick={handleCopy} className="px-10 py-6 bg-white/5 hover:bg-white/10 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] border border-white/10 transition-all active:scale-95">
          Authorize Defense Report
        </button>
      </div>

      {/* Educational Context */}
      {analysis.education && (
        <div className="p-10 rounded-[48px] bg-indigo-500/5 border border-indigo-500/10 space-y-6 group hover:border-indigo-500/30 transition-all">
          <div className="flex items-center gap-4 text-indigo-400">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.4em]">Defense Knowledge Retrieval</span>
          </div>
          <p className="text-xl text-slate-400 font-medium leading-relaxed italic border-l-4 border-indigo-500/20 pl-8">
            "{analysis.education}"
          </p>
        </div>
      )}
    </div>
  );
};
