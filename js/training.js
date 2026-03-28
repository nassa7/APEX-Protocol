'use strict';

// ══════════════════════════════════════
// REP RANGE PARSER
// ══════════════════════════════════════
function parseRepRange(s) {
  var m = s.match(/[x×](\d+)[–\-](\d+)/);
  if (m) return {min:parseInt(m[1]),max:parseInt(m[2])};
  var n = s.match(/[x×](\d+)$/);
  if (n) { var v=parseInt(n[1]); return {min:v,max:v}; }
  return {min:0,max:999};
}

// ══════════════════════════════════════
// REST TIMER
// ══════════════════════════════════════
var rtInterval = null;
var rtRem = 0;
var rtTotal = 0;

function startRest(exName, secs) {
  clearInterval(rtInterval);
  rtRem = secs; rtTotal = secs;
  document.getElementById('rtEx').textContent = exName;
  updateRtDisplay();
  document.getElementById('restTimer').classList.add('show');
  if (navigator.vibrate) navigator.vibrate(50);
  rtInterval = setInterval(function(){
    rtRem--;
    updateRtDisplay();
    if (rtRem <= 0) {
      clearInterval(rtInterval);
      if (navigator.vibrate) navigator.vibrate([100,50,100,50,200]);
      setTimeout(function(){ document.getElementById('restTimer').classList.remove('show'); }, 800);
    }
  }, 1000);
}

function updateRtDisplay() {
  var n = document.getElementById('rtNum');
  var f = document.getElementById('rtFill');
  var pct = rtTotal > 0 ? (rtRem / rtTotal) * 100 : 0;
  n.textContent = rtRem;
  f.style.width = pct + '%';
  if (pct > 60) { n.className='rt-num green'; f.style.background='var(--green)'; }
  else if (pct > 30) { n.className='rt-num'; n.style.color='var(--accent)'; f.style.background='var(--accent)'; }
  else { n.className='rt-num'; n.style.color='var(--red)'; f.style.background='var(--red)'; }
}

function skipRest() {
  clearInterval(rtInterval);
  document.getElementById('restTimer').classList.remove('show');
  if (navigator.vibrate) navigator.vibrate(30);
}

// ══════════════════════════════════════
// HEAT MAP
// ══════════════════════════════════════
function calcVolumes() {
  var vols = {};
  MUSCLE_GROUPS.forEach(function(mg){ vols[mg.key]=0; });
  SESSIONS_DEF.forEach(function(sess,si){
    if (S.sessions[si] !== 'done') return;
    sess.exercises.forEach(function(ex,ei){
      if (!ex.muscles || !ex.muscles.length) return;
      var k = si+'_'+ei;
      var sets = S.setLogs[k] || [];
      var vol = sets.filter(function(s){ return s.done; }).reduce(function(a,s){
        return a + ((parseFloat(s.kg)||0) * (parseInt(s.reps)||0));
      }, 0);
      ex.muscles.forEach(function(mg){ vols[mg] = (vols[mg]||0) + vol; });
    });
  });
  return vols;
}

function volToLevel(v) {
  if (v===0) return 0;
  if (v<500) return 1;
  if (v<1500) return 2;
  if (v<3000) return 3;
  if (v<5000) return 4;
  return 5;
}

function updateHeatMap() {
  var g = document.getElementById('heatGrid');
  if (!g) return;
  var vols = calcVolumes();
  g.innerHTML = MUSCLE_GROUPS.map(function(mg){
    var v = vols[mg.key]||0;
    var l = volToLevel(v);
    var vs = v>0 ? (v>=1000 ? (v/1000).toFixed(1)+'k' : v+'') : '—';
    return '<div class="heat-cell h'+l+'"><div class="heat-icon">'+mg.icon+'</div><div class="heat-lbl">'+mg.label+'</div><div class="heat-vol">'+vs+(v>0?'kg':'')+'</div></div>';
  }).join('');
}

// ══════════════════════════════════════
// AUTO-PROGRESSION
// ══════════════════════════════════════
function checkProg(si, ei) {
  var ex = SESSIONS_DEF[si] && SESSIONS_DEF[si].exercises[ei];
  if (!ex) return false;
  var range = parseRepRange(ex.sets);
  if (range.max === 999) return false;
  var k = si+'_'+ei;
  var cur = (S.setLogs[k]||[]).filter(function(s){ return s.done; });
  if (!cur.length) return false;
  var curTop = cur.every(function(s){ return parseInt(s.reps)>=range.max; });
  if (!curTop) return false;
  var lastH = (S.history||[]).slice(-1)[0];
  if (!lastH || !lastH.setLogs) return false;
  var prev = (lastH.setLogs[k]||[]).filter(function(s){ return s.done; });
  if (!prev.length) return false;
  return prev.every(function(s){ return parseInt(s.reps)>=range.max; });
}

