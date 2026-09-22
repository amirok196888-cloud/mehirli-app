create or replace function public.approve_public_job_quote_v40(
  p_token uuid,
  p_consent_version text
)
returns text
language plpgsql
security definer
set search_path to 'public', 'mehirli_private', 'pg_temp'
as $function$
declare
  v_job public.pro_jobs;
  v_items jsonb;
  v_consent_text constant text := 'אני מאשר/ת שקראתי את היקף העבודה, המחיר, התוקף והתנאים המופיעים בהצעה.';
begin
  if p_consent_version <> 'quote-approval-2026-09-v1' then
    raise exception 'consent_required';
  end if;

  select *
  into v_job
  from public.pro_jobs
  where public_token = p_token
  for update;

  if v_job.id is null
     or v_job.status = 'cancelled'
     or not mehirli_private.professional_has_service_access_v33(v_job.professional_id) then
    raise exception 'quote_not_available';
  end if;

  if v_job.client_approved_at is null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'description', description,
      'quantity', quantity,
      'unit_price', unit_price,
      'line_total', quantity * unit_price,
      'sort_order', sort_order
    ) order by sort_order, created_at), '[]'::jsonb)
    into v_items
    from public.pro_job_items
    where job_id = v_job.id
      and professional_id = v_job.professional_id;

    update public.pro_jobs
    set status = case when status in ('lead', 'quoted') then 'approved' else status end,
        client_approved_at = now(),
        client_consent_at = now(),
        client_consent_version = p_consent_version,
        client_consent_text = v_consent_text,
        approved_quote_snapshot = jsonb_build_object(
          'quote_number', v_job.quote_number,
          'customer_name', v_job.customer_name,
          'description', v_job.description,
          'quote_scope', v_job.quote_scope,
          'quote_terms', v_job.quote_terms,
          'quoted_price', v_job.quoted_price,
          'subtotal', v_job.subtotal,
          'discount_type', v_job.discount_type,
          'discount_value', v_job.discount_value,
          'discount_amount', v_job.discount_amount,
          'deposit_amount', v_job.deposit_amount,
          'quote_valid_until', v_job.quote_valid_until,
          'warranty_text', v_job.warranty_text,
          'scheduled_at', v_job.scheduled_at,
          'items', v_items,
          'consent_text', v_consent_text,
          'consent_version', p_consent_version,
          'accepted_at', now()
        )
    where id = v_job.id;

    insert into public.notifications(user_id, kind, title, body, data)
    values (
      v_job.professional_id,
      'direct_quote_approved',
      'הצעת המחיר אושרה',
      v_job.customer_name || ' אישר/ה את ההצעה עבור ' || left(v_job.description, 100),
      jsonb_build_object('pro_job_id', v_job.id, 'consent_version', p_consent_version)
    );
  end if;

  return 'approved';
end;
$function$;

revoke all on function public.approve_public_job_quote_v40(uuid, text) from public;
grant execute on function public.approve_public_job_quote_v40(uuid, text) to anon, authenticated;
