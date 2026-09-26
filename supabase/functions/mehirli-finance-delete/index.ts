import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const url=Deno.env.get('SUPABASE_URL')!;
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={'Access-Control-Allow-Origin':'https://amirok196888-cloud.github.io','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const authorization=req.headers.get('Authorization')||'';
 if(!authorization.startsWith('Bearer '))return reply({error:'Unauthorized'},401);
 const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const user=await client.auth.getUser();if(user.error||!user.data.user)return reply({error:'Unauthorized'},401);
 let id;try{id=(await req.json()).entry_id;}catch{return reply({error:'Invalid request'},400);}
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return reply({error:'Invalid entry'},400);
 const started=await client.rpc('finance_request_expense_delete',{p_id:id});
 if(started.error)return reply({error:started.error.message},409);
 // Entry is now excluded and cannot be closed/edited. Cleanup is retryable by cron.
 for(const doc of started.data.documents||[]){const r=await admin.storage.from('finance-documents').remove([doc.path]);if(r.error)return reply({pending:true});}
 const done=await admin.rpc('finance_finish_expense_delete',{p_id:id});
 return reply({pending:!!done.error});
});
