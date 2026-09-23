const SUPABASE_URL='https://jgnbcrlvsudfqfofmvlx.supabase.co';
const SUPABASE_KEY='sb_publishable_WnOhGZSlik7zqpO-cRYGvA_lOUz68Wp';
const AUTH_RECOVERY_INTENT=new URLSearchParams(location.search).get('reset')==='1'||new URLSearchParams(location.hash.replace(/^#/,'')).get('type')==='recovery'||new URLSearchParams(location.search).has('code');
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const QUOTE_PDF_BUCKET='quote-pdfs';
const QUOTE_LINK_SECONDS=30*24*60*60;
const ROKACH_DIGITAL_WHATSAPP='972552715782';
const LEGAL_VERSION='2026-09-15-v2';
const QUOTE_CONSENT_VERSION='quote-approval-2026-09-v1';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={user:null,profile:null,businessProfile:null,role:'pro',credits:0,requests:[],offers:[],jobs:[],selectedRequest:null,selectedJob:null,isAdmin:false,notifications:[],unreadNotifications:0,notificationTimer:null,timerInterval:null,lastNotificationSeenAt:null,proSettings:null,proJobs:[],selectedProJob:null,proJobMedia:[],proCustomers:[],proServices:[],proReminders:[],proAppointments:[],proTimeEntries:[],quoteItems:[],adminJobs:[],adminBusinesses:[],subscription:null,billingSettings:null,onboarding:null};
let adminAnalyticsRange='today',adminAnalyticsTimer=null;
const ANALYTICS_VISITOR_KEY='mehirli_visitor_v1';
const ANALYTICS_ATTRIBUTION_KEY='mehirli_attribution_v2';
function analyticsVisitorId(){
  let id='';try{id=localStorage.getItem(ANALYTICS_VISITOR_KEY)||''}catch{}
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){
    id=crypto.randomUUID();try{localStorage.setItem(ANALYTICS_VISITOR_KEY,id)}catch{}
  }
  return id
}
function analyticsAttribution(){
  const params=new URLSearchParams(location.search),campaign=params.get('utm_campaign')||'',from=params.get('from')||'';
  let raw=params.get('utm_source')||params.get('source')||'';
  const normalize=value=>{
    const source=String(value||'').toLowerCase().replace(/^www\./,'');
    if((['fb','facebook','facebook.com','m.facebook.com','l.facebook.com','lm.facebook.com'].includes(source)||source==='ig'||source==='instagram')&&campaign)return 'meta_paid';
    if(source==='facebook-groups'||source==='facebook_groups')return 'facebook_groups';
    if(['fb','facebook','facebook.com','m.facebook.com','l.facebook.com','lm.facebook.com'].includes(source))return 'facebook_organic';
    if(['ig','instagram','instagram.com','l.instagram.com'].includes(source))return 'instagram_organic';
    if(['trade-sites','trade_sites','handyman-sites','handyman_sites'].includes(source))return 'trade_sites';
    if(source.includes('whatsapp'))return 'whatsapp';
    return source
  };
  let saved=null;try{saved=JSON.parse(localStorage.getItem(ANALYTICS_ATTRIBUTION_KEY)||'null')}catch{}
  if(!raw&&params.has('fbclid'))raw='facebook';
  if(!raw&&params.has('ttclid'))raw='tiktok';
  if(!raw&&from&&from!=='landing')raw=from;
  if(raw){
    const value={source:normalize(raw)||'direct',campaign};
    try{localStorage.setItem(ANALYTICS_ATTRIBUTION_KEY,JSON.stringify(value))}catch{}
    return value
  }
  if(saved?.source)return {source:saved.source,campaign:saved.campaign||''};
  if(document.referrer){
    try{
      const ref=new URL(document.referrer),host=ref.hostname.replace(/^www\./,'');
      if(host!==location.hostname){
        const value={source:normalize(host)||'direct',campaign:''};
        try{localStorage.setItem(ANALYTICS_ATTRIBUTION_KEY,JSON.stringify(value))}catch{}
        return value
      }
    }catch{}
  }
  const value={source:'direct',campaign:''};try{localStorage.setItem(ANALYTICS_ATTRIBUTION_KEY,JSON.stringify(value))}catch{}
  return value
}
async function trackAppEvent(eventName){
  const a=analyticsAttribution(),payload={p_visitor_id:analyticsVisitorId(),p_event_name:eventName,p_source:a.source,p_campaign:a.campaign};
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/track_app_event_v40`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true,cache:'no-store'});
    if(!response.ok)throw new Error(`analytics_http_${response.status}`)
  }catch{try{await db.rpc('track_app_event_v40',payload)}catch{}}
}
function authErrorMessage(error){
  const message=String(error?.message||'').toLowerCase();
  if(message.includes('already registered')||message.includes('already been registered'))return 'כתובת האימייל כבר רשומה במערכת. אפשר להתחבר לחשבון הקיים.';
  if(message.includes('invalid login credentials'))return 'האימייל או הסיסמה אינם נכונים.';
  if(message.includes('email not confirmed'))return 'יש לאשר את כתובת האימייל לפני ההתחברות.';
  if(message.includes('password'))return 'הסיסמה אינה תקינה. יש להזין לפחות 6 תווים.';
  if(message.includes('rate limit'))return 'בוצעו יותר מדי ניסיונות. נסה שוב בעוד מספר דקות.';
  return 'לא ניתן להשלים את הפעולה כרגע. נסה שוב או פנה לתמיכה.'
}
function isExistingAccountError(error){const message=String(error?.message||'').toLowerCase();return message.includes('already registered')||message.includes('already been registered')}
function setAuthMode(mode='login'){
  const signup=mode==='signup';
  $('#showLoginModeBtn')?.classList.toggle('active',!signup);$('#showSignupModeBtn')?.classList.toggle('active',signup);
  $('#signupFields')?.classList.toggle('hidden',!signup);$('.auth-login')?.classList.toggle('hidden',signup);$('#forgotPasswordBtn')?.classList.toggle('hidden',signup);
  if($('#authFormBadge'))$('#authFormBadge').textContent=signup?'14 ימים עלינו':'ברוכים השבים';
  if($('#authFormTitle'))$('#authFormTitle').textContent=signup?'פותחים חשבון ומתחילים לעבוד':'כניסה למחירלי';
  if($('#authFormSubtitle'))$('#authFormSubtitle').textContent=signup?'הקמה קצרה. בלי כרטיס אשראי ובלי התחייבות.':'מכניסים אימייל וסיסמה ונכנסים מיד.';
  if(!signup&&$('#authName'))$('#authName').value='';
}
function showExistingAccountLogin(){
  setAuthMode('login');
  const note=$('#authNote');
  note.innerHTML='כתובת האימייל כבר רשומה במערכת. <button id="existingAccountLoginBtn" class="text-link" type="button">כבר יש לך חשבון? לחץ כאן להתחברות</button>';
  $('#existingAccountLoginBtn').onclick=()=>{$('#authPassword').focus();$('.auth-login')?.scrollIntoView({behavior:'smooth',block:'center'});toast('הזן את הסיסמה ולחץ על כניסה')}
}
function trackMetaTrialSignup(user){
  const userId=String(user?.id||'').trim();if(!userId||typeof window.fbq!=='function')return false;
  const key=`mehirli_meta_start_trial_v1:${userId}`;
  try{if(localStorage.getItem(key)==='sent')return false}catch{}
  window.fbq('track','StartTrial',{content_name:'Mehirli',content_category:'business_management',value:0,currency:'ILS'});
  try{localStorage.setItem(key,'sent')}catch{}
  return true
}
function updateGreeting(){
  const heading=$('#homeGreeting');if(!heading)return;const hour=new Date().getHours();
  const greeting=hour>=5&&hour<12?'בוקר טוב':hour>=12&&hour<17?'צהריים טובים':hour>=17&&hour<23?'ערב טוב':'לילה טוב';
  heading.textContent=`${greeting}, מתחילים מכאן`
}
function isStandaloneMode(){return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true}
function isAndroidInAppBrowser(){const ua=navigator.userAgent||'';return /Android/i.test(ua)&&/(FBAN|FBAV|Instagram)/i.test(ua)}
function openInChrome(){const url=new URL(location.href);url.searchParams.set('view','signup');url.hash='';const target=`intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;end`;location.href=target}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateGreeting()});
const quotePdfCache=new Map();
const catDb={'רכב':'vehicle','מיזוג':'air_conditioning','לבית':'home','הנדימן':'handyman','היינדמן':'handyman','חשמלאי':'electrician'}, catHe={vehicle:'רכב',air_conditioning:'מיזוג',home:'לבית',handyman:'הנדימן',electrician:'חשמלאי'};
const tradeHe={general:'עבודה',handyman:'הנדימן',electrician:'חשמלאי',home:'שירותי בית',air_conditioning:'מיזוג'};
const jobStatusHe={lead:'פנייה חדשה',quoted:'הצעה מוכנה לשליחה',approved:'ההצעה אושרה',scheduled:'נקבע מועד',in_progress:'בביצוע',completed:'העבודה הסתיימה',paid:'שולם',cancelled:'בוטל'};
const subscriptionStatusHe={admin:'מנהל — ללא חיוב',trial:'תקופת ניסיון',active:'מנוי פעיל',past_due:'נדרש להסדיר תשלום',suspended:'השירות מושהה',cancelled:'המנוי בוטל',not_started:'טרם הופעל'};
const PAYMENT_PROVIDERS={cardcom:'קארדקום',grow:'Grow',meshulam:'משולם',bit:'bit לעסקים',paybox:'PayBox',other:'חברת סליקה אחרת'};
const PRICING_MODE_HE={fixed:'מחיר קבוע',hourly:'לפי שעה',half_day:'חצי יום',full_day:'יום עבודה'};
const BUILTIN_SERVICES={
  handyman:[['תליית טלוויזיה','tv','fixed',350,2],['הרכבת רהיט','furniture','hourly',180,2],['חצי יום תיקונים','general','half_day',700,4],['יום עבודה הנדימן','general','full_day',1300,8]],
  electrician:[['ביקור ואבחון','general','fixed',280,1],['החלפת שקע או מפסק','outlet','fixed',250,1],['חצי יום חשמלאי','general','half_day',850,4],['יום עבודה חשמלאי','general','full_day',1600,8]],
  home:[['ביקור ואבחון','general','fixed',250,1],['טיפול בנזילה קלה','plumbing','fixed',320,1.5],['חצי יום שירותי בית','general','half_day',750,4],['יום עבודה שירותי בית','general','full_day',1400,8]],
  air_conditioning:[['ביקור טכנאי','general','fixed',300,1],['ניקוי מזגן','cleaning','fixed',350,1.5],['חצי יום מיזוג','general','half_day',900,4],['יום עבודה מיזוג','general','full_day',1700,8]]
};
const TRADE_JOBS={
  handyman:[['general','תיקון כללי'],['tv','תליית טלוויזיה'],['shelves','מדפים ותלייה'],['furniture','הרכבת רהיטים'],['door','דלת / ארון'],['sealing','איטום וסיליקון'],['faucet','ברז / סיפון'],['blinds','תריס / וילון'],['other','אחר']],
  electrician:[['general','בדיקה / תקלה כללית'],['outlet','שקע או מפסק'],['lighting','תאורה'],['short','קצר / הפסקת חשמל'],['panel','לוח חשמל'],['boiler','דוד חשמל'],['three_phase','תלת־פאזי'],['ev','עמדת טעינה'],['other','אחר']],
  home:[['general','שירות בית כללי'],['plumbing','נזילה / אינסטלציה'],['drain','סתימה וניקוז'],['toilet','אסלה וניאגרה'],['water_heater','דוד ומים חמים'],['lock','מנעול ודלת'],['other','אחר']],
  air_conditioning:[['general','בדיקת מזגן'],['no_cooling','לא מקרר / מחמם'],['leak','נזילת מים'],['cleaning','ניקוי עמוק'],['installation','התקנה / העתקה'],['noise','רעש או ריח'],['other','אחר']]
};
const ANALYSIS_RULES={
  general:{base:{questions:[],tools:[],warnings:[]}},
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
function show(id){if(id!=='#proJobDetailView'&&state.timerInterval){clearInterval(state.timerInterval);state.timerInterval=null}$$('.view').forEach(v=>v.classList.remove('active'));$(id).classList.add('active');window.scrollTo({top:0,behavior:'smooth'})}
function esc(s=''){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function icon(c){return({רכב:'🚗',מיזוג:'❄️',לבית:'🏠',הנדימן:'🔨',היינדמן:'🔨',חשמלאי:'⚡'})[c]||'🧰'}
function tradeIcon(trade){return ({handyman:'🔨',electrician:'⚡',home:'🏠',air_conditioning:'❄️'})[trade]||'🧰'}
function money(n){return `${Math.round(Number(n)||0).toLocaleString('he-IL')} ₪`}
function numberValue(selector){return Number($(selector)?.value)||0}
function normalizedPhone(value=''){return String(value).replace(/\D/g,'')}
function round10(n){return Math.ceil(Math.max(0,n)/10)*10}
function waNumber(phone=''){const digits=String(phone).replace(/\D/g,'');return digits.startsWith('0')?'972'+digits.slice(1):digits}
function formatDateTime(value){if(!value)return 'לא נקבע';try{return new Date(value).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'})}catch{return value}}
function currentPublicQuoteToken(){const token=new URLSearchParams(location.search).get('quote');return /^[0-9a-f-]{36}$/i.test(token||'')?token:null}
function safeHttpUrl(value=''){
  if(!value)return '';
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return ''}
}
function safePaymentUrl(value=''){
  if(!value)return '';
  try{const url=new URL(value);return url.protocol==='https:'?url.href:''}catch{return ''}
}
function paymentProviderLabel(provider=''){return PAYMENT_PROVIDERS[provider]||'חברת הסליקה'}
function formatDate(value){if(!value)return '';try{return new Date(value).toLocaleDateString('he-IL')}catch{return ''}}
function daysLeft(value){if(!value)return 0;return Math.max(0,Math.ceil((new Date(value).getTime()-Date.now())/86400000))}
async function rpcWithFallback(primary,fallback,args={}){
  const first=await db.rpc(primary,args);if(!first.error)return first;
  if(!fallback||first.error.code!=='PGRST202')return first;
  return db.rpc(fallback,args)
}
function paymentReturn(){
  const params=new URLSearchParams(location.search),status=params.get('payment'),order=params.get('order');
  return ['success','failed','cancelled'].includes(status||'')&&/^[0-9a-f-]{36}$/i.test(order||'')?{status,order}:null
}
function clearPaymentReturn(){
  const url=new URL(location.href);url.searchParams.delete('payment');url.searchParams.delete('order');history.replaceState({},'',url.href)
}
function hasServiceAccess(){return state.isAdmin||state.subscription?.has_access===true}
async function loadOnboardingProgress(){
  if(!state.user||state.isAdmin){state.onboarding=null;return null}
  const {data,error}=await db.rpc('get_my_onboarding_progress_v83');
  if(error){state.onboarding=null;return null}
  state.onboarding=data||null;return state.onboarding
}
async function markOnboardingStep(step){
  if(!state.user||state.isAdmin)return state.onboarding;
  const {data,error}=await db.rpc('mark_my_onboarding_step_v83',{p_step:step});
  if(!error&&data)state.onboarding=data;
  return state.onboarding
}
async function loadSubscription(){
  if(!state.user)return null;
  const {data,error}=await rpcWithFallback('get_my_subscription_v38','get_my_subscription_v33');
  if(error){state.subscription={status:'suspended',has_access:false,failure_reason:'לא ניתן לבדוק את מצב המנוי'};return state.subscription}
  state.subscription=data||null;renderSubscriptionBanner();return state.subscription
}
function renderSubscriptionBanner(){
  const button=$('#subscriptionBanner'),entry=$('#subscriptionBtn'),s=state.subscription;if(!button||!s)return;
  if(state.isAdmin){button.classList.add('hidden');if(entry)entry.classList.add('hidden');return}
  if(entry)entry.classList.remove('hidden');button.classList.remove('hidden');
  if(s.status==='trial')button.innerHTML=`<b>🎁 תקופת ניסיון</b><span>נשארו ${daysLeft(s.trial_ends_at)} ימים · לצפייה במנוי</span>`;
  else if(s.status==='active')button.innerHTML=`<b>✓ המנוי פעיל</b><span>בתוקף עד ${formatDate(s.current_period_ends_at)}</span>`;
  else if(s.status==='past_due')button.innerHTML=`<b>⚠️ התשלום דורש טיפול</b><span>אפשר להמשיך עד ${formatDate(s.grace_ends_at)}</span>`;
  else button.innerHTML='<b>🔒 השירות מושהה</b><span>המידע נשמר · יש להסדיר תשלום</span>';
  button.dataset.status=s.status||''
}
async function routeAfterLogin(){
  if(!state.isAdmin&&!(await ensureLegalConsent()))return;
  if(!state.isAdmin&&isStandaloneMode()&&!state.onboarding?.installed_at)await markOnboardingStep('installed');
  if(!state.isAdmin&&!state.onboarding?.installed_at){
    show('#homeView');
    showPostSignupInstall();return
  }
  if(!state.isAdmin&&state.subscription?.failure_reason==='installation_required')await activateTrialAfterInstall();
  if(!state.isAdmin&&!hasServiceAccess()){await openSubscription();return}
  show('#homeView');
  if(!state.isAdmin&&!state.onboarding?.first_quote_created_at)showFirstQuoteWelcome()
}
function showPostSignupInstall(){
  const overlay=$('#postSignupInstall'),button=$('#postSignupInstallBtn');if(!overlay)return;
  if(button)button.textContent=isAndroidInAppBrowser()?'פתיחת מחירלי ב־Chrome להתקנה':isIosDevice()?' הוראות התקנה באייפון':'⬇ התקנת אפליקציה באנדרואיד';
  if($('#postSignupInstallText'))$('#postSignupInstallText').textContent=isAndroidInAppBrowser()?'פייסבוק אינו מאפשר התקנת אפליקציות. בלחיצה הבאה מחירלי תיפתח ב־Chrome, ושם ניתן יהיה להתקין.':isIosDevice()?'באייפון מתקינים דרך Safari: שיתוף ← הוספה למסך הבית ← הוסף.':'באנדרואיד לוחצים על הכפתור ומאשרים התקנת אפליקציה.';
  overlay.classList.remove('hidden')
}
function showFirstQuoteWelcome(){
  $('#postSignupInstall')?.classList.add('hidden');
  $('#firstQuoteWelcome')?.classList.remove('hidden')
}
function openPendingSignupEdit(){
  $('#postSignupInstall')?.classList.add('hidden');
  setAuthMode('signup');
  const button=$('#signupBtn');button.dataset.mode='edit';button.textContent='שמירת הפרטים וחזרה להתקנה';
  $('#authEmail').value=state.user?.email||'';$('#authEmail').disabled=true;
  $('#authPassword').value='';$('#authPassword').disabled=true;$('#authPassword').placeholder='הסיסמה כבר נשמרה';
  $('#authName').value=state.user?.user_metadata?.full_name||state.profile?.full_name||'';
  $('#signupLegalConsent').checked=true;$('#signupLegalConsent').disabled=true;
  show('#authView');$('#authForm').scrollIntoView({behavior:'smooth',block:'start'})
}
function resetPendingSignupEdit(){
  const button=$('#signupBtn');delete button.dataset.mode;button.textContent='📲 הרשמה והמשך להתקנת האפליקציה';
  $('#authEmail').disabled=false;$('#authPassword').disabled=false;$('#authPassword').placeholder='';$('#signupLegalConsent').disabled=false;$('.auth-login')?.classList.remove('hidden')
}
async function activateTrialAfterInstall(){
  const {data,error}=await db.rpc('activate_my_trial_after_install_v70');
  if(error){toast('לא ניתן להפעיל את הניסיון כרגע. נסה לפתוח שוב את מחירלי.');return false}
  if(!data?.activated){toast('תקופת הניסיון לא הופעלה. פנה לתמיכה.');return false}
  $('#postSignupInstall')?.classList.add('hidden');
  await loadSubscription();trackAppEvent('trial_activated');show('#homeView');showFirstQuoteWelcome();toast('14 ימי הניסיון התחילו עכשיו ✅');return true
}
async function ensureLegalConsent(){
  const {data,error}=await db.rpc('has_accepted_legal_terms_v40',{p_document_version:LEGAL_VERSION});
  if(!error&&data===true)return true;
  if(state.user?.user_metadata?.legal_version===LEGAL_VERSION){
    const accepted=await db.rpc('accept_legal_terms_v40',{p_document_version:LEGAL_VERSION,p_accepted_via:'signup'});
    if(!accepted.error)return true
  }
  show('#legalConsentView');return false
}
function requireServiceAccess(){if(hasServiceAccess())return true;openSubscription();toast('יש להסדיר את המנוי כדי להמשיך');return false}

function notificationIcon(kind){
  return ({new_job:'🧰',new_quote:'💬',payment_pending:'💳',subscription_payment_pending:'💳',subscription_status:'🔐',quote_selected:'🤝',direct_quote_approved:'✅'})[kind]||'🔔'
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
    else if((kind==='payment_pending'||kind==='subscription_payment_pending')&&state.isAdmin){await openAdmin()}
    else if(kind==='subscription_status'){await openSubscription()}
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
  const {data:bp}=await db.from('business_profiles').select('*').eq('user_id',state.user.id).maybeSingle();state.businessProfile=bp||null;
  refreshDeveloperSupportLink();
  await loadSubscription();
  await loadOnboardingProgress();
  const ab=$('#adminBtn');if(ab)ab.classList.toggle('hidden',!state.isAdmin);
  const wn=$('#whatsappSetupNotice');if(wn)wn.classList.toggle('hidden',!!String(bp?.business_phone||'').trim());
  const np=$('#enablePhoneNotificationsBtn');if(np&&'Notification' in window)np.classList.toggle('hidden',Notification.permission!=='default');
  startNotificationPolling()
}
function isPasswordRecovery(){
  const params=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.replace(/^#/,''));
  return AUTH_RECOVERY_INTENT||params.get('reset')==='1'||hash.get('type')==='recovery'||params.has('code')
}
function showPasswordReset(){show('#passwordResetView');setTimeout(()=>$('#newPassword')?.focus(),50)}
db.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'){
    state.user=session?.user||null;
    showPasswordReset()
  }
});
async function boot(){updateGreeting();trackAppEvent('app_open');const params=new URLSearchParams(location.search),signupHandoff=params.get('view')==='signup';if(signupHandoff)trackAppEvent('signup_form_open');if(isStandaloneMode())trackAppEvent('standalone_open');const quoteToken=currentPublicQuoteToken();if(quoteToken){await loadPublicQuote(quoteToken);return}const {data:{session}}=await db.auth.getSession();state.user=session?.user||null;if(isPasswordRecovery()&&state.user){showPasswordReset();return}if(signupHandoff&&state.user){await db.auth.signOut({scope:'local'});state.user=null;stopNotificationPolling()}if(signupHandoff){const url=new URL(location.href);url.searchParams.delete('view');history.replaceState({},'',url.pathname+url.search+url.hash)}if(state.user){await loadMe();trackAppEvent('account_active');if(paymentReturn())await handlePaymentReturn();else await routeAfterLogin()}else{setAuthMode(signupHandoff?'signup':'login');show('#authView');if(params.get('password_reset')==='success')$('#authNote').textContent='הסיסמה שונתה בהצלחה. אפשר להתחבר עם הסיסמה החדשה.';else if(isPasswordRecovery())$('#authNote').textContent='קישור האיפוס אינו תקף או שפג תוקפו. בקשו קישור חדש.';else if(signupHandoff)$('#authNote').textContent='המשך הרשמה או התחבר לחשבון שיצרת כדי להתקין את מחירלי.';if(isAndroidInAppBrowser())$('#inAppBrowserNotice')?.classList.remove('hidden')}}
$('#showLoginModeBtn').onclick=()=>setAuthMode('login');
$('#showSignupModeBtn').onclick=()=>setAuthMode('signup');
$('#authForm').onsubmit=async e=>{e.preventDefault();$('#authNote').textContent='מתחבר…';const {data,error}=await db.auth.signInWithPassword({email:$('#authEmail').value.trim(),password:$('#authPassword').value});if(error){$('#authNote').textContent=authErrorMessage(error);return}state.user=data.user;await loadMe();$('#authNote').textContent='';if(paymentReturn())await handlePaymentReturn();else await routeAfterLogin()};
$('#forgotPasswordBtn').onclick=async()=>{
  const email=$('#authEmail').value.trim(),note=$('#authNote'),button=$('#forgotPasswordBtn');
  if(!email){note.textContent='הזינו קודם את כתובת האימייל שלכם.';$('#authEmail').focus();return}
  button.disabled=true;note.textContent='שולח קישור לאיפוס הסיסמה…';
  const redirectTo=new URL('reset-password.html?reset=1',location.href).href;
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});
  button.disabled=false;
  note.textContent=error?'לא ניתן לשלוח כרגע. נסו שוב בעוד מספר דקות.':'אם האימייל רשום במחירלי, נשלח אליו קישור לקביעת סיסמה חדשה.'
};
$('#passwordResetForm').onsubmit=async e=>{
  e.preventDefault();
  const password=$('#newPassword').value,confirmPassword=$('#confirmNewPassword').value,note=$('#passwordResetNote'),button=$('#saveNewPasswordBtn');
  if(password.length<8){note.textContent='הסיסמה חייבת להכיל לפחות 8 תווים.';return}
  if(password!==confirmPassword){note.textContent='הסיסמאות אינן זהות.';return}
  button.disabled=true;note.textContent='שומר את הסיסמה החדשה…';
  const {error}=await db.auth.updateUser({password});
  if(error){button.disabled=false;note.textContent=authErrorMessage(error);return}
  await db.auth.signOut({scope:'local'});state.user=null;
  const url=new URL(location.href);url.searchParams.delete('reset');url.searchParams.delete('code');url.hash='';history.replaceState({},'',url.pathname+url.search);
  $('#authPassword').value='';$('#newPassword').value='';$('#confirmNewPassword').value='';show('#authView');$('#authNote').textContent='הסיסמה שונתה בהצלחה. אפשר להתחבר עם הסיסמה החדשה.'
};
$('#signupBtn').onclick=async()=>{const name=$('#authName').value.trim();if($('#signupBtn').dataset.mode==='edit'){if(!name){toast('יש להזין את השם שלך');return}const {data,error}=await db.auth.updateUser({data:{...state.user.user_metadata,full_name:name}});if(error){toast('לא ניתן לשמור את השינוי כרגע');return}state.user=data.user;await db.from('profiles').update({full_name:name}).eq('id',state.user.id);resetPendingSignupEdit();showPostSignupInstall();toast('פרטי ההרשמה עודכנו');return}const email=$('#authEmail').value.trim(),password=$('#authPassword').value,role='professional';if(!name){toast('יש להזין את השם שלך');return}if(!email||password.length<6){toast('הזן אימייל וסיסמה של לפחות 6 תווים');return}if(!$('#signupLegalConsent').checked){toast('כדי להירשם יש לאשר את תנאי השימוש ומדיניות הפרטיות');return}trackAppEvent('signup_attempt');const {data,error}=await db.auth.signUp({email,password,options:{data:{role,full_name:name,legal_version:LEGAL_VERSION,legal_accepted_at:new Date().toISOString()}}});if(error){const message=authErrorMessage(error);toast(message);if(isExistingAccountError(error))showExistingAccountLogin();else $('#authNote').textContent=message;return}const isNewSignup=!!data.user&&(!Array.isArray(data.user.identities)||data.user.identities.length>0);if(isNewSignup)await trackAppEvent('trial_signup');if(data.session){state.user=data.user;await loadMe();const {error:consentError}=await db.rpc('accept_legal_terms_v40',{p_document_version:LEGAL_VERSION,p_accepted_via:'signup'});if(consentError){toast('ההרשמה נשמרה, אך אישור התנאים לא נשמר. נסה להתחבר מחדש.');return}await routeAfterLogin()}else{$('#authNote').textContent='נשלח אליך אימייל לאישור ההרשמה. לאחר האישור חזור והתחבר.'}};
let legalReturnView='#authView';
$$('[data-open-legal]').forEach(button=>button.onclick=()=>{const active=$('.view.active');legalReturnView=active?.id?`#${active.id}`:(state.user?'#homeView':'#authView');show('#legalInfoView')});
$('#legalInfoBackBtn').onclick=()=>show(legalReturnView||'#authView');
$('#existingLegalConsent').onchange=e=>$('#acceptLegalConsentBtn').disabled=!e.target.checked;
$('#acceptLegalConsentBtn').onclick=async()=>{const button=$('#acceptLegalConsentBtn');if(!$('#existingLegalConsent').checked)return;button.disabled=true;button.textContent='שומר את האישור…';const {error}=await db.rpc('accept_legal_terms_v40',{p_document_version:LEGAL_VERSION,p_accepted_via:'app'});button.textContent='אישור והמשך למחירלי';if(error){toast('לא ניתן לשמור את האישור: '+error.message);button.disabled=false;return}await routeAfterLogin()};
$('#legalConsentLogoutBtn').onclick=async()=>{stopNotificationPolling();await db.auth.signOut();state.user=null;refreshDeveloperSupportLink();show('#authView')};
$('#logoutBtn').onclick=async()=>{stopNotificationPolling();await db.auth.signOut();state.user=null;refreshDeveloperSupportLink();show('#authView')};
$$('.category').forEach(b=>b.onclick=()=>{$('#reqCategory').value=b.dataset.category;show('#requestView')});
$('#profileBtn').onclick=async()=>{if(!requireServiceAccess())return;await fillProfile();show('#profileView')};$$('.back:not(#legalInfoBackBtn)').forEach(b=>b.onclick=async()=>{if(!state.isAdmin&&!hasServiceAccess()){await openSubscription()}else if(b.dataset.backTo==='workspace'){await openProWorkspace()}else show('#homeView')});
$('#whatsappSetupNotice').onclick=async()=>{if(!requireServiceAccess())return;await fillProfile();show('#profileView')};
let openSettingsAfterProfileSave=false;
$('#profileOpenSettingsBtn').onclick=()=>{openSettingsAfterProfileSave=true;$('#profileForm').requestSubmit()};
$('#settingsOpenProfileBtn').onclick=async()=>{await fillProfile();show('#profileView')};
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
$('#offerForm').onsubmit=async e=>{e.preventDefault();toast('מסלול ההצעות הישן אינו פעיל. מחירלי מיועדת כעת לניהול העסק שלך.');await openProWorkspace()};
function businessLogoUrl(path=state.businessProfile?.logo_path){return path?db.storage.from('business-logos').getPublicUrl(path).data?.publicUrl||'':''}
function renderBusinessLogoEditor(){const img=$('#bizLogoPreview'),remove=$('#removeBizLogoBtn'),url=businessLogoUrl();if(!img)return;img.src=url;img.classList.toggle('hidden',!url);remove.classList.toggle('hidden',!url)}
async function fillProfile(){const {data}=await db.from('business_profiles').select('*').eq('user_id',state.user.id).maybeSingle();state.businessProfile=data||null;$('#bizName').value=data?.business_name||'';$('#bizLegalName').value=data?.legal_name||'';$('#bizNumber').value=data?.business_number||'';$('#bizEmail').value=data?.business_email||'';$('#bizAddress').value=data?.business_address||'';$('#bizProfession').value=data?.specialties?.[0]||'';$('#bizAbout').value=data?.description||'';$('#bizArea').value=(data?.service_areas||[]).join(', ');$('#bizPhone').value=data?.business_phone||'';renderBusinessLogoEditor()}
$('#profileForm').onsubmit=async e=>{
  e.preventDefault();if(!requireServiceAccess())return;
  const row={user_id:state.user.id,business_name:$('#bizName').value.trim(),legal_name:$('#bizLegalName').value.trim()||null,business_number:$('#bizNumber').value.trim()||null,business_email:$('#bizEmail').value.trim()||null,business_address:$('#bizAddress').value.trim()||null,description:$('#bizAbout').value.trim(),specialties:[$('#bizProfession').value.trim()].filter(Boolean),service_areas:$('#bizArea').value.split(',').map(x=>x.trim()).filter(Boolean),business_phone:$('#bizPhone').value.trim(),logo_path:state.businessProfile?.logo_path||null};
  const {error}=await db.from('business_profiles').upsert(row);if(error){toast(error.message);return}
  if(!state.isAdmin)await db.from('profiles').update({role:'professional'}).eq('id',state.user.id);
  await loadMe();toast('פרופיל העסק נשמר בענן');if(openSettingsAfterProfileSave){openSettingsAfterProfileSave=false;await loadProSettingsForm()}else show('#homeView')
};
$('#bizLogoInput').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(!requireServiceAccess())return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){toast('אפשר להעלות לוגו JPG, PNG או WEBP עד 2MB');return}const ext=file.type.split('/')[1].replace('jpeg','jpg'),path=`${state.user.id}/logo-${Date.now()}.${ext}`,old=state.businessProfile?.logo_path;const {error}=await db.storage.from('business-logos').upload(path,file,{contentType:file.type,upsert:false});if(error){toast('הלוגו לא הועלה: '+error.message);return}const {error:updateError}=await db.from('business_profiles').upsert({user_id:state.user.id,logo_path:path},{onConflict:'user_id'});if(updateError){await db.storage.from('business-logos').remove([path]);toast('הלוגו לא נשמר: '+updateError.message);return}if(old)await db.storage.from('business-logos').remove([old]);state.businessProfile={...(state.businessProfile||{}),logo_path:path};renderBusinessLogoEditor();toast('הלוגו נשמר')};
$('#removeBizLogoBtn').onclick=async()=>{const path=state.businessProfile?.logo_path;if(!path||!confirm('להסיר את לוגו העסק מההצעות?'))return;const {error}=await db.from('business_profiles').update({logo_path:null}).eq('user_id',state.user.id);if(error){toast(error.message);return}await db.storage.from('business-logos').remove([path]);state.businessProfile.logo_path=null;renderBusinessLogoEditor();toast('הלוגו הוסר')};

