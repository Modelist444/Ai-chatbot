
import React, { useState } from 'react';
import { RiskAnalysisResponse, Recommendation, RiskLevel } from '../types';
import { RiskBadge } from './RiskBadge';
import { AlertTriangle, ShieldCheck, Info, BookOpen, Volume2, Loader2 } from 'lucide-react';
import { generateSpeech } from '../geminiService';
import { playPCM } from '../audioUtils';

interface AnalysisCardProps {
  analysis: RiskAnalysisResponse;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ analysis }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const speechText = `Risk level is ${analysis.risk_level}. ${analysis.summary} My recommendation is: ${analysis.recommendation}.`;
      const audioData = await generateSpeech(speechText);
      if (audioData) {
        await playPCM(audioData);
      }
    } catch (error) {
      console.error("Failed to play audio", error);
    } finally {
      setIsSpeaking(false);
    }
  };

  const getRecIcon = () => {
    switch (analysis.recommendation) {
      case 'SAFE TO PROCEED': return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      case 'DO NOT PROCEED': return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      default: return <Info className="w-5 h-5 text-amber-400" />;
    }
  };

  const getRecStyles = () => {
    switch (analysis.recommendation) {
      case 'SAFE TO PROCEED': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100';
      case 'DO NOT PROCEED': return 'bg-rose-500/10 border-rose-500/20 text-rose-100';
      default: return 'bg-amber-500/10 border-amber-500/20 text-amber-100';
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-lg text-slate-100">Transaction Analysis</h3>
          <button 
            onClick={handleSpeak}
            disabled={isSpeaking}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors text-indigo-400 disabled:opacity-50"
            title="Listen to analysis"
          >
            {isSpeaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
        <RiskBadge level={analysis.risk_level} />
      </div>

      <p className="text-slate-300 italic text-sm border-l-2 border-slate-700 pl-3">
        "{analysis.summary}"
      </p>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Findings</h4>
        <ul className="space-y-2">
          {analysis.explanation.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className={`p-4 rounded-xl border flex items-center gap-4 ${getRecStyles()}`}>
        <div className="p-2 rounded-full bg-slate-900/50">
          {getRecIcon()}
        </div>
        <div>
          <p className="text-xs uppercase font-bold opacity-70">Guidance</p>
          <p className="font-bold tracking-tight">{analysis.recommendation}</p>
        </div>
      </div>

      {analysis.education && (
        <div className="mt-6 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2 text-indigo-300">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Educational Context</span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            {analysis.education}
          </p>
        </div>
      )}
    </div>
  );
};
