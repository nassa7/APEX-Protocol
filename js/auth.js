'use strict';

// ══════════════════════════════════════
// GOOGLE AUTH & SYNC
// ══════════════════════════════════════
var gToken = null;
var gUser  = null;
var gSheetId = null;
var gFolderId = null;
var isOnline = navigator.onLine;
var syncQueue = [];
var pushDebounce = null;

window.addEventListener('online',  function(){ isOnline=true;  setSyncStatus('','Local mode'); processSyncQueue(); });
window.addEventListener('offline', function(){ isOnline=false; setSyncStatus('offline','Offline — queued'); });

function getClientId()  { return localStorage.getItem('apex_cid') || ''; }
function getStoredToken(){ return localStorage.getItem('apex_gt') || ''; }
function getTokenExp()  { return parseInt(localStorage.getItem('apex_gte') || '0'); }
function getSheetIdLS() { return localStorage.getItem('apex_sid') || ''; }
function getFolderIdLS(){ return localStorage.getItem('apex_fid') || ''; }

// Wire buttons once DOM is ready
document.getElementById('btnOffline').addEventListener('click', function(){ skipAuth(); });
document.getElementById('btnGoogleSignIn').addEventListener('click', function(){ handleSignInClick(); });
document.getElementById('btnGoogleSignIn2').addEventListener('click', function(){ handleSignInClick(); });

function skipAuth() {
  localStorage.setItem('apex_skipped','1');
  document.getElementById('authScreen').classList.add('hidden');
  setSyncStatus('','Local mode — data saved on this device only');
}

function hideAuthScreen() {
  document.getElementById('authScreen').classList.add('hidden');
}

function showAuthErr(msg) {
  var el = document.getElementById('authErr');
  el.textContent = msg;
  el.classList.add('show');
}

function handleSignInClick() {
  document.getElementById('authErr').classList.remove('show');
  var cid = getClientId();
  if (!cid) {
    showAuthErr('No Client ID saved. Go to Settings → Google Sheets Setup, complete the guide, paste your Client ID, then try again.');
    return;
  }
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
    showAuthErr('Google SDK is still loading. Wait 3 seconds and try again.');
    return;
  }
  doGoogleSignIn();
}

function doGoogleSignIn() {
  var cid = getClientId();
  if (!cid) return;
  try {
    var tc = google.accounts.oauth2.initTokenClient({
      client_id: cid,
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file profile email',
      callback: onTokenReceived,
      error_callback: function(err) {
        showAuthErr('Sign-in failed: ' + (err.message || err.type || 'Make sure your site URL is in Authorised JavaScript Origins in Google Cloud Console.'));
      }
    });
    tc.requestAccessToken({prompt:'consent'});
  } catch(e) {
    showAuthErr('Error: ' + e.message);
  }
}

function trySilentRefresh() {
  var cid = getClientId();
  if (!cid) return;
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) return;
  var hadSession = !!localStorage.getItem('apex_guser');
  if (!hadSession) return;
  try {
    var tc = google.accounts.oauth2.initTokenClient({
      client_id: cid,
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file profile email',
      prompt: '',
      callback: onTokenReceived,
      error_callback: function(){ setSyncStatus('','Session expired — sign in again in Settings'); }
    });
    tc.requestAccessToken({prompt:''});
  } catch(e) {}
}

function onTokenReceived(resp) {
  if (resp.error) { errLog('error','Auth token error',resp.error); showAuthErr('Auth error: ' + resp.error); return; }
  gToken = resp.access_token;
  var exp = Date.now() + (resp.expires_in - 60) * 1000;
  localStorage.setItem('apex_gt', gToken);
  localStorage.setItem('apex_gte', String(exp));
  errLog('info','Auth token received — fetching user profile','expires_in: '+resp.expires_in);

  fetch('https://www.googleapis.com/oauth2/v3/userinfo', {headers:{Authorization:'Bearer '+gToken}})
    .then(function(r){ return r.json(); })
    .then(function(u){
      gUser = {name:u.name, email:u.email, picture:u.picture};
      localStorage.setItem('apex_guser', JSON.stringify(gUser));
      errLog('info','User profile fetched',u.email||'no email');
      onSignedIn();
    })
    .catch(function(e){ errLog('warn','User profile fetch failed — continuing without profile',e.message||''); onSignedIn(); });
}

