const tg = window.Telegram?.WebApp;
if (tg) {
  tg.expand();
  tg.setHeaderColor('#0d0d14');
  function setTgHeight() {
    var h = (tg.viewportStableHeight || tg.viewportHeight || window.innerHeight) + 'px';
    document.documentElement.style.setProperty('--tg-height', h);
  }
  setTgHeight();
  tg.onEvent('viewportChanged', setTgHeight);
}

const GRID_SIZE      = 25;
const CRYSTAL_EMOJI  = '💎';
const MINE_EMOJI     = '💣';
const OPTIMIZE_KEY   = 'mp_last_optimize';
const SIGNAL_LIMIT   = 5;
const SIGNAL_KEY     = 'mp_signals_v4_';

// Параметры только из URL — localStorage не используется как fallback для безопасности
const _params = new URLSearchParams(window.location.search);
const _uid    = _params.get('uid')  || '';
const _days   = parseInt(_params.get('days') || '0');
const _vip    = _params.get('vip')  === '1';
const _bonus  = parseInt(_params.get('bonus') || '0');  // referral bonus signals
const _ref    = _params.get('ref') || '';               // user's own referral code
const _extra  = _params.get('extra') === '1';           // ekstra signal access
const _bot    = _params.get('bot') || '';               // bot username for deep links

// Если пришли через бот — сохраняем для статистики
if (_uid) localStorage.setItem('mp_uid', _uid);

// ── GATE: блокируем доступ без uid ───────────────────────
if (!_uid) {
  document.getElementById('gate-screen').style.display    = 'flex';
  document.getElementById('main-screen').style.display    = 'none';
  document.getElementById('optimize-screen').style.display = 'none';
}

let vavadaId = _uid;
let penBlocked = 2;  // Łatwy — stały poziom

/* ════════════════════════════════
   SIGNAL LIMIT
════════════════════════════════ */
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
function getSignalData() {
  try {
    var raw = localStorage.getItem(SIGNAL_KEY);
    if (!raw) return { date: '', count: 0 };
    var obj = JSON.parse(raw);
    // новый день — сбрасываем счётчик
    if (obj.date !== todayStr()) return { date: todayStr(), count: 0 };
    return obj;
  } catch(e) { return { date: todayStr(), count: 0 }; }
}
function getSignalsUsed() { return getSignalData().count; }
function incSignals() {
  var obj = getSignalData();
  obj.date = todayStr();
  obj.count = (obj.count || 0) + 1;
  localStorage.setItem(SIGNAL_KEY, JSON.stringify(obj));
  setCooldown();
  updateHomeCards();
}

function updateHomeCards() {
  var used  = getSignalsUsed();
  var total = getTotalLimit();
  var left  = Math.max(0, total - used);
  ['mines','penalty','aviator'].forEach(function(g) {
    var el   = document.getElementById('card-sig-' + g);
    var card = el && el.closest('.game-card');
    if (!el) return;
    if (_vip) {
      el.textContent = '📡 ∞';
      el.className   = 'game-card-signals sig-ok';
    } else if (left > 0) {
      el.textContent = '📡 ' + left + '/' + total;
      el.className   = 'game-card-signals sig-ok';
    } else {
      el.textContent = '🔒 0/' + total;
      el.className   = 'game-card-signals sig-empty';
    }
    if (card) {
      if (_vip || left > 0) card.classList.add('pulsing');
      else                   card.classList.remove('pulsing');
    }
  });
}
function getTotalLimit() { return SIGNAL_LIMIT + _bonus; }

/* ── 6:30 COOLDOWN ───────────────────────────── */
var COOLDOWN_KEY = 'mp_cooldown_until';
var COOLDOWN_MS  = 6 * 60 * 1000 + 30 * 1000;
function isInCooldown() {
  return Date.now() < (parseInt(localStorage.getItem(COOLDOWN_KEY) || '0'));
}
function setCooldown() {
  localStorage.setItem(COOLDOWN_KEY, Date.now() + COOLDOWN_MS);
}
function cooldownRemaining() {
  var r = (parseInt(localStorage.getItem(COOLDOWN_KEY) || '0')) - Date.now();
  if (r <= 0) return null;
  return Math.floor(r / 60000) + ':' + String(Math.floor((r % 60000) / 1000)).padStart(2, '0');
}

