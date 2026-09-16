-- Allow the trusted billing Edge Functions to read billing/profile data and
-- create/update Cardcom payment orders. RLS remains enabled for client roles.
grant select on table public.admin_users to service_role;
grant select on table public.platform_billing_settings to service_role;
grant select on table public.business_profiles to service_role;
grant select on table public.profiles to service_role;
grant select, insert, update on table public.platform_payment_orders to service_role;
