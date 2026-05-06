// ═══════════════════════════════════════
//  DROPLET — HYDRATION TRACKER JS
// ═══════════════════════════════════════

'use strict';

// ── STATE ──────────────────────────────
let state = {
  onboarded: false,
  name: 'Friend',
  dailyGoal: 2500,
  logs: {},         // { 'YYYY-MM-DD': [{ml, time, icon}] }
  streak: 0,
  lastGoalDate: null,
  cupSizes: [150, 250, 350, 500],
  cupIcons: ['☕', '🥤', '🍵', '🫙'],
  reminderEnabled: false,
  reminderFreq: 2,
  reminderStart: '08:00',
  reminderEnd: '22:00',
  climate: 'mild',
  activity: 'low',
  weight: 70,
  weightUnit: 'kg',
  onboardStep: 0,
  theme: 'dark',
};

const MILESTONES = [
  { days: 1,  emoji: '💧', title: 'First Drop!',    desc: 'Completed your first day!' },
  { days: 3,  emoji: '🌊', title: '3-Day Wave',     desc: '3 days of hydration done!' },
  { days: 7,  emoji: '🔥', title: 'Week Warrior',   desc: '7-day streak! Amazing!' },
  { days: 14, emoji: '⚡', title: 'Power Surge',    desc: 'Two full weeks of tracking!' },
  { days: 21, emoji: '🏆', title: '21-Day Habit',   desc: 'You\'ve built a real habit!' },
  { days: 30, emoji: '👑', title: 'Hydration King', desc: '30-day streak! You rule!' },
];

// ── STORAGE ────────────────────────────
function saveState() {
  try { localStorage.setItem('droplet_state', JSON.stringify(state)); } catch(e) {}
}

function loadState() {
  try {
    const saved = localStorage.getItem('droplet_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed };
    }
  } catch(e) {}
}

// ── DATE HELPERS ───────────────────────
function today() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getDayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
}

function getDateRange(days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getTodayIntake() {
  const entries = state.logs[today()] || [];
  return entries.reduce((sum, e) => sum + e.ml, 0);
}

// ── GOAL CALCULATOR ────────────────────
function calculateGoal(weight, unit, climate, activity) {
  let weightKg = unit === 'lbs' ? weight * 0.453592 : weight;
  let base = weightKg * 35; // 35ml per kg baseline
  const climateAdd = { mild: 0, hot: 500, humid: 400 };
  const activityAdd = { low: 0, moderate: 400, high: 800 };
  let total = base + (climateAdd[climate] || 0) + (activityAdd[activity] || 0);
  return Math.round(total / 50) * 50; // round to nearest 50ml
}

// ── STREAK CALCULATOR ──────────────────
function recalcStreak() {
  let streak = 0;
  let d = new Date();
  while (true) {
    const dateStr = d.toISOString().split('T')[0];
    const intake = (state.logs[dateStr] || []).reduce((s, e) => s + e.ml, 0);
    if (intake >= state.dailyGoal) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (dateStr === today()) {
      // today not finished, check yesterday
      d.setDate(d.getDate() - 1);
      const yStr = d.toISOString().split('T')[0];
      const yIntake = (state.logs[yStr] || []).reduce((s, e) => s + e.ml, 0);
      if (yIntake >= state.dailyGoal) {
        d.setDate(d.getDate() - 1);
        continue;
      }
      break;
    } else {
      break;
    }
  }
  state.streak = streak;
}

// ── ONBOARDING ─────────────────────────
let selectedClimate = 'mild';
let selectedActivity = 'low';

function showOnboarding() {
  switchScreen('onboarding-screen');
  setupChips();
}

function setupChips() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', function() {
      if (this.dataset.climate) {
        document.querySelectorAll('[data-climate]').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        selectedClimate = this.dataset.climate;
      }
      if (this.dataset.activity) {
        document.querySelectorAll('[data-activity]').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        selectedActivity = this.dataset.activity;
      }
    });
  });
}

