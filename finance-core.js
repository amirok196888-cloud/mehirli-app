/* Pure financial calculations: amounts in integer agorot, no assumed VAT rate. */
(function(root){
 'use strict';
 const cents=n=>Math.round(Number(n||0)*100);
 function amount(value){const s=String(value??'').replace(/[₪\s,]/g,'');return /^-?\d+(\.\d{1,2})?$/.test(s)?Number(s):NaN;}
 function period(date,month){return !!date&&String(date).slice(0,7)===month;}
 function summary(entries,month,businessType){
  let income=0,expense=0,outputVat=0,inputVat=0,unknown=0,review=0;
  for(const e of entries){if(e.voided)continue;if(e.review_required){review++;continue;}
   if(period(e.paid_on,month)){if(e.kind==='income')income+=cents(e.amount);else expense+=cents(e.amount);}
   if(e.vat_confirmed&&period(e.vat_period,month)){if(e.kind==='income')outputVat+=cents(e.vat_amount);else inputVat+=cents(e.deductible_vat);}
   if(!e.vat_confirmed&&(period(e.document_date,month)||period(e.paid_on,month)))unknown++;
  }
  return {income:income/100,expense:expense/100,balance:(income-expense)/100,outputVat:outputVat/100,inputVat:inputVat/100,reserve:businessType==='vat'?Math.max(0,outputVat-inputVat)/100:null,vatBalance:(outputVat-inputVat)/100,unknown,review};
 }
 function range(month,count=1){const [y,m]=month.split('-').map(Number),end=new Date(Date.UTC(y,m-1+count,1)).toISOString().slice(0,10);return {start:month+'-01',end};}
 function workflowSummary(entries,month,settings={}){
  const r=range(month,Number(settings.reporting_months)||1),inside=d=>!!d&&d>=r.start&&d<r.end;
  let income=0,expense=0,unpaid=0,outputVat=0,inputVat=0,turnover=0,withholding=0,advancePaid=0,vatPaid=0,pending=0;
  for(const e of entries){if(e.voided||e.deletion_pending||!inside(e.report_month))continue;
   if(e.review_required||!e.approved_at){pending++;continue;}
   const a=cents(e.amount),v=cents(e.vat_amount),w=cents(e.withholding);
   if(e.category==='tax_advance'){if(e.paid_on)advancePaid+=a;continue;}
   if(e.category==='vat_payment'){if(e.paid_on)vatPaid+=a;continue;}
   if(e.kind==='income'){turnover+=a-v;outputVat+=v;if(e.paid_on){income+=a-w;withholding+=w;}else unpaid+=a;}
   else {inputVat+=cents(e.deductible_vat);if(e.paid_on)expense+=a;}
  }
  const rate=settings.advance_rate,advance=rate===null||rate===undefined||rate===''?null:Math.round(turnover*Number(rate)/100),vatBalance=outputVat-inputVat;
  const vat=settings.business_type==='vat'?Math.max(0,vatBalance-vatPaid):settings.business_type==='exempt'?0:null;
  const advanceBalance=advance===null?null:advance-withholding-advancePaid;
  return {income:income/100,expense:expense/100,balance:(income-expense-advancePaid-vatPaid)/100,unpaid:unpaid/100,outputVat:outputVat/100,inputVat:inputVat/100,vatBalance:vatBalance/100,vat:vat===null?null:vat/100,turnover:turnover/100,withholding:withholding/100,advance:advance===null?null:advance/100,advancePaid:advancePaid/100,vatPaid:vatPaid/100,advanceBalance:advanceBalance===null?null:advanceBalance/100,advanceRemaining:advanceBalance===null?null:Math.max(0,advanceBalance)/100,reserve:vat===null||advanceBalance===null?null:(vat+Math.max(0,advanceBalance))/100,pending};
 }
 function parseOcr(text){
  const lines=String(text).split(/\n/).map(s=>s.trim()).filter(Boolean),r={};
  const dt=String(text).match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if(dt){const iso=`${dt[3]}-${dt[2].padStart(2,'0')}-${dt[1].padStart(2,'0')}`;if(!isNaN(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso)r.document_date=iso;}
  for(const line of lines){const nums=[...line.matchAll(/-?\d[\d,]*\.\d{2}(?!\d)/g)].map(x=>amount(x[0])).filter(Number.isFinite);if(!nums.length)continue;const n=nums.at(-1);
   if(/(?:לתשלום|סה[״"']?כ\s*(?:כולל|לתשלום)|grand\s*total|total\s*due)/i.test(line))r.amount=n;
   if(/(?:מע[״"']?מ|VAT)/i.test(line)&&!/(?:כולל|לפני|ללא|before|including)/i.test(line))r.vat_amount=n;
  }
  const num=String(text).match(/(?:חשבונית(?:\s*מס)?|invoice)\s*(?:מס[׳'״".]?|number|no[.]?|#)?\s*[:#]?\s*(\d[\d/-]{1,30})/i);if(num)r.document_number=num[1];
  // Names are not guessed from addresses or account numbers.
  if(r.amount!==undefined&&r.vat_amount!==undefined&&Math.abs(r.vat_amount)>Math.abs(r.amount))delete r.vat_amount;
  return r;
 }
 function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function csv(rows){return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');}
 function validate(e){
  if(!Number.isFinite(e.amount)||e.amount===0||Math.abs(e.amount)>999999999)throw Error('יש להזין סכום תקין שאינו אפס');
  for(const k of ['vat_amount','deductible_vat'])if(!Number.isFinite(e[k])||Math.abs(e[k])>Math.abs(k==='vat_amount'?e.amount:e.vat_amount)||(e[k]!==0&&Math.sign(e[k])!==Math.sign(e.amount)))throw Error('סכומי המע״מ אינם תואמים לסכום המסמך');
  if(e.kind==='income'&&e.deductible_vat!==0)throw Error('מע״מ לקיזוז שייך להוצאה');
  if(e.vat_confirmed&&!e.vat_period)throw Error('יש לבחור חודש לשיוך המע״מ');
  if(e.document_number&&!e.counterparty.trim())throw Error('יש להזין ספק או לקוח לצד מספר המסמך');
  return e;
 }
 // Standard ZIP STORE writer. No external archive library; each part is capped by the UI.
 let crcTable;
 function crc32(bytes){if(!crcTable)crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
 function zip(files){const enc=new TextEncoder(),parts=[],central=[];let offset=0,size=0;
  for(const f of files){const name=enc.encode(f.name),data=f.data,crc=crc32(data),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);
   v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);h.set(name,30);parts.push(h,data);
   const c=new Uint8Array(46+name.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,crc,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);c.set(name,46);central.push(c);size+=c.length;offset+=h.length+data.length;
  }
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'});
 }
 const api={range,workflowSummary,cents,amount,summary,parseOcr,csv,validate,zip};if(typeof module!=='undefined')module.exports=api;else root.FinanceCore=api;
})(typeof window!=='undefined'?window:globalThis);
