import React, { useEffect, useState } from 'react';
import { Database, Search, Filter, Server, Globe, Shield, ShieldAlert, ShieldCheck, Play, RefreshCw } from 'lucide-react';
import { assetsApi } from '../../api/endpoints';
import { Asset } from '../../types';
import { AssetTypeBadge, StatusBadge, AssetCriticalityBadge } from '../../components/badges';
import { ScanModal } from '../../components/ScanModal';
import { Link } from 'react-router-dom';

export const InventoryPage: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [critFilter, setCritFilter] = useState('');
  
  const [scanningAsset, setScanningAsset] = useState<{id: string, name: string} | null>(null);

  const fetchAssets = async () => {
    setIsLoading(true);
    try {
      const data = await assetsApi.list({ 
        search: search || undefined, 
        type: typeFilter || undefined, 
        criticality: critFilter || undefined 
      });
      setAssets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [typeFilter, critFilter]);

  // Debounced search
  useEffect(() => {
    const delay = setTimeout(() => {
      fetchAssets();
    }, 500);
    return () => clearTimeout(delay);
  }, [search]);

  const handleUpdateCriticality = async (id: string, newCrit: 'high' | 'medium' | 'low') => {
    try {
      await assetsApi.update(id, { criticality: newCrit });
      setAssets(assets.map(a => a.id === id ? { ...a, criticality: newCrit } : a));
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la mise à jour de la criticité");
    }
  };

  const handleForceScan = async (asset: Asset) => {
    try {
      await assetsApi.checkNow(asset.id);
      setScanningAsset({ id: asset.id, name: asset.hostname || asset.ip_address || 'Inconnu' });
    } catch (err) {
      console.error(err);
      alert("Erreur lors du lancement de l'analyse");
    }
  };



  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Database className="w-7 h-7 text-cyan-400" />
          Inventaire
        </h1>
        <p className="text-slate-400">Gérez l'ensemble des actifs (sous-domaines, IPs, etc.) découverts pour votre organisation.</p>
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Rechercher un hostname, une IP, une techno..." 
              className="input-field pl-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <select className="input-field w-auto" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">Tous les types</option>
              <option value="root_domain">Domaines</option>
              <option value="subdomain">Sous-domaines</option>
              <option value="ip">Adresses IP</option>
            </select>
            <select className="input-field w-auto" value={critFilter} onChange={e => setCritFilter(e.target.value)}>
              <option value="">Toutes criticités</option>
              <option value="high">Haute</option>
              <option value="medium">Moyenne</option>
              <option value="low">Basse</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="table-header">Actif</th>
                <th className="table-header">Type</th>
                <th className="table-header">Technologie</th>
                <th className="table-header">Statut</th>
                <th className="table-header">Criticité</th>
                <th className="table-header w-12">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">Chargement...</td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">Aucun actif ne correspond à votre recherche.</td>
                </tr>
              ) : (
                assets.map(asset => (
                  <tr key={asset.id} className="table-row hover:bg-slate-800/30 transition-colors">
                    <td className="table-cell font-medium text-white">
                      <Link to={`/inventory/${asset.id}`} className="flex items-center gap-3 hover:text-cyan-400 transition-colors">
                        {asset.type === 'root_domain' ? <Globe className="w-4 h-4 text-purple-500" /> : asset.type === 'subdomain' ? <Globe className="w-4 h-4 text-cyan-500" /> : <Server className="w-4 h-4 text-emerald-500" />}
                        <span>{asset.hostname || asset.ip_address}</span>
                      </Link>
                    </td>
                    <td className="table-cell">
                      <AssetTypeBadge type={asset.type} />
                    </td>
                    <td className="table-cell text-sm text-slate-300">
                      {asset.technology ? (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-slate-800 rounded text-xs border border-white/5">{asset.technology}</span>
                          {asset.is_eol && (
                            <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs font-medium" title={asset.eol_since ? `EOL depuis ${new Date(asset.eol_since).toLocaleDateString()}` : ''}>
                              Version obsolète
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic text-xs">-</span>
                      )}
                      {asset.open_risks_count > 0 && (
                        <Link to={`/risks?asset_id=${asset.id}`} className="inline-flex items-center gap-1 px-2 py-0.5 mt-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs hover:bg-red-500/30 transition-colors">
                          <ShieldAlert className="w-3 h-3" />
                          {asset.open_risks_count} risque(s)
                        </Link>
                      )}
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={asset.status} />
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <AssetCriticalityBadge criticality={asset.criticality} />
                        <select 
                          className="bg-transparent text-sm text-slate-300 border-none outline-none cursor-pointer hover:text-white"
                          value={asset.criticality}
                          onChange={e => handleUpdateCriticality(asset.id, e.target.value as any)}
                        >
                          <option value="high" className="bg-slate-900">Haute</option>
                          <option value="medium" className="bg-slate-900">Moyenne</option>
                          <option value="low" className="bg-slate-900">Basse</option>
                        </select>
                      </div>
                    </td>
                    <td className="table-cell">
                      <button 
                        onClick={() => handleForceScan(asset)}
                        className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10 rounded transition-colors"
                        title="Forcer une analyse immédiate"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {scanningAsset && (
        <ScanModal 
          assetId={scanningAsset.id} 
          assetName={scanningAsset.name} 
          onClose={() => { setScanningAsset(null); fetchAssets(); }} 
        />
      )}
    </div>
  );
};
