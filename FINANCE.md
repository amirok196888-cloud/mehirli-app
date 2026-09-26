# Finance workspace (v117)

Access: Home → הכנסות, הוצאות ומסמכים, or Work center → כספים. Read/export remains available from the subscription screen when service access expires.

## Behavior

- Monthly cash totals use payment dates, integer agorot, approved records and signed corrections. An invoice without a payment date is not cash received/paid.
- Changes to a job's cumulative `actual_paid` generate immutable amount deltas in the ledger in the same transaction. Saving the same amount twice does not duplicate income. Users correct the payment amount in the job and can edit date/VAT/document metadata in Finance.
- Historical payments without a trustworthy payment date require review and are excluded from monthly totals until confirmed.
- Manual income is for money not already recorded in jobs; expenses can reference a job. Canceling a manual row excludes it from totals but preserves its documents and audit identity. Full-history export includes canceled rows.
- VAT is a user-confirmed estimate from entered amounts and user-assigned periods, not an automatic tax return or an automatic deduction determination. No tax rate is assumed. Exempt/unknown business types do not show a reserve estimate.
- OCR: Tesseract.js 5.1.1 / core 5.1.1, Hebrew and English, client-side one document at a time. Suggests labeled totals/VAT, date and invoice number. Names and uncertain fields require manual entry. Worker is terminated afterward. PDF is retained intact with manual data entry.
- Photos are resized to maximum 2000px and JPEG quality .88, and must be visually checked by the user. Digital originals/PDF are not rewritten. This is an auxiliary business archive, not a certified substitute for required originals.

## Storage and retention

- Private `finance-documents` bucket, 5 MiB maximum per file, 100 MiB default quota per business. Pending reservations count as 5 MiB, serialize on an owner advisory lock and expire after 24h to bound concurrent storage use.
- Consent to `2026-09-v1` is required before any upload.
- Expiry is calculated on the server as the first instant of the month 14 months after the upload month, in Asia/Jerusalem. Thus any September 2026 upload expires at 00:00 on November 1, 2027, i.e. at the end of October 31. Reads are denied after expiry even before physical cleanup.
- In-app notifications at 60/30/7 days before expiry are deduplicated. No email delivery is implied.
- A pg_cron job runs every 15 minutes. The Edge Function uses the Storage API for physical deletion and marks metadata expired only after success. Financial rows survive. Failed operations remain retryable. Pending uploads are cleared after 24h.
- The scheduled request uses a random 256-bit token in Vault. Edge verification is custom (`verify_jwt=false`); a service-role-only RPC checks the header. No credential is present in public JavaScript or the repository.
- CSV and ZIP exports apply to the current filter. All-history plus empty search exports the full archive in 20 MiB parts to limit phone memory use. Each part contains the ledger and a manifest documenting omitted/expired documents. Export never silently authorizes deletion; deletion follows the accepted time policy regardless of export.
- No cross-origin authenticated responses/documents are cached by the service worker.

## Verification

`node --test tests/finance.test.cjs` covers money precision, signed adjustments, unpaid/review exclusions, VAT approval, OCR parsing, CSV injection and ZIP generation. ZIP was independently read with Python zipfile. DOM behavior was exercised with jsdom; actual Tesseract recognition was checked on a synthetic invoice. Database tests used rollback transactions for ownership isolation, retention dates, payment deltas/idempotence, source protection, deletion of job preserving ledger, and notification deduplication. Cron invocation returned HTTP 200. No production customer records were used as test documents.

Rollout requires both included migrations, deployed `mehirli-finance-retention`, then frontend v117. Existing app design and landing marketing assets are unchanged.

## Document workflow v118 (2026-09-26)

Three tabs: income, expenses, summary. Capture/upload precedes approval. Incomplete documents can be saved as drafts (nullable amount); server approval requires a stored document, amount, counterparty and date. All preexisting unbacked records are retained but marked for review. Photos trigger local OCR; PDFs are entered manually. OCR never approves data. VAT from the document populates the expense estimate automatically, with user override.

Settings add advance percentage (unset is distinct from 0%) and one/two month periods. Summary uses user-assigned report months and approved document amounts (net of VAT for turnover); cash indicators describe paid documents assigned to that period. Withholding is distinct from revenue, reduces cash and advance estimate. Tax payment categories reduce their respective reserve rather than operating expenses. No tax eligibility classification or filing is performed.

A preview export does not close. Closing uses a per-owner transaction lock, rejects drafts/incomplete uploads and stores immutable entry/document/settings snapshots. Future writes into closed periods are blocked at the database. Closed exports use the snapshot. An income cannot be voided/reclassified; approved income amount/identity/VAT cannot be rewritten. A separate negative credit links to its original; later-period corrections remain possible. Job payment deltas go to the next open month and await documents.

Open expenses may be physically deleted through the authenticated `mehirli-finance-delete` function: owner RPC marks deletion pending, Storage API removes bytes, service-only RPC deletes metadata and row after verifying absence of storage objects. Cron retries interruptions. Owner locks serialize upload reservations/object creation with deletion and period close. No document bytes are deleted directly through SQL. Existing automatic retention continues, including for closed exports; expired originals cannot be regenerated.

**Provider integration boundary:** Existing merchant settings contain payment_provider/payment_link only. No merchant API credentials, document-list/read API or provider webhook exists. v118 does not claim automatic invoice import from those links. A provider-specific authenticated read integration remains outstanding; subscription Cardcom credentials must never be reused as customer merchant credentials.

Verification: 11 pure tests plus DOM workflow tests (three tabs, missing-document rejection, pending completion, automatic VAT fill, summaries, delete controls); `tests/finance-workflow-rollback.sql` verifies document approval gate, immutable income, close/backdate rejection, linked credits, authorized deletion and tenant isolation, all rolled back. Storage fixture is metadata-only, not an actual uploaded customer document. No authenticated browser end-to-end merchant/document test is claimed.