function renderProgFlag(si, ei) {
  var fid = 'pf-'+si+'-'+ei;
  var old = document.getElementById(fid);
  if (old) old.remove();
  if (!checkProg(si, ei)) return;
  var ex = SESSIONS_DEF[si].exercises[ei];
  var range = parseRepRange(ex.sets);
  var k = si+'_'+ei;
  var sets = S.setLogs[k]||[];
  var topKg = 0;
  sets.filter(function(s){ return s.done; }).forEach(function(s){ var v=parseFloat(s.kg)||0; if(v>topKg) topKg=v; });
  var nextKg = topKg > 0 ? (topKg+2.5).toFixed(1) : null;
  var flag = document.createElement('div');
  flag.className = 'prog-flag';
  flag.id = fid;
  flag.innerHTML = '📈 Hit '+range.max+' reps ×2 weeks'+(nextKg?' — increase to <strong>'+nextKg+'kg</strong> next session':'');
  var cEl = document.getElementById('sc-'+si+'-'+ei);
  if (cEl) cEl.after(flag);
  var lg = document.getElementById('lg-'+si+'-'+ei);
  if (lg) {
    var inps = lg.querySelectorAll('.set-inp');
    for (var i=0; i<inps.length; i+=2) inps[i].classList.add('prog-ready');
  }
}

// ══════════════════════════════════════
// RUN SESSIONS
// ══════════════════════════════════════
function buildRunSessions() {
  var list = document.getElementById('runSessionList');
  if (!list) return;
  list.innerHTML = '';
  RUN_SESSIONS.forEach(function(run, ri) {
    var log = S.runLogs[run.dow] || {};
    var isDone = log.done === true;
    var isMissed = log.done === false;
    var wrap = document.createElement('div');
    wrap.className = 'run-card';
    wrap.innerHTML =
      '<div class="run-hdr" onclick="togRunCard('+ri+')">'
      +'<div>'
      +'<div class="run-type">'+( run.type==='long' ? '🏃 LONG RUN' : '🏃 SHORT RUN' )+'</div>'
      +'<div class="run-name">'+run.label+'</div>'
      +'<div class="run-meta">'+run.distance+' · '+run.effort+'</div>'
      +'</div>'
      +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">'
      +'<div class="sdot'+(isDone?' done':isMissed?' missed':'')+'" id="rdot-'+ri+'"></div>'
      +'<div class="chev" id="rchev-'+ri+'">▾</div>'
      +'</div>'
      +'</div>'
      +'<div class="run-body" id="rbody-'+ri+'">'
      +'<div class="run-note-box">'+run.notes+'</div>'
      +'<div class="run-stat-row">'
      +'<div class="run-stat"><div class="run-stat-lbl">Distance</div><div class="run-stat-val green">'+run.distance+'</div></div>'
      +'<div class="run-stat"><div class="run-stat-lbl">Duration</div><div class="run-stat-val">'+run.duration+'</div></div>'
      +'<div class="run-stat"><div class="run-stat-lbl">Pace target</div><div class="run-stat-val">'+run.pace+'</div></div>'
      +'<div class="run-stat"><div class="run-stat-lbl">Timing</div><div class="run-stat-val" style="font-size:11px">'+run.timing.split('.')[0]+'</div></div>'
      +'</div>'
      +'<div style="font-family:var(--fm);font-size:9px;color:var(--muted);margin-bottom:8px;line-height:1.5">🍌 '+run.nutrition+'</div>'
      +'<div class="run-log-grid">'
      +'<div class="ig"><div class="il">Actual distance (km)</div><input type="number" id="rdist-'+ri+'" placeholder="'+run.distance.split('–')[0]+'" step="0.1" min="0" value="'+(log.distance||'')+'"></div>'
      +'<div class="ig"><div class="il">Time (min)</div><input type="number" id="rtime-'+ri+'" placeholder="30" step="1" min="0" value="'+(log.time||'')+'"></div>'
      +'</div>'
      +'<button class="run-done-btn'+(isDone?' completed':'')+'" onclick="logRun('+ri+',true)">'+(isDone?'✓ Completed':'✓ Log Run as Done')+'</button>'
      +'<button class="run-miss-btn" onclick="logRun('+ri+',false)">✗ Missed</button>'
      +'</div>';
    list.appendChild(wrap);
  });
}

