'use strict';

// ══════════════════════════════════════
// AI COACH — APEX PERFORMANCE SYSTEM
// ══════════════════════════════════════

var _coachPending = null; // pending proposed change awaiting user confirmation

// ── Session resolution ──────────────────────────────────────────────────────
// Returns the active session definitions in priority order:
// weekOverrides → customSessions → SESSIONS_DEF (defaults)
function getActiveSessions() {
  var result = [];
  for (var i = 0; i < SESSIONS_DEF.length; i++) {
    var override = S.weekOverrides && S.weekOverrides[i];
    var custom   = S.customSessions && S.customSessions[i];
    result.push(override || custom || SESSIONS_DEF[i]);
  }
  return result;
}

function getActiveSession(si) {
  if (S.weekOverrides && S.weekOverrides[si]) return S.weekOverrides[si];
  if (S.customSessions && S.customSessions[si]) return S.customSessions[si];
  return SESSIONS_DEF[si];
}

// ── System prompt ─────────────────────────────────────────────────────────
function buildCoachSystemPrompt() {
  return 'You are APEX Coach — an elite personal trainer and performance scientist combining:\n'
    + '• Hypertrophy science: Dr. Mike Israetel (RP methodology — MEV, MAV, MRV, SFR, RIR/RPE autoregulation, muscle-specific volume landmarks)\n'
    + '• Strength programming: periodisation, deload protocols, frequency and intensity management\n'
    + '• Nutrition: Dr. Layne Norton (TDEE, protein synthesis, meal timing, body recomposition, deficit/surplus strategy)\n'
    + '• Sleep & recovery: Dr. Matthew Walker (sleep debt, cortisol, adaptation windows, HRV)\n'
    + '• Injury management: prehab/rehab protocols, exercise substitutions around weaknesses\n\n'
    + 'ATHLETE PROFILE — Hassan:\n'
    + '• Age: 29 | Male | ~84kg | 185cm | ~17% BF\n'
    + '• Goal: Hypertrophy + reach sub-10% BF within 6 months\n'
    + '• Injuries: Bilateral rotator cuff weakness (avoid behind-neck press, wide-grip upright rows, behind-neck pulldowns). Right ankle sprain history (use seated alternatives if flare-up).\n'
    + '• Split: Push / Pull / Legs / Upper / Arms+Core — Mon–Fri, 7pm evening sessions\n'
    + '• Running: Wed lunchtime 5km easy (Zone 2) + Sat morning 10–15km long run (Zone 2 → Zone 3 final 2km)\n'
    + '• Sleep target: 11pm–6:45am (7h45m weekdays). Sleep debt is tracked in the app.\n'
    + '• Diet: Mediterranean, no fish, GI-sensitive (FODMAPs, carbonation). Lactose-free dairy preferred.\n'
    + '• Calories: 2,400 standard | 2,700 Wed run+gym | 2,900 Sat long run\n'
    + '• Protein target: 210g/day. Supplements: Creatine 5g, Vit D3+K2, Omega-3, Magnesium Glycinate 400mg, Whey if short.\n'
    + '• Activity: Office worker. Cycles 1–2x/week (+150 kcal days).\n\n'
    + 'SESSION INDEX REFERENCE:\n'
    + '  0 = Push (Monday) — Chest, Shoulders, Triceps\n'
    + '  1 = Pull (Tuesday) — Back, Biceps, Rear Delts\n'
    + '  2 = Legs (Wednesday) — Quads, Hamstrings, Calves + short run at lunch\n'
    + '  3 = Upper (Thursday) — Strength focus\n'
    + '  4 = Arms + Core (Friday) — Biceps, Triceps, Abs\n\n'
    + 'SETS FORMAT: Use "N×min–max" (e.g. "4×8–10") or "N×N" for fixed reps. RPE scale 6–10. Rest in seconds.\n'
    + 'TEMPO FORMAT: eccentric–pause–concentric–stretch seconds. Use "X" for explosive. E.g. "3-1-X-0".\n'
    + 'VALID MUSCLES: chest, back, shoulders, biceps, triceps, quads, hamstrings, core\n\n'
    + 'BEHAVIOUR:\n'
    + '• When the user asks for workout changes, ALWAYS use the modify_session or replace_exercise tool — never just describe the changes in text.\n'
    + '• When asked about rep/weight recommendations, reference their personal bests from the context provided.\n'
    + '• Apply RP principles: stay within MEV–MAV for muscle groups. Recommend deload if volume is high for >6 weeks.\n'
    + '• Be direct and concise. Max 150 words of text per response unless the user asks for detail.\n'
    + '• Always briefly explain WHY a change is beneficial (one sentence is enough).';
}

