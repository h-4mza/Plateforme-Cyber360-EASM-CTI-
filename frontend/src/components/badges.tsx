import React from 'react';
import { Server, Globe, Hash, AlertTriangle, ShieldAlert, Shield, ShieldCheck, Loader2 } from 'lucide-react';

/**
 * SOURCE DE VÉRITÉ UNIQUE POUR LES BADGES ET LABELS
 * Utilisez ces composants et fonctions dans l'ensemble de l'application
 * pour garantir une cohérence visuelle et sémantique.
 */

// --- ASSET TYPE ---
export const ASSET_TYPE_LABELS: Record<string, string> = {
  'root_domain': 'Domaine',
  'subdomain': 'Sous-domaine',
  'ip': 'Adresse IP',
  'ipv6': 'Adresse IPv6'
};

export const AssetTypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const label = ASSET_TYPE_LABELS[type] || type;
  
  if (type === 'root_domain') {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"><Globe className="w-3.5 h-3.5" /> {label}</span>;
  }
  if (type === 'subdomain') {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"><Server className="w-3.5 h-3.5" /> {label}</span>;
  }
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20"><Hash className="w-3.5 h-3.5" /> {label}</span>;
};


// --- STATUS (Domain / Asset) ---
export const STATUS_LABELS: Record<string, string> = {
  'active': 'Actif',
  'inactive': 'Inactif',
  'pending': 'En attente',
  'discovering': 'Découverte',
  'error': 'Erreur',
  'expired': 'Expiré'
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const label = STATUS_LABELS[status] || status.toUpperCase();
  const lowerStatus = status.toLowerCase();
  
  if (lowerStatus === 'active') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">{label}</span>;
  }
  if (lowerStatus === 'pending') {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse">{label}</span>;
  }
  if (lowerStatus === 'discovering') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Loader2 className="w-3 h-3 animate-spin" />
        {label}
      </span>
    );
  }
  if (lowerStatus === 'error') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">{label}</span>;
  }
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">{label}</span>;
};


// --- ASSET CRITICALITY ---
export const CRITICALITY_LABELS: Record<string, string> = {
  'high': 'Haute',
  'medium': 'Moyenne',
  'low': 'Faible'
};

export const AssetCriticalityBadge: React.FC<{ criticality: string }> = ({ criticality }) => {
  const label = CRITICALITY_LABELS[criticality] || criticality;
  
  if (criticality === 'high') {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">{label}</span>;
  }
  if (criticality === 'medium') {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">{label}</span>;
  }
  return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">{label}</span>;
};


// SEVERITY MOVED TO shared/SeverityBadge.tsx


// --- USER ROLES ---
export const ROLE_LABELS: Record<string, string> = {
  'admin': 'Admin',
  'analyste': 'Analyste',
  'readonly': 'Lecture seule'
};

export const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const label = ROLE_LABELS[role.toLowerCase()] || role.toUpperCase();
  
  if (role.toLowerCase() === 'admin') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">{label}</span>;
  }
  if (role.toLowerCase() === 'analyste') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{label}</span>;
  }
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">{label}</span>;
};
