(() => {
  // ---- ゲーミフィケーション UI ----

  async function loadGamification() {
    try {
      const res  = await fetch('/api/gamification');
      const data = await res.json();
      updateGamificationUI(data);
    } catch (_) {}
  }

  function updateGamificationUI(data) {
    const levelBadge = document.getElementById('levelBadge');
    const xpText     = document.getElementById('xpText');
    const xpBarFg    = document.getElementById('xpBarFg');
    const streakBadge = document.getElementById('streakBadge');
    const badgesGrid  = document.getElementById('badgesGrid');

    if (levelBadge) levelBadge.textContent = `Lv.${data.level}`;
    if (xpText)     xpText.textContent = `${data.xp_in_level} / ${data.xp_per_level} XP`;
    if (xpBarFg) {
      const pct = data.xp_per_level > 0
        ? (data.xp_in_level / data.xp_per_level) * 100
        : 0;
      xpBarFg.style.width = `${pct}%`;
    }
    if (streakBadge) {
      streakBadge.textContent = `🔥 ${data.streak}日`;
      streakBadge.classList.toggle('active', data.streak > 0);
    }

    if (badgesGrid) {
      badgesGrid.innerHTML = '';
      (data.badges || []).forEach(badge => {
        const el = document.createElement('div');
        el.className = 'badge-item' + (badge.earned ? ' earned' : '');
        el.title = badge.description;
        el.innerHTML =
          `<span class="badge-emoji">${badge.emoji}</span>` +
          `<span class="badge-name">${badge.name}</span>`;
        badgesGrid.appendChild(el);
      });
    }
  }

  // ---- 週間 / 月間 統計グラフ ----

  let statsVisible = false;
  let currentDays  = 7;

  window.toggleStats = function () {
    const section  = document.getElementById('statsSection');
    const toggleBtn = document.getElementById('statsToggleBtn');
    if (!section) return;
    statsVisible = !statsVisible;
    section.style.display = statsVisible ? 'block' : 'none';
    if (toggleBtn) {
      toggleBtn.textContent = statsVisible ? '📊 統計を閉じる' : '📊 週間 / 月間統計';
    }
    if (statsVisible) loadStats(currentDays);
  };

  window.showStats = function (days) {
    currentDays = days;
    const tabWeekly  = document.getElementById('tabWeekly');
    const tabMonthly = document.getElementById('tabMonthly');
    if (tabWeekly)  tabWeekly.classList.toggle('active', days === 7);
    if (tabMonthly) tabMonthly.classList.toggle('active', days === 30);
    loadStats(days);
  };

  async function loadStats(days) {
    try {
      const res  = await fetch(`/api/stats?days=${days}`);
      const data = await res.json();
      renderChart(data.stats, days);
    } catch (_) {}
  }

  function renderChart(stats, days) {
    const container = document.getElementById('chartContainer');
    if (!container || !stats || stats.length === 0) return;

    const maxSessions = Math.max(...stats.map(d => d.completed_sessions), 1);
    const isWeekly    = days <= 7;
    const barW        = isWeekly ? 26 : 10;
    const gap         = isWeekly ? 8  : 4;
    const chartH      = 72;
    const labelH      = isWeekly ? 18 : 0;
    const totalW      = stats.length * (barW + gap) - gap;
    const svgH        = chartH + labelH + 14; // +14 for value labels above bars

    const bars = stats.map((d, i) => {
      const barH  = d.completed_sessions > 0
        ? Math.max(4, Math.round((d.completed_sessions / maxSessions) * chartH))
        : 0;
      const x     = i * (barW + gap);
      const y     = chartH - barH + 14; // offset by 14 for value label space
      const color = barH > 0 ? '#6c63d5' : '#ececec';
      const label = d.date.slice(5).replace('-', '/'); // MM/DD

      const valueLabel = d.completed_sessions > 0
        ? `<text x="${x + barW / 2}" y="${y - 3}" text-anchor="middle" font-size="9" fill="#555">${d.completed_sessions}</text>`
        : '';
      const dateLabel = isWeekly
        ? `<text x="${x + barW / 2}" y="${chartH + labelH + 14}" text-anchor="middle" font-size="9" fill="#aaa">${label}</text>`
        : '';

      return `<g>${valueLabel}<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="3"/>${dateLabel}</g>`;
    }).join('');

    container.innerHTML =
      `<svg viewBox="0 0 ${totalW} ${svgH}" style="width:100%;display:block;overflow:visible">` +
      bars +
      `</svg>`;
  }

  // ---- 公開 API（timer.js から呼ばれる） ----
  window.refreshGamification = loadGamification;

  // ---- 初期化 ----
  loadGamification();
})();
