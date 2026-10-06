# Verification evidence

Evidence snapshot: 2026-10-05T22:27:54.719Z. The amounts below use PayPal sandbox test funds and fictional task data. They do not represent production payments or fulfillment.

## Hosted principal outcome

The protected workspace analyzed EX-1042, proposed the deterministic $34 missing-item amount, accepted explicit approval, executed the refund and reconciled it. The $198 capture is now PARTIALLY_REFUNDED.

| Provider resource | ID | Status | USD |
| --- | --- | --- | --- |
| Capture | 88591886Y9752854H | PARTIALLY_REFUNDED | 198.00 |
| Refund | 4JG61247F4202902A | COMPLETED | 34.00 |

Repeated approval and reconciliation returned the same refund and original request identifier. The ledger held one operation. The wallet approval/return UI was not exercised; the capture used PayPal's published sandbox test card.

## AI and browser evidence

The hosted API returned schema-validated responses from liquid/lfm-2.5-2.6b:free with zero reported cost and paid fallback disabled. These calls use built-in synthetic input only. Model explanations and extraction remain subordinate to local pricing, policy and explicit approval. Schema validity alone does not establish factual faithfulness.

GitHub Actions runs build the source and exercise local fixture browser workflows, desktop/390px/320px rendering, keyboard access, reduced motion, graphics/no-JavaScript fallbacks, the scroll seam and axe checks. The workflow artifacts identify the source revision and tested states. These local fixture results are separate from the hosted PayPal results above, and do not certify accessibility or production reliability.

## Remaining submission gates

Final independent design and submission review, a public English YouTube demonstration below three minutes, verified free judge access and entrant registration/eligibility remain open. No measured customer ROI, real inventory/fulfillment integration or production readiness is claimed.

## Bounded prompt refinement

The model now receives fulfillment evidence for a short evidence-only summary; the application supplies policy, approval and payment status separately. In one fixed run of three canonical merchant cases, two model summaries were retained. The third correctly described zero delivered items but triggered the unchanged conservative guard and used local fallback. One initial transport timeout used the normal retry; its usage was unreported. The three successful responses reported zero cost. This small synthetic check does not establish arbitrary-prose accuracy.
