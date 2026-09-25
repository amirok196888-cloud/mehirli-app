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
