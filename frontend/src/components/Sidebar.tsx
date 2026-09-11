import React from 'react';
import { NavLink } from 'react-router-dom';
import { Shield, LayoutDashboard, Building2, Users, Globe, LogOut, Database, ShieldAlert, Target, ShieldCheck, Network, Briefcase, Map } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { RoleBadge } from './badges';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
    { to: '/organization', icon: Building2, label: 'Organisation' },
    { to: '/members', icon: Users, label: 'Membres' },
    { to: '/domains', icon: Globe, label: 'Domaines' },
    { to: '/inventory', icon: Database, label: 'Inventaire' },
    { to: '/asset-graph', icon: Network, label: 'Graphe des Actifs' },
    { to: '/risks', icon: ShieldAlert, label: 'Risques' },
    { to: '/threat-landscape', icon: Map, label: 'Threat Landscape' },
    { to: '/vendors', icon: Briefcase, label: 'Fournisseurs' },
    { to: '/scenarios', icon: Target, label: 'Scénarios d\'Attaque' },
    { to: '/compliance', icon: ShieldCheck, label: 'Conformité' },
    { to: '/brand-protection', icon: Target, label: 'Protection de Marque' },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-screen w-72 bg-slate-950/50 backdrop-blur-xl border-r border-white/10 flex flex-col z-50
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo area */}
        <div className="flex items-center gap-3 px-6 py-8 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight gradient-text">Cyber360</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                ${isActive 
                  ? 'bg-white/10 text-cyan-400 shadow-[inset_4px_0_0_rgba(6,182,212,1)]' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}
              `}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User profile area */}
        {user && (
          <div className="p-4 border-t border-white/5">
            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 border border-white/10 text-cyan-400 font-semibold">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                <div className="mt-1">
                  <RoleBadge role={user.role} />
                </div>
              </div>
              <button 
                onClick={logout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                title="Se déconnecter"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
