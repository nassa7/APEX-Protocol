'use strict';

// ══════════════════════════════════════
// XP SYSTEM
// ══════════════════════════════════════
var XP_VALUES = {
  SESSION:100, RUN:75, PROTEIN:25, SLEEP:25,
  PB:50, ALL_SESSIONS:200, CHECKIN:10,
  GRADE_A:100, GRADE_B:50, ACHIEVEMENT:75
};
var XP_WEEKLY_CAP = 600;

function awardXP(amount, reason) {
  if (!S.weeklyXP) S.weeklyXP = 0;
  if (!S.totalXP)  S.totalXP  = 0;
  S.weeklyXP += amount;
  S.totalXP  += amount;
  save();
  showToast('⚡', '+' + amount + ' XP', reason, 'info', 1800);
  updateXPDisplay();
}

function updateXPDisplay() {
  var bar = document.getElementById('xpBarFill');
  var lbl = document.getElementById('xpLabel');
  var xp  = S.weeklyXP || 0;
  var pct = Math.min((xp / XP_WEEKLY_CAP) * 100, 100);
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = xp + ' XP';
}

// ══════════════════════════════════════
// WEEKLY GRADE
// ══════════════════════════════════════
function calcWeekGrade() {
  var sessions = S.sessions.filter(function(s){ return s==='done'; }).length;
  var nutrDates = Object.keys(S.nutritionByDate || {});
  var avgProt = 0;
  if (nutrDates.length) {
    nutrDates.forEach(function(d){ avgProt += S.nutritionByDate[d].protein || 0; });
    avgProt = avgProt / nutrDates.length;
  }
  var protPct = avgProt ? (avgProt / TARGETS.protein) * 100 : 0;
  var recent = (S.sleepLog || []).slice(0, 7);
  var avgSleep = 0;
  if (recent.length) {
    recent.forEach(function(s){ avgSleep += s.hrs; });
    avgSleep = avgSleep / recent.length;
  }
  if (sessions >= 4 && protPct >= 80 && avgSleep >= 7) return 'A';
  if (sessions >= 3 && protPct >= 70 && avgSleep >= 6.5) return 'B';
  if (sessions >= 2 && protPct >= 60 && avgSleep >= 6)   return 'C';
  return 'D';
}

function gradeColor(g) {
  return {A:'var(--green)',B:'var(--accent)',C:'var(--orange)',D:'var(--red)'}[g] || 'var(--muted)';
}

function renderGradeCard() {
  var el = document.getElementById('gradeCard');
  if (!el) return;
  var grade  = calcWeekGrade();
  var xp     = S.weeklyXP || 0;
  var streak = S.streak   || 0;
  var color  = gradeColor(grade);
  var pct    = Math.min((xp / XP_WEEKLY_CAP) * 100, 100);
  var gradeMsg = {A:'Outstanding 🔥',B:'Solid week 💪',C:'Keep going 📈',D:'Start now 🆕'}[grade];

  el.innerHTML =
    '<div class="grade-layout">'
    +'<div class="grade-letter" style="color:'+color+'">'+grade
    +'<div style="font-family:var(--fm);font-size:8px;color:var(--muted);letter-spacing:2px;font-weight:400;margin-top:2px">'+gradeMsg+'</div>'
    +'</div>'
    +'<div class="grade-right">'
    +'<div class="grade-xp-row"><span id="xpLabel" style="font-family:var(--fm);font-size:10px;color:var(--accent)">'+xp+' XP</span><span style="font-family:var(--fm);font-size:9px;color:var(--muted)">/ '+XP_WEEKLY_CAP+'</span></div>'
    +'<div class="xp-track"><div id="xpBarFill" class="xp-fill" style="width:'+pct+'%"></div></div>'
    +'<div class="grade-stats">'
    +'<div class="grade-stat"><div class="grade-stat-ico">🔥</div><div class="grade-stat-val" style="color:var(--orange)">'+streak+'</div><div class="grade-stat-lbl">Streak</div></div>'
    +'<div class="grade-stat"><div class="grade-stat-ico">⚡</div><div class="grade-stat-val" style="color:var(--accent)">'+(S.totalXP||0)+'</div><div class="grade-stat-lbl">Total XP</div></div>'
    +'<div class="grade-stat"><div class="grade-stat-ico">🏆</div><div class="grade-stat-val" style="color:var(--blue)">'+(Object.keys(S.personalBests||{}).length)+'</div><div class="grade-stat-lbl">PBs</div></div>'
    +'</div>'
    +'</div>'
    +'</div>';
}

