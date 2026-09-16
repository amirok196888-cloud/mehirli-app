-- Read the two Mehirli Cardcom values from Vault only from trusted backend
-- code. Client roles cannot execute this function.
create or replace function public.mehirli_private_config(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select secret.decrypted_secret
  from vault.decrypted_secrets as secret
  where secret.name = case p_name
    when 'cardcom_terminal_number' then 'mehirli_cardcom_terminal_number'
    when 'cardcom_api_name' then 'mehirli_cardcom_api_name'
    else null
  end
  limit 1;
$function$;

revoke all on function public.mehirli_private_config(text) from public;
revoke all on function public.mehirli_private_config(text) from anon;
revoke all on function public.mehirli_private_config(text) from authenticated;
grant execute on function public.mehirli_private_config(text) to service_role;
