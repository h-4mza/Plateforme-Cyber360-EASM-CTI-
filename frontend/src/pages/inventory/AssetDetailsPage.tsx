import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { assetsApi, risksApi, scenariosApi } from '../../api/endpoints';
import { Asset, Risk, AssetAICopilotResponse } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { AssetTypeBadge, StatusBadge, AssetCriticalityBadge } from '../../components/badges';
import { SeverityBadge } from '../../components/shared/SeverityBadge';
import { Shield, Server, Clock, Activity, AlertTriangle, ArrowLeft, Loader2, ShieldCheck, ShieldAlert, ArrowRight, Lock, Network, Info, Flame, Sparkles, ChevronRight } from 'lucide-react';

export const AssetDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  
  const [asset, setAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [activeScenarios, setActiveScenarios] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [aiResponse, setAiResponse] = useState<AssetAICopilotResponse | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);

  const [shodanData, setShodanData] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!id || !user) return;
      setIsLoading(true);
      try {
        const [assetData, historyData, risksData, shodanRes, relationsData, allScenarios, aiData] = await Promise.all([
          assetsApi.getAsset(id),
          assetsApi.getAssetHistory(id),
          risksApi.listOrgRisks(user.organization_id, { asset_id: id }),
          assetsApi.getAssetShodan(id).catch(() => null),
          assetsApi.getRelations(id).catch(() => []),
          scenariosApi.list(user.organization_id).catch(() => []),
          assetsApi.analyzeAI(id, false).catch(() => null)
        ]);
        setAsset(assetData);
        setHistory(historyData);
        setRisks(risksData);
        setShodanData(shodanRes);
        setRelations(relationsData);
        if (aiData && aiData.status === 'success') {
          setAiResponse(aiData);
        }
        
        // Filter scenarios involving this asset
        const assetScenarios = allScenarios.filter((s: any) => 
          (s.status === 'open' || s.status === 'partial') && 
          s.risks.some((r: any) => risksData.some((myRisk: any) => myRisk.id === r.id))
        );
        setActiveScenarios(assetScenarios);
      } catch (err) {
        console.error("Failed to load asset details", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [id, user]);

  const handleAnalyzeAI = async () => {
    if (!id) return;
    setIsAILoading(true);
    setAiResponse(null);
    try {
      const data = await assetsApi.analyzeAI(id, true);
      setAiResponse(data);
    } catch (err) {
      console.error(err);
      setAiResponse({ asset_id: id, status: 'failed', error: 'Erreur réseau ou serveur injoignable.' });
    } finally {
      setIsAILoading(false);
    }
  };

  const handleUpdateCriticality = async (newCrit: 'high' | 'medium' | 'low') => {
    if (!asset || !id) return;
    try {
      await assetsApi.update(id, { criticality: newCrit });
      setAsset({ ...asset, criticality: newCrit });
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la mise à jour");
    }
  };

  const getWafCdn = (tech: string | null | undefined) => {
    if (!tech) return null;
    const lowerTech = tech.toLowerCase();
    const wds = ['cloudflare', 'akamai', 'fastly', 'aws waf', 'imperva', 'sucuri'];
    const found = wds.find(w => lowerTech.includes(w));
    return found ? found : null;
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-cyan-500 animate-spin" /></div>;
  }

  if (!asset) {
    return <div className="text-center p-12 text-slate-400">Actif introuvable.</div>;
  }

  const wafCdn = getWafCdn(asset.technology);

  // Expiration calculation for cert
  let certDaysLeft = null;
  let certUrgency = 'none';
  if (asset.cert_expires_at) {
    const diffTime = new Date(asset.cert_expires_at).getTime() - new Date().getTime();
    certDaysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (certDaysLeft < 0) certUrgency = 'expired';
    else if (certDaysLeft <= 7) certUrgency = 'critical';
    else if (certDaysLeft <= 30) certUrgency = 'warning';
    else certUrgency = 'good';
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link to="/inventory" className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Retour à l'inventaire
        </Link>
      </div>

      {/* HEADER SECTION */}
      <div className="glass-card p-6 border-l-4 border-l-cyan-500">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-3 break-all flex items-center gap-3">
              <Server className="w-8 h-8 text-cyan-400" />
              {asset.hostname || asset.ip_address}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <AssetTypeBadge type={asset.type} />
              <StatusBadge status={asset.status} />
              {wafCdn && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 capitalize">
                  🛡️ {wafCdn} (CDN/WAF)
                </span>
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
             {activeScenarios.length > 0 && (
               <Link to="/scenarios" className="bg-rose-950/40 p-3 rounded-xl border border-rose-500/30 flex items-center gap-3 hover:bg-rose-900/50 transition-colors shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                 <div className="bg-rose-500/20 p-2 rounded-lg">
                   <Flame className="w-5 h-5 text-rose-500" />
                 </div>
                 <div>
                   <span className="text-xs text-rose-400 font-bold uppercase tracking-wider block">Impliqué dans</span>
                   <span className="text-sm text-white font-medium">{activeScenarios.length} scénario(s) d'attaque</span>
                 </div>
                 <ArrowRight className="w-4 h-4 text-rose-500 ml-2" />
               </Link>
             )}
            
             <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 flex flex-col items-start min-w-[200px]">
               <span className="text-xs text-slate-400 uppercase font-medium mb-2 block">Criticité de l'actif</span>
            <div className="flex items-center gap-2 w-full">
              <AssetCriticalityBadge criticality={asset.criticality} />
              <select 
                className="ml-auto bg-slate-800 text-sm text-slate-300 border border-slate-700 rounded px-2 py-1 outline-none cursor-pointer hover:border-slate-600 focus:border-cyan-500"
                value={asset.criticality}
                onChange={e => handleUpdateCriticality(e.target.value as any)}
              >
                <option value="high">Haute</option>
                <option value="medium">Moyenne</option>
                <option value="low">Basse</option>
              </select>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI COPILOT SECTION */}
      <div className="glass-card p-6 border border-indigo-500/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Copilote IA : Profilage de l'Actif
          </h3>
          
          {(!aiResponse || aiResponse.status === 'failed') && (
            <button
              onClick={handleAnalyzeAI}
              disabled={isAILoading}
              className="btn-primary py-2 px-4 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
            >
              {isAILoading ? (
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {aiResponse?.status === 'failed' ? 'Réessayer' : "Analyser l'Actif"}
            </button>
          )}
        </div>
        
        {(!aiResponse || (aiResponse.status === 'failed' && !aiResponse.error)) && !isAILoading && (
          <p className="text-sm text-slate-400">
            Demandez à l'IA d'analyser la configuration de cet actif, son rôle potentiel dans votre système d'information, et de détecter les anomalies de sécurité structurelles.
          </p>
        )}

        {aiResponse?.status === 'failed' && aiResponse.error && !isAILoading && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg mb-4">
            <p className="text-sm font-medium text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              L'analyse IA a échoué : {aiResponse.error}
            </p>
          </div>
        )}
        
        {isAILoading && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-indigo-400 animate-pulse">Profilage de l'actif en cours...</p>
          </div>
        )}
        
        {aiResponse?.status === 'success' && aiResponse.payload && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-1">Résumé du rôle</h4>
                <p className="text-slate-200 text-sm leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                  {aiResponse.payload.summary}
                </p>
              </div>
              <div className="ml-6 flex flex-col items-center justify-center bg-slate-900/50 p-4 rounded-lg border border-white/5 min-w-[120px]">
                <span className="text-xs text-slate-400 uppercase font-medium mb-1">Exposition</span>
                <span className={`text-sm font-bold ${aiResponse.payload.exposure_level.toLowerCase().includes('critique') ? 'text-red-500' : 'text-orange-400'}`}>
                  {aiResponse.payload.exposure_level}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-orange-400" /> Anomalies structurelles
                </h4>
                <ul className="space-y-2">
                  {aiResponse.payload.security_anomalies.map((anom, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-slate-300 items-start">
                      <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                      <span>{anom}</span>
                    </li>
                  ))}
                  {aiResponse.payload.security_anomalies.length === 0 && (
                    <li className="text-slate-500 italic text-sm">Aucune anomalie flagrante détectée.</li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Recommandations de durcissement
                </h4>
                <ul className="space-y-2">
                  {aiResponse.payload.hardening_recommendations.map((rec, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-slate-300 items-start">
                      <ChevronRight className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CERTIFICATE SECTION */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            Certificat TLS
          </h2>
          {asset.cert_issuer ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div>
                  <span className="block text-slate-500 text-xs mb-1 uppercase font-medium">Sujet (Subject)</span>
                  <div className="text-white font-mono break-all bg-slate-900/50 p-2 rounded border border-white/5">{asset.cert_subject || '-'}</div>
                </div>
                <div>
                  <span className="block text-slate-500 text-xs mb-1 uppercase font-medium">Émetteur (Issuer)</span>
                  <div className="text-white bg-slate-900/50 p-2 rounded border border-white/5">{asset.cert_issuer}</div>
                </div>
                
                <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded border border-white/5">
                  <div>
                    <span className="block text-slate-500 text-xs mb-1 uppercase font-medium">Expiration</span>
                    <div className="text-white">{asset.cert_expires_at ? new Date(asset.cert_expires_at).toLocaleDateString() : '-'}</div>
                  </div>
                  <div>
                    {certUrgency === 'expired' && <span className="px-2 py-1 rounded bg-red-500/20 text-red-500 border border-red-500/30 text-xs font-bold">Expiré</span>}
                    {certUrgency === 'critical' && <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium">Expire dans {certDaysLeft} jours</span>}
                    {certUrgency === 'warning' && <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 text-xs font-medium">Expire dans {certDaysLeft} jours</span>}
                    {certUrgency === 'good' && <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-medium">Valide ({certDaysLeft} j)</span>}
                  </div>
                </div>
                
                {asset.cert_san && (
                  <div>
                    <span className="block text-slate-500 text-xs mb-1 uppercase font-medium">SANs (Subject Alternative Names)</span>
                    <div className="text-slate-300 font-mono text-xs bg-slate-900/50 p-3 rounded border border-white/5 max-h-32 overflow-y-auto custom-scrollbar leading-relaxed">
                      {asset.cert_san.split(',').join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-sm py-4 italic text-center bg-slate-900/30 rounded border border-dashed border-white/10">
              Aucun certificat TLS détecté ou actif non-HTTPS.
            </div>
          )}
        </div>

        {/* TECHNOLOGY SECTION */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            Technologies
          </h2>
          {asset.technology ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {asset.technology.split(',').map((tech, i) => (
                  <span key={i} className="px-3 py-1.5 bg-slate-800 text-slate-200 border border-white/10 rounded-lg text-sm font-medium">
                    {tech.trim()}
                  </span>
                ))}
              </div>
              
              {asset.is_eol && (
                <div className="mt-4 p-4 bg-red-900/20 border border-red-500/20 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-red-400 font-medium text-sm">Fin de vie détectée (EOL)</h4>
                    <p className="text-red-300/70 text-xs mt-1">
                      Une ou plusieurs technologies utilisées par cet actif sont obsolètes 
                      {asset.eol_since ? ` depuis le ${new Date(asset.eol_since).toLocaleDateString()}` : ''}.
                      Elles ne reçoivent plus de correctifs de sécurité.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-500 text-sm py-4 italic text-center bg-slate-900/30 rounded border border-dashed border-white/10">
              Aucune technologie spécifique détectée.
            </div>
          )}
        </div>
      </div>
      
      {/* RELATED ASSETS SECTION */}
      <div className="glass-card p-6">
         <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
               <Network className="w-5 h-5 text-indigo-400" />
               Actifs liés (Graphe d'infrastructure)
            </h2>
            <div className="group relative">
               <Info className="w-5 h-5 text-slate-400 cursor-help" />
               <div className="absolute right-0 w-64 p-3 bg-slate-800 text-xs text-slate-300 rounded shadow-xl border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                  Ces relations sont des déductions probabilistes basées sur des signaux externes (DNS, certificats, hébergement partagé), ce n'est pas une topologie réseau confirmée.
               </div>
            </div>
         </div>
         
         {relations.length === 0 ? (
            <div className="text-slate-500 text-sm py-4 italic text-center bg-slate-900/30 rounded border border-dashed border-white/10">
               Aucun actif lié détecté.
            </div>
         ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               {relations.map((rel: any) => {
                  let confColor = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
                  if (rel.confidence < 0.4) confColor = 'text-orange-400 border-orange-500/30 bg-orange-500/10';
                  else if (rel.confidence <= 0.7) confColor = 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
                  
                  return (
                     <Link key={rel.id} to={`/inventory/${rel.linked_asset_id}`} className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg hover:border-indigo-500/50 transition-colors flex flex-col gap-3 group">
                        <div className="flex items-start justify-between">
                           <div className="flex items-center gap-2 max-w-[70%]">
                              <Server className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              <span className="text-sm font-bold text-white truncate group-hover:text-indigo-400 transition-colors" title={rel.linked_asset_name}>
                                 {rel.linked_asset_name}
                              </span>
                           </div>
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${confColor}`}>
                              {Math.round(rel.confidence * 100)}%
                           </span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] px-2 py-1 bg-slate-800 text-slate-300 rounded capitalize border border-white/5">
                              {rel.relation_type.replace(/_/g, ' ')}
                           </span>
                        </div>
                     </Link>
                  );
               })}
            </div>
         )}
      </div>
      
      {/* SHODAN SECTION */}
      {shodanData && (
        <div className="glass-card p-6 border-l-4 border-l-orange-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Server className="w-32 h-32 text-orange-500" />
          </div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-orange-500 font-mono font-bold tracking-tight">SHODAN</span>
            <span className="text-sm font-normal text-slate-400">Vu sur Shodan</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            <div>
              <span className="block text-slate-500 text-xs mb-1 uppercase font-medium">Organisation</span>
              <div className="text-white text-sm font-medium">{shodanData.org || '-'}</div>
            </div>
            <div>
              <span className="block text-slate-500 text-xs mb-1 uppercase font-medium">Dernière indexation</span>
              <div className="text-white text-sm font-medium">{shodanData.last_update ? new Date(shodanData.last_update).toLocaleDateString() : '-'}</div>
            </div>
            <div>
              <span className="block text-slate-500 text-xs mb-1 uppercase font-medium">Ports indexés</span>
              <div className="flex flex-wrap gap-1">
                {shodanData.ports && shodanData.ports.length > 0 ? (
                  shodanData.ports.map((p: number) => (
                    <span key={p} className="px-2 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded text-xs font-mono">
                      {p}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 text-sm">-</span>
                )}
              </div>
            </div>
          </div>
          
          {shodanData.vulns && shodanData.vulns.length > 0 && (
            <div className="mt-6 border-t border-white/5 pt-4">
              <span className="block text-slate-500 text-xs mb-2 uppercase font-medium">Vulnérabilités associées (Shodan)</span>
              <div className="flex flex-wrap gap-2">
                {shodanData.vulns.map((v: string) => (
                  <span key={v} className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs font-mono">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* RISKS SECTION */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          Risques Spécifiques ({risks.filter(r => r.status === 'open').length})
        </h2>
        {risks.length === 0 ? (
          <div className="text-emerald-500 text-sm p-4 bg-emerald-500/10 rounded border border-emerald-500/20 flex items-center justify-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Aucun risque détecté sur cet actif. Bravo !
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="table-header">Sévérité</th>
                  <th className="table-header">Catégorie</th>
                  <th className="table-header">Risque</th>
                  <th className="table-header">Date</th>
                  <th className="table-header w-10"></th>
                </tr>
              </thead>
              <tbody>
                {risks.map(risk => (
                  <tr key={risk.id} className="table-row hover:bg-slate-800/30 transition-colors group">
                    <td className="table-cell">
                      <SeverityBadge severity={risk.severity} />
                    </td>
                    <td className="table-cell text-sm text-slate-400 capitalize">
                      {risk.category}
                    </td>
                    <td className="table-cell font-medium text-white">
                      {risk.title}
                      {risk.status === 'resolved' && <span className="ml-2 text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded">Résolu</span>}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HISTORY SECTION */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-400" />
          Historique des contrôles
        </h2>
        {history.length === 0 ? (
          <div className="text-slate-500 text-sm py-4 italic text-center">Aucun contrôle récent.</div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {history.map(check => {
              const isError = check.result === 'failed' || check.result === 'error' || check.result === 'timeout';
              const isInfo = check.result.startsWith('found_') || check.result.startsWith('info_') || check.result.startsWith('200');
              return (
                <div key={check.id} className={`p-3 rounded-lg border text-sm flex flex-col ${isError ? 'bg-red-900/10 border-red-500/20' : isInfo ? 'bg-cyan-900/10 border-cyan-500/20' : 'bg-slate-800/50 border-white/5'}`}>
                  <div className="flex justify-between items-center w-full">
                    <div>
                      <span className="font-medium text-slate-200">{check.type}</span>
                      <span className={`ml-3 text-xs break-all ${isError ? 'text-red-400' : isInfo ? 'text-cyan-400' : 'text-slate-400'}`}>
                        {check.result}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 min-w-[120px] text-right">
                      {new Date(check.executed_at).toLocaleString()}
                    </div>
                  </div>
                  {check.details && Object.keys(check.details).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/5 text-xs">
                      <div className="text-slate-400 mb-1 font-medium">Détails techniques :</div>
                      <pre className="bg-slate-900/50 p-2 rounded border border-white/5 text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap max-h-48 custom-scrollbar">
                        {JSON.stringify(check.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