function nextOnboard() {
  const step = state.onboardStep;

  if (step === 0) {
    const name = document.getElementById('input-name').value.trim();
    if (!name) { showToast('Please enter your name 👋'); return; }
    state.name = name;
  }

  if (step === 1) {
    const w = parseFloat(document.getElementById('input-weight').value);
    if (!w || w < 20 || w > 300) { showToast('Enter a valid weight'); return; }
    const unit = document.getElementById('input-unit').value;
    state.weight = w;
    state.weightUnit = unit;
    state.climate = selectedClimate;
    state.activity = selectedActivity;
    const goal = calculateGoal(w, unit, selectedClimate, selectedActivity);
    state.dailyGoal = goal;
    document.getElementById('ob-goal-val').textContent = (goal / 1000).toFixed(1);
    document.getElementById('ob-goal-desc').textContent = `per day · ${goal}ml`;
    document.getElementById('input-custom-goal').placeholder = goal;
  }

  // Transition pages
  const current = document.getElementById(`ob-page${step}`);
  const next = document.getElementById(`ob-page${step + 1}`);
  if (!next) return;

  current.classList.add('exit');
  setTimeout(() => {
    current.classList.remove('active', 'exit');
    next.classList.add('active');
  }, 350);

  state.onboardStep = step + 1;
  document.querySelectorAll('.dot').forEach((d, i) => {
    d.classList.toggle('active', i <= step + 1);
  });
}

function finishOnboarding() {
  const customGoal = parseInt(document.getElementById('input-custom-goal').value);
  if (customGoal && customGoal >= 500 && customGoal <= 6000) {
    state.dailyGoal = customGoal;
  }
  state.onboarded = true;
  state.onboardStep = 0;
  saveState();
  switchScreen('main-app');
  initMainApp();
}

// ── SCREEN MANAGEMENT ──────────────────
function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── TAB MANAGEMENT ─────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  document.getElementById(`nav-${name}`).classList.add('active');

  if (name === 'history') renderHistory();
  if (name === 'goals') renderGoals();
  if (name === 'settings') renderSettings();
}

// ── MAIN APP INIT ──────────────────────
function initMainApp() {
  renderGreeting();
  renderCups();
  updateRing();
  updateLogList();
  updateStreak();
  checkReminders();
  
  // Dynamic greeting update
  if (!window._greetingInterval) {
    window._greetingInterval = setInterval(renderGreeting, 60000);
  }
}

function renderGreeting() {
  const intake = getTodayIntake();
  let greeting = '';
  
  if (intake > state.dailyGoal) {
    greeting = 'Overachiever! Stay hydrated 🌊';
  } else if (intake === state.dailyGoal) {
    greeting = 'Goal completed! 🎉';
  } else if (intake >= state.dailyGoal / 2) {
    greeting = "You're halfway there! 💪";
  } else {
    const h = new Date().getHours();
    greeting = h < 12 ? 'Good morning ☀️' : h < 17 ? 'Good afternoon 🌤' : 'Good evening 🌙';
  }
  
  document.getElementById('greeting-text').textContent = greeting;
  document.getElementById('home-username').textContent = state.name;
}

function renderCups() {
  const grid = document.getElementById('cup-grid');
  grid.innerHTML = state.cupSizes.map((ml, i) => `
    <button class="cup-btn" onclick="logWater(${ml}, '${state.cupIcons[i]}')">
      <span class="cup-btn-icon">${state.cupIcons[i]}</span>
      <span class="cup-btn-ml">${ml}ml</span>
    </button>
  `).join('');
}

// ── LOGGING WATER ──────────────────────
function logWater(ml, icon = '💧') {
  const todayStr = today();
  if (!state.logs[todayStr]) state.logs[todayStr] = [];
  const entry = { ml, icon, time: new Date().toISOString() };
  state.logs[todayStr].unshift(entry);
  saveState();

  showLogAnimation(ml);
  updateRing();
  updateLogList();
  checkStreak();
  checkGoalReached();
  renderGreeting();
}

function logCustom() {
  const input = document.getElementById('custom-amount');
  const val = parseInt(input.value);
  if (!val || val < 50 || val > 2000) {
    showToast('Enter a value between 50 and 2000 ml');
    return;
  }
  logWater(val, '🥛');
  input.value = '';
}

