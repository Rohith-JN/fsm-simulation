import { useMemo } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType } from '@xyflow/react';
import type { Node, NodeProps, Edge, EdgeProps } from '@xyflow/react';
import type { Protocol } from '../models/types.ts';
import type { TraceEntry } from '../engine/simulate.ts';

type StateNode = Node<{ code: string; label: string; initial: boolean; accepting: boolean; active: boolean; visited: boolean; trap: boolean; inspected: boolean }, 'state'>;
function StateView({ data }: NodeProps<StateNode>) {
  return <div className={`state-node ${data.active ? 'active' : ''} ${data.visited ? 'visited' : ''} ${data.trap ? 'trap' : ''} ${data.inspected ? 'inspected' : ''}`}>
    {Object.entries({ west: Position.Left, east: Position.Right, north: Position.Top, south: Position.Bottom }).map(([key, position]) => <span key={key}><Handle type="source" id={`s-${key}`} position={position} isConnectable={false}/><Handle type="target" id={`t-${key}`} position={position} isConnectable={false}/></span>)}
    <div className={`state-circle ${data.accepting ? 'accepting' : ''}`}>{data.initial && <span className="start-arrow" aria-label="Initial state">→</span>}<span>{data.code}</span>{data.active && <span className="current-dot"/>}</div>
    <div className="state-name">{data.label}</div>
  </div>;
}
type ProtocolEdge = Edge<{ label: string; active: boolean; traversed: boolean; invalid: boolean; loop: boolean }>;
function TransitionEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data }: EdgeProps<ProtocolEdge>) {
  const [normalPath, normalX, normalY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 });
  const path = data?.loop ? `M ${sourceX} ${sourceY} C ${sourceX - 70} ${sourceY - 100}, ${targetX + 90} ${targetY - 120}, ${targetX} ${targetY}` : normalPath;
  const x = data?.loop ? sourceX + 12 : normalX;
  const y = data?.loop ? sourceY - 78 : normalY;
  return <><BaseEdge id={id} path={path} markerEnd={markerEnd} style={{stroke:data?.invalid?'#e97676':data?.active?'#62dfb1':data?.traversed?'#69aaab':'#4c5c72',strokeWidth:data?.active?3:1.4,strokeDasharray:data?.invalid?'6 5':undefined}}/><EdgeLabelRenderer><div className={`edge-label nodrag nopan ${data?.active?'active':''} ${data?.invalid?'invalid':''}`} style={{ transform:`translate(-50%, -50%) translate(${x}px,${y}px)` }}>{data?.label}</div></EdgeLabelRenderer></>;
}
const nodeTypes = { state: StateView };
const edgeTypes = { transition: TransitionEdge };
function handles(from: {x:number;y:number}, to: {x:number;y:number}) {
  if(from.x===to.x&&from.y===to.y)return ['north','east'];
  if(Math.abs(to.x-from.x)>=Math.abs(to.y-from.y))return to.x>from.x?['east','west']:['west','east'];
  return to.y>from.y?['south','north']:['north','south'];
}
export default function AutomatonView({ model, trace, current, inspected, onInspect }: { model: Protocol; trace: TraceEntry[]; current: string; inspected: string; onInspect: (id: string) => void }) {
  const nodes = useMemo<StateNode[]>(() => model.states.map((state,index) => ({id:state.id,type:'state',position:{x:state.x,y:state.y},data:{code:state.id===model.trap?'q⊥':`q${index}`,label:state.label,initial:state.id===model.initial,accepting:!!state.accepting,active:state.id===current,visited:state.id===model.initial||trace.some(t=>t.to===state.id),trap:state.id===model.trap,inspected:state.id===inspected},ariaLabel:`${state.label}${state.accepting?', accepting state':''}${state.id===current?', current state':''}`})),[model,trace,current,inspected]);
  const edges = useMemo<ProtocolEdge[]>(() => {
    const groups = new Map<string,{from:string;to:string;events:string[];invalid:boolean}>();
    for(const rule of model.transitions){const key=`${rule.from}->${rule.to}`;const group=groups.get(key)??{from:rule.from,to:rule.to,events:[],invalid:false};group.events.push(rule.event);groups.set(key,group);}
    const violation=trace.find(t=>t.violation);
    if(violation)groups.set(`invalid-${violation.from}`,{from:violation.from,to:model.trap,events:[violation.event],invalid:true});
    const last=trace.at(-1);
    return [...groups.entries()].map(([id,group])=>{
      const source=model.states.find(s=>s.id===group.from)!,target=model.states.find(s=>s.id===group.to)!;
      const [a,b]=handles(source,target);
      const active=!!last&&last.from===group.from&&last.to===group.to&&group.events.includes(last.event);
      return {id,source:group.from,target:group.to,sourceHandle:`s-${a}`,targetHandle:`t-${b}`,type:'transition',markerEnd:{type:MarkerType.ArrowClosed,color:group.invalid?'#e97676':active?'#62dfb1':'#4c5c72'},data:{label:group.events.map(id=>model.alphabet.find(e=>e.id===id)!.short).join(' / '),active,traversed:trace.some(t=>t.from===group.from&&t.to===group.to),invalid:group.invalid,loop:group.from===group.to}};
    });
  },[model,trace]);
  return <ReactFlow key={model.id} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{padding:0.2}} minZoom={0.25} maxZoom={2} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} onNodeClick={(_,node)=>onInspect(node.id)} colorMode="dark"><Background color="#263347" gap={22} size={1}/><Controls showInteractive={false}/></ReactFlow>;
}