// ── Tool definitions ───────────────────────────────────────────────────────
var COACH_TOOLS = [
  {
    name: 'modify_session',
    description: 'Modify one or more exercises in a gym session. Use to change sets, reps, RPE, rest time, exercise name, or coaching note. Always use this when the user asks for workout changes.',
    input_schema: {
      type: 'object',
      required: ['session_index', 'exercises', 'reason'],
      properties: {
        session_index: {
          type: 'integer',
          description: '0=Push(Mon), 1=Pull(Tue), 2=Legs(Wed), 3=Upper(Thu), 4=Arms+Core(Fri)'
        },
        exercises: {
          type: 'array',
          description: 'List of exercise modifications. Only include fields that are changing.',
          items: {
            type: 'object',
            required: ['exercise_index'],
            properties: {
              exercise_index: { type: 'integer', description: '0-based index within the session' },
              name:  { type: 'string' },
              sets:  { type: 'string', description: 'Format: "4×8–10" or "3×12"' },
              rpe:   { type: 'string', description: 'RPE 6–10 as string' },
              rest:  { type: 'integer', description: 'Rest period in seconds' },
              tempo: { type: 'string', description: 'e.g. "3-1-X-0"' },
              note:  { type: 'string' }
            }
          }
        },
        reason: { type: 'string', description: 'One-sentence scientific reason for the change' }
      }
    }
  },
  {
    name: 'replace_exercise',
    description: 'Completely swap one exercise for a different exercise (e.g. Leg Press → Barbell Squat). Use when the user asks to change an exercise, not just adjust its parameters.',
    input_schema: {
      type: 'object',
      required: ['session_index', 'exercise_index', 'new_exercise', 'reason'],
      properties: {
        session_index:  { type: 'integer' },
        exercise_index: { type: 'integer' },
        new_exercise: {
          type: 'object',
          required: ['name', 'sets', 'rpe', 'rest'],
          properties: {
            name:    { type: 'string' },
            note:    { type: 'string' },
            sets:    { type: 'string' },
            rpe:     { type: 'string' },
            tempo:   { type: 'string' },
            rest:    { type: 'integer' },
            muscles: { type: 'array', items: { type: 'string' } }
          }
        },
        reason: { type: 'string' }
      }
    }
  }
];

// ── Context builder ────────────────────────────────────────────────────────
function buildCoachContext() {
  var ctx = 'CURRENT PROGRAM:\n';
  getActiveSessions().forEach(function(sess, si) {
    ctx += '\n['+si+'] '+sess.name+' ('+sess.day+'):\n';
    sess.exercises.forEach(function(ex, ei) {
      ctx += '  '+ei+'. '+ex.name+' — '+ex.sets+' RPE'+ex.rpe+' rest:'+ex.rest+'s'+
             (ex.note ? ' ('+ex.note+')' : '')+'\n';
    });
  });

  // PBs
  var pbs = S.personalBests || {};
  var pbKeys = Object.keys(pbs);
  if (pbKeys.length) {
    ctx += '\nPERSONAL BESTS:\n';
    pbKeys.slice(0, 15).forEach(function(k) {
      var pb = pbs[k];
      var orm = Math.round(pb.kg * (1 + pb.reps / 30));
      ctx += '  '+pb.name+': '+pb.kg+'kg × '+pb.reps+' reps  (~e1RM: '+orm+'kg)\n';
    });
  }

  // This week summary
  var done = S.sessions.filter(function(s){ return s==='done'; }).length;
  var n = todayNutr();
  var tgt = todayCalTarget();
  ctx += '\nTHIS WEEK: '+done+'/5 sessions done';
  ctx += '\nTODAY NUTRITION: '+Math.round(n.cal)+'/'+tgt.cal+' kcal, '+Math.round(n.protein)+'/'+TARGETS.protein+'g protein';

  // Recent sleep
  if (S.sleepLog && S.sleepLog.length) {
    var recentSleep = S.sleepLog.slice(0, 3);
    ctx += '\nRECENT SLEEP: '+recentSleep.map(function(e){ return e.hrs+'h'; }).join(', ')+' (last 3 nights)';
  }

  // Week XP + grade
  ctx += '\nWEEKLY XP: '+(S.weeklyXP||0)+' / '+XP_WEEKLY_CAP;

  return ctx;
}

