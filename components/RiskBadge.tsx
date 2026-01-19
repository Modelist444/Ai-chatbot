
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