function canUseSignal() { return _vip || (getSignalsUsed() < getTotalLimit() && !isInCooldown()); }
function timeToMidnight() {
  var now = new Date(), mid = new Date(now);
  mid.setHours(24, 0, 0, 0);
  var diff = mid - now;
  return Math.floor(diff / 3600000) + 'h ' + Math.floor((diff % 3600000) / 60000) + 'min';
}
function updateCounterUI(elId) {
  var el = document.getElementById(elId);
  if (!el) return;
  if (_vip) {
    el.className = 'signal-counter';
    el.innerHTML = '⭐ Sygnały nielimitowane';
    return;
  }
  var totalLimit = getTotalLimit();
  var left = Math.max(0, totalLimit - getSignalsUsed());
  if (left <= 0) {
    el.className = 'signal-counter limit-reached';
    el.innerHTML = '🔒 Dzienny limit wyczerpany<br>⏱ Odnowienie za <b>' + timeToMidnight() + '</b>';
    return;
  }
  var cd = cooldownRemaining();
  if (cd) {
    el.className = 'signal-counter cooldown-active';
    el.innerHTML = '⏳ Następny sygnał za <b>' + cd + '</b>';
    return;
  }
  el.className = 'signal-counter';
  var bonusStr = _bonus > 0 ? ' <span style="color:#a78bfa">(+' + _bonus + ' ref)</span>' : '';
  el.innerHTML = '📡 Pozostało sygnałów dziś: <b>' + left + ' / ' + totalLimit + '</b>' + bonusStr;
}

/* ════════════════════════════════
   TABS
════════════════════════════════ */
var PAGES = ['home','mines','penalty','aviator','instrukcja','sub','wheel','ekstra'];
var LOGOS = { home: '💎 MinesPredictor', mines: '💎 Mines', penalty: '⚽ Penalty', aviator: '✈️ Aviator', instrukcja: '📋 Instrukcja', sub: '🔑 Konto', wheel: '🎡 Koło Fortuny', ekstra: '⭐ Ekstra Sygnał' };

function openGame(page) {
  PAGES.forEach(function(p) {
    document.getElementById('page-' + p).style.display = p === page ? 'flex' : 'none';
  });
  document.getElementById('header-logo').textContent = LOGOS[page] || '💎 MinesPredictor';
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (page === 'sub')    initSubTab();
  if (page === 'aviator') updateAviatorDisplay();
  if (page === 'wheel')  initWheelPage();
  if (page === 'home')   { updateHomeCards(); updateWheelHomeBadge(); updateEkstraHomeBadge(); }
  if (page === 'ekstra') initEkstraPage();
}

function showHome() {
  openGame('home');
  document.getElementById('header-logo').textContent = '💎 MinesPredictor';
}

// backward compat
function switchTab(tab) { openGame(tab); }

/* ════════════════════════════════
   VAVADA DISPLAY
════════════════════════════════ */
function updateVavadaDisplay() {
  var text   = vavadaId ? '🎰 ID: ' + vavadaId : '🎰 Brak ID — ustaw w bocie';
  var hasCls = vavadaId ? 'add' : 'remove';
  var el  = document.getElementById('vavada-display');
  var el2 = document.getElementById('vavada-display-pen');
  if (el)  { document.getElementById('vavada-id-text').textContent = text;     el.classList[hasCls]('has-id'); }
  if (el2) { document.getElementById('vavada-id-text-pen').textContent = text; el2.classList[hasCls]('has-id'); }
}


/* ════════════════════════════════
   MINES
════════════════════════════════ */
function syncDifficulty() {
  document.getElementById('diff-label').textContent = document.getElementById('difficulty').value;
}

function getSignal() {
  if (!canUseSignal()) { updateCounterUI('signal-counter-mines'); return; }
  document.getElementById('win-section-mines').style.display = 'none';
  var btn = document.getElementById('signal-btn');
  btn.classList.add('loading');
  btn.innerHTML = '<span class="dots">Analizuję</span>';
  setTimeout(function() {
    incSignals();
    generatePrediction();
    btn.classList.remove('loading');
    btn.innerHTML = '<span class="btn-icon">📡</span> Pobierz Sygnał';
    updateCounterUI('signal-counter-mines');
  }, 1200 + Math.random() * 800);
}

function generatePrediction() {
  var mines   = parseInt(document.getElementById('difficulty').value);
  var crystals = GRID_SIZE - mines;
  var indices = Array.from({length: GRID_SIZE}, function(_, i) { return i; });
  for (var i = indices.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = indices[i]; indices[i] = indices[j]; indices[j] = t;
  }
  var mineSet = new Set(indices.slice(0, mines));
  var data = Array.from({length: GRID_SIZE}, function(_, i) { return mineSet.has(i) ? 'mine' : 'crystal'; });
  renderGrid(data);
  updateStats(crystals, mines);
}

function initGrid() {
  var grid = document.getElementById('grid');
  grid.innerHTML = '';
  for (var i = 0; i < GRID_SIZE; i++) {
    var cell = document.createElement('div');
    cell.className = 'cell empty';
    cell.style.setProperty('--i', i);
    grid.appendChild(cell);
  }
}

function renderGrid(data) {
  var cells = document.querySelectorAll('.cell');
  cells.forEach(function(cell, i) {
    cell.className = 'cell';
    cell.textContent = '';
    setTimeout(function() {
      cell.classList.add(data[i], 'revealing');
      cell.textContent = data[i] === 'crystal' ? CRYSTAL_EMOJI : MINE_EMOJI;
    }, i * 40);
  });
}