// ── Send message ───────────────────────────────────────────────────────────
function sendCoachMessage() {
  var inp = document.getElementById('coachInput');
  var text = inp ? inp.value.trim() : '';
  if (!text) return;

  var apiKey = getApiKey();
  if (!apiKey) {
    addCoachMsg('ai', '⚠ No API key found. Add your Anthropic key in Settings → Anthropic API Key.');
    return;
  }

  inp.value = '';
  inp.style.height = '';
  addCoachMsg('user', text);

  // Build message history (last 10 turns, trim tokens)
  var history = (S.coachHistory || []).slice(-18);
  // Prepend context as first user message if history is short
  var messages = [];
  if (history.length === 0) {
    messages.push({ role: 'user', content: buildCoachContext() + '\n\nUser: ' + text });
  } else {
    history.forEach(function(m) { messages.push(m); });
    messages.push({ role: 'user', content: text });
  }

  setCoachTyping(true);

  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: buildCoachSystemPrompt() + '\n\n' + buildCoachContext(),
      tools: COACH_TOOLS,
      messages: messages
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    setCoachTyping(false);
    if (d.error) {
      addCoachMsg('ai', '⚠ ' + d.error.message);
      return;
    }

    // Persist turn to history
    if (!S.coachHistory) S.coachHistory = [];
    if (history.length === 0) {
      S.coachHistory.push({ role: 'user', content: buildCoachContext() + '\n\nUser: ' + text });
    } else {
      S.coachHistory.push({ role: 'user', content: text });
    }

    // Process content blocks
    var textParts = [];
    var toolCall  = null;

    (d.content || []).forEach(function(block) {
      if (block.type === 'text') textParts.push(block.text);
      if (block.type === 'tool_use') toolCall = block;
    });

    var aiText = textParts.join('\n').trim();

    if (toolCall) {
      // Store assistant turn with tool use
      S.coachHistory.push({ role: 'assistant', content: d.content });

      // Process the tool call into a proposed change
      var proposal = processToolCall(toolCall.name, toolCall.input);
      if (proposal) {
        _coachPending = proposal;
        if (aiText) addCoachMsg('ai', aiText);
        showProposedChange(proposal);
        // Store tool result in history so conversation continues
        S.coachHistory.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: toolCall.id, content: 'Proposed to user — awaiting confirmation.' }]
        });
      } else {
        if (aiText) addCoachMsg('ai', aiText);
      }
    } else {
      S.coachHistory.push({ role: 'assistant', content: d.content || [{ type: 'text', text: aiText }] });
      addCoachMsg('ai', aiText || 'No response.');
    }

    // Trim history to last 20 entries to keep localStorage small
    if (S.coachHistory.length > 20) S.coachHistory = S.coachHistory.slice(-20);
    save();
  })
  .catch(function(e) {
    setCoachTyping(false);
    addCoachMsg('ai', '⚠ Network error: ' + e.message);
  });
}