function togRunCard(ri) {
  var body = document.getElementById('rbody-'+ri);
  var chev = document.getElementById('rchev-'+ri);
  var open = body.classList.contains('open');
  RUN_SESSIONS.forEach(function(_,i){
    var b=document.getElementById('rbody-'+i), c=document.getElementById('rchev-'+i);
    if(b){b.classList.remove('open');} if(c){c.classList.remove('open');c.textContent='▾';}
  });
  if (!open) { body.classList.add('open'); chev.classList.add('open'); chev.textContent='▴'; }
}

function logRun(ri, done) {
  var run  = RUN_SESSIONS[ri];
  var dist = parseFloat(document.getElementById('rdist-'+ri).value) || null;
  var time = parseFloat(document.getElementById('rtime-'+ri).value) || null;
  S.runLogs[run.dow] = {done:done, distance:dist, time:time, type:run.type};
  save();
  buildRunSessions();
  updateWeekGrid();
  if (done) {
    if (navigator.vibrate) navigator.vibrate([50,30,100]);
    if (typeof awardXP==='function') awardXP(75, (run.type==='long'?'Long':'Short')+' run done! 🏃');
    if (typeof fireConfetti==='function') fireConfetti();
    if (typeof checkAchievements==='function') checkAchievements();
    if (typeof renderGradeCard==='function') renderGradeCard();
    showToast('🏃', 'Run logged!', (dist||'?')+'km'+(time?' in '+time+' min':''), 'success', 3000);
  }
}

// ══════════════════════════════════════
// GYM SESSIONS
// ══════════════════════════════════════
function buildSessions() {
  var list = document.getElementById('sessionList');
  list.innerHTML = '';
  var todayDow = realDow();
  var todaySi  = TRAIN_DAYS.indexOf(todayDow);

  var lastWeekLogs = {};
  var lastH = (S.history||[]).slice(-1)[0];
  if (lastH && lastH.setLogs) lastWeekLogs = lastH.setLogs;

  SESSIONS_DEF.forEach(function(sess, si){
    var status = S.sessions[si];
    var isToday = si === todaySi;
    var exHtml = '';
    sess.exercises.forEach(function(ex, ei){
      var k = si+'_'+ei;
      if (!S.setLogs[k]) S.setLogs[k] = mkSets(ex.sets);
      var sets = S.setLogs[k];
      var dc = sets.filter(function(s){ return s.done; }).length;

      var lwSets = lastWeekLogs[k] || [];
      var lwTop = 0;
      lwSets.forEach(function(s){ if (s.done && parseFloat(s.kg)>lwTop) lwTop=parseFloat(s.kg)||0; });
      var lwHint = lwTop > 0
        ? '<span style="font-family:var(--fm);font-size:9px;color:var(--muted)"> · last week: <span style="color:var(--blue)">'+lwTop+'kg</span></span>'
        : '';

      var setRows = sets.map(function(st, sti){
        return '<div class="set-row" id="sr-'+si+'-'+ei+'-'+sti+'">'
          +'<span class="set-num">S'+(sti+1)+'</span>'
          +'<input class="set-inp'+(st.done?' done-in':'')+'" type="number" placeholder="kg" step="0.5" min="0" value="'+st.kg+'" oninput="updSet('+si+','+ei+','+sti+',\'kg\',this.value)">'
          +'<span class="set-sep">×</span>'
          +'<input class="set-inp'+(st.done?' done-in':'')+'" type="number" placeholder="reps" step="1" min="0" value="'+st.reps+'" oninput="updSet('+si+','+ei+','+sti+',\'reps\',this.value)">'
          +'<button class="set-chk'+(st.done?' logged':'')+'" onclick="togSet('+si+','+ei+','+sti+')">'+(st.done?'✓':'○')+'</button>'
          +'</div>';
      }).join('');

      exHtml += '<div class="ex-block">'
        +'<div class="ex-hdr">'
        +'<div><div class="ex-title">'+ex.name+lwHint+'</div>'+(ex.note?'<div class="ex-subtitle">'+ex.note+'</div>':'')+'</div>'
        +'<div class="ex-meta"><span class="chip chip-sets">'+ex.sets+'</span><span class="chip chip-rpe">RPE '+ex.rpe+'</span><span class="chip chip-tempo">'+ex.tempo+'</span></div>'
        +'</div>'
        +'<div class="set-logger" id="lg-'+si+'-'+ei+'">'+setRows+'</div>'
        +'<button class="set-add" onclick="addSet('+si+','+ei+')">+ Add Set</button>'
        +'<div class="sets-count" id="sc-'+si+'-'+ei+'">'+dc+'/'+sets.length+' sets logged</div>'
        +'</div>';
    });

    var todayBadge = isToday && status===null
      ? '<span style="font-family:var(--fm);font-size:8px;background:var(--accent);color:#0d1117;padding:2px 7px;border-radius:4px;font-weight:700;margin-left:6px">TODAY</span>'
      : '';

    var wrap = document.createElement('div');
    wrap.className = 'sc-wrap';
    if (isToday && status===null) wrap.style.borderColor = 'rgba(56,189,248,.4)';

    var timerVal = '';
    var existTimer = S.sessionTimers && S.sessionTimers[si];
    if (existTimer && existTimer.duration) timerVal = existTimer.duration+' min';
    else if (existTimer && existTimer.start && !existTimer.end) {
      var el2 = Math.floor((Date.now()-existTimer.start)/1000);
      timerVal = Math.floor(el2/60)+':'+(el2%60<10?'0':'')+el2%60;
    }
    var noteVal = (S.sessionNotes && S.sessionNotes[si]) || '';

    wrap.innerHTML = '<div class="sc-hdr" onclick="togSess('+si+')">'
      +'<div><div class="sc-day">'+sess.day+todayBadge+'</div><div class="sc-name">'+sess.name+'</div><div class="sc-focus">'+sess.focus+'</div></div>'
      +'<div class="sc-meta">'
      +'<span class="sess-timer" id="sess-timer-'+si+'">'+timerVal+'</span>'
      +'<div class="'+(status==='done'?'sdot done':status==='missed'?'sdot missed':'sdot')+'" id="sdot-'+si+'"></div>'
      +'<div class="chev" id="chev-'+si+'">▾</div>'
      +'</div>'
      +'</div>'
      +'<div class="sc-body" id="sbody-'+si+'">'
      +(sess.runNote ? '<div class="tip tip-green" style="margin:0 0 12px">🏃 '+sess.runNote+'</div>' : '')
      +exHtml
      +'<div class="ig" style="margin-top:10px">'
      +'<div class="il">Session notes (optional)</div>'
      +'<textarea id="snote-'+si+'" placeholder="How did it feel? Any pain? Strong / Tired?" style="min-height:56px;font-size:11px" oninput="saveSessionNote('+si+')">'+noteVal+'</textarea>'
      +'</div>'
      +'<div class="sess-actions">'
      +'<button class="btn btn-primary" style="flex:1" onclick="markSess('+si+',\'done\')">✓ Done</button>'
      +'<button class="btn btn-secondary" style="flex:1" onclick="markSess('+si+',\'missed\')">✗ Missed</button>'
      +'</div></div>';
    list.appendChild(wrap);

    if (isToday && status === null) {
      var body = document.getElementById('sbody-'+si);
      var chev = document.getElementById('chev-'+si);
      if (body) { body.classList.add('open'); }
      if (chev) { chev.classList.add('open'); chev.textContent='▴'; }
    }
  });
}