// ══════════════════════════════════════
// STREAK
// ══════════════════════════════════════
rolloverCallbacks.push(function(prevSessions) {
  var done = prevSessions.filter(function(s){ return s==='done'; }).length;
  S.streak = done >= 3 ? (S.streak || 0) + 1 : 0;
  save();
  if (S.streak >= 4) checkAchievements();
});

// ══════════════════════════════════════
// ACHIEVEMENTS
// ══════════════════════════════════════
var ACHIEVEMENTS_DEF = [
  {id:'first_session', name:'First Step',      desc:'Complete your first session',             icon:'👟'},
  {id:'iron_will',     name:'Iron Will',        desc:'Complete all 5 sessions in a week',       icon:'🔱'},
  {id:'week_streak_4', name:'4-Week Streak',    desc:'Train consistently for 4 weeks in a row', icon:'🔥'},
  {id:'pb_hunter',     name:'PB Hunter',        desc:'Set 5 personal bests',                    icon:'🏆'},
  {id:'road_warrior',  name:'Road Warrior',     desc:'Complete both runs in a week',             icon:'🏃'},
  {id:'sleep_warrior', name:'Sleep Warrior',    desc:'Log 7+ hrs sleep 5 nights in a row',      icon:'🌙'},
  {id:'protein_king',  name:'Protein King',     desc:'Hit 200g+ protein 5 days in a row',       icon:'🥩'},
  {id:'centurion',     name:'Centurion',        desc:'Complete 10 total sessions',               icon:'💯'},
  {id:'grade_a',       name:'A-Game',           desc:'Earn a week A grade',                      icon:'⭐'},
  {id:'clean_week',    name:'Clean Week',       desc:'Log nutrition every day for 7 days',       icon:'✨'},
];

function checkAchievements() {
  if (!S.achievements) S.achievements = [];
  var earn = [];

  // Count total sessions across history
  var totalDone = S.sessions.filter(function(s){ return s==='done'; }).length;
  (S.history||[]).forEach(function(h){
    totalDone += (h.sessions||[]).filter(function(s){ return s==='done'; }).length;
  });
  if (totalDone >= 1)  earn.push('first_session');
  if (totalDone >= 10) earn.push('centurion');

  // This week
  if (S.sessions.filter(function(s){ return s==='done'; }).length >= 5) earn.push('iron_will');

  // Streak
  if ((S.streak||0) >= 4) earn.push('week_streak_4');

  // PBs
  if ((S.pbCount||0) >= 5) earn.push('pb_hunter');

  // Runs
  var runsDone = Object.keys(S.runLogs||{}).filter(function(k){ return S.runLogs[k]&&S.runLogs[k].done; }).length;
  if (runsDone >= 2) earn.push('road_warrior');

  // Grade A
  if (calcWeekGrade() === 'A') earn.push('grade_a');

  // Nutrition 7 days
  var nutrDays = Object.keys(S.nutritionByDate||{}).filter(function(k){ return (S.nutritionByDate[k].cal||0) > 0; }).length;
  if (nutrDays >= 7) earn.push('clean_week');

  // Protein 5 days in a row
  var nutrDates = Object.keys(S.nutritionByDate||{}).sort();
  var consec = 0, maxC = 0;
  nutrDates.forEach(function(d){ if((S.nutritionByDate[d].protein||0)>=200){consec++;maxC=Math.max(maxC,consec);}else consec=0; });
  if (maxC >= 5) earn.push('protein_king');

  // Sleep 5 nights
  var sc = 0, sm = 0;
  (S.sleepLog||[]).slice(0,14).forEach(function(e){ if(e.hrs>=7){sc++;sm=Math.max(sm,sc);}else sc=0; });
  if (sm >= 5) earn.push('sleep_warrior');

  earn.forEach(function(id){ unlockAchievement(id); });
}

