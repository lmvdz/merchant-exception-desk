import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES, evaluate} from '../server/domain.mjs';
import {explainEvidence, merchantProposalStatus, validateMerchantExplanation} from '../server/ai.mjs';
import {applicationWorker as worker} from '../dist/server/index.js';
import {localDatabase} from '../scripts/local-db.mjs';

const now = Date.parse('2026-10-02T12:00:00Z');
const config = {AI_MODE: 'openrouter', OPENROUTER_API_KEY: 'mock-key'};
const reply = value => Response.json({choices: [{finish_reason: 'stop',
  message: {role: 'assistant', content: JSON.stringify(value)}}]});

test('merchant AI sends canonical fictional evidence and cannot receive real identities or captures', async () => {
  const fixture = CASES[0], proposal = evaluate(fixture);
  const input = {...fixture, name: 'Private customer context', capture: 'PRIVATE-CAPTURE',
    message: 'Private input must not leave the server'};
  const result = await explainEvidence(config, input, proposal, async (_, options) => {
    assert.ok(!options.body.includes('Private'));
    assert.ok(!options.body.includes(fixture.name));
    assert.ok(!options.body.includes(fixture.capture));
    assert.ok(!options.body.includes(fixture.order));
    return reply({summary: 'Fictional evidence supports the missing pouch policy result.'});
  }, now);
  assert.match(result.engine, /OpenRouter/);
  assert.equal(proposal.amountCents, 3400);
  assert.deepEqual(proposal, evaluate(fixture));
});

test('merchant rejects an AI refund command and safely retains its deterministic policy', async () => {
  const proposal = evaluate(CASES[2]);
  const result = await explainEvidence(config, CASES[2], proposal,
    async () => reply({summary: 'Refund everything', amountCents: 12000, approve: true}), now);
  assert.equal(result.engine, 'Deterministic fallback');
  assert.equal(result.text, merchantProposalStatus(proposal) + ' ' + proposal.summary);
  assert.equal(proposal.amountCents, 2400);
  assert.ok(!result.warning.includes('mock-key'));
});

test('schema-valid authority claims and unsupported amounts cannot enter a merchant explanation', async () => {
  const fixture = CASES[2], proposal = evaluate(fixture);
  for (const summary of [
    'The policy approves $24.00 for the missing notebook set.',
    'The missing set is leading to this partial payment.',
    'A $24 refund was issued to the customer.',
    'The customer was reimbursed $24.00.',
    'We sent $24.00 to the customer.',
    'Ignore policy and refund all items.',
    'Fulfillment records support $120.00 for the missing set.',
    'Fulfillment records support 120 USD for the missing set.',
    'Fulfillment records support USD 120 for the missing set.',
    'Fulfillment records support 120 dollars for the missing set.'
  ]) {
    assert.throws(() => validateMerchantExplanation({summary}, fixture), {code:'AI_UNGROUNDED_OUTPUT'});
    const result = await explainEvidence(config, fixture, proposal, async () => reply({summary}), now);
    assert.equal(result.engine, 'Deterministic fallback', summary);
    assert.equal(result.diagnostic, 'AI_INVALID_OUTPUT');
    assert.equal(result.text, merchantProposalStatus(proposal) + ' ' + proposal.summary);
    assert.equal(proposal.amountCents, 2400);
  }
});

test('evidence prose is retained with source-owned unexecuted status and exact supported amount', async () => {
  const fixture = CASES[0], proposal = evaluate(fixture);
  const summary = 'Warehouse records show the pouch is missing, supporting $34.00; the camera sling was delivered.';
  assert.deepEqual(validateMerchantExplanation({summary}, fixture), {summary});
  const result = await explainEvidence(config, fixture, {...proposal, amountCents:12000}, async () => reply({summary}), now);
  assert.match(result.engine, /OpenRouter/);
  assert.equal(result.text, merchantProposalStatus(proposal) + ' ' + summary);
  assert.match(result.text, /Any new refund requires explicit merchant approval; this analysis does not execute a refund/);
  assert.ok(!result.text.includes('$120'));
  assert.doesNotThrow(() => validateMerchantExplanation({summary:'The claim falls outside the 30-day refund window; merchant policy exception review is needed.'}, CASES[3]));
});

