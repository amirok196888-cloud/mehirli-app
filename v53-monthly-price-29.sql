-- V53: monthly price for Mehirli.
-- 14-day trial stays unchanged. Each successful payment grants 30 days.
update public.platform_billing_settings
set monthly_price = 29,
    updated_at = now()
where singleton is true;
