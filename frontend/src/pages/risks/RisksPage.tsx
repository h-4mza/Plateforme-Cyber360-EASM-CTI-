import React, { useEffect, useState } from 'react';
import { ShieldAlert, Shield, ShieldCheck, AlertTriangle, ArrowRight, Download, Info } from 'lucide-react';
import { risksApi, organizationApi, scenariosApi } from '../../api/endpoints';
import { Risk } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { Link, useSearchParams } from 'react-router-dom';
import { SeverityBadge } from '../../components/shared/SeverityBadge';
import { CrossLink } from '../../components/shared/CrossLink';
import { CheckSquare, Flame, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';

export const RisksPage: React.FC = () => {
  const { user } = useAuth();
  const [allRisks, setAllRisks] = useState<Risk[]>([]);
  const [financialExposure, setFinancialExposure] = useState<any>(null);
  const [activeScenarios, setActiveScenarios] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const assetIdFilter = searchParams.get('asset_id') || '';
  
  const [statusFilter, setStatusFilter] = useState('open');
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'passive' | 'active'>('all');
  const [domainFilter, setDomainFilter] = useState('');
  const [hasAiFilter, setHasAiFilter] = useState<boolean | null>(null);
  
  const [selectedRisks, setSelectedRisks] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: 'severity' | 'date', direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const fetchRisks = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [data, exposure, scenariosData] = await Promise.all([
        risksApi.listOrgRisks(user.organization_id, {
          status: statusFilter || undefined,
          asset_id: assetIdFilter || undefined,
          has_ai: hasAiFilter === true ? true : undefined
        }),
        organizationApi.getFinancialExposure().catch(() => null),
        scenariosApi.list(user.organization_id).catch(() => [])
      ]);
      setAllRisks(data);
      if (exposure) setFinancialExposure(exposure);
      setActiveScenarios(scenariosData.filter((s: any) => s.status === 'open' || s.status === 'partial'));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRisks();
  }, [statusFilter, severityFilter, domainFilter, assetIdFilter, user, hasAiFilter]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, severityFilter, domainFilter, categoryFilter, sourceFilter, hasAiFilter]);

  const handleBulkResolve = async () => {
    if (selectedRisks.size === 0) return;
    if (window.confirm(`Êtes-vous sûr de vouloir marquer ces ${selectedRisks.size} risques comme résolus ?`)) {
       try {
         await risksApi.resolveBulk(user!.organization_id, Array.from(selectedRisks));
         setSelectedRisks(new Set());
         fetchRisks();
       } catch (err) {
         console.error(err);
         alert("Erreur lors de la résolution des risques");
       }
    }
  };

  const filteredRisks = allRisks.filter(r => {
    if (severityFilter && r.severity !== severityFilter) return false;
    if (categoryFilter && r.category !== categoryFilter) return false;
    if (domainFilter && r.domain_name !== domainFilter) return false;
    if (sourceFilter === 'passive' && r.is_active_recon) return false;
    if (sourceFilter === 'active' && !r.is_active_recon) return false;
    return true;
  });
  
  const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const sortedRisks = [...filteredRisks].sort((a, b) => {
    if (!sortConfig) return 0;
    if (sortConfig.key === 'severity') {
       const orderA = severityOrder[a.severity] || 0;
       const orderB = severityOrder[b.severity] || 0;
       return sortConfig.direction === 'asc' ? orderA - orderB : orderB - orderA;
    } else if (sortConfig.key === 'date') {
       const dateA = new Date(a.first_detected_at).getTime();
       const dateB = new Date(b.first_detected_at).getTime();
       return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
    }
    return 0;
  });
  
  const paginatedRisks = sortedRisks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(sortedRisks.length / itemsPerPage);

  const uniqueDomains = Array.from(new Set(allRisks.filter(r => r.domain_name).map(r => r.domain_name))).sort();

  const criticalCount = filteredRisks.filter(r => r.severity === 'critical').length;
  const highCount = filteredRisks.filter(r => r.severity === 'high').length;
  const mediumCount = filteredRisks.filter(r => r.severity === 'medium').length;
  const lowCount = filteredRisks.filter(r => r.severity === 'low').length;

  const handleExportCSV = () => {
    const headers = ["Sévérité", "Catégorie", "Risque", "Actif Concerné", "Statut", "Date de détection"];
    const csvContent = [
      headers.join(","),
      ...filteredRisks.map(r => [
        r.severity,
        r.category,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        r.asset_target || "",
        r.status,
        r.first_detected_at
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "export_risques.csv";
    link.click();
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-red-400" />
            Risques détectés
          </h1>
          <p className="text-slate-400">Consultez et traitez les vulnérabilités et mauvaises configurations détectées sur vos actifs.</p>
        </div>
        <button onClick={handleExportCSV} className="btn-secondary gap-2 text-sm">
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>
      
      {/* Bulk actions */}
      {selectedRisks.size > 0 && (
         <div className="bg-cyan-900/40 border border-cyan-500/30 p-3 rounded-xl flex items-center justify-between sticky top-4 z-20 shadow-xl backdrop-blur-md">
            <span className="text-cyan-100 font-medium ml-2">
               {selectedRisks.size} risque(s) sélectionné(s)
            </span>
            <button 
               onClick={handleBulkResolve}
               className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
               <CheckSquare className="w-4 h-4" />
               Marquer comme résolu(s)
            </button>
         </div>
      )}

      {/* Source Tabs */}
      <div className="flex border-b border-white/10 gap-6">
        <button 
          onClick={() => { setSourceFilter('all'); setHasAiFilter(null); }}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${sourceFilter === 'all' && hasAiFilter === null ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          Tous les risques
        </button>
        <button 
          onClick={() => { setSourceFilter('passive'); setHasAiFilter(null); }}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${sourceFilter === 'passive' && hasAiFilter === null ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <Shield className="w-4 h-4" />
          Découverte Passive
        </button>
        <button 
          onClick={() => { setSourceFilter('active'); setHasAiFilter(null); }}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${sourceFilter === 'active' && hasAiFilter === null ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <AlertTriangle className="w-4 h-4" />
          Active Recon (Intrusif)
        </button>
        <button 
          onClick={() => { setSourceFilter('all'); setHasAiFilter(true); }}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${hasAiFilter === true ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>
          Analysés par l'IA
        </button>
      </div>

      {/* Financial Exposure & KPIs in a single sleek row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Financial Exposure Card - Takes 2 columns on large screens if we want, or 1. Let's make it 1 large card */}
        {financialExposure && statusFilter !== 'resolved' ? (
          <div className="glass-card p-6 lg:col-span-3 border-l-4 border-l-rose-500 bg-gradient-to-r from-rose-950/20 to-transparent relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="absolute -right-10 -top-10 opacity-5 pointer-events-none">
              <ShieldAlert className="w-64 h-64 text-rose-500" />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-sm font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Exposition Financière Globale (Annualisée)
              </h2>
              <div className="flex items-baseline gap-3">
                <div className="text-4xl font-black text-white">
                  {new Intl.NumberFormat('fr-MA', { style: 'currency', currency: financialExposure.currency, maximumFractionDigits: 0 }).format(financialExposure.annualized_loss_min)} 
                </div>
                <div className="text-xl text-slate-400 font-medium">à</div>
                <div className="text-4xl font-black text-rose-500">
                  {new Intl.NumberFormat('fr-MA', { style: 'currency', currency: financialExposure.currency, maximumFractionDigits: 0 }).format(financialExposure.annualized_loss_max)}
                </div>
              </div>
              <div className="text-slate-400 text-sm mt-2">
                Basé sur {allRisks.filter(r => r.status === 'open').length} risques ouverts.
              </div>
            </div>
            
            <div className="relative z-10 max-w-sm bg-black/40 backdrop-blur-md border border-rose-500/20 p-4 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-200/80 leading-relaxed font-medium">
                {financialExposure.warning}
              </p>
            </div>
          </div>
        ) : null}

        {/* Visual Summary Cards */}
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div 
            onClick={() => setSeverityFilter(severityFilter === 'critical' ? '' : 'critical')}
            className={`glass-card p-5 flex flex-col relative overflow-hidden cursor-pointer transition-all duration-300 group ${severityFilter === 'critical' ? 'ring-2 ring-red-500 bg-red-950/20 shadow-[0_0_30px_-5px_rgba(239,68,68,0.3)]' : 'hover:bg-slate-800/50'}`}
          >
            <div className={`absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110 ${severityFilter === 'critical' ? 'bg-red-500/20' : ''}`} />
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 relative z-10">Critiques</span>
            <div className="flex items-end gap-3 relative z-10">
              <span className="text-4xl font-black text-red-500">{criticalCount}</span>
              <span className="text-xs text-slate-500 font-medium mb-1.5">risques</span>
            </div>
          </div>
          
          <div 
            onClick={() => setSeverityFilter(severityFilter === 'high' ? '' : 'high')}
            className={`glass-card p-5 flex flex-col relative overflow-hidden cursor-pointer transition-all duration-300 group ${severityFilter === 'high' ? 'ring-2 ring-amber-500 bg-amber-950/20 shadow-[0_0_30px_-5px_rgba(245,158,11,0.3)]' : 'hover:bg-slate-800/50'}`}
          >
            <div className={`absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110 ${severityFilter === 'high' ? 'bg-amber-500/20' : ''}`} />
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 relative z-10">Importants</span>
            <div className="flex items-end gap-3 relative z-10">
              <span className="text-4xl font-black text-amber-500">{highCount}</span>
              <span className="text-xs text-slate-500 font-medium mb-1.5">risques</span>
            </div>
          </div>
          
          <div 
            onClick={() => setSeverityFilter(severityFilter === 'medium' ? '' : 'medium')}
            className={`glass-card p-5 flex flex-col relative overflow-hidden cursor-pointer transition-all duration-300 group ${severityFilter === 'medium' ? 'ring-2 ring-yellow-500 bg-yellow-950/20 shadow-[0_0_30px_-5px_rgba(234,179,8,0.2)]' : 'hover:bg-slate-800/50'}`}
          >
            <div className={`absolute top-0 right-0 w-16 h-16 bg-yellow-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110 ${severityFilter === 'medium' ? 'bg-yellow-500/20' : ''}`} />
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 relative z-10">Moyens</span>
            <div className="flex items-end gap-3 relative z-10">
              <span className="text-4xl font-black text-yellow-500">{mediumCount}</span>
              <span className="text-xs text-slate-500 font-medium mb-1.5">risques</span>
            </div>
          </div>
          
          <div 
            onClick={() => setSeverityFilter(severityFilter === 'low' ? '' : 'low')}
            className={`glass-card p-5 flex flex-col relative overflow-hidden cursor-pointer transition-all duration-300 group ${severityFilter === 'low' ? 'ring-2 ring-slate-400 bg-slate-800 shadow-[0_0_30px_-5px_rgba(148,163,184,0.2)]' : 'hover:bg-slate-800/50'}`}
          >
            <div className={`absolute top-0 right-0 w-16 h-16 bg-slate-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110 ${severityFilter === 'low' ? 'bg-slate-500/20' : ''}`} />
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 relative z-10">Faibles</span>
            <div className="flex items-end gap-3 relative z-10">
              <span className="text-4xl font-black text-slate-400">{lowCount}</span>
              <span className="text-xs text-slate-500 font-medium mb-1.5">risques</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex gap-4 w-full md:w-auto">
              <select className="input-field w-full md:w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="open">Statut : Ouverts</option>
                <option value="resolved">Statut : Résolus</option>
                <option value="">Tous les statuts</option>
              </select>
              <select className="input-field w-full md:w-auto" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
                <option value="">Toutes sévérités</option>
                <option value="critical">Critique</option>
                <option value="high">Important</option>
                <option value="medium">Moyen</option>
                <option value="low">Faible</option>
              </select>
              {uniqueDomains.length > 0 && (
                <select className="input-field w-full md:w-auto" value={domainFilter} onChange={e => setDomainFilter(e.target.value)}>
                  <option value="">Tous les domaines</option>
                  {uniqueDomains.map(d => (
                    <option key={d as string} value={d as string}>{d as string}</option>
                  ))}
                </select>
              )}
              {assetIdFilter && (
                <button onClick={() => { setSearchParams({}); }} className="text-sm text-cyan-400 hover:text-cyan-300">
                  Effacer filtre actif
                </button>
              )}
            </div>
          </div>
          
          {/* Category Chips */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-slate-400 py-1.5 mr-2">Catégories :</span>
            {['dns', 'tls', 'messagerie', 'services', 'configuration', 'threat_intelligence', 'asset_security', 'infrastructure'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  categoryFilter === cat 
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' 
                    : 'bg-slate-800/50 text-slate-400 border-white/5 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                {cat.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="table-header w-10">
                   <input 
                      type="checkbox" 
                      className="cursor-pointer"
                      checked={paginatedRisks.length > 0 && selectedRisks.size === paginatedRisks.length}
                      onChange={() => {
                         if (selectedRisks.size === paginatedRisks.length) {
                            setSelectedRisks(new Set());
                         } else {
                            setSelectedRisks(new Set(paginatedRisks.map(r => r.id)));
                         }
                      }}
                   />
                </th>
                <th className="table-header cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => setSortConfig({ key: 'severity', direction: sortConfig?.key === 'severity' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })}>
                   Sévérité {sortConfig?.key === 'severity' && (sortConfig.direction === 'desc' ? <ArrowDown className="w-3 h-3 inline" /> : <ArrowUp className="w-3 h-3 inline" />)}
                </th>
                <th className="table-header">Source</th>
                <th className="table-header">Catégorie</th>
                <th className="table-header">Risque</th>
                <th className="table-header">Actif concerné</th>
                <th className="table-header cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => setSortConfig({ key: 'date', direction: sortConfig?.key === 'date' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })}>
                   Date de détection {sortConfig?.key === 'date' && (sortConfig.direction === 'desc' ? <ArrowDown className="w-3 h-3 inline" /> : <ArrowUp className="w-3 h-3 inline" />)}
                </th>
                <th className="table-header w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">Chargement...</td>
                </tr>
              ) : filteredRisks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Aucun risque trouvé avec ces filtres. Bravo ! 🎉</td>
                </tr>
              ) : (
                paginatedRisks.map(risk => {
                  const activeScenario = activeScenarios.find(s => s.risks.some((r: any) => r.id === risk.id));
                  return (
                  <tr key={risk.id} className="table-row hover:bg-slate-800/30 transition-colors group">
                    <td className="table-cell">
                       <input 
                          type="checkbox"
                          className="cursor-pointer"
                          checked={selectedRisks.has(risk.id)}
                          onChange={() => {
                             const next = new Set(selectedRisks);
                             if (next.has(risk.id)) next.delete(risk.id);
                             else next.add(risk.id);
                             setSelectedRisks(next);
                          }}
                       />
                    </td>
                    <td className="table-cell">
                      <SeverityBadge severity={risk.severity} />
                    </td>
                    <td className="table-cell">
                      {risk.is_active_recon ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-medium">
                          <AlertTriangle className="w-3 h-3" /> Active Recon
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-medium">
                          <Shield className="w-3 h-3" /> Passif
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-sm text-slate-400 capitalize">
                      {risk.category}
                    </td>
                    <td className="table-cell font-medium text-white max-w-xs">
                      <div className="truncate mb-1">{risk.title}</div>
                      {activeScenario && (
                         <div className="mt-1">
                            <CrossLink 
                               to="/scenarios" 
                               label={`Fait partie de : ${activeScenario.title}`}
                               icon={<Flame className="w-3 h-3" />}
                               variant="rose"
                            />
                         </div>
                      )}
                    </td>
                    <td className="table-cell text-sm text-slate-400">
                      {assetIdFilter ? (
                        <span className="text-slate-300">{risk.asset_target}</span>
                      ) : risk.asset_target && risk.asset_id ? (
                        <Link to={`/inventory/${risk.asset_id}`} className="hover:text-cyan-400 transition-colors">
                          {risk.asset_target}
                        </Link>
                      ) : risk.asset_target ? (
                        <Link to={`/inventory?search=${risk.asset_target}`} className="hover:text-cyan-400 transition-colors">
                          {risk.asset_target}
                        </Link>
                      ) : (
                        <span className="italic text-slate-500">Non défini</span>
                      )}
                    </td>
                    <td className="table-cell text-sm text-slate-400">
                      {new Date(risk.first_detected_at).toLocaleDateString()}
                    </td>
                    <td className="table-cell">
                      <Link to={`/risks/${risk.id}`} className="p-2 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-cyan-400/10 transition-colors block">
                        <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
           <div className="flex items-center justify-between mt-6 px-4 py-3 bg-slate-900/30 border-t border-white/5 rounded-b-xl">
              <span className="text-sm text-slate-400">
                 Affichage de {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, sortedRisks.length)} sur {sortedRisks.length} risques
              </span>
              <div className="flex items-center gap-2">
                 <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                    <ChevronLeft className="w-5 h-5" />
                 </button>
                 <span className="text-sm font-medium px-3 text-slate-300">
                    Page {currentPage} / {totalPages}
                 </span>
                 <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                    <ChevronRight className="w-5 h-5" />
                 </button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};