function deleteEntry(index) {
  const todayStr = today();
  state.logs[todayStr] = state.logs[todayStr] || [];
  state.logs[todayStr].splice(index, 1);
  saveState();
  updateRing();
  updateLogList();
  updateStreak();
  renderGreeting();
}

// ── RING UPDATE ────────────────────────
function updateRing() {
  const intake = getTodayIntake();
  const pct = Math.min(intake / state.dailyGoal, 1);
  const circumference = 2 * Math.PI * 90; // 565.48
  const offset = circumference * (1 - pct);

  const ring = document.getElementById('ring-progress');
  if (ring) ring.style.strokeDashoffset = offset;

  const waterFill = document.getElementById('water-fill');
  if (waterFill) {
    const fillY = 196 - (172 * pct);
    waterFill.setAttribute('y', fillY);
    // animate wave paths
    const wave1 = document.getElementById('wave-path1');
    const wave2 = document.getElementById('wave-path2');
    if (wave1 && wave2) {
      const wy = fillY + 20;
      wave1.setAttribute('d', `M24,${wy} Q55,${wy-15} 86,${wy} Q117,${wy+15} 148,${wy} Q179,${wy-15} 196,${wy} L196,196 L24,196 Z`);
      wave2.setAttribute('d', `M24,${wy+5} Q60,${wy-10} 90,${wy+5} Q120,${wy+20} 155,${wy+5} Q175,${wy-5} 196,${wy+5} L196,196 L24,196 Z`);
    }
  }

  const amountEl = document.getElementById('ring-amount');
  const pctEl = document.getElementById('ring-percent');
  const goalEl = document.getElementById('ring-goal-label');
  if (amountEl) amountEl.textContent = intake;
  if (pctEl) pctEl.textContent = Math.round(pct * 100) + '%';
  if (goalEl) goalEl.textContent = `of ${state.dailyGoal}ml`;

  // Color shift at 100%
  if (intake >= state.dailyGoal && ring) {
    ring.setAttribute('stroke', 'url(#ringGrad)');
  }
}

// ── LOG LIST ───────────────────────────
function updateLogList() {
  const list = document.getElementById('log-list');
  const entries = state.logs[today()] || [];
  const countEl = document.getElementById('log-count');
  if (countEl) countEl.textContent = `${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}`;

  if (!entries.length) {
    list.innerHTML = `<div class="empty-log"><span>💧</span><p>No entries yet. Start hydrating!</p></div>`;
    return;
  }

  list.innerHTML = entries.map((e, i) => `
    <div class="log-entry">
      <div class="log-entry-left">
        <span class="log-entry-icon">${e.icon}</span>
        <div>
          <div class="log-entry-amount">+${e.ml} ml</div>
          <div class="log-entry-time">${formatTime(e.time)}</div>
        </div>
      </div>
      <button class="log-entry-delete" onclick="deleteEntry(${i})">✕</button>
    </div>
  `).join('');
}

// ── STREAK ─────────────────────────────
function updateStreak() {
  recalcStreak();
  const el = document.getElementById('streak-count');
  if (el) el.textContent = state.streak;
}

function checkStreak() {
  const prevStreak = state.streak;
  recalcStreak();
  const el = document.getElementById('streak-count');
  if (el) el.textContent = state.streak;

  // Check milestones
  const milestone = MILESTONES.find(m => m.days === state.streak && state.streak > prevStreak);
  if (milestone) showMilestone(milestone);
}

function checkGoalReached() {
  const intake = getTodayIntake();
  if (intake >= state.dailyGoal && state.lastGoalDate !== today()) {
    state.lastGoalDate = today();
    saveState();
    showCelebration();
    checkStreak();
  }
}

function showMilestone(m) {
  const card = document.getElementById('milestone-card');
  document.getElementById('milestone-emoji').textContent = m.emoji;
  document.getElementById('milestone-title').textContent = m.title;
  document.getElementById('milestone-desc').textContent = m.desc;
  card.classList.remove('hidden');
  setTimeout(() => card.classList.add('hidden'), 5000);
}

