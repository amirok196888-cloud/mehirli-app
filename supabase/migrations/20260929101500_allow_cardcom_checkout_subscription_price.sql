-- The Cardcom checkout Edge Function reads the account's fixed subscription
-- price before creating a payment order. Keep this server-only grant limited
-- to the two columns used by that lookup.
grant select (professional_id, monthly_price)
  on table public.professional_subscriptions to service_role;
