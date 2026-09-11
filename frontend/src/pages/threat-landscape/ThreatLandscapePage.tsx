import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { threatLandscapeApi, domainsApi } from '../../api/endpoints';
import { Target, Globe, AlertTriangle, Crosshair, Map as MapIcon, Bot, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { CrossLink } from '../../components/shared/CrossLink';

// Component to handle expanding risk badges if > 5
const ExpandableRiskList: React.FC<{ risks: any[] }> = ({ risks }) => {
  const [expanded, setExpanded] = useState(false);
  const displayRisks = expanded ? risks : risks.slice(0, 5);
  const remaining = risks.length - 5;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {displayRisks.map((risk: any) => (
        <CrossLink 
          key={risk.risk_id} 
          to={`/risks/${risk.risk_id}`}
          label={risk.rule_key}
          variant="rose"
        />
      ))}
      {remaining > 0 && (
        <button 
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800/50 hover:bg-slate-700 hover:text-white px-2 py-0.5 rounded border border-white/10 transition-colors"
        >
          {expanded ? "Masquer" : `+${remaining} autres`}
        </button>
      )}
    </div>
  );
};

export const ThreatLandscapePage: React.FC = () => {
  const { user } = useAuth();
  const [briefing, setBriefing] = useState<any>(null);
  const [actors, setActors] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch domains on mount
  useEffect(() => {
    domainsApi.list().then(setDomains).catch(console.error);
  }, []);

  // Fetch threat landscape data when domain changes
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const domainIdParam = selectedDomain || undefined;
        const [bData, aData] = await Promise.all([
          threatLandscapeApi.getBriefing(user.organization_id, domainIdParam).catch(() => null),
          threatLandscapeApi.getActors(user.organization_id, domainIdParam).catch(() => [])
        ]);
        setBriefing(bData);
        setActors(aData);
      } catch (err) {
        console.error("Failed to fetch threat landscape", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, selectedDomain]);

  const getSeverityLabel = (scoreSum: number, count: number) => {
    if (count === 0) return 'Aucune';
    const avg = scoreSum / count;
    if (avg >= 3.5) return 'Critique';
    if (avg >= 2.5) return 'Élevée';
    if (avg >= 1.5) return 'Moyenne';
    return 'Faible';
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Globe className="w-8 h-8 text-indigo-500" />
            Threat Landscape
          </h1>
          <p className="text-slate-400 mt-2 text-lg">
            Acteurs de la menace ciblant votre secteur et votre région, corrélés avec vos vulnérabilités.
          </p>
        </div>
        
        {/* Domain Selector */}
        <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-white/5">
          <Shield className="w-5 h-5 text-slate-400" />
          <select 
            className="bg-transparent border-none text-sm text-white focus:ring-0 cursor-pointer w-48"
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
          >
            <option value="">Tous les domaines (Vue Globale)</option>
            {domains.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-cyan-400 p-8 text-center animate-pulse">Chargement de la Threat Intelligence (Scope: {selectedDomain ? 'Domaine spécifique' : 'Global'})...</div>
      ) : (
        <>
          {/* Briefing Section */}
          {briefing && briefing.content && (
            <div className="glass-card p-6 border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-950/30 to-transparent relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-indigo-500/30">
                <Bot className="w-3.5 h-3.5" />
                Executive Briefing IA
              </div>
              
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-400" />
                Synthèse Quotidienne ({selectedDomain ? 'Vue Filtrée' : 'Vue Globale'})
              </h2>
              
              <div className="prose prose-invert max-w-none">
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  {briefing.content.executive_summary}
                </p>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-black/30 rounded-xl p-4 border border-rose-500/20">
                    <h3 className="text-rose-400 font-semibold mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                      <AlertTriangle className="w-4 h-4" /> Préoccupations Majeures
                    </h3>
                    <ul className="space-y-2">
                      {briefing.content.key_concerns?.map((c: string, i: number) => (
                        <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                          <span className="text-rose-500 mt-1">•</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-black/30 rounded-xl p-4 border border-emerald-500/20">
                    <h3 className="text-emerald-400 font-semibold mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                      <Crosshair className="w-4 h-4" /> Recommandations
                    </h3>
                    <ul className="space-y-2">
                      {briefing.content.recommendations?.map((r: string, i: number) => (
                        <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                          <span className="text-emerald-500 mt-1">•</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actors List */}
          <h2 className="text-xl font-bold text-white mb-4 mt-8 flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-slate-400" />
            Groupes de Menaces Suivis
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {actors.map(actor => (
              <div key={actor.actor_id} className={`glass-card p-5 rounded-xl border-l-4 transition-all duration-300 ${actor.score > 0 ? 'border-l-rose-500 ring-1 ring-rose-500/30 bg-rose-950/10' : 'border-l-slate-700 opacity-75'}`}>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold text-white">{actor.actor_name}</h3>
                  {actor.score > 0 ? (
                    <div className="text-right flex flex-col items-end">
                      <span className="bg-rose-500/20 text-rose-400 text-xs px-2 py-1 rounded font-bold uppercase">Menace Active</span>
                      <span className="text-[10px] text-rose-300/80 mt-1 font-medium">Score: {actor.score.toFixed(1)}</span>
                    </div>
                  ) : (
                    <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded font-medium">Surveillé — pas d'exposition actuelle</span>
                  )}
                </div>
                
                <p className="text-slate-400 text-sm mb-4 line-clamp-2">{actor.description}</p>
                
                {actor.score > 0 && (
                  <div className="bg-black/30 rounded p-2 mb-4 border border-rose-900/30">
                    <p className="text-xs text-rose-300 flex justify-between items-center">
                      <span>Exposition : <strong className="text-white">{actor.covered_techniques_count}/{actor.total_techniques_count}</strong> techniques couvertes</span>
                      <span>Sévérité moyenne : <strong className="text-white">{getSeverityLabel(actor.severity_score_sum, actor.covered_techniques_count)}</strong></span>
                    </p>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {actor.targeted_sectors?.map((s: string) => (
                    <span key={s} className="bg-cyan-950/50 text-cyan-400 border border-cyan-500/30 text-[10px] px-2 py-0.5 rounded-full uppercase">{s}</span>
                  ))}
                  {actor.targeted_regions?.map((r: string) => (
                    <span key={r} className="bg-amber-950/50 text-amber-400 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded-full uppercase">{r}</span>
                  ))}
                </div>
                
                {actor.common_techniques?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <h4 className="text-xs font-semibold text-rose-300 uppercase tracking-wider mb-2">Vulnérabilités associées (Techniques)</h4>
                    <div className="space-y-3">
                      {actor.common_techniques.map((tech: any) => {
                        // Deduplicate risks in frontend to handle edge cases where backend might return duplicates in global view
                        const uniqueRisks = Array.from(new Map(tech.active_risks.map((item: any) => [item.risk_id, item])).values()) as any[];
                        
                        return (
                          <div key={tech.technique_id} className="bg-black/40 rounded p-2 flex flex-col gap-1 border border-white/5">
                            <span className="text-rose-400 font-mono text-xs font-bold">{tech.technique_id}</span>
                            <ExpandableRiskList risks={uniqueRisks} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div className="mt-4 text-right">
                  <a href={actor.source_ref?.startsWith('http') ? actor.source_ref : `https://attack.mitre.org/groups/${actor.source_ref?.split(' ')[-1]}`} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300">
                    En savoir plus &rarr;
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