function mkSets(str) {
  var n = parseInt(str) || 3;
  var arr = [];
  for (var i=0; i<n; i++) arr.push({kg:'',reps:'',done:false});
  return arr;
}

function togSess(si) {
  var body = document.getElementById('sbody-'+si);
  var chev = document.getElementById('chev-'+si);
  var open = body.classList.contains('open');
  document.querySelectorAll('.sc-body').forEach(function(b){ b.classList.remove('open'); });
  document.querySelectorAll('.chev').forEach(function(c){ c.classList.remove('open'); c.textContent='▾'; });
  if (!open) {
    body.classList.add('open'); chev.classList.add('open'); chev.textContent='▴';
    // Auto-start session timer for today's session
    var todayDow = realDow();
    var todaySi  = TRAIN_DAYS.indexOf(todayDow);
    if (si===todaySi && S.sessions[si]===null && typeof startSessionTimer==='function') {
      startSessionTimer(si);
    }
  }
}

function saveSessionNote(si) {
  if (!S.sessionNotes) S.sessionNotes = {};
  var el = document.getElementById('snote-'+si);
  S.sessionNotes[si] = el ? el.value : '';
  save();
}

function markSess(si, status) {
  S.sessions[si] = status; save();
  document.getElementById('sdot-'+si).className = status==='done'?'sdot done':'sdot missed';
  updateWeekGrid(); updateRecovery(); updateSessCount();
  if (status === 'done') {
    var dur = typeof stopSessionTimer==='function' ? stopSessionTimer(si) : 0;
    var durStr = dur > 0 ? dur+' min' : '';
    var doneCount = S.sessions.filter(function(s){ return s==='done'; }).length;
    if (typeof awardXP==='function') {
      awardXP(100, SESSIONS_DEF[si].name+' session complete!');
      if (doneCount===5) awardXP(200, 'Full week — all 5 sessions done! 🔥');
    }
    if (typeof fireConfetti==='function') fireConfetti();
    var msg = doneCount===5 ? '🔥 Full week complete!' : doneCount+'/5 sessions this week';
    showToast('🎉', SESSIONS_DEF[si].name+' session done!', msg+(durStr?' · '+durStr:''), 'success', 4000);
    if (navigator.vibrate) navigator.vibrate([50,30,100,30,200]);
    if (typeof checkAchievements==='function') checkAchievements();
    if (typeof renderGradeCard==='function') renderGradeCard();
    // Update session card header to show done duration
    if (dur > 0) {
      var timerEl = document.getElementById('sess-timer-'+si);
      if (timerEl) { timerEl.textContent = durStr; timerEl.style.color='var(--green)'; }
    }
  } else {
    showToast('📝', SESSIONS_DEF[si].name+' marked missed', 'Rest up — come back stronger', 'warn', 2500);
  }
}