function updateStats(crystals, mines) {
  var acc = (85 + Math.floor(Math.random() * 12)) + '%';
  setTimeout(function() {
    document.getElementById('stat-crystals').textContent = crystals;
    document.getElementById('stat-mines').textContent    = mines;
    document.getElementById('stat-accuracy').textContent = acc;
    document.querySelectorAll('#page-mines .stat-box').forEach(function(b) { b.classList.add('active'); });
    document.getElementById('win-section-mines').style.display = 'block';
  }, GRID_SIZE * 40 + 100);
}

/* ════════════════════════════════
   PENALTY
════════════════════════════════ */
var ZONE_NAMES = ['GÓR-L','GÓR-C','GÓR','GÓR-C','GÓR-R','ŚR-L','ŚR-C','ŚR','ŚR-C','ŚR-R','DÓŁ-L','DÓŁ-C','DÓŁ','DÓŁ-C','DÓŁ-R'];

function initGoal() {
  var net = document.getElementById('goal-net');
  net.innerHTML = '';
  for (var i = 0; i < 15; i++) {
    var cell = document.createElement('div');
    cell.className = 'goal-cell';
    cell.dataset.idx = i;
    net.appendChild(cell);
  }
}

function getPenaltySignal() {
  if (!canUseSignal()) { updateCounterUI('signal-counter-penalty'); return; }
  document.getElementById('win-section-penalty').style.display = 'none';
  var btn = document.getElementById('pen-signal-btn');
  btn.classList.add('loading');
  btn.innerHTML = '<span class="dots">Analizuję</span>';
  setTimeout(function() {
    incSignals();
    renderPenaltySignal();
    btn.classList.remove('loading');
    btn.innerHTML = '<span class="btn-icon">📡</span> Pobierz Sygnał';
    updateCounterUI('signal-counter-penalty');
  }, 1200 + Math.random() * 800);
}

function renderPenaltySignal() {
  var cells = document.querySelectorAll('.goal-cell');
  var total = 15;
  var indices = Array.from({length: total}, function(_, i) { return i; });
  for (var i = indices.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = indices[i]; indices[i] = indices[j]; indices[j] = t;
  }
  var blockedSet  = new Set(indices.slice(0, penBlocked));
  var safe        = indices.slice(penBlocked);
  var signalCount = Math.floor(Math.random() * 3) + 1;
  var signalSet   = new Set(safe.slice(0, signalCount));
  cells.forEach(function(cell, i) {
    cell.className = 'goal-cell';
    cell.textContent = '';
    setTimeout(function() {
      cell.classList.add('revealing-goal');
      if (signalSet.has(i)) { cell.classList.add('signal-zone'); cell.textContent = '✅'; }
    }, i * 35);
  });
  var chance  = (72 + Math.floor(Math.random() * 18)) + '%';
  var rowName = signalCount + (signalCount === 1 ? ' strefa' : ' strefy');
  var acc     = (83 + Math.floor(Math.random() * 12)) + '%';
  setTimeout(function() {
    document.getElementById('pen-stat-zone').textContent     = rowName;
    document.getElementById('pen-stat-chance').textContent   = chance;
    document.getElementById('pen-stat-accuracy').textContent = acc;
    document.querySelectorAll('#page-penalty .stat-box').forEach(function(b) { b.classList.add('active'); });
    document.getElementById('win-section-penalty').style.display = 'block';
  }, 15 * 35 + 100);
}

/* ════════════════════════════════
   AVIATOR
════════════════════════════════ */
var _aviatorCoeff = null;
var _aviatorWins  = 0;
var _aviatorTotal = 0;

function getAviatorCoeff() {
  // 90% шанс что коэффициент <= 1.49x
  if (Math.random() < 0.90) {
    return (1.01 + Math.random() * 0.48).toFixed(2);
  } else {
    return (1.50 + Math.random() * 1.50).toFixed(2);
  }
}

function updateAviatorDisplay() {
  var el = document.getElementById('vavada-id-text-avi');
  if (el) el.textContent = vavadaId ? '🎰 ID: ' + vavadaId : '🎰 Brak ID — ustaw w bocie';
  updateCounterUI('signal-counter-aviator');
}