function onSignedIn() {
  errLog('info','onSignedIn called','gUser: '+(gUser?gUser.email:'none')+' gSheetId: '+(gSheetId||'none'));
  updateGoogleUI();
  hideAuthScreen();
  var sid = getSheetIdLS();
  if (sid) { gSheetId = sid; errLog('info','Restored sheet ID from localStorage',sid); }
  findOrCreateSheet()
    .then(function(){
      errLog('info','findOrCreateSheet complete','gSheetId: '+(gSheetId||'MISSING'));
      return ensureSheetTabs();
    })
    .then(function(){ return pullAndMerge(); })
    .then(function(){ updateSyncBarState(); })
    .catch(function(e){ errLog('error','onSignedIn sheet/pull chain failed',e.message); });
}

function initGoogleFromStorage() {
  var stored = getStoredToken();
  var exp = getTokenExp();
  if (stored && Date.now() < exp - 60000) {
    gToken = stored;
    try { gUser = JSON.parse(localStorage.getItem('apex_guser')); } catch(e){}
    var sid = getSheetIdLS();
    if (sid) gSheetId = sid;
    onSignedIn();
    return;
  }
  waitForSDK(trySilentRefresh);
}

function waitForSDK(cb, tries) {
  tries = tries || 0;
  if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
    cb();
  } else if (tries < 15) {
    setTimeout(function(){ waitForSDK(cb, tries+1); }, 400);
  }
}

function updateGoogleUI() {
  var si = document.getElementById('gSignedIn');
  var so = document.getElementById('gSignedOut');
  var signedIn = !!(gToken && gUser);
  if (si) { si.style.cssText = signedIn ? 'display:block' : 'display:none!important'; }
  if (so) { so.style.cssText = signedIn ? 'display:none!important' : 'display:block'; }
  if (signedIn && gUser) {
    var nm = document.getElementById('gUserName');
    var em = document.getElementById('gUserEmail');
    var av = document.getElementById('gAvatar');
    var su = document.getElementById('syncUser');
    if (nm) nm.textContent = gUser.name || '';
    if (em) em.textContent = gUser.email || '';
    if (av && gUser.picture) av.innerHTML = '<img src="'+gUser.picture+'" width="36" height="36" style="border-radius:50%">';
    if (su) su.textContent = gUser.email || '';
    updateSheetLink();
  }
}

function setSyncStatus(state, label) {
  var bar = document.getElementById('syncBar');
  var lbl = document.getElementById('syncLbl');
  if (!bar || !lbl) return;
  bar.className = 'sync-bar' + (state ? ' '+state : '');
  lbl.textContent = label;
}

function updateSyncBarState() {
  if (!gToken) { setSyncStatus('','Local mode'); return; }
  if (!isOnline) { setSyncStatus('offline','Offline — queued'); return; }
  setSyncStatus('synced','Synced · '+(gUser&&gUser.email ? gUser.email : ''));
}

function saveClientId() {
  var v = document.getElementById('clientIdIn').value.trim();
  var st = document.getElementById('clientIdStatus');
  if (!v) { st.textContent='Enter a Client ID first.'; st.style.color='var(--red)'; return; }
  if (!v.includes('apps.googleusercontent.com')) { st.textContent='Should end in .apps.googleusercontent.com'; st.style.color='var(--orange)'; return; }
  localStorage.setItem('apex_cid', v);
  st.textContent = '✓ Saved. Use the Sign In button above.';
  st.style.color = 'var(--green)';
}

function promptSignOut() {
  if (!gUser) return;
  if (!confirm('Sign out of ' + gUser.email + '?')) return;
  if (typeof google !== 'undefined' && gToken) { try { google.accounts.oauth2.revoke(gToken, function(){}); } catch(e){} }
  gToken=null; gUser=null; gSheetId=null;
  ['apex_gt','apex_gte','apex_guser','apex_sid','apex_skipped','apex_drive_disabled'].forEach(function(k){ localStorage.removeItem(k); });
  updateGoogleUI();
  setSyncStatus('','Local mode');
  document.getElementById('authScreen').classList.remove('hidden');
}

