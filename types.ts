
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

export enum Modality {
  AUDIO = 'AUDIO',
  TEXT = 'TEXT',
  IMAGE = 'IMAGE'
}

export interface TransactionInput {
  transaction_type: string;
  asset: string;
  ethos_score: number;
  risk_score: number;
  flags: string[];
}

export interface EnhancedMetadata {
  scenario_tags?: string[];
  social_verification?: {
    sentiment: string;
    sources: string[];
  };
}

export interface RiskAnalysisResponse {
  risk_level: RiskLevel;
  summary: string;
  explanation: string[];
  recommendation: Recommendation;
  education?: string;
  tts_text: string;
  enhanced_metadata?: EnhancedMetadata;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  analysis?: RiskAnalysisResponse;
  rawInput?: TransactionInput;
  timestamp: number;
}
