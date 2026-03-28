'use strict';

// ══════════════════════════════════════
// PROGRESS CHARTS
// ══════════════════════════════════════
var apexChart = null;
var activeChart = 'weight';

// Shared chart defaults using the warm amber theme
function chartDefaults() {
  var style = getComputedStyle(document.documentElement);
  return {
    accent:  style.getPropertyValue('--accent').trim()  || '#F5A623',
    muted:   style.getPropertyValue('--muted').trim()   || '#8a7d65',
    border:  style.getPropertyValue('--border').trim()  || '#221c12',
    text:    style.getPropertyValue('--text').trim()    || '#f0ead6',
    bg3:     style.getPropertyValue('--bg3').trim()     || '#16120a',
    green:   style.getPropertyValue('--green').trim()   || '#3effaa',
    purple:  style.getPropertyValue('--purple').trim()  || '#a78bfa',
    blue:    style.getPropertyValue('--blue').trim()    || '#00D4FF',
  };
}

function destroyChart() {
  if (apexChart) { apexChart.destroy(); apexChart = null; }
}

function swChart(type) {
  activeChart = type;
  document.querySelectorAll('.btn-chip').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-chart') === type);
  });
  renderCharts();
}

function renderCharts() {
  if (activeChart === 'weight')        buildWeightChart();
  else if (activeChart === 'calories') buildCalorieChart();
  else if (activeChart === 'sleep')    buildSleepChart();
  else if (activeChart === 'volume')   buildVolumeChart();
}

function buildVolumeChart() {
  destroyChart();
  var canvas = document.getElementById('apexChart');
  if (!canvas) return;
  var data = typeof getWeeklyVolumeData==='function' ? getWeeklyVolumeData() : [];
  if (!data.length || data.every(function(d){ return d.vol===0; })) {
    showEmptyChart(canvas, 'Log sets to track weekly volume.'); return;
  }
  var c = chartDefaults();
  apexChart = new Chart(canvas, {
    type:'bar',
    data:{
      labels: data.map(function(d){ return 'Wk '+d.week; }),
      datasets:[{
        label:'Total Volume (tonnes)',
        data: data.map(function(d){ return d.vol; }),
        backgroundColor: c.accent+'55',
        borderColor: c.accent,
        borderWidth:2, borderRadius:6
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:true,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){ return ctx.parsed.y+'t volume'; }}}},
      scales:{
        x:{grid:{color:c.border+'55'},ticks:{color:c.muted,font:{size:10}}},
        y:{grid:{color:c.border+'55'},ticks:{color:c.muted,font:{size:10}},beginAtZero:true}
      }
    }
  });
}

// ── Weight chart ──────────────────────────────────────────────────────────
function buildWeightChart() {
  destroyChart();
  var canvas = document.getElementById('apexChart');
  if (!canvas) return;

  var entries = (S.weights || []).slice(0, 30).reverse();
  if (!entries.length) {
    showEmptyChart(canvas, 'No weight data yet. Log your first weight above.');
    return;
  }

  var c = chartDefaults();
  var labels = entries.map(function(w){ return w.date; });
  var data   = entries.map(function(w){ return w.val; });

  apexChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Weight (kg)',
        data: data,
        borderColor: c.accent,
        backgroundColor: hexToRgba(c.accent, 0.12),
        pointBackgroundColor: c.accent,
        pointBorderColor: c.accent,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: chartOptions(c, 'kg', null)
  });
}

// ── Calorie chart ─────────────────────────────────────────────────────────
function buildCalorieChart() {
  destroyChart();
  var canvas = document.getElementById('apexChart');
  if (!canvas) return;

  var nutrByDate = S.nutritionByDate || {};
  var dates = Object.keys(nutrByDate).sort().slice(-14);
  if (!dates.length) {
    showEmptyChart(canvas, 'No nutrition data yet. Log your first meal above.');
    return;
  }

  var c = chartDefaults();
  var labels = dates;
  var calData = dates.map(function(d){ return Math.round(nutrByDate[d].cal || 0); });

  apexChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Calories',
        data: calData,
        backgroundColor: hexToRgba(c.accent, 0.5),
        borderColor: c.accent,
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: chartOptions(c, 'kcal', TARGETS.cal)
  });
}

// ── Sleep chart ───────────────────────────────────────────────────────────
function buildSleepChart() {
  destroyChart();
  var canvas = document.getElementById('apexChart');
  if (!canvas) return;

  var entries = (S.sleepLog || []).slice(0, 14).reverse();
  if (!entries.length) {
    showEmptyChart(canvas, 'No sleep data yet. Log your first night above.');
    return;
  }

  var c = chartDefaults();
  var labels = entries.map(function(e){ return e.date; });
  var data   = entries.map(function(e){ return e.hrs; });

  apexChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Sleep (hrs)',
          data: data,
          borderColor: c.purple,
          backgroundColor: hexToRgba(c.purple, 0.12),
          pointBackgroundColor: data.map(function(h){
            return h >= 7 ? c.green : h >= 6 ? c.accent : '#ff4455';
          }),
          pointBorderColor: 'transparent',
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2,
          fill: true,
          tension: 0.3
        },
        {
          label: 'Target (7h45m)',
          data: labels.map(function(){ return SLEEP_TARGET; }),
          borderColor: hexToRgba(c.muted, 0.4),
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: chartOptions(c, 'hrs', SLEEP_TARGET)
  });
}

// ── Shared chart options ──────────────────────────────────────────────────
function chartOptions(c, unit, targetVal) {
  var opts = {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1510',
        borderColor: c.border,
        borderWidth: 1,
        titleColor: c.muted,
        bodyColor: c.text,
        titleFont: { family: "'JetBrains Mono', monospace", size: 9 },
        bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
        callbacks: {
          label: function(ctx) {
            return ' ' + ctx.parsed.y + ' ' + unit;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: hexToRgba(c.border, 0.5), drawBorder: false },
        ticks: {
          color: c.muted,
          font: { family: "'JetBrains Mono', monospace", size: 8 },
          maxTicksLimit: 7,
          maxRotation: 0
        },
        border: { display: false }
      },
      y: {
        grid: { color: hexToRgba(c.border, 0.5), drawBorder: false },
        ticks: {
          color: c.muted,
          font: { family: "'JetBrains Mono', monospace", size: 9 },
          callback: function(v) { return v + ' ' + unit; }
        },
        border: { display: false }
      }
    }
  };

  // Add reference line annotation for target if Chart.js annotation plugin is available
  if (targetVal !== null && window.Chart && Chart.registry && Chart.registry.plugins) {
    // No annotation plugin loaded — handled by dataset instead
  }

  return opts;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  hex = hex.replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map(function(c){ return c+c; }).join('');
  var r = parseInt(hex.substring(0,2), 16);
  var g = parseInt(hex.substring(2,4), 16);
  var b = parseInt(hex.substring(4,6), 16);
  return 'rgba('+r+','+g+','+b+','+alpha+')';
}

function showEmptyChart(canvas, msg) {
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#8a7d65';
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.textAlign = 'center';
  ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
}