// ── ANIMATION ──────────────────────────
function showLogAnimation(ml) {
  const el = document.getElementById('log-anim');
  const text = document.getElementById('log-anim-text');
  text.textContent = `+${ml}ml`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 900);
}

function showCelebration() {
  const overlay = document.getElementById('celebration-anim');
  const container = document.getElementById('confetti-container');
  if (container) container.innerHTML = '';
  
  const colors = ['#00f0ff', '#b026ff', '#00e676', '#ff1744', '#ffd700'];
  for (let i = 0; i < 60; i++) {
    const conf = document.createElement('div');
    conf.className = 'confetti';
    conf.style.left = Math.random() * 100 + '%';
    conf.style.top = -10 + '%';
    conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    conf.style.animationDuration = (Math.random() * 2 + 2) + 's';
    conf.style.animationDelay = (Math.random() * 0.5) + 's';
    if (container) container.appendChild(conf);
  }
  
  if (overlay) {
    overlay.classList.remove('hidden');
    // slight delay to allow display:block to apply before opacity transition
    setTimeout(() => overlay.classList.add('show'), 10);
    
    setTimeout(() => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.classList.add('hidden'), 500);
    }, 4500);
  }
}

// ── TOAST ──────────────────────────────
let toastTimeout;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── HISTORY ────────────────────────────
let currentPeriod = 'week';

function setPeriod(period, btn) {
  currentPeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHistory();
}

function renderHistory() {
  const days = currentPeriod === 'week' ? 7 : 30;
  const dates = getDateRange(days);
  const title = currentPeriod === 'week' ? 'This week' : 'This month';
  document.getElementById('chart-title').textContent = title;

  // Compute stats realistically
  const allLoggedDates = Object.keys(state.logs).sort();
  const firstUseDate = allLoggedDates.length > 0 ? allLoggedDates[0] : today();
  
  // Only include dates from first use onward for averages/rates
  const validDates = dates.filter(d => d >= firstUseDate);
  const validTotals = validDates.map(d => (state.logs[d] || []).reduce((s, e) => s + e.ml, 0));
  const denominator = validDates.length > 0 ? validDates.length : 1;
  
  const totals = dates.map(d => (state.logs[d] || []).reduce((s, e) => s + e.ml, 0));
  
  const avg = validTotals.length ? Math.round(validTotals.reduce((a, b) => a + b, 0) / denominator) : 0;
  const goalHits = validTotals.filter(t => t >= state.dailyGoal).length;
  const hitRate = Math.round((goalHits / denominator) * 100);
  const best = Math.max(...totals, 0);

  document.getElementById('avg-intake').textContent = avg || '—';
  document.getElementById('goal-hit-rate').textContent = avg ? `${hitRate}%` : '—';
  document.getElementById('best-day').textContent = best || '—';

  // Bar chart
  renderBarChart(dates, totals);

  // Heatmap — last 28 days (4 rows × 7)
  renderHeatmap();

  // Milestones
  renderMilestones();
}

function renderBarChart(dates, totals) {
  const chart = document.getElementById('bar-chart');
  const maxVal = Math.max(...totals, state.dailyGoal);

  chart.innerHTML = dates.map((d, i) => {
    const val = totals[i];
    const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
    const cls = val >= state.dailyGoal ? 'goal-hit' : val > 0 ? 'partial' : 'empty';
    const label = currentPeriod === 'week' ? getDayLabel(d) : d.slice(8);
    return `
      <div class="bar-wrap">
        <div class="bar-val">${val > 0 ? Math.round(val/100)/10 + 'L' : ''}</div>
        <div class="bar ${cls}" style="height:${heightPct}%"></div>
        <div class="bar-label">${label}</div>
      </div>
    `;
  }).join('');
}

