const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const traffic=fs.readFileSync(__dirname+'/../traffic.js','utf8');
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};
function browser({localStorage=storage(),search='?gclid=ad&utm_campaign=launch',referrer='',ua=''}={}){
 let now=1800000000000,id=0;const calls=[],links=[];
 const w={location:{search,hostname:'example.test',href:'https://example.test/'+search,assign:v=>w.target=v},document:{referrer},localStorage,sessionStorage:storage(),crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++id).padStart(12,'0')}`},setTimeout:f=>{f();return 1},fetch:async(url,opt)=>{calls.push({rpc:url.split('/').pop(),...JSON.parse(opt.body)});return {ok:true,json:async()=>true}}};
 const context={window:w,location:w.location,document:w.document,URL,URLSearchParams,Date:{now:()=>now},Promise,navigator:{userAgent:ua},setTimeout:w.setTimeout};
 vm.runInNewContext(traffic,context);
 return {w,calls,context,advance:ms=>now+=ms,links};
}
test('acquisition survives expired visit, new tab and payment-provider return',async()=>{
 const b=browser();await b.w.MehirliTraffic.trackVisit();await b.w.MehirliTraffic.event('trial_signup');
 b.advance(31*60*1000);b.w.location.search='';b.w.document.referrer='';
 await b.w.MehirliTraffic.trackVisit();assert.equal(b.calls.at(-1).p_source,'direct');
 await b.w.MehirliTraffic.event('first_job_created');assert.equal(b.calls.at(-1).p_source,'google_paid');assert.equal(b.calls.at(-1).p_campaign,'launch');
 const c=browser({localStorage:b.w.localStorage,search:'',referrer:'https://secure.cardcom.solutions/checkout'});
 await c.w.MehirliTraffic.event('payment_completed');assert.equal(c.calls.at(-1).p_source,'google_paid');
});
function landing(b){
 const html=fs.readFileSync(__dirname+'/../index.html','utf8');
 const links=[...html.matchAll(/<a\b([^>]*class="[^"]*app-link[^"]*"[^>]*)>/g)].map(m=>{
 const attrs=m[1],href=/href="([^"]+)"/.exec(attrs)[1].replaceAll('&amp;','&'),cta=/data-cta="([^"]+)"/.exec(attrs)?.[1];
 return {href,dataset:cta?{cta}:{},getAttribute:k=>k==='href'?href:null,hasAttribute:k=>k==='data-cta'&&!!cta,};
 });
 links.forEach(l=>l.addEventListener=(k,fn)=>l[k]=fn);
 b.w.document.querySelectorAll=s=>s==='.app-link'?links:links.filter(l=>l.dataset.cta);
 b.w.document.querySelector=()=>null;
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 vm.runInNewContext(scripts.at(-1)[1],b.context);return links;
}
test('both current landing CTAs fire and preserve click IDs/campaigns',async()=>{
 const b=browser();const links=landing(b).filter(l=>l.dataset.cta);assert.deepEqual(links.map(l=>l.dataset.cta),['hero','bottom']);
 for(const link of links){await link.click({preventDefault(){}});assert.match(b.w.target,/gclid=ad/);assert.match(b.w.target,/utm_campaign=launch/);}
 assert.equal(b.calls.filter(c=>c.p_event_name==='landing_cta_click').length,2);
});
test('referrer-only Facebook acquisition survives Chrome handoff',async()=>{
 const b=browser({search:'',referrer:'https://l.facebook.com/',ua:'Android FBAV'});
 const link=landing(b).find(l=>l.dataset.cta);await link.click({preventDefault(){}});
 assert.match(b.w.target,/utm_source=facebook_unknown/);
 const target=new URL(b.w.target.replace('intent:','https:'));const c=browser({search:target.search});
 await c.w.MehirliTraffic.event('trial_signup');assert.equal(c.calls.at(-1).p_source,'facebook_unknown');
});
test('admin renders Google and Facebook as separate cards including first jobs and payers',()=>{
 const app=fs.readFileSync(__dirname+'/../app.js','utf8');
 const render=app.slice(app.indexOf('function renderAdminMarketing('),app.indexOf('async function loadAdminMarketing('));
 const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id)};
 const context={$, $$:()=>[],adminAnalyticsRange:'all',esc:s=>String(s).replaceAll('<','&lt;'),Date};
 vm.runInNewContext(render,context);
 context.renderAdminMarketing({generated_at:'2026-09-26T10:00:00Z',source_breakdown:[{source:'גוגל — ממומן',visitors:5,first_jobs:2,paying_customers:1},{source:'פייסבוק — ממומן',visitors:7,first_jobs:3,paying_customers:2}],visit_sources:[{source:'גוגל — ממומן',visits:8,visitors:5},{source:'פייסבוק — ממומן',visits:10,visitors:7}]});
 const cards=$('#adminTrafficSources').innerHTML;
 assert.match(cards,/<b>גוגל — ממומן<\/b><span>5 מבקרים[^<]*2 יצרו עבודה ראשונה · 1 שילמו/);
 assert.match(cards,/<b>פייסבוק — ממומן<\/b><span>7 מבקרים[^<]*3 יצרו עבודה ראשונה · 2 שילמו/);
 assert.equal((cards.match(/class="traffic-source-card"/g)||[]).length,4);
});
test('new campaign changes visits without replacing first known acquisition',async()=>{
 const b=browser();await b.w.MehirliTraffic.trackVisit();
 b.w.location.search='?utm_source=facebook&utm_medium=paid_social&utm_campaign=second';
 await b.w.MehirliTraffic.trackVisit();assert.equal(b.calls.at(-1).p_source,'facebook_paid');
 await b.w.MehirliTraffic.event('trial_signup');assert.equal(b.calls.at(-1).p_source,'google_paid');assert.equal(b.calls.at(-1).p_campaign,'launch');
});
