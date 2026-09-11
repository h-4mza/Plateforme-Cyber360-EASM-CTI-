import React from 'react';
import { AlertTriangle, ShieldAlert, Shield, ShieldCheck } from 'lucide-react';

export const RISK_SEVERITY_LABELS: Record<string, string> = {
  'critical': 'Critique',
  'high': 'Élevé',
  'medium': 'Moyen',
  'low': 'Faible'
};

export const SeverityBadge: React.FC<{ severity: string; className?: string }> = ({ severity, className = "" }) => {
  const label = RISK_SEVERITY_LABELS[severity.toLowerCase()] || severity;

  if (severity.toLowerCase() === 'critical') {
    return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20 ${className}`}><AlertTriangle className="w-3.5 h-3.5" /> {label}</span>;
  }
  if (severity.toLowerCase() === 'high') {
    return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 ${className}`}><ShieldAlert className="w-3.5 h-3.5" /> {label}</span>;
  }
  if (severity.toLowerCase() === 'medium') {
    return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 ${className}`}><Shield className="w-3.5 h-3.5" /> {label}</span>;
  }
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20 ${className}`}><ShieldCheck className="w-3.5 h-3.5" /> {label}</span>;
};
