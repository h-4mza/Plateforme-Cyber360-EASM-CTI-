import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Network, Search, Filter, ShieldAlert, Crosshair, ZoomIn, ZoomOut, Maximize, AlertTriangle, Target, Info, ExternalLink, Globe, Server, Link2, Shield, Calendar, Tag } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { assetsApi } from '../../api/endpoints';
import { Asset } from '../../types';

export const AssetGraphPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fgRef = useRef<any>(null);

  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[]; active_paths: any[]; meta: any | null }>({ nodes: [], edges: [], active_paths: [], meta: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [minConfidence, setMinConfidence] = useState(0.0);
  const [isolateScenarios, setIsolateScenarios] = useState(false);
  const [showActivePaths, setShowActivePaths] = useState(false);
  const [hiddenRelationTypes, setHiddenRelationTypes] = useState<Set<string>>(new Set());

  // Interaction State
  const [hoverNode, setHoverNode] = useState<any>(null);
  const [hoverLink, setHoverLink] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<Asset | null>(null);
  const [isAssetLoading, setIsAssetLoading] = useState(false);
  
  // Legend toggle
  const [showLegend, setShowLegend] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    apiClient.get(`/organizations/${user.organization_id}/asset-graph`)
      .then(res => {
        const data = res.data;
        setGraphData({ ...data, active_paths: data.active_paths || [] });
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.response?.data?.detail || err.message || "Erreur de chargement du graphe");
        setIsLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (selectedNode) {
      setIsAssetLoading(true);
      assetsApi.getAsset(selectedNode.id)
        .then(data => setSelectedAssetDetail(data))
        .catch(err => console.error("Could not fetch asset details", err))
        .finally(() => setIsAssetLoading(false));
    } else {
      setSelectedAssetDetail(null);
    }
  }, [selectedNode]);

  // Derived filtered data
  const filteredData = useMemo(() => {
    let nodes = [...graphData.nodes];
    let edges = [...graphData.edges];

    if (isolateScenarios) {
      nodes = nodes.filter((n: any) => n.is_in_active_scenario);
      const activeIds = new Set(nodes.map((n: any) => n.id));
      edges = edges.filter((e: any) => activeIds.has(e.source) && activeIds.has(e.target));
    }

    edges = edges.filter((e: any) => e.confidence >= minConfidence);
    edges = edges.filter((e: any) => !hiddenRelationTypes.has(e.relation_type));

    const validNodeIds = new Set(nodes.map((n: any) => n.id));
    let cleanEdges = edges
        .filter((e: any) => {
            const src = typeof e.source === 'object' ? e.source.id : e.source;
            const tgt = typeof e.target === 'object' ? e.target.id : e.target;
            return validNodeIds.has(src) && validNodeIds.has(tgt);
        })
        .map((e: any) => ({
            ...e,
            source: typeof e.source === 'object' ? e.source.id : e.source,
            target: typeof e.target === 'object' ? e.target.id : e.target
        }));

    // Inject active paths edges if toggled
    if (showActivePaths && graphData.active_paths) {
      graphData.active_paths.forEach((p: any) => {
        const pathNodes = p.path;
        for (let i = 0; i < pathNodes.length - 1; i++) {
          const srcId = pathNodes[i].asset_id;
          const tgtId = pathNodes[i+1].asset_id;
          if (srcId && tgtId && validNodeIds.has(srcId) && validNodeIds.has(tgtId)) {
            cleanEdges.push({
              source: srcId,
              target: tgtId,
              relation_type: 'attack_path',
              confidence: 1.0,
              is_scenario_path: true,
              scenario_id: p.scenario_id,
            });
          }
        }
      });
    }

    return { nodes, links: cleanEdges };
  }, [graphData, minConfidence, isolateScenarios, hiddenRelationTypes, showActivePaths]);

  const getSeverityColor = (severity: string | null) => {
    switch (severity) {
      case 'critical': return '#ef4444'; 
      case 'high': return '#f59e0b'; 
      case 'medium': return '#eab308'; 
      case 'low': return '#94a3b8'; 
      default: return '#334155'; 
    }
  };

  const relationColors: Record<string, string> = {
    'shared_ip': '#38bdf8',
    'shared_tls_cert_san': '#818cf8',
    'same_root_domain': '#a78bfa',
    'dns_cname_chain': '#f472b6',
    'shared_hosting_asn': '#cbd5e1',
    'subdomain_naming_pattern': '#2dd4bf',
  };

  const getRelationColor = (type: string) => type === 'attack_path' ? '#ef4444' : (relationColors[type] || '#94a3b8');

  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isHovered = node === hoverNode;
    const isSelected = node === selectedNode;
    let dim = false;
    if (selectedNode && selectedNode !== node) dim = true;
    if (hoverNode && hoverNode !== node) dim = true;

    const baseRadius = 8 + (Math.min(node.open_risks_count, 20) * 0.6);
    const radius = isHovered || isSelected ? baseRadius * 1.3 : baseRadius;
    const color = getSeverityColor(node.max_severity);

    if (node.is_in_active_scenario && !dim) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI, false);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; 
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    if (dim) ctx.globalAlpha = 0.2;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.lineWidth = isSelected ? 3 : 1.5;
    ctx.strokeStyle = isSelected ? '#fff' : '#1e293b';
    if (dim) ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();

    if ((globalScale > 1.5 && !dim) || isHovered || isSelected) {
      const label = node.name;
      const fontSize = 16 / globalScale;
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = dim ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.95)';
      ctx.fillText(label, node.x, node.y + radius + (12 / globalScale));
    }
  }, [hoverNode, selectedNode]);

  const handleRecenter = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 50);
      fgRef.current.d3ReheatSimulation();
    }
  }, []);

  const AssetIcon = ({ type, className }: { type: string, className?: string }) => {
    if (type === 'root_domain' || type === 'subdomain') return <Globe className={className} />;
    if (type === 'ip') return <Server className={className} />;
    if (type === 'certificate') return <Shield className={className} />;
    return <Network className={className} />;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -mt-2">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
            <Network className="w-7 h-7 text-cyan-400" />
            Graphe d'Infrastructure
          </h1>
          <p className="text-slate-400 text-sm">
            Visualisez les relations entre vos actifs et identifiez les chemins d'attaque.
            {graphData.meta && ` (${graphData.meta.total_nodes} actifs, ${graphData.meta.total_edges} relations)`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRecenter} className="btn-secondary px-3 py-2 text-sm gap-2">
            <Crosshair className="w-4 h-4" /> Recentrer
          </button>
        </div>
      </div>

      {error ? (
        <div className="glass-card p-8 border-l-4 border-rose-500 bg-rose-500/5 text-center flex flex-col items-center justify-center flex-1">
          <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Erreur de chargement</h3>
          <p className="text-slate-400 max-w-md">{error}</p>
        </div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-hidden">
          <div className="glass-card flex-1 relative overflow-hidden flex rounded-xl border border-white/5">
            {/* Filter overlay */}
            <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-lg p-4 shadow-xl max-w-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Filter className="w-4 h-4 text-cyan-400" />
                  Filtres & Calques
                </h3>
              </div>
              
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only"
                      checked={showActivePaths}
                      onChange={(e) => setShowActivePaths(e.target.checked)}
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${showActivePaths ? 'bg-rose-500' : 'bg-slate-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showActivePaths ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">
                    Superposer les chemins d'attaque actifs
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only"
                      checked={isolateScenarios}
                      onChange={(e) => setIsolateScenarios(e.target.checked)}
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${isolateScenarios ? 'bg-cyan-500' : 'bg-slate-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isolateScenarios ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">
                    Isoler les actifs compromis
                  </span>
                </label>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Indice de confiance min.</span>
                    <span className="text-cyan-400 font-medium">{(minConfidence * 100).toFixed(0)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="1" step="0.05"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Legend Overlay */}
            <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-lg p-4 shadow-xl">
              <button 
                onClick={() => setShowLegend(!showLegend)}
                className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between w-full hover:text-white"
              >
                Légende {showLegend ? '▼' : '▲'}
              </button>
              
              {showLegend && (
                <div className="space-y-3 mt-3">
                  <div>
                    <div className="text-[10px] uppercase text-slate-500 mb-1 font-semibold">Types de relations</div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {Object.entries(relationColors).map(([type, color]) => {
                        const isHidden = hiddenRelationTypes.has(type);
                        return (
                          <div 
                            key={type} 
                            className={`flex items-center gap-2 text-xs cursor-pointer ${isHidden ? 'opacity-40' : 'hover:opacity-80'}`}
                            onClick={() => {
                              const newHidden = new Set(hiddenRelationTypes);
                              if (isHidden) newHidden.delete(type);
                              else newHidden.add(type);
                              setHiddenRelationTypes(newHidden);
                            }}
                          >
                            <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: color }}></span>
                            <span className="text-slate-300 truncate max-w-[150px]">{type.replace(/_/g, ' ')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-white/5">
                    <div className="text-[10px] uppercase text-slate-500 mb-1 font-semibold">Taille & Couleur (Actif)</div>
                    <div className="flex items-center gap-2 text-xs text-slate-300 mb-1">
                      <div className="flex items-end gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                        <div className="w-3.5 h-3.5 rounded-full bg-red-500"></div>
                      </div>
                      <span>Volume & Sévérité des risques</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <div className="w-3.5 h-3.5 rounded-full border border-rose-500 bg-rose-500/20 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                      <span>Ciblé par un scénario</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Edge Tooltip */}
            {hoverLink && (
              <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl max-w-sm pointer-events-none">
                {hoverLink.is_scenario_path ? (
                  <>
                    <h4 className="text-sm font-bold text-rose-500 mb-1 flex items-center gap-2">
                      <Target className="w-4 h-4" /> Chemin d'attaque
                    </h4>
                    <p className="text-xs text-slate-300 mb-2">Trajectoire exploitée dans un scénario actif.</p>
                    <div className="text-xs text-cyan-400 font-medium">Cliquez pour voir le scénario</div>
                  </>
                ) : (
                  <>
                    <h4 className="text-sm font-bold text-white capitalize mb-1">{hoverLink.relation_type.replace(/_/g, ' ')}</h4>
                    <div className="text-xs text-cyan-400 font-medium mb-3">Confiance : {(hoverLink.confidence * 100).toFixed(0)}%</div>
                    
                    {hoverLink.evidence && (
                      <div className="bg-black/50 rounded-md p-2 border border-white/5 overflow-hidden">
                        <pre className="text-[10px] text-slate-300 whitespace-pre-wrap break-words">
                          {JSON.stringify(hoverLink.evidence, null, 2)}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {!isLoading && graphData.nodes.length > 0 && (
              <ForceGraph2D
                ref={fgRef}
                graphData={filteredData}
                backgroundColor="transparent"
                nodeRelSize={4}
                nodeCanvasObject={drawNode}
                nodePointerAreaPaint={(node, color, ctx) => {
                  const radius = 12 + (node as any).open_risks_count * 0.6;
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(node.x as number, node.y as number, radius, 0, 2 * Math.PI, false);
                  ctx.fill();
                }}
                onNodeHover={setHoverNode}
                onNodeClick={(node) => setSelectedNode(node)}
                linkWidth={(link: any) => link.is_scenario_path ? 2 : Math.max(0.5, link.confidence * 3)}
                linkColor={(link: any) => {
                  let opacity = link.is_scenario_path ? 0.9 : link.confidence * 0.8;
                  if (selectedNode) {
                    const isConnected = link.source.id === selectedNode.id || link.target.id === selectedNode.id;
                    if (!isConnected) opacity = 0.05;
                    else opacity = link.is_scenario_path ? 1.0 : 1.0;
                  } else if (hoverNode) {
                    const isConnected = link.source.id === hoverNode.id || link.target.id === hoverNode.id;
                    if (!isConnected) opacity = 0.1;
                    else opacity = link.is_scenario_path ? 1.0 : 0.9;
                  }
                  
                  const hex = getRelationColor(link.relation_type);
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
                }}
                linkLineDash={(link: any) => link.is_scenario_path ? [4, 4] : null}
                linkDirectionalParticles={(link: any) => link.is_scenario_path ? 4 : 0}
                linkDirectionalParticleSpeed={(link: any) => link.is_scenario_path ? 0.01 : 0}
                linkDirectionalParticleWidth={(link: any) => link.is_scenario_path ? 3 : 0}
                linkDirectionalParticleColor={() => '#ef4444'}
                linkDirectionalArrowLength={(link: any) => (selectedNode || hoverNode) && !link.is_scenario_path ? 3 : 0}
                linkDirectionalArrowRelPos={1}
                onLinkHover={setHoverLink}
                onLinkClick={(link: any) => {
                  if (link.is_scenario_path && link.scenario_id) {
                    navigate('/scenarios');
                  }
                }}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
                warmupTicks={100}
                cooldownTicks={200}
              />
            )}

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm z-20">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
                  <div className="text-cyan-400 font-medium">Analyse des relations en cours...</div>
                </div>
              </div>
            )}
          </div>

          {selectedNode && (
            <div className="w-80 glass-card flex flex-col overflow-hidden animate-slide-in-right border border-cyan-500/30">
              <div className="p-4 border-b border-white/10 bg-slate-900/50 flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                    <AssetIcon type={selectedNode.type} className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-lg truncate max-w-[200px]" title={selectedNode.name}>
                      {selectedNode.name}
                    </h2>
                    <div className="text-xs text-slate-400 capitalize">{selectedNode.type.replace('_', ' ')}</div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedNode(null)}
                  className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/50 border border-white/5 p-3 rounded-xl">
                    <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Criticité</div>
                    <div className="text-white font-medium capitalize flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        selectedNode.criticality === 'high' ? 'bg-rose-500' :
                        selectedNode.criticality === 'medium' ? 'bg-amber-500' : 'bg-slate-400'
                      }`}></div>
                      {selectedNode.criticality}
                    </div>
                  </div>
                  <div className="bg-slate-900/50 border border-white/5 p-3 rounded-xl">
                    <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Risques Ouverts</div>
                    <div className="text-white font-bold text-lg">{selectedNode.open_risks_count}</div>
                  </div>
                </div>

                {isAssetLoading ? (
                  <div className="flex items-center justify-center p-6 bg-white/5 rounded-xl border border-white/5">
                    <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                  </div>
                ) : selectedAssetDetail ? (
                  <div className="space-y-4">
                    {/* Status badge */}
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded-md border ${
                        selectedAssetDetail.status === 'active' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {selectedAssetDetail.status}
                      </span>
                      {selectedAssetDetail.technology && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-md flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {selectedAssetDetail.technology}
                        </span>
                      )}
                    </div>
                    
                    {/* Tech details */}
                    <div className="bg-slate-900/50 border border-white/5 rounded-xl p-3 space-y-3">
                      {selectedAssetDetail.ip_address && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400 flex items-center gap-2"><Server className="w-3.5 h-3.5" /> IP</span>
                          <span className="font-mono text-cyan-300">{selectedAssetDetail.ip_address}</span>
                        </div>
                      )}
                      {selectedAssetDetail.hostname && selectedAssetDetail.hostname !== selectedNode.name && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400 flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Hostname</span>
                          <span className="text-white truncate max-w-[140px]" title={selectedAssetDetail.hostname}>{selectedAssetDetail.hostname}</span>
                        </div>
                      )}
                      {selectedAssetDetail.cert_issuer && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400 flex items-center gap-2"><Shield className="w-3.5 h-3.5" /> Cert Issuer</span>
                          <span className="text-white truncate max-w-[140px]" title={selectedAssetDetail.cert_issuer}>{selectedAssetDetail.cert_issuer}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-sm pt-2 border-t border-white/5">
                        <span className="text-slate-400 flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Découvert le</span>
                        <span className="text-slate-300">{new Date(selectedAssetDetail.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {selectedNode.is_in_active_scenario && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex gap-3">
                    <Target className="w-5 h-5 text-rose-500 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-rose-400 mb-1">Cible d'un Scénario Actif</div>
                      <div className="text-xs text-rose-200/70">Cet actif est impliqué dans un chemin d'attaque potentiellement exploitable.</div>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Link 
                    to={`/inventory/${selectedNode.id}`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" /> Voir la fiche complète
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