function getAviatorSignal() {
  if (!canUseSignal()) {
    updateCounterUI('signal-counter-aviator');
    return;
  }
  var btn = document.getElementById('avi-signal-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

  document.getElementById('aviator-coeff').textContent = '...';
  document.getElementById('aviator-hint').textContent  = 'Analizowanie wzorców...';
  document.getElementById('win-section-aviator').style.display = 'none';

  setTimeout(function() {
    var coeff = getAviatorCoeff();
    _aviatorCoeff = coeff;
    _aviatorTotal++;

    document.getElementById('aviator-coeff').textContent = '×' + coeff;
    document.getElementById('avi-stat-coeff').textContent = '×' + coeff;

    var isLow = parseFloat(coeff) <= 1.49;
    document.getElementById('aviator-hint').textContent = isLow
      ? '⚠️ Wypłać przed ×1.50 — ryzyko spadku jest wysokie!'
      : '🚀 Algorytm wykrył wyższy potencjał — wypłać przy wskazanym kursie';

    document.getElementById('win-section-aviator').style.display = 'flex';
    document.getElementById('avi-stat-accuracy').textContent =
      _aviatorTotal > 0 ? Math.round((_aviatorWins / _aviatorTotal) * 100) + '%' : '—';

    incSignals();
    updateCounterUI('signal-counter-aviator');
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }, 1800);
}

/* ════════════════════════════════
   WHEEL OF FORTUNE
════════════════════════════════ */
var WHEEL_KEY   = 'mp_wheel_v1';
var _wAngle     = 0;   // cumulative rotation (preserves spin position)
var _wSpinning  = false;

// 8 segments — defines visual + prize mapping
var W_SEG = [
  { label: 'Brak',  sub: 'nagrody', emoji: '💨', type: 'nothing',  color: '#1e2040' },
  { label: '+2',    sub: 'sygnały', emoji: '📡', type: 'signals',  value: 2, color: '#065f46' },
  { label: 'Brak',  sub: 'nagrody', emoji: '💨', type: 'nothing',  color: '#1a1a2e' },
  { label: '+1',    sub: 'dzień',   emoji: '📅', type: 'days',     value: 1, color: '#92400e' },
  { label: 'Brak',  sub: 'nagrody', emoji: '💨', type: 'nothing',  color: '#172036' },
  { label: 'Brak',  sub: 'nagrody', emoji: '💨', type: 'nothing',  color: '#1a1a2e' },
  { label: '+2',    sub: 'dni',     emoji: '🎁', type: 'days',     value: 2, color: '#4c1d95' },
  { label: 'Brak',  sub: 'nagrody', emoji: '💨', type: 'nothing',  color: '#1e2040' },
];
var W_NOTHING_IDXS = [0, 2, 4, 5, 7];

function drawWheelCanvas() {
  var canvas = document.getElementById('wheel-canvas');
  if (!canvas || !canvas.getContext) return;

  // Hi-DPI fix: scale canvas by devicePixelRatio so it's crisp on retina/mobile
  var dpr  = window.devicePixelRatio || 1;
  var size = 280;
  canvas.width  = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width  = size + 'px';
  canvas.style.height = size + 'px';

  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var cx  = size / 2;
  var cy  = size / 2;
  var r   = cx - 5;
  var n   = W_SEG.length;
  var arc = (Math.PI * 2) / n;

  ctx.clearRect(0, 0, size, size);

  W_SEG.forEach(function(seg, i) {
    var a0 = i * arc - Math.PI / 2;
    var a1 = a0 + arc;
    // segment fill
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    // border
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // text
    var mid = a0 + arc / 2;
    var tr  = r * 0.63;
    ctx.save();
    ctx.translate(cx + Math.cos(mid) * tr, cy + Math.sin(mid) * tr);
    ctx.rotate(mid + Math.PI / 2);
    ctx.textAlign    = 'center';
    ctx.fillStyle    = '#fff';
    ctx.font         = 'bold 14px -apple-system, sans-serif';
    ctx.shadowColor  = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur   = 3;
    ctx.fillText(seg.label, 0, -4);
    ctx.font         = '10px -apple-system, sans-serif';
    ctx.fillStyle    = 'rgba(255,255,255,0.75)';
    ctx.fillText(seg.sub, 0, 9);
    ctx.shadowBlur   = 0;
    ctx.restore();
  });

  // outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(129,140,248,0.4)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // center cap
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#0d0d14';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#818cf8';
  ctx.fill();
}

function canSpinWheel() {
  try {
    var raw = localStorage.getItem(WHEEL_KEY);
    if (!raw) return true;
    return JSON.parse(raw).date !== todayStr();
  } catch(e) { return true; }
}

function markWheelSpun(prizeType) {
  localStorage.setItem(WHEEL_KEY, JSON.stringify({ date: todayStr(), prize: prizeType }));
}

// Weighted random prize — probabilities match legend
function pickWheelPrize() {
  var r = Math.random() * 100;
  if (r < 60) return 'nothing';
  if (r < 80) return 'signals';   // 20%
  if (r < 92) return 'days1';     // 12%
  return 'days2';                 //  8%
}

function prizeToSegIdx(prize) {
  if (prize === 'signals') return 1;
  if (prize === 'days1')   return 3;
  if (prize === 'days2')   return 6;
  // nothing: pick random nothing segment
  return W_NOTHING_IDXS[Math.floor(Math.random() * W_NOTHING_IDXS.length)];
}

function rotateTo(segIdx, onDone) {
  var segDeg    = 360 / W_SEG.length;          // 45°
  var segCenter = segIdx * segDeg + segDeg / 2; // center of target segment in degrees
  // angle that must face the pointer (top = 0°)
  var targetMod  = (360 - segCenter % 360 + 360) % 360;
  var currentMod = ((_wAngle % 360) + 360) % 360;
  var delta      = (targetMod - currentMod + 360) % 360;
  if (delta < segDeg) delta += 360; // at least one full segment gap
  _wAngle += delta + 360 * 6;       // 6 full spins for drama

  var canvas = document.getElementById('wheel-canvas');
  canvas.style.transition = 'transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
  canvas.style.transform  = 'rotate(' + _wAngle + 'deg)';
  setTimeout(onDone, 4700);
}

function updateWheelHomeBadge() {
  var badge = document.getElementById('wheel-home-badge');
  if (!badge) return;
  if (canSpinWheel()) {
    badge.textContent  = 'DOSTĘPNE!';
    badge.style.display = 'inline-block';
  } else {
    badge.textContent  = 'Jutro';
    badge.style.display = 'inline-block';
  }
}

function updateWheelUI() {
  var canSpin     = canSpinWheel();
  var btn         = document.getElementById('wheel-spin-btn');
  var cooldownMsg = document.getElementById('wheel-cooldown-msg');
  var subtitle    = document.getElementById('wheel-subtitle');
  var resultBox   = document.getElementById('wheel-result-box');

  if (canSpin) {
    if (btn)      { btn.disabled = false; btn.style.opacity = '1'; btn.innerHTML = '<span class="btn-icon">🎡</span> Zakręć!'; }
    if (cooldownMsg) cooldownMsg.textContent = '';
    if (subtitle)    subtitle.textContent = 'Kręć raz dziennie — zdobądź nagrodę!';
  } else {
    if (btn)      { btn.disabled = true; btn.style.opacity = '0.45'; }
    if (cooldownMsg) cooldownMsg.innerHTML = '⏱ Następna szansa za <b>' + timeToMidnight() + '</b>';
    if (subtitle)    subtitle.textContent = 'Już dziś kręciłeś — wróć jutro!';
  }
  updateWheelHomeBadge();
}

function showWheelResult(prize, seg) {
  var box   = document.getElementById('wheel-result-box');
  var emoji = document.getElementById('wheel-result-emoji');
  var txt   = document.getElementById('wheel-result-text');
  if (!box) return;

  emoji.textContent = seg.emoji;
  if (prize === 'nothing') {
    txt.innerHTML = '<b>Tym razem bez nagrody...</b><br>Spróbuj jutro! 🍀';
    box.className = 'wheel-result-box result-nothing';
  } else if (prize === 'signals') {
    txt.innerHTML = '🎉 <b>Wygrałeś +2 sygnały dziennie!</b><br>Dodatkowe sygnały aktywowane 🚀';
    box.className = 'wheel-result-box result-win';
    if (tg && tg.sendData) tg.sendData(JSON.stringify({ type: 'wheel_prize', prize: 'signals', value: 2 }));
  } else {
    var days = seg.value;
    var word = days === 1 ? 'dzień' : 'dni';
    txt.innerHTML = '🎉 <b>Wygrałeś +' + days + ' ' + word + ' subskrypcji!</b><br>Subskrypcja przedłużona 🚀';
    box.className = 'wheel-result-box result-win';
    if (tg && tg.sendData) tg.sendData(JSON.stringify({ type: 'wheel_prize', prize: 'days', value: days }));
  }
  box.style.display = 'flex';
}

function doSpinWheel() {
  if (_wSpinning || !canSpinWheel()) { updateWheelUI(); return; }
  _wSpinning = true;

  var btn     = document.getElementById('wheel-spin-btn');
  var resultBox = document.getElementById('wheel-result-box');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.innerHTML = '🎡 Kręcę...'; }
  if (resultBox) resultBox.style.display = 'none';

  var prize  = pickWheelPrize();
  var segIdx = prizeToSegIdx(prize);
  var seg    = W_SEG[segIdx];

  // Reset canvas transition instantly before spin
  var canvas = document.getElementById('wheel-canvas');
  canvas.style.transition = 'none';

  rotateTo(segIdx, function() {
    _wSpinning = false;
    markWheelSpun(prize);
    showWheelResult(prize, seg);
    updateWheelUI();
  });
}

