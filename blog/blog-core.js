(function(root){
'use strict';
const BASE='https://amirok196888-cloud.github.io/mehirli-app/';
const API='https://jgnbcrlvsudfqfofmvlx.supabase.co';
const KEY='sb_publishable_WnOhGZSlik7zqpO-cRYGvA_lOUz68Wp';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validSlug=s=>/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)&&s.length<=100;
function inline(s){return escape(s).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,label,url)=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');}
function render(s){
 const lines=String(s).replace(/\r/g,'').split('\n');let html='',p=[],list=false;
 const flush=()=>{if(p.length){html+='<p>'+inline(p.join(' '))+'</p>';p=[];}if(list){html+='</ul>';list=false;}};
 for(let i=0;i<lines.length;i++){
  const l=lines[i];
  if(l.includes('|')&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){
   flush();const cells=v=>v.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());
   html+='<div class="table-wrap"><table><thead><tr>'+cells(l).map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead><tbody>';i++;
   while(i+1<lines.length&&lines[i+1].includes('|')){i++;html+='<tr>'+cells(lines[i]).map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>';}
   html+='</tbody></table></div>';continue;
  }
  const heading=l.match(/^(#{1,3})\s+(.+)$/);
  if(heading){flush();const level=Math.max(2,heading[1].length);html+=`<h${level}>${inline(heading[2])}</h${level}>`;}
  else if(/^[-*]\s+/.test(l)){if(p.length){html+='<p>'+inline(p.join(' '))+'</p>';p=[];}if(!list){html+='<ul>';list=true;}html+='<li>'+inline(l.slice(2))+'</li>';}
  else if(!l.trim()){flush();}else{if(list){html+='</ul>';list=false;}p.push(l);}
 }flush();return html;
}
const articleURL=s=>BASE+'blog/article.html?slug='+encodeURIComponent(s);
const api={BASE,API,KEY,escape,render,validSlug,articleURL};
if(typeof module!=='undefined')module.exports=api;else root.BlogCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
