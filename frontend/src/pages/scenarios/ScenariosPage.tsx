import React, { useEffect, useState } from 'react';
import { Network, AlertTriangle, ChevronRight, ShieldAlert, Bug, Flame, Search, Loader2, Crosshair, Users, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { scenariosApi } from '../../api/endpoints';
import { AttackScenario } from '../../types';
import { AttackMatrix } from '../../components/AttackMatrix';
import { AttackPathGraph } from '../../components/AttackPathGraph';
import { AttackGroupDrawer } from '../../components/AttackGroupDrawer';

export const ScenariosPage: React.FC = () => {
  const { user } = useAuth();
  const [scenarios, setScenarios] = useState<AttackScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      scenariosApi.list(user.organization_id)
        .then(setScenarios)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [user]);

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-cyan-500 animate-spin" /></div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Network className="w-7 h-7 text-rose-500" />
          Scénarios d'Attaque (Corrélation)
        </h1>
        <p className="text-slate-400">
          Chemins d'attaque composites détectés par l'évaluation croisée de vos vulnérabilités (M2/M3).
        </p>
      </div>

      {scenarios.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20">
            <Network className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Aucun scénario composite détecté</h3>
          <p className="text-slate-400 max-w-md">
            Vos actifs ne présentent actuellement aucune combinaison de failles permettant de construire un chemin d'attaque majeur.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          <div className="flex gap-4">
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg">
              <ShieldAlert className="w-5 h-5" />
              {scenarios.filter((s: any) => s.status === 'open').length} chemins complets
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 text-orange-400 px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg">
              <Activity className="w-5 h-5" />
              {scenarios.filter((s: any) => s.status === 'partial').length} en construction
            </div>
          </div>
          
          <div className="space-y-6">
            {scenarios.sort((a: any, b: any) => (b.severity_score || 0) - (a.severity_score || 0)).map((scenario: any) => {
              const isOpen = scenario.status === 'open';
              return (
                <div key={scenario.id} className={`glass-card overflow-hidden border ${isOpen ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-orange-500/50 border-dashed opacity-90'}`}>
                  <div className={`${isOpen ? 'bg-red-950/30 border-b border-red-500/20' : 'bg-slate-900/50 border-b border-slate-800'} p-6 flex flex-col lg:flex-row gap-6 lg:items-center justify-between`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        {isOpen ? <Flame className="w-6 h-6 text-red-500" /> : <Activity className="w-6 h-6 text-orange-400" />}
                        <h2 className="text-xl font-bold text-white">
                          {scenario.title}
                        </h2>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isOpen ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
                          {isOpen ? 'COMPLET' : 'PARTIEL'}
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed max-w-3xl">{scenario.explanation}</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">Severity</span>
                        <div className={`text-2xl font-black ${isOpen ? 'text-red-500' : 'text-orange-400'}`}>
                          {Math.round(scenario.severity_score || 0)}
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">Likelihood</span>
                        <div className="text-2xl font-black text-cyan-400">
                          {Math.round(scenario.likelihood_score || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-950 relative h-96 border-t border-slate-800">
                    <AttackPathGraph scenarioId={scenario.id} onOpenGroup={(group) => setSelectedGroup(group)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Attack Matrix Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Bug className="w-6 h-6 text-cyan-500" />
          Matrice MITRE ATT&CK
        </h2>
        <AttackMatrix />
      </div>

      {selectedGroup && (
        <AttackGroupDrawer
          groupId={selectedGroup}
          domainId=""
          onClose={() => setSelectedGroup(null)}
        />
      )}
    </div>
  );
};
