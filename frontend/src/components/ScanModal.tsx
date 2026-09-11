import React, { useEffect, useState } from 'react';
import { assetsApi } from '../api/endpoints';
import { Loader2, CheckCircle2, XCircle, ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ScanModalProps {
  assetId: string;
  assetName: string;
  onClose: () => void;
}

export const ScanModal: React.FC<ScanModalProps> = ({ assetId, assetName, onClose }) => {
  const [completedChecks, setCompletedChecks] = useState<string[]>([]);
  const [error, setError] = useState('');

  const steps = [
    { type: 'ports', label: 'Scan de ports (services exposés)' },
    { type: 'tls', label: 'Vérification SSL/TLS (certificats)' },
    { type: 'http_headers', label: 'Analyse des entêtes de sécurité HTTP' }
  ];

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let isSubscribed = true;

    const checkStatus = async () => {
      try {
        const checks = await assetsApi.getRecentChecks(assetId);
        if (isSubscribed) {
          const types = checks.map(c => c.type);
          setCompletedChecks(types);
        }
      } catch (err) {
        console.error(err);
        if (isSubscribed) setError('Erreur de communication avec le serveur.');
      }
    };

    // Initial check
    checkStatus();
    
    // Poll every 2 seconds
    interval = setInterval(checkStatus, 2000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [assetId]);

  const isAllComplete = steps.every(s => completedChecks.includes(s.type));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            Analyse en cours...
          </h2>
          <p className="text-sm text-slate-400 mb-6">Actif cible : <span className="font-semibold text-white">{assetName}</span></p>

          <div className="space-y-4">
            {steps.map(step => {
              const isCompleted = completedChecks.includes(step.type);
              
              return (
                <div key={step.type} className={`flex items-center gap-3 p-3 rounded-lg border ${isCompleted ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-800/50 border-white/5'}`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin flex-shrink-0" />
                  )}
                  <span className={`text-sm font-medium ${isCompleted ? 'text-emerald-300' : 'text-slate-300'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        <div className="p-6 pt-0 flex gap-3 justify-end">
          {isAllComplete ? (
            <Link 
              to={`/risks?asset_id=${assetId}`} 
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2"
            >
              Voir les résultats <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
            >
              Exécuter en arrière-plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
