# Protocol FSM Lab

A browser-only React + TypeScript simulator for SMTP transactions, MQTT QoS 2 exchanges, and TCP handshakes. No email, payments, or live network packets are sent.

## Run

Requires Node.js 24 or newer for the built-in TypeScript test runner. Dependencies match the user's installed Vite project.

```sh
npm install
npm run dev
```

Then open the Local URL printed by Vite. `npm run build` performs type checking and generates `dist/`; `npm test` runs model and scenario checks.

## Features

- Three documented protocol subsets and eighteen predefined scenarios.
- Interactive React Flow diagrams, accepting states, highlighted edges, zoom, and state inspection.
- Next/previous, reset, timed playback, and full-sequence execution.
- A complete transition matrix, execution trace, and formal DFA definition.
- Custom event-sequence builder and downloadable JSON traces.
- Separate outcomes for valid prefixes, incomplete input, illegal sequencing, and valid server-reported failure.

## Project setup

The simulator is integrated into the existing Vite project. Installed dependencies, Vite configuration, and TypeScript project configurations are preserved. The `test` script runs the engine tests from `tests/`, outside the browser application. A recoverable copy of the original starter files is stored in `work/starter-backup-20261011-112943/`.

## Theory and boundaries

Each protocol defines one automaton M = (Q, Σ, δ, q₀, F). Scenarios only change input strings. Diagram and matrix derive from the same model. Missing state/symbol rules lead to the absorbing trap. Acceptance is checked after all input is consumed.

SMTP models one transaction after greeting/EHLO. A valid server refusal ends in an accepting `FAILED` state: the transcript is protocol-valid although the email was not accepted. The model excludes PIPELINING, AUTH, STARTTLS, and replies not explicitly listed.

MQTT models one positive QoS 2 exchange on an established connection. Identifier checks are abstracted into matched events or `BAD_ID`; this is not a complete MQTT 5 validator.

TCP models a restricted three-way handshake, not connection teardown. Retransmission and sequence validation are assumed to occur in a hypothetical event classifier. Accepting `ESTABLISHED` means the modeled handshake completed.

A trace rejected by a restricted model is not proof of noncompliance with every feature of the full protocol. The trap rejects the analyzed trace; it does not destroy a real connection.

## Extending

Add a `Protocol` definition in `src/models/protocols.ts`: states, alphabet, explicit transition rules, initial/trap states, acceptance semantics, scope, source, and scenarios with expected results. `validateModel` checks determinism and rule references. The engine and UI remain shared.
