import React, { useEffect, useState } from 'react';
import { Globe, Plus, Loader2, Trash2, ChevronDown, ChevronUp, Server, Search, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { domainsApi } from '../../api/endpoints';
import { Domain, Asset } from '../../types';
import { StatusBadge } from '../../components/badges';

export const DomainsPage: React.FC = () => {
  const { user } = useAuth();
  const canAdd = user?.role === 'admin' || user?.role === 'analyst';

  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [newDomain, setNewDomain] = useState('');
  const [relationship, setRelationship] = useState<'own' | 'vendor'>('own');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [domainAssets, setDomainAssets] = useState<Asset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isVerifying, setIsVerifying] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const fetchDomains = async () => {
    try {
      const data = await domainsApi.list();
      setDomains(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAssets = async (id: string) => {
    setIsLoadingAssets(true);
    try {
      const assets = await domainsApi.getAssets(id);
      setDomainAssets(assets);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAssets(false);
    }
  };

  useEffect(() => {
    fetchDomains();
    
    const interval = setInterval(async () => {
      try {
        const data = await domainsApi.list();
        setDomains(data);
        
        // If a domain is expanded, check if we need to refresh its assets
        // (e.g. if it just finished discovering)
        if (expandedDomain) {
          const expanded = data.find(d => d.id === expandedDomain);
          if (expanded && expanded.status !== 'discovering') {
            // Background refresh of assets without showing loader
            const assets = await domainsApi.getAssets(expandedDomain);
            setDomainAssets(assets);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [expandedDomain]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const domainRegex = /^([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(newDomain)) {
      setError("Format de domaine invalide (ex: exemple.com)");
      return;
    }

    setIsAdding(true);
    try {
      await domainsApi.create({ name: newDomain, relationship });
      setNewDomain('');
      setRelationship('own');
      fetchDomains();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erreur lors de l'ajout du domaine");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent expanding row
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce domaine et toutes ses données associées ?")) {
      return;
    }
    
    try {
      await domainsApi.delete(id);
      if (expandedDomain === id) setExpandedDomain(null);
      fetchDomains();
    } catch (err) {
      console.error("Failed to delete domain", err);
    }
  };

  const toggleExpand = async (id: string) => {
    if (expandedDomain === id) {
      setExpandedDomain(null);
      return;
    }
    
    setExpandedDomain(id);
    await fetchAssets(id);
  };

  const handleVerify = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setIsVerifying(id);
    setVerifyError(null);
    try {
      await domainsApi.verify(id);
      fetchDomains(); // Refresh domains to show verified status
    } catch (err: any) {
      setVerifyError(err.response?.data?.detail || "Échec de la vérification. L'enregistrement TXT n'a pas été trouvé.");
    } finally {
      setIsVerifying(null);
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-cyan-500 animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Globe className="w-7 h-7 text-cyan-400" />
          Domaines
        </h1>
        <p className="text-slate-400">Gérez les domaines appartenant à votre organisation et observez la découverte.</p>
      </div>

      {canAdd && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Ajouter un domaine</h2>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="flex-1 w-full">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Globe className="h-5 w-5 text-slate-500" />
                  </div>
                  <input 
                    type="text" 
                    value={newDomain} 
                    onChange={e => setNewDomain(e.target.value)} 
                    className="input-field pl-10" 
                    placeholder="exemple.com" 
                    required
                  />
                </div>
                <div className="relative w-full sm:w-48">
                  <select 
                    value={relationship} 
                    onChange={e => setRelationship(e.target.value as 'own' | 'vendor')} 
                    className="input-field appearance-none cursor-pointer"
                  >
                    <option value="own">Mon Domaine (Own)</option>
                    <option value="vendor">Fournisseur (Vendor)</option>
                  </select>
                </div>
              </div>
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>
            <button type="submit" disabled={isAdding} className="btn-primary w-full sm:w-auto py-2.5">
              {isAdding ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <><Plus className="w-5 h-5 mr-2 inline" /> Ajouter</>}
            </button>
          </form>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {domains.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4 border border-white/5">
              <Globe className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Aucun domaine</h3>
            <p className="text-slate-400 max-w-sm mx-auto">
              Vous n'avez pas encore ajouté de domaine à surveiller.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="table-header">Domaine</th>
                  <th className="table-header">Statut</th>
                  <th className="table-header">Dernière découverte</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {domains.map(domain => (
                  <React.Fragment key={domain.id}>
                    <tr 
                      className={`table-row cursor-pointer transition-colors ${expandedDomain === domain.id ? 'bg-slate-800/50' : 'hover:bg-slate-800/30'}`}
                      onClick={() => toggleExpand(domain.id)}
                    >
                      <td className="table-cell font-medium text-white flex items-center gap-2">
                        {expandedDomain === domain.id ? <ChevronUp className="w-4 h-4 text-cyan-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        {domain.name}
                        {domain.relationship === 'vendor' ? (
                          <span title="Fournisseur (Passif)" className="text-xs text-purple-400 font-medium px-2 py-0.5 bg-purple-500/10 rounded-full ml-1">Fournisseur</span>
                        ) : domain.ownership_verified ? (
                          <span title="Domaine vérifié"><CheckCircle2 className="w-4 h-4 text-emerald-500 ml-1" /></span>
                        ) : (
                          <span title="Propriété non vérifiée"><AlertTriangle className="w-4 h-4 text-amber-500 ml-1" /></span>
                        )}
                      </td>
                      <td className="table-cell">
                        <StatusBadge status={domain.status} />
                        {domain.status === 'discovering' && (
                          <span className="ml-2 text-xs text-cyan-400 animate-pulse">En cours...</span>
                        )}
                      </td>
                      <td className="table-cell text-sm text-slate-400">
                        {domain.last_discovery_at ? new Date(domain.last_discovery_at).toLocaleString() : 'Jamais'}
                      </td>
                      <td className="table-cell text-right">
                        {user?.role === 'admin' && (
                          <button 
                            onClick={(e) => handleDelete(e, domain.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Supprimer le domaine"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                    
                    {/* Expanded Content: Assets */}
                    {expandedDomain === domain.id && (
                      <tr className="bg-slate-900/50 border-b border-white/5">
                        <td colSpan={4} className="p-4 pl-10">
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                              <Search className="w-4 h-4 text-cyan-500" />
                              Résultats de la découverte (Assets)
                            </h4>
                            
                            {/* Verification Banner */}
                            {!domain.ownership_verified && domain.relationship !== 'vendor' && (
                              <div className="bg-amber-900/20 border border-amber-500/20 rounded-xl p-5 mb-6">
                                <div className="flex items-start gap-3">
                                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <h5 className="text-amber-400 font-medium text-sm mb-1">Vérification de la propriété requise</h5>
                                    <p className="text-amber-200/70 text-sm mb-4 leading-relaxed">
                                      Seule la découverte passive est actuellement active. Les contrôles avancés de reconnaissance sont suspendus tant que le domaine n'est pas vérifié. 
                                      Pour débloquer toutes les fonctionnalités, veuillez ajouter l'enregistrement DNS suivant :
                                    </p>
                                    
                                    <div className="bg-black/40 border border-black/20 rounded-lg p-3 mb-4 font-mono text-sm text-slate-300">
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                        <span className="text-slate-500 w-16">Type:</span> 
                                        <span className="text-cyan-400">TXT</span>
                                      </div>
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                                        <span className="text-slate-500 w-16">Name:</span> 
                                        <span className="text-emerald-400">@</span> <span className="text-slate-500 text-xs">(ou laissez vide)</span>
                                      </div>
                                      <div className="flex flex-col sm:flex-row sm:items-start gap-2 mt-1">
                                        <span className="text-slate-500 w-16 pt-0.5">Value:</span> 
                                        <div className="flex-1 break-all bg-slate-900 px-2 py-1 rounded text-white select-all">
                                          {domain.verification_token}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                      <button 
                                        onClick={(e) => handleVerify(e, domain.id)}
                                        disabled={isVerifying === domain.id}
                                        className="btn-primary py-2 px-4 text-sm bg-amber-500 hover:bg-amber-600 text-amber-950 font-medium"
                                      >
                                        {isVerifying === domain.id ? (
                                          <><Loader2 className="w-4 h-4 animate-spin mr-2 inline" /> Vérification...</>
                                        ) : (
                                          'Vérifier maintenant'
                                        )}
                                      </button>
                                      {verifyError && <span className="text-red-400 text-xs">{verifyError}</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* DNS & TLS Security Info */}
                            {domain.dns_records && (
                              <div className="mb-8">
                                <h4 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Enregistrements DNS (Domaine Parent)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {domain.dns_records.MX && domain.dns_records.MX.length > 0 && (
                                    <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                                      <span className="text-xs font-medium text-cyan-500 mb-1 block">MX (Mail)</span>
                                      <ul className="text-xs text-slate-300 space-y-1">
                                        {domain.dns_records.MX.map((r: string, i: number) => <li key={i} className="break-all">{r}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                  {domain.dns_records.NS && domain.dns_records.NS.length > 0 && (
                                    <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                                      <span className="text-xs font-medium text-purple-500 mb-1 block">NS (Name Servers)</span>
                                      <ul className="text-xs text-slate-300 space-y-1">
                                        {domain.dns_records.NS.map((r: string, i: number) => <li key={i} className="break-all">{r}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                  {domain.dns_records.TXT && domain.dns_records.TXT.length > 0 && (
                                    <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                                      <span className="text-xs font-medium text-emerald-500 mb-1 block">TXT Records</span>
                                      <div className="max-h-24 overflow-y-auto pr-2 custom-scrollbar">
                                        <ul className="text-xs text-slate-300 space-y-1">
                                          {domain.dns_records.TXT.map((r: string, i: number) => <li key={i} className="break-all font-mono opacity-80">{r}</li>)}
                                        </ul>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Active Recon */}
                            {domain.ownership_verified && domain.relationship !== 'vendor' && (
                              <div className="mb-8">
                                <h4 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider flex items-center justify-between">
                                  <span>🚀 Reconnaissance Active (Tests intrusifs)</span>
                                  {domain.active_recon_state === 'running' && (
                                    <span className="text-xs text-amber-400 normal-case flex items-center gap-2">
                                      <Loader2 className="w-3 h-3 animate-spin" /> En cours d'exécution...
                                    </span>
                                  )}
                                </h4>
                                <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                    <p className="text-sm text-slate-400">Ces tests (AXFR, détection WAF, fuite d'IP, takeover, fichiers sensibles) s'exécutent en arrière-plan. S'ils trouvent des vulnérabilités, elles apparaîtront dans la page Risques.</p>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        domainsApi.triggerActiveRecon(domain.id)
                                          .then(() => alert("Active recon lancé en arrière-plan ! Consultez la page Risques ou l'historique des actifs."))
                                          .catch(() => alert("Erreur lors du lancement."));
                                      }}
                                      disabled={domain.active_recon_state === 'running'}
                                      className={`btn-secondary py-1.5 px-3 text-sm whitespace-nowrap ${domain.active_recon_state === 'running' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      Lancer l'Active Recon
                                    </button>
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Dernière exécution : {domain.last_active_recon_at ? new Date(domain.last_active_recon_at).toLocaleString() : 'Jamais'}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Security Checks (Automated) */}
                            <div className="mb-8">
                              <h4 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider flex items-center justify-between">
                                <span>🛡️ Contrôles de Sécurité Automatiques (DNS/Email)</span>
                                {domain.status === 'discovering' && !domain.security_checks && (
                                  <span className="text-xs text-cyan-400 normal-case flex items-center gap-2">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Analyse en attente...
                                  </span>
                                )}
                              </h4>
                              
                              {domain.security_checks ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {Object.entries(domain.security_checks).map(([key, check]: [string, any]) => {
                                    const ShieldIcon = check.status === 'secure' ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 mt-1 flex-shrink-0"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
                                    ) : check.status === 'weak' ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 mt-1 flex-shrink-0"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m12 8 v4"/><path d="m12 16 h.01"/></svg>
                                    ) : check.status === 'vulnerable' ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 mt-1 flex-shrink-0"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                                    ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 mt-1 flex-shrink-0"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                                    );
                                    
                                    const bgColor = check.status === 'secure' ? 'bg-emerald-900/10 border-emerald-500/20' 
                                                  : check.status === 'weak' ? 'bg-amber-900/10 border-amber-500/20' 
                                                  : check.status === 'vulnerable' ? 'bg-red-900/10 border-red-500/20'
                                                  : 'bg-slate-900/50 border-white/5';
                                                  
                                    return (
                                    <div key={key} className={`p-4 rounded-xl border flex items-start gap-4 transition-all hover:bg-slate-800/80 ${bgColor}`}>
                                      {ShieldIcon}
                                      <div>
                                        <span className="text-sm font-bold mb-1 block uppercase tracking-wide text-slate-200">{key}</span>
                                        <p className="text-sm text-slate-400 leading-relaxed">{check.details}</p>
                                      </div>
                                    </div>
                                  )})}
                                </div>
                              ) : (
                                <div className="bg-slate-900/30 border border-dashed border-white/10 rounded-xl p-8 text-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 mx-auto mb-3"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
                                  <p className="text-sm text-slate-400">Aucun contrôle de sécurité n'a encore été effectué sur ce domaine.</p>
                                  <p className="text-xs text-slate-500 mt-1">L'analyse se lance automatiquement après la découverte.</p>
                                </div>
                              )}
                            </div>

                            {isLoadingAssets ? (
                              <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                                <Loader2 className="w-4 h-4 animate-spin" /> Chargement des assets...
                              </div>
                            ) : domainAssets.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {domainAssets.map(asset => (
                                  <div key={asset.id} className="bg-slate-800/50 border border-white/5 rounded-lg p-3 flex flex-col gap-2 transition-all hover:bg-slate-800">
                                    <div className="flex items-start gap-3">
                                      <div className="mt-1">
                                          {asset.type === 'root_domain' ? (
                                            <Globe className="w-4 h-4 text-purple-400" />
                                          ) : asset.type === 'subdomain' ? (
                                            <Globe className="w-4 h-4 text-cyan-400" />
                                          ) : (
                                            <Server className="w-4 h-4 text-emerald-400" />
                                          )}
                                      </div>
                                      <div>
                                        {asset.technology && (
                                          <div className="flex flex-wrap gap-2 items-center mb-2">
                                            {asset.technology.split(',').map(tech => (
                                              <span key={tech} className="px-2 py-0.5 bg-slate-900 rounded text-[10px] border border-white/5 text-slate-400">
                                                {tech.trim()}
                                              </span>
                                            ))}
                                            {asset.is_eol && (
                                              <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[10px] font-medium" title={asset.eol_since ? `EOL depuis ${new Date(asset.eol_since).toLocaleDateString()}` : ''}>
                                                EOL
                                              </span>
                                            )}
                                          </div>
                                        )}
                                        <div className="text-sm font-medium text-white break-all">{asset.hostname || asset.ip_address}</div>
                                        <div className="text-xs text-slate-400 uppercase">{asset.type === 'root_domain' ? 'domaine' : asset.type === 'subdomain' ? 'sous-domaine' : asset.type}</div>
                                      </div>
                                    </div>
                                    
                                    {(asset.cert_subject || asset.cert_issuer) && (
                                      <div className="mt-2 p-2 bg-slate-900/50 rounded-lg border border-slate-700/50 text-xs font-mono">
                                        {asset.cert_subject && (
                                          <div className="text-slate-400 mb-1 truncate" title={asset.cert_subject}>
                                            <span className="text-slate-500">Subject:</span> {asset.cert_subject}
                                          </div>
                                        )}
                                        {asset.cert_issuer && (
                                          <div className="text-slate-400 mb-1 truncate" title={asset.cert_issuer}>
                                            <span className="text-slate-500">Issuer:</span> {asset.cert_issuer.split(',')[0]}
                                          </div>
                                        )}
                                        <div className="text-slate-400">
                                          <span className="text-slate-500">Exp:</span> {asset.cert_expires_at ? new Date(asset.cert_expires_at).toLocaleDateString() : 'N/A'}
                                        </div>
                                        {asset.cert_san && (
                                          <div className="mt-1 text-slate-500 text-xs overflow-hidden text-ellipsis" title={asset.cert_san}>
                                            <span className="text-slate-500 font-bold">SANs:</span> {asset.cert_san.split(',').join(', ')}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-slate-400 py-4 italic">
                                {domain.status === 'discovering' 
                                  ? 'Recherche en cours, veuillez patienter...' 
                                  : 'Aucun asset trouvé pour le moment.'}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
