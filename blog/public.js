(async()=>{
 const C=BlogCore;const target=document.getElementById('article')||document.getElementById('articles');
 const slug=new URLSearchParams(location.search).get('slug');const single=target.id==='article';
 if(single&&!C.validSlug(slug||'')){target.textContent='כתובת המאמר אינה תקינה.';return;}
 try{
  const query=single?'slug=eq.'+encodeURIComponent(slug)+'&select=*':'select=slug,title,excerpt,author,published_at&order=published_at.desc';
  const response=await fetch(C.API+'/rest/v1/blog_publications?'+query,{headers:{apikey:C.KEY}});
  if(!response.ok)throw new Error('load');const rows=await response.json();
  if(!single){
  const staticSlugs=new Set([...target.querySelectorAll('.card a[href]')].map(link=>{try{return new URL(link.href).pathname.match(/\\/blog\\/([^/]+)\\/?$/)?.[1]||''}catch{return ''}}).filter(Boolean));
  const dynamic=rows.filter(a=>!staticSlugs.has(a.slug)).map(a=>`<section class="card"><h2><a href="${C.BASE+'blog/article.html?slug='+encodeURIComponent(a.slug)}">${C.escape(a.title)}</a></h2><p>${C.escape(a.excerpt)}</p><p class="meta">${C.escape(a.author)} · ${new Date(a.published_at).toLocaleDateString('he-IL')}</p><a href="${C.BASE+'blog/article.html?slug='+encodeURIComponent(a.slug)}">לקריאת המאמר ←</a></section>`).join('');
  if(dynamic)target.insertAdjacentHTML('afterbegin',dynamic);
  return;
 }
  const a=rows[0];if(!a){target.textContent='המאמר אינו מפורסם כרגע.';const robots=document.createElement('meta');robots.name='robots';robots.content='noindex';document.head.append(robots);return;}
  document.title=a.title+' | מחירלי';document.querySelector('meta[name="description"]').content=a.excerpt;
  const canonical=document.createElement('link');canonical.rel='canonical';canonical.href=C.articleURL(a.slug);document.head.append(canonical);
  target.innerHTML=`<h1>${C.escape(a.title)}</h1><p class="meta">${C.escape(a.author)} · ${new Date(a.published_at).toLocaleDateString('he-IL')}</p><p class="lead">${C.escape(a.excerpt)}</p>${C.render(a.content)}`;
  const schema=document.createElement('script');schema.type='application/ld+json';schema.textContent=JSON.stringify({'@context':'https://schema.org','@type':'BlogPosting',headline:a.title,description:a.excerpt,datePublished:a.published_at,dateModified:a.updated_at,author:{'@type':'Organization',name:a.author},mainEntityOfPage:C.BASE+'blog/article.html?slug='+encodeURIComponent(a.slug)});document.head.append(schema);
 }catch(e){target.textContent='לא ניתן לטעון את המאמרים כרגע. נסה לרענן את העמוד.';}
})();
