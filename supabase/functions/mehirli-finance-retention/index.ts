import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(async (req: Request) => {
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const token=req.headers.get('x-finance-cron')||'';
 if(token.length!==64)return new Response('Unauthorized',{status:401});
 const auth=await db.rpc('finance_cron_authorized',{p_token:token});
 if(auth.error||auth.data!==true)return new Response('Unauthorized',{status:401});
 try {
  const notices=await db.rpc('finance_retention_notify');if(notices.error)throw notices.error;
  const now=new Date().toISOString(), stale=new Date(Date.now()-86400000).toISOString();
  const {data,error}=await db.from('finance_documents').select('id,storage_path,status').or(`and(status.eq.stored,expires_at.lte.${now}),and(status.eq.pending,uploaded_at.lte.${stale})`).order('uploaded_at').limit(100);
  if(error)throw error;
  let removed=0,failed=0;
  for(const doc of data||[]){
   // Delete the physical file through Storage API, never delete storage metadata with SQL.
   const deletion=await db.storage.from('finance-documents').remove([doc.storage_path]);
   if(deletion.error){failed++;continue;}
   const marked=await db.from('finance_documents').update({status:doc.status==='pending'?'failed':'expired',deleted_at:now}).eq('id',doc.id).eq('status',doc.status);
   if(marked.error){failed++;continue;} removed++;
  }
  return Response.json({removed,failed,notices:notices.data},{status:failed?500:200});
 } catch {return Response.json({error:'Retention job failed; retry required'},{status:500});}
});
