import React, { useEffect, useState } from 'react';
import { attackApi } from '../api/endpoints';
import { X, Loader2, AlertTriangle, Target, Cpu, ShieldAlert } from 'lucide-react';

interface AttackGroupDrawerProps {
  groupId: string;
  domainId: string;
  onClose: () => void;
}

export const AttackGroupDrawer: React.FC<AttackGroupDrawerProps> = ({ groupId, domainId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchGroup = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await attackApi.getGroup(groupId, domainId);
        if (isMounted) setData(res);
      } catch (err) {
        if (isMounted) setError("Erreur de chargement du groupe de menace");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchGroup();
    return () => { isMounted = false; };
  }, [groupId, domainId]);

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] animate-in fade-in"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-slate-950 border-l border-white/10 shadow-2xl z-[100] flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-purple-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">
                {data ? data.name : 'Chargement...'}
              </h2>
              {data && <span className="text-sm font-mono text-slate-400">{data.id}</span>}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              <p>Chargement des données MITRE...</p>
            </div>
          ) : error || !data ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <p>{error || "Données introuvables"}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Exposure Score */}
              {data.exposure_score && data.exposure_score.score > 0 ? (
                <div className="p-5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-4">
                  <ShieldAlert className="w-8 h-8 text-red-400 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-red-400 text-lg mb-1">Exposition détectée !</h3>
                    <p className="text-red-200/80 text-sm leading-relaxed">
                      <strong className="text-red-300">{data.exposure_score.matching_techniques_count}</strong> des techniques habituellement utilisées par {data.name} 
                      trouvent actuellement une faille de niveau <strong className="text-red-300 capitalize">{data.exposure_score.level}</strong> sur votre domaine. 
                      Ce groupe pourrait exploiter ces vulnérabilités.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-4">
                  <ShieldAlert className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-emerald-400 mb-1">Faible Exposition</h3>
                    <p className="text-emerald-300/80 text-sm">
                      Aucune des techniques majeures de ce groupe n'est actuellement exposée de manière critique sur votre domaine.
                    </p>
                  </div>
                </div>
              )}

              {/* Description */}
              {data.description && (
                <section>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">À propos de {data.name}</h3>
                  <div className="text-slate-300 text-sm leading-relaxed bg-slate-900/50 p-4 rounded-xl border border-white/5">
                    {data.description.split('\n').map((paragraph: string, i: number) => (
                      <p key={i} className="mb-2 last:mb-0">{paragraph}</p>
                    ))}
                  </div>
                </section>
              )}

              {/* Software */}
              {data.software && data.software.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" /> Outils & Malwares
                  </h3>
                  <div className="grid gap-3">
                    {data.software.map((sw: any) => (
                      <div key={sw.id} className="bg-slate-800/40 p-3 rounded-lg border border-white/5 hover:border-cyan-500/30 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-cyan-400">{sw.name}</span>
                          <span className="text-[10px] font-mono text-slate-500">{sw.id}</span>
                        </div>
                        {sw.description && (
                          <p className="text-xs text-slate-400 line-clamp-2">{sw.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
