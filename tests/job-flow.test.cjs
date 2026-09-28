const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
function part(start,end){return src.slice(src.indexOf(start),src.indexOf(end,src.indexOf(start)));}
test('daily/hourly multiplication, flat price and extra costs preserve cents',()=>{
 const nodes={};const $=id=>nodes[id]??=( {value:0,dataset:{},classList:{toggle(){}}} );
 const ctx=vm.createContext({$,state:{proSettings:{},quoteItems:[]},numberValue:id=>Number($(id).value),money:String});
 vm.runInContext(part('function calculateProPrice(', 'function uniq('),ctx);
 $('#proBasePrice').value=1305;$('#proLaborHours').value=5;$('#proPricingMode').value='full_day';
 assert.equal(vm.runInContext('calculateProPrice().total',ctx),6525);
 $('#proMaterialsCost').value=1500;$('#proTravelCost').value=50;$('#proAssistantCost').value=500;
 assert.equal(vm.runInContext('calculateProPrice().total',ctx),8575);
 $('#proPricingMode').value='fixed';assert.equal(vm.runInContext('calculateProPrice().total',ctx),3355);
 $('#proPricingMode').value='hourly';$('#proBasePrice').value=100.25;$('#proLaborHours').value=2;
 assert.equal(vm.runInContext('calculateProPrice().total',ctx),2250.5);
});
test('job balance includes adjustments without changing the original quote',()=>{
 const ctx=vm.createContext({});vm.runInContext(part('function jobBalance(', 'async function renderJobLedger('),ctx);
 assert.equal(vm.runInContext('jobBalance({quoted_price:6000,actual_paid:4000,addition_total:400,adjustment_discount_total:500}).remaining',ctx),1900);
 assert.equal(vm.runInContext('jobBalance({quoted_price:6000,actual_paid:5900,addition_total:400,adjustment_discount_total:500}).remaining',ctx),0);
});
test('welcome can close without creating a quote and stays closed per account across reload',()=>{
 const storage=new Map(),nodes={};let calls=0;
 const $=id=>nodes[id]??={classList:{hidden:true,add(){this.hidden=true},remove(){this.hidden=false}}};
 const context=()=>vm.createContext({$,state:{user:{id:'a'},onboarding:{}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},db:{rpc:()=>{calls++;return Promise.resolve({})}},console});
 const code=part('const dismissedQuoteWelcome=', 'function openPendingSignupEdit(');
 let ctx=context();vm.runInContext(code,ctx);vm.runInContext('showFirstQuoteWelcome()',ctx);assert.equal($('#firstQuoteWelcome').classList.hidden,false);
 vm.runInContext('dismissFirstQuoteWelcome();showFirstQuoteWelcome()',ctx);assert.equal($('#firstQuoteWelcome').classList.hidden,true);assert.equal(calls,1);
 ctx=context();vm.runInContext(code,ctx);vm.runInContext('showFirstQuoteWelcome()',ctx);assert.equal($('#firstQuoteWelcome').classList.hidden,true);
 vm.runInContext("state.user.id='b';showFirstQuoteWelcome()",ctx);assert.equal($('#firstQuoteWelcome').classList.hidden,false);
 $('#firstQuoteWelcome').classList.add('hidden');vm.runInContext("state.onboarding.quote_welcome_dismissed_at='now';showFirstQuoteWelcome()",ctx);assert.equal($('#firstQuoteWelcome').classList.hidden,true);
});
