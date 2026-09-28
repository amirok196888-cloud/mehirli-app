-- Run after checkout uses each subscription monthly_price.
update public.platform_billing_settings set monthly_price=39,updated_at=now() where singleton=true;