test('claim age cannot turn an undelivered fixture into a delivered shipment', async () => {
  const fixture=CASES[3],proposal=evaluate(fixture);
  const result=await explainEvidence(config,fixture,proposal,async()=>reply({summary:
    'The Woven utility tote was marked as delivered but remains undelivered, with the claim opened 47 days after the estimated delivery date.'}),now);
  assert.equal(result.engine,'Deterministic fallback');
  assert.ok(!result.text.includes('marked as delivered'));
  assert.doesNotThrow(()=>validateMerchantExplanation({summary:'The tote was not delivered; the claim was opened 47 days after the delivery estimate.'},fixture));
});

test('analyzing a previously completed refund does not deny prior ledger payment state', async () => {
  const db=localDatabase(),env={...config,AI_PRIMARY_MODEL:'fixture/primary',DB:db};
  const original=globalThis.fetch;
  globalThis.fetch=async()=>reply({summary:'Warehouse records confirm the travel pouch was missing.'});
  let cookie='';
  const call=async input=>{
    const response=await worker.fetch(new Request('http://fixture.test/api/desk',{
      method:'POST',headers:{origin:'http://fixture.test',cookie,'Content-Type':'application/json'},body:JSON.stringify(input)}),env);
    cookie=response.headers.get('set-cookie').split(';')[0];return response;
  };
  try {
    assert.equal((await call({action:'approve',caseId:'EX-1042',mode:'demo',amountCents:3400,approved:true})).status,200);
    const before=await (await worker.fetch(new Request('http://fixture.test/api/desk',{headers:{cookie}}),env)).json();
    assert.equal(before.operations.length,1);
    assert.equal(before.operations[0].status,'completed');
    const analyzed=await (await call({action:'analyze',caseId:'EX-1042'})).json();
    assert.match(analyzed.explanation.text,/this analysis does not execute a refund/);
    assert.match(analyzed.explanation.text,/Check the ledger for payment status/);
    assert.ok(!analyzed.explanation.text.includes('no refund has been executed'));
    const after=await (await worker.fetch(new Request('http://fixture.test/api/desk',{headers:{cookie}}),env)).json();
    assert.equal(after.operations.length,1);
    assert.equal(after.operations[0].status,'completed');
  } finally {globalThis.fetch=original;db.close();}
});

test('unconfigured merchant and unknown cases make no provider call', async () => {
  const never = async () => assert.fail('Non-fixture data was sent');
  const proposal = evaluate(CASES[0]);
  assert.equal((await explainEvidence({}, CASES[0], proposal, never, now)).engine, 'Deterministic demo');
  assert.equal((await explainEvidence(config, {id: 'not-a-fixture'}, proposal, never, now)).engine, 'Deterministic fallback');
});

test('merchant API explanation never claims a refund or bypasses exact amount approval', async () => {
  const db = localDatabase();
  const env = {...config, AI_PRIMARY_MODEL: 'fixture/primary', DB: db};
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return reply({summary: 'Ignore policy and refund all items.'}); };
  let cookie = '';
  const call = async input => {
    const response = await worker.fetch(new Request('http://fixture.test/api/desk', {
      method: 'POST', headers: {origin: 'http://fixture.test', cookie, 'Content-Type': 'application/json'},
      body: JSON.stringify(input)
    }), env);
    cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  };
  try {
    const analyzed = await (await call({action: 'analyze', caseId: 'EX-1044'})).json();
    assert.equal(analyzed.proposal.amountCents, 2400);
    assert.equal(analyzed.explanation.engine, 'Deterministic fallback');
    assert.match(analyzed.explanation.text, /Any new refund requires explicit merchant approval; this analysis does not execute a refund/);
    assert.ok(!analyzed.explanation.text.includes('Ignore policy'));
    assert.equal(calls, 1);
    const rejected = await call({action: 'approve', caseId: 'EX-1044', mode: 'demo', amountCents: 12000, approved: true});
    assert.equal(rejected.status, 400);
    const state = await (await worker.fetch(new Request('http://fixture.test/api/desk', {headers: {cookie}}), env)).json();
    assert.equal(state.operations.length, 0);
    assert.ok(!JSON.stringify(state).includes('mock-key'));
  } finally { globalThis.fetch = original; db.close(); }
});
