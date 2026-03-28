'use strict';

// ══════════════════════════════════════
// EXPORT / IMPORT
// ══════════════════════════════════════
function buildExport() {
  var avgSleep = null;
  if (S.sleepLog && S.sleepLog.length) {
    var sl = S.sleepLog.slice(0,7);
    avgSleep = (sl.reduce(function(a,e){ return a+e.hrs; },0)/sl.length).toFixed(2);
  }
  return {
    meta:{user:'Hassan',exportDate:new Date().toISOString(),week:S.week,day:realDow()+1},
    training:{
      completionRate:Math.round((S.sessions.filter(function(s){ return s==='done'; }).length/5)*100)+'%',
      completed:S.sessions.filter(function(s){ return s==='done'; }).length,
      missed:S.sessions.filter(function(s){ return s==='missed'; }).length,
      deloadRequired:S.sessions.filter(function(s){ return s==='missed'; }).length>=3,
      cyclingDays:(S.cyclingDays||[]).length,
      sessions:SESSIONS_DEF.map(function(sess,si){
        return {session:sess.name, status:S.sessions[si], exercises:sess.exercises.map(function(ex,ei){
          var k=si+'_'+ei, sets=S.setLogs[k]||[];
          var logged=sets.filter(function(s){ return s.done; });
          return {name:ex.name, prescribed:ex.sets+'@RPE'+ex.rpe,
            topWeight:logged.length?Math.max.apply(null,logged.map(function(s){ return parseFloat(s.kg)||0; })):null,
            totalVolume:Math.round(logged.reduce(function(a,s){ return a+((parseFloat(s.kg)||0)*(parseInt(s.reps)||0)); },0)),
            setsCompleted:logged.length+'/'+sets.length,
            sets:sets.map(function(s,i){ return {set:i+1,kg:s.kg,reps:s.reps,logged:s.done}; })};
        })};
      })
    },
    nutrition:{totalCalories:Math.round(S.nutrition.cal),protein_g:Math.round(S.nutrition.protein),
      carbs_g:Math.round(S.nutrition.carbs),fat_g:Math.round(S.nutrition.fat),targets:TARGETS,
      proteinAdherence:Math.round((S.nutrition.protein/TARGETS.protein)*100)+'%',
      calorieAdherence:Math.round((S.nutrition.cal/TARGETS.cal)*100)+'%'},
    sleep:{avgLast7Nights_hrs:avgSleep,targetNightly_hrs:SLEEP_TARGET,
      weeklyDebt_hrs:avgSleep?Math.max(0,(SLEEP_TARGET-parseFloat(avgSleep))*7).toFixed(1):null,
      log:(S.sleepLog||[]).slice(0,7)},
    biometrics:(function(){
      var startW = S.weights.length ? S.weights[S.weights.length-1].val : null;
      return {latestWeight_kg:S.weights[0]?S.weights[0].val:null,startWeight_kg:startW,
        totalChange_kg:(S.weights[0]&&startW)?(S.weights[0].val-startW).toFixed(1):'0',weightLog:S.weights.slice(0,7)};
    })(),
    history:(S.history||[]).slice(-4)
  };
}

function openExport() {
  document.getElementById('expCode').textContent = JSON.stringify(buildExport(), null, 2);
  openModal('modalExport');
}

function copyExport() {
  navigator.clipboard.writeText(document.getElementById('expCode').textContent).then(function(){
    var btn = document.getElementById('copyBtn');
    btn.textContent = '✓ Copied!';
    setTimeout(function(){ btn.textContent='Copy JSON'; }, 2000);
  });
}

function openImport() {
  document.getElementById('importText').value = '';
  document.getElementById('importStatus').textContent = '';
  openModal('modalImport');
}

function doImport() {
  var raw = document.getElementById('importText').value.trim();
  var st = document.getElementById('importStatus');
  if (!raw) { st.textContent='Paste JSON first.'; return; }
  try {
    var imp = JSON.parse(raw);
    S = mergeStates(S, imp);
    S.lastModified = new Date().toISOString();
    save(); renderAll();
    st.textContent = '✓ Merged successfully.';
    st.style.color = 'var(--green)';
  } catch(e) {
    st.textContent = '⚠ Invalid JSON: ' + e.message;
    st.style.color = 'var(--red)';
  }
}
