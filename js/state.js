'use strict';

// ══════════════════════════════════════
// STATE
// ══════════════════════════════════════
function freshState() {
  var mon = thisWeekMonday();
  return {
    weekStartMonday: mon,
    week: weekNumFromMonday(mon),
    sessions:[null,null,null,null,null],
    runLogs:{},
    setLogs:{},
    nutritionByDate:{},
    nutrition:{cal:0,protein:0,carbs:0,fat:0},
    weights:[],
    sleepLog:[],
    meals:[false,false,false,false,false],
    supps:[false,false,false,false,false],
    history:[],
    cyclingDays:[],
    lastAI:'',
    lastModified:new Date().toISOString(),
    // Gamification
    streak:0, totalXP:0, weeklyXP:0,
    achievements:[], personalBests:{}, pbCount:0,
    sessionNotes:{}, sessionTimers:{},
    checkIn:null, lastRecapSeen:null,
    sleepDefaults:null,
    // AI Coach
    coachHistory:[], customSessions:null, weekOverrides:null
  };
}

// Callbacks fired after week rollover (populated by gamification.js)
var rolloverCallbacks = [];

var S = (function(){
  try { var d=localStorage.getItem('apex_v5'); return d ? JSON.parse(d) : freshState(); }
  catch(e){ return freshState(); }
})();

// ── Migrate old state ──────────────────────────────────────────────────────
if (!S.runLogs) S.runLogs = {};
if (S.streak === undefined) S.streak = 0;
if (!S.totalXP) S.totalXP = 0;
if (!S.weeklyXP) S.weeklyXP = 0;
if (!S.achievements) S.achievements = [];
if (!S.personalBests) S.personalBests = {};
if (!S.pbCount) S.pbCount = 0;
if (!S.sessionNotes) S.sessionNotes = {};
if (!S.sessionTimers) S.sessionTimers = {};
if (!S.checkIn) S.checkIn = null;
if (!S.lastRecapSeen) S.lastRecapSeen = null;
if (S.sleepDefaults === undefined) S.sleepDefaults = null;
if (!S.coachHistory) S.coachHistory = [];
if (S.customSessions === undefined) S.customSessions = null;
if (S.weekOverrides === undefined) S.weekOverrides = null;
if (!S.nutritionByDate) {
  S.nutritionByDate = {};
  if (S.nutrition && (S.nutrition.cal || S.nutrition.protein)) {
    S.nutritionByDate[todayISO()] = {
      cal:S.nutrition.cal||0, protein:S.nutrition.protein||0,
      carbs:S.nutrition.carbs||0, fat:S.nutrition.fat||0
    };
  }
}
if (!S.weekStartMonday) {
  S.weekStartMonday = thisWeekMonday();
}
// Always recalculate week number from the fixed reference
S.week = weekNumFromMonday(S.weekStartMonday);

// ── Daily reset for meal and supplement toggles ────────────────────────────
(function(){
  var today = todayISO();
  if (S.lastMealResetDate !== today) {
    S.meals = [false,false,false,false,false,false];
    S.supps = [false,false,false,false,false];
    S.lastMealResetDate = today;
  }
})();

// ── Auto-detect week rollover on every load ────────────────────────────────
function checkWeekRollover() {
  var currentMon = thisWeekMonday();
  if (S.weekStartMonday !== currentMon) {
    errLog('info','Week rollover detected','old: '+S.weekStartMonday+' new: '+currentMon);
    if (!S.history) S.history = [];
    S.history.push({
      week: S.week,
      weekStartMonday: S.weekStartMonday,
      sessions: S.sessions.slice(),
      nutritionByDate: JSON.parse(JSON.stringify(S.nutritionByDate||{})),
      weights: S.weights.slice(0,3),
      sleepLog: (S.sleepLog||[]).slice(0,7),
      setLogs: JSON.parse(JSON.stringify(S.setLogs||{})),
      cyclingDays: (S.cyclingDays||[]).slice(),
      runLogs: JSON.parse(JSON.stringify(S.runLogs||{}))
    });
    if (S.history.length > 24) S.history = S.history.slice(-24);
    S.weekStartMonday = currentMon;
    S.week = weekNumFromMonday(currentMon);
    var prevSessions = S.sessions.slice();
    S.sessions = [null,null,null,null,null];
    S.nutritionByDate = {};
    S.nutrition = {cal:0,protein:0,carbs:0,fat:0};
    S.meals = [false,false,false,false,false];
    S.supps = [false,false,false,false,false];
    S.setLogs = {}; S.runLogs = {}; S.cyclingDays = [];
    S.sessionNotes = {}; S.sessionTimers = {};
    S.weeklyXP = 0;
    S.weekOverrides = null; // clear week-only overrides on rollover
    save();
    rolloverCallbacks.forEach(function(fn){ fn(prevSessions); });
  }
}

// Get today's nutrition object (creates if missing)
function todayNutr() {
  var key = todayISO();
  if (!S.nutritionByDate[key]) S.nutritionByDate[key] = {cal:0,protein:0,carbs:0,fat:0};
  return S.nutritionByDate[key];
}

// Get today's calorie target based on day of week
function todayCalTarget() {
  var dow = realDow();
  if (dow === 2) return TARGETS_RUN;
  if (dow === 5) return TARGETS_LONG;
  return TARGETS;
}

function save() {
  S.nutrition = todayNutr();
  S.lastModified = new Date().toISOString();
  localStorage.setItem('apex_v5', JSON.stringify(S));
  schedulePush();
}