function unlockAchievement(id) {
  if (!S.achievements) S.achievements = [];
  if (S.achievements.indexOf(id) !== -1) return;
  var def = ACHIEVEMENTS_DEF.filter(function(a){ return a.id===id; })[0];
  if (!def) return;
  S.achievements.push(id);
  save();
  setTimeout(function(){
    showToast(def.icon, 'Achievement Unlocked!', def.name+' — '+def.desc, 'success', 4500);
    if (navigator.vibrate) navigator.vibrate([50,30,50,30,150]);
  }, 600);
  awardXP(XP_VALUES.ACHIEVEMENT, 'Achievement: '+def.name);
  renderAchievements();
}

function renderAchievements() {
  var el = document.getElementById('achievementsBody');
  if (!el) return;
  var earned = S.achievements || [];
  if (!earned.length) {
    el.innerHTML = '<div style="font-family:var(--fm);font-size:10px;color:var(--muted);padding:10px 0;text-align:center">Complete sessions to unlock achievements 🎯</div>';
    return;
  }
  el.innerHTML = earned.map(function(id){
    var def = ACHIEVEMENTS_DEF.filter(function(a){ return a.id===id; })[0];
    if (!def) return '';
    return '<div class="ach-badge" title="'+def.desc+'"><div class="ach-ico">'+def.icon+'</div><div class="ach-name">'+def.name+'</div></div>';
  }).join('');
}

// ══════════════════════════════════════
// PERSONAL BESTS
// ══════════════════════════════════════
function checkAndUpdatePB(exerciseName, kg, reps) {
  if (!kg || kg <= 0 || !reps || reps <= 0) return false;
  if (!S.personalBests) S.personalBests = {};
  var key = exerciseName.toLowerCase().replace(/\s+/g, '_');
  var ex  = S.personalBests[key];
  var isNew = !ex || kg > ex.kg || (kg === ex.kg && reps > ex.reps);
  if (!isNew) return false;
  S.personalBests[key] = {kg:kg, reps:reps, name:exerciseName, date:todayISO(), week:S.week};
  S.pbCount = (S.pbCount || 0) + 1;
  save();
  setTimeout(function(){
    showToast('🏆', 'Personal Best!', exerciseName+' — '+kg+'kg × '+reps+' reps', 'success', 3500);
    if (navigator.vibrate) navigator.vibrate([50,30,50,30,100]);
  }, 200);
  awardXP(XP_VALUES.PB, 'New PB: '+exerciseName);
  checkAchievements();
  renderPBCard();
  return true;
}

function renderPBCard() {
  var el = document.getElementById('pbList');
  if (!el) return;
  var pbs  = S.personalBests || {};
  var keys = Object.keys(pbs);
  if (!keys.length) {
    el.innerHTML = '<div style="font-family:var(--fm);font-size:10px;color:var(--muted);padding:10px 0;text-align:center">No PBs yet — head to <span style="color:var(--accent);cursor:pointer" onclick="swTab(\'training\',null)">Training ↗</span> and log sets to earn them 💪</div>';
    return;
  }
  keys.sort(function(a,b){ return (pbs[b].date||'') > (pbs[a].date||'') ? 1 : -1; });
  el.innerHTML = keys.slice(0,8).map(function(k){
    var pb = pbs[k];
    var orm = Math.round(pb.kg * (1 + pb.reps / 30));
    var ormStr = pb.reps > 1 ? '<div class="pb-meta" style="color:var(--blue);margin-top:1px">~e1RM: '+orm+'kg</div>' : '';
    return '<div class="pb-row">'
      +'<div style="flex:1"><div class="pb-name">'+pb.name+'</div><div class="pb-meta">Wk '+pb.week+' · '+pb.date+'</div>'+ormStr+'</div>'
      +'<div class="pb-val">'+pb.kg+'<span>kg</span> × '+pb.reps+'<span>reps</span></div>'
      +'</div>';
  }).join('');
}

// ══════════════════════════════════════
// CONFETTI
// ══════════════════════════════════════
var _cfParts = [], _cfAF = null;

function fireConfetti() {
  var canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  var cols = ['#38bdf8','#34d399','#c084fc','#fb923c','#f87171','#fbbf24','#ffffff'];
  _cfParts = [];
  for (var i = 0; i < 140; i++) {
    _cfParts.push({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 120,
      w: 5 + Math.random() * 9, h: 4 + Math.random() * 6,
      c: cols[Math.floor(Math.random()*cols.length)],
      vx:(Math.random()-.5)*4, vy:1.5+Math.random()*4,
      rot:Math.random()*360, vrot:(Math.random()-.5)*10,
      op:1
    });
  }
  if (_cfAF) cancelAnimationFrame(_cfAF);
  (function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    var alive=false;
    _cfParts.forEach(function(p){
      if (p.y > canvas.height+10) return;
      alive=true;
      p.x+=p.vx; p.y+=p.vy; p.rot+=p.vrot; p.vy+=0.07;
      if (p.y > canvas.height*0.65) p.op=Math.max(0,p.op-0.025);
      ctx.save();
      ctx.globalAlpha=p.op;
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle=p.c;
      ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.restore();
    });
    if (alive) _cfAF=requestAnimationFrame(draw);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  })();
}

