import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, { Background, Controls, MarkerType, Node, Edge, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { scenariosApi } from '../api/endpoints';
import { AttackTechniqueDrawer } from './AttackTechniqueDrawer';
import { Loader2, ShieldAlert, Crosshair, Server, Globe } from 'lucide-react';
// import { AttackGroupDrawer } from './AttackGroupDrawer'; // Assume it exists if we need it

// --- Custom Nodes ---
const AssetNode = ({ data }: any) => (
  <div className={`bg-slate-900 border-2 ${data.isDashed ? 'border-slate-500/50 border-dashed opacity-50' : 'border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]'} rounded-lg p-4 flex flex-col items-center justify-center min-w-[150px]`}>
    <Handle type="target" position={Position.Left} className={`w-2 h-2 ${data.isDashed ? '!bg-slate-500' : '!bg-cyan-500'}`} />
    {data.type === 'ip' ? <Server className={`w-6 h-6 mb-2 ${data.isDashed ? 'text-slate-400' : 'text-cyan-400'}`} /> : <Globe className={`w-6 h-6 mb-2 ${data.isDashed ? 'text-slate-400' : 'text-cyan-400'}`} />}
    <span className={`font-bold text-sm text-center truncate max-w-[140px] ${data.isDashed ? 'text-slate-400' : 'text-white'}`}>{data.name}</span>
    <span className={`${data.isDashed ? 'text-slate-500' : 'text-cyan-500/80'} text-xs mt-1 uppercase`}>{data.type}</span>
    <Handle type="source" position={Position.Right} className={`w-2 h-2 ${data.isDashed ? '!bg-slate-500' : '!bg-cyan-500'}`} />
  </div>
);

const TechniqueNode = ({ data }: any) => (
  <div className={`bg-rose-950/80 border-2 ${data.isDashed ? 'border-slate-500/50 border-dashed opacity-50' : 'border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.2)] hover:border-rose-400'} rounded-md p-4 transform rotate-45 flex items-center justify-center w-24 h-24 relative overflow-visible group cursor-pointer`}>
    <Handle type="target" position={Position.Top} className={`w-2 h-2 transform -rotate-45 ${data.isDashed ? '!bg-slate-500' : '!bg-rose-500'}`} style={{ left: '0%', top: '0%' }} />
    <div className="transform -rotate-45 flex flex-col items-center justify-center text-center">
      <Crosshair className={`w-5 h-5 mb-1 ${data.isDashed ? 'text-slate-400' : 'text-rose-400'}`} />
      <span className={`font-bold text-xs ${data.isDashed ? 'text-slate-400' : 'text-white'}`}>{data.name}</span>
    </div>
    <Handle type="source" position={Position.Right} className={`w-2 h-2 transform -rotate-45 ${data.isDashed ? '!bg-slate-500' : '!bg-rose-500'}`} style={{ right: '0%', bottom: '0%' }} />
  </div>
);

const nodeTypes = {
  asset: AssetNode,
  technique: TechniqueNode,
};

interface AttackPathGraphProps {
  scenarioId: string;
  onOpenGroup?: (group: string) => void;
}

export const AttackPathGraph: React.FC<AttackPathGraphProps> = ({ scenarioId, onOpenGroup }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTechnique, setSelectedTechnique] = useState<string | null>(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    scenariosApi.getPath(scenarioId).then((data) => {
      setMeta(data.meta);
      
      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));
      dagreGraph.setGraph({ rankdir: 'LR', nodesep: 100, ranksep: 200 });
      
      const reactFlowNodes: Node[] = data.nodes.map((n: any) => ({
        id: n.id,
        type: n.type === 'technique' ? 'technique' : 'asset',
        data: { name: n.name, type: n.type, isDashed: false },
        position: { x: 0, y: 0 }
      }));
      
      reactFlowNodes.forEach((node) => {
        // Different sizes for asset vs technique for layouting
        dagreGraph.setNode(node.id, { width: node.type === 'technique' ? 100 : 180, height: 100 });
      });
      
      const reactFlowEdges: Edge[] = data.edges.map((e: any, i: number) => {
        // Mock or use real confidence. Using 1.0 for now since not in edge yet.
        const conf = 1.0; 
        let edgeColor = '#10b981'; // green > 0.7
        if (conf < 0.4) edgeColor = '#f97316'; // orange
        else if (conf <= 0.7) edgeColor = '#eab308'; // yellow
        
        return {
          id: `e-${e.source}-${e.target}-${i}`,
          source: e.source,
          target: e.target,
          label: e.rule_key ? e.rule_key.replace(/_/g, ' ') : undefined,
          animated: true,
          style: { stroke: edgeColor, strokeWidth: 2 },
          labelStyle: { fill: '#cbd5e1', fontWeight: 700, fontSize: 10 },
          labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
          },
        };
      });
      
      reactFlowEdges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
      });
      
      // Add missing stages if any
      const totalStages = data.meta.kill_chain_total_stages || 0;
      const stageReached = data.meta.kill_chain_stage_reached || 0;
      
      if (stageReached < totalStages) {
        let lastNodeId = null;
        // Find the last technique or asset node
        if (data.nodes.length > 0) {
           lastNodeId = data.nodes[data.nodes.length - 1].id;
        }
        
        for (let s = stageReached + 1; s <= totalStages; s++) {
           const missingTechId = `missing_tech_${s}`;
           reactFlowNodes.push({
             id: missingTechId,
             type: 'technique',
             data: { name: `Étape ${s} (À venir)`, type: 'technique', isDashed: true },
             position: { x: 0, y: 0 }
           });
           dagreGraph.setNode(missingTechId, { width: 100, height: 100 });
           
           if (lastNodeId) {
             const missingEdgeId = `missing_e_${lastNodeId}_${missingTechId}`;
             reactFlowEdges.push({
               id: missingEdgeId,
               source: lastNodeId,
               target: missingTechId,
               animated: false,
               style: { stroke: '#64748b', strokeWidth: 2, strokeDasharray: '5 5' },
               markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
             });
             dagreGraph.setEdge(lastNodeId, missingTechId);
           }
           
           lastNodeId = missingTechId;
        }
      }
      
      dagre.layout(dagreGraph);
      
      const layoutedNodes = reactFlowNodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
          ...node,
          position: {
            x: nodeWithPosition.x - (node.type === 'technique' ? 50 : 90),
            y: nodeWithPosition.y - 50,
          },
        };
      });
      
      setNodes(layoutedNodes);
      setEdges(reactFlowEdges);
      setLoading(false);
    }).catch(console.error);
  }, [scenarioId]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.data?.isDashed) return; // Unclickable if dashed
    if (node.type === 'technique') {
        const techId = node.data.name; // Because we saved technique_id in name
        setSelectedTechnique(techId);
    } else {
        navigate(`/inventory/${node.id}`);
    }
  }, [navigate]);

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden">
      {meta && (
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap gap-6 items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-semibold mb-1">Likelihood</span>
              <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500" style={{ width: `${meta.likelihood_score}%` }}></div>
              </div>
              <span className="text-xs font-bold text-white mt-1">{meta.likelihood_score} / 100</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-semibold mb-1">Severity</span>
              <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500" style={{ width: `${meta.severity_score}%` }}></div>
              </div>
              <span className="text-xs font-bold text-white mt-1">{meta.severity_score} / 100</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
               <span className="text-xs text-slate-400 font-semibold mb-1">Kill Chain Progress</span>
               <span className="text-sm font-bold text-cyan-400">{meta.kill_chain_stage_reached} / {meta.kill_chain_total_stages} Stages</span>
             </div>
             {meta.relevant_attack_groups && meta.relevant_attack_groups.length > 0 && (
                 <div className="flex flex-col items-end border-l border-slate-700 pl-4">
                    <span className="text-xs text-slate-400 font-semibold mb-1">Threat Actors</span>
                     <div className="flex gap-1">
                        {meta.relevant_attack_groups.map((g: string) => (
                            <span 
                                key={g} 
                                onClick={() => onOpenGroup && onOpenGroup(g)}
                                className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs font-bold cursor-pointer hover:bg-red-500/30 transition-colors"
                            >
                                {g}
                            </span>
                        ))}
                    </div>
                 </div>
             )}
          </div>
        </div>
      )}
      
      <div className="flex-1 h-[400px] w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          attributionPosition="bottom-right"
          className="bg-[#0f172a]"
        >
          <Background color="#1e293b" gap={16} />
          <Controls className="!bg-slate-800 !border-slate-700 !fill-white" />
        </ReactFlow>
      </div>

      {selectedTechnique && (
        <AttackTechniqueDrawer 
          techniqueId={selectedTechnique} 
          domainId="" 
          onClose={() => setSelectedTechnique(null)} 
        />
      )}
    </div>
  );
};
