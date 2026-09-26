// Run with NODE_PATH pointing to @electric-sql/pglite (tested with 0.3.14).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const read=p=>fs.readFileSync(__dirname+'/../'+p,'utf8');
const migration='supabase/migrations/20260926125329_marketing_funnel_attribution.sql';
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function setup(){
 const db=new PGlite();await db.exec(`
 create role anon;create role authenticated;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select null::uuid$$;
 create function public.is_mehirli_admin() returns boolean language sql as $$select true$$;
 create table admin_users(user_id uuid);
 create table profiles(id uuid,role text,created_at timestamptz);
 create table professional_subscriptions(professional_id uuid,trial_started_at timestamptz);
 create table pro_jobs(professional_id uuid,created_at timestamptz);
 create table platform_payment_orders(professional_id uuid,status text,paid_at timestamptz,updated_at timestamptz,created_at timestamptz);
 create table app_analytics_events(visitor_id uuid,user_id uuid,event_name text,source text,campaign text,created_at timestamptz default now());
 `);await db.exec(read('v113-traffic-visits.sql'));
 if(!process.env.AUDIT_BASELINE)await db.exec(read(migration));
 return db;
}
test('verified payments survive missing browser return and map to distinct acquisition sources',async()=>{
 const db=await setup();try{
 for(const [n,source] of [[1,'google_paid'],[2,'facebook_paid']]){
 await db.query(`insert into app_analytics_events values ($1,$2,'account_active',$3,'launch',now()-interval '40 days')`,[uid(n),uid(n+10),source]);
 await db.query(`insert into platform_payment_orders values ($1,'paid',now(),now(),now())`,[uid(n+10)]);
 }
 // Repeat orders and an admin purchase must not inflate paying customers.
 await db.query(`insert into platform_payment_orders values ($1,'paid',now(),now(),now()),($2,'paid',now(),now(),now())`,[uid(11),uid(99)]);
 await db.query(`insert into admin_users values ($1)`,[uid(99)]);
 // A client event without a verified order is not a paying customer.
 await db.query(`insert into app_analytics_events values ($1,null,'payment_completed','google_paid','',now())`,[uid(3)]);
 const result=(await db.query(`select admin_marketing_summary_v113('today') data`)).rows[0].data;
 assert.equal(result.paying_customers,2);
 for(const label of ['גוגל — ממומן','פייסבוק — ממומן'])assert.equal(result.source_breakdown.find(x=>x.source===label)?.paying_customers,1,label);
 }finally{await db.close()}
});
test('repeat jobs are not first jobs; signups do not invent CTA clicks',async()=>{
 const db=await setup();try{
 await db.query(`insert into pro_jobs values ($1,now()-interval '40 days'),($1,now()),($2,now())`,[uid(11),uid(12)]);
 await db.query(`insert into profiles values ($1,'professional',now())`,[uid(12)]);
 await db.query(`insert into professional_subscriptions values ($1,now())`,[uid(12)]);
 await db.query(`insert into app_analytics_events values ($1,$2,'first_job_created','google_paid','',now()),($3,$4,'first_job_created','facebook_paid','',now())`,[uid(1),uid(11),uid(2),uid(12)]);
 const result=(await db.query(`select admin_marketing_summary_v113('today') data`)).rows[0].data;
 assert.equal(result.first_jobs,1);assert.equal(result.trial_clicks,0);assert.equal(result.trial_signups,1);
 assert.equal(result.source_breakdown.find(x=>x.source==='פייסבוק — ממומן')?.first_jobs,1);
 }finally{await db.close()}
});
test('late trial activation is not a new signup; unknown verified payers remain visible in every range',async()=>{
 const db=await setup();try{
 await db.query(`insert into profiles values ($1,'professional',now()-interval '40 days');`,[uid(11)]);
 await db.query(`insert into professional_subscriptions values ($1,now());`,[uid(11)]);
 await db.query(`insert into platform_payment_orders values ($1,'paid',now(),now(),now()),($2,'failed',null,now(),now())`,[uid(11),uid(12)]);
 for(const range of ['today','30d','all']){
 const r=(await db.query(`select admin_marketing_summary_v113($1) data`,[range])).rows[0].data;
 assert.equal(r.trial_signups,range==='all'?1:0);assert.equal(r.trial_clicks,0);assert.equal(r.paying_customers,1);
 assert.equal(r.source_breakdown.find(x=>x.source==='ישיר / מקור לא מזוהה')?.paying_customers,1);
 }
 await db.exec(`create or replace function public.is_mehirli_admin() returns boolean language sql as $$select false$$`);
 await assert.rejects(db.query(`select admin_marketing_summary_v113('all')`),/not_admin/);
 assert.equal((await db.query(`select has_function_privilege('anon','public.admin_marketing_summary_v113(text)','EXECUTE') allowed`)).rows[0].allowed,false);
 }finally{await db.close()}
});