// ══════════════════════════════════════
// SESSION TIMER
// ══════════════════════════════════════
var _sessTimerIv = null;

function startSessionTimer(si) {
  if (!S.sessionTimers) S.sessionTimers = {};
  var t = S.sessionTimers[si];
  if (t && t.start && !t.end) return; // already running
  S.sessionTimers[si] = {start:Date.now(), end:null, duration:0};
  save();
  if (_sessTimerIv) clearInterval(_sessTimerIv);
  _sessTimerIv = setInterval(function(){ tickSessTimer(si); }, 1000);
}

function tickSessTimer(si) {
  var el = document.getElementById('sess-timer-'+si);
  if (!el || !S.sessionTimers || !S.sessionTimers[si]) return;
  var elapsed = Math.floor((Date.now() - S.sessionTimers[si].start) / 1000);
  var m = Math.floor(elapsed/60), s = elapsed%60;
  el.textContent = m+':'+(s<10?'0':'')+s;
}

function stopSessionTimer(si) {
  if (!S.sessionTimers || !S.sessionTimers[si]) return 0;
  var t = S.sessionTimers[si];
  if (t.end) return t.duration || 0;
  t.end = Date.now();
  t.duration = Math.round((t.end - t.start) / 60000);
  save();
  if (_sessTimerIv) { clearInterval(_sessTimerIv); _sessTimerIv = null; }
  return t.duration;
}

// ══════════════════════════════════════
// TODAY'S FOCUS CARD
// ══════════════════════════════════════
function updateFocusCard() {
  var el = document.getElementById('focusCard');
  if (!el) return;
  var dow = realDow();
  var si  = TRAIN_DAYS.indexOf(dow);
  var isT = si !== -1;
  var isR = RUN_DAYS.indexOf(dow) !== -1;
  var sess = isT ? SESSIONS_DEF[si] : null;
  var st   = isT ? S.sessions[si] : null;
  var tgt  = todayCalTarget();
  var n    = todayNutr();
  var calLeft = Math.max(0, tgt.cal - n.cal);
  var energy  = S.checkIn && S.checkIn.date===todayISO() ? S.checkIn.energy : null;
  var eIco    = {high:'🔥',medium:'😊',low:'😴',skip:'—'}[energy] || '●';
  var eLbl    = energy && energy!=='skip' ? energy.charAt(0).toUpperCase()+energy.slice(1) : 'Check in';

  var sHtml;
  if (sess) {
    var sc = st==='done'?'var(--green)':st==='missed'?'var(--red)':'var(--accent)';
    var sl = st==='done'?'✓ Done':st==='missed'?'✗ Missed':'Today';
    sHtml = '<div class="focus-pill" style="--pc:rgba(56,189,248,.12);--bc:rgba(56,189,248,.25)">'
      +'<span class="focus-pill-ico">⚡</span>'
      +'<div class="focus-pill-body"><span style="font-weight:700;color:'+sc+'">'+sess.name+'</span><span class="focus-pill-sub">'+sl+'</span></div>'
      +'</div>';
  } else if (isR) {
    var rl  = S.runLogs[dow];
    var rsl = rl?(rl.done?'✓ Done':'✗ Missed'):'Today';
    sHtml = '<div class="focus-pill" style="--pc:rgba(52,211,153,.1);--bc:rgba(52,211,153,.2)">'
      +'<span class="focus-pill-ico">🏃</span>'
      +'<div class="focus-pill-body"><span style="font-weight:700;color:var(--green)">Long Run</span><span class="focus-pill-sub">'+rsl+'</span></div>'
      +'</div>';
  } else {
    sHtml = '<div class="focus-pill" style="--pc:rgba(123,130,160,.07);--bc:rgba(123,130,160,.15)">'
      +'<span class="focus-pill-ico">😴</span>'
      +'<div class="focus-pill-body"><span style="font-weight:700;color:var(--muted)">Rest Day</span><span class="focus-pill-sub">Recover well</span></div>'
      +'</div>';
  }

  el.innerHTML = sHtml
    +'<div class="focus-pill" style="--pc:rgba(56,189,248,.06);--bc:rgba(56,189,248,.14)">'
    +'<span class="focus-pill-ico">🍽️</span>'
    +'<div class="focus-pill-body"><span style="font-weight:700">'+Math.round(calLeft)+'<span style="font-size:10px;font-weight:400;color:var(--muted)"> kcal</span></span><span class="focus-pill-sub">'+tgt.cal+' target</span></div>'
    +'</div>'
    +'<div class="focus-pill" style="--pc:rgba(192,132,252,.06);--bc:rgba(192,132,252,.14);cursor:pointer" onclick="openModal(\'modalCheckIn\')">'
    +'<span class="focus-pill-ico">'+eIco+'</span>'
    +'<div class="focus-pill-body"><span style="font-weight:700">Energy</span><span class="focus-pill-sub">'+eLbl+'</span></div>'
    +'</div>';
}

