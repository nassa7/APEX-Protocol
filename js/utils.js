'use strict';

// ══════════════════════════════════════
// DATE UTILITIES
// ══════════════════════════════════════

// Returns today as YYYY-MM-DD in local time
function todayISO() {
  var d = new Date();
  return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
}

function pad2(n) { return n < 10 ? '0'+n : String(n); }

// Returns day-of-week index: Mon=0, Tue=1, ... Sun=6
function realDow() {
  var d = new Date().getDay(); // JS: Sun=0, Mon=1 ... Sat=6
  return d === 0 ? 6 : d - 1; // convert to Mon=0
}

// Returns the ISO date (YYYY-MM-DD) of the Monday of the current real week
function thisWeekMonday() {
  var d = new Date();
  var day = d.getDay(); // Sun=0
  var diff = day === 0 ? -6 : 1 - day; // days back to Monday
  var mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  return mon.getFullYear()+'-'+pad2(mon.getMonth()+1)+'-'+pad2(mon.getDate());
}

// Week 1 = first Monday of 2026 (5 Jan 2026)
var PROGRAMME_START = '2026-01-05';

function weekNumFromMonday(mondayISO) {
  var ref = new Date(PROGRAMME_START);
  var mon = new Date(mondayISO);
  var diffMs  = mon - ref;
  var diffWeeks = Math.floor(diffMs / (7 * 24 * 3600 * 1000));
  return Math.max(1, diffWeeks + 1);
}

// Daily nutrition key — one entry per calendar day
function todayNutrKey() { return 'nutr_' + todayISO(); }
