import {CASES, evaluate} from './domain.mjs';
import {aiConfigured, requestAI, AI_PUBLIC_WARNING, AI_SUMMARY_SCHEMA, validateAISummary} from './ai-provider.mjs';

// Explanation only. Only canonical fictional evidence is sent, never capture IDs or customer identity.
export async function explainEvidence(env, caseData, proposal, fetcher = fetch, now = Date.now()) {
  const deterministic = {engine: 'Deterministic demo', text: proposal.summary};
  if (!aiConfigured(env)) return deterministic;
  const fixture = CASES.find(item => item.id === caseData.id);
  if (!fixture) return {...deterministic, engine: 'Deterministic fallback', warning: AI_PUBLIC_WARNING};
  try {
    const result = await requestAI(env,
      'Explain this fictional merchant policy result in two concise sentences, at most 90 words. ' +
      'Return {"summary":"..."}. Do not set amounts, change policy, approve, or claim a refund executed.',
      {syntheticDemo: true, evidence: {items: fixture.items, warehouse: fixture.warehouse,
        daysSinceDelivery: fixture.daysSinceDelivery}, policyResult: evaluate(fixture),
        untrustedFixtureMessage: fixture.message},
      AI_SUMMARY_SCHEMA, validateAISummary, fetcher, now);
    return {engine: 'OpenRouter / ' + result.model + (result.fallbackUsed ? ' (paid fallback)' : ''),
      text: result.value.summary};
  } catch (error) {
    const diagnostic = /^AI_[A-Z_]+$/.test(error?.code || '') ? error.code : 'AI_UNAVAILABLE';
    return {...deterministic, engine: 'Deterministic fallback', warning: AI_PUBLIC_WARNING, diagnostic};
  }
}
