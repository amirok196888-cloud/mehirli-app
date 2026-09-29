/* Loaded after app.js. Uses existing authenticated data loaders and actions. */
let homeDashboardRequest=0;
function renderHomeDashboard(){
  const jobs=state.proJobs.filter(j=>proJobMatchesFilter(j,'open')).slice(0,3);
  const jobBox=$('#homeOpenJobs');
  jobBox.classList.toggle('home-empty',!jobs.length);
  jobBox.innerHTML=jobs.length?jobs.map(j=>`<button type="button" class="home-job" data-home-job="${esc(j.id)}"><span class="home-job-top"><strong>${esc(j.description)}</strong><span class="status-pill status-${esc(j.status)}">${esc(jobStatusHe[j.status]||j.status)}</span></span><p>${esc(j.customer_name)} · ${money(jobBalance(j).total)}</p><small>פתיחת העבודה ←</small></button>`).join(''):'אין עבודות פתוחות כרגע. פותחים עבודה חדשה בכפתור שמעל.';
  jobBox.querySelectorAll('[data-home-job]').forEach(b=>b.onclick=()=>openProJobDetail(b.dataset.homeJob));
  const now=new Date(),today=calendarEntries().filter(x=>new Date(x.date).toDateString()===now.toDateString()),todayBox=$('#homeTodayList');
  todayBox.classList.toggle('home-empty',!today.length);
  todayBox.innerHTML=today.length?today.map(x=>`<button type="button" class="home-job" data-home-event="${esc(x.id)}"><strong>${new Date(x.date).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})} · ${esc(x.title)}</strong><p>${esc(x.body)}</p><small>פתיחה ביומן ←</small></button>`).join(''):'אין פגישות להיום. אפשר לקבוע פגישה חדשה ביומן.';
  todayBox.querySelectorAll('[data-home-event]').forEach(b=>b.onclick=openCalendar);
}
async function refreshHomeDashboard(){
  if(!state.user||!hasServiceAccess())return;
  const request=++homeDashboardRequest,userId=state.user.id;
  try{
    await Promise.all([loadProJobs(),loadProReminders(),loadProAppointments()]);
    if(request!==homeDashboardRequest||state.user?.id!==userId)return;
    renderHomeDashboard();
  }catch{
    if(request!==homeDashboardRequest||state.user?.id!==userId)return;
    $('#homeOpenJobs').textContent='לא ניתן לטעון כרגע. פתחו את העבודות שלי כדי לנסות שוב.';
    $('#homeTodayList').textContent='לא ניתן לטעון כרגע. פתחו את היומן כדי לנסות שוב.';
  }
}
function updateAppNavigation(view){
  const nav=$('#appNavigation');if(!nav)return;
  nav.classList.toggle('hidden',!state.user||['#authView','#passwordResetView','#legalConsentView','#publicQuoteView'].includes(view));
  const key=view==='#homeView'?'home':view==='#customersView'?'customers':view==='#calendarView'?'calendar':'';
  nav.querySelectorAll('[data-app-nav]').forEach(b=>{if(b.dataset.appNav===key)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
}
$('#homeCalendarBtn').onclick=openCalendar;
$('#homeAllJobsBtn').onclick=openProWorkspace;
$('#appNavigation').querySelector('[data-app-nav="home"]').onclick=()=>show('#homeView');
$('#appNavigation').querySelector('[data-app-nav="customers"]').onclick=openCustomers;
$('#appNavigation').querySelector('[data-app-nav="calendar"]').onclick=openCalendar;
$('#appNavigation').querySelector('[data-app-nav="help"]').onclick=()=>$('#sampleQuoteBtn').click();
