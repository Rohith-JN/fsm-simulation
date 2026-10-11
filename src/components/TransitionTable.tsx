import type { Protocol } from '../models/types.ts';
import type { TraceEntry } from '../engine/simulate.ts';
export default function TransitionTable({model,last,current}:{model:Protocol;last?:TraceEntry;current:string}) {
  return <div className="table-scroll"><table className="matrix"><thead><tr><th scope="col">δ(state, event)</th>{model.alphabet.map(event=><th scope="col" key={event.id} title={event.description}>{event.short}</th>)}</tr></thead><tbody>{model.states.map(state=><tr key={state.id} className={current===state.id?'current-row':''}><th scope="row">{state.accepting?'◎ ':state.id===model.initial?'→ ':''}{state.label}</th>{model.alphabet.map(event=>{
    const rule=model.transitions.find(t=>t.from===state.id&&t.event===event.id);
    const next=state.id===model.trap?model.trap:rule?.to??model.trap;
    const active=last?.from===state.id&&last.event===event.id;
    return <td key={event.id} className={`${next===model.trap?'trap-cell':''} ${active?'active-cell':''}`} aria-label={`${state.label}, ${event.label}: ${next}`} title={rule?.explanation??'Unlisted transition: go to absorbing trap.'}>{next===model.trap?'⊥':model.states.find(s=>s.id===next)!.label}</td>;
  })}</tr>)}</tbody></table></div>;
}
