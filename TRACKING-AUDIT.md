# Marketing attribution audit — 26 September 2026

Audited main: `520f04a947c44770404464739448a54287bc4f7a`.

## Landing changes

`5125cdc1465f5bf29ff3070bb568d8003cfec7c1` changes landing text, spacing and FAQ expansion. `520f04a947c44770404464739448a54287bc4f7a` changes the video frame and stylesheet version. Neither changes the CTA listeners, CTA attributes, query forwarding or traffic module. Both current CTAs execute `landing_cta_click` before navigation, with a 700 ms navigation ceiling. The tests execute the current HTML's actual inline script and both handlers.

Landing copy and layout are preserved. Changes to index.html are limited to attribution handoff and the traffic script version.

## Trace and findings

| Stage | Main behavior | Patch |
| --- | --- | --- |
| Landing visit | traffic.js resolves click IDs, UTMs and referrer; track_visit_v113 counts a 30-minute visit; landing_page_view records browser activity. | Classification and visit timeout unchanged. |
| CTA | Hero and bottom CTAs forward incoming query parameters and emit landing_cta_click. Chrome intent has a separate storage context. | Carry resolved source/campaign into the Chrome intent when attribution came only from a referrer. |
| Signup | signup_attempt precedes signUp; successful new signup emits trial_signup; authenticated account_active links visitor ID to account. | Acquisition stored separately from sessionStorage, surviving expiry/new tabs. Late installation/trial activation is no longer used as the registration date fallback. |
| First job | Every successful job save emits first_job_created. Main summary also counts every account with any job in the selected period. | Summary uses the earliest retained job per account, so repeat jobs are not new activations. Source cards expose first_jobs. |
| Payment | payment_started precedes checkout. Cardcom webhook verifies the result and marks the order paid. Browser emits payment_completed only after return/polling. | Summary uses verified paid orders, deduplicated by account and excluding admins. Historical authenticated visitor links recover first known source even without a browser return. Unattributed verified orders stay in the unknown bucket. |
| Admin | v113 provides separate Hebrew Google/Facebook paid/organic/unknown labels and visit groups. Source cards omit payer counts. Click count is raised to signup count. | Keep separate source cards; show first jobs and verified payers; count observed clicks without inventing missing events. |

## Attribution and reporting semantics

- Visit rows and page/CTA events retain the current visit's source. A new campaign still starts a new visit.
- Lifecycle events retain the browser's first known non-direct acquisition in localStorage; a prior direct-only acquisition can be upgraded. This lasts until browser storage is cleared.
- First-job and payment source totals use the account's earliest known non-direct event across authenticated browser links, falling back to direct/unknown. Acquisition may predate the selected reporting period.
- Visitor, click and signup source rows remain browser activity in the selected window. First-job/payment counts are account activity, not a strict same-period cohort conversion rate. Existing percentage fields retain their period-activity interpretation.
- Browser changes can create another visitor ID. The Chrome handoff preserves source/campaign, not a cross-browser identity. Blocked/cleared storage or missing historical events cannot be reconstructed reliably.
- Signup events remain browser-reported; the total has a professional-profile fallback. Source signup counts can be lower when analytics was blocked. No historical click events are fabricated.
- First-job reporting uses retained pro_jobs history: deleting all earlier jobs removes that evidence.

## Validation

Run `npm ci && npm run test:tracking` (Node 20+). PGlite 0.3.14 is pinned for isolated PostgreSQL execution; no production events, accounts, jobs or charges are created.

The suite covers 11 source-classification scenarios, visit expiry/source changes, exclusions, retry and blocked storage; acquisition persistence; both real landing CTA handlers; Chrome handoff; separate rendered Google/Facebook cards; verified payments without browser return; duplicate orders; admin exclusion; repeat jobs; delayed activation; unknown payers; all three report ranges; and admin-only RPC access.

Baseline failures were reproduced before patching: acquisition became direct after expiry, referrer-only Chrome intent omitted source, payment totals included an admin, and repeat jobs counted as first jobs. The final suite passes all 9 test groups.

## Rollout

Apply `supabase/migrations/20260926125329_marketing_funnel_attribution.sql` to the existing v113 schema, then release the frontend assets. The RPC name and existing response fields are preserved; first_jobs is added to source rows. The migration replaces only the existing admin summary, retains its admin check and grants, and adds no public data access. Traffic/app cache versions are bumped to 124.

This audit validates repository code and isolated fixtures. It does not attest that production has applied the migration or that real provider events are being delivered. No production deployment or database mutation was performed by this audit.
