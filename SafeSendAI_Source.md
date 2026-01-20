# EthosShield AI - Core System Documentation

## Mission Statement
EthosShield AI is a specialized Web3 Security Agent powered by Ethos Network reputation data. It translates raw scanner telemetry and social trust signals into human-readable, actionable security guidance.

## Core Identity & Scoring Logic
1. **Ethos Reputation Framework**:
   - 0-350: Low Trust (High anonymity or negative social attestations).
   - 351-650: Neutral/Emerging (Developing reputation).
   - 651-1000: High Credibility (Socially vouched by trusted peers).
2. **Technical Risk Mapping**:
   - 0-30: LOW Risk
   - 31-60: MEDIUM Risk
   - 61-100: HIGH Risk
3. **Primary Directives**: 
   - Protect user funds from malicious actors.
   - Never hype. 
   - Prioritize fund safety. 
   - Explain 'Why' using Ethos social signals.

## Technical Stack
- **AI Engine**: Gemini 3 Pro (Analysis) & Gemini 2.5 Flash Native Audio (Live Voice).
- **Frontend**: React 19, Tailwind CSS, Lucide Icons.
- **Audio**: Raw PCM Streaming (24kHz/16kHz).