function initWheelPage() {
  // Draw wheel (only if canvas is empty / first visit)
  var canvas = document.getElementById('wheel-canvas');
  if (canvas && canvas.style.transform === '') {
    _wAngle = 0;
  }
  drawWheelCanvas();
  // Restore current rotation without animation
  canvas.style.transition = 'none';
  canvas.style.transform  = 'rotate(' + _wAngle + 'deg)';
  updateWheelUI();
}

/* ════════════════════════════════
   SUBSCRIPTION TAB
════════════════════════════════ */
function initSubTab() {
  var days  = _days;
  var card  = document.getElementById('sub-card');
  var icon  = document.getElementById('sub-card-icon');
  var title = document.getElementById('sub-card-title');
  var det   = document.getElementById('sub-card-detail');

  if (days > 0) {
    card.classList.add('active');
    icon.textContent  = '✅';
    title.textContent = 'Subskrypcja aktywna';
    det.textContent   = 'Pozostało: ' + days + ' dni';
  } else {
    card.classList.add('inactive');
    icon.textContent  = '🔒';
    title.textContent = 'Brak subskrypcji';
    det.textContent   = 'Aktywuj kod lub kup plan poniżej';
  }

  // Kupno — otwiera czat @rmpl13
  addBtn('btn-buy', function() {
    if (tg && tg.openTelegramLink) tg.openTelegramLink('https://t.me/rmpl13');
    else window.open('https://t.me/rmpl13', '_blank');
  });

  // ── Referral section ──
  var refSection = document.getElementById('ref-section');
  if (refSection && _ref) {
    refSection.style.display = 'block';
    var botLink = 'https://t.me/' + (_params.get('bot') || 'MinesPredictorBot') + '?start=' + _ref;
    // try to read bot username from URL (passed by bot as &bot=Username)
    document.getElementById('ref-link-value').textContent = botLink;
    var bonusRow = document.getElementById('ref-bonus-row');
    if (bonusRow) {
      bonusRow.innerHTML = _bonus > 0
        ? '🎁 Twój bonus: <b>+' + _bonus + ' sygnałów/dzień</b> (dzięki ' + Math.floor(_bonus / 2) + ' znajomym)'
        : '🎁 Poleć znajomemu — zyskasz <b>+2 sygnały/dzień</b>!';
    }
    // Share button — Telegram native share
    addBtn('btn-ref-share', function() {
      var shareText = encodeURIComponent('Dołącz do MinesPredictor — algorytm do przewidywania min, penalty i Aviatora! 🎯');
      var shareUrl  = encodeURIComponent(botLink);
      var shareLink = 'https://t.me/share/url?url=' + shareUrl + '&text=' + shareText;
      if (tg && tg.openTelegramLink) tg.openTelegramLink(shareLink);
      else window.open(shareLink, '_blank');
    });
    // Copy button
    addBtn('btn-ref-copy', function() {
      var toast = document.getElementById('ref-copy-toast');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(botLink).catch(function() {});
      }
      if (toast) { toast.style.opacity = '1'; setTimeout(function() { toast.style.opacity = '0'; }, 2000); }
    });
  }

  // Aktywacja kodu
  addBtn('code-activate-btn', function() {
    var inp   = document.getElementById('code-input');
    var err   = document.getElementById('code-error');
    var code  = (inp.value || '').trim().toUpperCase();
    err.style.display = 'none';
    inp.style.borderColor = '';
    if (!code || code.length < 5) {
      inp.style.borderColor = '#ef4444';
      err.style.display = 'block';
      return;
    }
    if (tg && tg.sendData) {
      tg.sendData(JSON.stringify({ type: 'activate_code', code: code }));
    }
  });

  // Uppercase input auto
  var codeInp = document.getElementById('code-input');
  if (codeInp) {
    codeInp.addEventListener('input', function() {
      var pos = this.selectionStart;
      this.value = this.value.toUpperCase();
      this.setSelectionRange(pos, pos);
    });
  }
}

