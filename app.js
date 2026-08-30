const SUPABASE_URL='https://jgnbcrlvsudfqfofmvlx.supabase.co';
const SUPABASE_KEY='sb_publishable_WnOhGZSlik7zqpO-cRYGvA_lOUz68Wp';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={user:null,profile:null,role:'customer',credits:0,requests:[],offers:[],jobs:[],selectedRequest:null,selectedJob:null,isAdmin:false};
const catDb={'רכב':'vehicle','מיזוג':'air_conditioning','לבית':'home','הנדימן':'handyman'}, catHe={vehicle:'רכב',air_conditioning:'מיזוג',home:'לבית',handyman:'הנדימן'};
function toast(t){const x=$('#toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2600)}
function show(id){$$('.view').forEach(v=>v.classList.remove('active'));$(id).classList.add('active');window.scrollTo({top:0,behavior:'smooth'})}
function esc(s=''){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function icon(c){return({רכב:'🚗',מיזוג:'❄️',לבית:'🏠',הנדימן:'🔨'})[c]||'🧰'}
async function loadMe(){if(!state.user)return;let {data:p}=await db.from('profiles').select('*').eq('id',state.user.id).maybeSingle();state.profile=p;state.role=p?.role==='professional'?'pro':'customer';let {data:c}=await db.from('credits').select('balance').eq('user_id',state.user.id).maybeSingle();state.credits=c?.balance||0;$('#creditCount').textContent=state.credits;let {data:a}=await db.from('admin_users').select('user_id').eq('user_id',state.user.id).maybeSingle();state.isAdmin=!!a;const ab=$('#adminBtn');if(ab)ab.classList.toggle('hidden',!state.isAdmin);$$('.role').forEach(b=>b.classList.toggle('active',b.dataset.role===state.role));$('#customerHome').classList.toggle('hidden',state.role!=='customer');$('#proHome').classList.toggle('hidden',state.role!=='pro')}
async function boot(){const {data:{session}}=await db.auth.getSession();state.user=session?.user||null;if(state.user){await loadMe();show('#homeView')}else show('#authView')}
$('#authForm').onsubmit=async e=>{e.preventDefault();$('#authNote').textContent='מתחבר…';const {data,error}=await db.auth.signInWithPassword({email:$('#authEmail').value.trim(),password:$('#authPassword').value});if(error){$('#authNote').textContent=error.message;return}state.user=data.user;await loadMe();$('#authNote').textContent='';show('#homeView')};
$('#signupBtn').onclick=async()=>{const email=$('#authEmail').value.trim(),password=$('#authPassword').value,name=$('#authName').value.trim(),role=$('#authRole').value;if(!email||password.length<6){toast('הזן אימייל וסיסמה של לפחות 6 תווים');return}const {data,error}=await db.auth.signUp({email,password,options:{data:{role,full_name:name}}});if(error){toast(error.message);return}if(data.session){state.user=data.user;await loadMe();show('#homeView');toast('ההרשמה הושלמה')}else{$('#authNote').textContent='נשלח אליך אימייל לאישור ההרשמה. לאחר האישור חזור והתחבר.'}};
$('#logoutBtn').onclick=async()=>{await db.auth.signOut();state.user=null;show('#authView')};
$$('.role').forEach(b=>b.onclick=()=>{state.role=b.dataset.role;$$('.role').forEach(x=>x.classList.toggle('active',x===b));$('#customerHome').classList.toggle('hidden',state.role!=='customer');$('#proHome').classList.toggle('hidden',state.role!=='pro')});
$$('.category').forEach(b=>b.onclick=()=>{$('#reqCategory').value=b.dataset.category;show('#requestView')});
$('#newRequestBtn').onclick=()=>show('#requestView');$('#myRequestsBtn').onclick=async()=>{await renderRequests();show('#requestsListView')};$('#jobsBtn').onclick=async()=>{await renderJobs();show('#proJobsView')};$('#profileBtn').onclick=async()=>{await fillProfile();show('#profileView')};$$('.back').forEach(b=>b.onclick=()=>show('#homeView'));
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(SpeechRecognition){const rec=new SpeechRecognition();rec.lang='he-IL';$('#voiceBtn').onclick=()=>{try{rec.start();$('#voiceStatus').textContent='מקשיב…'}catch{}};rec.onresult=e=>{$('#reqText').value=e.results[0][0].transcript||'';$('#voiceStatus').textContent='הטקסט נקלט.'}}else{$('#voiceBtn').disabled=true;$('#voiceStatus').textContent='הכתבה קולית אינה נתמכת בדפדפן הזה.'}
$('#requestForm').onsubmit=async e=>{e.preventDefault();if(!state.user)return;const row={customer_id:state.user.id,category:catDb[$('#reqCategory').value],description:$('#reqText').value.trim(),city:$('#reqCity').value.trim(),desired_timing:[$('#reqDate').value,$('#reqTime').value].filter(Boolean).join(' ')};const {error}=await db.from('requests').insert(row);if(error){toast('שגיאה: '+error.message);return}e.target.reset();toast('הבקשה פורסמה בענן');await renderRequests();show('#requestsListView')};
async function renderRequests(){const {data,error}=await db.from('requests').select('*').eq('customer_id',state.user.id).order('created_at',{ascending:false});if(error){toast(error.message);return}state.requests=data||[];const box=$('#requestsList');if(!state.requests.length){box.innerHTML='<div class="card"><h3>עדיין אין בקשות</h3></div>';return}const ids=state.requests.map(r=>r.id);let q=[];if(ids.length){const res=await db.from('quotes').select('request_id').in('request_id',ids);q=res.data||[]}box.innerHTML=state.requests.map(r=>{const c=q.filter(x=>x.request_id===r.id).length,he=catHe[r.category];return `<div class="item"><h3>${icon(he)} ${esc(he)}</h3><p>${esc(r.description)}</p><div class="badges"><span class="badge">📍 ${esc(r.city)}</span><span class="badge">סבב ${r.current_round}</span></div><div class="item-actions"><button class="primary" data-viewoffers="${r.id}">צפה בהצעות (${c})</button></div></div>`}).join('');box.querySelectorAll('[data-viewoffers]').forEach(b=>b.onclick=()=>openOffers(b.dataset.viewoffers))}
async function openOffers(id){state.selectedRequest=state.requests.find(r=>r.id===id);await renderOffers();show('#offersView')}
async function renderOffers(){const r=state.selectedRequest;if(!r)return;const {data}=await db.from('quotes').select('*, business_profiles!quotes_professional_id_fkey(*)').eq('request_id',r.id).eq('round_no',r.current_round);state.offers=data||[];const he=catHe[r.category];$('#requestSummary').innerHTML=`<h3>${icon(he)} ${esc(r.description)}</h3><p>📍 ${esc(r.city)} · ${esc(r.desired_timing||'')} · סבב ${r.current_round}</p>`;$('#offersList').innerHTML=state.offers.length?state.offers.map(o=>{let price=o.quote_type==='range'?`${o.price_min||'?'}–${o.price_max||'?'} ₪`:o.quote_type==='inspection'?`בדיקה ${o.visit_fee||0} ₪`:`${o.price_min||'?'} ₪`;return `<div class="item"><h3>${esc(o.business_profiles?.business_name||'בעל מקצוע')}</h3><div class="price">${esc(price)}</div><p>${esc(o.quote_text||'')}</p><div class="badges"><span class="badge">🕒 ${esc(o.availability||'בתיאום')}</span></div></div>`}).join(''):'<div class="card"><h3>עדיין אין הצעות</h3><p>כשתוגש הצעה היא תופיע כאן.</p></div>';$('#moreOffersBtn').classList.toggle('hidden',state.offers.length<3)}
$('#moreOffersBtn').onclick=async()=>{const r=state.selectedRequest;const {error}=await db.from('requests').update({current_round:r.current_round+1}).eq('id',r.id);if(error){toast(error.message);return}r.current_round++;toast('נפתח סבב נוסף');await renderOffers()};
async function renderJobs(){let q=db.from('requests').select('*').eq('status','open').order('created_at',{ascending:false});const filter=$('#jobFilter').value;if(filter!=='הכל')q=q.eq('category',catDb[filter]);const {data,error}=await q;if(error){toast(error.message);return}state.jobs=data||[];const box=$('#jobsList');box.innerHTML=state.jobs.length?state.jobs.map(j=>{const he=catHe[j.category];return `<div class="item"><h3>${icon(he)} ${esc(he)}</h3><p>${esc(j.description)}</p><div class="badges"><span class="badge">📍 ${esc(j.city)}</span><span class="badge">סבב ${j.current_round}</span></div><div class="item-actions"><button class="primary" data-offerjob="${j.id}">הגש הצעה</button></div></div>`}).join(''):'<div class="card"><h3>אין כרגע עבודות</h3></div>';box.querySelectorAll('[data-offerjob]').forEach(b=>b.onclick=()=>openOfferForm(b.dataset.offerjob))}
$('#jobFilter').onchange=renderJobs;function openOfferForm(id){state.selectedJob=state.jobs.find(j=>j.id===id);const he=catHe[state.selectedJob.category];$('#jobSummary').innerHTML=`<h3>${icon(he)} ${esc(state.selectedJob.description)}</h3><p>📍 ${esc(state.selectedJob.city)}</p>`;show('#offerFormView')}
$('#priceType').onchange=()=>{$('#rangePriceWrap').classList.toggle('hidden',$('#priceType').value!=='range');$('#singlePriceWrap').classList.toggle('hidden',$('#priceType').value==='range')};
$('#offerForm').onsubmit=async e=>{e.preventDefault();if(state.credits<1){toast('אין לך הצעות זמינות. רכוש 3 הצעות ב־15 ₪ דרך PayBox.');show('#paymentView');return}const type=$('#priceType').value,price=Number($('#offerPrice').value)||null,min=Number($('#offerMin').value)||null,max=Number($('#offerMax').value)||null;const args={p_request_id:state.selectedJob.id,p_quote_type:type,p_price_min:type==='fixed'?price:min,p_price_max:type==='range'?max:null,p_visit_fee:type==='inspection'?price:null,p_quote_text:$('#offerText').value.trim(),p_availability:[$('#offerDate').value,$('#offerTime').value].filter(Boolean).join(' ')};const {error}=await db.rpc('submit_quote',args);if(error){toast('לא נשלח: '+error.message);return}await loadMe();e.target.reset();toast('ההצעה נשלחה. נוכתה הצעה אחת מהחבילה.');await renderJobs();show('#proJobsView')};
async function fillProfile(){const {data}=await db.from('business_profiles').select('*').eq('user_id',state.user.id).maybeSingle();$('#bizName').value=data?.business_name||'';$('#bizAbout').value=data?.description||'';$('#bizArea').value=(data?.service_areas||[]).join(', ');$('#bizPhone').value=data?.business_phone||''}
$('#profileForm').onsubmit=async e=>{e.preventDefault();const row={user_id:state.user.id,business_name:$('#bizName').value.trim(),description:$('#bizAbout').value.trim(),specialties:[$('#bizCategory').value],service_areas:$('#bizArea').value.split(',').map(x=>x.trim()).filter(Boolean),business_phone:$('#bizPhone').value.trim()};const {error}=await db.from('business_profiles').upsert(row);if(error){toast(error.message);return}await db.from('profiles').update({role:'professional'}).eq('id',state.user.id);await loadMe();toast('פרופיל העסק נשמר בענן');show('#homeView')};

async function loadAdmin(){
  if(!state.isAdmin){toast('אין הרשאת מנהל');return}
  const {data:summary,error:se}=await db.rpc('admin_dashboard_summary');
  if(se){toast('יש להריץ קודם את admin-setup.sql');return}
  const sum=summary||{};
  $('#adminUsersCount').textContent=sum.users||0;
  $('#adminCustomersCount').textContent=sum.customers||0;
  $('#adminProsCount').textContent=sum.professionals||0;
  $('#adminPendingCount').textContent=sum.pending_payments||0;
  const {data:users,error:ue}=await db.rpc('admin_list_users');
  if(ue){toast(ue.message);return}
  const rows=users||[];
  const pros=rows.filter(x=>x.role==='professional');
  const customers=rows.filter(x=>x.role!=='professional');
  state.adminPros=pros; state.adminCustomers=customers;
  const userCard=u=>`<div class="item"><h3>${esc(u.display_name||u.business_name||u.email||'משתמש')}</h3><p>${esc(u.email||'')}</p><div class="admin-user-meta"><span class="badge">${u.role==='professional'?'🧰 בעל מקצוע':'👤 לקוח'}</span>${u.business_name?`<span class="badge">${esc(u.business_name)}</span>`:''}<span class="badge">${Number(u.credit_balance||0)} הצעות</span></div></div>`;
  const matches=(u,q)=>{q=(q||'').trim().toLowerCase();if(!q)return true;return [u.display_name,u.business_name,u.email,u.business_phone].some(v=>String(v||'').toLowerCase().includes(q))};
  const renderPeople=(kind)=>{const isPro=kind==='pros';const input=$(isPro?'#adminProsSearch':'#adminCustomersSearch');const list=$(isPro?'#adminProsList':'#adminCustomersList');const source=isPro?(state.adminPros||[]):(state.adminCustomers||[]);const filtered=source.filter(u=>matches(u,input?.value||''));list.innerHTML=filtered.length?filtered.map(userCard).join(''):`<div class="card"><h3>${(input?.value||'').trim()?'לא נמצאו תוצאות':(isPro?'אין בעלי מקצוע':'אין לקוחות')}</h3></div>`};
  renderPeople('pros'); renderPeople('customers');
  const ps=$('#adminProsSearch'); if(ps&&!ps.dataset.bound){ps.addEventListener('input',()=>renderPeople('pros'));ps.dataset.bound='1'}
  const cs=$('#adminCustomersSearch'); if(cs&&!cs.dataset.bound){cs.addEventListener('input',()=>renderPeople('customers'));cs.dataset.bound='1'}
  const {data:payments,error:pe}=await db.rpc('admin_list_pending_payments');
  if(pe){toast(pe.message);return}
  const pb=$('#adminPaymentsList');
  pb.innerHTML=(payments||[]).length?(payments||[]).map(p=>`<div class="item"><h3>${esc(p.display_name||p.email||'בעל מקצוע')}</h3><p>${esc(p.email||'')}</p><div class="badges"><span class="badge">PayBox</span><span class="badge">${p.amount} ₪</span><span class="badge">${p.credits} הצעות</span></div><p>${new Date(p.created_at).toLocaleString('he-IL')}</p><div class="admin-actions"><button class="approve-btn" data-approve="${p.payment_id}">✓ אשר</button><button class="reject-btn" data-reject="${p.payment_id}">דחה</button></div></div>`).join(''):'<div class="card"><h3>אין תשלומים שממתינים לאישור</h3></div>';
  pb.querySelectorAll('[data-approve]').forEach(b=>b.onclick=async()=>{if(!confirm('אישרת שקיבלת 15 ₪ ב-PayBox?'))return;const {error}=await db.rpc('approve_payment',{p_payment_id:b.dataset.approve});if(error){toast(error.message);return}toast('התשלום אושר ו-3 הצעות נוספו');await loadAdmin()});
  pb.querySelectorAll('[data-reject]').forEach(b=>b.onclick=async()=>{if(!confirm('לדחות את בקשת התשלום?'))return;const {error}=await db.rpc('reject_payment',{p_payment_id:b.dataset.reject});if(error){toast(error.message);return}toast('בקשת התשלום נדחתה');await loadAdmin()});
}
const adminBtn=$('#adminBtn'); if(adminBtn)adminBtn.onclick=async()=>{await loadAdmin();show('#adminView')};
$$('.admin-tab').forEach(b=>b.onclick=()=>{$$('.admin-tab').forEach(x=>x.classList.toggle('active',x===b));['payments','pros','customers'].forEach(k=>$(`#admin${k[0].toUpperCase()+k.slice(1)}Panel`).classList.toggle('hidden',b.dataset.adminTab!==k))});

const PAYBOX_URL='https://links.payboxapp.com/OSHVo5yi15b';
async function renderPaymentStatus(){
  const box=$('#paymentStatus'); if(!box||!state.user)return;
  const {data,error}=await db.from('payment_requests').select('id,status,created_at').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(error||!data){box.classList.add('hidden');box.innerHTML='';return}
  box.classList.remove('hidden');
  const d=new Date(data.created_at).toLocaleString('he-IL');
  if(data.status==='approved') box.innerHTML=`<b>התשלום אושר ✅</b><span>3 הצעות נוספו לחשבון · ${d}</span>`;
  else if(data.status==='rejected') box.innerHTML=`<b>התשלום לא אושר</b><span>אפשר לבצע תשלום חדש ב־PayBox · ${d}</span>`;
  else box.innerHTML=`<b>התשלום סומן כמבוצע</b><span>ממתין לאישור לאחר בדיקה ב־PayBox · ${d}</span>`;
}
$('#buyCreditsBtn').onclick=async()=>{await renderPaymentStatus();show('#paymentView')};
$('#payboxPayBtn').href=PAYBOX_URL;
$('#paidBtn').onclick=async()=>{
  if(!state.user){toast('יש להתחבר קודם');return}
  const {data:pending}=await db.from('payment_requests').select('id').eq('user_id',state.user.id).eq('status','pending').limit(1).maybeSingle();
  if(pending){toast('כבר ממתין אצלנו תשלום לאישור.');await renderPaymentStatus();return}
  const {error}=await db.from('payment_requests').insert({user_id:state.user.id,amount:15,credits:3,status:'pending'});
  if(error){toast('לא ניתן לסמן תשלום: '+error.message);return}
  await renderPaymentStatus();
  toast('קיבלנו. אחרי אימות ב־PayBox יתווספו 3 הצעות אוטומטית.');
};
boot();

if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
