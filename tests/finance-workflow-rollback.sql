begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from auth.users where mehirli_private.professional_has_service_access_v33(id) limit 1),'role','authenticated')::text,true);
set local role authenticated;
insert into public.finance_settings(professional_id,business_type,retention_version,retention_accepted_at,advance_rate,reporting_months) values(auth.uid(),'vat','2026-09-v1',now(),25,1) on conflict(professional_id) do update set retention_version=excluded.retention_version,retention_accepted_at=excluded.retention_accepted_at,reporting_months=1;
with e as(insert into public.finance_entries(kind,amount,document_date,counterparty,document_number,report_month,vat_period,vat_amount,withholding,paid_on) values('income',1180,'2031-01-10','QA workflow','QA-118','2031-01-01','2031-01-01',180,59,'2031-01-10') returning id) select set_config('qa.entry',(select id::text from e),true);
do $$ declare blocked boolean:=false;begin
 begin update public.finance_entries set review_required=false where id=current_setting('qa.entry')::uuid; exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL: documentless approval allowed';end if;
end $$;
with d as(insert into public.finance_documents(entry_id,original_name,mime_type,byte_size,sha256) values(current_setting('qa.entry')::uuid,'qa.pdf','application/pdf',100,repeat('e',64)) returning id) select set_config('qa.doc',(select id::text from d),true);
reset role;
-- Metadata-only fixture to test ledger approval; no object is written to Storage.
select set_config('request.jwt.claims',(current_setting('request.jwt.claims')::jsonb||'{"role":"service_role"}'::jsonb)::text,true);
update public.finance_documents set status='stored' where id=current_setting('qa.doc')::uuid;
select set_config('request.jwt.claims',(current_setting('request.jwt.claims')::jsonb||'{"role":"authenticated"}'::jsonb)::text,true);
set local role authenticated;
update public.finance_entries set review_required=false where id=current_setting('qa.entry')::uuid;
do $$ declare blocked boolean:=false;begin
 begin update public.finance_entries set voided=true where id=current_setting('qa.entry')::uuid;exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL: income deletion allowed';end if;
 blocked:=false;
 begin update public.finance_entries set amount=1000 where id=current_setting('qa.entry')::uuid;exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL: approved income amount changed';end if;
end $$;
select (public.finance_close_period('2031-01-01')).id is not null as closed;
do $$ declare blocked boolean:=false;begin
 begin update public.finance_entries set notes='changed' where id=current_setting('qa.entry')::uuid;exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL: closed entry mutated';end if;
 blocked:=false;
 begin insert into public.finance_entries(kind,amount,report_month) values('expense',10,'2031-01-01');exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL: backdated closed-period insert';end if;
end $$;
insert into public.finance_entries(kind,amount,document_date,counterparty,document_number,report_month,vat_amount,correction_of) values('income',-118,'2031-02-10','QA workflow','QA-119','2031-02-01',-18,current_setting('qa.entry')::uuid);
with e as(insert into public.finance_entries(kind,amount,report_month) values('expense',null,'2031-02-01') returning id) select set_config('qa.expense',(select id::text from e),true);
select public.finance_request_expense_delete(current_setting('qa.expense')::uuid)->>'id' is not null as deletion_requested;
reset role;
set local role service_role;
select public.finance_finish_expense_delete(current_setting('qa.expense')::uuid);
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.finance_entries where id=current_setting('qa.entry')::uuid) then raise exception 'FAIL: cross-account read';end if;
 if exists(select 1 from public.finance_closures where start_month='2031-01-01') then raise exception 'FAIL: cross-account snapshot read';end if;
end $$;
rollback;
