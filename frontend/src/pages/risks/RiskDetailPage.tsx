import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Calendar, Info, Target, Wrench, Shield, ShieldCheck, AlertTriangle, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { SeverityBadge } from '../../components/shared/SeverityBadge';
import { risksApi } from '../../api/endpoints';
import { Risk, RiskAICopilotResponse } from '../../types';

export const RiskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [risk, setRisk] = useState<Risk | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // AI State
  const [aiResponse, setAiResponse] = useState<RiskAICopilotResponse | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);
  const [validatingTech, setValidatingTech] = useState<string | null>(null);

  useEffect(() => {
    const fetchRisk = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const data = await risksApi.getById(id);
        setRisk(data);
        
        // Check if AI analysis exists
        try {
            const aiData = await risksApi.analyzeAI(id, false);
            setAiResponse(aiData);
        } catch (e) {
            // No existing AI analysis or error
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRisk();
  }, [id]);

  const handleAnalyzeAI = async () => {
    if (!id) return;
    setIsAILoading(true);
    try {
      const data = await risksApi.analyzeAI(id, true);
      setAiResponse(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAILoading(false);
    }
  };

  const handleValidateTechnique = async (techId: string) => {
    if (!id || !aiResponse) return;
    setValidatingTech(techId);
    try {
      await risksApi.validateAITechnique(id, techId);
      // Optional: update local state to show it's validated
      // or re-fetch risk to update linked techniques
      setAiResponse({
         ...aiResponse,
         validated_by_user: true
      });
      // In a full implementation, we might mark individual techniques, 
      // but for simplicity we mark the whole analysis or just show success.
      alert(`Technique ${techId} validée et ajoutée avec succès !`);
    } catch (err) {
      console.error(err);
    } finally {
      setValidatingTech(null);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-5 h-5" />;
      case 'high': return <ShieldAlert className="w-5 h-5" />;
      case 'medium': return <Shield className="w-5 h-5" />;
      case 'low': return <ShieldCheck className="w-5 h-5" />;
      default: return null;
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-400">Chargement...</div>;
  if (!risk) return <div className="p-8 text-center text-red-400">Risque introuvable.</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link to="/risks" className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour aux risques
        </Link>
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold text-white leading-tight">
            {risk.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <SeverityBadge severity={risk.severity} />
            
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-slate-800/50 text-slate-300 border border-white/10 capitalize">
              {risk.category}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-400 mt-4">
          <span className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-white/5">
            <span className={`w-2 h-2 rounded-full ${risk.status === 'open' ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
            Statut: {risk.status === 'open' ? 'Ouvert' : 'Résolu'}
          </span>
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Détecté le {new Date(risk.first_detected_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="glass-card p-6 border-l-4 border-l-cyan-500">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Info className="w-5 h-5 text-cyan-400" />
            Explication
          </h3>
          <p className="text-slate-300 leading-relaxed">{risk.explanation}</p>
        </div>

        <div className="glass-card p-6 border-l-4 border-l-red-500">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Target className="w-5 h-5 text-red-400" />
            Impact
          </h3>
          <p className="text-slate-300 leading-relaxed">{risk.impact}</p>
        </div>

        <div className="glass-card p-6 border-l-4 border-l-emerald-500 bg-emerald-500/5">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-emerald-400" />
            Recommandation
          </h3>
          <p className="text-slate-300 leading-relaxed">{risk.recommendation}</p>
        </div>

        {/* SHODAN CONFIRMATION */}
        {risk.details?.shodan?.ports && (
          (risk.rule_key === 'admin_port_exposed' && risk.details.open_ports?.some((p: number) => [22, 3389].includes(p) && risk.details.shodan.ports.includes(p))) ||
          (risk.rule_key === 'mail_port_exposed_without_tls' && risk.details.open_ports?.includes(25) && risk.details.shodan.ports.includes(25))
        ) && (
          <div className="glass-card p-4 border-l-4 border-l-orange-500 bg-orange-500/5 flex items-center gap-3">
            <Target className="w-6 h-6 text-orange-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-400">
                Ce risque est <strong className="text-orange-300">confirmé par une source externe indépendante</strong> (Shodan).
              </p>
              <p className="text-xs text-slate-400 mt-1">
                L'API Shodan a également indexé ce port comme étant ouvert au grand public. Ceci exclut la possibilité d'un faux-positif lié à notre propre scanner.
              </p>
            </div>
          </div>
        )}

        {/* AI COPILOT SECTION */}
        <div className="glass-card p-6 border border-indigo-500/30 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
          
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Copilote IA : Analyse Stratégique
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
                {aiResponse?.status === 'failed' ? 'Réessayer' : "Analyser avec l'IA"}
              </button>
            )}
            
            {aiResponse?.status === 'success' && !aiResponse.validated_by_user && (
              <span className="text-xs font-medium bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/20">
                Généré par IA — À valider
              </span>
            )}
            {aiResponse?.status === 'success' && aiResponse.validated_by_user && (
              <span className="text-xs font-medium bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Validé
              </span>
            )}
          </div>
          
          {(!aiResponse || (aiResponse.status === 'failed' && !aiResponse.error)) && !isAILoading && (
            <p className="text-sm text-slate-400">
              Obtenez une explication sur mesure, l'impact métier réel, et des recommandations d'atténuation adaptées à votre contexte technique via notre Intelligence Artificielle.
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
              <p className="text-sm text-indigo-400 animate-pulse">Analyse contextuelle en cours...</p>
            </div>
          )}
          
          {aiResponse?.status === 'success' && aiResponse.payload && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-1">Explication</h4>
                <p className="text-slate-200 text-sm leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                  {aiResponse.payload.explanation}
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-1">Impact Métier</h4>
                <p className="text-slate-200 text-sm leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                  {aiResponse.payload.business_impact}
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2">Étapes de remédiation</h4>
                <ul className="space-y-2">
                  {aiResponse.payload.remediation_steps.map((step, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-slate-300 items-start">
                      <ChevronRight className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {aiResponse.payload.suggested_mitre_techniques?.length > 0 && (
                <div className="pt-4 border-t border-white/5">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Techniques MITRE ATT&CK suggérées</h4>
                  <div className="flex flex-wrap gap-3">
                    {aiResponse.payload.suggested_mitre_techniques.map((techId) => (
                      <div key={techId} className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg">
                        <span className="font-mono text-xs text-indigo-400">{techId}</span>
                        <button
                          onClick={() => handleValidateTechnique(techId)}
                          disabled={validatingTech === techId}
                          className="ml-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs px-2 py-1 rounded transition-colors disabled:opacity-50"
                        >
                          {validatingTech === techId ? '...' : 'Confirmer'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {risk.details && Object.keys(risk.details).length > 0 && (
          <div className="glass-card p-6 border-t border-white/10 mt-4">
            <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-cyan-400" />
              Détails Techniques / Preuves
            </h3>
            
            <div className="bg-slate-900/80 rounded-xl p-5 border border-white/5">
              {risk.details.path && (
                <div className="mb-4">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Chemin d'accès au fichier / URL :</span>
                  <div className="bg-slate-950 px-3 py-2.5 rounded-lg text-cyan-400 font-mono text-sm border border-white/5 break-all">
                    {risk.asset_target ? `http://${risk.asset_target}${risk.details.path}` : risk.details.path}
                  </div>
                </div>
              )}
              
              {risk.details.snippet && (
                <div className="mb-4">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Extrait du contenu sensible détecté :</span>
                  <div className="bg-slate-950 px-3 py-3 rounded-lg text-rose-400 font-mono text-sm border border-white/5 break-all whitespace-pre-wrap leading-relaxed shadow-inner">
                    {risk.details.snippet}
                  </div>
                </div>
              )}

              {risk.details.provider && (
                <div className="mb-4">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Fournisseur Cloud vulnérable :</span>
                  <div className="bg-slate-950 px-3 py-2.5 rounded-lg text-amber-400 font-mono text-sm border border-white/5">
                    {risk.details.provider}
                  </div>
                </div>
              )}

              {risk.details.cname_target && (
                <div className="mb-4">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Enregistrement CNAME ciblé :</span>
                  <div className="bg-slate-950 px-3 py-2.5 rounded-lg text-emerald-400 font-mono text-sm border border-white/5 break-all">
                    {risk.details.cname_target}
                  </div>
                </div>
              )}

              {risk.details.evidence && (
                <div className="mb-4">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Preuve (Message d'erreur du fournisseur) :</span>
                  <div className="bg-slate-950 px-3 py-2.5 rounded-lg text-slate-300 font-mono text-sm border border-white/5 break-all italic">
                    "{risk.details.evidence}"
                  </div>
                </div>
              )}
              
              {risk.details.info && (
                <div className="mb-4">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Informations complémentaires :</span>
                  <div className="bg-slate-950 px-3 py-2.5 rounded-lg text-slate-300 font-mono text-sm border border-white/5 break-all">
                    {risk.details.info}
                  </div>
                </div>
              )}

              {risk.details.exposed_subdomains && Array.isArray(risk.details.exposed_subdomains) && (
                <div className="mb-4">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-2">Sous-domaines exposant l'IP d'origine :</span>
                  <div className="flex flex-wrap gap-2">
                    {risk.details.exposed_subdomains.map((sub: string, i: number) => (
                      <span key={i} className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md font-mono text-xs">
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {risk.details.exposed_records && Array.isArray(risk.details.exposed_records) && (
                <div className="mb-4">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-2">Enregistrements DNS extraits (Aperçu) :</span>
                  <div className="max-h-48 overflow-y-auto bg-slate-950 rounded-lg border border-white/5 p-2 custom-scrollbar">
                    <ul className="text-slate-300 font-mono text-xs space-y-1">
                      {risk.details.exposed_records.map((rec: string, i: number) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              {/* Fallback for unknown properties */}
              {Object.keys(risk.details).filter(k => !['path', 'snippet', 'provider', 'cname_target', 'evidence', 'info', 'exposed_subdomains', 'exposed_records', 'shodan', 'shodan_extra_ports'].includes(k)).length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Autres données :</span>
                  <div className="bg-slate-950 px-3 py-2.5 rounded-lg text-slate-400 font-mono text-xs border border-white/5 overflow-x-auto">
                    <pre>{JSON.stringify(
                      Object.fromEntries(Object.entries(risk.details).filter(([k]) => !['path', 'snippet', 'provider', 'cname_target', 'evidence', 'info', 'exposed_subdomains', 'exposed_records', 'shodan', 'shodan_extra_ports'].includes(k))), 
                      null, 2
                    )}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
