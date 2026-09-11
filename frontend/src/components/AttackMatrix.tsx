import React, { useState, useEffect } from 'react';
import { attackApi, domainsApi } from '../api/endpoints';
import { AlertTriangle, Search, ChevronDown, ChevronUp, Activity, Users } from 'lucide-react';
import { AttackTechniqueDrawer } from './AttackTechniqueDrawer';
import { AttackGroupDrawer } from './AttackGroupDrawer';

export interface MatrixTechnique {
  id: string;
  name: string;
  is_subtechnique: boolean;
  parent_technique_id: string | null;
  description: string | null;
  active_risks_count: number;
  exposure_level: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface MatrixTactic {
  id: string;
  name: string;
  short_name: string;
  techniques: MatrixTechnique[];
}

export interface AttackMatrixResponse {
  tactics: MatrixTactic[];
}

interface AttackMatrixProps {
  onTechniqueClick?: (techniqueId: string) => void;
}

export const AttackMatrix: React.FC<AttackMatrixProps> = ({ onTechniqueClick }) => {
  const [matrixData, setMatrixData] = useState<AttackMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExposedOnly, setShowExposedOnly] = useState(true);
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<string | null>(null);
  
  const [domains, setDomains] = useState<any[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [coverageData, setCoverageData] = useState<any>(null);
  const [showGroups, setShowGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const doms = await domainsApi.list();
        if (isMounted) {
          setDomains(doms);
          if (doms.length > 0) {
            setSelectedDomainId(doms[0].id);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setError("Erreur lors du chargement des domaines");
          setLoading(false);
        }
      }
    };
    init();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedDomainId) return;
    
