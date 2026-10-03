const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {parseHTML}=require('linkedom');
const root=path.join(__dirname,'..');
function setup(){
 const {document}=parseHTML(fs.readFileSync(path.join(root,'app.html'),'utf8'));
 const events={},opened=[],calls=[],location=new URL('https://example.test/mehirli-app/app.html');location.assign=url=>opened.push(url);
 const db={auth:{onAuthStateChange(){},getSession:()=>new Promise(()=>{}),signUp:async()=>({data:{user:{id:'new',identities:[{}]},session:null}})},functions:{invoke:async()=>({data:{checkout_url:'https://secure.cardcom.solutions/test'}})},rpc:async(name)=>{calls.push(name);return {data:null,error:null}}};
 const window={supabase:{createClient:()=>db},matchMedia:()=>({matches:false}),scrollTo(){},addEventListener:(n,f)=>events[n]=f,navigator:{},location,open:url=>opened.push(url),MehirliTraffic:{event:async()=>{},visitor:()=>'',attribution:()=>({}),trackVisit(){}}};
 const context=vm.createContext({window,document,navigator:{userAgent:'qa'},location,URL,URLSearchParams,console,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},Notification:{permission:'denied'},history:{replaceState(){}},confirm:()=>false});
 for(const x of document.querySelectorAll('input,select,textarea')){x.checkValidity=()=>true;x.reportValidity=()=>{};x.willValidate=false;x.scrollIntoView=()=>{};}
 for(const x of document.querySelectorAll('[data-job-step]'))x.scrollIntoView=()=>{};
 for(const file of ['app.js','home-dashboard.js','finance-core.js','finance.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 document.querySelector('#authForm').scrollIntoView=()=>{window.scrolledToAuth=true};
 const run=code=>vm.runInContext(code,context),q=selector=>document.querySelector(selector);
 return {run,q,db,window,events,opened,calls,document};
}
test('all production scripts initialize and primary controls have handlers',()=>{
 const a=setup();for(const id of ['signupBtn','forgotPasswordBtn','installAppBtn','homeNewJobBtn','proWorkspaceBtn','homeFinanceBtn','profileBtn','sampleQuoteBtn','subscriptionBtn','homeCalendarBtn','homeAllJobsBtn','subscriptionPayBtn','settingsPaymentTestBtn','newAppointmentBtn','cancelAppointmentBtn'])assert.equal(typeof a.q('#'+id).onclick,'function',id);
 for(const b of a.document.querySelectorAll('[data-app-nav],[data-job-next],[data-job-step]'))assert.equal(typeof b.onclick,'function');
});
test('four stages and next buttons open the intended panel',()=>{
 const a=setup();a.run('setJobStep(0)');for(let n=0;n<3;n++){assert.equal(a.q('#jobPanel'+n).hidden,false);a.q('[data-job-next="'+(n+1)+'"]').onclick();assert.equal(a.q('#jobPanel'+(n+1)).hidden,false);assert.equal(a.q('#jobPanel'+n).hidden,true)}
});
test('customer history shows all jobs and opens their original job IDs',()=>{
 const a=setup();a.run(`state.proCustomers=[{id:'c',name:'לקוח <בדיקה>',phone:'0501111111',normalized_phone:'0501111111'}];state.proJobs=Array.from({length:5},(_,i)=>({id:'j'+i,customer_id:'c',customer_name:'לקוח',description:'צביעה '+i,quoted_price:1200,status:'quoted'}));openProJobDetail=id=>{window.openedJob=id};renderCustomers()`);
 const buttons=a.document.querySelectorAll('[data-customer-job]');assert.equal(buttons.length,5);buttons[4].onclick();assert.equal(a.window.openedJob,'j4');assert.match(a.q('#customersList').innerHTML,/&lt;בדיקה&gt;/);
});
test('calendar renders notes, safe Hebrew Waze links, and omits missing addresses',()=>{
 const a=setup();a.run(`state.proAppointments=[{id:'a',customer_name:'לקוח',appointment_at:'2026-09-29T08:00:00Z',title:'פגישה',address:'הרצל 12, נתניה',notes:'להביא <דוגמה>'},{id:'b',customer_name:'שני',appointment_at:'2026-09-29T09:00:00Z',title:'פגישה'}];renderCalendar()`);
 const links=a.q('#calendarList').querySelectorAll('a');assert.equal(links.length,1);const u=new URL(links[0].getAttribute('href'));assert.equal(u.searchParams.get('q'),'הרצל 12, נתניה');assert.equal(u.searchParams.get('navigate'),'yes');assert.match(a.q('#calendarList').innerHTML,/להביא &lt;דוגמה&gt;/);assert.equal(a.q('#calendarList').querySelectorAll('[data-cancel-appointment]').length,2);
});
test('home uses live state, excludes closed jobs and opens the selected job',()=>{
 const a=setup();a.run(`state.proJobs=[{id:'open',customer_name:'לקוח',description:'צביעה',quoted_price:1200,status:'quoted'},{id:'paid',description:'סגור',status:'paid'},{id:'cancelled',description:'בוטל',status:'cancelled'}];openProJobDetail=id=>{window.openedJob=id};renderHomeDashboard()`);
 assert.equal(a.q('#homeOpenJobs').querySelectorAll('button').length,1);a.q('[data-home-job]').onclick();assert.equal(a.window.openedJob,'open');assert.equal(a.q('#homeTodayList').textContent.includes('אין פגישות'),true);
});
test('WhatsApp proposal and payment messages preserve Hebrew, token, deposit and balance',()=>{
 const a=setup();const result=a.run(`state.proSettings={payment_link:'https://pay.example/merchant',payment_provider:'cardcom'};const j={customer_name:'דוגמה',customer_phone:'0552715782',description:'צביעה & תיקון',public_token:'00000000-0000-4000-8000-000000000001',quoted_price:1200,actual_paid:300,deposit_amount:300};({quote:whatsappUrl(j.customer_phone,quoteMessage(j)),payment:paymentMessage(j)})`);const u=new URL(result.quote);assert.equal(u.pathname,'/972552715782');assert.match(u.searchParams.get('text'),/צביעה & תיקון/);assert.match(u.searchParams.get('text'),/מקדמה: 300/);assert.match(u.searchParams.get('text'),/quote.html\?quote=/);assert.match(result.payment,/900/);assert.match(result.payment,/https:\/\/pay.example\/merchant/);assert.equal(a.run("safePaymentUrl('javascript:alert(1)')"),'');
});
test('signup prevents duplicates and recovers button after network failure',async()=>{
 const a=setup();a.q('#authName').value='בדיקת ממשק';a.q('#authEmail').value='test@example.test';a.q('#authPassword').value='test-only-placeholder';a.q('#signupLegalConsent').checked=true;
 let count=0,release;a.db.auth.signUp=()=>{count++;return new Promise(r=>release=r)};const p=a.q('#signupBtn').onclick();await a.q('#signupBtn').onclick();assert.equal(count,1);release({data:{user:{id:'test',identities:[{}]},session:null}});await p;assert.equal(a.q('#signupBtn').disabled,false);
 a.db.auth.signUp=async()=>{throw Error('offline')};await a.q('#signupBtn').onclick();assert.equal(a.q('#signupBtn').disabled,false);assert.match(a.q('#authNote').textContent,/החיבור נקטע/);
});
test('analytics failure does not block registration completion',async()=>{
 const a=setup();a.q('#authName').value='בדיקה';a.q('#authEmail').value='test@example.test';a.q('#authPassword').value='test-only-placeholder';a.q('#signupLegalConsent').checked=true;a.window.MehirliTraffic.event=async()=>{throw Error('blocked')};await a.q('#signupBtn').onclick();assert.match(a.q('#authNote').textContent,/אימייל לאישור/);
});
test('subscription checkout navigates only to valid HTTPS and recovers from failure',async()=>{
 const a=setup();a.run("state.subscription={payment_mode:'cardcom'}");await a.q('#subscriptionPayBtn').onclick();assert.equal(a.opened[0],'https://secure.cardcom.solutions/test');a.db.functions.invoke=async()=>{throw Error('offline')};await a.q('#subscriptionPayBtn').onclick();assert.equal(a.q('#subscriptionPayBtn').disabled,false);assert.match(a.q('#toast').textContent,/החיבור לתשלום נקטע/);a.db.functions.invoke=async()=>({data:{checkout_url:'javascript:alert(1)'}});await a.q('#subscriptionPayBtn').onclick();assert.equal(a.opened.length,1);
});
test('install prompt is not delayed by a network tracking call',async()=>{
 const a=setup();let prompted=false;a.run("markOnboardingStep=()=>new Promise(()=>{})");a.events.beforeinstallprompt({preventDefault(){},prompt(){prompted=true},userChoice:Promise.resolve({outcome:'dismissed'})});await a.q('#installAppBtn').onclick();assert.equal(prompted,true);
});
test('manifest and offline cache point to existing versioned app assets',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/mehirli-app/app.html');for(const icon of manifest.icons)assert.ok(fs.existsSync(path.join(root,icon.src)));
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');new vm.Script(sw);const assets=vm.runInNewContext(sw.slice(0,sw.indexOf('self.addEventListener'))+'ASSETS');for(const asset of assets){const f=asset.split('?')[0];if(f!=='./')assert.ok(fs.existsSync(path.join(root,f)),asset)}
 for(const assetName of ['app-design.css','home-dashboard.js']){const html=fs.readFileSync(path.join(root,'app.html'),'utf8');const match=html.match(new RegExp(assetName.replace('.','\\.')+'\\?v=\\d+'));assert.ok(match,assetName);assert.ok(assets.includes('./'+match[0]),match[0]);}
});

