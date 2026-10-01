(async()=>{
 'use strict';const C=BlogCore,$=id=>document.getElementById(id),db=window.supabase.createClient(C.API,C.KEY);
 let drafts=[],published=[],selected=null,busy=false,dirty=false;
 const message=(text,error=false)=>{$('message').textContent=text;$('message').classList.toggle('error',error);};
 const fields=['title','slug','excerpt','author','content'];
 function setBusy(value){busy=value;document.querySelectorAll('button').forEach(b=>b.disabled=value);$('articleList').disabled=value;}
 function updateLinks(){const live=published.find(a=>a.id===selected);$('unpublishButton').classList.toggle('hidden',!live);$('publicLink').classList.toggle('hidden',!live);if(live)$('publicLink').href=C.BASE+'blog/article.html?slug='+encodeURIComponent(live.slug);$('slug').readOnly=!!live;}
 async function reload(){
  const [d,p]=await Promise.all([db.from('blog_drafts').select('*').order('updated_at',{ascending:false}),db.from('blog_publications').select('id,slug')]);
  if(d.error||p.error)throw new Error('לא ניתן לטעון את המאמרים. נסה שוב.');drafts=d.data;published=p.data;
  $('articleList').innerHTML='<option value="">מאמר חדש</option>'+drafts.map(a=>`<option value="${a.id}">${C.escape(a.title)} — ${published.some(p=>p.id===a.id)?'פורסם (העריכה נשמרת כטיוטה)':'טיוטה'}</option>`).join('');
  $('articleList').value=selected||'';updateLinks();
 }
 function load(id){selected=id||null;const a=drafts.find(x=>x.id===selected);fields.forEach(k=>{$(k).value=a?a[k]:k==='author'?'מערכת מחירלי':'';});dirty=false;$('preview').classList.add('hidden');updateLinks();message(a?'המאמר נטען. עריכה אינה משנה את הפרסום עד לחיצה על פרסום.':'מאמר חדש.');}
 function read(){if(!$('articleForm').reportValidity())throw new Error('מלא את השדות המסומנים.');const a=Object.fromEntries(fields.map(k=>[k,$(k).value.trim()]));if(!C.validSlug(a.slug))throw new Error('הכתובת צריכה להכיל אותיות קטנות באנגלית, מספרים ומקפים.');return a;}
 async function save(){const a=read();a.updated_at=new Date().toISOString();const query=selected?db.from('blog_drafts').update(a).eq('id',selected):db.from('blog_drafts').insert(a);const {data,error}=await query.select('id').single();if(error)throw new Error(error.code==='23505'?'הכתובת כבר בשימוש. בחר כתובת אחרת.':'שמירת הטיוטה נכשלה. התוכן נשאר בעורך.');selected=data.id;dirty=false;await reload();}
 async function action(fn){if(busy)return;setBusy(true);try{await fn();}catch(e){message(e.message,true);}finally{setBusy(false);}}
 $('articleForm').addEventListener('input',()=>dirty=true);
 $('articleForm').onsubmit=e=>{e.preventDefault();action(async()=>{await save();message('הטיוטה נשמרה.');});};
 $('articleList').onchange=async()=>{const id=$('articleList').value;if(dirty){await action(async()=>{await save();load(id);$('articleList').value=id;});}else load(id);};
 $('previewButton').onclick=()=>{try{const a=read();$('preview').innerHTML=`<h1>${C.escape(a.title)}</h1><p class="meta">${C.escape(a.author)}</p><p class="lead">${C.escape(a.excerpt)}</p>${C.render(a.content)}`;$('preview').classList.remove('hidden');$('preview').scrollIntoView({behavior:'smooth'});}catch(e){message(e.message,true);}};
 $('publishButton').onclick=()=>action(async()=>{const a=read();if(a.content.length<100)throw new Error('יש להוסיף תוכן מלא לפני הפרסום.');await save();const {error}=await db.rpc('publish_blog_article',{article_id:selected});if(error)throw new Error('הטיוטה נשמרה, אך הפרסום נכשל. נסה שוב.');await reload();message('המאמר פורסם בבלוג. אפשר לפתוח אותו בקישור למטה. עדכון מפת האתר מתבצע בנפרד.');});
 $('unpublishButton').onclick=()=>action(async()=>{const {error}=await db.from('blog_publications').delete().eq('id',selected);if(error)throw new Error('הסרת הפרסום נכשלה.');await reload();message('המאמר הוסר מהבלוג. הטיוטה נשמרה לעריכה.');});
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 try{
  const {data:{session}}=await db.auth.getSession();if(!session){message('כדי לנהל מאמרים, היכנס לחשבון המנהל במחירלי וחזור לעמוד הזה.');const link=document.createElement('a');link.className='button';link.href='../app.html';link.textContent='כניסה למחירלי';$('message').after(link);return;}
  const {data,error}=await db.from('admin_users').select('user_id').eq('user_id',session.user.id).maybeSingle();if(error||!data){message('ניהול המאמרים זמין לחשבון המנהל בלבד.',true);return;}
  await reload();$('editor').classList.remove('hidden');message('בחר מאמר או צור מאמר חדש.');
 }catch(e){message('לא ניתן לפתוח את העורך כרגע. נסה לרענן.',true);}
})();
