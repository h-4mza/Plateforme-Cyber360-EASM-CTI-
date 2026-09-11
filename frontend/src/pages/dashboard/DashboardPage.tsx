import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, Globe, ShieldCheck, Plus, Mail, AlertTriangle, Server, ShieldAlert, Activity, Clock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { organizationApi, membersApi, domainsApi, benchmarksApi, complianceApi, scenariosApi, attackApi } from '../../api/endpoints';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const getScoreColor = (score: number) => {
  if (score >= 85) return 'text-green-400';
  if (score >= 70) return 'text-yellow-400';
  if (score >= 50) return 'text-orange-400';
  return 'text-red-400';
};

const formatCategoryName = (cat: string) => {
  if (cat === 'threat_intelligence') return 'Threat Intelligence';
  if (cat === 'dns') return 'DNS';
  if (cat === 'tls') return 'TLS';
  return cat.replace(/_/g, ' ');
};

const getScoreBgColor = (score: number) => {
  if (score >= 85) return 'bg-green-400';
  if (score >= 70) return 'bg-yellow-400';
  if (score >= 50) return 'bg-orange-400';
  return 'bg-red-400';
};

const CircularGauge = ({ score, size = 160, strokeWidth = 12 }: { score: number, size?: number, strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all duration-1000 ease-out ${getScoreColor(score)}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${getScoreColor(score)}`}>{score}</span>
        <span className="text-sm text-slate-500 font-medium mt-1">/ 100</span>
      </div>
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    orgName: 'Chargement...',
    membersCount: 0,
    domainsCount: 0,
    scoreData: null as any,
    dashboardStats: null as any,
    scoreHistory: [] as any[],
    benchmarkData: null as any,
    financialExposure: null as any,
    complianceData: [] as any[],
    becRisk: null as any,
    scenarios: [] as any[],
    coverageData: null as any
  });
  
  const [isCondensedView, setIsCondensedView] = useState(() => {
    const saved = localStorage.getItem('cyber360_dashboard_view');
    if (saved) return saved === 'condensed';
    // default for readonly is condensed
    return user?.role === 'readonly';
  });

  const toggleView = () => {
    const newView = !isCondensedView;
    setIsCondensedView(newView);
    localStorage.setItem('cyber360_dashboard_view', newView ? 'condensed' : 'full');
  };

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      try {
        const [org, members, domains, scoreRes, dashStats, history, bench, finExp, compData, bec, scenarios] = await Promise.all([
          organizationApi.getMyOrg(),
          membersApi.listMembers(),
          domainsApi.list(),
          organizationApi.getScore(),
          organizationApi.getDashboardStats(),
          organizationApi.getScoreHistory(),
          benchmarksApi.getOrgBenchmark(user.organization_id).catch(() => null),
          organizationApi.getFinancialExposure().catch(() => null),
          complianceApi.list(user.organization_id).catch(() => []),
          organizationApi.getBecRisk().catch(() => null),
          scenariosApi.list(user.organization_id).catch(() => [])
        ]);
        
        const coverage = domains.length > 0 ? await attackApi.getCoverage(domains[0].id).catch(() => null) : null;
        
        setStats({
          orgName: org.name,
          membersCount: members.length,
          domainsCount: domains.length,
          scoreData: scoreRes,
          dashboardStats: dashStats,
          scoreHistory: history,
          benchmarkData: bench,
          financialExposure: finExp,
          complianceData: compData,
          becRisk: bec,
          scenarios,
          coverageData: coverage
        });
      } catch (error) {
        console.error("Erreur lors du chargement des statistiques", error);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Bienvenue, <span className="gradient-text">{user?.full_name}</span></h1>
          <p className="text-slate-400">Voici un aperçu de votre surface d'attaque externe.</p>
        </div>
        {!isCondensedView && (
          <button 
            onClick={toggleView}
            className="text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors bg-primary-500/10 px-4 py-2 rounded-lg"
          >
            Passer en vue simplifiée
          </button>
        )}
      </div>

      {isCondensedView ? (
        <div className="glass-card p-10 flex flex-col items-center max-w-4xl mx-auto mt-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Building2 className="w-64 h-64 text-cyan-500" />
          </div>

          <h2 className="text-3xl font-bold text-white mb-10 border-b border-white/10 pb-4 w-full text-center">
            Impact Business & Conformité
          </h2>

          {/* Financial Exposure */}
          {stats.financialExposure ? (
            <div className="w-full text-center mb-10 pb-10 border-b border-white/10 relative z-10">
              <span className="text-slate-400 text-sm uppercase tracking-wider font-bold block mb-4">Exposition Financière Théorique (Annualisée)</span>
              <div className="text-5xl font-bold text-red-500 mb-3 drop-shadow-lg">
                {new Intl.NumberFormat('fr-MA', { style: 'currency', currency: stats.financialExposure.currency, maximumFractionDigits: 0 }).format(stats.financialExposure.annualized_loss_min)} 
                <span className="text-3xl text-slate-400 font-medium mx-3">à</span> 
                {new Intl.NumberFormat('fr-MA', { style: 'currency', currency: stats.financialExposure.currency, maximumFractionDigits: 0 }).format(stats.financialExposure.annualized_loss_max)}
              </div>
              <p className="text-xs text-slate-500 mt-4 max-w-2xl mx-auto italic bg-slate-900/50 p-3 rounded border border-white/5">
                {stats.financialExposure.warning}
              </p>
            </div>
          ) : (
            <div className="w-full text-center mb-10 pb-10 border-b border-white/10 relative z-10">
              <span className="text-slate-400 text-sm uppercase tracking-wider font-bold block mb-4">Exposition Financière Théorique (Annualisée)</span>
              <div className="text-2xl font-bold text-emerald-400 mb-3 flex items-center justify-center gap-2">
                <ShieldCheck className="w-8 h-8" />
                Aucune exposition financière majeure détectée
              </div>
            </div>
          )}

          {/* Compliance */}
          {stats.complianceData && stats.complianceData.length > 0 && (
            <div className="w-full text-center mb-10 pb-10 border-b border-white/10 relative z-10">
              <span className="text-slate-400 text-sm uppercase tracking-wider font-bold block mb-6">Score de Conformité Global</span>
              <div className="flex flex-wrap items-center justify-center gap-6 text-lg text-white">
                {stats.complianceData.map(fw => (
                  <div key={fw.framework_key} className="bg-slate-800/80 border border-slate-700 px-6 py-4 rounded-xl shadow-lg">
                    <span className="text-cyan-400 font-bold block text-sm mb-1">{fw.framework_name}</span>
                    <div className="flex items-end justify-center gap-1">
                      <span className={`text-3xl font-bold ${getScoreColor(fw.compliance_percentage)}`}>{fw.compliance_percentage}%</span>
                      <span className="text-slate-500 text-sm mb-1 font-medium">conforme</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-400 mt-6">Évaluation continue basée sur l'audit technique de vos actifs publiquement exposés.</p>
            </div>
          )}

          {/* Top 3 Risks */}
          {stats.financialExposure?.top_risks && stats.financialExposure.top_risks.length > 0 && (
            <div className="w-full text-left relative z-10">
              <span className="text-slate-400 text-sm uppercase tracking-wider font-bold block mb-5">
                Top {stats.financialExposure.top_risks.length} Actions Prioritaires
              </span>
              <div className="space-y-4">
                {stats.financialExposure.top_risks.map((risk: any, i: number) => (
                  <div key={risk.id} className="p-5 bg-slate-900/80 border border-red-500/20 rounded-xl flex items-start gap-5 hover:bg-slate-800/80 transition-colors shadow-lg">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 border border-red-500/30 flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-inner">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-bold text-lg mb-2">{risk.title}</h4>
                      <p className="text-[15px] text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-lg border border-white/5">
                        <strong className="text-emerald-400">Corriger ce risque réduit l'exposition estimée de {new Intl.NumberFormat('fr-MA', { style: 'currency', currency: stats.financialExposure.currency, maximumFractionDigits: 0 }).format(risk.reduction_amount)}</strong> pour un effort technique estimé <strong className="text-cyan-400">{risk.effort}</strong>.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={toggleView} className="text-slate-500 hover:text-white text-sm mt-12 transition-colors flex items-center gap-2 font-medium">
            Passer à la vue technique (Dashboard Complet)
          </button>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card-hover p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-slate-400 font-medium text-sm">Organisation</h3>
          </div>
          <p className="text-xl font-semibold text-white truncate">{stats.orgName}</p>
        </div>

        <div className="glass-card-hover p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-slate-400 font-medium text-sm">Domaines</h3>
          </div>
          <p className="text-xl font-semibold text-white">{stats.domainsCount}</p>
        </div>

        <div className="glass-card-hover p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <h3 className="text-slate-400 font-medium text-sm">Actifs</h3>
          </div>
          <p className="text-xl font-semibold text-white">{stats.dashboardStats?.active_assets || 0}</p>
        </div>

        <Link to="/risks" className="glass-card-hover p-5 block group cursor-pointer transition-all hover:bg-white/[0.04]">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-slate-400 font-medium text-sm">Risques Ouverts</h3>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-xl font-semibold text-white">{stats.dashboardStats?.open_risks_total || 0}</p>
            {stats.dashboardStats?.open_risks_critical > 0 && (
              <span className="text-red-400 font-bold text-sm bg-red-500/10 px-2 py-0.5 rounded-full mb-0.5">
                {stats.dashboardStats.open_risks_critical} critiques
              </span>
            )}
          </div>
        </Link>

        <div className="glass-card-hover p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-slate-400 font-medium text-sm">Membres</h3>
          </div>
          <p className="text-xl font-semibold text-white">{stats.membersCount}</p>
        </div>
      </div>

      {/* Cyber360 Score Section */}
      <div className="glass-card p-6 md:p-8 relative overflow-hidden">
        {/* Decorator blob */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="w-6 h-6 text-primary-400" />
          <h2 className="text-xl font-bold text-white">Score Cyber360</h2>
        </div>

        {stats.scoreData?.is_available ? (
          <div className="flex flex-col md:flex-row items-center gap-12">
            {/* Left: Global Score Ring */}
            <div className="flex flex-col items-center">
              <CircularGauge score={stats.scoreData.global_score} />
              <p className="text-slate-400 mt-4 text-sm font-medium">Score de sécurité global</p>
            </div>

            {/* Right: Category Bars */}
            <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {stats.scoreData.categories?.map((cat: any) => (
                <div key={cat.category} className="flex flex-col gap-2">
                  <div className="flex justify-between items-end">
                    <span className="text-slate-300 font-medium capitalize text-sm">{formatCategoryName(cat.category)}</span>
                    <span className={`font-bold text-sm ${getScoreColor(cat.score)}`}>
                      {cat.score}/100
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${getScoreBgColor(cat.score)}`} 
                      style={{ width: `${cat.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Score non disponible</h3>
            <p className="text-slate-400 max-w-md mb-6">
              Aucun actif n'a encore été analysé. Ajoutez votre premier domaine pour obtenir votre score de sécurité.
            </p>
            <Link to="/domains" className="btn-primary gap-2">
              <Plus className="w-5 h-5" />
              Ajouter un domaine
            </Link>
          </div>
        )}
      </div>

      {/* BEC Risk Card */}
      {stats.becRisk && (
        <div className={`glass-card p-6 md:p-8 relative overflow-hidden border ${
          stats.becRisk.severity === 'Critique' ? 'border-red-500/50 bg-red-950/10' :
          stats.becRisk.severity === 'Élevé' ? 'border-orange-500/50 bg-orange-950/10' :
          stats.becRisk.severity === 'Moyen' ? 'border-yellow-500/30' :
          'border-emerald-500/20'
        }`}>
          <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <Mail className={`w-6 h-6 ${
                  stats.becRisk.severity === 'Critique' ? 'text-red-500' :
                  stats.becRisk.severity === 'Élevé' ? 'text-orange-500' :
                  stats.becRisk.severity === 'Moyen' ? 'text-yellow-500' :
                  'text-emerald-500'
                }`} />
                <h2 className="text-xl font-bold text-white">Score de Risque BEC (Business Email Compromise)</h2>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                  stats.becRisk.severity === 'Critique' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  stats.becRisk.severity === 'Élevé' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                  stats.becRisk.severity === 'Moyen' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                  'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {stats.becRisk.severity}
                </span>
              </div>
              <p className="text-slate-300 mb-6">{stats.becRisk.explanation}</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link to="/risks?category=messagerie" className="bg-slate-900/50 p-4 rounded-lg border border-white/5 hover:bg-slate-800/50 transition-colors flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-medium text-slate-400 uppercase mb-1">Protections Email Faibles</span>
                    <span className={`text-2xl font-bold ${stats.becRisk.signals.email_protection_risks > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {stats.becRisk.signals.email_protection_risks}
                    </span>
                  </div>
                  <ShieldAlert className="w-8 h-8 text-slate-700" />
                </Link>
                
                <Link to="/brand-protection" className="bg-slate-900/50 p-4 rounded-lg border border-white/5 hover:bg-slate-800/50 transition-colors flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-medium text-slate-400 uppercase mb-1">Domaines Sosies (Avec MX)</span>
                    <span className={`text-2xl font-bold ${stats.becRisk.signals.active_typo_domains > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {stats.becRisk.signals.active_typo_domains}
                    </span>
                  </div>
                  <Globe className="w-8 h-8 text-slate-700" />
                </Link>
                
                <Link to="/brand-protection" className="bg-slate-900/50 p-4 rounded-lg border border-white/5 hover:bg-slate-800/50 transition-colors flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-medium text-slate-400 uppercase mb-1">Comptes fuité(s)</span>
                    <span className={`text-2xl font-bold ${stats.becRisk.signals.credential_leaks > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {stats.becRisk.signals.credential_leaks}
                    </span>
                  </div>
                  <Users className="w-8 h-8 text-slate-700" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attack Scenarios and MITRE ATT&CK Coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Scenarios Card */}
        {stats.scenarios && (
          <div className={`glass-card p-6 md:p-8 relative overflow-hidden border ${
            stats.scenarios.filter((s: any) => s.status === 'open').length > 0 ? 'border-red-500/50 bg-red-950/10' : 'border-emerald-500/20'
          }`}>
            <div className="flex flex-col gap-8 items-start justify-between h-full">
              <div className="w-full">
                <div className="flex items-center gap-3 mb-3">
                  <ShieldAlert className={`w-6 h-6 ${
                    stats.scenarios.filter((s: any) => s.status === 'open').length > 0 ? 'text-red-500' : 'text-emerald-500'
                  }`} />
                  <h2 className="text-xl font-bold text-white">Scénarios d'Attaque Actifs</h2>
                </div>
                
                {stats.scenarios.filter((s: any) => s.status === 'open').length > 0 ? (
                  <>
                    <p className="text-slate-300 mb-6">
                      <span className="text-red-400 font-bold">{stats.scenarios.filter((s: any) => s.status === 'open').length} scénarios critiques détectés</span>, {stats.scenarios.filter((s: any) => s.status === 'partial').length} scénarios en germe.
                    </p>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {stats.scenarios.filter((s: any) => s.status === 'open').sort((a: any, b: any) => (b.severity_score || 0) - (a.severity_score || 0)).slice(0, 1).map((scenario: any) => (
                        <Link key={scenario.id} to="/scenarios" className="bg-slate-900/50 p-4 rounded-lg border border-red-500/30 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-4 w-full">
                          <div className="w-full">
                            <span className="block text-xs font-medium text-slate-400 uppercase mb-1">Scénario le plus critique</span>
                            <span className="text-lg font-bold text-white truncate block w-full">{scenario.scenario_key.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="flex items-center gap-3 w-full justify-between">
                            <span className="text-sm font-medium text-slate-400">Score de Sévérité</span>
                            <span className="text-2xl font-bold text-red-400">{Math.round(scenario.severity_score || 0)}/100</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-900/50 p-6 rounded-lg border border-emerald-500/20 text-center w-full mt-4">
                    <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-emerald-400">Aucun chemin d'attaque complet détecté actuellement</h3>
                    <p className="text-slate-400 text-sm mt-2">{stats.scenarios.filter((s: any) => s.status === 'partial').length} scénarios en statut "partial" identifiés.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MITRE ATT&CK Coverage Card */}
        {stats.coverageData && (
          <div className="glass-card p-6 md:p-8 relative overflow-hidden border border-cyan-500/20">
            <div className="flex flex-col gap-8 items-start h-full">
              <div className="w-full">
                <div className="flex items-center gap-3 mb-3">
                  <Globe className="w-6 h-6 text-cyan-500" />
                  <h2 className="text-xl font-bold text-white">Couverture MITRE ATT&CK</h2>
                </div>
                <p className="text-slate-300 mb-6">
                  Analyse de votre surface d'attaque mappée sur le référentiel MITRE ATT&CK.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Link to="/attack-matrix" className="bg-slate-900/50 p-4 rounded-lg border border-white/5 hover:bg-slate-800/50 transition-colors flex items-center justify-between">
                    <div>
                      <span className="block text-xs font-medium text-slate-400 uppercase mb-1">Tactiques Exposées</span>
                      <span className="text-2xl font-bold text-cyan-400">
                        {Math.round((stats.coverageData.covered_tactics_count / (stats.coverageData.total_tactics || 1)) * 100)}%
                      </span>
                      <span className="ml-2 text-sm text-slate-500 font-medium">{stats.coverageData.covered_tactics_count} / {stats.coverageData.total_tactics}</span>
                    </div>
                    <Activity className="w-8 h-8 text-slate-700" />
                  </Link>
                  
                  <Link to="/attack-matrix" className="bg-slate-900/50 p-4 rounded-lg border border-white/5 hover:bg-slate-800/50 transition-colors flex items-center justify-between">
                    <div>
                      <span className="block text-xs font-medium text-slate-400 uppercase mb-1">Techniques Exposées</span>
                      <span className="text-2xl font-bold text-amber-400">
                        {stats.coverageData.matrix_exposed_percentage > 0 ? stats.coverageData.matrix_exposed_percentage.toFixed(1) : 0}%
                      </span>
                    </div>
                    <Server className="w-8 h-8 text-slate-700" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sector Benchmark Section */}
      <div className="glass-card p-6 md:p-8 relative overflow-hidden border border-emerald-500/20">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-6 h-6 text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Positionnement Sectoriel</h2>
        </div>
        
        {stats.benchmarkData?.is_available ? (
          <div className="space-y-6">
            <p className="text-lg text-white font-medium">
              Votre score de <span className="text-emerald-400 font-bold">{Math.round(stats.benchmarkData.org_score)}</span> vous place dans le <span className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-md font-bold">{stats.benchmarkData.position_text}</span> des entreprises de votre secteur (<span className="text-slate-300">{stats.benchmarkData.sector}</span>) sur Cyber360.
            </p>
            
            <div className="relative pt-8 pb-8 px-4 w-full max-w-3xl mx-auto">
              <div className="h-4 bg-slate-800 rounded-full w-full relative overflow-hidden flex">
                 <div className="h-full bg-red-500/40" style={{width: '25%'}}></div>
                 <div className="h-full bg-orange-500/40" style={{width: '25%'}}></div>
                 <div className="h-full bg-yellow-500/40" style={{width: '25%'}}></div>
                 <div className="h-full bg-green-500/40" style={{width: '25%'}}></div>
              </div>
              
              <div className="absolute top-2 text-xs font-bold text-slate-500" style={{left: '0%'}}>Min</div>
              <div className="absolute top-2 text-xs font-bold text-slate-400" style={{left: '25%', transform: 'translateX(-50%)'}}>{Math.round(stats.benchmarkData.percentile_25)}</div>
              <div className="absolute top-2 text-xs font-bold text-slate-300" style={{left: '50%', transform: 'translateX(-50%)'}}>{Math.round(stats.benchmarkData.percentile_50)}</div>
              <div className="absolute top-2 text-xs font-bold text-emerald-400" style={{left: '75%', transform: 'translateX(-50%)'}}>{Math.round(stats.benchmarkData.percentile_75)}</div>
              <div className="absolute top-2 text-xs font-bold text-emerald-500" style={{left: '100%', transform: 'translateX(-100%)'}}>Max</div>
              
              <div 
                className="absolute top-8 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] border-2 border-emerald-500 transform -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-1000"
                style={{left: `${Math.min(100, Math.max(0, stats.benchmarkData.org_score!))}%`}}
              ></div>
              <div 
                className="absolute top-12 text-sm font-bold text-white transform -translate-x-1/2 whitespace-nowrap bg-emerald-600 px-2 py-0.5 rounded shadow-lg transition-all duration-1000"
                style={{left: `${Math.min(100, Math.max(0, stats.benchmarkData.org_score!))}%`}}
              >
                Vous
              </div>
            </div>
            <p className="text-xs text-slate-500 text-center mt-2">
              Les données sont anonymisées et regroupées par percentile pour garantir la stricte confidentialité des acteurs du marché.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Données sectorielles en cours d'acquisition</h3>
            <p className="text-slate-400 max-w-md">
              Pour garantir l'anonymat absolu de nos clients, nous n'affichons les statistiques de votre secteur ({stats.benchmarkData?.sector || 'Non défini'}) que lorsqu'au moins 5 entreprises y sont actives. Revenez plus tard !
            </p>
          </div>
        )}
      </div>

      {/* Lower Grid: Charts & Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Score Evolution Chart */}
        <div className="lg:col-span-2 glass-card p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-400" />
            Évolution du Score (30 jours)
          </h2>
          <div className="h-[300px] w-full">
            {stats.scoreHistory && stats.scoreHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.scoreHistory} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    tickFormatter={(tick) => format(new Date(tick), 'dd MMM', { locale: fr })} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    domain={[0, 100]} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#e2e8f0' }}
                    labelFormatter={(label: any) => {
                      if (!label) return '';
                      try {
                        return format(new Date(label as string | number), 'dd MMMM yyyy', { locale: fr });
                      } catch {
                        return String(label);
                      }
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score_global" 
                    stroke="#38bdf8" 
                    strokeWidth={3}
                    dot={{ fill: '#38bdf8', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Score Global"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                Pas assez de données d'historique.
              </div>
            )}
          </div>
        </div>

        {/* Recent Changes Feed */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            Derniers changements
          </h2>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {stats.dashboardStats?.recent_changes?.length > 0 ? (
              stats.dashboardStats.recent_changes.map((change: any) => (
                <div key={change.id} className="flex gap-3 items-start border-b border-white/5 pb-3 last:border-0">
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${change.changed_from_previous === 'degraded' || change.result === 'error' ? 'bg-red-400' : 'bg-green-400'}`}></div>
                  <div>
                    <p className="text-sm text-white font-medium">
                      {change.target}
                    </p>
                    <p className="text-xs text-slate-400 capitalize">
                      {change.type.replace('_', ' ')}: {change.changed_from_previous === 'degraded' ? 'dégradé' : change.changed_from_previous === 'improved' ? 'amélioré' : 'nouveau'}
                    </p>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      {format(new Date(change.executed_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm">Aucun changement récent détecté.</p>
            )}
          </div>
        </div>

      </div>

      {/* Last Analyses & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            Dernières analyses
          </h2>
          <div className="space-y-4">
            {stats.dashboardStats?.last_analyses?.map((analysis: any) => (
              <div key={analysis.domain} className="flex justify-between items-center bg-slate-800/30 p-3 rounded-lg border border-white/5">
                <span className="text-white font-medium">{analysis.domain}</span>
                <div className="text-right">
                  <p className="text-xs text-slate-400">
                    Découverte: {analysis.last_discovery ? format(new Date(analysis.last_discovery), 'dd MMM HH:mm', { locale: fr }) : 'Jamais'}
                  </p>
                  <p className="text-xs text-slate-400">
                    Monitoring: {analysis.last_monitoring ? format(new Date(analysis.last_monitoring), 'dd MMM HH:mm', { locale: fr }) : 'Jamais'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass-card p-6 flex flex-col">
          <h2 className="text-xl font-semibold text-white mb-6">Actions rapides</h2>
          <div className="flex flex-col gap-4 flex-1 justify-center">
            <Link to="/domains" className="btn-primary w-full justify-center gap-2">
              <Plus className="w-5 h-5" />
              Ajouter un domaine
            </Link>
            <Link to="/members" className="btn-secondary w-full justify-center gap-2">
              <Mail className="w-5 h-5" />
              Inviter un membre
            </Link>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