/* ════════════════════════════════
   DAILY OPTIMIZE
════════════════════════════════ */
function checkDailyOptimize() {
  var last  = localStorage.getItem(OPTIMIZE_KEY);
  var today = new Date().toDateString();
  if (last === today) return;

  document.getElementById('optimize-screen').style.display = 'flex';
  document.getElementById('main-screen').style.display     = 'none';

  var progress = 0, stepIdx = 0;
  var steps = ['Wczytywanie danych...','Kalibracja algorytmu...','Analiza wzorców...','Optymalizacja predykcji...','Finalizacja modelu...'];
  var bar   = document.getElementById('progress-bar');
  var label = document.getElementById('progress-label');
  var p     = document.querySelector('.optimize-box p');

  var interval = setInterval(function() {
    progress += 1 + Math.random() * 3;
    if (progress >= 100) progress = 100;
    bar.style.width   = progress + '%';
    label.textContent = Math.floor(progress) + '%';
    if (progress >= (stepIdx + 1) * 20 && stepIdx < steps.length - 1) {
      p.textContent = steps[++stepIdx];
    }
    if (progress >= 100) {
      clearInterval(interval);
      localStorage.setItem(OPTIMIZE_KEY, today);
      document.getElementById('algo-badge').textContent = '✅ Algo: zaktualizowany';
      setTimeout(function() {
        document.getElementById('optimize-screen').style.display = 'none';
        document.getElementById('main-screen').style.display     = 'flex';
      }, 800);
    }
  }, 60);
}