function openSheet() {
  if (gSheetId) {
    window.open('https://docs.google.com/spreadsheets/d/'+gSheetId, '_blank');
  } else {
    alert('Sheet not ready yet. Wait a few seconds after signing in and try again.');
  }
}

function updateSheetLink() {
  var el = document.getElementById('sheetLinkEl');
  if (!el) return;
  if (gSheetId) {
    el.textContent = 'View your data sheet →';
    el.style.opacity = '1';
    el.style.cursor = 'pointer';
  } else {
    el.textContent = 'Creating sheet…';
    el.style.opacity = '0.5';
    el.style.cursor = 'default';
  }
}

function findOrCreateSheet() {
  if (gSheetId) { updateSheetLink(); return Promise.resolve(); }
  var fid = getFolderIdLS();
  if (fid) gFolderId = fid;
  if (localStorage.getItem('apex_drive_disabled')) {
    return createSheetDirectly();
  }
  return gFetch(
    'https://www.googleapis.com/drive/v3/files' +
    '?q=name%3D%27'+encodeURIComponent(FOLDER_NAME)+'%27' +
    '+and+mimeType%3D%27application%2Fvnd.google-apps.folder%27' +
    '+and+trashed%3Dfalse&fields=files(id)'
  )
  .then(function(r){
    if (r.files && r.files.length > 0) {
      gFolderId = r.files[0].id;
      localStorage.setItem('apex_fid', gFolderId);
      errLog('info','Found Drive folder',gFolderId);
    } else {
      return gFetch('https://www.googleapis.com/drive/v3/files', {
        method:'POST',
        body:JSON.stringify({name:FOLDER_NAME, mimeType:'application/vnd.google-apps.folder'})
      }).then(function(r){
        gFolderId = r.id;
        localStorage.setItem('apex_fid', gFolderId);
        errLog('info','Created Drive folder',gFolderId);
      });
    }
  })
  .then(function(){ return findOrCreateSheetInFolder(); })
  .catch(function(e){
    errLog('warn','Drive API unavailable — sheet will be created in root Drive.',e.message);
    localStorage.setItem('apex_drive_disabled','1');
    gFolderId = null;
    return createSheetDirectly();
  });
}

function findOrCreateSheetInFolder() {
  var q = 'name%3D%27'+encodeURIComponent(SHEET_NAME)+'%27' +
          '+and+mimeType%3D%27application%2Fvnd.google-apps.spreadsheet%27' +
          '+and+trashed%3Dfalse';
  if (gFolderId) q += '+and+%27'+gFolderId+'%27+in+parents';
  return gFetch('https://www.googleapis.com/drive/v3/files?q='+q+'&fields=files(id)')
    .then(function(r){
      if (r.files && r.files.length > 0) {
        gSheetId = r.files[0].id;
        localStorage.setItem('apex_sid', gSheetId);
        errLog('info','Found existing sheet',gSheetId);
        updateSheetLink();
        return;
      }
      return createSheetDirectly().then(function(){
        if (gFolderId && gSheetId) {
          return gFetch(
            'https://www.googleapis.com/drive/v3/files/'+gSheetId+
            '?addParents='+gFolderId+'&fields=id',
            {method:'PATCH', body:JSON.stringify({})}
          ).then(function(){
            errLog('info','Sheet moved into folder',gFolderId);
          }).catch(function(e){
            errLog('warn','Could not move sheet into folder',e.message);
          });
        }
      });
    })
    .catch(function(e){
      errLog('warn','Drive search failed — falling back to direct sheet creation',e.message);
      return createSheetDirectly();
    });
}

