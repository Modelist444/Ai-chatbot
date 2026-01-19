import React, { useState } from 'react';
import { RiskAnalysisResponse, Recommendation, RiskLevel } from '../types';
import { RiskBadge } from './RiskBadge';
import { AlertTriangle, ShieldCheck, Info, BookOpen, Volume2, Loader2, Copy, Check, Hash, MessageSquare, Twitter, Activity, FileJson, Users, ShieldAlert, Zap } from 'lucide-react';
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
      if (audioData) {
        await playPCM(audioData);
      }
    } catch (error) {
      console.error("Failed to play audio", error);
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleCopy = () => {
    const reportText = `🛡️ EthosShield Report\nLevel: ${analysis.risk_level || 'UNKNOWN'}\nReputation: ${ethosScore || 'N/A'}\nSummary: ${analysis.summary}\nGuidance: ${analysis.recommendation}`;
    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getRecIcon = () => {
    switch (analysis.recommendation) {
      case Recommendation.SAFE_TO_PROCEED: return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      case Recommendation.DO_NOT_PROCEED: return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      default: return <Info className="w-5 h-5 text-amber-400" />;
    }
  };

  const getRecStyles = () => {
    switch (analysis.recommendation) {
      case Recommendation.SAFE_TO_PROCEED: return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.1)]';
      case Recommendation.DO_NOT_PROCEED: return 'bg-rose-500/10 border-rose-500/20 text-rose-100 shadow-[0_0_15px_rgba(244,63,94,0.1)]';
      default: return 'bg-amber-500/10 border-amber-500/20 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.1)]';
    }
  };

  const getEthosColor = (score: number) => {
    if (score > 650) return 'text-emerald-400';
    if (score > 350) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getEthosBg = (score: number) => {
    if (score > 650) return 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]';
    if (score > 350) return 'bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)]';
    return 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]';
  };

  const metadata = analysis.enhanced_metadata;
  const isTemplate = analysis.education?.includes('{') && analysis.education?.includes(':');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <Zap className="w-5 h-5 text-indigo-400 fill-indigo-400/20" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-100 tracking-tight">Telemetry Scan</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Protocol Intelligence v2</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 mr-2">
            <button 
              onClick={handleSpeak}
              disabled={isSpeaking}
              className="p-2 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-slate-700 transition-all text-indigo-400 disabled:opacity-50 active:scale-95"
              title="Listen to analysis"
            >
              {isSpeaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button 
              onClick={handleCopy}
              className={`p-2 rounded-xl border transition-all active:scale-95 ${copied ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700 text-slate-400'}`}
              title="Copy analysis to clipboard"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          {analysis.risk_level && <RiskBadge level={analysis.risk_level} />}
        </div>
      </div>

      {/* Ethos Reputation Visualization */}
      {ethosScore !== undefined && (
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/60 space-y-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Users className="w-16 h-16 text-indigo-400" />
          </div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
              <Users className="w-4 h-4 text-indigo-500" />
              Ethos Social Reputation
            </div>
            <div className={`px-3 py-1 rounded-lg bg-black/40 text-sm font-mono font-bold border border-slate-800/50 ${getEthosColor(ethosScore)}`}>
              {ethosScore.toString().padStart(3, '0')} <span className="text-slate-600">/ 1000</span>
            </div>
          </div>

          <div className="relative h-4 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5 shadow-inner">
            {/* Range markers/Segments */}
            <div className="absolute left-[35%] top-0 bottom-0 w-0.5 bg-slate-800/80 z-20" />
            <div className="absolute left-[65%] top-0 bottom-0 w-0.5 bg-slate-800/80 z-20" />
            
            <div 
              className={`absolute top-0.5 bottom-0.5 left-0.5 rounded-full transition-all duration-[2000ms] cubic-bezier(0.16, 1, 0.3, 1) ${getEthosBg(ethosScore)}`}
              style={{ width: `calc(${(ethosScore / 1000) * 100}% - 4px)` }}
            />
          </div>

          <div className="grid grid-cols-3 text-[10px] font-bold text-slate-500 uppercase tracking-tighter relative z-10 px-1">
            <div className={`text-left transition-colors duration-500 ${ethosScore <= 350 ? 'text-rose-400' : ''}`}>Low Trust</div>
            <div className={`text-center transition-colors duration-500 ${ethosScore > 350 && ethosScore <= 650 ? 'text-amber-400' : ''}`}>Emerging</div>
            <div className={`text-right transition-colors duration-500 ${ethosScore > 650 ? 'text-emerald-400' : ''}`}>Verified</div>
          </div>
        </div>
      )}

      {/* Summary Section */}
      <div className="relative p-5 bg-indigo-500/5 rounded-2xl border-l-4 border-indigo-500/40">
        <p className="text-slate-200 text-sm leading-relaxed font-medium italic">
          "{analysis.summary}"
        </p>
      </div>

      {/* Tags & Details */}
      {metadata?.scenario_tags && (
        <div className="flex flex-wrap gap-2">
          {metadata.scenario_tags.map((tag, i) => (
            <span key={i} className="px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2 shadow-sm">
              <ShieldAlert className="w-3.5 h-3.5" />
              {tag.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Technical Findings</h4>
          <ul className="space-y-4">
            {analysis.explanation.map((item, i) => (
              <li key={i} className="flex items-start gap-4 text-sm text-slate-300 group/item">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-indigo-600 shrink-0 group-hover/item:scale-125 transition-all shadow-[0_0_10px_rgba(79,70,229,0.5)] border border-indigo-400/30" />
                <span className="leading-relaxed group-hover/item:text-slate-100 transition-colors">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {metadata?.social_verification && (
          <div className="space-y-4 p-6 rounded-3xl bg-[#0b0f1a] border border-slate-800 shadow-xl transition-all hover:border-indigo-500/20 group/social">
            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Live Pulse Sentiment
            </h4>
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                metadata.social_verification.sentiment === 'suspicious' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                metadata.social_verification.sentiment === 'bearish' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
              }`}>
                {metadata.social_verification.sentiment}
              </div>
              <div className="flex gap-2.5">
                {metadata.social_verification.sources.map((src, i) => (
                  <span key={i} title={src} className="text-slate-500 hover:text-indigo-400 transition-all cursor-help transform hover:scale-110">
                    {src === 'Twitter' && <Twitter className="w-4 h-4" />}
                    {src === 'Discord' && <MessageSquare className="w-4 h-4" />}
                    {src === 'Telegram' && <Hash className="w-4 h-4" />}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              Real-time community health score derived from Ethos Network graph analysis.
            </p>
          </div>
        )}
      </div>

      {/* Main Action Directive */}
      <div className={`p-8 rounded-[32px] border-2 flex items-center gap-8 transition-all duration-500 group/rec ${getRecStyles()}`}>
        <div className="p-4 rounded-2xl bg-slate-900/50 shadow-inner group-hover/rec:scale-110 transition-transform">
          {getRecIcon()}
        </div>
        <div>
          <p className="text-[10px] uppercase font-black tracking-[0.4em] opacity-50 mb-1.5">Security Directive</p>
          <p className="text-2xl font-black tracking-tighter uppercase italic drop-shadow-lg">{analysis.recommendation}</p>
        </div>
      </div>

      {/* Education/Schema Guidance */}
      {analysis.education && (
        <div className={`p-8 rounded-[32px] border transition-all duration-500 ${isTemplate ? 'bg-slate-900/80 border-indigo-500/30' : 'bg-indigo-500/5 border-indigo-500/20 hover:bg-indigo-500/10'}`}>
          <div className="flex items-center gap-3 mb-5 text-indigo-400">
            {isTemplate ? <FileJson className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
            <span className="text-[11px] font-black uppercase tracking-[0.3em]">
              {isTemplate ? 'Telemetry Specification' : 'Mentor Security Brief'}
            </span>
          </div>
          {isTemplate ? (
            <div className="relative group/code">
              <pre className="text-[12px] font-mono text-indigo-300 bg-black/60 p-6 rounded-2xl overflow-x-auto border border-slate-800 shadow-2xl leading-relaxed">
                {analysis.education}
              </pre>
              <button 
                onClick={() => navigator.clipboard.writeText(analysis.education!)}
                className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800 opacity-0 group-hover/code:opacity-100 transition-all hover:bg-slate-700 text-slate-400"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              {analysis.education}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
