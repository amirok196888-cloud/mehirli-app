/* Shared landing/app attribution and 30-minute visit tracking. No personal details or raw URLs. */
(function(root){
  'use strict';
  const VISITOR='mehirli_visitor_v1',SESSION='mehirli_visit_v113',TTL=30*60*1000;
  const ACQUISITION='mehirli_acquisition_v1';
  let memoryVisitor='',memorySession=null,memoryAcquisition=null;
  function read(store,key){try{return JSON.parse(store.getItem(key)||'null')}catch{return null}}
  function write(store,key,value){try{store.setItem(key,JSON.stringify(value))}catch{}}
  function storage(name){try{return root[name]}catch{return null}}
  function uuid(){return root.crypto.randomUUID()}
  function visitor(){let id='';try{id=storage('localStorage').getItem(VISITOR)||''}catch{}if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){id=memoryVisitor||uuid();try{storage('localStorage').setItem(VISITOR,id)}catch{}}memoryVisitor=id;return id}
  function resolve(search,referrer,hostname){
    const p=new URLSearchParams(search),campaign=p.get('utm_campaign')||'',medium=(p.get('utm_medium')||'').toLowerCase();
    let source=(p.get('utm_source')||p.get('source')||'').toLowerCase().replace(/^www\./,''),external=false;
    let host='';try{host=new URL(referrer).hostname.toLowerCase().replace(/^www\./,'')}catch{}
    const paid=/^(cpc|ppc|paid|paid_social|paidsocial|paid_search|display|cpm|cpv)$/.test(medium),organic=/^(social|organic|organic_social|referral)$/.test(medium);
    // Click IDs are advertising evidence; fbclid alone also occurs in organic shares.
    if(p.has('gclid')||p.has('gbraid')||p.has('wbraid'))return {source:'google_paid',campaign,explicit:true};
    if(!source&&p.has('ttclid'))return {source:'tiktok_paid',campaign,explicit:true};
    if(!source&&p.has('fbclid'))source='facebook';
    if(!source&&host&&host!==hostname.replace(/^www\./,'')){source=host;external=true}
    const explicit=!!source;
    if(source==='facebook-groups')source='facebook_groups';
    else if(/^(fb|facebook|(?:m\.|l\.|lm\.)?facebook\.com)$/.test(source))source=paid?'facebook_paid':organic?'facebook_organic':'facebook_unknown';
    else if(/^(ig|instagram|(?:l\.)?instagram\.com)$/.test(source))source=paid?'instagram_paid':organic?'instagram_organic':'instagram_unknown';
    else if(source==='google'||/^google\.[a-z.]+$/.test(source))source=paid?'google_paid':(external||medium==='organic')?'google_organic':'google_unknown';
    else if(source==='tiktok'||/(^|\.)tiktok\.com$/.test(source))source=paid?'tiktok_paid':'tiktok_organic';
    else if(source.includes('whatsapp'))source='whatsapp';
    else if(source==='landing')source='';
    return {source:source||'direct',campaign,explicit};
  }
  function visit(){
    const now=Date.now(),a=resolve(root.location.search,root.document.referrer,root.location.hostname);
    let s=read(storage('sessionStorage'),SESSION)||memorySession;
    const changed=s&&a.explicit&&(a.source!==s.source||a.campaign!==s.campaign);
    if(!s||now-s.lastSeen>=TTL||changed)s={id:uuid(),source:a.source,campaign:a.campaign,startedAt:now};
    s.lastSeen=now;memorySession=s;write(storage('sessionStorage'),SESSION,s);
    // Keep the first known acquisition separate from the 30-minute visit.
    let first=read(storage('localStorage'),ACQUISITION)||memoryAcquisition;
    if(!first||first.source==='direct'&&s.source!=='direct')first={source:s.source,campaign:s.campaign};
    memoryAcquisition=first;write(storage('localStorage'),ACQUISITION,first);return s;
  }
  function attribution(){visit();return {source:memoryAcquisition.source,campaign:memoryAcquisition.campaign}}
  async function send(rpc,payload,client){
    for(let attempt=0;attempt<2;attempt++){
      try{
        if(client){const result=await client.rpc(rpc,payload);if(result.error||result.data===false)throw Error('analytics_rejected');}
        else{const response=await root.fetch('https://jgnbcrlvsudfqfofmvlx.supabase.co/rest/v1/rpc/'+rpc,{method:'POST',headers:{apikey:'sb_publishable_WnOhGZSlik7zqpO-cRYGvA_lOUz68Wp','Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true,cache:'no-store'});if(!response.ok||await response.json()===false)throw Error('analytics_rejected');}
        return true;
      }catch{if(attempt===0)await new Promise(resolve=>root.setTimeout(resolve,500))}
    }
    return false;
  }
  function excluded(){try{return storage('localStorage').getItem('mehirli_admin_device_v1')==='1'}catch{return false}}
  async function trackVisit(client){
    if(excluded()||new URLSearchParams(root.location.search).has('quote'))return false;
    const s=visit();return send('track_visit_v113',{p_visit_id:s.id,p_visitor_id:visitor(),p_source:s.source,p_campaign:s.campaign},client);
  }
  async function event(name,client){if(excluded())return false;const a=['landing_page_view','landing_cta_click','app_open','page_view'].includes(name)?visit():attribution();return send('track_app_event_v40',{p_visitor_id:visitor(),p_event_name:name,p_source:a.source,p_campaign:a.campaign},client)}
  root.MehirliTraffic={visitor,attribution,trackVisit,event,resolve};
})(window);
