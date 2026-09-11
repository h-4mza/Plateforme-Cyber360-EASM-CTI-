import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

interface CrossLinkProps {
  to: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'cyan' | 'rose' | 'slate';
  className?: string;
}

export const CrossLink: React.FC<CrossLinkProps> = ({ to, label, icon = <ExternalLink className="w-3 h-3" />, variant = 'cyan', className = '' }) => {
  const baseClasses = "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-all border whitespace-nowrap";
  
  const variants = {
    cyan: "bg-slate-800/50 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 border-white/5 hover:border-cyan-500/30",
    rose: "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/30 uppercase tracking-wider text-[10px] font-bold",
    slate: "bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white border-white/5 hover:border-white/20"
  };

  return (
    <Link to={to} className={`${baseClasses} ${variants[variant]} ${className}`}>
      {icon}
      {label}
    </Link>
  );
};
