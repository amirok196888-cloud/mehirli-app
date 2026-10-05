'use strict';
const fs=require('node:fs'),path=require('node:path');
const C=require('../blog/blog-core.js');
const root=path.resolve(__dirname,'..');
function schema(a){return JSON.stringify({'@context':'https://schema.org','@type':'BlogPosting',headline:a.title,description:a.excerpt,datePublished:a.published_at,dateModified:a.updated_at,author:{'@type':'Organization',name:a.author},mainEntityOfPage:C.articleURL(a.slug)}).replace(/</g,'\\u003c');}
function page(a){const e=C.escape;return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(a.title)} | מחירלי</title><meta name="description" content="${e(a.excerpt)}"><link rel="canonical" href="${C.articleURL(a.slug)}"><meta property="og:type" content="article"><meta property="og:title" content="${e(a.title)}"><meta property="og:description" content="${e(a.excerpt)}"><meta property="og:url" content="${C.articleURL(a.slug)}"><link rel="stylesheet" href="../blog.css"><script type="application/ld+json">${schema(a)}</script></head><body><header><nav class="nav"><a class="brand" href="../../">מחיר־לי</a><div class="links"><a href="../">כל המאמרים</a><a href="../../app.html">כניסה למערכת</a></div></nav></header><main><article><h1>${e(a.title)}</h1><p class="meta">${e(a.author)} · ${new Date(a.published_at).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'})}</p><p class="lead">${e(a.excerpt)}</p>${C.render(a.content)}</article></main><footer>מחירלי מבית רוקח דיגיטל</footer><script src="../share.js?v=2" defer></script></body></html>`;}
async function fetchArticles(){let result=[];for(let offset=0;;offset+=1000){const response=await fetch(C.API+'/rest/v1/blog_publications?select=*&order=published_at.desc&offset='+offset+'&limit=1000',{headers:{apikey:C.KEY}});if(!response.ok)throw new Error('Public article fetch failed: '+response.status);const rows=await response.json();result.push(...rows);if(rows.length<1000)return result;}}
async function build(){
 const rows=await fetchArticles();
 for(const a of rows)if(!C.validSlug(a.slug))throw new Error('Invalid article slug');
 const staticPath=path.join(root,'blog/static-publications.json');
 const staticRows=fs.existsSync(staticPath)?JSON.parse(fs.readFileSync(staticPath,'utf8')):[];
 for(const a of staticRows)if(!C.validSlug(a.slug))throw new Error('Invalid static article slug');
 const dbSlugs=new Set(rows.map(a=>a.slug));
 for(const a of staticRows)if(dbSlugs.has(a.slug))throw new Error('Static article slug is already published in database: '+a.slug);
 const all=[...rows,...staticRows].sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at));
 const allSlugs=new Set(all.map(a=>a.slug));
 const generatedPath=path.join(root,'blog/generated.json');
 const previous=fs.existsSync(generatedPath)?JSON.parse(fs.readFileSync(generatedPath,'utf8')):[];
 for(const slug of previous)if(C.validSlug(slug)&&!allSlugs.has(slug))fs.rmSync(path.join(root,'blog',slug),{recursive:true,force:true});
 for(const a of rows){const dir=path.join(root,'blog',a.slug);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),page(a));}
 for(const a of staticRows)if(!fs.existsSync(path.join(root,'blog',a.slug,'index.html')))throw new Error('Static article page is missing: '+a.slug);
 fs.writeFileSync(generatedPath,JSON.stringify(all.map(a=>a.slug),null,2)+'\n');
 const indexPath=path.join(root,'blog/index.html');let index=fs.readFileSync(indexPath,'utf8');
 const cards=all.map(a=>`<section class="card"><h2><a href="${C.articleURL(a.slug)}">${C.escape(a.title)}</a></h2><p>${C.escape(a.excerpt)}</p><a href="${C.articleURL(a.slug)}">לקריאת המאמר ←</a></section>`).join('')||'<p>המאמרים הראשונים יפורסמו כאן בקרוב.</p>';
 index=index.replace(/(<div id="articles"[^>]*>)[\s\S]*?(<\/div><\/main>)/,'$1'+cards+'$2');fs.writeFileSync(indexPath,index);
 const urls=['','about.html','contact.html','blog/'].map(p=>`<url><loc>${C.BASE+p}</loc></url>`);
 for(const a of all)urls.push(`<url><loc>${C.articleURL(a.slug)}</loc><lastmod>${new Date(a.updated_at||a.published_at).toISOString()}</lastmod></url>`);
 fs.writeFileSync(path.join(root,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.join('')+'</urlset>\n');
 console.log('Built '+rows.length+' database articles and '+staticRows.length+' static articles.');
}
if(require.main===module)build().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={page,schema};
