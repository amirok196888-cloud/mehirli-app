# Mehirli WhatsApp installation link

This function sends one WhatsApp template message only when the professional voluntarily enters a phone number after seeing a clear disclosure next to the field and in the terms. No separate WhatsApp checkbox is shown; leaving the phone blank means no message. The template links to the Mehirli website; adding a home-screen icon is optional, and the website remains usable in a browser.

## Meta setup

Create and get approval for a Hebrew **Utility** template with one body text variable (`{{1}}`). Suggested copy:

> נרשמת למחירלי. אפשר להשתמש באתר גם בלי התקנה: {{1}} אם נוח לך, פתח/י את הקישור בטלפון ובחר/י ״הוספה למסך הבית״ כדי ליצור אייקון.

Then set these secrets for the Supabase Edge Function. Keep all values in Supabase secrets; never put them in the browser or repository.

- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_TEMPLATE_NAME`
- `META_WHATSAPP_TEMPLATE_LANGUAGE` (for example, `he`)
- `META_GRAPH_API_VERSION` (a currently supported version, such as `vXX.0`)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (already used by other Mehirli functions)
- `SUPABASE_PUBLISHABLE_KEYS` (already used by the shared authenticated-user helper)

The function uses the Cloud API `/{PHONE_NUMBER_ID}/messages` template endpoint. A successful response returns a WhatsApp message ID. Database delivery claims prevent duplicate sends per account.

## Delivery timing

If Supabase email confirmation is enabled, the message is sent after email verification when the customer signs in. Otherwise it is sent immediately after signup. A failed WhatsApp send does not block browser access to Mehirli.