function createSheetDirectly() {
  var existingId = getSheetIdLS();
  if (existingId) {
    gSheetId = existingId;
    updateSheetLink();
    errLog('info','Restored sheet ID from storage',existingId);
    return Promise.resolve();
  }
  errLog('info','Creating new sheet via Sheets API (no Drive required)','');
  return gFetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method:'POST',
    body:JSON.stringify({
      properties:{title:SHEET_NAME},
      sheets:[
        {properties:{title:'State'}},
        {properties:{title:'WeightLog'}},
        {properties:{title:'SleepLog'}},
        {properties:{title:'NutritionLog'}},
        {properties:{title:'RunLog'}},
        {properties:{title:'History'}}
      ]
    })
  }).then(function(r){
    gSheetId = r.spreadsheetId;
    localStorage.setItem('apex_sid', gSheetId);
    localStorage.removeItem('apex_drive_disabled');
    errLog('info','Sheet created via Sheets API',gSheetId);
    updateSheetLink();
  }).catch(function(e){
    errLog('error','Sheet creation failed completely',e.message);
  });
}

function gFetch(url, opts) {
  opts = opts || {};
  var token = gToken || getStoredToken();
  if (!token) { errLog('error','gFetch called with no token',url.slice(0,80)); return Promise.reject(new Error('No token')); }
  return fetch(url, Object.assign({}, opts, {
    headers: Object.assign({'Authorization':'Bearer '+token,'Content-Type':'application/json'}, opts.headers||{})
  })).then(function(r){
    if (r.status === 401) { errLog('warn','gFetch 401 — token expired',url.slice(0,80)); gToken=null; localStorage.removeItem('apex_gt'); updateGoogleUI(); setSyncStatus('error','Session expired'); }
    if (!r.ok) return r.json().then(function(e){ var msg=e.error&&e.error.message||'HTTP '+r.status; errLog('error','gFetch HTTP error',url.slice(0,80)+' → '+msg); throw new Error(msg); });
    return r.json();
  });
}

function pullAndMerge() {
  if (!gSheetId || !gToken) return Promise.resolve();
  setSyncStatus('syncing','Pulling from Sheets...');
  return gFetch('https://sheets.googleapis.com/v4/spreadsheets/'+gSheetId+'/values/State!A2:B2')
    .then(function(r){
      if (r.values && r.values[0] && r.values[0][1]) {
        try {
          var sheetS = JSON.parse(r.values[0][1]);
          var localMod = new Date(S.lastModified||0).getTime();
          var sheetMod = new Date(sheetS.lastModified||0).getTime();
          S = mergeStates(sheetMod > localMod ? sheetS : S, sheetMod > localMod ? S : sheetS);
          save();
        } catch(e){}
      }
      setSyncStatus('synced','Synced · '+(gUser&&gUser.email||''));
      renderAll();
    }).catch(function(e){ errLog('error','pullAndMerge failed',e.message); setSyncStatus('error','Sync error — data saved locally'); });
}

function mergeStates(primary, secondary) {
  var m = JSON.parse(JSON.stringify(primary));
  var wDates = new Set((primary.weights||[]).map(function(w){ return w.date; }));
  var extraW = (secondary.weights||[]).filter(function(w){ return !wDates.has(w.date); });
  m.weights = (primary.weights||[]).concat(extraW).sort(function(a,b){ return new Date(b.date)-new Date(a.date); }).slice(0,60);
  var sDates = new Set((primary.sleepLog||[]).map(function(s){ return s.date; }));
  var extraSl = (secondary.sleepLog||[]).filter(function(s){ return !sDates.has(s.date); });
  m.sleepLog = (primary.sleepLog||[]).concat(extraSl).sort(function(a,b){ return new Date(b.date)-new Date(a.date); }).slice(0,60);
  var hWeeks = new Set((primary.history||[]).map(function(h){ return h.week; }));
  var extraH = (secondary.history||[]).filter(function(h){ return !hWeeks.has(h.week); });
  m.history = (primary.history||[]).concat(extraH).sort(function(a,b){ return a.week-b.week; }).slice(-24);
  return m;
}

function schedulePush() {
  if (!gToken || !gSheetId) return;
  clearTimeout(pushDebounce);
  pushDebounce = setTimeout(pushToSheet, 2000);
}

var REQUIRED_TABS = ['State','WeightLog','SleepLog','NutritionLog','RunLog','History'];

