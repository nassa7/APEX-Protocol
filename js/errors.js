'use strict';

// ══════════════════════════════════════
// ERROR LOGGER — captures everything
// ══════════════════════════════════════
var ERRLOG_KEY = 'apex_errlog';
var MAX_ERRORS = 100;

function errLog(type, message, detail) {
  try {
    var logs = [];
    try { logs = JSON.parse(localStorage.getItem(ERRLOG_KEY) || '[]'); } catch(e) {}
    var entry = {
      t: new Date().toISOString(),
      type: type,
      msg: String(message).slice(0, 500),
      detail: detail ? String(detail).slice(0, 800) : ''
    };
    logs.unshift(entry);
    if (logs.length > MAX_ERRORS) logs = logs.slice(0, MAX_ERRORS);
    localStorage.setItem(ERRLOG_KEY, JSON.stringify(logs));
    renderErrLog();
  } catch(e) { /* silent — don't recurse */ }
}

// Intercept all unhandled JS errors
window.onerror = function(msg, src, line, col, err) {
  errLog('error', msg, (src?src.split('/').pop():'')+(line?':'+line:'')+(err&&err.stack?'\n'+err.stack.slice(0,400):''));
  return false;
};

// Intercept unhandled promise rejections
window.addEventListener('unhandledrejection', function(e) {
  var msg = e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled promise rejection';
  var stack = e.reason && e.reason.stack ? e.reason.stack.slice(0, 400) : '';
  errLog('promise', msg, stack);
});

// Override console.warn to also capture warnings
var _origWarn = console.warn;
console.warn = function() {
  var args = Array.prototype.slice.call(arguments);
  errLog('warn', args[0], args.slice(1).map(function(a){ return typeof a==='object'?JSON.stringify(a).slice(0,200):String(a); }).join(' '));
  _origWarn.apply(console, args);
};

// Override console.error to capture errors
var _origError = console.error;
console.error = function() {
  var args = Array.prototype.slice.call(arguments);
  errLog('error', args[0], args.slice(1).map(function(a){ return typeof a==='object'?JSON.stringify(a).slice(0,200):String(a); }).join(' '));
  _origError.apply(console, args);
};

function renderErrLog() {
  var el = document.getElementById('errLogList');
  var countEl = document.getElementById('errCount');
  if (!el) return;
  var logs = [];
  try { logs = JSON.parse(localStorage.getItem(ERRLOG_KEY) || '[]'); } catch(e) {}
  if (countEl) countEl.textContent = logs.length > 0 ? logs.length+' entries' : '';
  if (!logs.length) {
    el.innerHTML = '<div class="errlog-empty">✓ No errors logged</div>';
    return;
  }
  el.innerHTML = logs.map(function(e) {
    var typeClass = e.type==='error'?'t-error':e.type==='warn'?'t-warn':e.type==='promise'?'t-promise':'t-info';
    return '<div class="errlog-entry">'
      +'<div class="errlog-time">'+e.t+'</div>'
      +'<span class="errlog-type '+typeClass+'">'+e.type.toUpperCase()+'</span>'
      +'<div class="errlog-msg">'+escHtml(e.msg)+'</div>'
      +(e.detail?'<div class="errlog-stack">'+escHtml(e.detail)+'</div>':'')
      +'</div>';
  }).join('');
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function copyErrorLog() {
  var logs = [];
  try { logs = JSON.parse(localStorage.getItem(ERRLOG_KEY) || '[]'); } catch(e) {}
  if (!logs.length) { alert('No errors logged yet.'); return; }
  var text = '=== APEX ERROR LOG ===\nCopied: '+new Date().toISOString()+'\nURL: '+window.location.href+'\n\n'
    + logs.map(function(e,i){
        return '['+(i+1)+'] '+e.t+'\nTYPE: '+e.type+'\nMSG: '+e.msg+(e.detail?'\nDETAIL: '+e.detail:'')+'\n';
      }).join('\n---\n');
  navigator.clipboard.writeText(text).then(function(){
    alert('✓ Error log copied to clipboard. Paste it to share.');
  }).catch(function(){
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); alert('✓ Error log copied.'); }
    catch(e) { alert('Copy failed. Open browser console for details.'); }
    document.body.removeChild(ta);
  });
}

function clearErrorLog() {
  if (!confirm('Clear all error logs?')) return;
  localStorage.removeItem(ERRLOG_KEY);
  renderErrLog();
}

// Log app startup
errLog('info', 'APEX v5 boot — '+new Date().toISOString(), 'URL: '+window.location.href);
