# Mehirli WhatsApp installation link

This function sends one WhatsApp template message when the user enters a phone number and accepts the linked terms. The signup form shows one terms/privacy checkbox; the WhatsApp consent sentence is inside the terms, not beside the phone field. The template links directly to app.html. The website remains usable in a browser without adding a home-screen icon.

## Meta setup

Create and get approval for a Hebrew **Utility** template with one body text variable (`{{1}}`). Suggested copy:

> ההרשמה למחירלי הושלמה. לכניסה למחירלי ולהוספת קיצור דרך למסך הבית: {{1}} אפשר להשתמש גם דרך הדפדפן.

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