// ── Tool processing ────────────────────────────────────────────────────────
function processToolCall(toolName, input) {
  var si = input.session_index;
  var sess = getActiveSession(si);
  if (!sess) return null;

  if (toolName === 'modify_session') {
    var changes = [];
    (input.exercises || []).forEach(function(mod) {
      var ei = mod.exercise_index;
      var orig = sess.exercises[ei];
      if (!orig) return;
      var diff = [];
      var updated = JSON.parse(JSON.stringify(orig));
      ['name','sets','rpe','rest','tempo','note'].forEach(function(f) {
        if (mod[f] !== undefined && String(mod[f]) !== String(orig[f])) {
          diff.push({ field: f, from: orig[f], to: mod[f] });
          updated[f] = mod[f];
        }
      });
      if (diff.length) changes.push({ ei: ei, exName: orig.name, diff: diff, updated: updated });
    });
    if (!changes.length) return null;
    return { type: 'modify', si: si, sess: sess, changes: changes, reason: input.reason };
  }

  if (toolName === 'replace_exercise') {
    var ei2 = input.exercise_index;
    var orig2 = sess.exercises[ei2];
    if (!orig2) return null;
    var newEx = Object.assign({}, orig2, input.new_exercise);
    return { type: 'replace', si: si, sess: sess, ei: ei2, origName: orig2.name, newEx: newEx, reason: input.reason };
  }

  return null;
}

// ── Show proposed change card ──────────────────────────────────────────────
function showProposedChange(proposal) {
  var wrap = document.getElementById('coachMessages');
  if (!wrap) return;

  var card = document.createElement('div');
  card.className = 'proposed-change';

  var sessName = proposal.sess.name + ' (' + proposal.sess.day.split('—')[0].trim() + ')';
  var html = '<div class="pc-header">⚡ PROPOSED CHANGE — ' + sessName.toUpperCase() + '</div>';

  if (proposal.type === 'modify') {
    proposal.changes.forEach(function(c) {
      html += '<div class="pc-ex-name">' + c.exName + '</div>';
      c.diff.forEach(function(d) {
        var label = { sets:'Sets', rpe:'RPE', rest:'Rest', tempo:'Tempo', note:'Note', name:'Name' }[d.field] || d.field;
        var fromStr = d.field === 'rest' ? d.from + 's' : d.from;
        var toStr   = d.field === 'rest' ? d.to   + 's' : d.to;
        html += '<div class="pc-row"><span class="pc-field">'+label+'</span>'
          + '<span class="pc-from">'+fromStr+'</span>'
          + '<span class="pc-arrow">→</span>'
          + '<span class="pc-to">'+toStr+'</span></div>';
      });
    });
  }

  if (proposal.type === 'replace') {
    html += '<div class="pc-ex-name">Replace exercise</div>';
    html += '<div class="pc-row"><span class="pc-from">'+proposal.origName+'</span>'
      + '<span class="pc-arrow">→</span>'
      + '<span class="pc-to">'+proposal.newEx.name+'</span></div>';
    html += '<div class="pc-row"><span class="pc-field">Sets</span>'
      + '<span class="pc-to">'+proposal.newEx.sets+'</span></div>';
    html += '<div class="pc-row"><span class="pc-field">RPE</span>'
      + '<span class="pc-to">'+proposal.newEx.rpe+'</span></div>';
  }

  if (proposal.reason) {
    html += '<div class="pc-reason">'+proposal.reason+'</div>';
  }

  html += '<div class="proposed-btns">'
    + '<button class="pc-btn pc-perm" onclick="applyCoachChange(true)">Apply Permanently</button>'
    + '<button class="pc-btn pc-week" onclick="applyCoachChange(false)">This Week Only</button>'
    + '<button class="pc-btn pc-cancel" onclick="cancelCoachChange()">Cancel</button>'
    + '</div>';

  card.innerHTML = html;
  wrap.appendChild(card);
  wrap.scrollTop = wrap.scrollHeight;
}

// ── Apply / cancel ─────────────────────────────────────────────────────────
function applyCoachChange(permanent) {
  var p = _coachPending;
  if (!p) return;
  _coachPending = null;

  // Deep-clone current sessions as starting point
  var base = getActiveSessions().map(function(s) { return JSON.parse(JSON.stringify(s)); });

  if (p.type === 'modify') {
    p.changes.forEach(function(c) {
      Object.assign(base[p.si].exercises[c.ei], c.updated);
    });
  }
  if (p.type === 'replace') {
    base[p.si].exercises[p.ei] = p.newEx;
  }

  if (permanent) {
    S.customSessions = base;
    // If a week override exists for this session, update it too
    if (S.weekOverrides) S.weekOverrides[p.si] = base[p.si];
  } else {
    if (!S.weekOverrides) S.weekOverrides = new Array(SESSIONS_DEF.length).fill(null);
    S.weekOverrides[p.si] = base[p.si];
  }

  save();
  buildSessions(); // refresh training tab
  updateHeatMap();

  var label = permanent ? 'permanently' : 'for this week';
  addCoachMsg('ai', '✅ Applied ' + label + '. Head to the Training tab to see the updated session.');
  removeProposedCards();
}

