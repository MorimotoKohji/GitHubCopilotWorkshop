(() => {
  // ---- デフォルト設定 ----
  const DEFAULTS = {
    workMinutes:        25,
    shortBreakMinutes:  5,
    theme:              'light',
    soundStart:         true,
    soundEnd:           true,
    soundTick:          false,
  };

  // ---- 設定の読み込み / 保存 ----
  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('pomodoroSettings') || '{}');
      return Object.assign({}, DEFAULTS, saved);
    } catch (_) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function saveSettings(s) {
    try { localStorage.setItem('pomodoroSettings', JSON.stringify(s)); } catch (_) {}
  }

  let settings = loadSettings();

  // ---- 定数 ----
  const PHASE_COLORS = {
    work:       '#6c63d5',
    shortBreak: '#4caf7d',
    longBreak:  '#4caf7d',
  };
  const PHASE_LABELS = {
    work:       '作業中',
    shortBreak: '短い休憩',
    longBreak:  '長い休憩',
  };
  const SESSIONS_PER_CYCLE = 4;
  const CIRCUMFERENCE = 2 * Math.PI * 68; // r=68

  // ---- DOM ----
  const ringFg        = document.getElementById('ringFg');
  const timeDisplay   = document.getElementById('timeDisplay');
  const startBtn      = document.getElementById('startBtn');
  const phaseLabel    = document.getElementById('phaseLabel');
  const cycleCounter  = document.getElementById('cycleCounter');
  const sessionCount  = document.getElementById('sessionCount');
  const focusTime     = document.getElementById('focusTime');
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsPanel  = document.getElementById('settingsPanel');

  ringFg.style.strokeDasharray = CIRCUMFERENCE;

  // ---- 状態 ----
  let currentPhase  = 'work';
  let cyclePosition = 0;
  let totalSeconds  = settings.workMinutes * 60;
  let remaining     = totalSeconds;
  let intervalId    = null;
  let running       = false;

  // ---- サウンド ----
  function playSound(type) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (type === 'start'  && !settings.soundStart) return;
    if (type === 'end'    && !settings.soundEnd)   return;
    if (type === 'tick'   && !settings.soundTick)  return;
    try {
      const ctx  = new AudioCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'start') {
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'end') {
        osc.frequency.value = 523;
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
      } else if (type === 'tick') {
        osc.type = 'square';
        osc.frequency.value = 1000;
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch (_) {}
  }

  // ---- テーマ ----
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? '' : theme);
    const opts = document.querySelectorAll('#themeOptions .opt-btn');
    opts.forEach(b => b.classList.toggle('active', b.dataset.value === theme));
  }

  // ---- 進捗 API ----
  async function loadProgress() {
    try {
      const res  = await fetch('/api/progress');
      const data = await res.json();
      updateProgressUI(data);
    } catch (_) {}
  }

  function updateProgressUI(data) {
    sessionCount.textContent = data.completed_sessions;
    const h = Math.floor(data.total_focus_minutes / 60);
    const m = data.total_focus_minutes % 60;
    focusTime.textContent = h > 0 ? `${h}時間${m}分` : `${m}分`;
  }

  async function notifyComplete() {
    try {
      const res  = await fetch('/api/progress/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: settings.workMinutes }),
      });
      const data = await res.json();
      updateProgressUI(data);
    } catch (_) {}
  }

  // ---- 描画 ----
  function render() {
    const min = String(Math.floor(remaining / 60)).padStart(2, '0');
    const sec = String(remaining % 60).padStart(2, '0');
    timeDisplay.textContent = `${min}:${sec}`;
    ringFg.style.strokeDashoffset = CIRCUMFERENCE * (1 - (remaining / totalSeconds));
  }

  function renderCycleCounter() {
    if (!cycleCounter) return;
    if (currentPhase === 'work') {
      cycleCounter.textContent = `${cyclePosition + 1} / ${SESSIONS_PER_CYCLE}`;
    } else {
      cycleCounter.textContent = PHASE_LABELS[currentPhase];
    }
  }

  // ---- フェーズ切り替え ----
  function phaseMinutes(phase) {
    if (phase === 'work') return settings.workMinutes;
    if (phase === 'shortBreak') return settings.shortBreakMinutes;
    return 15; // longBreak は固定
  }

  function phaseColor(phase) {
    if (document.documentElement.getAttribute('data-theme') === 'focus') {
      return phase === 'work' ? '#b0a8f0' : '#7ed6a8';
    }
    return PHASE_COLORS[phase];
  }

  function switchToPhase(phase) {
    currentPhase = phase;
    totalSeconds = phaseMinutes(phase) * 60;
    remaining    = totalSeconds;
    running      = false;
    clearInterval(intervalId);
    ringFg.style.stroke    = phaseColor(phase);
    phaseLabel.textContent = PHASE_LABELS[phase];
    startBtn.textContent   = '開始';
    renderCycleCounter();
    render();
  }

  function advancePhase() {
    if (currentPhase === 'work') {
      cyclePosition++;
      if (cyclePosition >= SESSIONS_PER_CYCLE) {
        cyclePosition = 0;
        switchToPhase('longBreak');
      } else {
        switchToPhase('shortBreak');
      }
    } else {
      switchToPhase('work');
    }
  }

  // ---- tick ----
  function tick() {
    if (remaining <= 0) {
      clearInterval(intervalId);
      running = false;
      playSound('end');
      if (currentPhase === 'work') {
        notifyComplete().then(() => advancePhase());
      } else {
        advancePhase();
      }
      return;
    }
    remaining--;
    playSound('tick');
    render();
  }

  // ---- 開始 / 一時停止 ----
  window.toggleTimer = function () {
    if (running) {
      clearInterval(intervalId);
      running = false;
      startBtn.textContent   = '再開';
      phaseLabel.textContent = PHASE_LABELS[currentPhase] + '（一時停止）';
    } else {
      running = true;
      startBtn.textContent   = '一時停止';
      phaseLabel.textContent = PHASE_LABELS[currentPhase];
      playSound('start');
      intervalId = setInterval(tick, 1000);
    }
  };

  // ---- リセット ----
  window.resetTimer = function () {
    clearInterval(intervalId);
    currentPhase  = 'work';
    cyclePosition = 0;
    running       = false;
    switchToPhase('work');
  };

  // ---- 設定パネル ----
  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('open');
  });

  // ---- 作業時間変更 ----
  window.setWorkMinutes = function (minutes) {
    settings.workMinutes = minutes;
    saveSettings(settings);
    const opts = document.querySelectorAll('#workTimeOptions .opt-btn');
    opts.forEach(b => b.classList.toggle('active', Number(b.dataset.value) === minutes));
    if (currentPhase === 'work') switchToPhase('work');
  };

  // ---- 休憩時間変更 ----
  window.setBreakMinutes = function (minutes) {
    settings.shortBreakMinutes = minutes;
    saveSettings(settings);
    const opts = document.querySelectorAll('#breakTimeOptions .opt-btn');
    opts.forEach(b => b.classList.toggle('active', Number(b.dataset.value) === minutes));
    if (currentPhase === 'shortBreak') switchToPhase('shortBreak');
  };

  // ---- テーマ変更 ----
  window.setTheme = function (theme) {
    settings.theme = theme;
    saveSettings(settings);
    applyTheme(theme);
    // リングの色をテーマに合わせて更新
    ringFg.style.stroke = phaseColor(currentPhase);
  };

  // ---- サウンドトグル ----
  window.toggleSound = function (type) {
    const key = type === 'start' ? 'soundStart' : type === 'end' ? 'soundEnd' : 'soundTick';
    const btnId = type === 'start' ? 'soundStartBtn' : type === 'end' ? 'soundEndBtn' : 'soundTickBtn';
    settings[key] = !settings[key];
    saveSettings(settings);
    document.getElementById(btnId).classList.toggle('active', settings[key]);
  };

  // ---- 設定UIの初期反映 ----
  function initSettingsUI() {
    // 作業時間
    document.querySelectorAll('#workTimeOptions .opt-btn').forEach(b => {
      b.classList.toggle('active', Number(b.dataset.value) === settings.workMinutes);
    });
    // 休憩時間
    document.querySelectorAll('#breakTimeOptions .opt-btn').forEach(b => {
      b.classList.toggle('active', Number(b.dataset.value) === settings.shortBreakMinutes);
    });
    // テーマ
    applyTheme(settings.theme);
    // サウンドボタン
    document.getElementById('soundStartBtn').classList.toggle('active', settings.soundStart);
    document.getElementById('soundEndBtn').classList.toggle('active', settings.soundEnd);
    document.getElementById('soundTickBtn').classList.toggle('active', settings.soundTick);
  }

  // ---- 初期化 ----
  initSettingsUI();
  totalSeconds = settings.workMinutes * 60;
  remaining    = totalSeconds;
  ringFg.style.stroke = phaseColor('work');
  renderCycleCounter();
  render();
  loadProgress();
})();

