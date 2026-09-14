-- מחירלי V37 — בחירת חברת סליקה לצד קישור התשלום האישי
-- נשמרים שם החברה וקישור ציבורי בלבד. אין לשמור סיסמאות או מפתחות API.

alter table public.professional_settings
  add column if not exists payment_provider text;

alter table public.professional_settings
  drop constraint if exists professional_settings_payment_link_http;

alter table public.professional_settings
  drop constraint if exists professional_settings_payment_link_https;

alter table public.professional_settings
  add constraint professional_settings_payment_link_https
  check (payment_link is null or payment_link ~* '^https://');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'professional_settings_payment_provider_allowed'
      and conrelid = 'public.professional_settings'::regclass
  ) then
    alter table public.professional_settings
      add constraint professional_settings_payment_provider_allowed
      check (
        payment_provider is null
        or payment_provider in ('cardcom','grow','meshulam','bit','paybox','other')
      );
  end if;
end
$$;

update public.professional_settings
set payment_provider = 'other'
where payment_link is not null
  and payment_provider is null;

comment on column public.professional_settings.payment_provider is
  'Public label for the business payment-link provider; never stores credentials or API secrets.';
