-- 60-day Mehirli trial: starts after the PWA install step, as enforced by activate_my_trial_after_install_v70.
-- Expired trials are suspended automatically every 15 minutes. Application access is already gated by professional_has_service_access_v33.
update public.platform_billing_settings
   set trial_days = 60,
       updated_at = now()
 where singleton = true;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'mehirli-trial-expiry'
  ) then
    perform cron.schedule(
      'mehirli-trial-expiry',
      '*/15 * * * *',
      $job$
        update public.professional_subscriptions
           set status = 'suspended',
               failure_reason = 'תקופת הניסיון הסתיימה',
               updated_at = now()
         where status = 'trial'
           and trial_ends_at is not null
           and trial_ends_at < now();
      $job$
    );
  end if;
end;
$$;