// V25 — מרכז עבודה חכם להנדימן ולחשמלאי
function defaultProSettings(){return {trade:'handyman',default_hourly_rate:180,default_travel_cost:50,overhead_percent:0,risk_percent:0,default_pricing_mode:'hourly',half_day_hours:4,half_day_price:700,full_day_hours:8,full_day_price:1300,overtime_rate:200,time_rounding_minutes:15,payment_provider:'',payment_link:'',quote_terms:'המחיר כפוף לכך שתיאור העבודה והתמונות שנמסרו מלאים ומדויקים. עבודה נוספת תבוצע רק לאחר אישור הלקוח.',electrician_license_number:'',electrician_license_expiry:null}}
async function loadProSettings(){
  const fallback=defaultProSettings();
  const {data,error}=await db.from('professional_settings').select('*').eq('professional_id',state.user.id).maybeSingle();
  if(error){state.proSettings=fallback;return fallback}
  state.proSettings={...fallback,...(data||{})};return state.proSettings
}
function renderJobTypeOptions(trade,selected=''){
  const select=$('#proJobType');if(!select||select.tagName!=='SELECT')return;
  select.innerHTML=(TRADE_JOBS[trade]||TRADE_JOBS.handyman).map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${label}</option>`).join('')
}
async function loadProCustomers(){const {data,error}=await db.from('pro_customers').select('*').eq('professional_id',state.user.id).order('updated_at',{ascending:false});state.proCustomers=error?[]:(data||[]);return state.proCustomers}
async function loadProServices(){const {data,error}=await db.from('pro_services').select('*').eq('professional_id',state.user.id).eq('is_active',true).order('trade').order('name');state.proServices=error?[]:(data||[]);return state.proServices}
async function loadProReminders(){const {data,error}=await db.from('pro_reminders').select('*').eq('professional_id',state.user.id).eq('is_done',false).order('remind_at').limit(100);state.proReminders=error?[]:(data||[]);return state.proReminders}
async function loadProAppointments(){const {data,error}=await db.from('pro_appointments').select('*').eq('professional_id',state.user.id).neq('status','cancelled').order('appointment_at').limit(200);if(error){toast('לא ניתן לטעון את הפגישות: '+error.message);state.proAppointments=[];return []}state.proAppointments=data||[];return state.proAppointments}
function renderCustomerOptions(){const select=$('#proCustomerSelect');if(!select)return;select.innerHTML='<option value="">לקוח חדש</option>'+state.proCustomers.map(c=>`<option value="${c.id}">${esc(c.name)} · ${esc(c.phone)}</option>`).join('')}
function serviceTemplatesForTrade(trade){if(trade==='general')return [...state.proServices];const built=(BUILTIN_SERVICES[trade]||[]).map((x,i)=>({id:`builtin:${trade}:${i}`,trade,name:x[0],job_type:x[1],pricing_mode:x[2],base_price:x[3],default_hours:x[4],default_materials_cost:0,quote_scope:''}));return [...built,...state.proServices.filter(s=>s.trade===trade)]}
function renderServiceTemplateOptions(trade){const select=$('#proServiceTemplate');if(!select)return;select.innerHTML='<option value="">ללא תבנית</option>'+serviceTemplatesForTrade(trade).map(s=>`<option value="${s.id}">${esc(s.name)} · ${money(s.base_price)}</option>`).join('')}
function setTrade(trade){
  $('#proJobTrade').value=trade;renderJobTypeOptions(trade);renderServiceTemplateOptions(trade);
}
function modeBasePrice(mode,s=state.proSettings||defaultProSettings()){if(mode==='half_day')return Number(s.half_day_price)||0;if(mode==='full_day')return Number(s.full_day_price)||0;return Number(s.default_hourly_rate)||0}
function setPricingMode(mode,resetValues=true){const s=state.proSettings||defaultProSettings();$('#proPricingMode').value=mode;if(resetValues){$('#proBasePrice').value=modeBasePrice(mode,s);if(mode==='half_day')$('#proLaborHours').value=s.half_day_hours||4;else if(mode==='full_day')$('#proLaborHours').value=s.full_day_hours||8}const hints={hourly:`המחיר הבסיסי הוא מחיר לשעה.`,fixed:'המחיר הבסיסי הוא סכום קבוע לעבודה.',half_day:`כולל עד ${s.half_day_hours||4} שעות; מעבר לכך מחושבת שעה נוספת.`,full_day:`כולל עד ${s.full_day_hours||8} שעות; מעבר לכך מחושבת שעה נוספת.`};$('#pricingModeHint').textContent=hints[mode]||'';calculateProPrice(true)}
function renderQuoteItemsEditor(){const box=$('#quoteItemsEditor');if(!box)return;box.innerHTML=state.quoteItems.map((item,index)=>`<div class="quote-item-row" data-item-index="${index}"><label>תיאור<input data-item-field="description" value="${esc(item.description||'')}" placeholder="סעיף"></label><label>כמות<input data-item-field="quantity" type="number" min="0.01" step="0.01" value="${Number(item.quantity)||1}"></label><label>מחיר<input data-item-field="unit_price" type="number" min="0" step="1" value="${Number(item.unit_price)||0}"></label><button data-remove-item="${index}" type="button" aria-label="הסר סעיף">×</button></div>`).join('');box.querySelectorAll('[data-item-field]').forEach(input=>input.oninput=()=>{const row=input.closest('[data-item-index]'),item=state.quoteItems[Number(row.dataset.itemIndex)];item[input.dataset.itemField]=input.dataset.itemField==='description'?input.value:Number(input.value)||0;calculateProPrice(true)});box.querySelectorAll('[data-remove-item]').forEach(button=>button.onclick=()=>{state.quoteItems.splice(Number(button.dataset.removeItem),1);renderQuoteItemsEditor();calculateProPrice(true)})}
function addQuoteItem(item={description:'',quantity:1,unit_price:0,estimated_cost:0}){state.quoteItems.push(item);renderQuoteItemsEditor()}
function calculateProPrice(updateQuote=true){
  const s=state.proSettings||defaultProSettings(),mode=$('#proPricingMode')?.value||'hourly',hours=Math.max(.25,numberValue('#proLaborHours')),basePrice=numberValue('#proBasePrice'),materials=numberValue('#proMaterialsCost'),travel=numberValue('#proTravelCost'),assistant=numberValue('#proAssistantCost');
  const included=mode==='half_day'?Number(s.half_day_hours)||4:mode==='full_day'?Number(s.full_day_hours)||8:0,overtime=Math.max(0,hours-included)*(Number(s.overtime_rate)||0);const labor=mode==='hourly'?hours*basePrice:basePrice+overtime;
  const base=labor+materials+travel+assistant;
  const calculatedFloor=round10(base),floorInput=$('#priceFloor');
  if(floorInput?.dataset.manualOverride!=='true')floorInput.value=calculatedFloor;
  const floor=Math.max(0,numberValue('#priceFloor'));
  const recommended=floor;
  $('#recommendedPrice').textContent=money(recommended);
  $('#priceFloor').dataset.calculatedValue=String(calculatedFloor);$('#recommendedPrice').dataset.value=String(recommended);
  const itemSubtotal=state.quoteItems.filter(i=>String(i.description||'').trim()).reduce((sum,i)=>sum+(Number(i.quantity)||0)*(Number(i.unit_price)||0),0),subtotal=itemSubtotal||recommended,discountType=$('#proDiscountType')?.value||'none',discountValue=Math.max(0,numberValue('#proDiscountValue'));let discountAmount=discountType==='percent'?subtotal*Math.min(100,discountValue)/100:discountType==='fixed'?Math.min(subtotal,discountValue):0;discountAmount=Math.round(discountAmount*100)/100;const calculatedTotal=Math.max(0,subtotal-discountAmount),quoteInput=$('#proQuotedPrice');
  if(updateQuote&&quoteInput?.dataset.manualOverride!=='true')quoteInput.value=calculatedTotal;
  const total=Math.max(0,numberValue('#proQuotedPrice'));
  $('#proSubtotal').textContent=money(subtotal);$('#proDiscountAmount').textContent=money(discountAmount);$('#profitabilityWarning').classList.toggle('hidden',total>=floor);
  return {floor,recommended,subtotal,discountAmount,total,calculatedTotal,labor}
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
  if(!requireServiceAccess())return;
  const s=await loadProSettings();await Promise.all([loadProCustomers(),loadProServices()]);$('#proJobForm').reset();state.quoteItems=[];renderQuoteItemsEditor();renderCustomerOptions();setTrade(ANALYSIS_RULES[s.trade]?s.trade:'handyman');
  $('#proTravelCost').value=s.default_travel_cost||0;$('#proLaborHours').value=1;$('#proMaterialsCost').value=0;$('#proAssistantCost').value=0;$('#proDepositAmount').value=0;$('#proDiscountType').value='none';$('#proDiscountValue').value=0;$('#proDiscountValue').disabled=true;$('#priceFloor').value='';$('#priceFloor').dataset.manualOverride='false';$('#proQuotedPrice').value='';$('#proQuotedPrice').dataset.manualOverride='false';const valid=new Date();valid.setDate(valid.getDate()+14);$('#proQuoteValidUntil').value=valid.toISOString().slice(0,10);$('#smartAnalysis').classList.add('hidden');setPricingMode(s.default_pricing_mode||'hourly',true);const restored=restoreProJobDraft();setJobStep(0);show('#proJobFormView');if(restored)toast('הטיוטה הקודמת שוחזרה')
}
function setJobStep(step){
  $$('#proJobForm [data-job-panel]').forEach(panel=>{panel.hidden=Number(panel.dataset.jobPanel)!==step});
  $$('#proJobForm [data-job-step]').forEach(button=>{const active=Number(button.dataset.jobStep)===step;button.classList.toggle('active',active);button.setAttribute('aria-expanded',String(active))});
  if(step===3)renderJobReview();
  if($('#proJobFormView').classList.contains('active')&&step>=0)$(`#proJobForm [data-job-step="${step}"]`).scrollIntoView({block:'start',behavior:'smooth'});
}
function renderJobReview(){
  const name=$('#proCustomerName').value.trim()||'טרם הוזן',phone=$('#proCustomerPhone').value.trim()||'טרם הוזן',description=$('#proJobDescription').value.trim()||'טרם הוזן';
  $('#proJobReview').innerHTML=`<div><small>לקוח</small><strong>${esc(name)}</strong><span>${esc(phone)}</span></div><div><small>עבודה</small><strong>${esc(description)}</strong></div><div><small>מחיר ההצעה</small><strong>${money(numberValue('#proQuotedPrice'))}</strong></div>`;
}
$$('#proJobForm [data-job-step]').forEach(button=>button.onclick=()=>{const target=Number(button.dataset.jobStep);setJobStep(button.getAttribute('aria-expanded')==='true'?-1:target)});
function proJobDraftKey(){return state.user?.id?`mehirli_pro_job_draft_v1:${state.user.id}`:''}
function saveProJobDraft(){const key=proJobDraftKey(),form=$('#proJobForm');if(!key||!form)return;const fields={};[...form.elements].forEach(el=>{if(el.id&&['INPUT','TEXTAREA','SELECT'].includes(el.tagName)&&el.type!=='file')fields[el.id]=el.type==='checkbox'?el.checked:el.value});try{localStorage.setItem(key,JSON.stringify({fields,quoteItems:state.quoteItems,manualFloor:$('#priceFloor').dataset.manualOverride==='true',manualPrice:$('#proQuotedPrice').dataset.manualOverride==='true',savedAt:new Date().toISOString()}))}catch{}}
function restoreProJobDraft(){const key=proJobDraftKey();if(!key)return false;let draft=null;try{draft=JSON.parse(localStorage.getItem(key)||'null')}catch{}if(!draft?.fields)return false;const trade=ANALYSIS_RULES[draft.fields.proJobTrade]&&draft.fields.proJobTrade!=='general'?draft.fields.proJobTrade:'handyman';setTrade(trade);Object.entries(draft.fields).forEach(([id,value])=>{if(id==='proJobTrade')return;const el=document.getElementById(id);if(!el)return;if(el.type==='checkbox')el.checked=Boolean(value);else el.value=value});state.quoteItems=Array.isArray(draft.quoteItems)?draft.quoteItems:[];renderQuoteItemsEditor();$('#priceFloor').dataset.manualOverride=String(draft.manualFloor??Boolean(draft.fields.priceFloor));$('#proQuotedPrice').dataset.manualOverride=String(draft.manualPrice??Boolean(draft.fields.proQuotedPrice));setPricingMode($('#proPricingMode').value||'hourly',false);calculateProPrice(false);return true}
function clearProJobDraft(){const key=proJobDraftKey();if(key)try{localStorage.removeItem(key)}catch{}}
let proJobDraftTimer=null;$('#proJobForm').addEventListener('input',()=>{clearTimeout(proJobDraftTimer);proJobDraftTimer=setTimeout(saveProJobDraft,350)});$('#proJobForm').addEventListener('change',saveProJobDraft);
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
  if(!state.user||!requireServiceAccess())return;await Promise.all([loadProSettings(),loadProJobs(),loadProReminders()]);
  const open=state.proJobs.filter(j=>!['paid','cancelled'].includes(j.status)).length,unpaid=state.proJobs.filter(j=>j.payment_status!=='paid'&&!['lead','cancelled'].includes(j.status)).length;
  const start=new Date();start.setDate(1);start.setHours(0,0,0,0);const revenue=state.proJobs.filter(j=>j.payment_status==='paid'&&new Date(j.updated_at)>=start).reduce((sum,j)=>sum+Number(j.actual_paid||0),0);
  $('#proOpenCount').textContent=open;$('#proUnpaidCount').textContent=unpaid;$('#proMonthRevenue').textContent=money(revenue);renderProJobCards();renderWorkspaceReminders();show('#proWorkspaceView')
}
function renderWorkspaceReminders(){const box=$('#workspaceReminders'),due=state.proReminders.filter(r=>new Date(r.remind_at)<=new Date(Date.now()+24*60*60*1000));if(!box)return;box.classList.toggle('hidden',!due.length);if(due.length)box.innerHTML=`<b>🔔 ${due.length} תזכורות להיום</b><span>${esc(due[0].message)}${due.length>1?' ועוד…':''}</span><button class="ghost tiny" id="openDueRemindersBtn" type="button">פתח יומן</button>`;const button=$('#openDueRemindersBtn');if(button)button.onclick=openCalendar}
function resetServiceForm(){const form=$('#serviceForm');form.reset();$('#serviceId').value='';$('#serviceTrade').value=state.proSettings?.trade||'handyman';$('#serviceDefaultHours').value=1;$('#serviceMaterialsCost').value=0;$('#cancelServiceEditBtn').classList.add('hidden')}
function renderServices(){const box=$('#servicesList');box.innerHTML=state.proServices.length?state.proServices.map(s=>`<div class="item service-card"><h3>${tradeIcon(s.trade)} ${esc(s.name)}</h3><p>${esc(s.quote_scope||'ללא פירוט קבוע')}</p><div class="service-meta"><span class="badge">${PRICING_MODE_HE[s.pricing_mode]||''}</span><span class="badge">${money(s.base_price)}</span><span class="badge">${Number(s.default_hours)} שעות</span></div><div class="item-actions"><button class="secondary" data-edit-service="${s.id}">ערוך</button><button class="ghost" data-delete-service="${s.id}">מחק</button></div></div>`).join(''):'<div class="card empty-state"><span>🏷️</span><h3>עדיין אין תבניות אישיות</h3><p>התבניות המובנות כבר זמינות בפתיחת עבודה. כאן אפשר להוסיף את השירותים והמחירים שלך.</p></div>';box.querySelectorAll('[data-edit-service]').forEach(b=>b.onclick=()=>{const s=state.proServices.find(x=>x.id===b.dataset.editService);if(!s)return;$('#serviceId').value=s.id;$('#serviceName').value=s.name;$('#serviceTrade').value=s.trade;$('#servicePricingMode').value=s.pricing_mode;$('#serviceBasePrice').value=s.base_price;$('#serviceDefaultHours').value=s.default_hours;$('#serviceMaterialsCost').value=s.default_materials_cost;$('#serviceScope').value=s.quote_scope||'';$('#cancelServiceEditBtn').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'})});box.querySelectorAll('[data-delete-service]').forEach(b=>b.onclick=async()=>{if(!confirm('למחוק את התבנית מהמחירון?'))return;const {error}=await db.from('pro_services').delete().eq('id',b.dataset.deleteService).eq('professional_id',state.user.id);if(error){toast(error.message);return}await loadProServices();renderServices();toast('התבנית נמחקה')})}
async function openPriceBook(){if(!requireServiceAccess())return;await Promise.all([loadProSettings(),loadProServices()]);resetServiceForm();renderServices();show('#priceBookView')}
$('#serviceForm').onsubmit=async e=>{e.preventDefault();const id=$('#serviceId').value,row={professional_id:state.user.id,name:$('#serviceName').value.trim(),trade:$('#serviceTrade').value,pricing_mode:$('#servicePricingMode').value,base_price:numberValue('#serviceBasePrice'),default_hours:numberValue('#serviceDefaultHours'),default_materials_cost:numberValue('#serviceMaterialsCost'),quote_scope:$('#serviceScope').value.trim()||null};const query=id?db.from('pro_services').update(row).eq('id',id).eq('professional_id',state.user.id):db.from('pro_services').insert(row);const {error}=await query;if(error){toast(error.message);return}await loadProServices();resetServiceForm();renderServices();toast(id?'התבנית עודכנה':'התבנית נוספה למחירון')};$('#cancelServiceEditBtn').onclick=resetServiceForm;
function renderCustomers(){const search=$('#customerSearch').value.trim().toLowerCase(),rows=state.proCustomers.filter(c=>[c.name,c.phone,c.city].some(v=>String(v||'').toLowerCase().includes(search))),box=$('#customersList');box.innerHTML=rows.length?rows.map(c=>{const jobs=state.proJobs.filter(j=>j.customer_id===c.id||normalizedPhone(j.customer_phone)===c.normalized_phone).slice(0,4);return `<div class="item customer-card"><div class="customer-card-head"><div><h3>${esc(c.name)}</h3><span>${esc(c.phone)}${c.city?` · ${esc(c.city)}`:''}</span></div><a class="secondary tiny" href="https://wa.me/${waNumber(c.phone)}" target="_blank" rel="noopener">WhatsApp</a></div><div class="customer-history"><b>${jobs.length} עבודות אחרונות</b>${jobs.length?jobs.map(j=>`<div class="customer-history-row"><span>${esc(j.description)}</span><strong>${money(j.quoted_price)}</strong></div>`).join(''):'<p class="muted">עדיין אין היסטוריה.</p>'}</div></div>`}).join(''):'<div class="card empty-state"><span>👥</span><h3>לא נמצאו לקוחות</h3><p>לקוח נשמר אוטומטית כשפותחים עבורו עבודה.</p></div>'}
async function openCustomers(){if(!requireServiceAccess())return;await Promise.all([loadProCustomers(),loadProJobs()]);$('#customerSearch').value='';renderCustomers();show('#customersView')}
$('#customerSearch').oninput=renderCustomers;
function calendarEntries(){const jobs=state.proJobs.filter(j=>j.scheduled_at&&!['cancelled','paid'].includes(j.status)).map(j=>({id:`job:${j.id}`,date:j.scheduled_at,title:j.customer_name,body:j.description,kind:'job'})),reminders=state.proReminders.map(r=>({id:r.id,date:r.remind_at,title:r.message,body:'תזכורת',kind:'reminder'})),appointments=state.proAppointments.map(a=>({id:a.id,date:a.appointment_at,title:a.customer_name,body:[a.title,a.address].filter(Boolean).join(' · '),kind:'appointment'}));return [...jobs,...appointments,...reminders].sort((a,b)=>new Date(a.date)-new Date(b.date))}
function renderCalendar(){const box=$('#calendarList'),rows=calendarEntries();box.innerHTML=rows.length?rows.map(x=>{const d=new Date(x.date),icon=x.kind==='job'?'🧰':x.kind==='appointment'?'📅':'🔔';return `<div class="timeline-item ${d<Date.now()?'due':''}"><div class="timeline-date"><strong>${d.toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'})}</strong><small>${d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</small></div><div><h3>${icon} ${esc(x.title)}</h3><p>${esc(x.body)}</p></div>${x.kind==='reminder'?`<button class="ghost tiny" data-done-reminder="${x.id}">בוצע</button>`:x.kind==='appointment'?`<button class="ghost tiny" data-cancel-appointment="${x.id}">ביטול פגישה</button>`:''}</div>`}).join(''):'<div class="card empty-state"><span>📅</span><h3>היומן פנוי</h3><p>לחץ על „פגישה חדשה” כדי לקבוע את הפגישה הראשונה.</p></div>';box.querySelectorAll('[data-done-reminder]').forEach(b=>b.onclick=async()=>{const {error}=await db.from('pro_reminders').update({is_done:true}).eq('id',b.dataset.doneReminder).eq('professional_id',state.user.id);if(error){toast(error.message);return}await loadProReminders();renderCalendar();toast('התזכורת הושלמה')});box.querySelectorAll('[data-cancel-appointment]').forEach(b=>b.onclick=async()=>{if(!confirm('לבטל את הפגישה?'))return;const {error}=await db.from('pro_appointments').update({status:'cancelled'}).eq('id',b.dataset.cancelAppointment).eq('professional_id',state.user.id);if(error){toast(error.message);return}await loadProAppointments();renderCalendar();toast('הפגישה בוטלה')})}
function appointmentDefaultTime(){const d=new Date(Date.now()+60*60*1000);d.setMinutes(Math.ceil(d.getMinutes()/15)*15,0,0);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function renderAppointmentCustomers(){const select=$('#appointmentCustomerSelect');select.innerHTML='<option value="">לקוח חדש</option>'+state.proCustomers.map(c=>`<option value="${c.id}">${esc(c.name)} · ${esc(c.phone)}</option>`).join('')}
function closeAppointmentForm(){const form=$('#appointmentForm');form.reset();form.classList.add('hidden');$('#newAppointmentBtn').classList.remove('hidden')}
function openAppointmentForm(){renderAppointmentCustomers();$('#appointmentForm').reset();$('#appointmentAt').value=appointmentDefaultTime();$('#appointmentForm').classList.remove('hidden');$('#newAppointmentBtn').classList.add('hidden');$('#appointmentCustomerName').focus()}
async function openCalendar(){if(!requireServiceAccess())return;await Promise.all([loadProJobs(),loadProReminders(),loadProCustomers(),loadProAppointments()]);closeAppointmentForm();renderCalendar();show('#calendarView')}
$('#newAppointmentBtn').onclick=openAppointmentForm;$('#cancelAppointmentBtn').onclick=closeAppointmentForm;
$('#appointmentCustomerSelect').onchange=e=>{const c=state.proCustomers.find(x=>x.id===e.target.value);if(!c)return;$('#appointmentCustomerName').value=c.name;$('#appointmentCustomerPhone').value=c.phone||'';$('#appointmentAddress').value=c.city||''};
$('#appointmentForm').onsubmit=async e=>{e.preventDefault();if(!requireServiceAccess())return;const customerName=$('#appointmentCustomerName').value.trim(),phone=$('#appointmentCustomerPhone').value.trim(),appointmentAt=$('#appointmentAt').value,title=$('#appointmentTitle').value.trim();if(!customerName||!appointmentAt||!title){toast('יש למלא שם לקוח, מועד ונושא הפגישה');return}const row={professional_id:state.user.id,customer_id:$('#appointmentCustomerSelect').value||null,customer_name:customerName,customer_phone:phone||null,appointment_at:new Date(appointmentAt).toISOString(),address:$('#appointmentAddress').value.trim()||null,title,notes:$('#appointmentNotes').value.trim()||null};const {error}=await db.from('pro_appointments').insert(row);if(error){toast('הפגישה לא נשמרה: '+error.message);return}await loadProAppointments();closeAppointmentForm();renderCalendar();toast('הפגישה נשמרה ביומן')};
$('#priceBookBtn').onclick=openPriceBook;$('#customersBtn').onclick=openCustomers;$('#calendarBtn').onclick=openCalendar;
$('#proWorkspaceBtn').onclick=openProWorkspace;$('#homeNewJobBtn').onclick=openNewProJob;$('#newProJobBtn').onclick=openNewProJob;$('#sampleQuoteBtn').onclick=()=>window.open('./sample-quote.html','_blank','noopener');$('#proJobStatusFilter').onchange=renderProJobCards;
['#proLaborHours','#proBasePrice','#proMaterialsCost','#proTravelCost','#proAssistantCost'].forEach(id=>$(id).addEventListener('input',()=>calculateProPrice(true)));
$('#proPricingMode').onchange=e=>setPricingMode(e.target.value,true);
$('#proDiscountType').onchange=e=>{$('#proDiscountValue').disabled=e.target.value==='none';if(e.target.value==='none')$('#proDiscountValue').value=0;calculateProPrice(true)};
$('#proDiscountValue').oninput=()=>calculateProPrice(true);
$('#priceFloor').oninput=()=>{$('#priceFloor').dataset.manualOverride='true';calculateProPrice(true)};
$('#resetPriceFloorBtn').onclick=()=>{$('#priceFloor').dataset.manualOverride='false';calculateProPrice(true);toast('מחיר המינימום חזר לחישוב האוטומטי')};
$('#proQuotedPrice').oninput=()=>{$('#proQuotedPrice').dataset.manualOverride='true';calculateProPrice(false)};
$('#resetQuotedPriceBtn').onclick=()=>{$('#proQuotedPrice').dataset.manualOverride='false';calculateProPrice(true);toast('המחיר חזר למחיר המחושב')};
$('#addQuoteItemBtn').onclick=()=>addQuoteItem();
$('#proCustomerSelect').onchange=e=>{const c=state.proCustomers.find(x=>x.id===e.target.value);if(!c)return;$('#proCustomerName').value=c.name;$('#proCustomerPhone').value=c.phone;$('#proCustomerCity').value=c.city||'';saveProJobDraft()};
$('#proServiceTemplate').onchange=e=>{const t=serviceTemplatesForTrade($('#proJobTrade').value).find(x=>x.id===e.target.value);if(!t)return;$('#priceFloor').dataset.manualOverride='false';$('#proQuotedPrice').dataset.manualOverride='false';$('#proJobType').value=t.name;$('#proJobDescription').value=t.name;$('#proLaborHours').value=t.default_hours||1;$('#proMaterialsCost').value=t.default_materials_cost||0;$('#proQuoteScope').value=t.quote_scope||t.name;setPricingMode(t.pricing_mode||'fixed',false);$('#proBasePrice').value=Number(t.base_price)||0;state.quoteItems=[];renderQuoteItemsEditor();calculateProPrice(true);saveProJobDraft()};
$('#analyzeJobBtn').onclick=()=>{if(!$('#proJobDescription').value.trim()){toast('כתוב קודם מה הלקוח ביקש');return}analyzeProfessionalJob(true);calculateProPrice(true)};
if(SpeechRecognition){const proRec=new SpeechRecognition();proRec.lang='he-IL';$('#proVoiceBtn').onclick=()=>{try{proRec.start();$('#proVoiceStatus').textContent='מקשיב…'}catch{}};proRec.onresult=e=>{$('#proJobDescription').value=e.results[0][0].transcript||'';$('#proVoiceStatus').textContent='הטקסט נקלט. עכשיו אפשר לנתח את העבודה.'}}else{$('#proVoiceBtn').disabled=true;$('#proVoiceStatus').textContent='הכתבה קולית אינה נתמכת בדפדפן הזה.'}
$('#proJobForm').onsubmit=async e=>{
  e.preventDefault();if(!requireServiceAccess())return;
  const invalid=[...e.currentTarget.elements].find(input=>input.willValidate&&!input.checkValidity());
  if(invalid){setJobStep(Number(invalid.closest('[data-job-panel]').dataset.jobPanel));invalid.reportValidity();return}
  const analysis=analyzeProfessionalJob(false),pricing=calculateProPrice(false),scheduled=$('#proScheduledAt').value;
  const customerName=$('#proCustomerName').value.trim(),customerPhone=$('#proCustomerPhone').value.trim(),city=$('#proCustomerCity').value.trim(),phoneKey=normalizedPhone(customerPhone);if(phoneKey.length<7){toast('מספר הטלפון של הלקוח אינו תקין');return}const {data:customer,error:customerError}=await db.from('pro_customers').upsert({professional_id:state.user.id,name:customerName,phone:customerPhone,normalized_phone:phoneKey,city:city||null},{onConflict:'professional_id,normalized_phone'}).select('*').single();if(customerError){toast('הלקוח לא נשמר: '+customerError.message);return}
  const row={professional_id:state.user.id,customer_id:customer.id,trade:$('#proJobTrade').value,customer_name:customerName,customer_phone:customerPhone,city,job_type:$('#proJobType').value,description:$('#proJobDescription').value.trim(),scheduled_at:scheduled?new Date(scheduled).toISOString():null,pricing_mode:$('#proPricingMode').value,base_price:numberValue('#proBasePrice'),subtotal:pricing.subtotal,discount_type:$('#proDiscountType').value,discount_value:numberValue('#proDiscountValue'),discount_amount:pricing.discountAmount,quote_valid_until:$('#proQuoteValidUntil').value||null,warranty_text:$('#proWarrantyText').value.trim()||null,labor_hours:numberValue('#proLaborHours'),hourly_rate:Number(state.proSettings?.default_hourly_rate)||0,materials_cost:numberValue('#proMaterialsCost'),travel_cost:numberValue('#proTravelCost'),assistant_cost:numberValue('#proAssistantCost'),overhead_percent:Number(state.proSettings?.overhead_percent)||0,risk_percent:Number(state.proSettings?.risk_percent)||0,price_floor:pricing.floor,recommended_price:pricing.recommended,quoted_price:pricing.total,deposit_amount:numberValue('#proDepositAmount'),quote_scope:$('#proQuoteScope').value.trim(),quote_terms:state.proSettings?.quote_terms||'',customer_questions:analysis.questions,tools_needed:analysis.tools,warnings:analysis.warnings,status:'quoted',payment_status:'unpaid'};
  const {data,error}=await db.from('pro_jobs').insert(row).select('*').single();if(error){toast('לא נשמר: '+error.message);return}const cleanItems=state.quoteItems.filter(i=>String(i.description||'').trim()).map((i,index)=>({job_id:data.id,professional_id:state.user.id,description:String(i.description).trim(),quantity:Number(i.quantity)||1,unit_price:Number(i.unit_price)||0,estimated_cost:Number(i.estimated_cost)||0,sort_order:index}));if(!cleanItems.length)cleanItems.push({job_id:data.id,professional_id:state.user.id,description:row.description,quantity:1,unit_price:pricing.discountAmount>0?pricing.subtotal:pricing.total,estimated_cost:row.materials_cost,sort_order:0});const {error:itemsError}=await db.from('pro_job_items').insert(cleanItems);if(itemsError){await db.from('pro_jobs').delete().eq('id',data.id);toast('סעיפי ההצעה לא נשמרו: '+itemsError.message);return}const reminder=$('#proReminderAt').value;if(reminder)await db.from('pro_reminders').insert({job_id:data.id,professional_id:state.user.id,remind_at:new Date(reminder).toISOString(),kind:'quote_followup',message:`מעקב הצעה מול ${customerName}`});clearProJobDraft();trackAppEvent('first_job_created');if(state.onboarding)state.onboarding.first_quote_created_at=data.created_at||new Date().toISOString();state.selectedProJob={...data,items:cleanItems};await loadProJobs();await renderProJobDetail();show('#proJobDetailView');toast('ההצעה נשמרה. עכשיו לחץ על הכפתור הירוק לשליחה')
};
function quoteUrl(job){const url=new URL('./quote.html',location.href);url.searchParams.set('quote',job.public_token);return url.href}
function whatsappUrl(phone,message){const number=waNumber(phone);return number?`https://wa.me/${number}?text=${encodeURIComponent(message)}`:''}
function openWhatsapp(phone,message){const url=whatsappUrl(phone,message);if(!url){toast('חסר מספר טלפון ללקוח');return false}window.location.assign(url);return true}
const mehirliSupportLink=$('#mehirliSupportLink');
if(mehirliSupportLink)mehirliSupportLink.href=whatsappUrl(ROKACH_DIGITAL_WHATSAPP,'🟠 מחירלי | פנייה לתמיכה\n\nשלום, הגעתי מאתר מחירלי וברצוני לקבל עזרה.');
function developerSupportMessage(){
  const business=state.businessProfile?.business_name||state.profile?.full_name||'לא הוגדר';
  const email=state.user?.email||'לא הוגדר';
  return `🟠 מחירלי | תמיכה לבעל עסק\n\nשלום עמוס, אני משתמש/ת במחירלי.\nשם העסק: ${business}\nאימייל החשבון: ${email}\n\nסוג הפנייה: תקלה / הערה / הצעה לשיפור\nתיאור: `
}
function refreshDeveloperSupportLink(){
  const link=$('#developerSupportLink');if(!link)return;
  link.classList.toggle('hidden',!state.user);
  if(state.user)link.href=whatsappUrl(ROKACH_DIGITAL_WHATSAPP,developerSupportMessage())
}
function questionMessage(job){return `🟠 מחירלי | השלמת פרטים להצעת מחיר\n\nשלום ${job.customer_name}, כדי להכין את העבודה והמחיר בצורה מדויקת אשמח למענה קצר:\n\n${(job.customer_questions||[]).map((q,i)=>`${i+1}. ${q}`).join('\n')}\n\nתודה, ${state.businessProfile?.business_name||state.profile?.full_name||'מחירלי'}\n\nנשלח באמצעות מחירלי`}
function quoteMessage(job){return `🟠 מחירלי | הצעת מחיר\n\nשלום ${job.customer_name}, הכנתי עבורך הצעת מחיר עבור: ${job.description}\n\nמחיר: ${money(job.quoted_price)}${Number(job.deposit_amount)>0?`\nמקדמה: ${money(job.deposit_amount)}`:''}\n\nלצפייה, אישור והורדת PDF לטלפון:\n${quoteUrl(job)}\n\nנשלח באמצעות מחירלי`}
function storedQuoteMessage(job){return `🟠 מחירלי | הצעת מחיר\n\nשלום ${job.customer_name}, הכנתי עבורך הצעת מחיר עבור: ${job.description}\n\nמחיר: ${money(job.quoted_price)}${Number(job.deposit_amount)>0?`\nמקדמה: ${money(job.deposit_amount)}`:''}\n\nלאישור ההצעה:\n${quoteUrl(job)}\n\nקובץ הצעת המחיר מצורף כ־PDF.\n\nנשלח באמצעות מחירלי`}
function paymentMessage(job){const amount=Math.max(0,Number(job.quoted_price||0)-Number(job.actual_paid||0)),link=safePaymentUrl(state.proSettings?.payment_link),provider=paymentProviderLabel(state.proSettings?.payment_provider);return `🟠 מחירלי | קישור לתשלום\n\nשלום ${job.customer_name}, לתשלום ${money(amount)} עבור העבודה: ${job.description}.${link?`\n\nקישור לתשלום ישיר ומאובטח באמצעות ${provider}:\n${link}`:''}\n\nהתשלום מועבר ישירות לבית העסק.\n\nנשלח באמצעות מחירלי`}
function quotePdfFileName(job){
  const customer=String(job.customer_name||'לקוח').replace(/[\\/:*?"<>|]+/g,'-').trim()||'לקוח';
  return `הצעת-מחיר-${customer}.pdf`
}
function pdfInlineText(value){return esc(value).replace(/ /g,'&nbsp;')}
function pdfFlowText(value){
  return String(value??'').split('\n').map(line=>line.split(/\s+/).filter(Boolean).map(word=>`<span style="white-space:nowrap">${esc(word)}</span>`).join('<span aria-hidden="true" style="display:inline-block;width:5px"></span>')).join('<br>')
}
function quotePdfElement(job,pdfOptions={}){
  const business=pdfOptions.businessName||state.businessProfile?.business_name||state.profile?.full_name||'בעל מקצוע';
  const businessPhone=pdfOptions.businessPhone??state.businessProfile?.business_phone??'',logo=pdfOptions.logoUrl??businessLogoUrl(),legal=pdfOptions.legalText??[state.businessProfile?.legal_name,state.businessProfile?.business_number&&`עוסק/ח.פ. ${state.businessProfile.business_number}`,state.businessProfile?.business_address,state.businessProfile?.business_email&&`אימייל ${state.businessProfile.business_email}`].filter(Boolean).join(' · '),items=job.items||[];
  const paymentLink=safePaymentUrl(pdfOptions.paymentLink??state.proSettings?.payment_link),paymentProvider=pdfOptions.paymentProvider??paymentProviderLabel(state.proSettings?.payment_provider),approvalUrl=pdfOptions.approvalUrl||quoteUrl(job),paymentHeading=paymentProvider?`תשלום ישיר לבית העסק באמצעות ${paymentProvider}`:'קישור לתשלום';
  const licenseNumber=pdfOptions.licenseNumber??state.proSettings?.electrician_license_number;
  const license=job.trade==='electrician'&&licenseNumber?`<div style="margin-top:5px;color:#536274;font-size:14px">רישיון חשמלאי: ${esc(licenseNumber)}</div>`:'';
  const wrapper=document.createElement('div');
  wrapper.dataset.quotePdfWrapper='true';
  wrapper.setAttribute('dir','ltr');
  wrapper.style.cssText='position:fixed;left:0;top:0;width:720px;direction:ltr;overflow:visible;pointer-events:none;z-index:-2147483647';
  const root=document.createElement('section');
  root.dataset.quotePdfRoot='true';
  root.setAttribute('dir','rtl');
  root.style.cssText='position:relative;left:0;right:auto;width:720px;margin:0;box-sizing:border-box;padding:32px 38px;background:#fff;color:#17212b;font-family:Arial,"Noto Sans Hebrew",sans-serif;line-height:1.4;word-spacing:2px;pointer-events:none;direction:rtl;text-align:right';
  root.innerHTML=`
    <header style="display:flex;justify-content:space-between;gap:22px;align-items:flex-start;border-bottom:4px solid #1da873;padding-bottom:14px">
      <div>${logo?`<img src="${esc(logo)}" style="width:58px;height:58px;object-fit:contain;float:right;margin-left:12px;border-radius:10px">`:''}<div style="font-size:30px;font-weight:900;color:#10243a">הצעת&nbsp;מחיר</div><div style="font-size:19px;font-weight:800;margin-top:2px">${pdfInlineText(business)}</div>${legal?`<div style="color:#536274;font-size:12px">${pdfFlowText(legal)}</div>`:''}${license}${businessPhone?`<div style="margin-top:3px;color:#536274;font-size:13px">טלפון:<span dir="ltr" style="display:inline-block;margin-right:5px;unicode-bidi:isolate">${esc(businessPhone)}</span></div>`:''}</div>
      <div style="text-align:left;color:#607184;font-size:14px"><div dir="ltr" style="unicode-bidi:isolate">${new Date().toLocaleDateString('he-IL')}</div><div>מס׳&nbsp;${esc(String(job.quote_number||String(job.id||'').slice(0,8)))}</div>${job.quote_valid_until?`<div>בתוקף&nbsp;עד<span dir="ltr" style="display:inline-block;margin-right:5px;unicode-bidi:isolate">${esc(formatDate(job.quote_valid_until))}</span></div>`:''}</div>
    </header>
    <main>
      <div style="margin:18px 0 12px"><div style="font-size:13px;color:#607184">לכבוד</div><div style="font-size:22px;font-weight:900">${pdfInlineText(job.customer_name)}</div>${job.city?`<div style="color:#607184">${esc(job.city)}</div>`:''}</div>
      <section style="margin:12px 0;padding:14px 16px;border:1px solid #dce5ea;border-radius:14px;background:#f7fafb;break-inside:avoid">
        <div style="font-size:13px;color:#607184">תיאור&nbsp;העבודה</div><div style="font-size:18px;font-weight:800;margin:3px 0 6px">${pdfFlowText(job.description)}</div>
        ${job.quote_scope?`<div style="white-space:pre-wrap;color:#344454">${pdfFlowText(job.quote_scope)}</div>`:''}
      </section>
      ${items.length?`<section style="margin:12px 0;border:1px solid #dce5ea;border-radius:12px;overflow:hidden;break-inside:avoid"><div style="display:grid;grid-template-columns:1fr 64px 104px;background:#edf5f0;padding:8px 12px;font-weight:800"><span>פירוט</span><span>כמות</span><span>סה״כ</span></div>${items.map(i=>`<div style="display:grid;grid-template-columns:1fr 64px 104px;padding:8px 12px;border-top:1px solid #e8eeea"><span>${pdfFlowText(i.description)}</span><span>${Number(i.quantity)}</span><span>${money(Number(i.quantity)*Number(i.unit_price))}</span></div>`).join('')}</section>`:''}
      <section style="margin:12px 0;padding:14px;text-align:center;border:2px solid #38b889;border-radius:14px;background:#eefaf5;break-inside:avoid">
        <div style="font-size:13px;color:#527064">מחיר&nbsp;ההצעה</div>${Number(job.discount_amount)>0?`<div style="color:#607184;text-decoration:line-through">${money(job.subtotal)}</div><div style="color:#287353">הנחה ${money(job.discount_amount)}</div>`:''}<div style="font-size:34px;line-height:1.15;font-weight:900;color:#16865b">${money(job.quoted_price)}</div>
        ${Number(job.deposit_amount)>0?`<div style="margin-top:5px;font-weight:800">מקדמה: ${money(job.deposit_amount)}</div>`:''}
      </section>
      ${job.scheduled_at?`<div style="margin:10px 0;padding:10px 14px;border-right:4px solid #3f8fc7;background:#f2f8fc;break-inside:avoid"><b>מועד&nbsp;מתוכנן:</b>&nbsp;<span dir="ltr" style="unicode-bidi:isolate">${esc(formatDateTime(job.scheduled_at))}</span></div>`:''}
      ${job.warranty_text?`<div style="margin:10px 0;padding:10px 14px;border-right:4px solid #68a57e;background:#f3f9f5;break-inside:avoid"><b>אחריות:</b> ${pdfFlowText(job.warranty_text)}</div>`:''}
      ${job.quote_terms?`<section style="margin:12px 0;break-inside:avoid"><div style="font-size:15px;font-weight:900;margin-bottom:5px">תנאי&nbsp;ההצעה</div><div style="padding:11px 13px;border:1px solid #e1e7eb;border-radius:10px;white-space:pre-wrap;color:#465667">${pdfFlowText(job.quote_terms)}</div></section>`:''}
      <section style="margin-top:12px;padding-top:10px;border-top:1px solid #dce5ea;font-size:12px;color:#536274;break-inside:avoid">
        <div><b>צפייה&nbsp;ואישור&nbsp;ההצעה:</b></div><div style="direction:ltr;text-align:left;word-break:break-all;color:#1570a6">${esc(approvalUrl)}</div>
        ${paymentLink?`<div style="margin-top:8px"><b>${pdfInlineText(paymentHeading)}:</b></div><div style="direction:ltr;text-align:left;word-break:break-all;color:#1570a6">${esc(paymentLink)}</div>`:''}
      </section>
    </main>
    <footer style="margin-top:14px;padding-top:10px;border-top:1px solid #dce5ea;text-align:center;color:#7b8996;font-size:11px">הופק באמצעות מחירלי</footer>`;
  wrapper.appendChild(root);document.body.appendChild(wrapper);return root
}
function removeQuotePdfElement(element){
  const wrapper=element?.parentElement;
  if(wrapper?.dataset?.quotePdfWrapper==='true')wrapper.remove();
  else element?.remove()
}
async function renderQuoteElementToPdfBlob(element,fileName){
  if(document.fonts?.ready)await document.fonts.ready;
  await Promise.all([...element.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():img.decode?.().catch(()=>{})||Promise.resolve()));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const renderWidth=720,renderHeight=Math.max(element.scrollHeight,1020);
  const worker=window.html2pdf().set({margin:[8,8,8,8],filename:fileName,image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true,allowTaint:false,backgroundColor:'#ffffff',logging:false,scrollX:0,scrollY:0,width:renderWidth,windowWidth:renderWidth,windowHeight:renderHeight,onclone:clonedDocument=>{
    clonedDocument.documentElement.setAttribute('dir','ltr');
    clonedDocument.body.setAttribute('dir','ltr');
    clonedDocument.documentElement.style.cssText+=';width:720px;min-width:720px;overflow:visible';
    clonedDocument.body.style.cssText+=';width:720px;min-width:720px;margin:0;overflow:visible;direction:ltr';
    const clonedRoot=clonedDocument.querySelector('[data-quote-pdf-root="true"]');
    if(clonedRoot){clonedRoot.setAttribute('dir','rtl');clonedRoot.style.left='0';clonedRoot.style.right='auto';clonedRoot.style.margin='0';clonedRoot.style.direction='rtl';clonedRoot.style.textAlign='right'}
  }},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy']}}).from(element).toContainer();
  const overlay=await worker.get('overlay'),container=await worker.get('container');
  if(overlay){overlay.setAttribute('dir','ltr');overlay.style.left='0';overlay.style.right='auto';overlay.style.width=`${renderWidth}px`;overlay.style.overflow='visible';overlay.style.direction='ltr'}
  if(container){container.setAttribute('dir','ltr');container.style.left='0';container.style.right='auto';container.style.width=`${renderWidth}px`;container.style.margin='0';container.style.transform='none';container.style.direction='ltr'}
  await worker.toCanvas();
  const canvas=await worker.get('canvas');
  if(!canvas||canvas.width<100||canvas.height<100)throw new Error('ה־PDF נוצר ללא תוכן');
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const pixels=ctx?.getImageData(0,0,canvas.width,canvas.height).data;
  if(!pixels)throw new Error('לא ניתן היה לבדוק את תוכן ה־PDF');
  const scanStep=Math.max(1,Math.floor(Math.min(canvas.width,canvas.height)/450));
  let visiblePixels=0,minX=canvas.width,maxX=-1,minY=canvas.height,maxY=-1;
  for(let y=0;y<canvas.height;y+=scanStep){
    for(let x=0;x<canvas.width;x+=scanStep){
      const i=(y*canvas.width+x)*4;
      if(pixels[i+3]>0&&(pixels[i]<245||pixels[i+1]<245||pixels[i+2]<245)){
        visiblePixels++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y
      }
    }
  }
  if(visiblePixels<100)throw new Error('ה־PDF נוצר ללא תוכן');
  const contentWidth=maxX-minX,contentHeight=maxY-minY;
  if(contentWidth<canvas.width*.7||minX>canvas.width*.18||maxX<canvas.width*.82||contentHeight<canvas.height*.28)throw new Error('פריסת ה־PDF נחתכה ולכן הקובץ לא נשמר');
  const pdfWorker=worker.toPdf(),pdf=await pdfWorker.get('pdf'),pageCount=pdf?.internal?.getNumberOfPages?.()||0;
  if(!pageCount)throw new Error('לא ניתן היה לבדוק את עמודי ה־PDF');
  const pagePixelHeight=canvas.width*((297-16)/(210-16)),lastPageFill=(canvas.height-pagePixelHeight*(pageCount-1))/pagePixelHeight;
  if(pageCount>1&&lastPageFill<.35)throw new Error('ה־PDF נשבר לעמוד נוסף כמעט ריק');
  const blob=await pdfWorker.outputPdf('blob');
  if(!(blob instanceof Blob)||blob.size<10000)throw new Error('ה־PDF נוצר ללא תוכן');
  return blob
}
async function createQuotePdfFile(job){
  if(typeof window.html2pdf!=='function')throw new Error('PDF library unavailable');
  const element=quotePdfElement(job);
  try{
    const fileName=quotePdfFileName(job);
    const blob=await renderQuoteElementToPdfBlob(element,fileName);
    return new File([blob],fileName,{type:'application/pdf',lastModified:Date.now()})
  }finally{removeQuotePdfElement(element)}
}
function prepareJobQuotePdf(job){
  const key=String(job.id||''),existing=quotePdfCache.get(key);
  if(existing?.status==='ready')return Promise.resolve(existing.file);if(existing?.status==='loading')return existing.promise;
  const promise=createQuotePdfFile(job).then(file=>{quotePdfCache.set(key,{status:'ready',file});const btn=$('#jobDetailContent')?.querySelector('[data-job-action="quote-pdf"]');if(btn&&state.selectedProJob?.id===job.id){btn.disabled=false;btn.textContent=job.quote_pdf_path?'📄 צור PDF תקין מחדש':'📄 צור ופתח PDF'}return file}).catch(error=>{quotePdfCache.delete(key);const btn=$('#jobDetailContent')?.querySelector('[data-job-action="quote-pdf"]');if(btn&&state.selectedProJob?.id===job.id){btn.disabled=false;btn.textContent='נסה שוב להכין PDF'}throw error});
  quotePdfCache.set(key,{status:'loading',promise});return promise
}
async function signedQuotePdfUrl(path){
  const {data,error}=await db.storage.from(QUOTE_PDF_BUCKET).createSignedUrl(path,QUOTE_LINK_SECONDS);
  if(error||!data?.signedUrl)throw error||new Error('לא נוצר קישור למסמך');
  return data.signedUrl
}
async function storeQuotePdf(job,force=false){
  const previousPath=job.quote_pdf_path||'';
  if(previousPath&&!force)return {path:previousPath,url:await signedQuotePdfUrl(previousPath),created:false,file:await prepareJobQuotePdf(job)};
  const file=await prepareJobQuotePdf(job),path=`${state.user.id}/${job.id}/${Date.now()}-${crypto.randomUUID()}.pdf`;
  const {error:uploadError}=await db.storage.from(QUOTE_PDF_BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:'application/pdf'});
  if(uploadError)throw uploadError;
  const generatedAt=new Date().toISOString();
  const {data,error}=await db.from('pro_jobs').update({quote_pdf_path:path,quote_pdf_generated_at:generatedAt}).eq('id',job.id).eq('professional_id',state.user.id).select('*').single();
  if(error){await db.storage.from(QUOTE_PDF_BUCKET).remove([path]);throw error}
  if(previousPath&&previousPath!==path)await db.storage.from(QUOTE_PDF_BUCKET).remove([previousPath]);
  Object.assign(job,data);state.selectedProJob=job;
  const listed=state.proJobs.find(item=>item.id===job.id);if(listed)Object.assign(listed,data);
  return {path,url:await signedQuotePdfUrl(path),created:true,file}
}
function readyJobQuotePdfFile(job){
  const cached=quotePdfCache.get(String(job.id||''));
  return cached?.status==='ready'&&cached.file instanceof File?cached.file:null
}
function downloadQuotePdfAndOpenWhatsapp(job,file){
  const objectUrl=URL.createObjectURL(file),link=document.createElement('a');
  link.href=objectUrl;link.download=file.name;link.style.display='none';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
  openWhatsapp(job.customer_phone,`${storedQuoteMessage(job)}\n\nה־PDF הורד למכשיר. אם הוא לא צורף אוטומטית, יש לצרף אותו לשיחה מתיקיית ההורדות.`);
  toast('ה־PDF הורד. WhatsApp נפתח לשליחה.');
  return false
}
function shareQuotePdfFileToWhatsapp(job,file){
  const shareData={files:[file],title:`הצעת מחיר — ${job.customer_name}`,text:storedQuoteMessage(job)};
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
    return navigator.share(shareData).then(()=>true)
  }
  return Promise.resolve(downloadQuotePdfAndOpenWhatsapp(job,file))
}
async function sendStoredQuoteToWhatsapp(job,button){
  if(!requireServiceAccess())return;
  if(!waNumber(job.customer_phone)){toast('חסר מספר טלפון ללקוח');return}
  const file=readyJobQuotePdfFile(job);
  if(!file){
    button.disabled=true;button.textContent='מכין PDF…';
    try{await prepareJobQuotePdf(job);toast('ה־PDF מוכן. לחץ שוב על כפתור השיתוף.')}
    catch(error){console.error('Quote PDF preparation failed',error);toast('לא ניתן להכין את ה־PDF: '+(error?.message||'נסה שוב'))}
    finally{button.disabled=false;button.textContent='💬 שתף PDF ב־WhatsApp'}
    return
  }
  let sharePromise;
  try{
    sharePromise=shareQuotePdfFileToWhatsapp(job,file);
  }catch(error){
    console.error('Quote PDF share start failed',error);
    downloadQuotePdfAndOpenWhatsapp(job,file);
    return
  }
  const oldText=button.textContent;button.disabled=true;button.textContent='פותח שיתוף PDF…';
  try{
    const shared=await sharePromise;
    if(!shared)return;
    button.textContent='שומר PDF בתיק העבודה…';
    const {created}=await storeQuotePdf(job,true);
    const status=$('#quoteStorageStatus');if(status){status.textContent='ה־PDF התקין נשמר באפליקציה';status.classList.add('stored')}
    toast(created?'ה־PDF נשלח ונשמר בתיק העבודה':'ה־PDF נשלח')
  }catch(error){
    if(error?.name==='AbortError'){toast('השיתוף בוטל');return}
    console.error('Quote PDF share failed',error);
    downloadQuotePdfAndOpenWhatsapp(job,file)
  }finally{button.disabled=false;button.textContent=oldText}
}
async function sendDigitalQuoteToWhatsapp(job){
  if(!requireServiceAccess())return;
  if(!waNumber(job.customer_phone)){toast('חסר מספר טלפון ללקוח');return}
  trackAppEvent('quote_send_opened');
  await markOnboardingStep('first_quote_sent');
  openWhatsapp(job.customer_phone,quoteMessage(job));
}
async function openStoredQuotePdf(job,button){
  if(!requireServiceAccess())return;
  const preview=window.open('about:blank','_blank');
  if(preview){preview.document.write('<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>מחירלי</title><body style="font-family:Arial;text-align:center;padding:40px">מכין את הצעת המחיר…</body></html>');preview.document.close()}
  const oldText=button.textContent;button.disabled=true;button.textContent=job.quote_pdf_path?'פותח מסמך…':'שומר מסמך…';
  try{const {url}=await storeQuotePdf(job,true);if(preview)preview.location.replace(url);else window.location.assign(url);await renderProJobDetail();toast('נוצר PDF תקין והוא נשמר בתיק העבודה')}
  catch(error){if(preview)preview.close();console.error('Quote PDF preview failed',error);toast('לא ניתן לפתוח את ה־PDF: '+(error?.message||'נסה שוב'));button.disabled=false;button.textContent=oldText}
}
async function copyText(value,success='הקישור הועתק'){
  try{await navigator.clipboard.writeText(value);toast(success)}catch{const ta=document.createElement('textarea');ta.value=value;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast(success)}
}
function renderList(items,empty='לא הוגדר'){return items?.length?`<ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<p class="muted">${empty}</p>`}
async function loadJobExtras(job){const [itemsRes,timeRes]=await Promise.all([db.from('pro_job_items').select('*').eq('job_id',job.id).eq('professional_id',state.user.id).order('sort_order'),db.from('pro_time_entries').select('*').eq('job_id',job.id).eq('professional_id',state.user.id).order('started_at')]);job.items=itemsRes.data||[];state.proTimeEntries=timeRes.data||[]}
function elapsedSeconds(){return state.proTimeEntries.reduce((sum,e)=>sum+Math.max(0,(e.ended_at?new Date(e.ended_at).getTime():Date.now())-new Date(e.started_at).getTime())/1000,0)}
function durationText(seconds){const total=Math.max(0,Math.floor(seconds)),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':')}
function startTimerDisplay(){if(state.timerInterval)clearInterval(state.timerInterval);const update=()=>{const el=$('#jobTimerDisplay');if(el)el.textContent=durationText(elapsedSeconds())};update();if(state.proTimeEntries.some(e=>!e.ended_at))state.timerInterval=setInterval(update,1000)}
async function timerAction(action){const j=state.selectedProJob;if(!j||!requireServiceAccess())return;const running=state.proTimeEntries.find(e=>!e.ended_at);if(action==='start'&&running){toast('השעתון כבר פועל');return}if(action==='stop'&&!running){toast('אין שעתון פעיל');return}let error;if(action==='start')({error}=await db.from('pro_time_entries').insert({job_id:j.id,professional_id:state.user.id,started_at:new Date().toISOString()}));else ({error}=await db.from('pro_time_entries').update({ended_at:new Date().toISOString()}).eq('id',running.id).eq('professional_id',state.user.id));if(error){toast('השעתון לא עודכן: '+error.message);return}if(action==='start'&&!['in_progress','paid'].includes(j.status)){await db.from('pro_jobs').update({status:'in_progress'}).eq('id',j.id).eq('professional_id',state.user.id);j.status='in_progress'}await loadJobExtras(j);await renderProJobDetail();toast(action==='start'?'השעתון התחיל':'השעתון נעצר')}
function quoteItemsView(job){const items=job.items||[];return items.length?`<div class="quote-items-view">${items.map(i=>`<div><span>${esc(i.description)} · ${Number(i.quantity)}</span><b>${money(Number(i.quantity)*Number(i.unit_price))}</b></div>`).join('')}</div>`:''}
async function renderProJobDetail(){
  const j=state.selectedProJob;if(!j)return;await loadProSettings();if(!j.items)await loadJobExtras(j);$('#jobDetailTitle').textContent=j.customer_name;
  const below=Number(j.quoted_price)<Number(j.price_floor),remaining=Math.max(0,Number(j.quoted_price||0)-Number(j.actual_paid||0));
  $('#jobDetailContent').innerHTML=`<div class="quote-send-callout card"><span id="quoteStorageStatus" class="quote-send-status stored">הצעה דיגיטלית מוכנה</span><h3>שליחת ההצעה ל־${esc(j.customer_name)}</h3><p>הלקוח יקבל ב־WhatsApp קישור להצעה. שם הוא יוכל לצפות, לאשר ולהוריד PDF אמיתי לטלפון.</p><button class="primary big whatsapp-action" data-job-action="quote-whatsapp">💬 שלח הצעה דיגיטלית ב־WhatsApp</button></div>
  <div class="job-hero card"><div class="job-card-top"><span class="trade-badge ${j.trade}">${tradeIcon(j.trade)} ${tradeHe[j.trade]||'בעל מקצוע'}</span><span class="status-pill status-${j.status}">${jobStatusHe[j.status]||j.status}</span></div><span class="quote-number">הצעה מס׳ ${esc(j.quote_number||String(j.id).slice(0,8))} · ${PRICING_MODE_HE[j.pricing_mode]||'תמחור'}</span><h3>${esc(j.description)}</h3><p>👤 ${esc(j.customer_name)} · 📍 ${esc(j.city||'לא צוין')} · 🗓️ ${esc(formatDateTime(j.scheduled_at))}</p><div class="contact-actions"><a class="secondary" href="tel:${esc(j.customer_phone)}">📞 התקשר</a><button class="secondary" data-job-action="questions">💬 שלח שאלות</button></div></div>
  <div class="detail-price-grid"><div class="card"><small>מחיר מינימום</small><strong>${money(j.price_floor)}</strong></div><div class="card featured"><small>הצעה ללקוח</small><strong>${money(j.quoted_price)}</strong></div><div class="card"><small>יתרה לתשלום</small><strong>${money(remaining)}</strong></div></div>
  ${below?'<div class="price-warning">⚠️ המחיר ללקוח נמוך ממחיר המינימום שחושב לעבודה.</div>':''}
  <div class="card"><h3>הצעת המחיר</h3><p>${esc(j.quote_scope||'לא נוסף פירוט להצעה.')}</p>${quoteItemsView(j)}<div class="quote-totals">${Number(j.discount_amount)>0?`<div><span>לפני הנחה</span><b>${money(j.subtotal)}</b></div><div><span>הנחה</span><b>− ${money(j.discount_amount)}</b></div>`:''}<div class="final"><span>סה״כ</span><b>${money(j.quoted_price)}</b></div></div>${j.warranty_text?`<p><b>אחריות:</b> ${esc(j.warranty_text)}</p>`:''}${j.quote_terms?`<div class="terms-box">${esc(j.quote_terms)}</div>`:''}<div class="action-grid"><button class="secondary" data-job-action="quote-pdf" disabled>⏳ מכין PDF…</button><button class="secondary" data-job-action="copy">העתק קישור להצעה</button>${safePaymentUrl(state.proSettings?.payment_link)?'<button class="secondary" data-job-action="payment">שלח קישור לתשלום</button>':''}</div><p class="stored-pdf-note">אפשר ליצור ולשמור PDF גם מתיק העבודה. הלקוח יכול להוריד עותק משלו ישירות מההצעה הדיגיטלית.</p></div>
  <div class="card timer-card"><h3>⏱️ שעתון עבודה</h3><div id="jobTimerDisplay" class="timer-display">00:00:00</div><div class="timer-actions"><button class="primary" data-job-action="timer-start" ${state.proTimeEntries.some(e=>!e.ended_at)?'disabled':''}>${state.proTimeEntries.length?'המשך עבודה':'התחל עבודה'}</button><button class="secondary" data-job-action="timer-stop" ${state.proTimeEntries.some(e=>!e.ended_at)?'':'disabled'}>עצור</button></div><p class="timer-note">הזמן נשמר בתיק ויועבר לשעות בפועל בסיום.</p></div>
  <div class="card"><h3>תזכורת חדשה</h3><div class="reminder-inline"><label>מועד<input id="detailReminderAt" type="datetime-local"></label><button class="secondary" data-job-action="add-reminder">שמור</button></div></div>
  <div class="card"><label class="inline-select">מצב העבודה<select id="jobStatusSelect">${Object.entries(jobStatusHe).map(([v,l])=>`<option value="${v}" ${j.status===v?'selected':''}>${l}</option>`).join('')}</select></label></div>
  <div class="analysis-display card"><div><h3>שאלות ללקוח</h3>${renderList(j.customer_questions)}</div><div><h3>ציוד והכנה</h3>${renderList(j.tools_needed)}</div>${j.warnings?.length?`<div class="safety-box">${j.warnings.map(w=>`<p>⚠️ ${esc(w)}</p>`).join('')}</div>`:''}</div>`;
  const trackedHours=elapsedSeconds()/3600,rounding=(Number(state.proSettings?.time_rounding_minutes)||15)/60,roundedTracked=trackedHours?Math.ceil(trackedHours/rounding)*rounding:0;$('#actualHours').value=j.actual_hours||roundedTracked||j.labor_hours||'';$('#actualMaterials').value=j.actual_materials_cost??j.materials_cost??'';$('#actualPaid').value=j.actual_paid||'';renderActualProfit(j);
  $('#jobDetailContent').querySelector('[data-job-action="questions"]').onclick=()=>openWhatsapp(j.customer_phone,questionMessage(j));
  const pdfShareButton=$('#jobDetailContent').querySelector('[data-job-action="quote-pdf"]');pdfShareButton.onclick=()=>openStoredQuotePdf(j,pdfShareButton);
  const whatsappButton=$('#jobDetailContent').querySelector('[data-job-action="quote-whatsapp"]');whatsappButton.onclick=()=>sendDigitalQuoteToWhatsapp(j);
  $('#jobDetailContent').querySelector('[data-job-action="copy"]').onclick=()=>copyText(quoteUrl(j));
  const paymentButton=$('#jobDetailContent').querySelector('[data-job-action="payment"]');if(paymentButton)paymentButton.onclick=()=>openWhatsapp(j.customer_phone,paymentMessage(j));
  $('#jobDetailContent').querySelector('[data-job-action="timer-start"]').onclick=()=>timerAction('start');$('#jobDetailContent').querySelector('[data-job-action="timer-stop"]').onclick=()=>timerAction('stop');
  $('#jobDetailContent').querySelector('[data-job-action="add-reminder"]').onclick=async()=>{const value=$('#detailReminderAt').value;if(!value){toast('בחר מועד לתזכורת');return}const {error}=await db.from('pro_reminders').insert({job_id:j.id,professional_id:state.user.id,remind_at:new Date(value).toISOString(),kind:'followup',message:`טיפול בעבודה של ${j.customer_name}`});if(error){toast(error.message);return}$('#detailReminderAt').value='';toast('התזכורת נשמרה')};
  $('#jobStatusSelect').onchange=async e=>{if(!requireServiceAccess())return;const status=e.target.value,payment_status=status==='paid'?'paid':j.payment_status;const {error}=await db.from('pro_jobs').update({status,payment_status}).eq('id',j.id).eq('professional_id',state.user.id);if(error){toast(error.message);return}j.status=status;j.payment_status=payment_status;toast('מצב העבודה עודכן');await loadProJobs();await renderProJobDetail()};
  startTimerDisplay();prepareJobQuotePdf(j).catch(()=>{});await loadJobMedia(j.id)
}
async function openProJobDetail(id){if(!requireServiceAccess())return;state.selectedProJob=state.proJobs.find(j=>j.id===id);if(!state.selectedProJob){const {data}=await db.from('pro_jobs').select('*').eq('id',id).eq('professional_id',state.user.id).single();state.selectedProJob=data}await renderProJobDetail();show('#proJobDetailView')}
function renderActualProfit(job){
  const box=$('#actualProfitResult'),paid=Number(job.actual_paid||0),hours=Number(job.actual_hours||0);if(!paid||!hours){box.classList.add('hidden');box.innerHTML='';return}
  const profit=Number(job.actual_profit ?? (paid-Number(job.actual_materials_cost||0)-Number(job.travel_cost||0)-Number(job.assistant_cost||0)-paid*(Number(job.overhead_percent||0)/100))),perHour=Number(job.actual_hourly_profit ?? profit/hours);
  box.classList.remove('hidden');box.innerHTML=`<small>הרווח המחושב לאחר חומרים, נסיעה והוצאות העסק</small><strong>${money(profit)}</strong><span>${money(perHour)} לשעה</span>`
}
$('#actualProfitForm').onsubmit=async e=>{
  e.preventDefault();if(!requireServiceAccess())return;const j=state.selectedProJob,hours=numberValue('#actualHours'),materials=numberValue('#actualMaterials'),paid=numberValue('#actualPaid');if(!hours||!paid){toast('יש להזין זמן וסכום שהתקבלו');return}
  const profit=paid-materials-Number(j.travel_cost||0)-Number(j.assistant_cost||0)-paid*(Number(j.overhead_percent||0)/100),perHour=profit/hours;
  const changes={actual_hours:hours,actual_materials_cost:materials,actual_paid:paid,actual_profit:profit,actual_hourly_profit:perHour,status:'paid',payment_status:'paid'};
  const {data,error}=await db.from('pro_jobs').update(changes).eq('id',j.id).eq('professional_id',state.user.id).select('*').single();if(error){toast(error.message);return}state.selectedProJob=data;toast('העבודה נסגרה והרווח חושב');await loadProJobs();await renderProJobDetail()
};
function printJobQuote(j){
  const win=window.open('','_blank');if(!win){toast('יש לאפשר חלונות קופצים כדי לשמור PDF');return}
  const business=state.businessProfile?.business_name||state.profile?.full_name||'בעל מקצוע',license=j.trade==='electrician'&&state.proSettings?.electrician_license_number?`<p>רישיון חשמלאי: ${esc(state.proSettings.electrician_license_number)}</p>`:'';
  win.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>הצעת מחיר - ${esc(j.customer_name)}</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;padding:24px;color:#16202b}header{border-bottom:3px solid #22a773;padding-bottom:18px}h1{margin:0}section{margin:28px 0}.price{font-size:34px;font-weight:800;color:#16885c}.terms{background:#f3f6f8;padding:16px;border-radius:12px;white-space:pre-wrap}footer{margin-top:50px;border-top:1px solid #ccd5dc;padding-top:15px;color:#667}button{padding:10px 18px}@media print{button{display:none}}</style></head><body><header><h1>הצעת מחיר</h1><p>${esc(business)}</p>${license}</header><section><b>לכבוד: ${esc(j.customer_name)}</b><p>${esc(j.description)}</p><p>${esc(j.quote_scope||'')}</p><div class="price">${money(j.quoted_price)}</div>${Number(j.deposit_amount)>0?`<p>מקדמה: ${money(j.deposit_amount)}</p>`:''}</section><section class="terms">${esc(j.quote_terms||'')}</section><footer>הופק באמצעות מחירלי · ${new Date().toLocaleDateString('he-IL')}</footer><button onclick="print()">הדפס / שמור PDF</button></body></html>`);win.document.close()
}
async function loadJobMedia(jobId){
  const {data,error}=await db.from('pro_job_media').select('*').eq('job_id',jobId).eq('professional_id',state.user.id).order('created_at');if(error){$('#jobMediaGrid').innerHTML='<p class="muted">לא ניתן לטעון תמונות.</p>';return}
  state.proJobMedia=data||[];const rendered=[];for(const m of state.proJobMedia){const {data:signed}=await db.storage.from('job-media').createSignedUrl(m.storage_path,3600);rendered.push({...m,url:signed?.signedUrl||''})}
  $('#jobMediaGrid').innerHTML=rendered.length?rendered.map(m=>`<figure><img src="${esc(m.url)}" alt="${m.phase==='before'?'לפני העבודה':'אחרי העבודה'}"><figcaption>${m.phase==='before'?'לפני':'אחרי'} <button data-delete-media="${m.id}">מחק</button></figcaption></figure>`).join(''):'<p class="muted">עדיין לא נוספו תמונות.</p>';
  $('#jobMediaGrid').querySelectorAll('[data-delete-media]').forEach(b=>b.onclick=async()=>{if(!requireServiceAccess())return;const m=state.proJobMedia.find(x=>x.id===b.dataset.deleteMedia);if(!m||!confirm('למחוק את התמונה מתיק העבודה?'))return;await db.storage.from('job-media').remove([m.storage_path]);await db.from('pro_job_media').delete().eq('id',m.id).eq('professional_id',state.user.id);await loadJobMedia(jobId)})
}
async function uploadJobPhoto(file,phase){
  if(!requireServiceAccess())return;const j=state.selectedProJob;if(!j||!file)return;if(!file.type.startsWith('image/')){toast('אפשר להעלות תמונות בלבד');return}if(file.size>8*1024*1024){toast('התמונה גדולה מדי. עד 8MB');return}
  const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase(),path=`${state.user.id}/${j.id}/${crypto.randomUUID()}.${ext}`;toast('מעלה תמונה…');
  const {error:uploadError}=await db.storage.from('job-media').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(uploadError){toast('ההעלאה נכשלה: '+uploadError.message);return}
  const {error}=await db.from('pro_job_media').insert({job_id:j.id,professional_id:state.user.id,storage_path:path,phase});if(error){await db.storage.from('job-media').remove([path]);toast('התמונה לא נשמרה: '+error.message);return}toast('התמונה נשמרה בתיק העבודה');await loadJobMedia(j.id)
}
$('#beforePhotoInput').onchange=e=>{const file=e.target.files?.[0];uploadJobPhoto(file,'before');e.target.value=''};$('#afterPhotoInput').onchange=e=>{const file=e.target.files?.[0];uploadJobPhoto(file,'after');e.target.value=''};
async function loadProSettingsForm(){
  if(!requireServiceAccess())return;
  const s=await loadProSettings();$('#settingsPaymentProvider').value=s.payment_provider||'';$('#settingsPaymentLink').value=s.payment_link||'';$('#settingsLicenseNumber').value=s.electrician_license_number||'';$('#settingsLicenseExpiry').value=s.electrician_license_expiry||'';$('#settingsQuoteTerms').value=s.quote_terms||'';renderPaymentConnectionStatus();show('#proSettingsView')
}
function renderPaymentConnectionStatus(){
  const status=$('#settingsPaymentStatus');if(!status)return;
  const provider=$('#settingsPaymentProvider').value,link=safePaymentUrl($('#settingsPaymentLink').value.trim());
  status.classList.toggle('connected',Boolean(link));status.classList.toggle('not-connected',!link);
  status.textContent=link?`✓ קישור תשלום מוכן באמצעות ${paymentProviderLabel(provider)}`:'לא חובר עדיין קישור לתשלום'
}
$('#proSettingsBtn').onclick=loadProSettingsForm;
$('#settingsPaymentProvider').onchange=renderPaymentConnectionStatus;
$('#settingsPaymentLink').oninput=renderPaymentConnectionStatus;
$('#settingsPaymentTestBtn').onclick=()=>{const link=safePaymentUrl($('#settingsPaymentLink').value.trim());if(!link){toast('הדבק קודם קישור מאובטח שמתחיל ב־https://');return}window.open(link,'_blank','noopener,noreferrer')};
$('#settingsPaymentClearBtn').onclick=()=>{$('#settingsPaymentProvider').value='';$('#settingsPaymentLink').value='';renderPaymentConnectionStatus();toast('החיבור הוסר מהטופס. לחץ שמור הגדרות כדי להשלים')};
$('#proSettingsForm').onsubmit=async e=>{
  e.preventDefault();if(!requireServiceAccess())return;const enteredPaymentLink=$('#settingsPaymentLink').value.trim(),paymentLink=safePaymentUrl(enteredPaymentLink),selectedProvider=$('#settingsPaymentProvider').value;if(enteredPaymentLink&&!paymentLink){toast('מטעמי אבטחה קישור התשלום חייב להתחיל ב־https://');return}if(selectedProvider&&!paymentLink){toast('בחרת חברת סליקה — עכשיו צריך להדביק את קישור התשלום שלה');return}const paymentProvider=paymentLink?(selectedProvider||'other'):null;const existing=state.proSettings||defaultProSettings();const row={professional_id:state.user.id,trade:existing.trade,default_hourly_rate:existing.default_hourly_rate,default_travel_cost:existing.default_travel_cost,half_day_price:existing.half_day_price,full_day_price:existing.full_day_price,half_day_hours:existing.half_day_hours,full_day_hours:existing.full_day_hours,overtime_rate:existing.overtime_rate,time_rounding_minutes:existing.time_rounding_minutes,overhead_percent:existing.overhead_percent,risk_percent:existing.risk_percent,payment_provider:paymentProvider,payment_link:paymentLink||null,electrician_license_number:$('#settingsLicenseNumber').value.trim()||null,electrician_license_expiry:$('#settingsLicenseExpiry').value||null,quote_terms:$('#settingsQuoteTerms').value.trim()};
  const {data,error}=await db.from('professional_settings').upsert(row).select('*').single();if(error){toast(error.message);return}state.proSettings=data;toast(paymentLink?`התשלום חובר באמצעות ${paymentProviderLabel(paymentProvider)}`:'הגדרות התשלום נשמרו ללא קישור');await openProWorkspace()
};
function publicQuotePdfFileName(q){
  const customer=String(q.customer_name||'לקוח').replace(/[\\/:*?"<>|]+/g,'-').trim()||'לקוח';
  return `הצעת-מחיר-${customer}.pdf`
}
function publicQuotePdfElementLegacy(q,token){
  const items=Array.isArray(q.items)?q.items:[],approvalUrl=`${location.origin}${location.pathname}?quote=${token}`,paymentLink=safePaymentUrl(q.payment_link);
  const wrapper=document.createElement('div');wrapper.dataset.quotePdfWrapper='true';
  wrapper.style.cssText='position:fixed;left:-10000px;top:0;width:760px;pointer-events:none';
  const root=document.createElement('section');root.setAttribute('dir','rtl');
  root.style.cssText='position:relative;width:760px;box-sizing:border-box;padding:46px 50px;background:#fff;color:#17212b;font-family:Arial,"Noto Sans Hebrew",sans-serif;line-height:1.55;pointer-events:none';
  root.innerHTML=`<header style="display:flex;justify-content:space-between;gap:28px;align-items:flex-start;border-bottom:4px solid #1da873;padding-bottom:22px"><div><div style="font-size:36px;font-weight:900;color:#10243a">הצעת מחיר</div><div style="font-size:22px;font-weight:800;margin-top:4px">${esc(q.business_name||'בעל מקצוע')}</div>${q.business_phone?`<div style="margin-top:5px;color:#536274;font-size:14px">טלפון: ${esc(q.business_phone)}</div>`:''}</div><div style="text-align:left;color:#607184;font-size:14px"><div>${new Date().toLocaleDateString('he-IL')}</div><div>מס׳ ${esc(q.quote_number||'')}</div>${q.quote_valid_until?`<div>בתוקף עד ${esc(formatDate(q.quote_valid_until))}</div>`:''}</div></header><main><div style="margin:30px 0 20px"><div style="font-size:14px;color:#607184">לכבוד</div><div style="font-size:25px;font-weight:900">${esc(q.customer_name)}</div>${q.city?`<div style="color:#607184">${esc(q.city)}</div>`:''}</div><section style="margin:22px 0;padding:22px;border:1px solid #dce5ea;border-radius:16px;background:#f7fafb;break-inside:avoid"><div style="font-size:14px;color:#607184">תיאור העבודה</div><div style="font-size:21px;font-weight:800;margin:5px 0 10px">${esc(q.description)}</div>${q.quote_scope?`<div style="white-space:pre-wrap;color:#344454">${esc(q.quote_scope)}</div>`:''}</section>${items.length?`<section style="margin:20px 0;border:1px solid #dce5ea;border-radius:14px;overflow:hidden;break-inside:avoid"><div style="display:grid;grid-template-columns:1fr 70px 110px;background:#edf5f0;padding:10px 14px;font-weight:800"><span>פירוט</span><span>כמות</span><span>סה״כ</span></div>${items.map(i=>`<div style="display:grid;grid-template-columns:1fr 70px 110px;padding:10px 14px;border-top:1px solid #e8eeea"><span>${esc(i.description)}</span><span>${Number(i.quantity)||1}</span><span>${money(i.line_total??(Number(i.quantity||1)*Number(i.unit_price||0)))}</span></div>`).join('')}</section>`:''}<section style="margin:22px 0;padding:22px;text-align:center;border:2px solid #38b889;border-radius:16px;background:#eefaf5;break-inside:avoid"><div style="font-size:14px;color:#527064">מחיר ההצעה</div>${Number(q.discount_amount)>0?`<div style="color:#607184;text-decoration:line-through">${money(q.subtotal)}</div><div style="color:#287353">הנחה ${money(q.discount_amount)}</div>`:''}<div style="font-size:40px;line-height:1.2;font-weight:900;color:#16865b">${money(q.quoted_price)}</div>${Number(q.deposit_amount)>0?`<div style="margin-top:5px;font-weight:800">מקדמה: ${money(q.deposit_amount)}</div>`:''}</section>${q.scheduled_at?`<div style="margin:18px 0;padding:14px 18px;border-right:4px solid #3f8fc7;background:#f2f8fc;break-inside:avoid"><b>מועד מתוכנן:</b> ${esc(formatDateTime(q.scheduled_at))}</div>`:''}${q.warranty_text?`<div style="margin:18px 0;padding:14px 18px;border-right:4px solid #68a57e;background:#f3f9f5;break-inside:avoid"><b>אחריות:</b> ${esc(q.warranty_text)}</div>`:''}${q.quote_terms?`<section style="margin:22px 0;break-inside:avoid"><div style="font-size:16px;font-weight:900;margin-bottom:8px">תנאי ההצעה</div><div style="padding:16px;border:1px solid #e1e7eb;border-radius:12px;white-space:pre-wrap;color:#465667">${esc(q.quote_terms)}</div></section>`:''}<section style="margin-top:24px;padding-top:18px;border-top:1px solid #dce5ea;font-size:13px;color:#536274;break-inside:avoid"><div><b>צפייה ואישור ההצעה:</b></div><div style="direction:ltr;text-align:left;word-break:break-all;color:#1570a6">${esc(approvalUrl)}</div>${paymentLink?`<div style="margin-top:12px"><b>קישור לתשלום:</b></div><div style="direction:ltr;text-align:left;word-break:break-all;color:#1570a6">${esc(paymentLink)}</div>`:''}</section></main><footer style="margin-top:30px;padding-top:16px;border-top:1px solid #dce5ea;text-align:center;color:#7b8996;font-size:12px">הופק באמצעות מחירלי</footer>`;
  wrapper.appendChild(root);document.body.appendChild(wrapper);return root
}
function publicQuotePdfElement(q,token){
  const items=(Array.isArray(q.items)?q.items:[]).map(item=>({
    ...item,
    quantity:Number(item.quantity)||1,
    unit_price:Number(item.unit_price)||Number(item.line_total)||0
  }));
  const logoUrl=q.logo_path?db.storage.from('business-logos').getPublicUrl(q.logo_path).data?.publicUrl||'':'';
  const legalText=[q.legal_name,q.business_number&&`עוסק/ח.פ. ${q.business_number}`,q.business_address,q.business_email&&`אימייל ${q.business_email}`].filter(Boolean).join(' · ');
  return quotePdfElement({...q,items,public_token:token},{
    businessName:q.business_name||'בעל מקצוע',
    businessPhone:q.business_phone||'',
    logoUrl,
    legalText,
    licenseNumber:q.electrician_license_number||'',
    approvalUrl:`${location.origin}${location.pathname}?quote=${token}`,
    paymentLink:q.payment_link||'',
    paymentProvider:''
  })
}
const publicQuotePdfCache=new Map();
async function createPublicQuotePdfFile(q,token){
  const cached=publicQuotePdfCache.get(token);
  if(cached)return cached;
  const promise=(async()=>{
    if(typeof window.html2pdf!=='function')throw new Error('ספריית ה־PDF לא נטענה');
    const element=publicQuotePdfElement(q,token);
    try{
      const name=publicQuotePdfFileName(q),blob=await renderQuoteElementToPdfBlob(element,name);
      return new File([blob],name,{type:'application/pdf',lastModified:Date.now()})
    }finally{removeQuotePdfElement(element)}
  })();
  publicQuotePdfCache.set(token,promise);
  try{return await promise}catch(error){publicQuotePdfCache.delete(token);throw error}
}
function downloadFileToDevice(file){
  const objectUrl=URL.createObjectURL(file),link=document.createElement('a');
  link.href=objectUrl;link.download=file.name;link.style.display='none';document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(objectUrl),120000)
}
async function downloadPublicQuotePdf(q,token,button){
  const oldText=button.textContent;button.disabled=true;button.textContent='מכין מסמך PDF…';
  try{
    const file=await createPublicQuotePdfFile(q,token);
    if(isIosDevice()&&navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      await navigator.share({files:[file],title:`הצעת מחיר — ${q.business_name||'מחירלי'}`});
      toast('לשמירה באייפון: בחרו „שמירה בקבצים”')
    }else{
      downloadFileToDevice(file);
      toast('מסמך ה־PDF הורד למכשיר')
    }
  }catch(error){
    if(error?.name!=='AbortError'){console.error('Public quote PDF download failed',error);toast('לא ניתן להוריד את ה־PDF: '+(error?.message||'נסה שוב'))}
  }finally{button.disabled=false;button.textContent=oldText}
}
async function openPublicQuotePdf(q,token,button){
  const preview=window.open('about:blank','_blank');
  if(!preview){toast('יש לאפשר פתיחת חלון כדי לפתוח או להדפיס את ה־PDF');return}
  preview.document.write('<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>מחירלי</title><body style="font-family:Arial;text-align:center;padding:40px">מכין את מסמך ה־PDF…</body></html>');preview.document.close();
  const oldText=button.textContent;button.disabled=true;button.textContent='מכין PDF…';
  try{
    const file=await createPublicQuotePdfFile(q,token),objectUrl=URL.createObjectURL(file);
    preview.location.replace(objectUrl);setTimeout(()=>URL.revokeObjectURL(objectUrl),300000);
    toast('ה־PDF נפתח — אפשר לשמור או להדפיס')
  }catch(error){
    preview.close();console.error('Public quote PDF open failed',error);toast('לא ניתן לפתוח את ה־PDF: '+(error?.message||'נסה שוב'))
  }finally{button.disabled=false;button.textContent=oldText}
}
async function loadPublicQuote(token){
  const box=$('#publicQuoteContent');show('#publicQuoteView');box.innerHTML='<div class="card public-quote-card"><h2>טוען הצעת מחיר…</h2></div>';
  const {data,error}=await db.rpc('get_public_job_quote',{p_token:token});const q=Array.isArray(data)?data[0]:data;if(error||!q){box.innerHTML='<div class="card public-quote-card"><h2>ההצעה אינה זמינה</h2><p>הקישור שגוי או שההצעה בוטלה.</p></div>';return}
  const approved=['approved','scheduled','in_progress','completed','paid'].includes(q.status),lic=q.trade==='electrician'&&q.electrician_license_number?`<span class="badge">רישיון חשמלאי ${esc(q.electrician_license_number)}</span>`:'',paymentLink=safePaymentUrl(q.payment_link),businessWhatsapp=waNumber(q.business_phone||''),paymentAmount=Number(q.deposit_amount)>0?Number(q.deposit_amount):Number(q.quoted_price),paymentLabel=Number(q.deposit_amount)>0?`שלם מקדמה ${money(paymentAmount)}`:`שלם ${money(paymentAmount)}`,logo=q.logo_path?db.storage.from('business-logos').getPublicUrl(q.logo_path).data?.publicUrl:'',items=Array.isArray(q.items)?q.items:[],businessDetails=[q.legal_name,q.business_number&&`עוסק/ח.פ. ${q.business_number}`,q.business_address,q.business_email,q.business_phone].filter(Boolean);
  box.innerHTML=`<div class="public-quote-brand">מחירלי <small>הצעת מחיר דיגיטלית</small></div><div class="card public-quote-card">${logo?`<img class="public-business-logo" src="${esc(logo)}" alt="לוגו ${esc(q.business_name)}">`:''}<span class="quote-number">הצעה מס׳ ${esc(q.quote_number||'')}</span><h2>שלום ${esc(q.customer_name)}</h2><p class="quote-intro">${esc(q.business_name)} הכין עבורך הצעת מחיר.</p>${businessDetails.length?`<div class="public-business-details"><b>${esc(q.business_name)}</b>${businessDetails.map(detail=>`<div>${esc(detail)}</div>`).join('')}</div>`:''}<div class="quote-description"><small>עבור</small><b>${esc(q.description)}</b><p>${esc(q.quote_scope||'')}</p></div>${items.length?`<div class="quote-items-view">${items.map(i=>`<div><span>${esc(i.description)} · ${Number(i.quantity)}</span><b>${money(i.line_total)}</b></div>`).join('')}</div>`:''}<div class="public-price"><small>מחיר ההצעה</small>${Number(q.discount_amount)>0?`<span><s>${money(q.subtotal)}</s> · הנחה ${money(q.discount_amount)}</span>`:''}<strong>${money(q.quoted_price)}</strong>${Number(q.deposit_amount)>0?`<span>מקדמה: ${money(q.deposit_amount)}</span>`:''}</div><div class="badges">${lic}${q.scheduled_at?`<span class="badge">🗓️ ${esc(formatDateTime(q.scheduled_at))}</span>`:''}${q.quote_valid_until?`<span class="badge">בתוקף עד ${esc(formatDate(q.quote_valid_until))}</span>`:''}</div>${q.warranty_text?`<p><b>אחריות:</b> ${esc(q.warranty_text)}</p>`:''}${q.quote_terms?`<div class="terms-box">${esc(q.quote_terms)}</div>`:''}<div class="public-document-actions"><button id="downloadPublicQuotePdfBtn" class="secondary big">📥 הורד PDF לטלפון</button><button id="openPublicQuotePdfBtn" class="secondary big">🖨️ פתח / הדפס PDF</button></div><p class="public-download-note">באייפון בוחרים „שמירה בקבצים” לאחר לחיצה על הורדה. במחשב אפשר לפתוח ולהדפיס.</p>${approved?'<div class="approved-box">✓ ההצעה אושרה</div>':'<label class="quote-approval-consent"><input id="publicQuoteConsent" type="checkbox"><span>אני מאשר/ת שקראתי את היקף העבודה, המחיר, התוקף והתנאים המופיעים בהצעה.</span></label><button id="approvePublicQuoteBtn" class="primary big" disabled>אישור הצעת המחיר</button>'}<div class="public-contact-actions">${businessWhatsapp?`<a class="secondary big pay-link" target="_blank" rel="noopener" href="https://wa.me/${esc(businessWhatsapp)}?text=${encodeURIComponent(`🟠 מחירלי | שאלה על הצעת מחיר\n\nשלום, קיבלתי את הצעת המחיר${q.quote_number?' מס׳ '+q.quote_number:''} דרך מחירלי וברצוני לברר:`)}">💬 WhatsApp לבעל העסק</a>`:''}${approved&&paymentLink?`<a class="primary big pay-link customer-payment-button" target="_blank" rel="noopener" href="${esc(paymentLink)}">💳 ${paymentLabel} ישירות לבית העסק</a><p class="direct-payment-note">התשלום מתבצע באתר חברת הסליקה של ${esc(q.business_name)}. מחירלי אינה מקבלת את הכסף.</p>`:''}</div><p class="note">האישור מתייחס להיקף העבודה ולתנאים המופיעים בהצעה.</p></div>`;
  const pdfBtn=$('#downloadPublicQuotePdfBtn');if(pdfBtn)pdfBtn.onclick=()=>downloadPublicQuotePdf(q,token,pdfBtn);
  const openPdfBtn=$('#openPublicQuotePdfBtn');if(openPdfBtn)openPdfBtn.onclick=()=>openPublicQuotePdf(q,token,openPdfBtn);
  const btn=$('#approvePublicQuoteBtn'),consent=$('#publicQuoteConsent');if(btn&&consent){consent.onchange=()=>btn.disabled=!consent.checked;btn.onclick=async()=>{if(!consent.checked)return;btn.disabled=true;btn.textContent='מאשר…';const {error}=await db.rpc('approve_public_job_quote_v40',{p_token:token,p_consent_version:QUOTE_CONSENT_VERSION});if(error){toast('לא ניתן לאשר: '+error.message);btn.disabled=false;btn.textContent='אישור הצעת המחיר';return}toast('ההצעה אושרה בהצלחה');await loadPublicQuote(token)}}
}

function renderAdminMarketing(funnel={}){
  $('#adminUniqueVisitors').textContent=funnel.unique_visitors_30d??funnel.unique_visitors??0;
  $('#adminVisitors30d').textContent=adminAnalyticsRange==='today'?'היום':'30 הימים האחרונים';
  $('#adminTrialClicks').textContent=funnel.trial_clicks||0;$('#adminFormOpens').textContent=funnel.form_opens||0;$('#adminSignupAttempts').textContent=funnel.signup_attempts||0;$('#adminTrialSignups').textContent=funnel.trial_signups||0;$('#adminFirstJobs').textContent=funnel.first_jobs||0;$('#adminQuoteSends').textContent=funnel.quote_sends||0;$('#adminAppInstalls').textContent=funnel.installs||0;$('#adminPayingCustomers').textContent=funnel.paying_customers||0;
  $('#adminVisitClickConversion').textContent=`${Number(funnel.visitor_to_click_percent||0).toLocaleString('he-IL')}%`;$('#adminClickTrialConversion').textContent=`${Number(funnel.click_to_trial_percent||0).toLocaleString('he-IL')}%`;$('#adminTrialJobConversion').textContent=`${Number(funnel.trial_to_job_percent||0).toLocaleString('he-IL')}%`;$('#adminTrialPaidConversion').textContent=`${Number(funnel.trial_to_paid_percent||0).toLocaleString('he-IL')}%`;
  const sources=Array.isArray(funnel.source_breakdown)?funnel.source_breakdown:Array.isArray(funnel.top_sources)?funnel.top_sources:[];
  $('#adminTrafficSources').innerHTML=sources.length?`<b>ביצועים לפי מקור</b><div class="traffic-table"><div class="traffic-head"><span>מקור</span><span>כניסות</span><span>לחצו</span><span>טופס</span><span>ניסו</span><span>נרשמו</span></div>${sources.map(row=>`<div><span>${esc(row.source||'ישיר')}</span><strong>${Number(row.visitors||0)}</strong><strong>${Number(row.trial_clicks||0)}</strong><strong>${Number(row.form_opens||0)}</strong><strong>${Number(row.signup_attempts||0)}</strong><strong>${Number(row.trial_signups||0)}</strong></div>`).join('')}</div>`:'<small>אין עדיין כניסות בטווח שנבחר.</small>';
  $$('[data-admin-analytics-range]').forEach(button=>button.classList.toggle('active',button.dataset.adminAnalyticsRange===adminAnalyticsRange));
  const updated=funnel.generated_at?new Date(funnel.generated_at):new Date();
  $('#adminAnalyticsNote').textContent=`עודכן ${updated.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})} · כניסות מפייסבוק ללא קמפיין מוצגות כאורגניות/ויראליות.`
}
async function loadAdminMarketing(range=adminAnalyticsRange){
  adminAnalyticsRange=range==='30d'?'30d':'today';
  const {data,error}=await rpcWithFallback('admin_marketing_summary_v87','admin_marketing_summary_v63',{p_range:adminAnalyticsRange});
  if(error){toast(error.message||'לא ניתן לרענן את נתוני הכניסות');return false}
  renderAdminMarketing(data||{});return true
}
async function loadAdmin(){
  if(!state.isAdmin){toast('אין הרשאת מנהל');return false}
  const [{data:summary,error:se},{data:jobs,error:je},{data:businesses,error:be},{data:billing,error:bse},{data:marketing,error:me}]=await Promise.all([
    db.rpc('admin_professional_summary_v33'),db.rpc('admin_list_pro_jobs'),rpcWithFallback('admin_list_businesses_v83','admin_list_businesses_v33'),rpcWithFallback('admin_get_billing_settings_v38','admin_get_billing_settings_v33'),rpcWithFallback('admin_marketing_summary_v87','admin_marketing_summary_v63',{p_range:adminAnalyticsRange})
  ]);
  if(se||je||be||bse||me){toast((se||je||be||bse||me).message||'לא ניתן לטעון את אזור המנהל');return false}
  const sum=summary||{};state.adminJobs=jobs||[];state.adminBusinesses=businesses||[];state.billingSettings=billing||{};
  renderAdminMarketing(marketing||{});
  $('#adminBusinessesCount').textContent=sum.businesses||0;$('#adminJobsCount').textContent=sum.jobs||0;
  $('#adminActiveSubscriptionsCount').textContent=sum.active_subscriptions||0;$('#adminSuspendedCount').textContent=sum.suspended_subscriptions||0;
  $('#adminPendingPaymentsCount').textContent=sum.pending_payments||0;$('#adminSubscriptionRevenue').textContent=money(sum.subscription_revenue||0);
  $('#adminMonthlyPrice').value=state.billingSettings.monthly_price??29;$('#adminTrialDays').value=state.billingSettings.trial_days??14;$('#adminGraceDays').value=2;
  $('#adminSubscriptionPaymentUrl').value=state.billingSettings.payment_url||'';$('#adminSupportWhatsapp').value=state.billingSettings.support_whatsapp||'';
  const modeStatus=$('#adminBillingModeStatus'),automatic=state.billingSettings.payment_mode==='cardcom';
  if(modeStatus){modeStatus.classList.toggle('connected',automatic);modeStatus.classList.toggle('not-connected',!automatic);modeStatus.textContent=automatic?'✓ סליקת API אוטומטית של מחירלי פעילה':'חיבור API לקארדקום מוכן בקוד וממתין לאישור ולהפעלה'}
  renderAdminJobs();renderAdminBusinesses();return true
}
function renderAdminJobs(){
  const box=$('#adminJobsList'),filter=$('#adminTradeFilter').value,rows=state.adminJobs.filter(j=>filter==='all'||j.trade===filter);
  box.innerHTML=rows.length?rows.map(j=>`<div class="item admin-job"><div class="job-card-top"><span class="trade-badge ${j.trade}">${tradeIcon(j.trade)} ${tradeHe[j.trade]||'בעל מקצוע'}</span><span class="status-pill status-${j.status}">${jobStatusHe[j.status]||j.status}</span></div><h3>${esc(j.customer_name||'לקוח')}</h3><p>${esc(j.description||'')}</p><div class="admin-user-meta"><span class="badge">🏪 ${esc(j.business_name||'עסק ללא שם')}</span><span class="badge">📍 ${esc(j.city||'לא צוין')}</span><span class="badge">${money(j.quoted_price)}</span></div><div class="admin-record-actions"><button type="button" class="delete-action" data-admin-delete-job="${j.job_id}">🗑️ מחק עבודה</button></div></div>`).join(''):'<div class="card"><h3>אין עבודות בקטגוריה הזו</h3></div>';
  box.querySelectorAll('[data-admin-delete-job]').forEach(button=>button.onclick=()=>deleteAdminJob(button.dataset.adminDeleteJob,button))
}
function renderAdminBusinesses(){
  const box=$('#adminBusinessesList');
  box.innerHTML=state.adminBusinesses.length?state.adminBusinesses.map(b=>{
    const status=b.subscription_status||'not_started',end=status==='trial'?b.trial_ends_at:status==='past_due'?b.grace_ends_at:b.current_period_ends_at;
    const paymentPending=Number(b.pending_payment_count||0)>0;
    const controls=b.is_admin?'':`<div class="subscription-admin-actions"><button type="button" class="approve-btn" data-sub-action="record_payment" data-professional="${b.professional_id}">✓ אשר תשלום ל־30 יום</button>${status==='suspended'||status==='cancelled'?`<button type="button" class="secondary" data-sub-action="activate" data-professional="${b.professional_id}">הפעל שירות</button>`:`<button type="button" class="suspend-action" data-sub-action="suspend" data-professional="${b.professional_id}">השהה שירות</button>`}<button type="button" class="secondary" data-sub-action="extend_trial" data-professional="${b.professional_id}">＋ 7 ימי ניסיון</button>${paymentPending?`<button type="button" class="reject-action" data-sub-action="reject_payment" data-professional="${b.professional_id}">דחה דיווח תשלום</button>`:''}</div>`;
    const steps=[['registered_at','📝','נרשם'],['install_clicked_at','👆','לחץ התקנה'],['installed_at','📲','פתח מהאייקון'],['first_quote_created_at','🧾','יצר הצעה'],['first_quote_sent_at','💬','שלח הצעה']];
    const progress=`<div class="onboarding-progress" aria-label="התקדמות הפעלת מחירלי">${steps.map(([key,icon,label])=>`<div class="onboarding-step ${b[key]?'done':''}"><span>${b[key]?'✓':icon}</span>${label}</div>`).join('')}</div>`;
    return `<div class="item admin-business"><div class="job-card-top"><h3>${esc(b.business_name||b.email||'בעל עסק')}</h3><span class="subscription-status status-${status}">${subscriptionStatusHe[status]||status}</span></div><p>${esc(b.email||'')}</p><div class="admin-user-meta"><span class="trade-badge ${b.trade}">${tradeIcon(b.trade)} ${tradeHe[b.trade]||'טרם הוגדר'}</span><span class="badge">${Number(b.job_count||0)} עבודות</span><span class="badge">הכנסות מעבודות ${money(b.revenue||0)}</span>${end?`<span class="badge">עד ${formatDate(end)}</span>`:''}${paymentPending?'<span class="badge payment-pending-badge">💳 תשלום ממתין לאישור</span>':''}</div>${progress}${controls}<div class="admin-record-actions"><button type="button" class="delete-action" data-admin-delete-business="${b.professional_id}" data-business-name="${esc(b.business_name||b.email||'בעל העסק')}">🗑️ מחק בעל עסק לצמיתות</button></div></div>`
  }).join(''):'<div class="card"><h3>עדיין אין בעלי עסקים</h3></div>';
  box.querySelectorAll('[data-sub-action]').forEach(button=>button.onclick=()=>adminSubscriptionAction(button.dataset.professional,button.dataset.subAction,button));
  box.querySelectorAll('[data-admin-delete-business]').forEach(button=>button.onclick=()=>deleteAdminBusiness(button.dataset.adminDeleteBusiness,button.dataset.businessName,button))
}
async function adminSubscriptionAction(professionalId,action,button){
  const business=state.adminBusinesses.find(b=>b.professional_id===professionalId),name=business?.business_name||business?.email||'בעל העסק';
  if(action==='suspend'&&!confirm(`להשהות את השירות של ${name}?\n\nהמידע יישמר, אבל לא יהיה ניתן ליצור או לעדכן עבודות עד להפעלה מחדש.`))return;
  if(action==='record_payment'&&!confirm(`לאשר שקיבלת תשלום מ־${name} ולהפעיל את המנוי ל־30 יום?`))return;
  button.disabled=true;const oldText=button.textContent;button.textContent='מעדכן…';
  const {error}=await db.rpc('admin_subscription_action_v33',{p_professional_id:professionalId,p_action:action});
  if(error){button.disabled=false;button.textContent=oldText;toast('לא ניתן לעדכן: '+error.message);return}
  await loadAdmin();toast(action==='suspend'?'השירות הושהה והמידע נשמר':action==='reject_payment'?'דיווח התשלום נדחה':'המנוי עודכן בהצלחה')
}
$('#adminBillingSettingsForm').onsubmit=async e=>{
  e.preventDefault();const entered=$('#adminSubscriptionPaymentUrl').value.trim(),url=safeHttpUrl(entered);if(entered&&!url){toast('קישור התשלום חייב להתחיל ב־https://');return}
  const {data,error}=await db.rpc('admin_save_billing_settings_v33',{p_monthly_price:numberValue('#adminMonthlyPrice'),p_trial_days:numberValue('#adminTrialDays'),p_grace_days:numberValue('#adminGraceDays'),p_payment_url:url||null,p_support_whatsapp:$('#adminSupportWhatsapp').value.trim()||null});
  if(error){toast('לא נשמר: '+error.message);return}state.billingSettings=data;toast('הגדרות המנוי נשמרו')
};
async function deleteAdminJob(jobId,button){
  if(!confirm('למחוק את העבודה לצמיתות? הפעולה אינה ניתנת לביטול.'))return;
  button.disabled=true;button.textContent='מוחק…';
  const {data,error}=await db.rpc('admin_delete_pro_job_v32',{p_job_id:jobId});
  if(error||!data){button.disabled=false;button.textContent='🗑️ מחק עבודה';toast(error?.message||'העבודה לא נמצאה');return}
  await loadAdmin();toast('העבודה נמחקה')
}
async function deleteAdminBusiness(professionalId,businessName,button){
  if(!confirm(`למחוק לצמיתות את ${businessName}?\n\nהחשבון וכל העבודות שלו יימחקו ולא ניתן יהיה לשחזר אותם.`))return;
  button.disabled=true;button.textContent='מוחק…';
  const {data,error}=await db.rpc('admin_delete_business_v32',{p_professional_id:professionalId});
  if(error||!data){button.disabled=false;button.textContent='🗑️ מחק בעל עסק';const message=error?.message==='cannot_delete_self'?'אי אפשר למחוק את חשבון המנהל':error?.message==='cannot_delete_admin'?'אי אפשר למחוק מנהל אחר':error?.message;toast(message||'בעל העסק לא נמצא');return}
  await loadAdmin();toast('בעל העסק וכל העבודות שלו נמחקו')
}
async function openAdmin(){
  if(!state.isAdmin){toast('אין הרשאת מנהל');return}
  const loading=$('#adminLoading'),button=$('#adminBtn');
  show('#adminView');loading.classList.remove('hidden');button.disabled=true;
  const loaded=await loadAdmin();
  loading.classList.add('hidden');button.disabled=false;
  if(!loaded)show('#homeView');
  else{clearInterval(adminAnalyticsTimer);adminAnalyticsTimer=setInterval(()=>{if(!$('#adminView')?.classList.contains('hidden')&&document.visibilityState==='visible')loadAdminMarketing()},30000)}
}
const adminBtn=$('#adminBtn');if(adminBtn)adminBtn.addEventListener('click',openAdmin);
$$('[data-admin-analytics-range]').forEach(button=>button.onclick=()=>loadAdminMarketing(button.dataset.adminAnalyticsRange));
$('#adminAnalyticsRefresh').onclick=()=>loadAdminMarketing();
$('#adminTradeFilter').onchange=renderAdminJobs;
$$('.admin-tab').forEach(b=>b.onclick=()=>{$$('.admin-tab').forEach(x=>x.classList.toggle('active',x===b));['jobs','businesses'].forEach(k=>$(`#admin${k[0].toUpperCase()+k.slice(1)}Panel`).classList.toggle('hidden',b.dataset.adminTab!==k))});

async function openSubscription(){
  if(!state.user)return;await loadSubscription();const s=state.subscription||{},status=s.status||'suspended';
  $('#subscriptionStatusBadge').className=`subscription-status status-${status}`;$('#subscriptionStatusBadge').textContent=subscriptionStatusHe[status]||status;
  let title='מנוי מחירלי',message='';
  if(status==='admin'){title='חשבון מנהל';message='לחשבון המנהל יש גישה מלאה והוא אינו מחויב במנוי.'}
  else if(status==='trial'){title=`${daysLeft(s.trial_ends_at)} ימים נותרו בתקופת הניסיון`;message=`אפשר להשתמש בכל הכלים של מחירלי ללא הגבלה עד ${formatDate(s.trial_ends_at)}.`}
  else if(status==='active'){title='המנוי שלך פעיל';message=`הגישה המלאה בתוקף עד ${formatDate(s.current_period_ends_at)}.`}
  else if(status==='past_due'){title='התשלום דורש טיפול';message=`לא עצרנו את העבודה מיד. אפשר להמשיך בתקופת חסד עד ${formatDate(s.grace_ends_at)}.`}
  else {title='השירות מושהה — המידע שמור';message='לא ניתן ליצור או לעדכן עבודות עד להסדרת התשלום. הלקוחות, התמונות והעבודות לא נמחקו.'}
  $('#subscriptionTitle').textContent=title;$('#subscriptionMessage').textContent=message;
  $('#subscriptionDates').innerHTML=`<div><small>מחיר חודשי · כולל מע״מ</small><strong>${money(s.monthly_price??29)}</strong></div>${s.trial_ends_at?`<div><small>סיום ניסיון</small><strong>${formatDate(s.trial_ends_at)}</strong></div>`:''}${s.current_period_ends_at?`<div><small>המנוי בתוקף עד</small><strong>${formatDate(s.current_period_ends_at)}</strong></div>`:''}${s.grace_ends_at&&status==='past_due'?`<div><small>סיום ימי החסד</small><strong>${formatDate(s.grace_ends_at)}</strong></div>`:''}`;
  const pay=$('#subscriptionPayBtn'),paid=$('#subscriptionPaidBtn'),support=$('#subscriptionSupportBtn'),paymentUrl=safeHttpUrl(s.payment_url),supportNumber=waNumber(s.support_whatsapp||''),automatic=s.payment_mode==='cardcom',canPay=automatic||Boolean(paymentUrl);
  pay.classList.toggle('hidden',!canPay||status==='admin');pay.textContent=`תשלום מנוי מחירלי — ${money(s.monthly_price??29)}`;
  paid.classList.toggle('hidden',automatic||!paymentUrl||status==='admin'||s.pending_payment===true);
  support.classList.toggle('hidden',!supportNumber||status==='admin');if(supportNumber)support.href=whatsappUrl(supportNumber,'🟠 מחירלי | תמיכה במנוי\n\nשלום, הגעתי מאתר מחירלי ואני צריך עזרה בהסדרת המנוי.');
  const report=$('#subscriptionPaymentStatus'),order=s.latest_payment_order;
  let reportHtml=s.pending_payment?`<b>התשלום ממתין לאישור</b><span>הדיווח התקבל ב־${formatDateTime(s.pending_payment_at)}. לאחר האישור השירות יופעל ל־30 יום.</span>`:'';
  if(automatic&&order?.status==='checkout_ready')reportHtml='<b>דף התשלום מוכן</b><span>לאחר תשלום מוצלח המנוי יופעל אוטומטית והחשבונית תישלח מקארדקום.</span>';
  if(automatic&&order?.status==='paid')reportHtml=`<b>✓ התשלום האחרון נקלט</b><span>${order.document_number?`חשבונית מספר ${esc(order.document_number)} הופקה ונשלחה על ידי קארדקום.`:'המנוי הופעל. החשבונית נשלחת על ידי קארדקום.'}</span>`;
  if(automatic&&order?.status==='failed')reportHtml='<b>התשלום לא הושלם</b><span>לא בוצע חיוב. אפשר לנסות שוב או לפנות לתמיכה.</span>';
  report.classList.toggle('hidden',!reportHtml);report.innerHTML=reportHtml;
  show('#subscriptionView')
}
$('#subscriptionBtn').onclick=openSubscription;$('#subscriptionBanner').onclick=openSubscription;
$('#subscriptionBackBtn').onclick=()=>hasServiceAccess()?show('#homeView'):openSubscription();
$('#subscriptionLogoutBtn').onclick=async()=>{stopNotificationPolling();await db.auth.signOut();state.user=null;refreshDeveloperSupportLink();show('#authView')};
$('#subscriptionPayBtn').onclick=async()=>{
  const s=state.subscription||{},button=$('#subscriptionPayBtn');
  if(s.payment_mode!=='cardcom'){
    const url=safeHttpUrl(s.payment_url);if(url)window.open(url,'_blank','noopener,noreferrer');else toast('קישור התשלום עדיין לא הוגדר');return
  }
  trackAppEvent('payment_started');
  button.disabled=true;const old=button.textContent;button.textContent='פותח תשלום מאובטח…';
  const {data,error}=await db.functions.invoke('mehirli-cardcom-checkout',{body:{product:'MEHIRLI-MONTHLY'}});
  if(error||!safePaymentUrl(data?.checkout_url)){
    button.disabled=false;button.textContent=old;
    const code=data?.error||error?.context?.error||'';
    toast(code==='cardcom_waiting_for_approval'?'החיבור לקארדקום עדיין ממתין לאישור':'לא ניתן לפתוח כרגע את דף התשלום');return
  }
  location.assign(data.checkout_url)
};
$('#subscriptionPaidBtn').onclick=async()=>{
  const button=$('#subscriptionPaidBtn');button.disabled=true;button.textContent='שולח לאישור…';
  const {error}=await db.rpc('report_subscription_payment_v33',{p_reference_note:null});
  button.disabled=false;button.textContent='✓ שילמתי — שלח לאישור';
  if(error){toast('לא ניתן לדווח על התשלום: '+error.message);return}
  await openSubscription();toast('הדיווח נשלח למנהל לאישור')
};

async function handlePaymentReturn(){
  const result=paymentReturn();if(!result){await routeAfterLogin();return}
  await openSubscription();
  if(result.status==='failed'){toast('התשלום לא אושר ולא בוצע חיוב');clearPaymentReturn();return}
  if(result.status==='cancelled'){toast('התשלום בוטל ולא בוצע חיוב');clearPaymentReturn();return}
  toast('התשלום הסתיים. מוודא את האישור מול קארדקום…');
  for(let attempt=0;attempt<6;attempt++){
    await new Promise(resolve=>setTimeout(resolve,1500));
    await loadSubscription();
    if(state.subscription?.latest_payment_order?.status==='paid'||state.subscription?.status==='active')break
  }
  await openSubscription();
  const paid=state.subscription?.latest_payment_order?.status==='paid'||state.subscription?.status==='active';if(paid)trackAppEvent('payment_completed');toast(paid?'התשלום נקלט והמנוי הופעל ✅':'האישור עדיין מתעדכן. אין צורך לשלם שוב.');
  clearPaymentReturn()
}

// PWA install flow (V13)
let deferredInstallPrompt=null;
const installBtn=document.querySelector('#installAppBtn');
const isStandalone=isStandaloneMode;
const isIosDevice=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function showIosInstallHelp(){
  const old=document.querySelector('#iosInstallHelp');if(old)old.remove();
  const overlay=document.createElement('div');overlay.id='iosInstallHelp';overlay.className='ios-install-overlay';
  overlay.innerHTML='<div class="ios-install-card" role="dialog" aria-modal="true" aria-label="התקנת מחירלי באייפון"><button type="button" class="ios-install-close" aria-label="סגור">×</button><span class="ios-install-icon">📲</span><h3>התקנת מחירלי באייפון</h3><ol><li>פתח את האתר בדפדפן <b>Safari</b>.</li><li>לחץ בתחתית על כפתור השיתוף <b>□↑</b>.</li><li>בחר <b>״הוספה למסך הבית״</b> ואז <b>״הוסף״</b>.</li></ol><button type="button" class="primary big ios-install-done">הבנתי</button></div>';
  document.body.appendChild(overlay);
  const close=()=>overlay.remove();overlay.querySelector('.ios-install-close').onclick=close;overlay.querySelector('.ios-install-done').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close()}
}
function updateInstallButton(){
  if(!installBtn)return;
  installBtn.classList.toggle('hidden',isStandalone());
  if(!isStandalone())installBtn.textContent=isIosDevice()?' התקנה באייפון':'⬇ התקן אפליקציה';
}
async function requestAppInstall(){
  await markOnboardingStep('install_clicked');
  if(isAndroidInAppBrowser()){openInChrome();return}
  if(isStandalone()){
    if(state.subscription?.failure_reason==='installation_required')await activateTrialAfterInstall();
    else toast('מחירלי כבר מותקנת כאפליקציה');
    return
  }
  if(isIosDevice()){showIosInstallHelp();return}
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    const choice=await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null;updateInstallButton();
    // Installation completes at appinstalled or on a later standalone launch.
    return
  }
  toast('בתפריט הדפדפן בחר ״התקנת אפליקציה״ — לא ״הוסף קיצור דרך״.')
}
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredInstallPrompt=e;
  if(installBtn) installBtn.classList.remove('hidden');
});
window.addEventListener('appinstalled',async()=>{
  deferredInstallPrompt=null;
  trackAppEvent('app_installed');
  if(installBtn) installBtn.classList.add('hidden');
  if(state.subscription?.failure_reason==='installation_required')await activateTrialAfterInstall();
  else if(!state.onboarding?.first_quote_created_at)showFirstQuoteWelcome();
  toast('מחירלי הותקנה כאפליקציה ✅');
});
if(installBtn)installBtn.onclick=requestAppInstall;
$('#openChromeBtn').onclick=openInChrome;
$('#postSignupInstallBtn').onclick=requestAppInstall;
$('#postSignupEditBtn').onclick=openPendingSignupEdit;
$('#firstQuoteWelcomeBtn').onclick=async()=>{$('#firstQuoteWelcome')?.classList.add('hidden');await openNewProJob()};
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