/* ════════════════════════════════
   HELPER: addBtn
════════════════════════════════ */
function addBtn(id, fn) {
  var el = document.getElementById(id);
  if (!el) return;
  var _busy = false;
  el.addEventListener('touchstart', function(e) {
    e.preventDefault();
    if (_busy) return;
    _busy = true;
    setTimeout(function() { _busy = false; }, 600);
    fn();
  }, { passive: false });
  el.addEventListener('click', function() {
    if (_busy) return;
    fn();
  });
}

/* ════════════════════════════════
   INIT
════════════════════════════════ */
if (!_uid) {
  // Gate screen — кнопка закрытия
  addBtn('gate-close-btn', function() { if (tg) tg.close(); });

} else {
  // Полная инициализация
  initGrid();
  initGoal();
  updateVavadaDisplay();
  syncDifficulty();
  document.getElementById('difficulty').addEventListener('input', syncDifficulty);

  // Sub days badge
  var subBadge = document.getElementById('sub-days-badge');
  if (subBadge) {
    if (_days > 0) {
      subBadge.textContent = '✅ ' + _days + ' dni';
      subBadge.style.display = 'block';
    }
  }

  // Показываем главный экран
  PAGES.forEach(function(p) {
    document.getElementById('page-' + p).style.display = p === 'home' ? 'flex' : 'none';
  });

  updateHomeCards();
  updateWheelHomeBadge();

  addBtn('signal-btn',     getSignal);
  addBtn('pen-signal-btn', getPenaltySignal);
  addBtn('avi-signal-btn', getAviatorSignal);
  addBtn('wheel-spin-btn', doSpinWheel);

  addBtn('win-btn-mines', function() {
    _aviatorWins; // just ref
    if (tg && tg.sendData) tg.sendData(JSON.stringify({ type: 'win', game: 'mines' }));
  });
  addBtn('win-btn-penalty', function() {
    if (tg && tg.sendData) tg.sendData(JSON.stringify({ type: 'win', game: 'penalty' }));
  });
  addBtn('win-btn-aviator', function() {
    _aviatorWins++;
    document.getElementById('avi-stat-wins').textContent = _aviatorWins;
    if (_aviatorTotal > 0)
      document.getElementById('avi-stat-accuracy').textContent = Math.round((_aviatorWins / _aviatorTotal) * 100) + '%';
    if (tg && tg.sendData) tg.sendData(JSON.stringify({ type: 'win', game: 'aviator' }));
  });

  updateCounterUI('signal-counter-mines');
  updateCounterUI('signal-counter-penalty');
  updateCounterUI('signal-counter-aviator');
  // 1s interval — live cooldown countdown + minute-level limit refresh
  setInterval(function() {
    updateCounterUI('signal-counter-mines');
    updateCounterUI('signal-counter-penalty');
    updateCounterUI('signal-counter-aviator');
    updateEkstraCounter();
  }, 1000);

  checkDailyOptimize();
}

/* ════════════════════════════════
   EKSTRA SIGNAL
════════════════════════════════ */
var EKSTRA_PASS       = 'ekstra2026penalt';
var EKSTRA_USED_KEY   = 'mp_ekstra_used';  // date string — used once per day
var EKSTRA_PASS_OK_KEY= 'mp_ekstra_unlocked';

function updateEkstraHomeBadge() {
  var badge = document.getElementById('ekstra-home-badge');
  if (!badge) return;
  if (_extra) {
    var used = localStorage.getItem(EKSTRA_USED_KEY);
    badge.textContent = used === new Date().toDateString() ? 'Użyty dziś' : 'DOSTĘPNE!';
  } else {
    badge.textContent = '🔒';
  }
}

