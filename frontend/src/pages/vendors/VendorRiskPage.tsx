import React, { useEffect, useState } from 'react';
import { Globe, AlertTriangle, Building2 } from 'lucide-react';
import { organizationApi } from '../../api/endpoints';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';

export const VendorRiskPage: React.FC = () => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      organizationApi.getVendors().then(setVendors).finally(() => setIsLoading(false));
    }
  }, [user]);

  return (
    <div className="space-y-8">
      <div className="glass-card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <Building2 className="w-32 h-32 text-purple-500" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Risque Fournisseurs (Third-Party Risk)</h1>
        <p className="text-slate-400 max-w-3xl">
          Surveillance <strong>strictement passive et publique (OSINT)</strong> de vos fournisseurs et partenaires critiques. 
          Aucun test intrusif n'est réalisé car vous ne possédez pas ces domaines.
        </p>
        
        <div className="mt-6 flex items-start gap-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg text-sm text-purple-200">
          <AlertTriangle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <p>
            Les scores affichés ci-dessous sont calculés uniquement sur la base des contrôles passifs (ex: configuration DNS, réputation, certificats TLS). 
            Les scénarios complexes et les vulnérabilités applicatives (requérant des tests actifs) ne sont pas évalués pour des raisons légales et éthiques.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : vendors.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Globe className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Aucun fournisseur surveillé</h2>
          <p className="text-slate-400 mb-6">Ajoutez un domaine partenaire avec le type "Fournisseur" pour l'évaluer passivement.</p>
          <Link to="/domains" className="btn-primary inline-flex items-center gap-2">Ajouter un domaine</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendors.map(vendor => (
            <div key={vendor.id} className="glass-card p-6 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{vendor.name}</h3>
                  <span className="text-xs text-purple-400 font-medium px-2 py-1 bg-purple-500/10 rounded-full mt-2 inline-block">Surveillance Passive</span>
                </div>
                <div className={`text-2xl font-bold ${
                  !vendor.score.is_available ? 'text-slate-500' :
                  vendor.score.global_score >= 85 ? 'text-green-400' :
                  vendor.score.global_score >= 70 ? 'text-yellow-400' :
                  vendor.score.global_score >= 50 ? 'text-orange-400' :
                  'text-red-400'
                }`}>
                  {vendor.score.is_available ? vendor.score.global_score : '-'}
                  <span className="text-xs text-slate-500 ml-1">/100</span>
                </div>
              </div>
              
              <div className="flex-1 mt-4">
                {vendor.score.is_available && vendor.score.categories ? (
                  <div className="space-y-3">
                    {vendor.score.categories.map((cat: any) => (
                      <div key={cat.category} className="flex flex-col gap-1">
                        <div className="flex justify-between items-end text-xs">
                          <span className="text-slate-400 capitalize">{cat.category}</span>
                          <span className="text-white font-medium">{cat.score}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${cat.score >= 85 ? 'bg-green-400' : cat.score >= 70 ? 'bg-yellow-400' : cat.score >= 50 ? 'bg-orange-400' : 'bg-red-400'}`} style={{ width: `${cat.score}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">Score en cours de calcul...</p>
                )}
              </div>
              
              <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
                <Link to={`/inventory?domain_id=${vendor.id}`} className="text-sm text-primary-400 hover:text-primary-300 font-medium">
                  Voir les actifs découverts →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