function renderHeatmap() {
  const heatmap = document.getElementById('heatmap');
  const days = getDateRange(28);

  // Day labels
  const dayLabels = ['S','M','T','W','T','F','S'];
  let html = dayLabels.map(l => `<div class="heatmap-day-label">${l}</div>`).join('');

  html += days.map(d => {
    const intake = (state.logs[d] || []).reduce((s, e) => s + e.ml, 0);
    const pct = state.dailyGoal > 0 ? intake / state.dailyGoal : 0;
    const level = intake === 0 ? 0 : pct < 0.4 ? 1 : pct < 0.7 ? 2 : pct < 1 ? 3 : 4;
    const title = `${d}: ${intake}ml`;
    return `<div class="heatmap-cell" data-level="${level}" title="${title}" onclick="showToast('${d}: ${intake}ml')"></div>`;
  }).join('');

  heatmap.innerHTML = html;
}

function renderMilestones() {
  const list = document.getElementById('milestones-list');
  list.innerHTML = MILESTONES.map(m => {
    const achieved = state.streak >= m.days;
    return `
      <div class="milestone-item ${achieved ? 'achieved' : ''}">
        <span class="milestone-icon">${m.emoji}</span>
        <div>
          <div class="milestone-info-title">${m.title}</div>
          <div class="milestone-info-desc">${m.desc}</div>
        </div>
        <span class="milestone-lock">${achieved ? '✅' : `${m.days}d`}</span>
      </div>
    `;
  }).join('');
}

// ── GOALS TAB ──────────────────────────
function renderGoals() {
  document.getElementById('goal-display-val').textContent = state.dailyGoal;
  document.getElementById('goal-liter-display').textContent = `= ${(state.dailyGoal / 1000).toFixed(2)} L`;
  document.getElementById('goal-weight').value = state.weight || '';
  document.getElementById('goal-unit').value = state.weightUnit || 'kg';
  document.getElementById('custom-goal-input').value = '';

  // Setup goal tab chips
  const climateChips = document.getElementById('goal-climate-chips');
  const activityChips = document.getElementById('goal-activity-chips');

  climateChips.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c.dataset.climate === state.climate);
    c.onclick = function() {
      climateChips.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
      this.classList.add('active');
      state.climate = this.dataset.climate;
    };
  });

  activityChips.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c.dataset.activity === state.activity);
    c.onclick = function() {
      activityChips.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
      this.classList.add('active');
      state.activity = this.dataset.activity;
    };
  });
}

function recalculateGoal() {
  const w = parseFloat(document.getElementById('goal-weight').value);
  if (!w || w < 20) { showToast('Enter a valid weight'); return; }
  const unit = document.getElementById('goal-unit').value;
  const goal = calculateGoal(w, unit, state.climate, state.activity);
  state.weight = w;
  state.weightUnit = unit;
  state.dailyGoal = goal;
  
  const intake = getTodayIntake();
  if (intake < goal && state.lastGoalDate === today()) state.lastGoalDate = null;
  
  saveState();
  renderGoals();
  updateRing();
  renderGreeting();
  
  if (intake >= goal && state.lastGoalDate !== today()) {
    checkGoalReached();
  } else {
    showToast(`Goal set to ${goal}ml 🎯`);
  }
}

function setCustomGoal() {
  const val = parseInt(document.getElementById('custom-goal-input').value);
  if (!val || val < 500 || val > 6000) {
    showToast('Enter a value between 500 and 6000 ml');
    return;
  }
  state.dailyGoal = val;
  
  const intake = getTodayIntake();
  if (intake < val && state.lastGoalDate === today()) state.lastGoalDate = null;
  
  saveState();
  renderGoals();
  updateRing();
  renderGreeting();
  
  if (intake >= val && state.lastGoalDate !== today()) {
    checkGoalReached();
  } else {
    showToast(`Goal set to ${val}ml 🎯`);
  }
}

// ── SETTINGS TAB ───────────────────────
function renderSettings() {
  // Cup sizes editor
  const editor = document.getElementById('cup-sizes-editor');
  editor.innerHTML = state.cupSizes.map((ml, i) => `
    <div class="cup-size-row">
      <span class="cup-size-emoji">${state.cupIcons[i]}</span>
      <input type="number" class="cup-size-input" id="cup-input-${i}"
             value="${ml}" min="50" max="2000" step="25" />
      <span class="cup-size-label">ml</span>
    </div>
  `).join('');

  // Reminder toggle
  const toggle = document.getElementById('reminder-toggle');
  toggle.checked = state.reminderEnabled;
  const opts = document.getElementById('reminder-options');
  opts.classList.toggle('hidden', !state.reminderEnabled);
  document.getElementById('reminder-freq').value = state.reminderFreq;
  document.getElementById('reminder-start').value = state.reminderStart;
  document.getElementById('reminder-end').value = state.reminderEnd;

  // Name
  document.getElementById('settings-name').value = state.name;
}

