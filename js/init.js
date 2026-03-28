'use strict';

// ══════════════════════════════════════
// MODALS
// ══════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.modal-overlay').forEach(function(o){
  o.addEventListener('click', function(e){ if(e.target===o) o.classList.remove('show'); });
});

// ══════════════════════════════════════
// RENDER ALL
// ══════════════════════════════════════
function renderAll() {
  buildRunSessions();
  buildSessions();
  buildMealChecklist();
  updateWeekGrid();
  updateRecovery();
  updateSessCount();
  updateNutritionUI();
  updateWeightUI();
  updateWeekBadge();
  updateSleepUI();
  updateHeatMap();
  updateWeeklySummary();
  restoreToggles();
  updateApiAlert();
  updateGoogleUI();
  updateSheetLink();
  renderErrLog();
  renderCharts();
  // Gamification renders
  if (typeof renderGradeCard   ==='function') renderGradeCard();
  if (typeof renderAchievements==='function') renderAchievements();
  if (typeof renderPBCard      ==='function') renderPBCard();
  if (typeof updateFocusCard   ==='function') updateFocusCard();
  if (typeof initNotifToggle   ==='function') initNotifToggle();
  if (typeof renderSparklines  ==='function') renderSparklines();
  var k = getApiKey();
  if (k) { document.getElementById('apiKeyIn').value=k; document.getElementById('apiStatus').textContent='✓ Key loaded'; document.getElementById('apiStatus').style.color='var(--green)'; }
  var cid = getClientId();
  if (cid) document.getElementById('clientIdIn').value = cid;
}

// ══════════════════════════════════════
// BOOT — always runs immediately
// ══════════════════════════════════════
(function(){
  // Check if we've crossed into a new week since last visit
  checkWeekRollover();

  // Render app immediately — nothing blocks this
  renderAll();

  var storedUser = localStorage.getItem('apex_guser');
  var skipped    = localStorage.getItem('apex_skipped');

  if (storedUser || skipped) {
    // Returning user — go straight in
    hideAuthScreen();
    if (typeof maybeShowCheckIn==='function') maybeShowCheckIn();
    if (typeof maybeShowRecap  ==='function') maybeShowRecap();
    if (storedUser) {
      var stored = getStoredToken();
      var exp = getTokenExp();
      if (stored && Date.now() < exp - 60000) {
        gToken = stored;
        try { gUser = JSON.parse(storedUser); } catch(e){}
        var sid = getSheetIdLS();
        if (sid) { gSheetId = sid; }
        updateGoogleUI();
        updateSyncBarState();
        findOrCreateSheet()
          .then(function(){ return pullAndMerge(); })
          .then(function(){ updateSyncBarState(); renderAll(); })
          .catch(function(e){ errLog('error','Boot sheet/pull failed',e.message); });
      } else {
        waitForSDK(trySilentRefresh);
      }
    }
  }

  // Set up a daily midnight check — if app is left open overnight, auto-rollover
  var msToMidnight = (function(){
    var n = new Date(), m = new Date(n.getFullYear(),n.getMonth(),n.getDate()+1,0,0,10);
    return m - n;
  })();
  setTimeout(function(){
    checkWeekRollover();
    renderAll();
    setInterval(function(){ checkWeekRollover(); renderAll(); }, 24*60*60*1000);
  }, msToMidnight);
})();