test('money displays cents in quotes and payment messages',()=>{const a=setup();assert.equal(a.run('money(1200.5)'), '1,200.5 ₪')});


test('saved proposals keep a WhatsApp button when reopened and after opening share',async()=>{
 const a=setup();a.run(`state.selectedProJob={id:'job',customer_name:'בדיקה',customer_phone:'0552715782',status:'quoted',quoted_price:1170,items:[]};loadProSettings=async()=>{};renderJobLedger=async()=>{};prepareJobQuotePdf=async()=>{};loadJobMedia=async()=>{};requireServiceAccess=()=>true;markOnboardingStep=()=>new Promise(()=>{});openWhatsapp=()=>true;`);
 await a.run('renderProJobDetail()');assert.ok(a.q('[data-job-action="quote-whatsapp"]'));
 await a.run('sendDigitalQuoteToWhatsapp(state.selectedProJob)');assert.ok(a.q('[data-job-action="quote-whatsapp"]'));
 await a.run('renderProJobDetail()');assert.ok(a.q('[data-job-action="quote-whatsapp"]'));
});

test('Facebook registration stays in browser and preserves campaign attribution',async()=>{
 const {document}=parseHTML(fs.readFileSync(path.join(root,'index.html'),'utf8'));
 const href='https://example.test/mehirli-app/?utm_source=facebook';
 const navigations=[];
 const context=vm.createContext({document,navigator:{userAgent:'Android FBAV/123',connection:{saveData:true}},location:{href,search:'?utm_source=facebook',assign:u=>navigations.push(u)},URL,URLSearchParams,window:{MehirliTraffic:{event:async()=>{},trackVisit(){}}},matchMedia:()=>({matches:true}),setTimeout:()=>0});
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 vm.runInContext(html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>')),context);
 const cta=document.querySelector('[data-cta]');
 cta.href=new URL(cta.getAttribute('href'),href).href;
 cta.dispatchEvent(new document.defaultView.Event('click',{cancelable:true}));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(navigations.length,1);
 const destination=new URL(navigations[0]);
 assert.equal(destination.protocol,'https:');assert.equal(destination.searchParams.get('view'),'signup');assert.equal(destination.searchParams.get('utm_source'),'facebook');
});
test('Chrome installation handoff opens existing-account login without credentials',async()=>{
 const a=setup();
 a.run("navigator.userAgent='Android FBAV/123';location.search='?view=signup&utm_source=facebook';location.hash='#authForm';markOnboardingStep=async()=>{}");
 let prevented=false;await a.q('#postSignupInstallBtn').onclick({preventDefault(){prevented=true}});
 assert.equal(prevented,false);
 assert.equal(a.q('#postSignupInstallBtn').tagName,'A');
 const handoff=a.q('#postSignupInstallBtn').getAttribute('href');
 assert.match(handoff,/^intent:/);assert.match(handoff,/view=install/);assert.match(handoff,/utm_source=facebook/);
 assert.doesNotMatch(handoff,/view=signup|authForm|password|access_token/);
});
test('Chrome handoff chooses login and does not attempt a second registration',async()=>{
 const a=setup();a.run("location.search='?view=install';location.hash='';");
 a.db.auth.getSession=async()=>({data:{session:null}});
 await a.run('boot()');
 assert.equal(a.q('#signupFields').classList.contains('hidden'),true);
 assert.match(a.q('#authNote').textContent,/אין צורך להירשם שוב/);
});
test('installation handoff keeps an existing authenticated session',async()=>{
 const a=setup();a.run("location.search='?view=install';location.hash='';loadMe=async()=>{};routeAfterLogin=async()=>{window.routed=true}");
 let signedOut=false;a.db.auth.signOut=async()=>{signedOut=true;return {}};
 a.db.auth.getSession=async()=>({data:{session:{user:{id:'existing'}}}});
 await a.run('boot()');
 assert.equal(signedOut,false);assert.equal(a.window.routed,true);
});

test('installation fallback stays visible when Chrome cannot launch',()=>{
 const a=setup();a.run("navigator.userAgent='Android FBAV/123';showPostSignupInstall()");
 assert.equal(a.q('#postSignupBrowserFallback').hidden,false);
 assert.match(a.q('#postSignupInstallLink').value,/view=install/);
 assert.equal(a.q('#postSignupBrowserWarning').hidden,false);
});
test('missing install prompt shows instructions inside the installation dialog',async()=>{
 const a=setup();a.run("markOnboardingStep=async()=>{};showPostSignupInstall()");
 await a.q('#postSignupInstallBtn').onclick({preventDefault(){}});
 assert.equal(a.q('#postSignupInstallHelp').hidden,false);
 assert.match(a.q('#postSignupInstallHelp').textContent,/תפריט הדפדפן/);
});

test('hero registration button switches to signup and scrolls to email fields',()=>{
 const a=setup();let focused=false;a.q('#authEmail').focus=()=>{focused=true};
 a.run("setAuthMode('login')");let prevented=false;
 a.q('.auth-hero-cta').onclick({preventDefault(){prevented=true}});
 assert.equal(prevented,true);assert.equal(a.q('#signupFields').classList.contains('hidden'),false);
 assert.equal(a.window.scrolledToAuth,true);assert.equal(focused,true);
});
test('signup entry from the landing page scrolls after auth view is ready',async()=>{
 const a=setup();a.run("location.search='?view=signup';");
 a.db.auth.getSession=async()=>({data:{session:null}});
 await a.run('boot()');assert.equal(a.window.scrolledToAuth,true);assert.equal(a.q('#signupFields').classList.contains('hidden'),false);
});

test('registration does not launch a competing scroll to the top',()=>{
 const a=setup(),scrolls=[];a.window.scrollTo=options=>scrolls.push(options);a.q('#authEmail').focus=()=>{};
 a.q('.auth-hero-cta').onclick({preventDefault(){}});
 assert.equal(scrolls.length,0);assert.equal(a.window.scrolledToAuth,true);
 a.run("show('#homeView')");assert.equal(scrolls.length,1);assert.equal(scrolls[0].behavior,'instant');
});
test('Enter in signup submits registration instead of trying to log in',async()=>{
 const a=setup();a.run("setAuthMode('signup')");
 a.q('#authName').value='בדיקת הרשמה';a.q('#authEmail').value='test@example.test';a.q('#authPassword').value='test-only-placeholder';a.q('#signupLegalConsent').checked=true;
 let loginCalls=0;a.db.auth.signInWithPassword=async()=>{loginCalls++;throw Error('wrong flow')};
 await a.q('#authForm').onsubmit({preventDefault(){}});
 assert.equal(loginCalls,0);assert.match(a.q('#authNote').textContent,/אימייל לאישור/);
});
test('login recovers after interrupted network and allows a retry',async()=>{
 const a=setup();a.run("setAuthMode('login')");a.db.auth.signInWithPassword=async()=>{throw Error('offline')};
 await a.q('#authForm').onsubmit({preventDefault(){}});
 assert.equal(a.q('.auth-login').disabled,false);assert.match(a.q('#authNote').textContent,/החיבור נקטע/);
});
test('legal information returns to the registration fields without losing input',()=>{
 const a=setup();a.run("setAuthMode('signup')");a.q('#authEmail').value='test@example.test';
 a.q('[data-open-legal]').onclick();assert.equal(a.q('#legalInfoView').classList.contains('active'),true);
 a.q('#legalInfoBackBtn').onclick();assert.equal(a.q('#authView').classList.contains('active'),true);
 assert.equal(a.q('#authEmail').value,'test@example.test');assert.equal(a.window.scrolledToAuth,true);
});