function saveCupSizes() {
  const newSizes = state.cupSizes.map((_, i) => {
    const val = parseInt(document.getElementById(`cup-input-${i}`).value);
    return (val && val >= 50 && val <= 2000) ? val : state.cupSizes[i];
  });
  state.cupSizes = newSizes;
  saveState();
  renderCups();
  showToast('Cup sizes saved! ✅');
}

function toggleReminders() {
  state.reminderEnabled = document.getElementById('reminder-toggle').checked;
  const opts = document.getElementById('reminder-options');
  opts.classList.toggle('hidden', !state.reminderEnabled);
  if (state.reminderEnabled) {
    requestNotificationPermission();
  }
  saveState();
}

function saveReminders() {
  state.reminderFreq = parseInt(document.getElementById('reminder-freq').value);
  state.reminderStart = document.getElementById('reminder-start').value;
  state.reminderEnd = document.getElementById('reminder-end').value;
  saveState();
  scheduleReminders();
  showToast('Reminders scheduled! ⏰');
}

function saveProfile() {
  const name = document.getElementById('settings-name').value.trim();
  if (!name) { showToast('Enter a valid name'); return; }
  state.name = name;
  saveState();
  renderGreeting();
  showToast('Profile saved! ✅');
}

function resetData() {
  if (!confirm('Reset all data? This cannot be undone!')) return;
  state.logs = {};
  state.streak = 0;
  state.lastGoalDate = null;
  saveState();
  updateRing();
  updateLogList();
  updateStreak();
  showToast('Data reset. Fresh start! 💧');
}

// ── NOTIFICATIONS ──────────────────────
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Notifications not supported in this browser');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    showToast('Notifications blocked — enable in browser settings');
    return false;
  }
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

function scheduleReminders() {
  if (!state.reminderEnabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    requestNotificationPermission();
    return;
  }
  // Clear existing
  if (window._reminderInterval) clearInterval(window._reminderInterval);

  const freqMs = state.reminderFreq * 60 * 60 * 1000;
  window._reminderInterval = setInterval(() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const [sh, sm] = state.reminderStart.split(':').map(Number);
    const [eh, em] = state.reminderEnd.split(':').map(Number);
    const nowMin = h * 60 + m;
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    if (nowMin >= startMin && nowMin <= endMin) {
      const intake = getTodayIntake();
      const pct = Math.round((intake / state.dailyGoal) * 100);
      new Notification('💧 Time to hydrate!', {
        body: `You're at ${pct}% of your daily goal (${intake}ml / ${state.dailyGoal}ml). Keep it up!`,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💧</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💧</text></svg>',
      });
    }
  }, freqMs);

  // Send immediate reminder as preview
  setTimeout(() => {
    if (Notification.permission === 'granted') {
      const intake = getTodayIntake();
      new Notification('💧 Droplet reminders active!', {
        body: `You'll be reminded every ${state.reminderFreq} hour(s). Current: ${intake}ml`,
      });
    }
  }, 1000);
}

function checkReminders() {
  if (state.reminderEnabled && Notification.permission === 'granted') {
    scheduleReminders();
  }
}

// ── THEME ──────────────────────────────
function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  if (state.theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  saveState();
}

// ── INIT ───────────────────────────────
function init() {
  loadState();

  if (state.theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  if (state.onboarded) {
    switchScreen('main-app');
    initMainApp();
  } else {
    switchScreen('splash-screen');
  }

  // Setup onboarding chip events on page load
  setupChips();

  // Input numeric validation
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const active = document.activeElement;
      if (active && active.classList.contains('glass-input-sm')) {
        logCustom();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
