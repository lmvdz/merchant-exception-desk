import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES, evaluate} from '../server/domain.mjs';
import {explainEvidence} from '../server/ai.mjs';
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
  assert.equal(result.text, proposal.summary);
  assert.equal(proposal.amountCents, 2400);
  assert.ok(!result.warning.includes('mock-key'));
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
    assert.equal(calls, 1);
    const rejected = await call({action: 'approve', caseId: 'EX-1044', mode: 'demo', amountCents: 12000, approved: true});
    assert.equal(rejected.status, 400);
    const state = await (await worker.fetch(new Request('http://fixture.test/api/desk', {headers: {cookie}}), env)).json();
    assert.equal(state.operations.length, 0);
    assert.ok(!JSON.stringify(state).includes('mock-key'));
  } finally { globalThis.fetch = original; db.close(); }
});
