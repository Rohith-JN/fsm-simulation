export type State = { id: string; label: string; description: string; x: number; y: number; accepting?: boolean; outcome?: 'success' | 'failure' };
export type Event = { id: string; label: string; short: string; direction: string; description: string };
export type Transition = { from: string; event: string; to: string; explanation: string };
export type Scenario = { id: string; name: string; category: 'success' | 'recovery' | 'violation' | 'incomplete' | 'failure'; description: string; events: string[]; expected: 'accepted' | 'rejected' | 'incomplete'; outcome?: 'success' | 'failure' };
export type Protocol = { id: string; name: string; subtitle: string; scope: string; acceptance: string; source: string; initial: string; trap: string; states: State[]; alphabet: Event[]; transitions: Transition[]; scenarios: Scenario[] };