function initEkstraPage() {
  var passOk  = _extra || localStorage.getItem(EKSTRA_PASS_OK_KEY) === '1';
  document.getElementById('ekstra-password-screen').style.display  = passOk ? 'none' : 'block';
  document.getElementById('ekstra-request-screen').style.display   = 'none';
  document.getElementById('ekstra-predictor-screen').style.display = 'none';

  if (passOk && _extra) {
    // Has full access — show predictor
    document.getElementById('ekstra-predictor-screen').style.display = 'block';
    initEkstraGoal();
    updateEkstraCounter();
  } else if (passOk && !_extra) {
    // Password unlocked but no access yet — show request screen
    document.getElementById('ekstra-request-screen').style.display = 'block';
    var pending = localStorage.getItem('mp_ekstra_pending') === '1';
    if (pending) {
      document.getElementById('ekstra-request-btn').style.display = 'none';
      document.getElementById('ekstra-pending-msg').style.display = 'block';
    }
  }

  // Password button
  addBtn('ekstra-pass-btn', function() {
    var val = document.getElementById('ekstra-pass-input').value;
    if (val === EKSTRA_PASS) {
      localStorage.setItem(EKSTRA_PASS_OK_KEY, '1');
      document.getElementById('ekstra-pass-error').style.display = 'none';
      document.getElementById('ekstra-password-screen').style.display = 'none';
      if (_extra) {
        document.getElementById('ekstra-predictor-screen').style.display = 'block';
        initEkstraGoal();
        updateEkstraCounter();
      } else {
        document.getElementById('ekstra-request-screen').style.display = 'block';
      }
    } else {
      document.getElementById('ekstra-pass-error').style.display = 'block';
    }
  });

  // Request button — uses deep link (more reliable than sendData on mobile)
  addBtn('ekstra-request-btn', function() {
    localStorage.setItem('mp_ekstra_pending', '1');
    var reqBtn = document.getElementById('ekstra-request-btn');
    if (reqBtn) reqBtn.style.display = 'none';
    document.getElementById('ekstra-pending-msg').style.display = 'block';
    var botName = _bot || 'rmpl13';
    var link = 'https://t.me/' + botName + '?start=ekstra_request';
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink(link);
    } else if (tg && tg.openLink) {
      tg.openLink(link);
    }
  });

  // Resend button — resets pending state
  addBtn('ekstra-resend-btn', function() {
    localStorage.removeItem('mp_ekstra_pending');
    document.getElementById('ekstra-pending-msg').style.display = 'none';
    var reqBtn = document.getElementById('ekstra-request-btn');
    if (reqBtn) reqBtn.style.display = 'block';
  });

  // Ekstra signal button
  addBtn('ekstra-signal-btn', function() {
    var used = localStorage.getItem(EKSTRA_USED_KEY);
    if (used === new Date().toDateString()) return;
    var sigBtn = document.getElementById('ekstra-signal-btn');
    if (sigBtn) sigBtn.disabled = true;
    if (sigBtn) sigBtn.innerHTML = '<span class="dots">Analizuję</span>';
    setTimeout(function() {
      renderEkstraSignal();
      localStorage.setItem(EKSTRA_USED_KEY, new Date().toDateString());
      if (sigBtn) { sigBtn.innerHTML = '<span class="btn-icon">⭐</span> Pobierz Ekstra Sygnał'; sigBtn.disabled = false; }
      updateEkstraCounter();
    }, 1500 + Math.random() * 800);
  });
}

function initEkstraGoal() {
  var net = document.getElementById('ekstra-goal-net');
  if (!net) return;
  net.innerHTML = '';
  for (var i = 0; i < 15; i++) {
    var cell = document.createElement('div');
    cell.className = 'goal-cell';
    cell.dataset.idx = i;
    net.appendChild(cell);
  }
}

function renderEkstraSignal() {
  var cells = document.querySelectorAll('#ekstra-goal-net .goal-cell');
  var total = 15;
  var indices = Array.from({length: total}, function(_, i) { return i; });
  for (var i = indices.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = indices[i]; indices[i] = indices[j]; indices[j] = t;
  }
  // 4-7 safe signal zones
  var signalCount = 4 + Math.floor(Math.random() * 4);
  var blocked     = 15 - signalCount;
  var blockedSet  = new Set(indices.slice(0, blocked));
  var signalSet   = new Set(indices.slice(blocked));

  cells.forEach(function(cell, i) {
    cell.className = 'goal-cell';
    cell.textContent = '';
    setTimeout(function() {
      if (blockedSet.has(i))      { cell.classList.add('blocked'); cell.textContent = '❌'; }
      else if (signalSet.has(i))  { cell.classList.add('signal-zone'); cell.textContent = '✅'; }
    }, i * 35);
  });

  var chance = Math.floor(85 + Math.random() * 12);
  setTimeout(function() {
    document.getElementById('ekstra-stat-zones').textContent    = signalCount;
    document.getElementById('ekstra-stat-chance').textContent   = signalCount + '/15';
    document.getElementById('ekstra-stat-accuracy').textContent = chance + '%';
  }, total * 35 + 100);
}

function updateEkstraCounter() {
  var el = document.getElementById('ekstra-signal-counter');
  if (!el || !_extra) return;
  var used = localStorage.getItem(EKSTRA_USED_KEY) === new Date().toDateString();
  if (used) {
    el.textContent = '⏳ Następny sygnał jutro';
    el.className = 'signal-counter cooldown-active';
    var btn = document.getElementById('ekstra-signal-btn');
    if (btn) btn.disabled = true;
  } else {
    el.textContent = '⭐ 1 sygnał dostępny dziś';
    el.className = 'signal-counter';
    var btn = document.getElementById('ekstra-signal-btn');
    if (btn) btn.disabled = false;
  }
}