function cancelCoachChange() {
  _coachPending = null;
  removeProposedCards();
  addCoachMsg('ai', 'No changes made.');
}

function removeProposedCards() {
  var wrap = document.getElementById('coachMessages');
  if (!wrap) return;
  var cards = wrap.querySelectorAll('.proposed-change');
  cards.forEach(function(c) { c.remove(); });
}

function resetToDefaultProgram() {
  if (!confirm('Reset to the default APEX program? This will remove all custom session changes.')) return;
  S.customSessions = null;
  S.weekOverrides  = null;
  save();
  buildSessions();
  addCoachMsg('ai', '✅ Program reset to defaults.');
  showToast('↺', 'Program reset', 'All custom changes removed', 'info', 2500);
}

// ── Chat UI helpers ────────────────────────────────────────────────────────
function addCoachMsg(role, text) {
  var wrap = document.getElementById('coachMessages');
  if (!wrap) return;
  var div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  // Simple markdown: **bold**, line breaks
  var html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  div.innerHTML = (role === 'ai' ? '<span class="chat-sender">APEX Coach</span>' : '') + html;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function setCoachTyping(on) {
  var existing = document.getElementById('coachTyping');
  if (on && !existing) {
    var wrap = document.getElementById('coachMessages');
    if (!wrap) return;
    var div = document.createElement('div');
    div.id = 'coachTyping';
    div.className = 'chat-msg ai typing';
    div.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    wrap.appendChild(div);
    wrap.scrollTop = wrap.scrollHeight;
  } else if (!on && existing) {
    existing.remove();
  }
}

function renderCoach() {
  var wrap = document.getElementById('coachMessages');
  if (!wrap) return;

  // Render stored history as text messages
  wrap.innerHTML = '';
  var history = S.coachHistory || [];

  if (!history.length) {
    var intro = document.createElement('div');
    intro.className = 'chat-msg ai';
    intro.innerHTML = '<span class="chat-sender">APEX Coach</span>'
      + "Hey Hassan 👋 I'm your AI performance coach. I can:<br><br>"
      + "• <strong>Modify your workouts</strong> — just ask (e.g. 'make Push day harder' or 'add a back exercise on Pull day')<br>"
      + "• <strong>Recommend weights & reps</strong> based on your personal bests<br>"
      + "• <strong>Answer nutrition, sleep & recovery questions</strong><br><br>"
      + "Changes can be applied permanently or just for this week. What do you need?";
    wrap.appendChild(intro);
    return;
  }

  // Replay text-only turns
  history.forEach(function(m) {
    if (m.role === 'user' && typeof m.content === 'string') {
      // Strip context block if it's the first message
      var text = m.content.replace(/^CURRENT PROGRAM[\s\S]*?User: /, '').replace(/^CURRENT PROGRAM[\s\S]*$/, '').trim();
      if (text) addCoachMsg('user', text);
    } else if (m.role === 'assistant') {
      var blocks = Array.isArray(m.content) ? m.content : [];
      blocks.forEach(function(b) {
        if (b.type === 'text' && b.text.trim()) addCoachMsg('ai', b.text.trim());
      });
    }
  });
  wrap.scrollTop = wrap.scrollHeight;
}

function clearCoachHistory() {
  if (!confirm('Clear all coach chat history?')) return;
  S.coachHistory = [];
  save();
  renderCoach();
}

// Enter key in textarea
document.addEventListener('DOMContentLoaded', function() {
  var inp = document.getElementById('coachInput');
  if (!inp) return;
  inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCoachMessage();
    }
  });
  // Auto-resize textarea
  inp.addEventListener('input', function() {
    this.style.height = '';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });
});
