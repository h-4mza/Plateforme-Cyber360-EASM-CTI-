import React, { useEffect, useState } from 'react';
import { ShieldAlert, Globe, FileKey, AlertTriangle, ExternalLink, Lock, CheckCircle2, ShieldQuestion, Loader2, Play } from 'lucide-react';
import { SeverityBadge } from '../../components/shared/SeverityBadge';
import { brandProtectionApi } from '../../api/endpoints';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const BrandProtectionPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanningType, setScanningType] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    brandProtectionApi.getBrandProtection()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleTriggerScan = async (type: string) => {
    setScanningType(type);
    try {
      await brandProtectionApi.triggerScan(type);
      alert("Scan lancé en arrière-plan. Les résultats apparaîtront à la fin du traitement.");
    } catch (err) {
      console.error(err);
      alert("Erreur lors du lancement du scan.");
    } finally {
      setScanningType(null);
    }
  };

  const getLastScanDate = (items: any[]) => {
    if (items && items.length > 0) {
      const dates = items.map((i: any) => new Date(i.detected_at).getTime());
      return format(new Date(Math.max(...dates)), "d MMMM yyyy 'à' HH:mm", { locale: fr });
    }
    return "Dimanche dernier à 04:00 (planifié)";
  };

  if (loading) {
    return <div className="text-white">Chargement de la protection de marque...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-primary-400" />
          Protection de Marque
        </h1>
        <p className="text-slate-400">Surveillance continue des usurpations d'identité, typosquatting et certificats non autorisés.</p>
      </div>

      {/* Typosquatting Section */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-orange-400" />
              Domaines Similaires (Typosquatting)
            </h2>
            <p className="text-sm text-slate-400 mt-1">Dernier scan : {getLastScanDate(data?.typosquatting)}</p>
          </div>
          <button 
             onClick={() => handleTriggerScan('typosquatting')}
             disabled={scanningType === 'typosquatting'}
             className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors border border-white/10"
          >
             {scanningType === 'typosquatting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
             Lancer un scan
          </button>
        </div>
        {data?.typosquatting?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-sm">
                  <th className="pb-3 font-medium">Date de détection</th>
                  <th className="pb-3 font-medium">Domaine Cible</th>
                  <th className="pb-3 font-medium">Original</th>
                  <th className="pb-3 font-medium">Technique</th>
                  <th className="pb-3 font-medium">Risque</th>
                </tr>
              </thead>
              <tbody>
                {data.typosquatting.map((item: any) => {
                  const hasMx = item.raw_data.dns_mx?.length > 0;
                  return (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 text-slate-400 text-sm">{format(new Date(item.detected_at), "dd/MM/yyyy HH:mm")}</td>
                      <td className="py-4 font-mono text-white flex items-center gap-2">
                        {item.raw_data.squatted_domain}
                        <a href={`http://${item.raw_data.squatted_domain}`} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </td>
                      <td className="py-4 text-slate-400">{item.raw_data.original_domain}</td>
                      <td className="py-4 text-slate-300 capitalize">{item.raw_data.fuzzer}</td>
                      <td className="py-4">
                        {hasMx ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Serveur Mail Actif (Risque Phishing)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            Enregistré
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            Aucun domaine suspect (typosquatting) n'a été détecté récemment.
          </div>
        )}
      </div>

      {/* Data Leaks Section */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-400" />
              Fuites de Données (Have I Been Pwned)
            </h2>
            <p className="text-sm text-slate-400 mt-1">Dernier scan : {getLastScanDate(data?.data_leaks)}</p>
          </div>
          <button 
             onClick={() => handleTriggerScan('leaks')}
             disabled={scanningType === 'leaks'}
             className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors border border-white/10"
          >
             {scanningType === 'leaks' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
             Lancer un scan
          </button>
        </div>
        
        {data?.data_leaks?.length > 0 ? (
          <div className="space-y-4">
            {data.data_leaks.map((item: any) => (
              <div key={item.id} className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-1">
                      {item.raw_data.total_exposed_accounts} comptes de {item.raw_data.domain} exposés
                    </h3>
                    <div className="text-sm text-slate-400 flex items-center gap-4">
                      <span>Détecté le : {format(new Date(item.detected_at), "dd/MM/yyyy HH:mm")}</span>
                      <span>|</span>
                      <span>Plus récente fuite : {item.raw_data.latest_breach_date ? format(new Date(item.raw_data.latest_breach_date), "MMMM yyyy", { locale: fr }) : "Inconnue"}</span>
                    </div>
                  </div>
                  <SeverityBadge severity="critical" className="shrink-0" />
                </div>
                
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Fuites identifiées :</h4>
                  <div className="flex flex-wrap gap-2">
                    {item.raw_data.breach_names?.map((name: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-white/5 text-slate-300 text-xs rounded border border-white/10">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="p-3 bg-white/5 rounded-lg border border-white/10 flex gap-3">
                  <ShieldQuestion className="w-5 h-5 text-cyan-400 shrink-0" />
                  <div className="text-sm text-slate-300">
                    <p className="font-medium text-white mb-1">Recommandation de sécurité :</p>
                    <p>Sensibilisez immédiatement vos employés concernés à modifier leurs mots de passe, surtout s'ils réutilisent les mêmes sur d'autres plateformes. Forcez l'activation de l'Authentification Multi-Facteurs (MFA) sur tous vos accès critiques.</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3 opacity-50" />
            <p>Aucune adresse email de vos domaines vérifiés n'a été trouvée dans des bases de données piratées connues.</p>
            <p className="text-xs mt-2 text-slate-600">Note: Seuls les domaines validés via DNS (TXT) sont scannés pour protéger la vie privée.</p>
          </div>
        )}
      </div>

      {/* Certificates Section */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <FileKey className="w-5 h-5 text-cyan-400" />
              Nouveaux Certificats Détectés (Certificate Transparency)
            </h2>
            <p className="text-sm text-slate-400 mt-1">Dernier scan : {getLastScanDate(data?.certificates)}</p>
          </div>
          <button 
             onClick={() => handleTriggerScan('certificates')}
             disabled={scanningType === 'certificates'}
             className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors border border-white/10"
          >
             {scanningType === 'certificates' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
             Lancer un scan
          </button>
        </div>
        {data?.certificates?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-sm">
                  <th className="pb-3 font-medium">Date de détection</th>
                  <th className="pb-3 font-medium">Nom Couvert</th>
                  <th className="pb-3 font-medium">Émetteur (CA)</th>
                  <th className="pb-3 font-medium">Date d'émission</th>
                </tr>
              </thead>
              <tbody>
                {data.certificates.map((item: any) => (
                  <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 text-slate-400 text-sm">{format(new Date(item.detected_at), "dd/MM/yyyy HH:mm")}</td>
                    <td className="py-4 font-mono text-white">{item.raw_data.discovered_name}</td>
                    <td className="py-4 text-slate-300">{item.raw_data.issuer_name}</td>
                    <td className="py-4 text-slate-400">
                      {format(new Date(item.raw_data.not_before), "d MMMM yyyy, HH:mm", { locale: fr })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            Aucun nouveau certificat inattendu n'a été détecté pour vos domaines.
          </div>
        )}
      </div>
    </div>
  );
};