var TAB_HEADERS = {
  'State':        [['Last Modified',   'Full State JSON']],
  'WeightLog':    [['Date',            'Weight (kg)',     'Logged At']],
  'SleepLog':     [['Date',            'Bedtime',         'Wake Time',       'Hours',          'Quality']],
  'NutritionLog': [['Date',            'Calories (kcal)', 'Protein (g)',     'Carbs (g)',      'Fat (g)',       'Week Start']],
  'RunLog':       [['Day',             'Run Type',        'Completed',       'Distance (km)', 'Time (min)',    'Week Start', 'Week Number']],
  'History':      [['Week Number',     'Week Start',      'Sessions Done',   'Avg Calories',  'Avg Sleep (hrs)', 'Full JSON']]
};

function ensureSheetTabs() {
  if (!gSheetId || !gToken) return Promise.resolve();
  return gFetch('https://sheets.googleapis.com/v4/spreadsheets/'+gSheetId+'?fields=sheets.properties')
    .then(function(r){
      var sheets   = r.sheets || [];
      var existing = sheets.map(function(s){ return s.properties.title; });
      var missing  = REQUIRED_TABS.filter(function(t){ return existing.indexOf(t) === -1; });
      var p = Promise.resolve();
      if (missing.length) {
        errLog('info','Adding missing tabs', missing.join(', '));
        var addReqs = missing.map(function(title){
          return { addSheet:{ properties:{ title:title } } };
        });
        p = p.then(function(){
          return gFetch('https://sheets.googleapis.com/v4/spreadsheets/'+gSheetId+':batchUpdate',{
            method:'POST', body:JSON.stringify({ requests:addReqs })
          });
        }).then(function(res){
          if (res && res.replies) {
            res.replies.forEach(function(reply){
              if (reply.addSheet) sheets.push(reply.addSheet.sheet);
            });
          }
          errLog('info','Tabs created', missing.join(', '));
        });
      }
      p = p.then(function(){
        var headerData = REQUIRED_TABS.map(function(tab){
          var hdrs = TAB_HEADERS[tab] || [['Data']];
          var cols = hdrs[0].length;
          var endCol = String.fromCharCode(64 + cols);
          return { range: tab+'!A1:'+endCol+'1', values: hdrs };
        });
        return gFetch('https://sheets.googleapis.com/v4/spreadsheets/'+gSheetId+'/values:batchUpdate',{
          method:'POST', body:JSON.stringify({ valueInputOption:'RAW', data:headerData })
        }).then(function(){ errLog('info','Headers written to all tabs',''); });
      });
      p = p.then(function(){
        return gFetch('https://sheets.googleapis.com/v4/spreadsheets/'+gSheetId+'?fields=sheets.properties')
          .then(function(r2){
            var formatReqs = (r2.sheets||[]).map(function(sh){
              return {
                repeatCell:{
                  range:{ sheetId:sh.properties.sheetId, startRowIndex:0, endRowIndex:1 },
                  cell:{
                    userEnteredFormat:{
                      backgroundColor:{ red:0.05, green:0.05, blue:0.09 },
                      textFormat:{ bold:true, foregroundColor:{ red:0.96, green:0.65, blue:0.14 } }
                    }
                  },
                  fields:'userEnteredFormat(backgroundColor,textFormat)'
                }
              };
            });
            if (!formatReqs.length) return;
            return gFetch('https://sheets.googleapis.com/v4/spreadsheets/'+gSheetId+':batchUpdate',{
              method:'POST', body:JSON.stringify({ requests:formatReqs })
            }).then(function(){ errLog('info','Header formatting applied',''); });
          });
      }).catch(function(e){ errLog('warn','Header formatting failed — non-critical',e.message); });
      return p;
    })
    .catch(function(e){ errLog('warn','ensureSheetTabs failed',e.message); });
}

