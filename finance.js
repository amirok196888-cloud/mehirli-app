(function(){
 'use strict';
 const F=window.FinanceCore, B='finance-documents',VERSION='2026-09-v1';
 let rows=[],docs=[],settings=null,owner=null,selectedFile=null,previewUrl=null,busy=false,ocrWorker=null,ocrPromise=null;
 const el=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS'}).format(Number(n)||0),today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),month=()=>today().slice(0,7);
 const date=s=>s?new Date(String(s).slice(0,10)+'T12:00:00').toLocaleDateString('he-IL'):'לא צוין';
 const expiry=d=>new Date(new Date(d.expires_at).getTime()-1).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'});
 function error(message,id='financeError'){const e=el(id);e.textContent=message||'';e.classList.toggle('hidden',!message);}
 function userStill(id){return state.user?.id===id;}
 async function all(table){let out=[];for(let from=0;;from+=500){const r=await db.from(table).select('*').eq('professional_id',owner).order('id').range(from,from+499);if(r.error)throw r.error;out.push(...r.data);if(r.data.length<500)break;}return out;}
 async function reload(){const id=state.user?.id;if(!id)throw Error('יש להתחבר מחדש');owner=id;const [a,b,c]=await Promise.all([all('finance_entries'),all('finance_documents'),db.from('finance_settings').select('*').eq('professional_id',id).maybeSingle()]);if(!userStill(id))throw Error('החשבון השתנה; יש לפתוח מחדש את מסך הכספים');if(c.error)throw c.error;rows=a;docs=b;settings=c.data||{business_type:'unknown',quota_bytes:104857600};}
 async function open(){if(!state.user)return;show('#financeView');error('');el('financeMonth').value ||=month();try{await reload();render();}catch(e){error('לא ניתן לטעון את הכספים. נסו רענון. '+friendly(e));}}
 function friendly(e){const m=String(e?.message||e||'');if(m.includes('quota'))return 'מכסת האחסון התמלאה. ניתן לשמור רישום ללא קובץ.';if(e?.code==='PGRST116')return 'הרישום השתנה מאז שנפתח. חזרו למסך הכספים ורעננו לפני עריכה נוספת.';if(e?.code==='23505')return 'מסמך או רישום עם אותם פרטים כבר קיים. חפשו אותו לפני הוספה נוספת.';if(m.includes('policy')||m.includes('permission'))return 'לא ניתן לבצע את הפעולה. בדקו שהמנוי פעיל ושמדיניות השמירה אושרה.';return m.slice(0,250);}
 function visible(){const m=el('financeMonth').value,f=el('financeFilter').value,q=el('financeSearch').value.trim().toLowerCase();return rows.filter(r=>{
  if(r.voided&&f!=='history')return false;if(f==='review'){if(!r.review_required)return false;}
  else if(f!=='history'&&![(r.document_date||'').slice(0,7),(r.paid_on||'').slice(0,7)].includes(m))return false;
  if(['income','expense'].includes(f)&&r.kind!==f)return false;if(f==='unpaid'&&r.paid_on)return false;
  return !q||[r.counterparty,r.document_number,r.notes,r.amount].some(x=>String(x||'').toLowerCase().includes(q));
 }).sort((a,b)=>String(b.paid_on||b.document_date||b.created_at).localeCompare(String(a.paid_on||a.document_date||a.created_at)));}
 function render(){const s=F.summary(rows,el('financeMonth').value,settings.business_type);
  el('financeSummary').innerHTML=[['כסף שהתקבל',s.income],['כסף ששולם',s.expense],['הכנסות פחות הוצאות',s.balance]].map(([label,n])=>`<div class="card"><small>${label}</small><strong>${fmt(n)}</strong></div>`).join('')+`<div class="card"><small>אומדן לשמירה עבור מע״מ</small><strong>${s.reserve===null?'—':fmt(s.reserve)}</strong><small>${settings.business_type==='exempt'?'לא מחושב לעוסק פטור':settings.business_type==='unknown'?'יש לבחור סוג עסק':s.unknown?`אומדן חלקי: ${s.unknown} רישומים ללא אישור מע״מ`:'לפי סכומי המע״מ שאושרו בלבד'}</small></div>`;
  if(settings.business_type==='vat')el('financeSummary').innerHTML+=`<div class="card finance-wide"><small>מע״מ הכנסות שאושר: ${fmt(s.outputVat)} · מע״מ הוצאות שאושר לקיזוז: ${fmt(s.inputVat)}${s.vatBalance<0?' · יתרה שלילית באומדן; אינה אישור להחזר':''}</small></div>`;
  el('financeReview').classList.toggle('hidden',!s.review);el('financeReview').textContent=`${s.review} תשלומים קיימים דורשים אישור תאריך. הם אינם כלולים בסיכומים עד לאישור. בחרו בסינון ״דורש אישור תאריך״.`;
  const due=docs.filter(d=>d.status==='stored'&&new Date(d.expires_at)-Date.now()<60*86400000);
  el('financeExpiry').classList.toggle('hidden',!due.length);el('financeExpiry').textContent=`${due.length} מסמכים יימחקו בתוך 60 יום. יש לייצא ולשמור את הקבצים לפני תאריך המחיקה המוצג בכל מסמך.`;
  el('financeBusinessType').value=settings.business_type;
  const bytes=docs.filter(d=>['stored','pending'].includes(d.status)).reduce((n,d)=>n+Number(d.byte_size),0);
  el('financeUsage').textContent=`אחסון מסמכים: ${(bytes/1048576).toFixed(1)} מתוך ${(settings.quota_bytes/1048576).toFixed(0)} מ״ב. עד 5 מ״ב לקובץ. צילומים מוקטנים לפני העלאה.`;
  el('financeRetentionAccept').checked=settings.retention_version===VERSION&&!!settings.retention_accepted_at;
  const list=visible();el('financeList').innerHTML=list.length?list.map(r=>`<article class="card finance-record"><div class="finance-record-top"><h3>${esc(r.counterparty|| (r.kind==='income'?'הכנסה':'הוצאה'))}</h3><strong>${r.kind==='income'?'הכנסה':'הוצאה'} · ${fmt(r.amount)}</strong></div><p>${r.paid_on?'תשלום: '+date(r.paid_on):r.review_required?'תאריך התשלום ממתין לאישור':'טרם שולם'}${r.document_number?' · מסמך '+esc(r.document_number):''}</p><p>${r.voided?'רישום מבוטל · ':''}${r.source!=='manual'?'מתיק עבודה · ':''}${r.vat_confirmed?'פרטי מע״מ אושרו':'מע״מ טרם אושר'}</p><button class="secondary" data-finance-edit="${r.id}" type="button">פרטים ומסמכים</button></article>`).join(''):'<div class="card"><p>אין רישומים בתצוגה הזו. אפשר לבחור חודש אחר, לשנות סינון או להוסיף רישום.</p></div>';
  el('financeList').querySelectorAll('[data-finance-edit]').forEach(b=>b.onclick=()=>edit(rows.find(r=>r.id===b.dataset.financeEdit)));
  el('financeExportParts').replaceChildren();
 }
 function clearFile(){selectedFile=null;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;el('financePreview').removeAttribute('src');el('financePreview').classList.add('hidden');el('financeScan').classList.add('hidden');el('financeRemoveFile').classList.add('hidden');el('financeFileStatus').textContent='';el('financeFile').value='';el('financeCamera').value='';}
 async function edit(r,kind='expense'){if(busy||!requireServiceAccess())return;clearFile();el('financeForm').reset();error('','financeFormError');
  el('financeEntryId').value=r?.id||'';el('financeEntryTitle').textContent=r?'פרטי רישום ומסמכים':kind==='expense'?'הוצאה חדשה':'הכנסה אחרת';
  const map={financeKind:r?.kind||kind,financeCounterparty:r?.counterparty||'',financeAmount:r?.amount??'',financeNumber:r?.document_number||'',financeDocDate:r?.document_date||'',financePaidDate:r?.paid_on||today(),financeCategory:r?.category||'other',financeVat:r?.vat_amount||0,financeDeductible:r?.deductible_vat||0,financeVatMonth:(r?.vat_period||month()).slice(0,7),financeNotes:r?.notes||''};for(const [id,v] of Object.entries(map))el(id).value=v;
  el('financePaid').checked=!!r?.paid_on;el('financeVatConfirmed').checked=!!r?.vat_confirmed;
  const source=!!r&&r.source!=='manual';el('financeKind').disabled=source;el('financeAmount').readOnly=source;el('financePaid').disabled=source;el('financePaid').checked=source||!!r?.paid_on;
  el('financeSourceNote').classList.toggle('hidden',!source);el('financeSourceNote').textContent=r?.review_required?'תשלום שהועבר מתיק עבודה ישן. אשרו את תאריך הקבלה בפועל. הסכום מתעדכן דרך תיק העבודה בלבד.':'תשלום שהגיע אוטומטית מתיק עבודה. שינוי סכום נעשה בתיק העבודה; כאן אפשר לתקן תאריך ולהוסיף מסמך ופרטי מע״מ.';
  el('financeVoid').classList.toggle('hidden',!r||source);
  el('financeJob').innerHTML='<option value="">הוצאה כללית</option>';
  show('#financeEntryView');updateFields();renderDocs(r?.id);
  const id=state.user.id;await loadProJobs();if(!userStill(id))return;
  el('financeJob').innerHTML+=state.proJobs.map(j=>`<option value="${j.id}">${esc(j.customer_name)} — ${esc(j.description).slice(0,70)}</option>`).join('');el('financeJob').value=r?.job_id||'';
 }
 function updateFields(){const income=el('financeKind').value==='income';el('financeDeductibleLabel').classList.toggle('hidden',income);el('financeJobLabel').classList.toggle('hidden',income);el('financePaidDateLabel').classList.toggle('hidden',!el('financePaid').checked);el('financePaidDate').required=el('financePaid').checked;el('financeUploadPolicy').textContent=settings?.retention_version===VERSION?'המסמך יימחק בסוף החודש שלאחר השלמת שנה מהעלאתו. הנתונים המספריים יישמרו.':'לפני צירוף מסמך יש לאשר את מדיניות שמירת המסמכים במסך הכספים.';}
 function renderDocs(entryId){const list=docs.filter(d=>d.entry_id===entryId);el('financeExistingDocs').innerHTML=list.map(d=>`<div class="finance-doc"><b>${esc(d.original_name)}</b><p>${d.status==='stored'?`מחיקה אוטומטית בתום ${expiry(d)}`:d.status==='expired'?'הקובץ נמחק לפי מדיניות השמירה; הנתונים נשמרו.':d.status==='pending'?'העלאה לא הושלמה; יש לרענן או לנסות שוב מאוחר יותר.':'ההעלאה לא הושלמה והקובץ פונה.'}</p>${d.status==='stored'?`<button class="secondary" type="button" data-finance-doc="${d.id}">הצג / הורד מסמך</button>`:d.status==='pending'?`<button class="secondary" type="button" data-finance-complete="${d.id}">בדיקה והשלמת שמירה</button>`:''}</div>`).join('');el('financeExistingDocs').querySelectorAll('[data-finance-complete]').forEach(b=>b.onclick=async()=>{b.disabled=true;const r=await db.from('finance_documents').update({status:'stored'}).eq('id',b.dataset.financeComplete).select('*').single();if(r.error){toast('הקובץ עדיין לא הועלה במלואו. הזמנת ההעלאה תתפנה בתוך יום ואפשר יהיה לנסות שוב.');b.disabled=false;return;}docs=docs.map(d=>d.id===r.data.id?r.data:d);clearFile();renderDocs(entryId);});el('financeExistingDocs').querySelectorAll('[data-finance-doc]').forEach(b=>b.onclick=()=>downloadDoc(docs.find(d=>d.id===b.dataset.financeDoc),b));}
 function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.rel='noopener';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);}
 async function downloadDoc(d,b){b.disabled=true;try{const r=await db.storage.from(B).download(d.storage_path);if(r.error)throw r.error;download(r.data,d.original_name);}catch(e){toast('המסמך לא הורד: '+friendly(e));}finally{b.disabled=false;}}
 async function prepareFile(file){if(busy||!file)return;if(settings?.retention_version!==VERSION||!settings?.retention_accepted_at){toast('יש לאשר תחילה את מדיניות שמירת המסמכים במסך הכספים');return;}
  if(file.size>20*1048576){toast('התמונה גדולה מדי. בחרו קובץ עד 20 מ״ב');return;}busy=true;el('financeSave').disabled=true;clearFile();
  try{
   const sig=new Uint8Array(await file.slice(0,12).arrayBuffer());const pdf=String.fromCharCode(...sig.slice(0,5))==='%PDF-';
   const jpeg=sig[0]===255&&sig[1]===216,png=sig[0]===137&&sig[1]===80&&sig[2]===78&&sig[3]===71,webp=String.fromCharCode(...sig.slice(0,4))==='RIFF'&&String.fromCharCode(...sig.slice(8,12))==='WEBP';
   if(pdf){if(file.size>5*1048576)throw Error('קובץ PDF יכול להיות עד 5 מ״ב');selectedFile=new File([file],file.name,{type:'application/pdf'});}
   else {if(!jpeg&&!png&&!webp)throw Error('יש לבחור תמונת JPG, PNG, WEBP או קובץ PDF. בתמונת HEIC יש לייצא תחילה ל־JPG.');
    const bitmap=await createImageBitmap(file);try{
     const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
     const blob=await new Promise(res=>canvas.toBlob(res,'image/jpeg',.88));canvas.width=canvas.height=1;if(!blob)throw Error('לא ניתן לעבד את התמונה');if(blob.size>5*1048576)throw Error('הצילום עדיין גדול מדי. צלמו את המסמך מקרוב שוב.');selectedFile=new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
    }finally{bitmap.close();}
   }
   if(selectedFile.type!=='application/pdf'){previewUrl=URL.createObjectURL(selectedFile);el('financePreview').src=previewUrl;el('financePreview').classList.remove('hidden');el('financeScan').classList.remove('hidden');}
   el('financeRemoveFile').classList.remove('hidden');el('financeFileStatus').textContent=`${selectedFile.name} · ${(selectedFile.size/1024).toFixed(0)} ק״ב. בדקו שהמסמך קריא לפני השמירה.`;
  }catch(e){error(friendly(e),'financeFormError');clearFile();}finally{busy=false;el('financeSave').disabled=false;}
 }
 function loadOcr(){if(window.Tesseract)return Promise.resolve();if(ocrPromise)return ocrPromise;ocrPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>{ocrPromise=null;script.remove();reject(Error('לא ניתן לטעון זיהוי טקסט. אפשר להזין את הפרטים ידנית.'));};document.head.append(script);});return ocrPromise;}
 async function scan(){if(busy||!selectedFile||selectedFile.type==='application/pdf')return;busy=true;el('financeScan').disabled=true;el('financeSave').disabled=true;el('financeBack').disabled=true;el('financeRemoveFile').disabled=true;let timeout,cancelled=false;
  try{await loadOcr();el('financeFileStatus').textContent='טוען זיהוי עברית ואנגלית. בפעם הראשונה הפעולה עשויה להימשך כדקה…';
   const result=await Promise.race([(async()=>{const worker=await Tesseract.createWorker(['heb','eng'],1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',cacheMethod:'none',logger:m=>{if(m.status==='recognizing text')el('financeFileStatus').textContent=`מזהה פרטים: ${Math.round((m.progress||0)*100)}%`;}});if(cancelled){await worker.terminate();throw Error('הזיהוי בוטל');}ocrWorker=worker;return worker.recognize(selectedFile);})(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('הזיהוי ארך יותר מדי. אפשר להקליד את הפרטים ולשמור.')),90000);})]);
   const guess=F.parseOcr(result.data.text),fields={amount:'financeAmount',vat_amount:'financeVat',document_date:'financeDocDate',document_number:'financeNumber'};let count=0;
   for(const [k,id] of Object.entries(fields))if(guess[k]!==undefined&&!el(id).readOnly){el(id).value=guess[k];count++;}
   el('financeVerified').checked=false;el('financeVatConfirmed').checked=false;el('financeFileStatus').textContent=count?'הפרטים שזוהו מולאו כהצעה בלבד. בדקו ספק/לקוח, תאריך, מספר מסמך וסכומים לפני האישור.':'לא זוהו שדות בביטחון. אפשר להזין אותם ידנית; המסמך עדיין ניתן לשמירה.';
  }catch(e){el('financeFileStatus').textContent=friendly(e);}finally{cancelled=true;clearTimeout(timeout);if(ocrWorker){await ocrWorker.terminate().catch(()=>{});ocrWorker=null;}busy=false;el('financeScan').disabled=false;el('financeSave').disabled=false;el('financeBack').disabled=false;el('financeRemoveFile').disabled=false;}
 }
 async function save(e){e.preventDefault();if(busy||!requireServiceAccess())return;const userId=state.user.id;busy=true;el('financeSave').disabled=true;error('','financeFormError');let entryId=el('financeEntryId').value;
  try{const original=rows.find(r=>r.id===entryId),income=el('financeKind').value==='income';
   const row=F.validate({kind:el('financeKind').value,amount:F.amount(el('financeAmount').value),counterparty:el('financeCounterparty').value.trim(),document_number:el('financeNumber').value.trim(),document_date:el('financeDocDate').value||null,paid_on:el('financePaid').checked?el('financePaidDate').value:null,category:el('financeCategory').value,notes:el('financeNotes').value.trim(),job_id:original?.source!=='manual'&&original?original.job_id:income?null:el('financeJob').value||null,vat_amount:F.amount(el('financeVat').value||0),deductible_vat:income?0:F.amount(el('financeDeductible').value||0),vat_period:el('financeVatMonth').value?el('financeVatMonth').value+'-01':null,vat_confirmed:el('financeVatConfirmed').checked});
   if(el('financePaid').checked&&!row.paid_on)throw Error('יש לבחור תאריך תשלום');if(!el('financeVerified').checked)throw Error('יש לבדוק ולאשר את הפרטים');
   // Hash/check before writing a new entry so a duplicate upload cannot create a duplicate income.
   let hash;
   if(selectedFile){hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await selectedFile.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');if(docs.some(d=>d.sha256===hash&&['stored','pending'].includes(d.status)))throw Error('הקובץ הזה כבר קיים בארכיון. חפשו את הרישום הקיים.');}
   let query=entryId?db.from('finance_entries').update({...row,review_required:false}).eq('id',entryId).eq('professional_id',userId):db.from('finance_entries').insert(row);if(entryId&&original?.updated_at)query=query.eq('updated_at',original.updated_at);
   const result=await query.select('*').single();if(result.error)throw result.error;entryId=result.data.id;el('financeEntryId').value=entryId;
   rows=rows.filter(r=>r.id!==entryId).concat(result.data);
   if(selectedFile){if(!userStill(userId))throw Error('החשבון השתנה');const reservation=await db.from('finance_documents').insert({entry_id:entryId,original_name:selectedFile.name.slice(0,200),mime_type:selectedFile.type,byte_size:selectedFile.size,sha256:hash}).select('*').single();if(reservation.error)throw reservation.error;
    const d=reservation.data;docs.push(d);const upload=await db.storage.from(B).upload(d.storage_path,selectedFile,{contentType:selectedFile.type,upsert:false,cacheControl:'0'});if(upload.error)throw upload.error;
    const complete=await db.from('finance_documents').update({status:'stored'}).eq('id',d.id).select('*').single();if(complete.error)throw complete.error;
    docs=docs.map(x=>x.id===d.id?complete.data:x);clearFile();
   }
   toast('הרישום נשמר');await reload();render();show('#financeView');
  }catch(err){error((entryId?'הנתונים נשמרו או עודכנו; יש לבדוק את מצב צירוף המסמך. ':'')+friendly(err),'financeFormError');renderDocs(entryId);}finally{busy=false;el('financeSave').disabled=false;}
 }
 async function settingsSave(accept=false){if(!requireServiceAccess())return;if(accept&&!el('financeRetentionAccept').checked){toast('יש לסמן שהמדיניות הובנה');return;}const row={professional_id:state.user.id,business_type:el('financeBusinessType').value};if(accept){row.retention_accepted_at=new Date().toISOString();row.retention_version=VERSION;}const q=settings?.professional_id?db.from('finance_settings').update(Object.fromEntries(Object.entries(row).filter(([k])=>k!=='professional_id'))).eq('professional_id',state.user.id):db.from('finance_settings').insert(row);const r=await q.select('*').single();if(r.error){error(friendly(r.error));return;}settings=r.data;render();toast('ההגדרות נשמרו');}
 function exportRows(list){return [['מזהה','סוג','ספק / לקוח','מספר מסמך','תאריך מסמך','תאריך תשלום','סכום כולל','מע״מ במסמך','מע״מ לקיזוז שאושר','תקופת מע״מ','מע״מ אושר','דורש בדיקה','מקור','מבוטל','קטגוריה','הערות'],...list.map(r=>[r.id,r.kind,r.counterparty,r.document_number,r.document_date,r.paid_on,r.amount,r.vat_amount,r.deductible_vat,r.vat_period,r.vat_confirmed?'כן':'לא',r.review_required?'כן':'לא',r.source,r.voided?'כן':'לא',r.category,r.notes])];}
 function exportCsv(){download(new Blob([F.csv(exportRows(visible()))],{type:'text/csv;charset=utf-8'}),'mehirli-finance-'+el('financeMonth').value+'.csv');}
 function exportParts(){const list=visible(),ids=new Set(list.map(r=>r.id)),documents=docs.filter(d=>ids.has(d.entry_id)),stored=documents.filter(d=>d.status==='stored');const batches=[[]];let bytes=0;for(const d of stored){if(bytes+Number(d.byte_size)>20*1048576){batches.push([]);bytes=0;}batches.at(-1).push(d);bytes+=Number(d.byte_size);}
  el('financeExportParts').innerHTML=`<p>הורידו את כל ${batches.length} החלקים ופתחו אותם לבדיקה. כל חלק כולל את טבלת הרישומים ורשימת המסמכים. מסמכים שכבר נמחקו אינם ניתנים לשחזור.</p>`;
  batches.forEach((batch,i)=>{const b=document.createElement('button');b.className='secondary';b.type='button';b.textContent=`הורדת ארכיון — חלק ${i+1} מתוך ${batches.length} (${batch.length} מסמכים)`;b.onclick=async()=>{
   if(busy)return;busy=true;b.disabled=true;const old=b.textContent;
   try{const files=[],enc=new TextEncoder();for(let j=0;j<batch.length;j++){b.textContent=`מוריד מסמך ${j+1} מתוך ${batch.length}…`;const d=batch[j],r=await db.storage.from(B).download(d.storage_path);if(r.error)throw Error('לא ניתן להוריד את '+d.original_name+'. הארכיון לא נוצר; נסו שוב.');files.push({name:'documents/'+d.id+d.storage_path.slice(d.storage_path.lastIndexOf('.')),data:new Uint8Array(await r.data.arrayBuffer())});}
    files.push({name:'entries.csv',data:enc.encode(F.csv(exportRows(list)))});
    files.push({name:'documents.csv',data:enc.encode(F.csv([['מזהה מסמך','מזהה רישום','שם מקורי','מצב','מחיקה בתום','כלול בחלק זה','נתיב בארכיון'],...documents.map(d=>[d.id,d.entry_id,d.original_name,d.status,expiry(d),batch.some(x=>x.id===d.id)?'כן':'לא','documents/'+d.id+d.storage_path.slice(d.storage_path.lastIndexOf('.'))])]))});
    files.push({name:'README.txt',data:enc.encode('ארכיון מחירלי. יש להוריד את כל החלקים, לפתוח את הקבצים ולשמור גיבוי עצמאי. CSV הוא סיכום ואינו מחליף את המסמכים. תאריך הייצוא: '+new Date().toISOString())});
    download(F.zip(files),`mehirli-archive-${el('financeMonth').value}-part-${i+1}.zip`);b.textContent='הקובץ נמסר להורדה — בדקו שנשמר ונפתח';
   }catch(e){b.textContent=old;error(friendly(e));}finally{busy=false;b.disabled=false;}
  };el('financeExportParts').append(b);});
 }
 el('subscriptionFinanceBtn').onclick=open;el('financeBtn').onclick=open;el('homeFinanceBtn').onclick=open;el('financeRefresh').onclick=open;
 el('financeMonth').value=month();for(const id of ['financeMonth','financeFilter'])el(id).onchange=render;el('financeSearch').oninput=render;
 el('financeIncome').onclick=()=>edit(null,'income');el('financeExpense').onclick=()=>edit(null,'expense');
 el('financeBack').onclick=()=>{if(busy)return;clearFile();show('#financeView');};el('financeKind').onchange=updateFields;el('financePaid').onchange=updateFields;
 el('financeSaveSettings').onclick=()=>settingsSave();el('financeAcceptPolicy').onclick=()=>settingsSave(true);
 el('financeCameraBtn').onclick=()=>el('financeCamera').click();el('financeFileBtn').onclick=()=>el('financeFile').click();
 for(const id of ['financeCamera','financeFile'])el(id).onchange=e=>prepareFile(e.target.files?.[0]);
 el('financeRemoveFile').onclick=()=>{if(!busy)clearFile();};el('financeScan').onclick=scan;el('financeForm').onsubmit=save;
 el('financeVoid').onclick=async()=>{if(busy||!requireServiceAccess()||!confirm('לבטל את הרישום מהסיכומים? המסמך יישאר בארכיון עד למועד המחיקה.'))return;const r=await db.from('finance_entries').update({voided:true}).eq('id',el('financeEntryId').value).eq('professional_id',state.user.id);if(r.error){error(friendly(r.error),'financeFormError');return;}await open();};
 el('financeExportCsv').onclick=exportCsv;el('financeExportZip').onclick=exportParts;
 db.auth.onAuthStateChange((event,session)=>{if(owner&&owner!==session?.user?.id){rows=[];docs=[];settings=null;owner=null;clearFile();el('financeList').replaceChildren();el('financeSummary').replaceChildren();el('financeForm').reset();el('financeExistingDocs').replaceChildren();el('financeExportParts').replaceChildren();}});
 window.MehirliFinance={open,monthIncome:async()=>{const uid=state.user?.id;if(!uid)return null;let total=0;for(let from=0;;from+=500){const start=month()+'-01',next=new Date(Number(start.slice(0,4)),Number(start.slice(5,7)),1),end=next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0')+'-01';const r=await db.from('finance_entries').select('amount').eq('professional_id',uid).eq('kind','income').eq('voided',false).eq('review_required',false).gte('paid_on',start).lt('paid_on',end).order('id').range(from,from+499);if(r.error)return null;total+=r.data.reduce((n,e)=>n+F.cents(e.amount),0);if(r.data.length<500)return total/100;}}};
})();
