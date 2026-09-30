const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const start=source.indexOf('function serviceTemplatesForTrade(');
const end=source.indexOf('function setTrade(',start);

test('job lookup works across trades and only applies an indicative price when chosen',()=>{
  const nodes={};
  const $=id=>nodes[id]??={value:'',textContent:'',dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(type,handler){this[type]=handler},querySelectorAll(){return []},reportValidity(){},click(){this.onclick?.()}};
  const window={};
  const ctx=vm.createContext({window,$,state:{proServices:[]},BUILTIN_SERVICES:{},money:n=>`${n} ₪`,esc:s=>s,saveProJobDraft(){},setPricingMode(mode){$('#proPricingMode').value=mode},calculateProPrice(){},toast(){}});
  vm.runInContext(fs.readFileSync(path.join(root,'job-suggestions.js'),'utf8'),ctx);
  vm.runInContext(source.slice(start,end),ctx);
  $('#proJobTrade').value='handyman';
  $('#proJobType').value='נקודת חשמל';$('#proJobType').input();
  assert.match($('#jobSuggestionResults').innerHTML,/כולל חציבה/);
  assert.equal($('#proBasePrice').value,'');
  vm.runInContext("chooseJobSuggestion(jobSuggestions.find(job=>job.name==='התקנת נקודת חשמל — כולל חציבה'))",ctx);
  assert.equal($('#proJobTrade').value,'handyman');
  $('#useJobSuggestionPrice').onclick();
  assert.equal($('#proBasePrice').value,590);
  assert.equal($('#proPricingMode').value,'fixed');
  $('#proJobType').value='צביעת חדר';$('#proJobType').input();
  assert.match($('#jobSuggestionResults').innerHTML,/צביעת דירת חדר/);
  $('#proJobType').value='צבעות';$('#proJobType').input();
  assert.match($('#jobSuggestionResults').innerHTML,/צביעת דירת/);
  assert.match($('#proServiceTemplate').innerHTML,/עבודות עם מחיר מוצע \(13\)/);
  assert.match($('#proServiceTemplate').innerHTML,/סיוד דירת 3 חדרים/);
  assert.match($('#proServiceTemplate').innerHTML,/צביעת קיר חיצוני/);
  assert.match($('#proServiceTemplate').innerHTML,/תיקוני צבע/);
  assert.match($('#jobSuggestionResults').innerHTML,/תיקוני צבע/);
  const templateHandler=source.match(/^\$\('#proServiceTemplate'\)\.onchange=.*$/m)?.[0];
  assert.ok(templateHandler);
  vm.runInContext(templateHandler,ctx);
  const paintingIndex=vm.runInContext("jobSuggestions.findIndex(job=>job.name==='סיוד דירת 3 חדרים')",ctx);
  $('#proServiceTemplate').onchange({target:{value:`suggestion:${paintingIndex}`}});
  assert.equal($('#proJobTrade').value,'handyman');
  assert.equal($('#proBasePrice').value,3750);
  for(const [query,expected] of [['חשמלאי','החלפת שקע'],['שיפוצים','פירוק ריצוף'],['מזגנים','ביקור טכנאי'],['הנדימן','תליית טלוויזיה']]){
    $('#proJobType').value=query;$('#proJobType').input();
    assert.match($('#jobSuggestionResults').innerHTML,new RegExp(expected),query);
  }
  $('#proJobType').value='עבודה אחרת לגמרי';$('#proJobType').input();
  assert.match($('#jobSuggestionResults').innerHTML,/תמחור חופשי/);
  $('#proJobType').value='הדבקת ריצוף';$('#proJobType').input();
  vm.runInContext("chooseJobSuggestion(jobSuggestions.find(job=>job.name==='הדבקת ריצוף'))",ctx);
  $('#jobSuggestionQuantity').value='10';$('#useJobSuggestionPrice').onclick();
  assert.equal($('#proBasePrice').value,2200);
  assert.match($('#proQuoteScope').value,/10 מ״ר/);
});