function buildPushData() {
  var stateRow = [[S.lastModified, JSON.stringify(S)]];
  var wRows = (S.weights||[]).map(function(w){
    return [w.date||'', Number(w.val)||0, new Date().toISOString()];
  });
  var slRows = (S.sleepLog||[]).map(function(s){
    return [s.date||'', s.bed||'', s.wake||'', Number(s.hrs)||0, s.quality||''];
  });
  var nutrRows = Object.keys(S.nutritionByDate||{})
    .sort()
    .map(function(date){
      var n = S.nutritionByDate[date] || {};
      return [
        date,
        Math.round(Number(n.cal)    || 0),
        Math.round(Number(n.protein)|| 0),
        Math.round(Number(n.carbs)  || 0),
        Math.round(Number(n.fat)    || 0),
        S.weekStartMonday || ''
      ];
    });
  var runRows = [];
  var DOW_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  Object.keys(S.runLogs||{}).forEach(function(dow){
    var r = S.runLogs[dow];
    if (r) runRows.push([
      DOW_NAMES[parseInt(dow)] || dow,
      r.type || '',
      r.done ? 'Yes' : 'No',
      Number(r.distance) || '',
      Number(r.time)     || '',
      S.weekStartMonday  || '',
      S.week             || ''
    ]);
  });
  var hRows = (S.history||[]).map(function(h){
    var sessArr = h.sessions||[];
    var done    = sessArr.filter(function(s){ return s==='done'; }).length;
    var nutrD   = Object.keys(h.nutritionByDate||{});
    var avgCal  = 0;
    nutrD.forEach(function(d){ avgCal += (h.nutritionByDate[d].cal||0); });
    if (nutrD.length) avgCal = Math.round(avgCal / nutrD.length);
    var slArr  = h.sleepLog||[];
    var avgSlp = 0;
    slArr.forEach(function(s){ avgSlp += (s.hrs||0); });
    if (slArr.length) avgSlp = (avgSlp/slArr.length).toFixed(1);
    return [h.week||'', h.weekStartMonday||'', done+'/5', avgCal||'', avgSlp||'', JSON.stringify(h)];
  });
  var data = [{range:'State!A2:B2', values:stateRow}];
  if (wRows.length)    data.push({range:'WeightLog!A2:C'    +(1+wRows.length),    values:wRows});
  if (slRows.length)   data.push({range:'SleepLog!A2:E'     +(1+slRows.length),   values:slRows});
  if (nutrRows.length) data.push({range:'NutritionLog!A2:F' +(1+nutrRows.length), values:nutrRows});
  if (runRows.length)  data.push({range:'RunLog!A2:G'       +(1+runRows.length),  values:runRows});
  if (hRows.length)    data.push({range:'History!A2:F'      +(1+hRows.length),    values:hRows});
  return {data:data, counts:{w:wRows.length, sl:slRows.length, n:nutrRows.length, r:runRows.length, h:hRows.length}};
}

function pushToSheet(isRetry) {
  if (!gToken || !gSheetId) return;
  if (!isOnline) { syncQueue.push(1); setSyncStatus('offline','Offline — queued'); return; }
  setSyncStatus('syncing','Saving...');
  var payload = buildPushData();
  gFetch('https://sheets.googleapis.com/v4/spreadsheets/'+gSheetId+'/values:batchUpdate', {
    method:'POST', body:JSON.stringify({valueInputOption:'RAW', data:payload.data})
  }).then(function(){
    setSyncStatus('synced','Synced · '+(gUser&&gUser.email||''));
    syncQueue=[];
    errLog('info','Sync OK','w='+payload.counts.w+' sl='+payload.counts.sl+' h='+payload.counts.h+' n='+payload.counts.n);
  }).catch(function(e){
    var msg = e.message || '';
    if (!isRetry && (msg.indexOf('Unable to parse range') !== -1 || msg.indexOf('parse range') !== -1)) {
      errLog('warn','Missing sheet tab detected — auto-creating and retrying',msg);
      setSyncStatus('syncing','Creating missing sheet tabs...');
      ensureSheetTabs().then(function(){
        setTimeout(function(){ pushToSheet(true); }, 1500);
      });
    } else {
      errLog('error','pushToSheet failed'+(isRetry?' (after tab fix)':''),msg);
      setSyncStatus('error','Sync error — will retry');
      setTimeout(function(){ pushToSheet(false); }, 30000);
    }
  });
}

function processSyncQueue() { if (syncQueue.length && gToken && gSheetId) { syncQueue=[]; pushToSheet(); } }
function forceSyncNow() { pullAndMerge().then(function(){ return pushToSheet(); }); }
