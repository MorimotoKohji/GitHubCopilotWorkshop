(() => {
  // ---- 定数 ----
  const PHASES = {
    work:       { label: '作業中',   minutes: 25, color: '#6c63d5' },
    shortBreak: { label: '短い休憩', minutes: 5,  color: '#4caf7d' },
    longBreak:  { label: '長い休憩', minutes: 15, color: '#4caf7d' },
  };
  const SESSIONS_PER_CYCLE = 4;
  const CIRCUMFERENCE = 2 * Math.PI * 68; // r=68

  // ---- DOM ----
  const ringFg       = document.getElementById('ringFg');
  const timeDisplay  = document.getElementById('timeDisplay');
  const startBtn     = document.getElementById('startBtn');
  const phaseLabel   = document.getElementById('phaseLabel');
  const cycleCounter = document.getElementById('cycleCounter');
  const sessionCount = document.getElementById('sessionCount');
  const focusTime    = document.getElementById('focusTime');

  ringFg.style.strokeDasharray = CIRCUMFERENCE;

  // ---- 状態 ----
  let currentPhase  = 'work';
  let cyclePosition = 0;      // 現サイクルで完了した作業セッション数（0〜3）
  let totalSeconds  = PHASES.work.minutes * 60;
  let remaining     = totalSeconds;
  let intervalId    = null;
  let running       = false;

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
        body: JSON.stringify({ minutes: PHASES.work.minutes }),
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
      cycleCounter.textContent = PHASES[currentPhase].label;
    }
  }

  // ---- フェーズ切り替え ----
  function switchToPhase(phase) {
    currentPhase = phase;
    totalSeconds = PHASES[phase].minutes * 60;
    remaining    = totalSeconds;
    running      = false;
    clearInterval(intervalId);
    ringFg.style.stroke    = PHASES[phase].color;
    phaseLabel.textContent = PHASES[phase].label;
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
      if (currentPhase === 'work') {
        notifyComplete().then(() => advancePhase());
      } else {
        advancePhase();
      }
      return;
    }
    remaining--;
    render();
  }

  // ---- 開始 / 一時停止 ----
  window.toggleTimer = function () {
    if (running) {
      clearInterval(intervalId);
      running = false;
      startBtn.textContent   = '再開';
      phaseLabel.textContent = PHASES[currentPhase].label + '（一時停止）';
    } else {
      running = true;
      startBtn.textContent   = '一時停止';
      phaseLabel.textContent = PHASES[currentPhase].label;
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

  // ---- 初期化 ----
  ringFg.style.stroke = PHASES.work.color;
  renderCycleCounter();
  render();
  loadProgress();
})();

