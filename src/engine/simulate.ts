import type { Protocol, Transition } from '../models/types.ts';
export type TraceEntry = { index: number; event: string; from: string; to: string; rule: Transition | null; violation: boolean; explanation: string };
export function transitionId(from: string, event: string) { return `${from}:${event}`; }
export function validateModel(model: Protocol) {
  const states = new Set(model.states.map(s => s.id));
  const symbols = new Set(model.alphabet.map(e => e.id));
  if (states.size !== model.states.length || symbols.size !== model.alphabet.length) throw new Error('Duplicate state or event');
  if (!states.has(model.initial) || !states.has(model.trap)) throw new Error('Missing initial or trap state');
  if (model.states.find(s => s.id === model.trap)?.accepting) throw new Error('Trap cannot accept');
  const rules = new Set<string>();
  for (const rule of model.transitions) {
    const key = transitionId(rule.from, rule.event);
    if (rules.has(key)) throw new Error(`Nondeterministic transition: ${key}`);
    if (!states.has(rule.from) || !states.has(rule.to) || !symbols.has(rule.event)) throw new Error(`Unknown state or symbol: ${key}`);
    if (rule.from === model.trap && rule.to !== model.trap) throw new Error('Trap must be absorbing');
    rules.add(key);
  }
}
export function simulate(model: Protocol, input: string[], count = input.length) {
  if (input.some(e => !model.alphabet.some(symbol => symbol.id === e))) throw new Error('Input contains a symbol outside the alphabet');
  const consumed = Math.max(0, Math.min(input.length, Math.floor(count)));
  let state = model.initial;
  const trace: TraceEntry[] = [];
  for (const [index, event] of input.slice(0, consumed).entries()) {
    const from = state;
    const rule = from === model.trap ? null : model.transitions.find(t => t.from === from && t.event === event) ?? null;
    state = rule?.to ?? model.trap;
    trace.push({ index, event, from, to: state, rule, violation: from !== model.trap && state === model.trap, explanation: from === model.trap ? 'The trace already entered the absorbing trap; further events cannot recover it.' : rule?.explanation ?? `There is no legal ${event} transition from ${from} in this protocol subset.` });
  }
  const current = model.states.find(s => s.id === state)!;
  const finished = consumed === input.length;
  const result: 'rejected' | 'prefix' | 'accepted' | 'incomplete' = state === model.trap ? 'rejected' : !finished ? 'prefix' : current.accepting ? 'accepted' : 'incomplete';
  return { trace, current, consumed, finished, result, firstViolation: trace.find(t => t.violation) ?? null };
}
