import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, Info, FileWarning, ShieldAlert, Loader2, CheckCircle2, Download, Filter, ChevronDown, ChevronRight, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { CrossLink } from '../../components/shared/CrossLink';
import { complianceApi } from '../../api/endpoints';
import { ComplianceFramework } from '../../types';

export const CompliancePage: React.FC = () => {
  const { user } = useAuth();
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [selectedFrameworkKey, setSelectedFrameworkKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalScore, setGlobalScore] = useState<number>(0);
  
  // UI States
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedControls, setExpandedControls] = useState<Record<string, boolean>>({});

  const fetchCompliance = async () => {
    if (!user) return;
    try {
      const data = await complianceApi.list(user.organization_id);
      setFrameworks(data);
      if (data.length > 0) {
        if (!selectedFrameworkKey) {
           setSelectedFrameworkKey(data[0].framework_key);
        }
        const totalEvaluable = data.reduce((sum: number, fw: any) => sum + fw.evaluable_total, 0);
        const totalCompliant = data.reduce((sum: number, fw: any) => sum + fw.compliant_total, 0);
        const aggregated = totalEvaluable > 0 ? Math.round((totalCompliant / totalEvaluable) * 100) : 0;
        setGlobalScore(aggregated);
      }
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors du chargement des données de conformité.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompliance();
  }, [user]);

  const handlePrint = () => {
    window.print();
  };

  const toggleControl = (controlId: string) => {
    setExpandedControls(prev => ({ ...prev, [controlId]: !prev[controlId] }));
  };

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 text-cyan-500 animate-spin" /></div>;
  if (error) return <div className="text-red-400 p-4 bg-red-900/20 border border-red-500/20 rounded-xl max-w-2xl mx-auto mt-8">{error}</div>;

  const selectedFramework = frameworks.find(fw => fw.framework_key === selectedFrameworkKey);
  
  const filteredControls = selectedFramework?.controls.filter(ctrl => {
    if (filterStatus === 'all') return true;
    return ctrl.status === filterStatus;
  }) || [];

  return (
    <div className="space-y-6 pb-12 print:text-black print:bg-white print:p-0">
      
      {/* Header & Global KPI */}
      <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white print:text-black mb-3 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400 print:text-emerald-600" />
            Conformité Réglementaire
          </h1>
          <p className="text-slate-400 print:text-gray-600 max-w-2xl">
            Vue exécutive de votre posture de conformité par rapport aux référentiels (DNSSI, ISO, Loi 09-08). 
            Les données présentées reflètent l'audit technique automatisé de votre surface exposée.
          </p>
          
          <div className="mt-4 flex items-center gap-2 text-xs text-amber-500/80 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20 w-fit">
            <Info className="w-4 h-4 flex-shrink-0" />
            L'audit automatisé ne se substitue pas à l'analyse documentaire et organisationnelle par un auditeur certifié.
          </div>
        </div>

        {/* Global Score KPI Card */}
        {frameworks.length > 0 && (
          <div className="glass-card print:border-none p-5 flex items-center gap-6 min-w-[300px]">
             <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                   <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-800" strokeWidth="4" />
                   <circle 
                      cx="18" cy="18" r="16" fill="none" 
                      className={`transition-all duration-1000 ease-out ${globalScore >= 80 ? 'stroke-emerald-500' : globalScore >= 50 ? 'stroke-amber-500' : 'stroke-rose-500'}`} 
                      strokeWidth="4" 
                      strokeDasharray={`${globalScore}, 100`}
                      strokeLinecap="round" 
                   />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                   <span className={`text-xl font-bold ${globalScore >= 80 ? 'text-emerald-400' : globalScore >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {globalScore}%
                   </span>
                </div>
             </div>
             <div>
                <h3 className="text-lg font-bold text-white print:text-black leading-tight">Score Global<br/>Moyen</h3>
                <button 
                  onClick={handlePrint}
                  className="print:hidden mt-3 flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-md transition-colors border border-slate-600"
                >
                  <Download className="w-3.5 h-3.5" /> Exporter PDF
                </button>
             </div>
          </div>
        )}
      </div>

      {/* Framework Navigation Tabs */}
      <div className="print:hidden bg-slate-900/50 p-1.5 rounded-xl border border-white/5 inline-flex overflow-x-auto max-w-full custom-scrollbar">
        {frameworks.map((fw) => (
          <button
            key={fw.framework_key}
            onClick={() => setSelectedFrameworkKey(fw.framework_key)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-lg whitespace-nowrap transition-all duration-200 ${
              selectedFrameworkKey === fw.framework_key 
                ? 'bg-cyan-500/20 text-cyan-400 shadow-sm border border-cyan-500/30' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
            }`}
          >
            {fw.name}
          </button>
        ))}
      </div>

      {/* Selected Framework Dashboard & Content */}
      {selectedFramework && (
        <div className="space-y-6">
          
          {/* Executive Overview of Framework */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
            <div className="glass-card p-5 md:col-span-2 flex flex-col justify-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Activity className="w-24 h-24" /></div>
               <h2 className="text-2xl font-bold text-white mb-1">{selectedFramework.name}</h2>
               <p className="text-slate-400 text-sm mb-4">Autorité : {selectedFramework.authority}</p>
               <div className="flex items-end gap-2">
                 <span className={`text-4xl font-black ${selectedFramework.score >= 80 ? 'text-emerald-400' : selectedFramework.score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {selectedFramework.score}%
                 </span>
                 <span className="text-slate-500 font-medium mb-1">conforme</span>
               </div>
            </div>
            
            <div className="glass-card p-5 flex flex-col justify-center items-center text-center border-emerald-500/10">
               <span className="text-3xl font-bold text-emerald-400 mb-1">{selectedFramework.compliant_total}</span>
               <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Contrôles<br/>Conformes</span>
            </div>
            
            <div className="glass-card p-5 flex flex-col justify-center items-center text-center border-rose-500/10">
               <span className="text-3xl font-bold text-rose-400 mb-1">{selectedFramework.evaluable_total - selectedFramework.compliant_total}</span>
               <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Écarts<br/>Techniques</span>
            </div>
          </div>

          {/* Controls List Container */}
          <div className="glass-card print:border-none print:shadow-none print:bg-transparent overflow-hidden">
            
            {/* Filter Bar */}
            <div className="px-6 py-4 border-b border-white/5 bg-slate-900/80 flex flex-wrap items-center justify-between gap-4 print:hidden">
               <div className="flex items-center gap-2">
                 <Filter className="w-4 h-4 text-slate-400" />
                 <span className="text-sm font-medium text-slate-300">Filtres :</span>
               </div>
               <div className="flex flex-wrap gap-2">
                 <button onClick={() => setFilterStatus('all')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filterStatus === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                   Tous ({selectedFramework.controls.length})
                 </button>
                 <button onClick={() => setFilterStatus('non_conforme')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filterStatus === 'non_conforme' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-sm' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-transparent'}`}>
                   Non Conformes ({selectedFramework.controls.filter(c => c.status === 'non_conforme').length})
                 </button>
                 <button onClick={() => setFilterStatus('conforme')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filterStatus === 'conforme' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-transparent'}`}>
                   Conformes ({selectedFramework.controls.filter(c => c.status === 'conforme').length})
                 </button>
                 <button onClick={() => setFilterStatus('non_evaluable')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filterStatus === 'non_evaluable' ? 'bg-slate-700 text-slate-300 border border-slate-500/50 shadow-sm' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-transparent'}`}>
                   Manuel ({selectedFramework.controls.filter(c => c.status === 'non_evaluable').length})
                 </button>
               </div>
            </div>

            {/* List */}
            <div className="divide-y divide-white/5 print:divide-gray-200">
              {filteredControls.length === 0 ? (
                 <div className="p-8 text-center text-slate-500">Aucun contrôle ne correspond à ce filtre.</div>
              ) : (
                filteredControls.map((ctrl) => {
                  const isExpanded = expandedControls[ctrl.control_id] || false;
                  const isFailing = ctrl.status === 'non_conforme';
                  
                  return (
                    <div key={ctrl.control_id} className={`transition-colors print:bg-transparent ${isFailing ? 'hover:bg-rose-950/10' : 'hover:bg-slate-800/30'}`}>
                      {/* Control Header Row */}
                      <div 
                        className={`p-4 md:p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between ${isFailing ? 'cursor-pointer border-l-4 border-l-rose-500' : ctrl.status === 'conforme' ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-slate-600'}`}
                        onClick={() => isFailing && toggleControl(ctrl.control_id)}
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 print:bg-gray-200 text-slate-300 print:text-gray-800 border border-white/10 print:border-transparent uppercase">
                              {ctrl.control_id}
                            </span>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 print:text-cyan-700 truncate max-w-xs">
                              {ctrl.domain}
                            </span>
                            {(ctrl as any).dnssi_class && (
                               <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                 Classe {(ctrl as any).dnssi_class}
                               </span>
                            )}
                          </div>
                          <h3 className={`font-medium text-sm md:text-base pr-4 ${isFailing ? 'text-white' : 'text-slate-300'}`}>{ctrl.title}</h3>
                          
                          {ctrl.status === 'non_evaluable' && ctrl.message && (
                            <p className="text-xs text-slate-500 print:text-gray-600 mt-2 flex items-center gap-1.5">
                              <FileWarning className="w-3 h-3" /> {ctrl.message}
                            </p>
                          )}
                        </div>

                        <div className="flex-shrink-0 flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                          {/* Badges */}
                          <div className="flex items-center gap-2">
                             {ctrl.status === 'conforme' && (
                               <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider">
                                 <CheckCircle2 className="w-3.5 h-3.5" /> Conforme
                               </span>
                             )}
                             {ctrl.status === 'non_evaluable' && (
                               <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-600 text-xs font-bold uppercase tracking-wider">
                                 Manuel
                               </span>
                             )}
                             {isFailing && (
                               <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold uppercase tracking-wider">
                                 <ShieldAlert className="w-3.5 h-3.5" /> Écart Détecté
                               </span>
                             )}
                          </div>
                          
                          {/* Expand Icon for failing controls */}
                          {isFailing && (
                             <div className="text-slate-500 p-1 bg-slate-800 rounded-md hover:text-white hover:bg-slate-700 transition-colors">
                               {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                             </div>
                          )}
                        </div>
                      </div>

                      {/* Expandable Details for Failing Controls */}
                      {isFailing && isExpanded && ctrl.open_risks_details && ctrl.open_risks_details.length > 0 && (
                        <div className="px-5 md:px-8 pb-5 pt-2 bg-black/20 print:bg-transparent border-t border-rose-500/5 print:border-rose-200">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                            Risques à corriger pour atteindre la conformité ({ctrl.open_risks_count}) :
                          </p>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {Object.entries(
                              ctrl.open_risks_details.reduce((acc: any, risk: any) => {
                                if (!acc[risk.rule_key]) acc[risk.rule_key] = { title: risk.title, risks: [] };
                                acc[risk.rule_key].risks.push(risk);
                                return acc;
                              }, {})
                            ).map(([rule_key, group]: [string, any]) => (
                              <div key={rule_key} className="bg-slate-900/60 print:bg-white border border-rose-500/20 print:border-rose-200 p-3.5 rounded-lg flex flex-col">
                                 <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex items-start gap-2.5">
                                      <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                                      <span className="text-sm font-semibold text-slate-200 leading-snug">{group.title}</span>
                                    </div>
                                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-medium whitespace-nowrap">
                                       {group.risks.length} actif(s)
                                    </span>
                                 </div>
                                 
                                 <div className="flex flex-wrap gap-2 mt-auto">
                                    {group.risks.map((risk: any) => (
                                       <CrossLink 
                                          key={risk.id}
                                          to={`/risks/${risk.id}`}
                                          label={risk.asset_target || "Actif inconnu"}
                                          variant="cyan"
                                       />
                                    ))}
                                 </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
