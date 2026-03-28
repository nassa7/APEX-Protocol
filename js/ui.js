'use strict';

// ══════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════
var toastQueue = [];
function showToast(icon, title, sub, type, duration) {
  type = type || 'success'; duration = duration || 2500;
  var wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  var t = document.createElement('div');
  t.className = 'toast t-'+type;
  t.innerHTML = '<div class="toast-icon">'+icon+'</div>'
    +'<div class="toast-body"><div class="toast-title">'+title+'</div>'
    +(sub?'<div class="toast-sub">'+sub+'</div>':'')+'</div>';
  wrap.appendChild(t);
  if (navigator.vibrate) navigator.vibrate(30);
  setTimeout(function(){
    t.classList.add('removing');
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 280);
  }, duration);
}

// ══════════════════════════════════════
// SUBMIT LOCK — prevents double-tap
// ══════════════════════════════════════
var lockTimers = {};
function lockBtn(btnEl, ms) {
  if (!btnEl) return;
  ms = ms || 1800;
  btnEl.classList.add('btn-submitting');
  btnEl.disabled = true;
  var id = Math.random();
  lockTimers[id] = setTimeout(function(){
    btnEl.classList.remove('btn-submitting');
    btnEl.disabled = false;
    delete lockTimers[id];
  }, ms);
}

// ══════════════════════════════════════
// MEAL CHECKLIST — with macros & auto-log
// ══════════════════════════════════════
function buildMealChecklist() {
  var body = document.getElementById('mealChecklistBody');
  var totalRow = document.getElementById('mealTotalRow');
  if (!body) return;

  var meals = getMealsForToday();
  var tgt   = todayCalTarget();
  var dow   = realDow();
  var planLabel = dow===2 ? '🏃 Run day plan (Wed)' : dow===5 ? '🏃 Long run plan (Sat)' : 'Standard day plan';

  while (S.meals.length < meals.length) S.meals.push(false);

  body.innerHTML = meals.map(function(m, i){
    var checked = !!S.meals[i];
    return '<div class="tog-item">'
      +'<div class="tog-info">'
      +'<div class="tog-name">'+m.name+'</div>'
      +'<div class="tog-sub">'+m.desc+'</div>'
      +'<div class="meal-macros">'
      +'<span class="meal-chip kcal">'+m.cal+' kcal</span>'
      +'<span class="meal-chip prot">'+m.protein+'g P</span>'
      +'<span class="meal-chip carb">'+m.carbs+'g C</span>'
      +'<span class="meal-chip fat">'+m.fat+'g F</span>'
      +'</div>'
      +'</div>'
      +'<div class="tog'+(checked?' on':'')+'" id="meal-'+i+'" onclick="togMeal('+i+')"></div>'
      +'</div>';
  }).join('');

  if (totalRow) {
    var totCal  = meals.reduce(function(a,m){ return a+m.cal; }, 0);
    var totProt = meals.reduce(function(a,m){ return a+m.protein; }, 0);
    var totCarb = meals.reduce(function(a,m){ return a+m.carbs; }, 0);
    var totFat  = meals.reduce(function(a,m){ return a+m.fat; }, 0);
    var diff    = totCal - tgt.cal;
    var diffStr = diff === 0
      ? '<span class="green" style="font-size:9px;font-family:var(--fm)">✓ Hits daily target</span>'
      : '<span style="font-size:9px;font-family:var(--fm);color:var(--muted)">'+(diff>0?'+':'')+diff+' vs target</span>';
    totalRow.innerHTML =
      '<span class="mut">'+planLabel+'</span>'
      +'<span>'
      +'<span class="acc">'+totCal+' kcal</span>'
      +' · '+totProt+'g P · '+totCarb+'g C · '+totFat+'g F &nbsp;'+diffStr
      +'</span>';
  }
}

function togMeal(i) {
  var wasOn = S.meals[i];
  S.meals[i] = !wasOn;
  var meals = getMealsForToday();
  var m = meals[i];
  if (!m) return;
  var n = todayNutr();
  if (!wasOn) {
    n.cal     += m.cal;
    n.protein += m.protein;
    n.carbs   += m.carbs;
    n.fat     += m.fat;
    showToast('🍽️', m.name+' logged', '+'+m.cal+' kcal · +'+m.protein+'g protein', 'success');
  } else {
    n.cal     = Math.max(0, n.cal     - m.cal);
    n.protein = Math.max(0, n.protein - m.protein);
    n.carbs   = Math.max(0, n.carbs   - m.carbs);
    n.fat     = Math.max(0, n.fat     - m.fat);
    showToast('↩️', m.name+' removed', '-'+m.cal+' kcal', 'warn');
  }
  save();
  var el = document.getElementById('meal-'+i);
  if (el) el.classList.toggle('on', S.meals[i]);
  updateNutritionUI();
}

// ══════════════════════════════════════
// TABS / BOTTOM NAV
// ══════════════════════════════════════
var TAB_ORDER = ['dashboard','training','nutrition','sleep','coach','settings'];

function swTab(name, btn) {
  document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('on'); });
  document.querySelectorAll('.tab').forEach(function(b){ b.classList.remove('on'); });
  document.getElementById('panel-'+name).classList.add('on');
  if (btn) {
    btn.classList.add('on');
  } else {
    var b = document.querySelector('.tab[data-panel="'+name+'"]');
    if (b) b.classList.add('on');
  }
  // Close FAB if open
  if (typeof fabOpen !== 'undefined' && fabOpen) toggleFab();
  // Scroll to top
  window.scrollTo({top:0, behavior:'smooth'});
}

// ══════════════════════════════════════
// SWIPE NAVIGATION
// ══════════════════════════════════════
var _swipeX = 0, _swipeY = 0;
document.addEventListener('touchstart', function(e){
  _swipeX = e.touches[0].clientX;
  _swipeY = e.touches[0].clientY;
}, {passive:true});
document.addEventListener('touchend', function(e){
  var dx = e.changedTouches[0].clientX - _swipeX;
  var dy = e.changedTouches[0].clientY - _swipeY;
  if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.75) return;
  var cur = document.querySelector('.tab.on');
  if (!cur) return;
  var idx = TAB_ORDER.indexOf(cur.getAttribute('data-panel'));
  if (idx === -1) return;
  var next = dx < 0 ? Math.min(idx+1, TAB_ORDER.length-1) : Math.max(idx-1, 0);
  if (next === idx) return;
  swTab(TAB_ORDER[next], null);
}, {passive:true});

// ══════════════════════════════════════
// FLOATING ACTION BUTTON
// ══════════════════════════════════════
var fabOpen = false;

function toggleFab() {
  fabOpen = !fabOpen;
  var btn  = document.getElementById('fabBtn');
  var menu = document.getElementById('fabMenu');
  if (btn)  btn.classList.toggle('open', fabOpen);
  if (menu) menu.classList.toggle('open', fabOpen);
}

function fabQuickLog(type) {
  toggleFab();
  var dest = {weight:'dashboard', sleep:'sleep', nutrition:'nutrition', run:'training'}[type];
  var focus = {weight:'wtIn', sleep:'sleepBed', nutrition:'nCal', run:'runSessionList'}[type];
  if (dest) swTab(dest, null);
  setTimeout(function(){
    var el = document.getElementById(focus);
    if (el) {
      el.scrollIntoView({behavior:'smooth', block:'center'});
      if (el.tagName === 'INPUT') el.focus();
    }
  }, 350);
}