// ══════════════════════════════════════
// DAILY CHECK-IN
// ══════════════════════════════════════
function maybeShowCheckIn() {
  var today = todayISO();
  if (S.checkIn && S.checkIn.date===today) return;
  setTimeout(function(){ openModal('modalCheckIn'); }, 900);
}

function submitCheckIn(energy) {
  S.checkIn = {date:todayISO(), energy:energy};
  save();
  closeModal('modalCheckIn');
  if (energy !== 'skip') {
    awardXP(XP_VALUES.CHECKIN, 'Daily check-in');
    var eLbl = {high:'High 🔥',medium:'Medium 😊',low:'Low 😴'}[energy] || energy;
    showToast('✅','Check-in done','Energy today: '+eLbl,'success',2200);
  }
  updateFocusCard();
}

// ══════════════════════════════════════
// WEEKLY RECAP
// ══════════════════════════════════════
function maybeShowRecap() {
  var today = todayISO();
  if (S.lastRecapSeen===today) return;
  if (realDow() !== 0) return; // only Monday
  var lastH = (S.history||[]).slice(-1)[0];
  if (!lastH) return;
  S.lastRecapSeen = today;
  save();
  setTimeout(function(){ buildAndShowRecap(lastH); }, 1800);
}

function buildAndShowRecap(h) {
  h = h || (S.history||[]).slice(-1)[0];
  if (!h) return;
  var el = document.getElementById('recapContent');
  if (!el) return;

  var done  = (h.sessions||[]).filter(function(s){ return s==='done'; }).length;
  var ndates = Object.keys(h.nutritionByDate||{});
  var avgCal=0, avgProt=0;
  if (ndates.length) {
    ndates.forEach(function(d){ avgCal+=h.nutritionByDate[d].cal||0; avgProt+=h.nutritionByDate[d].protein||0; });
    avgCal=Math.round(avgCal/ndates.length); avgProt=Math.round(avgProt/ndates.length);
  }
  var sl = h.sleepLog||[];
  var avgSl = sl.length ? (sl.reduce(function(a,s){ return a+s.hrs; },0)/sl.length).toFixed(1) : '—';
  var runs = Object.keys(h.runLogs||{}).filter(function(k){ return h.runLogs[k]&&h.runLogs[k].done; }).length;

  // Grade for that week
  var protPct = avgProt ? (avgProt/TARGETS.protein)*100 : 0;
  var grade;
  if (done>=4 && protPct>=80 && parseFloat(avgSl)>=7)       grade='A';
  else if (done>=3 && protPct>=70 && parseFloat(avgSl)>=6.5) grade='B';
  else if (done>=2 && protPct>=60 && parseFloat(avgSl)>=6)   grade='C';
  else grade='D';

  var gc = gradeColor(grade);
  var msgs = {A:'Outstanding week 🔥',B:'Solid effort 💪',C:'Room to grow 📈',D:'New week, new start 🆕'};

  el.innerHTML =
    '<div style="text-align:center;margin-bottom:18px">'
    +'<div style="font-family:var(--fm);font-size:9px;letter-spacing:3px;color:var(--muted);text-transform:uppercase;margin-bottom:6px">WEEK '+h.week+' RECAP</div>'
    +'<div style="font-size:80px;font-weight:800;color:'+gc+';line-height:1;font-family:var(--ff)">'+grade+'</div>'
    +'<div style="font-family:var(--fm);font-size:11px;color:var(--muted);margin-top:6px">'+msgs[grade]+'</div>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">'
    +'<div class="recap-stat"><div class="recap-val" style="color:'+(done>=4?'var(--green)':done>=3?'var(--accent)':'var(--red)')+'">'+done+'/5</div><div class="recap-lbl">Sessions</div></div>'
    +'<div class="recap-stat"><div class="recap-val" style="color:'+(runs>=2?'var(--green)':runs>=1?'var(--accent)':'var(--red)')+'">'+runs+'/2</div><div class="recap-lbl">Runs</div></div>'
    +'<div class="recap-stat"><div class="recap-val" style="color:var(--orange)">'+(avgProt||'—')+'g</div><div class="recap-lbl">Avg Protein</div></div>'
    +'<div class="recap-stat"><div class="recap-val" style="color:var(--purple)">'+avgSl+'h</div><div class="recap-lbl">Avg Sleep</div></div>'
    +'</div>'
    +'<div style="font-family:var(--fm);font-size:10px;color:var(--muted);text-align:center">Week '+(h.week+1)+' starts now. Keep the momentum. 💪</div>';

  openModal('modalRecap');
}