function updSet(si, ei, sti, field, val) {
  S.setLogs[si+'_'+ei][sti][field] = val; save();
}

function togSet(si, ei, sti) {
  var k = si+'_'+ei;
  var st = S.setLogs[k][sti];

  if (!st.done) {
    var kg   = parseFloat(st.kg);
    var reps = parseInt(st.reps);
    if (!kg || kg <= 0 || !reps || reps <= 0) {
      var row = document.getElementById('sr-'+si+'-'+ei+'-'+sti);
      if (row) {
        var inps = row.querySelectorAll('.set-inp');
        inps.forEach(function(inp){
          inp.style.borderColor = 'var(--red)';
          setTimeout(function(){ inp.style.borderColor = ''; }, 1200);
        });
      }
      if (navigator.vibrate) navigator.vibrate([30,30,30]);
      return;
    }
  }

  st.done = !st.done; save();
  var row = document.getElementById('sr-'+si+'-'+ei+'-'+sti);
  var inps = row.querySelectorAll('.set-inp');
  inps.forEach(function(inp){ inp.className = 'set-inp' + (st.done?' done-in':''); });
  var btn = row.querySelector('.set-chk');
  btn.className = 'set-chk' + (st.done?' logged':'');
  btn.textContent = st.done ? '✓' : '○';
  var sets = S.setLogs[k];
  var dc = sets.filter(function(s){ return s.done; }).length;
  document.getElementById('sc-'+si+'-'+ei).textContent = dc+'/'+sets.length+' sets logged';
  if (st.done) {
    var ex = SESSIONS_DEF[si] && SESSIONS_DEF[si].exercises[ei];
    if (ex) {
      startRest(ex.name, ex.rest || 90);
      // Check personal best
      var kg2 = parseFloat(st.kg), rp2 = parseInt(st.reps);
      if (typeof checkAndUpdatePB==='function' && kg2>0 && rp2>0) checkAndUpdatePB(ex.name, kg2, rp2);
    }
    renderProgFlag(si, ei);
    updateHeatMap();
    if (navigator.vibrate) navigator.vibrate(40);
  }
}

function addSet(si, ei) {
  var k = si+'_'+ei;
  var sets = S.setLogs[k];
  var last = sets[sets.length-1];
  sets.push({kg:last?last.kg:'', reps:last?last.reps:'', done:false}); save();
  var lg = document.getElementById('lg-'+si+'-'+ei);
  lg.innerHTML = sets.map(function(st,sti){
    return '<div class="set-row" id="sr-'+si+'-'+ei+'-'+sti+'">'
      +'<span class="set-num">S'+(sti+1)+'</span>'
      +'<input class="set-inp'+(st.done?' done-in':'')+'" type="number" placeholder="kg" step="0.5" min="0" value="'+st.kg+'" oninput="updSet('+si+','+ei+','+sti+',\'kg\',this.value)">'
      +'<span class="set-sep">×</span>'
      +'<input class="set-inp'+(st.done?' done-in':'')+'" type="number" placeholder="reps" step="1" min="0" value="'+st.reps+'" oninput="updSet('+si+','+ei+','+sti+',\'reps\',this.value)">'
      +'<button class="set-chk'+(st.done?' logged':'')+'" onclick="togSet('+si+','+ei+','+sti+')">'+(st.done?'✓':'○')+'</button>'
      +'</div>';
  }).join('');
  var dc = sets.filter(function(s){ return s.done; }).length;
  document.getElementById('sc-'+si+'-'+ei).textContent = dc+'/'+sets.length+' sets logged';
}
