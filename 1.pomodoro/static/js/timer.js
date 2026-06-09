(() => {
  // ---- 定数 ----
  const PHASES = {
    work:       { label: '作業中',   minutes: 25, color: '#6c63d5' },
    shortBreak: { label: '短い休憩', minutes: 5,  color: '#4caf7d' },
    longBreak:  { label: '長い休憩', minutes: 15, color: '#4caf7d' },
  };
  const SESSIONS_PER_CYCLE = 4;
  const CIRCUMFERENCE = 2 * Math.PI * 68; // r=68

  // 作業フェーズ用カラーキーフレーム（blue → yellow → red）
  const WORK_COLORS = [
    { ratio: 1.0, r: 108, g:  99, b: 213 }, // blue  (#6c63d5)
    { ratio: 0.5, r: 240, g: 170, b:  30 }, // yellow (#f0aa1e)
    { ratio: 0.0, r: 220, g:  53, b:  69 }, // red   (#dc3545)
  ];

  // ---- DOM ----
  const ringFg          = document.getElementById('ringFg');
  const timeDisplay     = document.getElementById('timeDisplay');
  const startBtn        = document.getElementById('startBtn');
  const phaseLabel      = document.getElementById('phaseLabel');
  const cycleCounter    = document.getElementById('cycleCounter');
  const sessionCount    = document.getElementById('sessionCount');
  const focusTime       = document.getElementById('focusTime');
  const particleCanvas  = document.getElementById('particleCanvas');

  ringFg.style.strokeDasharray = CIRCUMFERENCE;

  // ---- 状態 ----
  let currentPhase  = 'work';
  let cyclePosition = 0;      // 現サイクルで完了した作業セッション数（0〜3）
  let totalSeconds  = PHASES.work.minutes * 60;
  let remaining     = totalSeconds;
  let intervalId    = null;
  let running       = false;

  // ---- カラー補間 ----
  function lerpColor(ratio) {
    // WORK_COLORSは ratio 降順（1.0 → 0.0）
    for (let i = 0; i < WORK_COLORS.length - 1; i++) {
      const hi = WORK_COLORS[i];
      const lo = WORK_COLORS[i + 1];
      if (ratio >= lo.ratio) {
        const t = (ratio - lo.ratio) / (hi.ratio - lo.ratio);
        const r = Math.round(lo.r + t * (hi.r - lo.r));
        const g = Math.round(lo.g + t * (hi.g - lo.g));
        const b = Math.round(lo.b + t * (hi.b - lo.b));
        return `rgb(${r},${g},${b})`;
      }
    }
    const c = WORK_COLORS[WORK_COLORS.length - 1];
    return `rgb(${c.r},${c.g},${c.b})`;
  }

  // パーティクル設定定数
  const MAX_PARTICLES          = 60;
  const PARTICLE_SIZE_MIN      = 1;
  const PARTICLE_SIZE_MAX      = 3;   // size = MIN + random * MAX
  const PARTICLE_ALPHA_MIN     = 0.1;
  const PARTICLE_ALPHA_MAX     = 0.4; // alpha = MIN + random * MAX
  const PARTICLE_H_SPEED       = 0.4; // 水平速度の最大振れ幅
  const PARTICLE_V_SPEED_MIN   = 0.2; // 上方向の最小速度
  const PARTICLE_V_SPEED_RANGE = 0.5; // 上方向の速度幅
  const PARTICLE_LIFE_MIN      = 100;
  const PARTICLE_LIFE_RANGE    = 200; // life = MIN + random * RANGE

  // ---- パーティクルシステム ----
  const ctx = particleCanvas ? particleCanvas.getContext('2d') : null;
  let particles = [];
  let particleAnimId = null;

  function resizeCanvas() {
    if (!particleCanvas) return;
    particleCanvas.width  = window.innerWidth;
    particleCanvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x:     Math.random() * particleCanvas.width,
      y:     Math.random() * particleCanvas.height,
      r:     Math.random() * PARTICLE_SIZE_MAX + PARTICLE_SIZE_MIN,
      alpha: Math.random() * PARTICLE_ALPHA_MAX + PARTICLE_ALPHA_MIN,
      vx:    (Math.random() - 0.5) * PARTICLE_H_SPEED,
      vy:    -(Math.random() * PARTICLE_V_SPEED_RANGE + PARTICLE_V_SPEED_MIN),
      life:  Math.random() * PARTICLE_LIFE_RANGE + PARTICLE_LIFE_MIN,
      age:   0,
    };
  }

  function drawParticles() {
    if (!ctx) return;
    ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

    // 新パーティクル補充
    while (particles.length < MAX_PARTICLES) {
      particles.push(createParticle());
    }

    particles = particles.filter(p => p.age < p.life);

    for (const p of particles) {
      const fade = 1 - p.age / p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${p.alpha * fade})`;
      ctx.fill();
      p.x   += p.vx;
      p.y   += p.vy;
      p.age += 1;
    }

    particleAnimId = requestAnimationFrame(drawParticles);
  }

  function startParticles() {
    if (particleAnimId || !particleCanvas) return;
    resizeCanvas();
    particles = [];
    particleCanvas.classList.add('active');
    drawParticles();
  }

  function stopParticles() {
    if (particleAnimId) {
      cancelAnimationFrame(particleAnimId);
      particleAnimId = null;
    }
    if (particleCanvas) {
      particleCanvas.classList.remove('active');
      if (ctx) ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    }
    particles = [];
  }

  if (particleCanvas) {
    window.addEventListener('resize', resizeCanvas);
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

    // 作業フェーズ中は残り時間の割合に応じてリングの色を変化
    if (currentPhase === 'work') {
      const ratio = remaining / totalSeconds;
      ringFg.style.stroke = lerpColor(ratio);
    }
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
    phaseLabel.textContent = PHASES[phase].label;
    startBtn.textContent   = '開始';
    renderCycleCounter();
    render();

    // 休憩フェーズはフェーズ固有の色を使用し、パーティクルを停止
    if (phase !== 'work') {
      ringFg.style.stroke = PHASES[phase].color;
      stopParticles();
    }
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
      stopParticles();
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
      if (currentPhase === 'work') stopParticles();
    } else {
      running = true;
      startBtn.textContent   = '一時停止';
      phaseLabel.textContent = PHASES[currentPhase].label;
      intervalId = setInterval(tick, 1000);
      if (currentPhase === 'work') startParticles();
    }
  };

  // ---- リセット ----
  window.resetTimer = function () {
    clearInterval(intervalId);
    stopParticles();
    currentPhase  = 'work';
    cyclePosition = 0;
    running       = false;
    switchToPhase('work');
  };

  // ---- 初期化 ----
  ringFg.style.stroke = lerpColor(1.0);
  renderCycleCounter();
  render();
  loadProgress();
})();