// ══════════════════════════════════════
// NOTIFICATION REMINDERS
// ══════════════════════════════════════
var _notifTimer = null;

function toggleNotifReminder() {
  var tog = document.getElementById('notifTog');
  var enabled = localStorage.getItem('apex_notif') === '1';
  if (enabled) {
    localStorage.removeItem('apex_notif');
    if (tog) tog.classList.remove('on');
    if (_notifTimer) { clearTimeout(_notifTimer); _notifTimer = null; }
    showToast('🔕', 'Reminders off', 'Sleep reminder disabled', 'info', 2000);
  } else {
    if (!('Notification' in window)) {
      showToast('⚠️', 'Not supported', 'Notifications not available in this browser', 'warn'); return;
    }
    Notification.requestPermission().then(function(perm) {
      if (perm === 'granted') {
        localStorage.setItem('apex_notif', '1');
        if (tog) tog.classList.add('on');
        scheduleSleepNotif();
        showToast('🔔', 'Reminder set', 'Sleep reminder at 10:30pm daily', 'success', 2500);
      } else {
        showToast('⚠️', 'Permission denied', 'Allow notifications in browser settings', 'warn', 3000);
      }
    });
  }
}

function scheduleSleepNotif() {
  if (localStorage.getItem('apex_notif') !== '1') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (_notifTimer) clearTimeout(_notifTimer);
  var now = new Date();
  var target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 30, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  var msUntil = target - now;
  _notifTimer = setTimeout(function() {
    new Notification('APEX Protocol 🌙', {
      body: "Don't forget to log your sleep tonight. Tap to open.",
      icon: 'manifest.json',
      tag: 'apex-sleep-reminder'
    });
    scheduleSleepNotif(); // reschedule for tomorrow
  }, msUntil);
}

function initNotifToggle() {
  var tog = document.getElementById('notifTog');
  var enabled = localStorage.getItem('apex_notif') === '1';
  if (tog) tog.classList.toggle('on', enabled);
  if (enabled) scheduleSleepNotif();
}

// ══════════════════════════════════════
// VOLUME TREND (for charts)
// ══════════════════════════════════════
function getWeeklyVolumeData() {
  var result = [];
  var hist = (S.history||[]).slice(-8);
  hist.forEach(function(h){
    var vol=0;
    Object.keys(h.setLogs||{}).forEach(function(k){
      (h.setLogs[k]||[]).forEach(function(s){ if(s.done) vol+=(parseFloat(s.kg)||0)*(parseInt(s.reps)||0); });
    });
    result.push({week:h.week, vol:Math.round(vol/1000)});
  });
  var curVol=0;
  Object.keys(S.setLogs||{}).forEach(function(k){
    (S.setLogs[k]||[]).forEach(function(s){ if(s.done) curVol+=(parseFloat(s.kg)||0)*(parseInt(s.reps)||0); });
  });
  result.push({week:S.week, vol:Math.round(curVol/1000)});
  return result;
}
