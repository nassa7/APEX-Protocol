'use strict';

// ══════════════════════════════════════
// API KEY & AI ANALYSIS
// ══════════════════════════════════════
function getApiKey() { return localStorage.getItem('apex_apikey') || ''; }

function saveApiKey() {
  var v = document.getElementById('apiKeyIn').value.trim();
  var st = document.getElementById('apiStatus');
  if (!v) { st.textContent='Enter key first.'; st.style.color='var(--red)'; return; }
  if (!v.startsWith('sk-ant-')) { st.textContent='Should start with sk-ant-'; st.style.color='var(--orange)'; return; }
  localStorage.setItem('apex_apikey', v);
  st.textContent = '✓ Saved'; st.style.color = 'var(--green)';
  document.getElementById('alertApiKey').className = 'alert al-blue';
}

function updateApiAlert() {
  document.getElementById('alertApiKey').className = getApiKey() ? 'alert al-blue' : 'alert al-blue show';
}

function openWeeklyAI() {
  var resp = document.getElementById('aiResp');
  resp.className = 'ai-resp';
  resp.textContent = S.lastAI || 'Tap the button below to run your weekly analysis...';
  document.getElementById('aiBtn').textContent = S.lastAI ? '▶ RE-RUN ANALYSIS' : '▶ RUN ANALYSIS';
  openModal('modalAI');
}

function runAI() {
  var apiKey = getApiKey();
  if (!apiKey) { document.getElementById('aiResp').textContent = '⚠ No API key. Add it in Settings.'; return; }
  var data = buildExport();
  var btn = document.getElementById('aiBtn');
  var resp = document.getElementById('aiResp');
  btn.disabled = true; btn.textContent = '⏳ ANALYSING...';
  resp.className = 'ai-resp loading'; resp.textContent = 'Sending data to Claude...';
  var sys = 'You are the Apex Performance Coach — Dr. Mike Israetel (RP hypertrophy) + Dr. Layne Norton (nutrition) + Dr. Matthew Walker (sleep).\n\nHassan: 29yo male, 84kg, 185cm, ~17% BF, bilateral rotator cuff weakness, right ankle sprain. Goal: hypertrophy + sub-10% BF in 6 months. Split: Push/Pull/Legs/Upper/Arms+Core 5x/week, 7pm evenings. Target sleep: 11pm–6:45am (7h45m). Office worker, cycles ~1–2x/week. Mediterranean diet, no fish, GI sensitive to FODMAPs/carbonation.\n\nAnalyse the JSON and give:\n1. TRAINING VERDICT\n2. NUTRITION VERDICT\n3. SLEEP VERDICT\n4. BIOMETRIC TREND\n5. NEXT WEEK ADJUSTMENTS (specific numbered changes)\n6. ONE PRIORITY\n\nDirect. No fluff. Under 400 words.';
  fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,system:sys,messages:[{role:'user',content:'Week '+data.meta.week+' data:\n\n'+JSON.stringify(data,null,2)}]})
  }).then(function(r){ return r.json(); })
    .then(function(d){
      var text = (d.content && d.content.find(function(b){ return b.type==='text'; })) ? d.content.find(function(b){ return b.type==='text'; }).text : (d.error ? '⚠ '+d.error.message : 'No response.');
      resp.className='ai-resp'; resp.textContent=text; S.lastAI=text; save();
    }).catch(function(e){
      resp.className='ai-resp'; resp.textContent='⚠ Error: '+e.message;
    }).finally(function(){
      btn.disabled=false; btn.textContent='▶ RUN ANALYSIS AGAIN';
    });
}
