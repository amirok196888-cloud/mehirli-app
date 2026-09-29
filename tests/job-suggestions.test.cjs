const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const start=source.indexOf('const jobSuggestions=');
const end=source.indexOf('function setTrade(',start);

test('job lookup works across trades and only applies an indicative price when chosen',()=>{
  const nodes={};
  const $=id=>nodes[id]??={value:'',textContent:'',dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(type,handler){this[type]=handler},querySelectorAll(){return []},reportValidity(){}};
  const window={};
  const ctx=vm.createContext({window,$,money:n=>`${n} ₪`,esc:s=>s,saveProJobDraft(){},setPricingMode(mode){$('#proPricingMode').value=mode},calculateProPrice(){},toast(){}});
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
  $('#proJobType').value='הדבקת ריצוף';$('#proJobType').input();
  vm.runInContext("chooseJobSuggestion(jobSuggestions.find(job=>job.name==='הדבקת ריצוף'))",ctx);
  $('#jobSuggestionQuantity').value='10';$('#useJobSuggestionPrice').onclick();
  assert.equal($('#proBasePrice').value,2200);
  assert.match($('#proQuoteScope').value,/10 מ״ר/);
});
