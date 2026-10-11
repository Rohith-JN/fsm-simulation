import test from 'node:test';
import assert from 'node:assert/strict';
import { protocols } from '../src/models/protocols.ts';
import { simulate, validateModel } from '../src/engine/simulate.ts';

for (const model of protocols) {
  test(`${model.name}: valid deterministic model`,()=>validateModel(model));
  for (const scenario of model.scenarios) {
    test(`${model.name}: ${scenario.name}`,()=>{
      const result=simulate(model,scenario.events);
      assert.equal(result.result,scenario.expected);
      assert.equal(result.trace.length,scenario.events.length);
      if(scenario.outcome)assert.equal(result.current.outcome,scenario.outcome);
      if(scenario.expected==='rejected')assert.ok(result.firstViolation);
      if(scenario.expected==='incomplete')assert.equal(result.firstViolation,null);
    });
  }
}
test('A proper prefix is not a final acceptance decision',()=>{
  const model=protocols[0];
  assert.equal(simulate(model,model.scenarios[0].events,2).result,'prefix');
  assert.equal(simulate(model,model.scenarios[0].events,0).trace.length,0);
});
test('Refusing an extra recipient preserves previously accepted recipients',()=>{
  const model=protocols[0];
  const run=simulate(model,['C_MAIL','S_250','C_RCPT','S_250','C_RCPT','S_550']);
  assert.equal(run.current.id,'RECIPIENT');
});
test('The trap is absorbing even when later events form a valid suffix',()=>{
  const model=protocols[0];
  const run=simulate(model,['C_DATA',...model.scenarios[0].events]);
  assert.equal(run.result,'rejected');
  assert.ok(run.trace.every(entry=>entry.to==='REJECT'));
});
test('Unknown symbols are validation errors, not silently accepted input',()=>assert.throws(()=>simulate(protocols[0],['NOT_IN_ALPHABET']),/outside the alphabet/));
test('Duplicate rules are rejected as nondeterministic',()=>{
  const model=protocols[0];
  assert.throws(()=>validateModel({...model,transitions:[...model.transitions,model.transitions[0]]}),/Nondeterministic/);
});
