import React, { useEffect, useState } from 'react';
import { attackApi } from '../api/endpoints';
import { Link } from 'react-router-dom';
import { X, Loader2, ShieldCheck, ShieldAlert, Users, Target, ArrowRight, Activity } from 'lucide-react';
import { SeverityBadge } from './shared/SeverityBadge';
import { AttackGroupDrawer } from './AttackGroupDrawer';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AttackTechniqueDrawerProps {
  techniqueId: string;
  domainId: string;
  onClose: () => void;
}

export const AttackTechniqueDrawer: React.FC<AttackTechniqueDrawerProps> = ({ techniqueId, domainId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchTechnique = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await attackApi.getTechnique(techniqueId, domainId);
        if (isMounted) setData(res);
      } catch (err) {
        if (isMounted) setError("Erreur de chargement de la technique");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchTechnique();
    return () => { isMounted = false; };
  }, [techniqueId, domainId]);

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] animate-in fade-in"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-slate-950 border-l border-white/10 shadow-2xl z-[100] flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">
                {data ? data.name : 'Chargement...'}
              </h2>
              {data && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono bg-white/10 text-cyan-400 px-2 py-0.5 rounded">{data.id}</span>
                  {data.tactics && data.tactics.length > 0 && (
                    <span className="text-xs text-slate-400">{data.tactics.join(', ')}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              <p>Récupération depuis MITRE ATT&CK...</p>
            </div>
          ) : error || !data ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
              <ShieldAlert className="w-6 h-6 flex-shrink-0" />
              <p>{error || "Données introuvables"}</p>
            </div>
          ) : (
            <>
              {/* Active Risks */}
              {data.active_risks && data.active_risks.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400" /> Risques Actifs ({data.active_risks.length})
                  </h3>
                  <div className="grid gap-3">
                    {data.active_risks.map((risk: any) => (
                      <Link 
                        key={risk.id}
                        to={`/risks/${risk.id}`}
                        className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-center justify-between hover:bg-red-500/20 transition-colors group"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <SeverityBadge severity={risk.severity} />
                            <span className="text-white font-semibold text-sm">{risk.rule_key.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="text-xs text-slate-400">Sur l'actif: <span className="text-slate-300 font-medium">{risk.asset_name}</span></p>
                          <p className="text-[10px] text-slate-500 mt-1">Détecté le {format(new Date(risk.first_detected_at), 'dd MMM yyyy', { locale: fr })}</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-red-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Description */}
              {data.description && (
                <section>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Description MITRE</h3>
                  <div className="text-slate-300 text-sm leading-relaxed bg-slate-900/50 p-4 rounded-xl border border-white/5">
                    {data.description.split('\n').map((paragraph: string, i: number) => (
                      <p key={i} className="mb-2 last:mb-0">{paragraph}</p>
                    ))}
                  </div>
                </section>
              )}

              {/* Mitigations */}
              {data.mitigations && data.mitigations.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Mitigations Recommandées
                  </h3>
                  <div className="grid gap-3">
                    {data.mitigations.map((mitigation: any) => (
                      <div key={mitigation.id} className="bg-slate-800/40 p-4 rounded-xl border border-emerald-500/10">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-emerald-400">{mitigation.name}</span>
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded">{mitigation.id}</span>
                        </div>
                        {mitigation.description && (
                          <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{mitigation.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Threat Groups */}
              {data.groups && data.groups.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" /> Groupes APT associés
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {data.groups.map((group: any) => (
                      <button
                        key={group.id}
                        onClick={() => setSelectedGroupId(group.id)}
                        className="bg-slate-800/40 p-3 rounded-lg border border-purple-500/20 hover:bg-purple-500/10 hover:border-purple-500/40 transition-all text-left flex items-center justify-between group"
                      >
                        <div>
                          <span className="font-medium text-purple-300 block">{group.name}</span>
                          <span className="text-[10px] font-mono text-slate-500">{group.id}</span>
                        </div>
                        <Target className="w-4 h-4 text-purple-400 opacity-50 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {selectedGroupId && (
        <AttackGroupDrawer 
          groupId={selectedGroupId} 
          domainId={domainId} 
          onClose={() => setSelectedGroupId(null)} 
        />
      )}
    </>
  );
};
