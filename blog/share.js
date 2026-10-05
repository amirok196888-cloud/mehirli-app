(()=>{
const trackArticleView=()=>{
  try{
    if(localStorage.getItem('mehirli_admin_device_v1')==='1')return;
    const params=new URLSearchParams(location.search);
    const slug=(params.get('slug')||location.pathname.split('/').filter(Boolean).pop()||'').trim();
    if(!/^[a-z0-9-]{1,100}$/.test(slug)||slug==='article.html')return;
    const key='mehirli_visitor_v1';
    let visitor=localStorage.getItem(key)||'';
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitor)){
      visitor=crypto.randomUUID();
      localStorage.setItem(key,visitor);
    }
    fetch('https://jgnbcrlvsudfqfofmvlx.supabase.co/rest/v1/rpc/track_blog_article_view_v1',{
      method:'POST',
      headers:{apikey:'sb_publishable_WnOhGZSlik7zqpO-cRYGvA_lOUz68Wp','Content-Type':'application/json'},
      body:JSON.stringify({p_visitor_id:visitor,p_slug:slug}),
      keepalive:true,
      cache:'no-store'
    }).catch(()=>{});
  }catch{}
};
trackArticleView();const mount=()=>{const article=document.querySelector('#article,main article,main');if(!article||article.querySelector('.article-share')||!article.querySelector('h1'))return;const meta=s=>document.querySelector(s)?.content||'';const title=meta('meta[property="og:title"]')||article.querySelector('h1').textContent.trim()||document.title;const summary=meta('meta[property="og:description"]')||meta('meta[name="description"]');const url=document.querySelector('link[rel="canonical"]')?.href||location.href.split('#')[0];if(!summary)return;const box=document.createElement('section');box.className='article-share';box.setAttribute('aria-label','שיתוף המאמר');box.innerHTML='<strong>תקציר מוכן לשיתוף</strong><p class="article-share-summary"></p><div class="article-share-actions"><button type="button" class="article-share-copy">העתקת התקציר והקישור</button><a class="article-share-facebook" target="_blank" rel="noopener noreferrer">שיתוף בפייסבוק</a></div><small class="article-share-status" aria-live="polite"></small>';box.querySelector('.article-share-summary').textContent=summary;box.querySelector('.article-share-facebook').href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url);const status=box.querySelector('.article-share-status');box.querySelector('.article-share-copy').addEventListener('click',async()=>{const text=[title,summary,'',url].join(String.fromCharCode(10));try{await navigator.clipboard.writeText(text)}catch{const field=document.createElement('textarea');field.value=text;field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();document.execCommand('copy');field.remove()}status.textContent='התקציר והקישור הועתקו. עכשיו אפשר ללחוץ על שיתוף בפייסבוק.'});let style=document.getElementById('article-share-style');if(!style){style=document.createElement('style');style.id='article-share-style';style.textContent=".article-share{direction:rtl;margin:34px 0 20px;padding:20px;border:1px solid #cbdaf4;border-radius:18px;background:#eef4ff;text-align:center}.article-share strong{display:block;font-size:20px;margin-bottom:8px}.article-share-summary{color:#435762;line-height:1.7;margin:0 auto 14px;max-width:700px}.article-share-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.article-share-copy,.article-share-facebook{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:10px 16px;border:0;border-radius:11px;font:700 16px Arial;text-decoration:none;cursor:pointer}.article-share-copy{background:#fff;color:#17334a;border:1px solid #bacde7}.article-share-facebook{background:#1877f2;color:#fff}.article-share-status{display:block;margin-top:10px;color:#345}.article-share a:focus-visible,.article-share button:focus-visible{outline:3px solid #ffbd18;outline-offset:3px}";document.head.append(style)}const target=article.querySelector('.cta,.author')||article.lastElementChild;if(target)target.before(box);else article.append(box)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();})();