    let isMounted = true;
    const fetchMatrix = async () => {
      setLoading(true);
      setError(null);
      try {
        const [matrixRes, covRes] = await Promise.all([
           attackApi.getMatrix(selectedDomainId),
           attackApi.getCoverage(selectedDomainId)
        ]);
        if (isMounted) {
          setMatrixData(matrixRes);
          setCoverageData(covRes);
        }
      } catch (err) {
        if (isMounted) setError("Erreur lors du chargement de la matrice ATT&CK");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchMatrix();
    return () => { isMounted = false; };
  }, [selectedDomainId]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-950/40 border-red-500/70 text-red-100 hover:bg-red-900/50 shadow-[0_0_15px_rgba(239,68,68,0.3)] ring-1 ring-red-500/50';
      case 'high': return 'bg-orange-950/40 border-orange-500/70 text-orange-100 hover:bg-orange-900/50 shadow-[0_0_15px_rgba(249,115,22,0.3)] ring-1 ring-orange-500/50';
      case 'medium': 
      case 'low': return 'bg-yellow-950/40 border-yellow-500/70 text-yellow-100 hover:bg-yellow-900/50 shadow-[0_0_15px_rgba(234,179,8,0.3)] ring-1 ring-yellow-500/50';
      default: return 'bg-slate-900/40 border-slate-800 text-slate-500 hover:bg-slate-800/60 hover:text-slate-300';
    }
  };

  const getBadgeColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': 
      case 'low': return 'bg-yellow-500 text-black';
      default: return 'bg-slate-700 text-slate-300';
    }
  };

  if (loading && !matrixData) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="flex gap-4 mb-4">
          <div className="h-10 bg-slate-800/50 rounded-xl w-48"></div>
          <div className="h-10 bg-slate-800/50 rounded-xl w-64"></div>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="min-w-[220px] space-y-2">
              <div className="h-16 bg-slate-800/80 rounded-lg"></div>
              {[1, 2, 3, 4].map(j => (
                <div key={j} className="h-16 bg-slate-800/40 rounded-lg"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 flex items-center justify-center text-red-400 gap-3 border-red-500/20">
        <AlertTriangle className="w-6 h-6" />
        <p>{error}</p>
      </div>
    );
  }

  if (!matrixData && !loading && domains.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-slate-400">
        Veuillez ajouter un domaine pour visualiser la matrice ATT&CK.
      </div>
    );
  }

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim() !== '') {
       const term = searchTerm.toLowerCase();
       let foundId: string | null = null;
       
       if (matrixData) {
         for (const tactic of matrixData.tactics) {
           for (const tech of tactic.techniques) {
              if (tech.id.toLowerCase() === term || tech.name.toLowerCase().includes(term)) {
                 foundId = tech.id;
                 break;
              }
           }
           if (foundId) break;
         }
       }
       
       if (foundId) {
          const el = document.getElementById(`tech-${foundId}`);
          if (el) {
             el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
             // Flash effect could be added here
          }
       }
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters & Controls */}
      <div className="glass-card p-4 flex flex-col md:flex-row justify-between items-center gap-4 border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-300 whitespace-nowrap">Domaine ciblé :</label>
            <select 
              className="input-field max-w-[200px]" 
              value={selectedDomainId} 
              onChange={(e) => setSelectedDomainId(e.target.value)}
            >
              {domains.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          
          <div className="relative w-full md:w-64">
             <input 
               type="text" 
               className="input-field pl-9 w-full bg-slate-900/80" 
               placeholder="Rechercher (ex: T1584, Phishing)..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               onKeyDown={handleSearch}
             />
             <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
        </div>
        
        <div className="flex bg-slate-900/50 p-1 rounded-lg border border-white/5 w-full md:w-auto">
          <button 
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${!showExposedOnly ? 'bg-cyan-500/20 text-cyan-400 shadow-sm' : 'text-slate-400 hover:text-white'}`}
            onClick={() => setShowExposedOnly(false)}
          >
            Vue complète
          </button>
          <button 
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${showExposedOnly ? 'bg-red-500/20 text-red-400 shadow-sm' : 'text-slate-400 hover:text-white'}`}
            onClick={() => setShowExposedOnly(true)}
          >
            <AlertTriangle className="w-4 h-4" />
            Exposées uniquement
          </button>
        </div>
      </div>
      
      {/* Threat Groups Section */}
      {coverageData && coverageData.top_groups && coverageData.top_groups.length > 0 && (
         <div className="glass-card border border-rose-500/20 overflow-hidden">
            <button 
              className="w-full p-4 flex items-center justify-between bg-slate-900/50 hover:bg-slate-800/50 transition-colors"
              onClick={() => setShowGroups(!showGroups)}
            >
               <div className="flex items-center gap-3">
                 <Users className="w-5 h-5 text-rose-400" />
                 <h3 className="text-white font-bold">Groupes de menace pertinents</h3>
                 <span className="bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded text-xs font-bold">{coverageData.top_groups.length} groupes</span>
               </div>
               {showGroups ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            
            {showGroups && (
               <div className="p-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {coverageData.top_groups.map((item: any) => (
                     <div 
                        key={item.group.id} 
                        className="bg-slate-900 p-4 rounded-lg border border-slate-700 hover:border-rose-500/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedGroupId(item.group.id)}
                     >
                        <div className="flex items-center justify-between mb-2">
                           <span className="font-bold text-white text-lg">{item.group.name}</span>
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getBadgeColor(item.exposure.level)}`}>
                              Score: {item.exposure.score}
                           </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">{item.group.description || "Aucune description."}</p>
                        <div className="mt-3 flex items-center gap-2">
                           <Activity className="w-4 h-4 text-slate-500" />
                           <span className="text-xs font-medium text-slate-300">{item.exposure.matching_techniques_count} techniques correspondantes</span>
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>
      )}

      {/* Matrix Display */}
      <div className="overflow-x-auto pb-6 pt-2 custom-scrollbar">
        <div className="flex gap-3 min-w-max px-2">
          {matrixData?.tactics.map(tactic => {
            const visibleTechniques = tactic.techniques.filter(t => 
              !t.is_subtechnique && (!showExposedOnly || t.exposure_level !== 'none' || tactic.techniques.some(sub => sub.parent_technique_id === t.id && sub.exposure_level !== 'none'))
            );

            const exposedCount = tactic.techniques.filter(t => t.exposure_level !== 'none').length;
            const totalCount = tactic.techniques.length;
            
            if (showExposedOnly && visibleTechniques.length === 0) return null;

            return (
              <div key={tactic.id} className="w-[220px] flex-shrink-0 flex flex-col gap-2">
                {/* Tactic Header */}
                <div className="bg-slate-900/80 border-t-2 border-cyan-500 p-3 rounded-lg shadow-lg backdrop-blur-md sticky top-0 z-10 flex flex-col justify-center min-h-[72px] ring-1 ring-white/5">
                  <h3 className="text-sm font-bold text-white text-center leading-tight line-clamp-2" title={tactic.name}>
                    {tactic.name}
                  </h3>
                  <div className="flex justify-between items-center mt-1.5 px-1">
                     <span className="text-[10px] text-cyan-400 font-mono opacity-80">{tactic.id}</span>
                     <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${exposedCount > 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400'}`}>
                        {exposedCount}/{totalCount} exp.
                     </span>
                  </div>
                </div>

                {/* Techniques List */}
                <div className="flex flex-col gap-2">
                  {visibleTechniques.map(tech => (
                    <div key={tech.id} className="flex flex-col gap-1">
                      <button
                        id={`tech-${tech.id}`}
                        onClick={() => {
                          setSelectedTechniqueId(tech.id);
                          if (onTechniqueClick) onTechniqueClick(tech.id);
                        }}
                        className={`text-left p-3 rounded-lg border transition-all duration-200 relative group flex flex-col gap-1 ${getLevelColor(tech.exposure_level)} ${showExposedOnly && tech.exposure_level === 'none' ? 'hidden' : ''} ${searchTerm && (tech.id.toLowerCase() === searchTerm.toLowerCase() || tech.name.toLowerCase().includes(searchTerm.toLowerCase())) ? 'ring-2 ring-white scale-[1.02] z-10' : ''}`}
                      >
                        <div className="flex justify-between items-start w-full gap-2">
                          <span className="text-xs font-semibold leading-snug">{tech.name}</span>
                          {tech.active_risks_count > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getBadgeColor(tech.exposure_level)}`}>
                              {tech.active_risks_count}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] opacity-70 font-mono">{tech.id}</span>
                      </button>
                      
                      {/* Subtechniques */}
                      {tactic.techniques.filter(sub => sub.parent_technique_id === tech.id && (!showExposedOnly || sub.exposure_level !== 'none')).map(sub => (
                        <button
                          id={`tech-${sub.id}`}
                          key={sub.id}
                          onClick={() => {
                            setSelectedTechniqueId(sub.id);
                            if (onTechniqueClick) onTechniqueClick(sub.id);
                          }}
                          className={`ml-4 text-left p-2 rounded-lg border transition-all duration-200 relative group flex flex-col gap-1 border-l-4 ${getLevelColor(sub.exposure_level)} ${showExposedOnly && sub.exposure_level === 'none' ? 'hidden' : ''} ${searchTerm && (sub.id.toLowerCase() === searchTerm.toLowerCase() || sub.name.toLowerCase().includes(searchTerm.toLowerCase())) ? 'ring-2 ring-white scale-[1.02] z-10' : ''}`}
                        >
                          <div className="flex justify-between items-start w-full gap-2">
                            <span className="text-xs font-medium leading-snug">{sub.name}</span>
                            {sub.active_risks_count > 0 && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getBadgeColor(sub.exposure_level)}`}>
                                {sub.active_risks_count}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] opacity-70 font-mono">{sub.id}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {selectedTechniqueId && (
        <AttackTechniqueDrawer 
          techniqueId={selectedTechniqueId}
          domainId={selectedDomainId}
          onClose={() => setSelectedTechniqueId(null)}
        />
      )}
      
      {selectedGroupId && (
        <AttackGroupDrawer
          groupId={selectedGroupId}
          domainId={selectedDomainId}
          onClose={() => setSelectedGroupId(null)}
        />
      )}
    </div>
  );
};
