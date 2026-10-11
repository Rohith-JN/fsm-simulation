import { useEffect, useMemo, useState } from 'react';
import { protocols } from './models/protocols.ts';
import { simulate, validateModel } from './engine/simulate.ts';
import AutomatonView from './components/AutomatonView.tsx';
import TransitionTable from './components/TransitionTable.tsx';
import type { Scenario } from './models/types.ts';

protocols.forEach(validateModel);
const categoryNames: Record<Scenario['category'],string> = {success:'Success',recovery:'Recovery',violation:'Violation',incomplete:'Incomplete',failure:'Server failure'};
const resultNames = {accepted:'Accepted',rejected:'Rejected',incomplete:'Incomplete',prefix:'Valid prefix'};
export default function App() {
  const [protocolId,setProtocolId]=useState('smtp');
  const model=protocols.find(p=>p.id===protocolId)!;
  const [scenarioId,setScenarioId]=useState('success');
  const scenario=model.scenarios.find(s=>s.id===scenarioId)??model.scenarios[0];
  const [custom,setCustom]=useState(false);
  const [customEvents,setCustomEvents]=useState<string[]>([]);
  const [builderEvent,setBuilderEvent]=useState(model.alphabet[0].id);
  const [step,setStep]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [inspected,setInspected]=useState('READY');
  const [tab,setTab]=useState<'table'|'trace'|'formal'>('table');
  const events=custom?customEvents:scenario.events;
  const run=useMemo(()=>simulate(model,events,step),[model,events,step]);
  const last=run.trace.at(-1);
  const inspectedState=model.states.find(s=>s.id===inspected)??run.current;
  useEffect(()=>{
    if(!playing)return;
    const timer=window.setTimeout(()=>{const next=Math.min(step+1,events.length);setStep(next);if(next>=events.length)setPlaying(false);},900);
    return ()=>window.clearTimeout(timer);
  },[playing,events.length,step]);
  function selectProtocol(id:string){const next=protocols.find(p=>p.id===id)!;setProtocolId(id);setScenarioId(next.scenarios[0].id);setCustom(false);setCustomEvents([]);setBuilderEvent(next.alphabet[0].id);setStep(0);setPlaying(false);setInspected(next.initial);}
  function selectScenario(id:string){setScenarioId(id);setCustom(false);setStep(0);setPlaying(false);setInspected(model.initial);}
  function jump(n:number){setPlaying(false);setStep(Math.max(0,Math.min(events.length,n)));}
  function startCustom(){setCustom(true);setCustomEvents([...events]);setStep(0);setPlaying(false);}
  function editSequence(next:string[]){setCustomEvents(next);setStep(0);setPlaying(false);}
  function exportTrace(){const blob=new Blob([JSON.stringify({protocol:model.id,scope:model.scope,scenario:custom?'Custom sequence':scenario.name,input:events,consumed:run.consumed,result:run.result,currentState:run.current.id,trace:run.trace},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${model.id}-trace.json`;a.click();URL.revokeObjectURL(url);}
  const notice=run.result==='rejected'?`Event ${run.firstViolation!.index+1} entered the trap. ${run.firstViolation!.explanation}`:run.result==='accepted'?(run.current.outcome==='failure'?'The event order is valid, but the server refused the transaction. Protocol acceptance does not mean application success.':'All input was consumed and the run ends in an accepting state.'):run.result==='incomplete'?'The input ends in a non-accepting state. No illegal transition occurred, but the modeled exchange is unfinished.':'The sequence is still being read. A valid prefix is not yet a final acceptance decision.';
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#main"><span className="brand-mark">δ</span><span>Protocol <strong>FSM Lab</strong></span></a><div className="topbar-note"><span className="status-dot"/>Browser simulation<span className="topbar-separator">/</span>Theory of Computation</div></header>
    <div className="workspace">
      <aside className="sidebar">
        <div className="section-caption">01 / CHOOSE A PROTOCOL</div>
        <nav className="protocol-tabs" aria-label="Protocol">{protocols.map(p=><button type="button" key={p.id} aria-pressed={p.id===protocolId} onClick={()=>selectProtocol(p.id)}>{p.name}</button>)}</nav>
        <p className="sidebar-subtitle">{model.subtitle}</p>
        <div className="sidebar-heading"><span className="section-caption">02 / SELECT A SCENARIO</span><span className="small-count">{model.scenarios.length}</span></div>
        <div className="scenario-list">{model.scenarios.map(s=><button type="button" key={s.id} className={`scenario-card ${!custom&&scenario.id===s.id?'selected':''}`} aria-pressed={!custom&&scenario.id===s.id} onClick={()=>selectScenario(s.id)}><span className={`category ${s.category}`}>{categoryNames[s.category]}</span><span className="scenario-name">{s.name}</span><span className="scenario-count">{s.events.length} events</span></button>)}</div>
        <button type="button" className={`custom-button ${custom?'selected':''}`} onClick={startCustom}>＋ Build your own sequence</button>
        <div className="scope-note"><span className="section-caption">MODEL BOUNDARY</span><p>{model.scope}</p><a href={model.source} target="_blank" rel="noreferrer">Read protocol specification ↗</a></div>
      </aside>
      <main id="main">
        <div className="page-heading"><div><div className="eyebrow">EXPLORE THE RULES BEHIND THE CONNECTION</div><h1>{custom?'Your sequence':scenario.name}</h1><p>{custom?'Arrange symbols from the protocol alphabet and test the resulting string.':scenario.description}</p></div><span className="model-badge">{model.name} MODEL</span></div>
        <section className="simulation" aria-label="Automaton simulator">
          <div className="panel-heading"><h2>Automaton</h2><span className="graph-hint">Drag to pan · scroll to zoom · select a state</span></div>
          <div className="graph-layout"><div className="graph-canvas"><AutomatonView model={model} trace={run.trace} current={run.current.id} inspected={inspected} onInspect={setInspected}/><div className="graph-legend"><span><i className="legend-active"/>Current</span><span>◎ Accepting</span><span>→ Initial</span><span>⊥ Trap</span></div></div>
            <aside className="inspector"><div className="section-caption">CURRENT STATE</div><div className={`current-state ${run.current.id===model.trap?'error':''}`}>{run.current.label}</div><p>{run.current.description}</p><hr/><div className="section-caption">SELECTED STATE</div><h3>{inspectedState.label}</h3><p>{inspectedState.description}</p><div className="inspector-transitions">{model.transitions.filter(t=>t.from===inspectedState.id).map(t=><div key={t.event}><code>{model.alphabet.find(e=>e.id===t.event)!.short}</code><span>→ {model.states.find(s=>s.id===t.to)!.label}</span></div>)}</div><p className="default-rule">{inspectedState.id===model.trap?'All symbols remain in the trap.':'All unlisted symbols lead to the trap.'}</p></aside>
          </div>
          <div className="sequence-section"><div className="sequence-heading"><span className="section-caption">INPUT STRING</span><span className="sequence-count">{step} / {events.length} consumed</span></div>
            <div className="sequence-tokens">{events.length?events.map((event,index)=>{const symbol=model.alphabet.find(e=>e.id===event)!;return <button type="button" key={`${index}-${event}`} className={`event-token ${index<step?'consumed':''} ${index===step-1?'latest':''} ${run.firstViolation?.index===index?'invalid':''}`} onClick={()=>jump(index+1)} title={`${symbol.direction}: ${symbol.label}`} aria-label={`Consume through event ${index+1}: ${symbol.label}`}><span>{index+1}</span>{symbol.short}</button>;}):<span className="empty-sequence">Empty string ε — add an event to begin.</span>}</div>
            {custom&&<div className="builder"><label htmlFor="builder-symbol">Append a symbol</label><select id="builder-symbol" value={builderEvent} onChange={e=>setBuilderEvent(e.target.value)}>{model.alphabet.map(e=><option value={e.id} key={e.id}>{e.id} — {e.label}</option>)}</select><button type="button" onClick={()=>editSequence([...customEvents,builderEvent])}>Add event</button><button type="button" disabled={!customEvents.length} onClick={()=>editSequence(customEvents.slice(0,-1))}>Remove last</button><button type="button" disabled={!customEvents.length} onClick={()=>editSequence([])}>Clear</button></div>}
          </div>
          <div className="playback"><div className="playback-actions"><button type="button" className="quiet" onClick={()=>jump(0)} disabled={step===0}>↺ Reset</button><button type="button" onClick={()=>jump(step-1)} disabled={step===0}>← Previous</button><button type="button" className="play-button" onClick={()=>{if(playing)setPlaying(false);else{if(step>=events.length)setStep(0);setPlaying(true);}}} disabled={!events.length}>{playing?'Ⅱ Pause':'▶ Play'}</button><button type="button" onClick={()=>jump(step+1)} disabled={step>=events.length}>Next →</button><button type="button" className="quiet" onClick={()=>jump(events.length)} disabled={step>=events.length}>Run all ⇥</button></div><button type="button" className="export-button" onClick={exportTrace}>Export trace ↓</button></div>
          <div className={`result-strip ${run.result} ${run.current.outcome==='failure'?'server-failure':''}`} aria-live="polite"><span className="result-label">{run.result==='accepted'&&run.current.outcome==='failure'?'Accepted · server refusal':resultNames[run.result]}</span><span>{notice}</span></div>
        </section>
        <section className="details-panel"><div className="details-tabs" role="tablist" aria-label="Simulator details">{(['table','trace','formal'] as const).map(id=><button type="button" role="tab" key={id} id={`tab-${id}`} aria-controls="detail-content" aria-selected={tab===id} onClick={()=>setTab(id)}>{id==='table'?'Transition table':id==='trace'?'Execution trace':'Formal definition'}{id==='trace'&&<span>{run.trace.length}</span>}</button>)}</div>
          <div id="detail-content" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab==='table'&&<><p className="table-caption">One shared rule table for every scenario. The last applied cell is highlighted; ⊥ is the default rejecting transition.</p><TransitionTable model={model} last={last} current={run.current.id}/></>}
            {tab==='trace'&&<div className="table-scroll"><table className="trace-table"><thead><tr><th>Step</th><th>Observed event</th><th>Transition</th><th>Explanation</th></tr></thead><tbody>{run.trace.map(entry=>{const event=model.alphabet.find(e=>e.id===entry.event)!;return <tr key={entry.index} className={entry.to===model.trap?'trace-rejected':''}><td>{String(entry.index+1).padStart(2,'0')}</td><td><strong>{event.label}</strong><small>{event.direction} · {event.id}</small></td><td><code>{entry.from}</code><span> → </span><code>{entry.to}</code></td><td>{entry.explanation}</td></tr>;})}</tbody></table>{!run.trace.length&&<p className="empty-trace">Step through the sequence to see the decisions here.</p>}</div>}
            {tab==='formal'&&<div className="formal"><h3>M = (Q, Σ, δ, q₀, F)</h3><dl><dt>Q · states</dt><dd>{model.states.map(s=>s.id).join(', ')}</dd><dt>Σ · alphabet</dt><dd>{model.alphabet.map(e=>e.id).join(', ')}</dd><dt>q₀ · initial state</dt><dd>{model.initial}</dd><dt>F · accepting states</dt><dd>{model.states.filter(s=>s.accepting).map(s=>s.id).join(', ')}</dd><dt>δ · transition function</dt><dd>The transition table defines all state/symbol pairs. Unlisted pairs lead to REJECT, which loops on every symbol.</dd></dl><p>{model.acceptance}</p><p className="formal-boundary">A rejected input violates this specified subset; it is not proof of noncompliance with every feature of the full protocol. No live connections or messages are sent.</p><h3>Symbol classification</h3>{model.alphabet.map(e=><div className="symbol-definition" key={e.id}><code>{e.id}</code><span>{e.description}</span></div>)}</div>}
          </div>
        </section>
        <footer className="app-footer"><span>Protocol FSM Lab</span><span>Same automaton. Different input strings. Different runs.</span></footer>
      </main>
    </div>
  </div>;
}
