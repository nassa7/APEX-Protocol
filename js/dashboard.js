'use strict';

// ══════════════════════════════════════
// SPARKLINES
// ══════════════════════════════════════
function makeSpark(vals, color) {
  if (!vals || vals.length < 2) return '';
  var W = 60, H = 24, pad = 2;
  var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  var range = max - min || 1;
  var pts = vals.map(function(v, i) {
    var x = pad + (i / (vals.length - 1)) * (W - pad * 2);
    var y = H - pad - ((v - min) / range) * (H - pad * 2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  return '<svg class="sparkline" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'
    +'<polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
    +'</svg>';
}

function renderSparklines() {
  // Weight sparkline
  var wEl = document.getElementById('wtVal');
  if (wEl && S.weights.length >= 2) {
    var sc = wEl.closest('.sc');
    if (sc) {
      var old = sc.querySelector('.sparkline'); if (old) old.remove();
      var vals = S.weights.slice(0, 7).map(function(w){ return w.val; }).reverse();
      sc.insertAdjacentHTML('beforeend', makeSpark(vals, 'var(--accent)'));
    }
  }
  // Sleep sparkline
  var slEl = document.getElementById('dashSleep');
  if (slEl && S.sleepLog && S.sleepLog.length >= 2) {
    var sc2 = slEl.closest('.sc');
    if (sc2) {
      var old2 = sc2.querySelector('.sparkline'); if (old2) old2.remove();
      var vals2 = S.sleepLog.slice(0, 7).map(function(e){ return e.hrs; }).reverse();
      sc2.insertAdjacentHTML('beforeend', makeSpark(vals2, 'var(--purple)'));
    }
  }
  // Protein sparkline
  var protEl = document.getElementById('dashProt');
  if (protEl) {
    var sc3 = protEl.closest('.sc');
    var nutrDates = Object.keys(S.nutritionByDate || {}).sort();
    if (sc3 && nutrDates.length >= 2) {
      var old3 = sc3.querySelector('.sparkline'); if (old3) old3.remove();
      var vals3 = nutrDates.slice(-7).map(function(d){ return S.nutritionByDate[d].protein || 0; });
      sc3.insertAdjacentHTML('beforeend', makeSpark(vals3, 'var(--protein)'));
    }
  }
}

// ══════════════════════════════════════
// WEEK GRID
// ══════════════════════════════════════
function updateWeekGrid() {
  var g = document.getElementById('wkGrid');
  g.innerHTML = '';
  var todayDow = realDow();
  DAY_LABELS.forEach(function(lbl, i){
    var div = document.createElement('div');
    div.className = 'dp';
    var isTrain  = TRAIN_DAYS.indexOf(i) !== -1;
    var isRun    = RUN_DAYS.indexOf(i) !== -1;
    var si       = TRAIN_DAYS.indexOf(i);
    var st       = isTrain ? S.sessions[si] : null;
    var runLog   = isRun   ? (S.runLogs[i] || null) : null;
    var isCycle  = (S.cyclingDays||[]).indexOf(i) !== -1;
    var isToday  = i === todayDow;

    if (st==='done') div.classList.add('done-d');
    else if (st==='missed') div.classList.add('miss-d');
    else if (runLog && runLog.done===true) div.classList.add('done-d');
    else if (runLog && runLog.done===false) div.classList.add('miss-d');
    else if (isCycle) div.classList.add('cycle-d');
    else if (isTrain && isRun) { div.classList.add('training'); div.style.borderColor='rgba(62,255,170,.3)'; }
    else if (isTrain) div.classList.add('training');
    else if (isRun) { div.style.borderColor='rgba(62,255,170,.2)'; div.style.color='var(--green)'; }

    var ico = st==='done'?'✓':st==='missed'?'✗':(runLog&&runLog.done===true)?'✓':(runLog&&runLog.done===false)?'✗':isCycle?'🚴':isTrain&&isRun?'🏃':isTrain?'●':isRun?'🏃':'–';
    div.innerHTML = '<div class="dpi">'+ico+'</div>'+lbl;
    if (isToday && !st) div.classList.add('today');
    if (!isTrain) {
      (function(idx){ div.addEventListener('click', function(){ togCycleDay(idx); }); })(i);
    }
    g.appendChild(div);
  });
}

function togCycleDay(i) {
  if (!S.cyclingDays) S.cyclingDays = [];
  var idx = S.cyclingDays.indexOf(i);
  if (idx > -1) S.cyclingDays.splice(idx, 1); else S.cyclingDays.push(i);
  save(); updateWeekGrid();
}

// ══════════════════════════════════════
// RECOVERY
// ══════════════════════════════════════
function updateRecovery() {
  var missed = S.sessions.filter(function(s){ return s==='missed'; }).length;
  var logged = S.sessions.filter(function(s){ return s!==null; }).length;
  var bar = document.getElementById('recBar');
  bar.innerHTML = '';
  for (var i=0; i<5; i++) {
    var d = document.createElement('div');
    d.className = 'rd';
    if (missed===0) d.classList.add('good');
    else if (missed<=2) d.classList.add(i<5-missed?'good':'warn');
    else d.classList.add('bad');
    bar.appendChild(d);
  }
  var msgs = ['OPTIMAL','ACCEPTABLE (1 missed)','ELEVATED FATIGUE','DELOAD REQUIRED','DELOAD REQUIRED'];
  var lbl = document.getElementById('recLbl');
  lbl.textContent = 'Recovery: '+(msgs[missed]||'DELOAD REQUIRED');
  lbl.className = 'sm '+(missed===0?'green':missed<=2?'acc':'red');
  document.getElementById('alertDeload').className = (missed>=3 && logged>=3)?'alert al-red show':'alert al-red';
}

function updateSessCount() {
  var done = S.sessions.filter(function(s){ return s==='done'; }).length;
  document.getElementById('sessCount').textContent = done+' / 5';
}

// ══════════════════════════════════════
// NUTRITION
// ══════════════════════════════════════
function flashInvalid(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = 'var(--red)';
  el.style.boxShadow = '0 0 0 2px rgba(248,113,113,.2)';
  setTimeout(function(){
    el.style.borderColor = '';
    el.style.boxShadow = '';
  }, 1400);
}

function logNutrition() {
  var btn = document.querySelector('[onclick="logNutrition()"]');
  var cal  = parseFloat(document.getElementById('nCal').value)  || 0;
  var prot = parseFloat(document.getElementById('nProt').value) || 0;
  var carb = parseFloat(document.getElementById('nCarb').value) || 0;
  var fat  = parseFloat(document.getElementById('nFat').value)  || 0;
  if (!cal && !prot && !carb && !fat) {
    showToast('⚠️','Nothing to log','Enter at least one value','warn'); return;
  }
  var invalid = false;
  if (cal  > 6000) { flashInvalid('nCal');  showToast('⚠️','Too many calories','Max 6,000 kcal per entry','warn'); invalid=true; }
  if (prot > 400)  { flashInvalid('nProt'); showToast('⚠️','Protein too high','Max 400g per entry','warn'); invalid=true; }
  if (carb > 700)  { flashInvalid('nCarb'); showToast('⚠️','Carbs too high','Max 700g per entry','warn'); invalid=true; }
  if (fat  > 300)  { flashInvalid('nFat');  showToast('⚠️','Fat too high','Max 300g per entry','warn'); invalid=true; }
  if (invalid) return;
  lockBtn(btn);
  var n = todayNutr();
  n.cal += cal; n.protein += prot; n.carbs += carb; n.fat += fat;
  save(); updateNutritionUI();
  ['nCal','nProt','nCarb','nFat'].forEach(function(id){ document.getElementById(id).value=''; });
  showToast('🍴','Nutrition logged','+'+cal+' kcal · +'+prot+'g protein','success');
}

function updateNutritionUI() {
  var n   = todayNutr();
  var tgt = todayCalTarget();
  var over = n.cal - tgt.cal;
  var isOver = over > 0;
  var rem = isOver ? 0 : tgt.cal - n.cal;

  var remEl = document.getElementById('calRem');
  var remLbl = document.getElementById('calRemLabel');
  if (remEl) remEl.textContent = isOver ? '+'+Math.round(over) : Math.round(rem);
  if (remEl) remEl.style.color = isOver ? 'var(--red)' : 'var(--text)';
  if (remLbl) remLbl.textContent = isOver ? 'over target' : 'Remaining';

  document.getElementById('calLogged').textContent = Math.round(n.cal);
  document.getElementById('dashProt').innerHTML = Math.round(n.protein)+'<span>g</span>';

  var tgtEl = document.getElementById('calTarget');
  var dayTypeEl = document.getElementById('calDayType');
  if (tgtEl) tgtEl.textContent = tgt.cal;
  if (dayTypeEl) dayTypeEl.textContent = tgt===TARGETS_RUN?' (run day)':tgt===TARGETS_LONG?' (long run)':'';

  var pct = Math.min(n.cal/tgt.cal, 1);
  var ring = document.getElementById('calRing');
  ring.setAttribute('stroke-dashoffset', 201 - pct*201);
  ring.setAttribute('stroke', isOver?'var(--red)':pct>0.85?'var(--orange)':'var(--accent)');

  setBar('pbCal','lbCal',n.cal,tgt.cal,'kcal', isOver?'var(--red)':'var(--accent)');
  setBar('pbProt','lbProt',n.protein,tgt.protein,'g','var(--protein)');
  setBar('pbCarb','lbCarb',n.carbs,tgt.carbs,'g','var(--carbs)');
  setBar('pbFat','lbFat',n.fat,tgt.fat,'g','var(--fat)');
}

function setBar(fid, lid, val, tgt, unit, color) {
  var pct = Math.min((val/tgt)*100, 100);
  var f = document.getElementById(fid);
  f.style.width = pct+'%'; f.style.background = color;
  document.getElementById(lid).textContent = Math.round(val)+'/'+tgt+unit;
}

// ══════════════════════════════════════
// MEALS & SUPPS
// ══════════════════════════════════════
function togSupp(i) { S.supps[i]=!S.supps[i]; save(); document.getElementById('supp-'+i).classList.toggle('on',S.supps[i]); }
function restoreToggles() {
  S.supps.forEach(function(v,i){ var el=document.getElementById('supp-'+i); if(el) el.classList.toggle('on',v); });
}

// ══════════════════════════════════════
// WEIGHT
// ══════════════════════════════════════
function logWeight() {
  var btn = document.querySelector('[onclick="logWeight()"]');
  var v = parseFloat(document.getElementById('wtIn').value);
  if (!v || v<40 || v>250) { showToast('⚠️','Invalid weight','Enter a value between 40–250 kg','warn'); return; }
  lockBtn(btn);
  var todayDate = new Date().toLocaleDateString('en-GB');
  var existIdx = -1;
  for (var i=0; i<S.weights.length; i++) { if (S.weights[i].date===todayDate) { existIdx=i; break; } }
  var isUpdate = existIdx !== -1;
  if (isUpdate) S.weights.splice(existIdx, 1);
  S.weights.unshift({date:todayDate, val:v});
  if (S.weights.length>60) S.weights = S.weights.slice(0,60);
  save(); updateWeightUI();
  document.getElementById('wtIn').value = '';
  showToast('⚖️', isUpdate?'Weight updated':'Weight logged', v+'kg today', 'success');
  renderCharts();
}

function updateWeightUI() {
  if (!S.weights.length) {
    var log = document.getElementById('wtLog');
    if (log) log.innerHTML = '<div style="font-family:var(--fm);font-size:10px;color:var(--muted);padding:8px 0;text-align:center">Log your first weight above ↑</div>';
    return;
  }
  var latest = S.weights[0].val;
  var baseline = S.weights[S.weights.length-1].val;
  var delta = (latest - baseline).toFixed(1);
  document.getElementById('wtVal').innerHTML = latest+'<span>kg</span>';
  var del = document.getElementById('wtDelta');
  del.textContent = (delta<0?'':'+') + delta + 'kg total';
  del.className = 'sc-sub '+(delta<0?'green':delta>0?'red':'mut');
  var log = document.getElementById('wtLog');
  log.innerHTML = S.weights.slice(0,5).map(function(w,i){
    var prev = S.weights[i+1];
    var d = prev ? (w.val-prev.val).toFixed(1) : null;
    var dc = d!==null ? '<span class="wl-'+(d<0?'neg':'pos')+'">'+(d>0?'+':'')+d+'kg</span>' : '';
    return '<div class="wl-item"><span class="wl-date">'+w.date+'</span><span class="wl-val">'+w.val+'kg</span>'+dc+'</div>';
  }).join('');
}

// ══════════════════════════════════════
// SLEEP
// ══════════════════════════════════════
function logSleep() {
  var btn = document.querySelector('[onclick="logSleep()"]');
  var bed = document.getElementById('sleepBed').value;
  var wake = document.getElementById('sleepWake').value;
  if (!bed || !wake) { showToast('⚠️','Missing times','Set both bedtime and wake time','warn'); return; }
  lockBtn(btn, 2000);
  var bh=parseInt(bed.split(':')[0]), bm=parseInt(bed.split(':')[1]);
  var wh=parseInt(wake.split(':')[0]), wm=parseInt(wake.split(':')[1]);
  var bedM = bh*60+bm, wakeM = wh*60+wm;
  if (wakeM <= bedM) wakeM += 1440;
  var hrs = (wakeM - bedM) / 60;
  var q = hrs>=7.5?'EXCELLENT':hrs>=7?'GOOD':hrs>=6?'ADEQUATE':hrs>=5?'POOR':'CRITICAL';
  var hrsRounded = Math.round(hrs*10)/10;
  if (!S.sleepLog) S.sleepLog = [];
  var todayDate = new Date().toLocaleDateString('en-GB');
  var existIdx = -1;
  for (var j=0; j<S.sleepLog.length; j++) { if (S.sleepLog[j].date===todayDate) { existIdx=j; break; } }
  var isUpdate = existIdx !== -1;
  if (isUpdate) S.sleepLog.splice(existIdx, 1);
  S.sleepLog.unshift({date:todayDate, bed:bed, wake:wake, hrs:hrsRounded, quality:q});
  if (S.sleepLog.length>60) S.sleepLog = S.sleepLog.slice(0,60);
  S.sleepDefaults = {bed:bed, wake:wake};
  save(); updateSleepUI();
  var h=Math.floor(hrsRounded), m=Math.round((hrsRounded-h)*60);
  showToast('😴', isUpdate?'Sleep updated':'Sleep logged',
    h+'h'+(m>0?m+'m':'')+' · '+q,
    q==='EXCELLENT'||q==='GOOD'?'success':q==='ADEQUATE'?'info':'warn', 3000);
  renderCharts();
}

function updateSleepUI() {
  var hasAnyLog = S.sleepLog && S.sleepLog.length > 0;
  var todayDate = new Date().toLocaleDateString('en-GB');
  var latest = hasAnyLog ? S.sleepLog[0] : null;
  var isToday = latest && latest.date === todayDate;

  if (isToday) {
    var pct = Math.min(latest.hrs / SLEEP_TARGET, 1);
    var arc = document.getElementById('sleepArc');
    arc.setAttribute('stroke-dashoffset', 502 - pct*502);
    var ac = latest.hrs>=7?'var(--green)':latest.hrs>=6?'var(--accent)':'var(--red)';
    arc.setAttribute('stroke', ac);
    var h = Math.floor(latest.hrs), m = Math.round((latest.hrs-h)*60);
    document.getElementById('sleepHrs').textContent = h+'h'+(m>0?m+'m':'');
    document.getElementById('sleepSubLbl').textContent = 'LAST NIGHT';
    var ql = document.getElementById('sleepQuality');
    ql.textContent = latest.quality; ql.style.color = ac;
    document.getElementById('dashSleep').innerHTML = latest.hrs+'<span>hrs</span>';
    document.getElementById('dashSleepLbl').textContent = latest.quality;
    document.getElementById('dashSleep').className = 'sc-val '+(latest.hrs>=7?'green':latest.hrs>=6?'acc':'red');
  } else if (latest && !isToday) {
    var arc2 = document.getElementById('sleepArc');
    arc2.setAttribute('stroke-dashoffset', 502);
    arc2.setAttribute('stroke', '#a78bfa');
    document.getElementById('sleepHrs').textContent = '—';
    document.getElementById('sleepSubLbl').textContent = 'LOG TODAY';
    var ql2 = document.getElementById('sleepQuality');
    ql2.textContent = 'Not yet logged'; ql2.style.color = 'var(--muted)';
    document.getElementById('dashSleep').innerHTML = '—<span>hrs</span>';
    document.getElementById('dashSleepLbl').textContent = 'Log last night';
    document.getElementById('dashSleep').className = 'sc-val mut';
  } else {
    var arc3 = document.getElementById('sleepArc');
    arc3.setAttribute('stroke-dashoffset', 502);
    arc3.setAttribute('stroke', '#a78bfa');
    document.getElementById('sleepHrs').textContent = '—';
    document.getElementById('sleepSubLbl').textContent = 'HRS LOGGED';
    var ql3 = document.getElementById('sleepQuality');
    ql3.textContent = 'LOG SLEEP'; ql3.style.color = 'var(--muted)';
  }

  // Pre-populate sleep inputs from last used values
  if (S.sleepDefaults) {
    var bedIn = document.getElementById('sleepBed');
    var wakeIn = document.getElementById('sleepWake');
    if (bedIn && !bedIn.value) bedIn.value = S.sleepDefaults.bed;
    if (wakeIn && !wakeIn.value) wakeIn.value = S.sleepDefaults.wake;
  }

  if (hasAnyLog) {
    var recent = S.sleepLog.slice(0,7);
    var avg = recent.reduce(function(a,e){ return a+e.hrs; },0) / recent.length;
    var debt = Math.max(0, (SLEEP_TARGET - avg) * 7);
    var dp = Math.min((debt/14)*100,100);
    document.getElementById('debtFill').style.width = dp+'%';
    document.getElementById('debtFill').style.background = debt<2?'var(--green)':debt<5?'var(--accent)':'var(--red)';
    var dl = document.getElementById('debtLbl');
    dl.textContent = debt.toFixed(1)+' hrs/week';
    dl.className = debt<2?'green':debt<5?'acc':'red';
    document.getElementById('alertSleepDebt').className = (debt>=5 && S.sleepLog.length>=3)?'alert al-purple show':'alert al-purple';
    var logEl = document.getElementById('sleepLog');
    logEl.innerHTML = S.sleepLog.slice(0,7).map(function(e){
      var c = e.hrs>=7?'var(--green)':e.hrs>=6?'var(--accent)':'var(--red)';
      var isT = e.date === todayDate ? ' (today)' : '';
      return '<div class="sleep-log-entry">'
        +'<span style="font-size:10px;color:var(--muted)">'+e.date+isT+'</span>'
        +'<span style="font-size:11px">'+e.bed+' → '+e.wake+'</span>'
        +'<span style="font-size:12px;font-weight:600;color:'+c+'">'+e.hrs+'h</span>'
        +'</div>';
    }).join('');
  }
}

// ══════════════════════════════════════
// WEEK / DAY
// ══════════════════════════════════════
function updateWeeklySummary() {
  var card = document.getElementById('weeklySummaryCard');
  if (!card) return;
  var lastH = (S.history||[]).slice(-1)[0];
  if (!lastH) { card.style.display='none'; return; }
  card.style.display='block';

  document.getElementById('sumWkLabel').textContent = 'Week '+lastH.week+' · '+( lastH.weekStartMonday||'');

  var sessArr = lastH.sessions || [];
  var done   = sessArr.filter(function(s){ return s==='done'; }).length;
  var missed = sessArr.filter(function(s){ return s==='missed'; }).length;
  var sessColor = done>=4?'green':done>=3?'acc':'red';

  var nutrDates = Object.keys(lastH.nutritionByDate||{});
  var avgCal = 0, avgProt = 0;
  if (nutrDates.length) {
    nutrDates.forEach(function(d){ avgCal+=lastH.nutritionByDate[d].cal||0; avgProt+=lastH.nutritionByDate[d].protein||0; });
    avgCal  = Math.round(avgCal  / nutrDates.length);
    avgProt = Math.round(avgProt / nutrDates.length);
  }

  var slArr = lastH.sleepLog||[];
  var avgSleep = 0;
  if (slArr.length) { slArr.forEach(function(s){ avgSleep+=s.hrs||0; }); avgSleep=(avgSleep/slArr.length).toFixed(1); }

  var wArr = lastH.weights||[];
  var wDelta = '';
  if (wArr.length >= 2) { wDelta = (wArr[0].val - wArr[wArr.length-1].val).toFixed(1); }
  else if (wArr.length === 1 && S.weights.length) { wDelta = (wArr[0].val - S.weights[S.weights.length-1].val).toFixed(1); }

  var runLogs = lastH.runLogs || {};
  var runsDone = Object.keys(runLogs).filter(function(k){ return runLogs[k]&&runLogs[k].done; }).length;

  document.getElementById('sumGrid').innerHTML =
    sc('Sessions', done+'/'+Math.max(done+missed,5), sessColor, done>=4?'Great week':'Keep pushing') +
    sc('Runs', runsDone+'/2', runsDone>=2?'green':runsDone===1?'acc':'red', runsDone>=2?'Both done':'Missed some') +
    sc('Avg Calories', avgCal?avgCal+'kcal':'—', 'acc', avgCal?'Daily avg':'Not logged') +
    sc('Avg Sleep', avgSleep?avgSleep+'hrs':'—', parseFloat(avgSleep)>=7?'green':parseFloat(avgSleep)>=6?'acc':'red', slArr.length?slArr.length+' nights logged':'Not logged');

  var calAdh = avgCal ? Math.min(Math.round((avgCal/TARGETS.cal)*100),130) : 0;
  var protAdh = avgProt ? Math.min(Math.round((avgProt/TARGETS.protein)*100),130) : 0;
  document.getElementById('sumBars').innerHTML =
    (avgCal ? bar('Avg Cal adherence', calAdh, calAdh>=90&&calAdh<=110?'var(--green)':calAdh<80?'var(--red)':'var(--accent)') : '') +
    (avgProt ? bar('Protein adherence', protAdh, protAdh>=95?'var(--green)':protAdh<80?'var(--red)':'var(--orange)') : '') +
    (wDelta !== '' ? '<div class="fb sm" style="margin-top:6px"><span class="mut">Weight change last week</span><span class="'+(parseFloat(wDelta)<0?'green':'red')+'">'+( parseFloat(wDelta)<=0?'':'+' )+wDelta+'kg</span></div>' : '');
}

function sc(lbl, val, color, sub) {
  return '<div class="sc"><div class="sc-lbl">'+lbl+'</div><div class="sc-val '+color+'" style="font-size:20px">'+val+'</div><div class="sc-sub mut">'+sub+'</div></div>';
}

function bar(lbl, pct, color) {
  return '<div class="pb-wrap"><div class="pb-lbl"><span>'+lbl+'</span><span>'+pct+'%</span></div>'
    +'<div class="pb-track"><div class="pb-fill" style="width:'+Math.min(pct,100)+'%;background:'+color+'"></div></div></div>';
}

function updateWeekBadge() {
  var dow = realDow();
  var days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  var today = new Date();
  var dateStr = today.toLocaleDateString('en-GB',{day:'numeric',month:'short'});

  document.getElementById('wkBadge').textContent = 'WEEK '+S.week;
  document.getElementById('wkNum').textContent   = S.week;
  document.getElementById('aiWkNum').textContent = S.week;
  document.getElementById('dayLbl').textContent  = days[dow]+' · '+dateStr;

  var hasData = S.sessions.some(function(s){ return s!==null; }) || S.weights.length > 0;
  document.getElementById('alertRefeed').className = (dow===5 && hasData)?'alert al-yellow show':'alert al-yellow';
}

function nextDay() {
  if (!confirm('Manually advance to next week? This is normally automatic.')) return;
  if (!S.history) S.history = [];
  S.history.push({
    week:S.week, weekStartMonday:S.weekStartMonday,
    sessions:S.sessions.slice(), nutritionByDate:JSON.parse(JSON.stringify(S.nutritionByDate||{})),
    weights:S.weights.slice(0,3), sleepLog:(S.sleepLog||[]).slice(0,7),
    setLogs:JSON.parse(JSON.stringify(S.setLogs||{})),
    cyclingDays:(S.cyclingDays||[]).slice(), runLogs:JSON.parse(JSON.stringify(S.runLogs||{}))
  });
  if (S.history.length>24) S.history=S.history.slice(-24);
  var nextMon = new Date(S.weekStartMonday);
  nextMon.setDate(nextMon.getDate()+7);
  S.weekStartMonday = nextMon.getFullYear()+'-'+pad2(nextMon.getMonth()+1)+'-'+pad2(nextMon.getDate());
  S.week = weekNumFromMonday(S.weekStartMonday);
  S.sessions=[null,null,null,null,null];
  S.nutritionByDate={}; S.nutrition={cal:0,protein:0,carbs:0,fat:0};
  S.meals=[false,false,false,false,false];
  S.supps=[false,false,false,false,false];
  S.setLogs={}; S.runLogs={}; S.cyclingDays=[];
  save(); renderAll();
}

function confirmReset() {
  if (!confirm('Reset this week\'s sessions, nutrition and set data?')) return;
  S.sessions=[null,null,null,null,null];
  S.nutritionByDate={}; S.nutrition={cal:0,protein:0,carbs:0,fat:0};
  S.meals=[false,false,false,false,false];
  S.supps=[false,false,false,false,false];
  S.setLogs={}; S.runLogs={}; S.cyclingDays=[];
  save(); renderAll();
}

function confirmFullReset() {
  if (!confirm('⚠ Delete ALL local data?')) return;
  if (!confirm('Are you absolutely sure?')) return;
  S = freshState(); save(); renderAll();
}

// ══════════════════════════════════════
// ENTER KEY SUBMIT HANDLERS
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  function onEnter(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function(e){ if (e.key==='Enter') fn(); });
  }
  onEnter('wtIn', logWeight);
  onEnter('nCal',  logNutrition);
  onEnter('nProt', logNutrition);
  onEnter('nCarb', logNutrition);
  onEnter('nFat',  logNutrition);
  onEnter('sleepWake', logSleep);
});
