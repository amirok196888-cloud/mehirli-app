const SUPABASE_URL='https://jgnbcrlvsudfqfofmvlx.supabase.co';
const SUPABASE_KEY='sb_publishable_WnOhGZSlik7zqpO-cRYGvA_lOUz68Wp';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={user:null,profile:null,role:'pro',credits:0,requests:[],offers:[],jobs:[],selectedRequest:null,selectedJob:null,isAdmin:false,notifications:[],unreadNotifications:0,notificationTimer:null,lastNotificationSeenAt:null,proSettings:null,proJobs:[],selectedProJob:null,proJobMedia:[],adminJobs:[],adminBusinesses:[]};
const catDb={'רכב':'vehicle','מיזוג':'air_conditioning','לבית':'home','הנדימן':'handyman','היינדמן':'handyman','חשמלאי':'electrician'}, catHe={vehicle:'רכב',air_conditioning:'מיזוג',home:'לבית',handyman:'היינדמן',electrician:'חשמלאי'};
const tradeHe={handyman:'היינדמן',electrician:'חשמלאי',home:'שירותי בית',air_conditioning:'מיזוג'};
const jobStatusHe={lead:'פנייה חדשה',quoted:'הצעה נשלחה',approved:'ההצעה אושרה',scheduled:'נקבע מועד',in_progress:'בביצוע',completed:'העבודה הסתיימה',paid:'שולם',cancelled:'בוטל'};
const TRADE_JOBS={
  handyman:[['general','תיקון כללי'],['tv','תליית טלוויזיה'],['shelves','מדפים ותלייה'],['furniture','הרכבת רהיטים'],['door','דלת / ארון'],['sealing','איטום וסיליקון'],['faucet','ברז / סיפון'],['blinds','תריס / וילון'],['other','אחר']],
  electrician:[['general','בדיקה / תקלה כללית'],['outlet','שקע או מפסק'],['lighting','תאורה'],['short','קצר / הפסקת חשמל'],['panel','לוח חשמל'],['boiler','דוד חשמל'],['three_phase','תלת־פאזי'],['ev','עמדת טעינה'],['other','אחר']],
  home:[['general','שירות בית כללי'],['plumbing','נזילה / אינסטלציה'],['drain','סתימה וניקוז'],['toilet','אסלה וניאגרה'],['water_heater','דוד ומים חמים'],['lock','מנעול ודלת'],['other','אחר']],
  air_conditioning:[['general','בדיקת מזגן'],['no_cooling','לא מקרר / מחמם'],['leak','נזילת מים'],['cleaning','ניקוי עמוק'],['installation','התקנה / העתקה'],['noise','רעש או ריח'],['other','אחר']]
};
const ANALYSIS_RULES={
  handyman:{
    base:{questions:['מה בדיוק צריך לבצע ובכמה נקודות?','האם יש תמונות ברורות של האזור?','האם הלקוח מספק את החלקים או שהם באחריות בעל המקצוע?','האם קיימת חניה וגישה נוחה לציוד?'],tools:['מטר וסמן','כלי עבודה ידניים','ציוד מגן בסיסי']},
    tv:{keys:['טלוויזיה','טלויזיה','מסך'],questions:['מה גודל ומשקל הטלוויזיה?','מאיזה חומר הקיר: בטון, בלוק או גבס?','האם קיימת זרוע מתאימה והאם נדרש להסתיר כבלים?'],tools:['פלס','מקדחה ודיבלים מתאימים','גלאי תשתיות בקיר']},
    shelves:{keys:['מדף','מדפים','תמונה','מראה','וילון'],questions:['מה משקל הפריט ומה מידותיו?','מה סוג הקיר?','באיזה גובה ומיקום נדרשת ההתקנה?'],tools:['פלס','מקדחה','דיבלים ועוגנים לפי סוג הקיר']},
    furniture:{keys:['ארון','שידה','מיטה','רהיט','איקאה','הרכב'],questions:['מה הדגם וכמה אריזות קיימות?','האם המקום פנוי להרכבה?','האם נדרש פינוי אריזות או קיבוע לקיר?'],tools:['מברגה וביטים','פטיש גומי','ציוד לקיבוע בטיחותי']},
    door:{keys:['דלת','ציר','מגירה','ארון'],questions:['האם נדרש כיוון, החלפת ציר או תיקון נגרות?','אפשר לקבל צילום של הצירים והנזק?','האם יש חלק חלופי מתאים?'],tools:['סט מברגים וביטים','פלס','ברגים וצירים נפוצים']},
    sealing:{keys:['סיליקון','איטום','רטיבות'],questions:['היכן מופיעה הרטיבות ומתי?','האם צריך להסיר איטום ישן?','מה אורך האזור לטיפול?'],tools:['מסיר סיליקון','אקדח סיליקון','חומר איטום מתאים']},
    faucet:{keys:['ברז','סיפון','נזילה'],questions:['האם קיימת נזילה פעילה כרגע?','האם הלקוח רכש ברז או סיפון חדש?','האם ברזי הניתוק המקומיים תקינים?'],tools:['מפתח מתכוונן','טפלון ואטמים','דלי וסמרטוטים']}
  },
  electrician:{
    base:{questions:['האם התקלה בכל הבית או בנקודה אחת?','מתי התקלה התחילה והאם היא חוזרת?','אפשר לקבל צילום ברור של הלוח והאזור?','האם בוצע שינוי או חיבור מכשיר חדש לפני התקלה?'],tools:['ציוד מדידה תקני','ציוד מגן אישי','חלקי חילוף מתאימים'],warnings:['עבודת חשמל תבוצע רק בידי בעל רישיון חשמלאי מתאים.']},
    outlet:{keys:['שקע','מפסק'],questions:['האם מדובר בהחלפה במקום קיים או בנקודה חדשה?','איזה מכשיר מיועד להתחבר לנקודה?','מה המרחק המשוער מהלוח או מנקודת ההזנה?'],tools:['בודק מתח וציוד מדידה','שקע או מפסק תקני','חיווט ואביזרי חיבור מתאימים']},
    lighting:{keys:['מנורה','תאורה','גוף תאורה','ספוט'],questions:['כמה גופי תאורה ומה משקלם?','האם קיימת נקודת חשמל תקינה במקום?','מה גובה התקרה והאם נדרש סולם מיוחד?'],tools:['ציוד מדידה','סולם מתאים','מחברים ואמצעי קיבוע']},
    short:{keys:['קצר','קופץ','נפל החשמל','אין חשמל','שרוף','ניצוצות','עשן'],questions:['איזה מפסק בלוח קופץ?','האם יש ריח שרוף, עשן או סימני חום?','האם התקלה מופיעה עם מכשיר מסוים?'],tools:['מודד בידוד','רב־מודד','ציוד איתור תקלה'],warnings:['אם יש עשן, ניצוצות או ריח שרוף — יש להרחיק אנשים, לנתק הזנה רק אם ניתן לעשות זאת בבטחה ולהזמין חשמלאי מוסמך בדחיפות.']},
    panel:{keys:['לוח','מאמ״ת','פחת','מפסק ראשי'],questions:['האם מדובר בתיקון, הרחבה או החלפת לוח?','מה גודל החיבור ומספר המעגלים?','האם יש סימני חימום או מקום פנוי בלוח?'],tools:['ציוד מדידה ובדיקת פחת','סימון מעגלים','רכיבים תקניים התואמים ללוח']},
    boiler:{keys:['דוד','חימום מים'],questions:['האם הדוד אינו מחמם כלל או שהחימום חלקי?','האם המפסק או הפחת קופצים?','האם קיימת נזילה באזור הדוד?'],tools:['ציוד מדידה','תרמוסטט וגוף חימום לפי הדגם','אטם מתאים']},
    ev:{keys:['עמדת טעינה','רכב חשמלי','טעינה'],questions:['מה דגם הרכב והעמדה?','מה גודל החיבור הקיים ומה המרחק מהלוח?','האם קיימת תשתית ייעודית וחניה פרטית?'],tools:['ציוד בדיקה מתאים לעמדת טעינה','הגנות וחיווט לפי התכנון','סימון ותיעוד המעגל']}
  },
  home:{
    base:{questions:['מה בדיוק התקלה והאם היא פעילה כרגע?','אפשר לקבל תמונות או סרטון ברור?','האם קיימת גישה נוחה לנקודת הטיפול?','האם הלקוח מספק חלקים או שנדרש להביאם?'],tools:['כלי עבודה ידניים','ציוד מגן בסיסי','חומרי איטום וחיבורים נפוצים']},
    plumbing:{keys:['נזילה','ברז','צינור','מים'],questions:['האם ניתן לסגור את ברז המים המקומי?','מאיפה בדיוק יוצאים המים?','האם הנזילה קבועה או רק בזמן שימוש?'],tools:['מפתח צינורות','אטמים וטפלון','דלי וציוד ספיגה']},
    drain:{keys:['סתימה','ביוב','ניקוז'],questions:['באיזו נקודה קיימת הסתימה?','האם המים עולים בנקודות נוספות?','האם נעשה ניסיון לפתוח את הסתימה?'],tools:['קפיץ לפתיחת סתימות','ציוד שאיבה וניקוי','כפפות וציוד מגן']},
    toilet:{keys:['אסלה','ניאגרה'],questions:['האם קיימת נזילה או שהמים ממשיכים לזרום?','האם האסלה יציבה?','מה סוג הניאגרה: גלויה או סמויה?'],tools:['מנגנון ואטמים נפוצים','מפתחות מתאימים','חומר איטום']},
    water_heater:{keys:['דוד','מים חמים'],questions:['האם אין מים חמים כלל או שהחימום חלקי?','האם קיימת נזילה?','האם המפסק או הפחת קופצים?'],tools:['ציוד בדיקת לחץ ונזילות','אטמים וחיבורים מתאימים'],warnings:['טיפול ברכיב החשמלי של הדוד יבוצע רק בידי חשמלאי בעל רישיון מתאים.']},
    lock:{keys:['מנעול','צילינדר','דלת'],questions:['האם הדלת נפתחת כרגע?','האם המפתח מסתובב או תקוע?','מה סוג הדלת והמנעול?'],tools:['צילינדרים נפוצים','כלי פירוק וכיוון','חומר סיכה מתאים']}
  },
  air_conditioning:{
    base:{questions:['מה סוג המזגן וההספק שלו?','מה גיל המזגן ומתי טופל לאחרונה?','אפשר לקבל צילום של היחידה והנוריות?','האם התקלה קבועה או לסירוגין?'],tools:['ציוד מדידה למיזוג','ציוד ניקוי ואיסוף מים','ציוד מגן'],warnings:['טיפול בגז קירור ובמערכת החשמל יבוצע רק בידי בעל מקצוע מוסמך ומתאים.']},
    no_cooling:{keys:['לא מקרר','לא מחמם','חלש','אין קירור'],questions:['האם היחידה החיצונית פועלת?','האם יוצא אוויר בעוצמה רגילה?','האם מופיע קוד תקלה?'],tools:['מד טמפרטורה','ציוד מדידת לחצים','ציוד איתור דליפות']},
    leak:{keys:['נזילה','מטפטף','מים'],questions:['מאיפה מטפטפים המים?','האם הניקוז נגיש?','מתי בוצע ניקוי פילטרים לאחרונה?'],tools:['משאבת ניקוז','ציוד שטיפה','צינור ניקוז וחיבורים']},
    cleaning:{keys:['ניקוי','ריח','עובש'],questions:['האם יש ריח או סימני עובש?','האם נדרש ניקוי ליחידה אחת או למספר יחידות?','האם קיימת גישה נוחה לניקוז?'],tools:['כיסוי ניקוי','חומר ניקוי ייעודי','משאבת שטיפה']},
    installation:{keys:['התקנה','העתקה'],questions:['מה הספק המזגן ומה אורך הצנרת המשוער?','היכן ימוקמו היחידות הפנימית והחיצונית?','האם נדרשת נקודת חשמל או עבודת גובה?'],tools:['משאבת ואקום','ציוד צנרת וניקוז','ציוד עבודה בגובה לפי הצורך']},
    noise:{keys:['רעש','רעידות'],questions:['האם הרעש מהיחידה הפנימית או החיצונית?','באיזה מצב עבודה הוא מופיע?','האם המזגן עדיין מקרר?'],tools:['ציוד מדידה','בולמי רעידות וחלקי קיבוע','כלי בדיקה מכניים']}
  }
};
function toast(t){const x=$('#toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2600)}
function show(id){$$('.view').forEach(v=>v.classList.remove('active'));$(id).classList.add('active');window.scrollTo({top:0,behavior:'smooth'})}
function esc(s=''){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function icon(c){return({רכב:'🚗',מיזוג:'❄️',לבית:'🏠',הנדימן:'🔨',היינדמן:'🔨',חשמלאי:'⚡'})[c]||'🧰'}
function tradeIcon(trade){return ({handyman:'🔨',electrician:'⚡',home:'🏠',air_conditioning:'❄️'})[trade]||'🧰'}
function money(n){return `${Math.round(Number(n)||0).toLocaleString('he-IL')} ₪`}
function numberValue(selector){return Number($(selector)?.value)||0}
function round10(n){return Math.ceil(Math.max(0,n)/10)*10}
function waNumber(phone=''){const digits=String(phone).replace(/\D/g,'');return digits.startsWith('0')?'972'+digits.slice(1):digits}
function formatDateTime(value){if(!value)return 'לא נקבע';try{return new Date(value).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'})}catch{return value}}
function currentPublicQuoteToken(){const token=new URLSearchParams(location.search).get('quote');return /^[0-9a-f-]{36}$/i.test(token||'')?token:null}
function safeHttpUrl(value=''){
  if(!value)return '';
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return ''}
}

function notificationIcon(kind){
  return ({new_job:'🧰',new_quote:'💬',payment_pending:'💳',quote_selected:'🤝',direct_quote_approved:'✅'})[kind]||'🔔'
}
function timeAgo(iso){
  const d=new Date(iso), diff=Math.max(0,Date.now()-d.getTime()), m=Math.floor(diff/60000);
  if(m<1)return 'עכשיו'; if(m<60)return `לפני ${m} דק׳`;
  const h=Math.floor(m/60); if(h<24)return `לפני ${h} שעות`;
  const days=Math.floor(h/24); return `לפני ${days} ימים`;
}
async function refreshNotifications(showSystem=false){
  if(!state.user)return;
  const {data,error}=await db.from('notifications').select('*').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(60);
  if(error)return;
  const rows=data||[];
  if(showSystem && state.lastNotificationSeenAt && 'Notification' in window && Notification.permission==='granted'){
    const fresh=rows.filter(n=>!n.is_read && new Date(n.created_at)>new Date(state.lastNotificationSeenAt));
    fresh.slice(0,3).reverse().forEach(n=>{
      try{new Notification(n.title||'מחירלי',{body:n.body||'',icon:'./icon-192.png',tag:`mehirli-${n.id}`})}catch{}
    });
  }
  state.notifications=rows;
  state.unreadNotifications=rows.filter(n=>!n.is_read).length;
  state.lastNotificationSeenAt=rows[0]?.created_at||state.lastNotificationSeenAt||new Date().toISOString();
  const badge=$('#notificationBadge');
  if(badge){badge.textContent=state.unreadNotifications>99?'99+':state.unreadNotifications;badge.classList.toggle('hidden',state.unreadNotifications===0)}
}
function renderNotifications(){
  const box=$('#notificationsList'); if(!box)return;
  box.innerHTML=state.notifications.length?state.notifications.map(n=>`<div class="item notification-item ${n.is_read?'':'unread'}" data-notification="${n.id}" data-kind="${esc(n.kind)}">
    <div class="notification-title-row"><b>${notificationIcon(n.kind)} ${esc(n.title||'התראה')}</b><span class="notification-time">${timeAgo(n.created_at)}</span></div>
    <p>${esc(n.body||'')}</p>
  </div>`).join(''):'<div class="card"><h3>אין כרגע התראות</h3><p>כאן יופיעו עבודות חדשות, הצעות ותשלומים.</p></div>';
  box.querySelectorAll('[data-notification]').forEach(el=>el.onclick=async()=>{
    const n=state.notifications.find(x=>x.id===el.dataset.notification);
    if(n&&!n.is_read)await db.from('notifications').update({is_read:true}).eq('id',n.id);
    await refreshNotifications(false);
    const kind=el.dataset.kind;
    if(kind==='new_job'){state.role='pro';await openProWorkspace()}
    else if(kind==='new_quote'){state.role='customer';await renderRequests();show('#requestsListView')}
    else if(kind==='payment_pending'&&state.isAdmin){await loadAdmin();show('#adminView')}
    else if(kind==='quote_selected'){await renderWonJobs();show('#wonJobsView')}
    else if(kind==='direct_quote_approved'){state.role='pro';await openProWorkspace()}
    else {renderNotifications()}
  });
}
async function openNotifications(){
  await refreshNotifications(false);renderNotifications();show('#notificationsView')
}
function startNotificationPolling(){
  if(state.notificationTimer)clearInterval(state.notificationTimer);
  refreshNotifications(false);
  state.notificationTimer=setInterval(()=>refreshNotifications(true),30000);
}
function stopNotificationPolling(){
  if(state.notificationTimer){clearInterval(state.notificationTimer);state.notificationTimer=null}
}

async function loadMe(){
  if(!state.user)return;
  const {data:a}=await db.from('admin_users').select('user_id').eq('user_id',state.user.id).maybeSingle();state.isAdmin=!!a;
  let {data:p}=await db.from('profiles').select('*').eq('id',state.user.id).maybeSingle();
  if(!state.isAdmin&&p&&p.role!=='professional'){
    const {data:updated}=await db.from('profiles').update({role:'professional'}).eq('id',state.user.id).select('*').maybeSingle();
    p=updated||p;
  }
  state.profile=p;state.role=state.isAdmin?'admin':'pro';
  const ab=$('#adminBtn');if(ab)ab.classList.toggle('hidden',!state.isAdmin);
  const np=$('#enablePhoneNotificationsBtn');if(np&&'Notification' in window)np.classList.toggle('hidden',Notification.permission!=='default');
  startNotificationPolling()
}
async function boot(){const quoteToken=currentPublicQuoteToken();if(quoteToken){await loadPublicQuote(quoteToken);return}const {data:{session}}=await db.auth.getSession();state.user=session?.user||null;if(state.user){await loadMe();show('#homeView')}else show('#authView')}
$('#authForm').onsubmit=async e=>{e.preventDefault();$('#authNote').textContent='מתחבר…';const {data,error}=await db.auth.signInWithPassword({email:$('#authEmail').value.trim(),password:$('#authPassword').value});if(error){$('#authNote').textContent=error.message;return}state.user=data.user;await loadMe();$('#authNote').textContent='';show('#homeView')};
$('#signupBtn').onclick=async()=>{const email=$('#authEmail').value.trim(),password=$('#authPassword').value,name=$('#authName').value.trim(),role=$('#authRole').value;if(!email||password.length<6){toast('הזן אימייל וסיסמה של לפחות 6 תווים');return}const {data,error}=await db.auth.signUp({email,password,options:{data:{role,full_name:name}}});if(error){toast(error.message);return}if(data.session){state.user=data.user;await loadMe();show('#homeView');toast('ההרשמה הושלמה')}else{$('#authNote').textContent='נשלח אליך אימייל לאישור ההרשמה. לאחר האישור חזור והתחבר.'}};
$('#logoutBtn').onclick=async()=>{stopNotificationPolling();await db.auth.signOut();state.user=null;show('#authView')};
$$('.category').forEach(b=>b.onclick=()=>{$('#reqCategory').value=b.dataset.category;show('#requestView')});
$('#profileBtn').onclick=async()=>{await fillProfile();show('#profileView')};$$('.back').forEach(b=>b.onclick=async()=>{if(b.dataset.backTo==='workspace'){await openProWorkspace()}else show('#homeView')});
$('#notificationsBtn').onclick=openNotifications;
$('#markAllNotificationsBtn').onclick=async()=>{
  const {error}=await db.from('notifications').update({is_read:true}).eq('user_id',state.user.id).eq('is_read',false);
  if(error){toast(error.message);return}
  await refreshNotifications(false);renderNotifications();toast('כל ההתראות סומנו כנקראו');
};
$('#enablePhoneNotificationsBtn').onclick=async()=>{
  if(!('Notification' in window)){toast('התראות מערכת אינן נתמכות כאן');return}
  const p=await Notification.requestPermission();
  $('#enablePhoneNotificationsBtn').classList.toggle('hidden',p!=='default');
  toast(p==='granted'?'התראות בטלפון הופעלו ✅':'לא ניתנה הרשאה להתראות');
};

const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(SpeechRecognition){const rec=new SpeechRecognition();rec.lang='he-IL';$('#voiceBtn').onclick=()=>{try{rec.start();$('#voiceStatus').textContent='מקשיב…'}catch{}};rec.onresult=e=>{$('#reqText').value=e.results[0][0].transcript||'';$('#voiceStatus').textContent='הטקסט נקלט.'}}else{$('#voiceBtn').disabled=true;$('#voiceStatus').textContent='הכתבה קולית אינה נתמכת בדפדפן הזה.'}
$('#requestForm').onsubmit=async e=>{e.preventDefault();if(!state.user)return;const row={customer_id:state.user.id,category:catDb[$('#reqCategory').value],description:$('#reqText').value.trim(),city:$('#reqCity').value.trim(),desired_timing:[$('#reqDate').value,$('#reqTime').value].filter(Boolean).join(' ')};const {error}=await db.from('requests').insert(row);if(error){toast('שגיאה: '+error.message);return}e.target.reset();toast('הבקשה פורסמה בענן');await refreshNotifications(false);await renderRequests();show('#requestsListView')};
async function renderRequests(){const {data,error}=await db.from('requests').select('*').eq('customer_id',state.user.id).order('created_at',{ascending:false});if(error){toast(error.message);return}state.requests=data||[];const box=$('#requestsList');if(!state.requests.length){box.innerHTML='<div class="card"><h3>עדיין אין בקשות</h3></div>';return}const ids=state.requests.map(r=>r.id);let q=[];if(ids.length){const res=await db.from('quotes').select('request_id').in('request_id',ids);q=res.data||[]}box.innerHTML=state.requests.map(r=>{const c=q.filter(x=>x.request_id===r.id).length,he=catHe[r.category];return `<div class="item"><h3>${icon(he)} ${esc(he)}</h3><p>${esc(r.description)}</p><div class="badges"><span class="badge">📍 ${esc(r.city)}</span><span class="badge">סבב ${r.current_round}</span></div><div class="item-actions"><button class="primary" data-viewoffers="${r.id}">צפה בהצעות (${c})</button></div></div>`}).join('');box.querySelectorAll('[data-viewoffers]').forEach(b=>b.onclick=()=>openOffers(b.dataset.viewoffers))}
async function openOffers(id){state.selectedRequest=state.requests.find(r=>r.id===id);await renderOffers();show('#offersView')}
async function renderOffers(){
 const r=state.selectedRequest;if(!r)return;
 const {data,error}=await db.from('quotes').select('*, business_profiles!quotes_professional_id_fkey(*)').eq('request_id',r.id).eq('round_no',r.current_round);
 if(error){toast(error.message);return} state.offers=data||[];
 const he=catHe[r.category], chosen=r.selected_quote_id;
 $('#requestSummary').innerHTML=`<h3>${icon(he)} ${esc(r.description)}</h3><p>📍 ${esc(r.city)} · ${esc(r.desired_timing||'')} · סבב ${r.current_round}</p>${chosen?'<div class="badge">✅ נבחר בעל מקצוע — פרטי הקשר פתוחים</div>':''}`;
 const cards=[];
 for(const o of state.offers){
   let price=o.quote_type==='range'?`${o.price_min||'?'}–${o.price_max||'?'} ₪`:o.quote_type==='inspection'?`בדיקה ${o.visit_fee||0} ₪`:`${o.price_min||'?'} ₪`;
   let contact='';
   if(chosen===o.id){
     const {data:c}=await db.rpc('get_selected_contact',{p_request_id:r.id});
     const row=Array.isArray(c)?c[0]:c;
     if(row?.professional_phone){
       const digits=String(row.professional_phone).replace(/\D/g,'');
       const wa=digits.startsWith('0')?'972'+digits.slice(1):digits;
       contact=`<div class="contact-box"><b>📞 אפשר ליצור קשר</b><p>${esc(row.business_name||'בעל המקצוע')} · ${esc(row.professional_phone)}</p><div class="item-actions"><a class="primary" href="tel:${esc(row.professional_phone)}">התקשר</a><a class="secondary" target="_blank" rel="noopener" href="https://wa.me/${wa}">WhatsApp</a></div></div>`;
     }
   }
   const choose=!chosen?`<div class="item-actions"><button class="primary" data-choosequote="${o.id}">✓ בחר בהצעה ופתח פרטי קשר</button></div>`:(chosen===o.id?'<div class="badge">✅ ההצעה שנבחרה</div>':'');
   cards.push(`<div class="item"><h3>${esc(o.business_profiles?.business_name||'בעל מקצוע')}</h3><div class="price">${esc(price)}</div><p>${esc(o.quote_text||'')}</p><div class="badges"><span class="badge">🕒 ${esc(o.availability||'בתיאום')}</span></div>${choose}${contact}</div>`);
 }
 $('#offersList').innerHTML=cards.length?cards.join(''):'<div class="card"><h3>עדיין אין הצעות</h3><p>כשתוגש הצעה היא תופיע כאן.</p></div>';
 $('#offersList').querySelectorAll('[data-choosequote]').forEach(b=>b.onclick=async()=>{
   if(!confirm('לבחור בהצעה הזו ולפתוח פרטי קשר ביניכם?'))return;
   const {error}=await db.rpc('select_quote',{p_quote_id:b.dataset.choosequote});
   if(error){toast('לא ניתן לבחור: '+error.message);return}
   const {data:rr}=await db.from('requests').select('*').eq('id',r.id).single(); state.selectedRequest=rr;
   toast('ההצעה נבחרה. פרטי הקשר נפתחו לשני הצדדים.'); await renderOffers();
 });
 $('#moreOffersBtn').classList.toggle('hidden',state.offers.length<3||!!chosen);
}
$('#moreOffersBtn').onclick=async()=>{const r=state.selectedRequest;const {error}=await db.from('requests').update({current_round:r.current_round+1}).eq('id',r.id);if(error){toast(error.message);return}r.current_round++;toast('נפתח סבב נוסף');await renderOffers()};
async function renderJobs(){let q=db.from('requests').select('*').eq('status','open').order('created_at',{ascending:false});const filter=$('#jobFilter').value;if(filter!=='הכל')q=q.eq('category',catDb[filter]);const {data,error}=await q;if(error){toast(error.message);return}state.jobs=data||[];const box=$('#jobsList');box.innerHTML=state.jobs.length?state.jobs.map(j=>{const he=catHe[j.category];return `<div class="item"><h3>${icon(he)} ${esc(he)}</h3><p>${esc(j.description)}</p><div class="badges"><span class="badge">📍 ${esc(j.city)}</span><span class="badge">סבב ${j.current_round}</span></div><div class="item-actions"><button class="primary" data-offerjob="${j.id}">הגש הצעה</button></div></div>`}).join(''):'<div class="card"><h3>אין כרגע עבודות</h3></div>';box.querySelectorAll('[data-offerjob]').forEach(b=>b.onclick=()=>openOfferForm(b.dataset.offerjob))}
$('#jobFilter').onchange=renderJobs;
async function renderWonJobs(){
 const box=$('#wonJobsList'); box.innerHTML='<div class="card">טוען…</div>';
 const {data,error}=await db.rpc('get_my_selected_jobs');
 if(error){box.innerHTML='<div class="card"><h3>נדרשת הפעלת עדכון V23</h3><p>יש להריץ פעם אחת את הקובץ v23-contact-setup.sql ב-Supabase.</p></div>';return}
 const rows=data||[];
 box.innerHTML=rows.length?rows.map(j=>{
   const digits=String(j.customer_phone||'').replace(/\D/g,'');
   const wa=digits.startsWith('0')?'972'+digits.slice(1):digits;
   return `<div class="item"><h3>${icon(catHe[j.category])} ${esc(j.description)}</h3><p>📍 ${esc(j.city||'')} · ${esc(j.desired_timing||'')}</p><div class="contact-box"><b>הלקוח בחר בהצעה שלך ✅</b><p>${esc(j.customer_name||'לקוח')} · ${esc(j.customer_phone||'')}</p><div class="item-actions"><a class="primary" href="tel:${esc(j.customer_phone||'')}">התקשר</a>${wa?`<a class="secondary" target="_blank" rel="noopener" href="https://wa.me/${wa}">WhatsApp</a>`:''}</div></div></div>`;
 }).join(''):'<div class="card"><h3>עדיין אין לקוחות שבחרו בהצעה שלך</h3></div>';
}
function openOfferForm(id){state.selectedJob=state.jobs.find(j=>j.id===id);const he=catHe[state.selectedJob.category];$('#jobSummary').innerHTML=`<h3>${icon(he)} ${esc(state.selectedJob.description)}</h3><p>📍 ${esc(state.selectedJob.city)}</p>`;show('#offerFormView')}
$('#priceType').onchange=()=>{$('#rangePriceWrap').classList.toggle('hidden',$('#priceType').value!=='range');$('#singlePriceWrap').classList.toggle('hidden',$('#priceType').value==='range')};
$('#offerForm').onsubmit=async e=>{e.preventDefault();if(state.credits<1){toast('אין לך הצעות זמינות. רכוש 3 הצעות ב־15 ₪ דרך PayBox.');show('#paymentView');return}const type=$('#priceType').value,price=Number($('#offerPrice').value)||null,min=Number($('#offerMin').value)||null,max=Number($('#offerMax').value)||null;const args={p_request_id:state.selectedJob.id,p_quote_type:type,p_price_min:type==='fixed'?price:min,p_price_max:type==='range'?max:null,p_visit_fee:type==='inspection'?price:null,p_quote_text:$('#offerText').value.trim(),p_availability:[$('#offerDate').value,$('#offerTime').value].filter(Boolean).join(' ')};const {error}=await db.rpc('submit_quote',args);if(error){toast('לא נשלח: '+error.message);return}await loadMe();e.target.reset();toast('ההצעה נשלחה. נוכתה הצעה אחת מהחבילה.');await refreshNotifications(false);await renderJobs();show('#proJobsView')};
async function fillProfile(){const {data}=await db.from('business_profiles').select('*').eq('user_id',state.user.id).maybeSingle();$('#bizName').value=data?.business_name||'';$('#bizCategory').value=data?.specialties?.[0]||'היינדמן';$('#bizAbout').value=data?.description||'';$('#bizArea').value=(data?.service_areas||[]).join(', ');$('#bizPhone').value=data?.business_phone||''}
$('#profileForm').onsubmit=async e=>{
  e.preventDefault();const category=$('#bizCategory').value,trade=catDb[category]||'handyman';
  const row={user_id:state.user.id,business_name:$('#bizName').value.trim(),description:$('#bizAbout').value.trim(),specialties:[category],service_areas:$('#bizArea').value.split(',').map(x=>x.trim()).filter(Boolean),business_phone:$('#bizPhone').value.trim()};
  const {error}=await db.from('business_profiles').upsert(row);if(error){toast(error.message);return}
  const {error:settingsError}=await db.from('professional_settings').upsert({professional_id:state.user.id,trade},{onConflict:'professional_id'});if(settingsError){toast(settingsError.message);return}
  if(!state.isAdmin)await db.from('profiles').update({role:'professional'}).eq('id',state.user.id);
  await loadMe();toast('פרופיל העסק נשמר בענן');show('#homeView')
};

// V25 — מרכז עבודה חכם להיינדמן ולחשמלאי
function defaultProSettings(){return {trade:'handyman',default_hourly_rate:180,default_travel_cost:50,overhead_percent:15,risk_percent:15,payment_link:'',quote_terms:'המחיר כפוף לכך שתיאור העבודה והתמונות שנמסרו מלאים ומדויקים. עבודה נוספת תבוצע רק לאחר אישור הלקוח.',electrician_license_number:'',electrician_license_expiry:null}}
async function loadProSettings(){
  const fallback=defaultProSettings();
  const {data,error}=await db.from('professional_settings').select('*').eq('professional_id',state.user.id).maybeSingle();
  if(error){state.proSettings=fallback;return fallback}
  state.proSettings={...fallback,...(data||{})};return state.proSettings
}
function renderJobTypeOptions(trade,selected=''){
  const select=$('#proJobType');if(!select)return;
  select.innerHTML=(TRADE_JOBS[trade]||TRADE_JOBS.handyman).map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${label}</option>`).join('')
}
function setTrade(trade){
  $('#proJobTrade').value=trade;$$('.trade-choice').forEach(b=>b.classList.toggle('active',b.dataset.trade===trade));renderJobTypeOptions(trade);
}
function calculateProPrice(updateQuote=true){
  const s=state.proSettings||defaultProSettings(),hours=Math.max(.25,numberValue('#proLaborHours')),rate=numberValue('#proHourlyRate'),materials=numberValue('#proMaterialsCost'),travel=numberValue('#proTravelCost'),assistant=numberValue('#proAssistantCost');
  const base=hours*rate+materials+travel+assistant;
  const floor=round10(base*(1+(Number(s.overhead_percent)||0)/100));
  const recommended=round10(floor*(1+(Number(s.risk_percent)||0)/100));
  $('#priceFloor').textContent=money(floor);$('#recommendedPrice').textContent=money(recommended);
  $('#priceFloor').dataset.value=String(floor);$('#recommendedPrice').dataset.value=String(recommended);
  const quoted=$('#proQuotedPrice');if(updateQuote&&quoted&&!quoted.dataset.edited)quoted.value=recommended||'';
  return {floor,recommended}
}
function uniq(items){return [...new Set(items.filter(Boolean))]}
function analyzeProfessionalJob(render=true){
  const trade=$('#proJobTrade').value||'handyman',description=$('#proJobDescription').value.trim(),selectedType=$('#proJobType').value,rules=ANALYSIS_RULES[trade],questions=[...(rules.base.questions||[])],tools=[...(rules.base.tools||[])],warnings=[...(rules.base.warnings||[])];
  Object.entries(rules).forEach(([key,rule])=>{if(key==='base')return;const matches=key===selectedType||(rule.keys||[]).some(word=>description.includes(word));if(matches){questions.push(...(rule.questions||[]));tools.push(...(rule.tools||[]));warnings.push(...(rule.warnings||[]))}});
  const result={questions:uniq(questions),tools:uniq(tools),warnings:uniq(warnings)};state.lastProAnalysis=result;
  if(render){const box=$('#smartAnalysis');box.classList.remove('hidden');box.innerHTML=`<div class="analysis-head"><b>בדיקת הכנה לעבודה</b><span>${tradeIcon(trade)} ${tradeHe[trade]||'בעל מקצוע'}</span></div><div class="analysis-columns"><div><h4>שאלות ללקוח</h4><ul>${result.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ul></div><div><h4>ציוד שכדאי לבדוק</h4><ul>${result.tools.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div></div>${result.warnings.length?`<div class="safety-box">${result.warnings.map(w=>`<p>⚠️ ${esc(w)}</p>`).join('')}</div>`:''}`}
  return result
}
async function openNewProJob(){
  const s=await loadProSettings();$('#proJobForm').reset();$('#proQuotedPrice').dataset.edited='';setTrade(s.trade||'handyman');
  $('#proHourlyRate').value=s.default_hourly_rate||180;$('#proTravelCost').value=s.default_travel_cost||0;$('#proLaborHours').value=1;$('#proMaterialsCost').value=0;$('#proAssistantCost').value=0;$('#proDepositAmount').value=0;$('#smartAnalysis').classList.add('hidden');calculateProPrice(true);show('#proJobFormView')
}
async function loadProJobs(){
  const {data,error}=await db.from('pro_jobs').select('*').eq('professional_id',state.user.id).order('created_at',{ascending:false});
  if(error){toast('מרכז העבודה עדיין אינו מוכן: '+error.message);state.proJobs=[];return []}
  state.proJobs=data||[];return state.proJobs
}
function proJobMatchesFilter(job,filter){if(filter==='open')return !['paid','cancelled'].includes(job.status);if(filter==='unpaid')return job.payment_status!=='paid'&&!['lead','cancelled'].includes(job.status);if(filter==='paid')return job.payment_status==='paid';return true}
function renderProJobCards(){
  const box=$('#proJobsList'),filter=$('#proJobStatusFilter').value,rows=state.proJobs.filter(j=>proJobMatchesFilter(j,filter));
  box.innerHTML=rows.length?rows.map(j=>`<button class="job-card" data-pro-job="${j.id}"><div class="job-card-top"><span class="trade-badge ${j.trade}">${tradeIcon(j.trade)} ${tradeHe[j.trade]||''}</span><span class="status-pill status-${j.status}">${jobStatusHe[j.status]||j.status}</span></div><h3>${esc(j.customer_name)}</h3><p>${esc(j.description)}</p><div class="job-card-bottom"><span>📍 ${esc(j.city||'לא צוין')}</span><strong>${money(j.quoted_price||j.recommended_price)}</strong></div></button>`).join(''):'<div class="empty-state card"><span>🧰</span><h3>עדיין אין עבודות במרכז</h3><p>הכנס את הפנייה הבאה ותקבל תמחור, שאלות הכנה והצעה מוכנה.</p></div>';
  box.querySelectorAll('[data-pro-job]').forEach(b=>b.onclick=()=>openProJobDetail(b.dataset.proJob))
}
async function openProWorkspace(){
  if(!state.user)return;await Promise.all([loadProSettings(),loadProJobs()]);
  const open=state.proJobs.filter(j=>!['paid','cancelled'].includes(j.status)).length,unpaid=state.proJobs.filter(j=>j.payment_status!=='paid'&&!['lead','cancelled'].includes(j.status)).length;
  const start=new Date();start.setDate(1);start.setHours(0,0,0,0);const revenue=state.proJobs.filter(j=>j.payment_status==='paid'&&new Date(j.updated_at)>=start).reduce((sum,j)=>sum+Number(j.actual_paid||0),0);
  $('#proOpenCount').textContent=open;$('#proUnpaidCount').textContent=unpaid;$('#proMonthRevenue').textContent=money(revenue);renderProJobCards();show('#proWorkspaceView')
}
$('#proWorkspaceBtn').onclick=openProWorkspace;$('#newProJobBtn').onclick=openNewProJob;$('#proJobStatusFilter').onchange=renderProJobCards;
$$('.trade-choice').forEach(b=>b.onclick=()=>{setTrade(b.dataset.trade);analyzeProfessionalJob(false)});
['#proLaborHours','#proHourlyRate','#proMaterialsCost','#proTravelCost','#proAssistantCost'].forEach(id=>$(id).addEventListener('input',()=>calculateProPrice(true)));
$('#proQuotedPrice').addEventListener('input',()=>$('#proQuotedPrice').dataset.edited='1');
$('#analyzeJobBtn').onclick=()=>{if(!$('#proJobDescription').value.trim()){toast('כתוב קודם מה הלקוח ביקש');return}analyzeProfessionalJob(true);calculateProPrice(true)};
if(SpeechRecognition){const proRec=new SpeechRecognition();proRec.lang='he-IL';$('#proVoiceBtn').onclick=()=>{try{proRec.start();$('#proVoiceStatus').textContent='מקשיב…'}catch{}};proRec.onresult=e=>{$('#proJobDescription').value=e.results[0][0].transcript||'';$('#proVoiceStatus').textContent='הטקסט נקלט. עכשיו אפשר לנתח את העבודה.'}}else{$('#proVoiceBtn').disabled=true;$('#proVoiceStatus').textContent='הכתבה קולית אינה נתמכת בדפדפן הזה.'}
$('#proJobForm').onsubmit=async e=>{
  e.preventDefault();const analysis=analyzeProfessionalJob(false),pricing=calculateProPrice(false),scheduled=$('#proScheduledAt').value;
  const row={professional_id:state.user.id,trade:$('#proJobTrade').value,customer_name:$('#proCustomerName').value.trim(),customer_phone:$('#proCustomerPhone').value.trim(),city:$('#proCustomerCity').value.trim(),job_type:$('#proJobType').value,description:$('#proJobDescription').value.trim(),scheduled_at:scheduled?new Date(scheduled).toISOString():null,labor_hours:numberValue('#proLaborHours'),hourly_rate:numberValue('#proHourlyRate'),materials_cost:numberValue('#proMaterialsCost'),travel_cost:numberValue('#proTravelCost'),assistant_cost:numberValue('#proAssistantCost'),overhead_percent:Number(state.proSettings?.overhead_percent)||0,risk_percent:Number(state.proSettings?.risk_percent)||0,price_floor:pricing.floor,recommended_price:pricing.recommended,quoted_price:numberValue('#proQuotedPrice'),deposit_amount:numberValue('#proDepositAmount'),quote_scope:$('#proQuoteScope').value.trim(),quote_terms:state.proSettings?.quote_terms||'',customer_questions:analysis.questions,tools_needed:analysis.tools,warnings:analysis.warnings,status:'quoted',payment_status:'unpaid'};
  const {data,error}=await db.from('pro_jobs').insert(row).select('*').single();if(error){toast('לא נשמר: '+error.message);return}state.selectedProJob=data;toast('העבודה נשמרה וההצעה מוכנה');await loadProJobs();await renderProJobDetail();show('#proJobDetailView')
};
function quoteUrl(job){return `${location.origin}${location.pathname}?quote=${job.public_token}`}
function openWhatsapp(phone,message){const number=waNumber(phone);if(!number){toast('חסר מספר טלפון ללקוח');return}window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`,'_blank','noopener')}
function questionMessage(job){return `שלום ${job.customer_name}, כדי להכין את העבודה והמחיר בצורה מדויקת אשמח למענה קצר:\n\n${(job.customer_questions||[]).map((q,i)=>`${i+1}. ${q}`).join('\n')}\n\nתודה, ${state.profile?.full_name||state.proSettings?.business_name||'מחירלי'}`}
function quoteMessage(job){return `שלום ${job.customer_name}, הכנתי עבורך הצעת מחיר עבור: ${job.description}\n\nמחיר: ${money(job.quoted_price)}${Number(job.deposit_amount)>0?`\nמקדמה: ${money(job.deposit_amount)}`:''}\n\nלצפייה ואישור ההצעה:\n${quoteUrl(job)}`}
function paymentMessage(job){const amount=Math.max(0,Number(job.quoted_price||0)-Number(job.actual_paid||0)),link=safeHttpUrl(state.proSettings?.payment_link);return `שלום ${job.customer_name}, לתשלום ${money(amount)} עבור העבודה: ${job.description}.${link?`\n\nקישור מאובטח לתשלום:\n${link}`:''}\n\nתודה.`}
async function copyText(value,success='הקישור הועתק'){
  try{await navigator.clipboard.writeText(value);toast(success)}catch{const ta=document.createElement('textarea');ta.value=value;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast(success)}
}
function renderList(items,empty='לא הוגדר'){return items?.length?`<ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<p class="muted">${empty}</p>`}
async function renderProJobDetail(){
  const j=state.selectedProJob;if(!j)return;await loadProSettings();$('#jobDetailTitle').textContent=j.customer_name;
  const below=Number(j.quoted_price)<Number(j.price_floor),remaining=Math.max(0,Number(j.quoted_price||0)-Number(j.actual_paid||0));
  $('#jobDetailContent').innerHTML=`<div class="job-hero card"><div class="job-card-top"><span class="trade-badge ${j.trade}">${tradeIcon(j.trade)} ${tradeHe[j.trade]||'בעל מקצוע'}</span><span class="status-pill status-${j.status}">${jobStatusHe[j.status]||j.status}</span></div><h3>${esc(j.description)}</h3><p>👤 ${esc(j.customer_name)} · 📍 ${esc(j.city||'לא צוין')} · 🗓️ ${esc(formatDateTime(j.scheduled_at))}</p><div class="contact-actions"><a class="secondary" href="tel:${esc(j.customer_phone)}">📞 התקשר</a><button class="secondary" data-job-action="questions">💬 שלח שאלות</button></div></div>
  <div class="detail-price-grid"><div class="card"><small>מחיר מינימום</small><strong>${money(j.price_floor)}</strong></div><div class="card featured"><small>הצעה ללקוח</small><strong>${money(j.quoted_price)}</strong></div><div class="card"><small>יתרה לתשלום</small><strong>${money(remaining)}</strong></div></div>
  ${below?'<div class="price-warning">⚠️ המחיר ללקוח נמוך ממחיר המינימום שחושב לעבודה.</div>':''}
  <div class="card"><h3>הצעת המחיר</h3><p>${esc(j.quote_scope||'לא נוסף פירוט להצעה.')}</p>${j.quote_terms?`<div class="terms-box">${esc(j.quote_terms)}</div>`:''}<div class="action-grid"><button class="primary" data-job-action="quote">שלח הצעה בווטסאפ</button><button class="secondary" data-job-action="copy">העתק קישור ללקוח</button><button class="secondary" data-job-action="print">הדפס / שמור PDF</button><button class="secondary" data-job-action="payment">שלח בקשת תשלום</button></div></div>
  <div class="card"><label class="inline-select">מצב העבודה<select id="jobStatusSelect">${Object.entries(jobStatusHe).map(([v,l])=>`<option value="${v}" ${j.status===v?'selected':''}>${l}</option>`).join('')}</select></label></div>
  <div class="analysis-display card"><div><h3>שאלות ללקוח</h3>${renderList(j.customer_questions)}</div><div><h3>ציוד והכנה</h3>${renderList(j.tools_needed)}</div>${j.warnings?.length?`<div class="safety-box">${j.warnings.map(w=>`<p>⚠️ ${esc(w)}</p>`).join('')}</div>`:''}</div>`;
  $('#actualHours').value=j.actual_hours||j.labor_hours||'';$('#actualMaterials').value=j.actual_materials_cost??j.materials_cost??'';$('#actualPaid').value=j.actual_paid||'';renderActualProfit(j);
  $('#jobDetailContent').querySelector('[data-job-action="questions"]').onclick=()=>openWhatsapp(j.customer_phone,questionMessage(j));
  $('#jobDetailContent').querySelector('[data-job-action="quote"]').onclick=()=>openWhatsapp(j.customer_phone,quoteMessage(j));
  $('#jobDetailContent').querySelector('[data-job-action="copy"]').onclick=()=>copyText(quoteUrl(j));
  $('#jobDetailContent').querySelector('[data-job-action="print"]').onclick=()=>printJobQuote(j);
  $('#jobDetailContent').querySelector('[data-job-action="payment"]').onclick=()=>{if(!safeHttpUrl(state.proSettings?.payment_link)){toast('יש להוסיף קודם קישור תשלום תקין בהגדרות');return}openWhatsapp(j.customer_phone,paymentMessage(j))};
  $('#jobStatusSelect').onchange=async e=>{const status=e.target.value,payment_status=status==='paid'?'paid':j.payment_status;const {error}=await db.from('pro_jobs').update({status,payment_status}).eq('id',j.id).eq('professional_id',state.user.id);if(error){toast(error.message);return}j.status=status;j.payment_status=payment_status;toast('מצב העבודה עודכן');await loadProJobs();await renderProJobDetail()};
  await loadJobMedia(j.id)
}
async function openProJobDetail(id){state.selectedProJob=state.proJobs.find(j=>j.id===id);if(!state.selectedProJob){const {data}=await db.from('pro_jobs').select('*').eq('id',id).eq('professional_id',state.user.id).single();state.selectedProJob=data}await renderProJobDetail();show('#proJobDetailView')}
function renderActualProfit(job){
  const box=$('#actualProfitResult'),paid=Number(job.actual_paid||0),hours=Number(job.actual_hours||0);if(!paid||!hours){box.classList.add('hidden');box.innerHTML='';return}
  const profit=Number(job.actual_profit ?? (paid-Number(job.actual_materials_cost||0)-Number(job.travel_cost||0)-Number(job.assistant_cost||0)-paid*(Number(job.overhead_percent||0)/100))),perHour=Number(job.actual_hourly_profit ?? profit/hours);
  box.classList.remove('hidden');box.innerHTML=`<small>הרווח המחושב לאחר חומרים, נסיעה והוצאות העסק</small><strong>${money(profit)}</strong><span>${money(perHour)} לשעה</span>`
}
$('#actualProfitForm').onsubmit=async e=>{
  e.preventDefault();const j=state.selectedProJob,hours=numberValue('#actualHours'),materials=numberValue('#actualMaterials'),paid=numberValue('#actualPaid');if(!hours||!paid){toast('יש להזין זמן וסכום שהתקבלו');return}
  const profit=paid-materials-Number(j.travel_cost||0)-Number(j.assistant_cost||0)-paid*(Number(j.overhead_percent||0)/100),perHour=profit/hours;
  const changes={actual_hours:hours,actual_materials_cost:materials,actual_paid:paid,actual_profit:profit,actual_hourly_profit:perHour,status:'paid',payment_status:'paid'};
  const {data,error}=await db.from('pro_jobs').update(changes).eq('id',j.id).eq('professional_id',state.user.id).select('*').single();if(error){toast(error.message);return}state.selectedProJob=data;toast('העבודה נסגרה והרווח חושב');await loadProJobs();await renderProJobDetail()
};
function printJobQuote(j){
  const win=window.open('','_blank');if(!win){toast('יש לאפשר חלונות קופצים כדי לשמור PDF');return}
  const business=state.profile?.full_name||'בעל מקצוע',license=j.trade==='electrician'&&state.proSettings?.electrician_license_number?`<p>רישיון חשמלאי: ${esc(state.proSettings.electrician_license_number)}</p>`:'';
  win.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>הצעת מחיר - ${esc(j.customer_name)}</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;padding:24px;color:#16202b}header{border-bottom:3px solid #22a773;padding-bottom:18px}h1{margin:0}section{margin:28px 0}.price{font-size:34px;font-weight:800;color:#16885c}.terms{background:#f3f6f8;padding:16px;border-radius:12px;white-space:pre-wrap}footer{margin-top:50px;border-top:1px solid #ccd5dc;padding-top:15px;color:#667}button{padding:10px 18px}@media print{button{display:none}}</style></head><body><header><h1>הצעת מחיר</h1><p>${esc(business)}</p>${license}</header><section><b>לכבוד: ${esc(j.customer_name)}</b><p>${esc(j.description)}</p><p>${esc(j.quote_scope||'')}</p><div class="price">${money(j.quoted_price)}</div>${Number(j.deposit_amount)>0?`<p>מקדמה: ${money(j.deposit_amount)}</p>`:''}</section><section class="terms">${esc(j.quote_terms||'')}</section><footer>הופק באמצעות מחירלי · ${new Date().toLocaleDateString('he-IL')}</footer><button onclick="print()">הדפס / שמור PDF</button></body></html>`);win.document.close()
}
async function loadJobMedia(jobId){
  const {data,error}=await db.from('pro_job_media').select('*').eq('job_id',jobId).eq('professional_id',state.user.id).order('created_at');if(error){$('#jobMediaGrid').innerHTML='<p class="muted">לא ניתן לטעון תמונות.</p>';return}
  state.proJobMedia=data||[];const rendered=[];for(const m of state.proJobMedia){const {data:signed}=await db.storage.from('job-media').createSignedUrl(m.storage_path,3600);rendered.push({...m,url:signed?.signedUrl||''})}
  $('#jobMediaGrid').innerHTML=rendered.length?rendered.map(m=>`<figure><img src="${esc(m.url)}" alt="${m.phase==='before'?'לפני העבודה':'אחרי העבודה'}"><figcaption>${m.phase==='before'?'לפני':'אחרי'} <button data-delete-media="${m.id}">מחק</button></figcaption></figure>`).join(''):'<p class="muted">עדיין לא נוספו תמונות.</p>';
  $('#jobMediaGrid').querySelectorAll('[data-delete-media]').forEach(b=>b.onclick=async()=>{const m=state.proJobMedia.find(x=>x.id===b.dataset.deleteMedia);if(!m||!confirm('למחוק את התמונה מתיק העבודה?'))return;await db.storage.from('job-media').remove([m.storage_path]);await db.from('pro_job_media').delete().eq('id',m.id).eq('professional_id',state.user.id);await loadJobMedia(jobId)})
}
async function uploadJobPhoto(file,phase){
  const j=state.selectedProJob;if(!j||!file)return;if(!file.type.startsWith('image/')){toast('אפשר להעלות תמונות בלבד');return}if(file.size>8*1024*1024){toast('התמונה גדולה מדי. עד 8MB');return}
  const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase(),path=`${state.user.id}/${j.id}/${crypto.randomUUID()}.${ext}`;toast('מעלה תמונה…');
  const {error:uploadError}=await db.storage.from('job-media').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(uploadError){toast('ההעלאה נכשלה: '+uploadError.message);return}
  const {error}=await db.from('pro_job_media').insert({job_id:j.id,professional_id:state.user.id,storage_path:path,phase});if(error){await db.storage.from('job-media').remove([path]);toast('התמונה לא נשמרה: '+error.message);return}toast('התמונה נשמרה בתיק העבודה');await loadJobMedia(j.id)
}
$('#beforePhotoInput').onchange=e=>{const file=e.target.files?.[0];uploadJobPhoto(file,'before');e.target.value=''};$('#afterPhotoInput').onchange=e=>{const file=e.target.files?.[0];uploadJobPhoto(file,'after');e.target.value=''};
async function loadProSettingsForm(){
  const s=await loadProSettings();$('#settingsTrade').value=s.trade;$('#settingsHourlyRate').value=s.default_hourly_rate;$('#settingsTravelCost').value=s.default_travel_cost;$('#settingsOverhead').value=s.overhead_percent;$('#settingsRisk').value=s.risk_percent;$('#settingsPaymentLink').value=s.payment_link||'';$('#settingsLicenseNumber').value=s.electrician_license_number||'';$('#settingsLicenseExpiry').value=s.electrician_license_expiry||'';$('#settingsQuoteTerms').value=s.quote_terms||'';$('#electricianSettings').classList.toggle('hidden',s.trade!=='electrician');show('#proSettingsView')
}
$('#proSettingsBtn').onclick=loadProSettingsForm;$('#settingsTrade').onchange=e=>$('#electricianSettings').classList.toggle('hidden',e.target.value!=='electrician');
$('#proSettingsForm').onsubmit=async e=>{
  e.preventDefault();const enteredPaymentLink=$('#settingsPaymentLink').value.trim(),paymentLink=safeHttpUrl(enteredPaymentLink);if(enteredPaymentLink&&!paymentLink){toast('קישור התשלום חייב להתחיל ב־https:// או http://');return}const row={professional_id:state.user.id,trade:$('#settingsTrade').value,default_hourly_rate:numberValue('#settingsHourlyRate'),default_travel_cost:numberValue('#settingsTravelCost'),overhead_percent:numberValue('#settingsOverhead'),risk_percent:numberValue('#settingsRisk'),payment_link:paymentLink||null,electrician_license_number:$('#settingsLicenseNumber').value.trim()||null,electrician_license_expiry:$('#settingsLicenseExpiry').value||null,quote_terms:$('#settingsQuoteTerms').value.trim()};
  const {data,error}=await db.from('professional_settings').upsert(row).select('*').single();if(error){toast(error.message);return}state.proSettings=data;toast('ההגדרות נשמרו');await openProWorkspace()
};
async function loadPublicQuote(token){
  const box=$('#publicQuoteContent');show('#publicQuoteView');box.innerHTML='<div class="card public-quote-card"><h2>טוען הצעת מחיר…</h2></div>';
  const {data,error}=await db.rpc('get_public_job_quote',{p_token:token});const q=Array.isArray(data)?data[0]:data;if(error||!q){box.innerHTML='<div class="card public-quote-card"><h2>ההצעה אינה זמינה</h2><p>הקישור שגוי או שההצעה בוטלה.</p></div>';return}
  const approved=['approved','scheduled','in_progress','completed','paid'].includes(q.status),lic=q.trade==='electrician'&&q.electrician_license_number?`<span class="badge">רישיון חשמלאי ${esc(q.electrician_license_number)}</span>`:'',paymentLink=safeHttpUrl(q.payment_link);
  box.innerHTML=`<div class="public-quote-brand">מחירלי <small>הצעת מחיר דיגיטלית</small></div><div class="card public-quote-card"><div class="trade-badge ${q.trade}">${tradeIcon(q.trade)} ${tradeHe[q.trade]||'בעל מקצוע'}</div><h2>שלום ${esc(q.customer_name)}</h2><p class="quote-intro">${esc(q.business_name)} הכין עבורך הצעת מחיר.</p><div class="quote-description"><small>עבור</small><b>${esc(q.description)}</b><p>${esc(q.quote_scope||'')}</p></div><div class="public-price"><small>מחיר ההצעה</small><strong>${money(q.quoted_price)}</strong>${Number(q.deposit_amount)>0?`<span>מקדמה: ${money(q.deposit_amount)}</span>`:''}</div><div class="badges">${lic}${q.scheduled_at?`<span class="badge">🗓️ ${esc(formatDateTime(q.scheduled_at))}</span>`:''}</div>${q.quote_terms?`<div class="terms-box">${esc(q.quote_terms)}</div>`:''}${approved?'<div class="approved-box">✓ ההצעה אושרה</div>':'<button id="approvePublicQuoteBtn" class="primary big">אישור הצעת המחיר</button>'}${approved&&paymentLink&&Number(q.deposit_amount)>0?`<a class="primary big pay-link" target="_blank" rel="noopener" href="${esc(paymentLink)}">תשלום מקדמה</a>`:''}<p class="note">האישור מתייחס להיקף העבודה ולתנאים המופיעים בהצעה.</p></div>`;
  const btn=$('#approvePublicQuoteBtn');if(btn)btn.onclick=async()=>{btn.disabled=true;btn.textContent='מאשר…';const {error}=await db.rpc('approve_public_job_quote',{p_token:token});if(error){toast('לא ניתן לאשר: '+error.message);btn.disabled=false;btn.textContent='אישור הצעת המחיר';return}toast('ההצעה אושרה בהצלחה');await loadPublicQuote(token)}
}

async function loadAdmin(){
  if(!state.isAdmin){toast('אין הרשאת מנהל');return}
  const [{data:summary,error:se},{data:jobs,error:je},{data:businesses,error:be}]=await Promise.all([
    db.rpc('admin_professional_summary'),db.rpc('admin_list_pro_jobs'),db.rpc('admin_list_businesses_v28')
  ]);
  if(se||je||be){toast((se||je||be).message||'לא ניתן לטעון את אזור המנהל');return}
  const sum=summary||{};state.adminJobs=jobs||[];state.adminBusinesses=businesses||[];
  $('#adminBusinessesCount').textContent=sum.businesses||0;$('#adminJobsCount').textContent=sum.jobs||0;$('#adminOpenJobsCount').textContent=sum.open_jobs||0;$('#adminRevenueTotal').textContent=money(sum.revenue||0);
  renderAdminJobs();renderAdminBusinesses()
}
function renderAdminJobs(){
  const box=$('#adminJobsList'),filter=$('#adminTradeFilter').value,rows=state.adminJobs.filter(j=>filter==='all'||j.trade===filter);
  box.innerHTML=rows.length?rows.map(j=>`<div class="item admin-job"><div class="job-card-top"><span class="trade-badge ${j.trade}">${tradeIcon(j.trade)} ${tradeHe[j.trade]||'בעל מקצוע'}</span><span class="status-pill status-${j.status}">${jobStatusHe[j.status]||j.status}</span></div><h3>${esc(j.customer_name||'לקוח')}</h3><p>${esc(j.description||'')}</p><div class="admin-user-meta"><span class="badge">🏪 ${esc(j.business_name||'עסק ללא שם')}</span><span class="badge">📍 ${esc(j.city||'לא צוין')}</span><span class="badge">${money(j.quoted_price)}</span></div></div>`).join(''):'<div class="card"><h3>אין עבודות בקטגוריה הזו</h3></div>'
}
function renderAdminBusinesses(){
  const box=$('#adminBusinessesList');
  box.innerHTML=state.adminBusinesses.length?state.adminBusinesses.map(b=>`<div class="item"><div class="job-card-top"><h3>${esc(b.business_name||b.email||'בעל עסק')}</h3><span class="trade-badge ${b.trade}">${tradeIcon(b.trade)} ${tradeHe[b.trade]||'טרם הוגדר'}</span></div><p>${esc(b.email||'')}</p><div class="admin-user-meta"><span class="badge">${Number(b.job_count||0)} עבודות</span><span class="badge">הכנסות ${money(b.revenue||0)}</span>${b.service_areas?.length?`<span class="badge">📍 ${esc(b.service_areas.join(', '))}</span>`:''}</div></div>`).join(''):'<div class="card"><h3>עדיין אין בעלי עסקים</h3></div>'
}
const adminBtn=$('#adminBtn'); if(adminBtn)adminBtn.onclick=async()=>{await loadAdmin();show('#adminView')};
$('#adminTradeFilter').onchange=renderAdminJobs;
$$('.admin-tab').forEach(b=>b.onclick=()=>{$$('.admin-tab').forEach(x=>x.classList.toggle('active',x===b));['jobs','businesses'].forEach(k=>$(`#admin${k[0].toUpperCase()+k.slice(1)}Panel`).classList.toggle('hidden',b.dataset.adminTab!==k))});

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
$('#payboxPayBtn').href=PAYBOX_URL;
$('#paidBtn').onclick=async()=>{
  if(!state.user){toast('יש להתחבר קודם');return}
  const {data:pending}=await db.from('payment_requests').select('id').eq('user_id',state.user.id).eq('status','pending').limit(1).maybeSingle();
  if(pending){toast('כבר ממתין אצלנו תשלום לאישור.');await renderPaymentStatus();return}
  const {error}=await db.from('payment_requests').insert({user_id:state.user.id,amount:15,credits:3,status:'pending'});
  if(error){toast('לא ניתן לסמן תשלום: '+error.message);return}
  await renderPaymentStatus();
  toast('קיבלנו. מנהל מחירלי קיבל התראה על התשלום.');
};

// PWA install flow (V13)
let deferredInstallPrompt=null;
const installBtn=document.querySelector('#installAppBtn');
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
function updateInstallButton(){
  if(!installBtn)return;
  installBtn.classList.toggle('hidden',isStandalone());
}
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredInstallPrompt=e;
  if(installBtn) installBtn.classList.remove('hidden');
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  if(installBtn) installBtn.classList.add('hidden');
  toast('מחירלי הותקנה כאפליקציה ✅');
});
if(installBtn) installBtn.onclick=async()=>{
  if(isStandalone()){toast('מחירלי כבר מותקנת כאפליקציה');return}
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null;
    updateInstallButton();
    return;
  }
  toast('בתפריט הדפדפן בחר ״התקנת אפליקציה״ — לא ״הוסף קיצור דרך״.');
};
updateInstallButton();

boot();

if('serviceWorker' in navigator){
  let reloadingForUpdate=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloadingForUpdate)return;
    reloadingForUpdate=true;
    location.reload();
  });
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{}));
}
