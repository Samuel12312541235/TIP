/* 日序 Dayflow — 应用外壳、路由、交互 */
(function () {
  'use strict';
  const { qs, qsa, el, esc, icon, toast, stagger, animateNumber, ringProgress, todayISO, addDays, startOfWeek, parseISO, iso, pad, md, weekday, diffDays, copyText } = window.DF;
  const R = window.Render;

  const App = {
    payload: null,
    state: null,
    domainMap: {},
    autostart: false,
    api: { port: 0, token: '' },
    hardware: null,
    versions: {},
    paths: {},
    ui: {
      view: 'today',
      filter: 'all',
      showDone: false,
      plannerWeeks: 4,
      plannerOffset: 0,
      dailyDay: 'today',
      ganttWeeks: 6,
      ganttOffset: 0,
      ganttDone: false,
      ganttFilter: 'all',
      ganttKeyOnly: false,
      calCursor: null,
      calSel: null,
      agentMsgs: [],
      agentThinking: false,
      agentImport: null,
      agentMode: 'auto',
      showToken: false,
      perfHud: false,
      modulesOpen: false,
      llmOpen: undefined,
      firstPaint: true,
    },
    draft: null,
    trackDraft: null,
    courseDraft: null,
    palette: { open: false, query: '', index: 0, rows: [] },
    savedScroll: 0,
  };

  /* ── 数据 ─────────────────────────────────────────────── */
  function setPayload(p) {
    App.payload = p;
    App.state = p.state;
    App.domainMap = {};
    (p.state.domains || []).forEach((d) => (App.domainMap[d.id] = d));
    App.autostart = !!p.autostart;
    App.api = p.api || App.api;
    App.hardware = p.hardware || App.hardware;
    App.versions = p.versions || {};
    App.paths = p.paths || {};
    applyHardwareClasses();
    applyMotion();
  }

  function ctx() {
    return {
      state: App.state,
      today: App.payload.today,
      hardware: App.hardware,
      api: App.api,
      autostart: App.autostart,
      versions: App.versions,
      paths: App.paths,
      domainMap: App.domainMap,
      ui: App.ui,
    };
  }

  function applyHardwareClasses() {
    const hw = App.hardware || {};
    const root = document.documentElement;
    const quality = hw.profile || 'balanced';
    root.classList.toggle('quality-lite', quality === 'lite');
    root.classList.toggle('quality-balanced', quality === 'balanced');
    root.classList.toggle('compact', !!(hw.auto && hw.auto.compact));
  }

  function applyMotion() {
    const mode = App.state.settings.motion || 'auto';
    const hw = App.hardware || {};
    let resolved = 'full';
    if (mode === 'calm') resolved = 'calm';
    else if (mode === 'full') resolved = 'full';
    else resolved = 'full';
    document.body.dataset.motion = resolved;
  }

  /* ── Chrome ───────────────────────────────────────────── */
  const NAV = [
    { id: 'today', label: '今日', icon: 'today', key: '1' },
    { id: 'daily', label: '安排', icon: 'daily', key: '2' },
    { id: 'overview', label: '总览', icon: 'overview', key: '3' },
    { id: 'planner', label: '排期', icon: 'planner', key: '4' },
    { id: 'gantt', label: '甘特', icon: 'gantt', key: '5' },
    { id: 'calendar', label: '日历', icon: 'calendar', key: '6' },
    { id: 'projects', label: '规划', icon: 'target', key: '7' },
    { id: 'agent', label: '登记', icon: 'spark', key: '8' },
    { id: 'settings', label: '设置', icon: 'settings', key: '9' },
  ];

  /* 每个模块的入场轨迹：只做小位移 + 淡入，保证切换跟手 */
  const MOTION = {
    today: { x: 8, y: 6, dur: 220 },
    daily: { x: -14, y: 5, dur: 240 },
    overview: { x: 0, y: 14, dur: 250 },
    planner: { x: 18, y: 0, dur: 240 },
    gantt: { x: 22, y: 0, dur: 250 },
    calendar: { x: -16, y: 5, dur: 240 },
    projects: { x: 0, y: 12, dur: 250 },
    agent: { x: 0, y: 8, dur: 220 },
    settings: { x: 0, y: 6, dur: 220 },
  };

  function renderChrome() {
    const s = App.state;
    const today = App.payload.today.today;
    const open = s.items.filter((i) => i.status !== 'done' && i.status !== 'dropped');
    const todayOpen = open.filter((i) => i.date === today || (i.endDate && i.date <= today && i.endDate >= today));

    qs('#nav').innerHTML = NAV.map(
      (n) => `<button class="nav-item ${App.ui.view === n.id ? 'active' : ''}" data-act="nav" data-view="${n.id}" title="${n.label}（${n.key}）">
        ${icon(n.icon)}<span class="nav-label">${n.label}</span>${n.id === 'today' && todayOpen.length ? `<span class="nav-count">${todayOpen.length}</span>` : ''}
      </button>`
    ).join('');
    const navInd = qs('#navInd');
    if (navInd) {
      const idx = Math.max(0, NAV.findIndex((n) => n.id === App.ui.view));
      navInd.style.transform = `translateY(${idx * 48}px)`;
    }

    const ws = startOfWeek(today, 1);
    const weekAll = s.items.filter((i) => i.date >= ws && i.date <= addDays(ws, 6));
    const weekDone = weekAll.filter((i) => i.status === 'done');
    const pct = weekAll.length ? Math.round((weekDone.length / weekAll.length) * 100) : 0;
    qs('#sideCard').innerHTML = `<div class="sc-top"><span class="sc-week">第 ${App.payload.today.week} 周</span><span class="sc-num">${weekDone.length}/${weekAll.length}</span></div>
      <div class="sc-title">${esc(s.settings.focusTitle || '本周焦点')}</div>
      <div class="sc-bar"><i style="width:${pct}%"></i></div>`;
    qs('#sideCard').style.cursor = 'pointer';
    qs('#sideCard').dataset.act = 'nav';
    qs('#sideCard').dataset.view = 'today';

    qs('#agentPort').textContent = App.api.port || 7788;
    qs('#brandMark').innerHTML = window.DF.BRAND;
    qs('#paletteIcon').innerHTML = icon('search');
    qs('#modulesIcon').innerHTML = icon('overview');
    qs('#formIcon').innerHTML = icon('form');
    qs('#newIcon').innerHTML = icon('plus');

    const clock = qs('.tb-clock');
    if (!clock) {
      const drag = qs('.tb-drag');
      if (drag && !drag.firstElementChild) drag.appendChild(el('<div class="tb-clock"></div>'));
    }
    const clockEl = qs('.tb-clock');
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = `${now.getMonth() + 1} 月 ${now.getDate()} 日 ${weekday(todayISO())} · ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }
  }

  /* ── 视图渲染 ─────────────────────────────────────────── */
  function renderView(opts = {}) {
    const view = qs('#view');
    const animate = !!opts.animate;
    const prevScroll = animate ? 0 : view.scrollTop;
    const activeAgentInput = document.activeElement && document.activeElement.id === 'agentInput' ? document.activeElement.value : null;

    if (App.ui.view === 'calendar') {
      if (!App.ui.calCursor) App.ui.calCursor = App.payload.today.today.slice(0, 7);
      if (!App.ui.calSel) App.ui.calSel = App.payload.today.today;
    }
    const html = R[App.ui.view] ? R[App.ui.view](ctx()) : '<div class="empty">未知视图</div>';
    view.innerHTML = html;

    if (activeAgentInput !== null) {
      const input = qs('#agentInput');
      if (input) input.value = activeAgentInput;
    }

    if (animate) {
      stagger(view);
      animateView(view);
      view.scrollTop = 0;
    } else {
      qsa('.rise, .pop', view).forEach((n) => (n.style.animation = 'none'));
      view.scrollTop = prevScroll;
    }

    if (App.ui.view === 'today') {
      const ring = qs('#ringValue');
      if (ring) {
        const s = App.state;
        const t = App.payload.today.today;
        const total = s.items.filter((i) => i.date === t || (i.endDate && i.date <= t && i.endDate >= t)).length;
        const done = s.items.filter((i) => i.status === 'done' && (i.completedAt || '').slice(0, 10) === t).length;
        ringProgress(ring, total ? done / total : 0, 64);
      }
    }
    qsa('[data-count]', view).forEach((n) => animateNumber(n, Number(n.dataset.count) || 0, animate ? 700 : 1));

    updateCountdown();
    const cl = qs('#agentScroll');
    if (cl) cl.scrollTop = cl.scrollHeight;
  }

  function paint(opts = {}) {
    document.documentElement.classList.toggle('senior', !!(App.state && App.state.settings && App.state.settings.senior));
    renderChrome();
    renderView(opts);
  }

  /* ── 路由 ─────────────────────────────────────────────── */
  let switching = false;
  let pendingView = null;

  function buildViewEl() {
    if (App.ui.view === 'calendar') {
      if (!App.ui.calCursor) App.ui.calCursor = App.payload.today.today.slice(0, 7);
      if (!App.ui.calSel) App.ui.calSel = App.payload.today.today;
    }
    const html = R[App.ui.view] ? R[App.ui.view](ctx()) : '<div class="empty">未知视图</div>';
    const wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    return wrap.firstElementChild || wrap;
  }

  function decorateIncoming(root) {
    if (!root) return;
    if (App.ui.view === 'today') {
      const ring = qs('#ringValue', root);
      if (ring) {
        const s = App.state;
        const t = App.payload.today.today;
        const total = s.items.filter((i) => i.date === t || (i.endDate && i.date <= t && i.endDate >= t)).length;
        const done = s.items.filter((i) => i.status === 'done' && (i.completedAt || '').slice(0, 10) === t).length;
        ringProgress(ring, total ? done / total : 0, 64);
      }
    }
    qsa('[data-count]', root).forEach((n) => animateNumber(n, Number(n.dataset.count) || 0, 700));
    updateCountdown();
    const cl = qs('#agentScroll', root);
    if (cl) cl.scrollTop = cl.scrollHeight;
    animateView(root);
  }

  async function go(view) {
    if (App.ui.modulesOpen) closeModules();
    if (App.ui.view === view) {
      pendingView = null;
      qs('#view').scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (switching) {
      pendingView = view;
      return;
    }
    switching = true;
    try {
      const stage = qs('#view');
      const from = NAV.findIndex((n) => n.id === App.ui.view);
      const to = NAV.findIndex((n) => n.id === view);
      const dir = to >= from ? 1 : -1;
      const m = MOTION[view] || { x: 20, y: 0, dur: 280 };
      const calm = window.DF.reduced();
      const old = stage.firstElementChild;

      App.ui.view = view;
      renderChrome();
      const incoming = buildViewEl();

      if (!old || calm || !incoming) {
        stage.innerHTML = '';
        stage.appendChild(incoming);
        stage.scrollTop = 0;
        decorateIncoming(stage);
        return;
      }

      const stack = el('<div class="view-stack"></div>');
      stack.dataset.anim = view;
      stage.insertBefore(stack, old);
      stack.appendChild(old);
      stack.appendChild(incoming);
      qsa('.rise, .pop', incoming).forEach((n) => (n.style.animation = 'none'));
      old.style.pointerEvents = 'none';
      stage.scrollTop = 0;
      decorateIncoming(incoming);

      const out = old.animate(
        [
          { opacity: 1, transform: 'translate(0,0)' },
          { opacity: 0, transform: `translate(${-m.x * 0.5}px, ${-m.y * 0.4}px)` },
        ],
        { duration: 140, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }
      );
      const inn = incoming.animate(
        [
          { opacity: 0, transform: `translate(${m.x}px, ${m.y}px)` },
          { opacity: 1, transform: 'translate(0,0)' },
        ],
        { duration: m.dur, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' }
      );
      const finished = Promise.allSettled([out.finished, inn.finished]);
      const fallback = new Promise((r) => setTimeout(r, m.dur + 90));
      await Promise.race([finished, fallback]);
      try {
        out.cancel();
        inn.cancel();
      } catch (_) {}

      stack.parentNode.insertBefore(incoming, stack);
      stack.remove();
      stage.scrollTop = 0;
    } finally {
      switching = false;
      const queued = pendingView;
      pendingView = null;
      if (queued && queued !== App.ui.view) go(queued);
    }
  }

  function animateIn(nodes, opts = {}) {
    if (window.DF.reduced()) return;
    const list = Array.from(nodes || []).slice(0, 24);
    const { y = 10, x = 0, stagger = 14, duration = 300, delay = 0 } = opts;
    list.forEach((n, i) => {
      n.animate(
        [
          { opacity: 0, transform: `translate(${x}px, ${y}px)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration, delay: delay + i * stagger, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }
      );
    });
  }

  /* 发牌式卡片入场：轻微错位 + 交替轻转，所有模块共用一套卡片语言 */
  function dealCards(nodes, opts = {}) {
    if (window.DF.reduced()) return;
    const list = Array.from(nodes || []).filter((n) => n && !n.hidden).slice(0, opts.limit || 24);
    const { x = 0, y = 18, rot = 1.4, stagger = 32, duration = 360, delay = 0 } = opts;
    list.forEach((n, i) => {
      const angle = ((i % 3) - 1) * rot;
      n.animate(
        [
          { opacity: 0, translate: `${x}px ${y + (i % 3) * 3}px`, rotate: `${angle}deg`, scale: 0.985 },
          { opacity: 1, translate: '0 0', rotate: '0deg', scale: 1 },
        ],
        { duration, delay: delay + i * stagger, easing: 'cubic-bezier(.2,.85,.25,1)', fill: 'backwards' }
      );
    });
  }

  function animateCalendar(dir = 0, root) {
    const host = root || qs('#view');
    const grid = host ? qs('.cal-grid', host) : null;
    if (!grid) return;
    if (dir && !window.DF.reduced()) {
      grid.animate(
        [
          { opacity: 0, transform: `translateX(${dir * 26}px)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' }
      );
    }
    dealCards(qsa('.cal-cell', grid), { y: 8, rot: 0.9, stagger: 6, duration: 280, limit: 21 });
    dealCards(qsa('.day-panel', host), { y: 10, rot: 0.5, stagger: 0, duration: 280, delay: 40, limit: 1 });
  }

  function animatePlanner(root) {
    const host = root || qs('#view');
    if (!host) return;
    dealCards(qsa('.pday', host), { y: 10, rot: 0.8, stagger: 4, duration: 260, limit: 28 });
    dealCards(qsa('.pweek-label', host), { y: 5, rot: 0.4, stagger: 20, duration: 220, limit: 6 });
  }

  /* ── 每个模块的内部动画语言 ─────────────────────────── */
  function animateView(root) {
    if (!root || window.DF.reduced()) return;
    const v = App.ui.view;
    if (v === 'overview') animateOverview(root);
    else if (v === 'gantt') animateGantt(root);
    else if (v === 'projects') animateProjects(root);
    else if (v === 'settings') animateSettings(root);
    else if (v === 'daily') animateDaily(root);
    else if (v === 'today') animateToday(root);
    else if (v === 'planner') animatePlanner(root);
    else if (v === 'calendar') animateCalendar(0, root);
    else if (v === 'agent') animateAgent(root);
  }

  function animateOverview(root) {
    dealCards(qsa('.view-inner .card', root), { y: 14, rot: 0.5, stagger: 45, duration: 320, limit: 6 });
    dealCards(qsa('.wk', root), { y: 8, rot: 1.1, stagger: 10, duration: 270, delay: 60, limit: 18 });
    qsa('.wk-bar', root).forEach((b, i) => {
      b.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], {
        duration: 340,
        delay: i * 10,
        easing: 'cubic-bezier(.16,1,.3,1)',
        fill: 'backwards',
      });
    });
    const donut = qs('.donut', root);
    if (donut) {
      donut.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], {
        duration: 340,
        easing: 'cubic-bezier(.16,1,.3,1)',
        fill: 'backwards',
      });
    }
    dealCards(qsa('.ov-key', root), { y: 10, rot: 1.6, stagger: 46, duration: 300, delay: 80, limit: 3 });
    dealCards(qsa('.ov-track', root), { y: 6, rot: 0.5, stagger: 16, duration: 260, delay: 40, limit: 6 });
  }

  function animateGantt(root) {
    dealCards(qsa('.g-row', root), { y: 5, rot: 0.3, stagger: 5, duration: 240, limit: 20 });
    dealCards(qsa('.g-chip', root), { y: 4, rot: 0.6, stagger: 18, duration: 220, limit: 6 });
    const line = qs('.g-today', root);
    if (line) {
      line.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], {
        duration: 360,
        delay: 40,
        easing: 'cubic-bezier(.16,1,.3,1)',
        fill: 'backwards',
      });
    }
  }

  function animateProjects(root) {
    dealCards(qsa('.track-card', root), { y: 12, rot: 1.3, stagger: 45, duration: 320, limit: 6 });
    qsa('.progress i', root)
      .slice(0, 12)
      .forEach((p, i) => {
        p.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
          duration: 420,
          delay: 80 + i * 18,
          easing: 'cubic-bezier(.16,1,.3,1)',
          fill: 'backwards',
        });
      });
    dealCards(qsa('.course-row', root), { y: 6, rot: 0.5, stagger: 14, duration: 260, delay: 40, limit: 10 });
  }

  function animateSettings(root) {
    dealCards(qsa('.set-card', root), { y: 10, rot: 0.9, stagger: 55, duration: 300, limit: 6 });
  }

  function animateToday(root) {
    dealCards(qsa('.hero, .metric-card', root), { y: 14, rot: 0.8, stagger: 60, duration: 380, limit: 2 });
    dealCards(qsa('.stack .task-card', root), { y: 18, rot: 1.8, stagger: 60, duration: 400, delay: 40, limit: 4 });
    dealCards(qsa('.side-stack > .card', root), { y: 12, rot: 0.7, stagger: 50, duration: 340, delay: 60, limit: 3 });
    dealCards(qsa('.agenda .item', root), { y: 10, rot: 0.6, stagger: 16, duration: 300, delay: 80, limit: 8 });
  }

  function animateDaily(root) {
    dealCards(qsa('.daily-tabs .day-card', root), { y: 10, rot: 1.2, stagger: 45, duration: 300, limit: 4 });
    dealCards(qsa('.daily-panel', root), { y: 12, rot: 0.3, stagger: 0, duration: 300, delay: 60, limit: 1 });
    animateIn(qsa('.dp-sec', root), { y: 3, stagger: 6, duration: 200, delay: 120 });
    animateIn(qsa('.dp-body .item', root), { y: 6, stagger: 8, duration: 240, delay: 140 });
  }

  function animateAgent(root) {
    dealCards(qsa('.msg', root), { y: 10, rot: 0.5, stagger: 22, duration: 300, limit: 8 });
    dealCards(qsa('.import-card', root), { y: 8, rot: 0.7, stagger: 36, duration: 280, delay: 60, limit: 1 });
  }

  /* ── 甘特拖动改期 / 拖边改时长 / 双击新建 ─────────────── */
  function bindGanttDrag() {
    const view = qs('#view');

    const tipAt = (tip, ev, text) => {
      tip.textContent = text;
      tip.style.left = `${ev.clientX + 14}px`;
      tip.style.top = `${ev.clientY + 16}px`;
    };

    view.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.mini-acts, .mini-act')) return;
      const bar = e.target.closest('.g-bar, .g-milestone');
      if (!bar || bar.dataset.clip === '1') return;
      const track = bar.closest('.g-track');
      const item = App.state.items.find((i) => i.id === bar.dataset.id);
      if (!track || !item) return;
      const resizing = !!e.target.closest('.g-resize') && !bar.classList.contains('g-milestone');
      e.preventDefault();

      const days = Number(track.dataset.n) || 42;
      const startIdx = Number(bar.dataset.idx) || 0;
      const len = Number(bar.dataset.len) || 1;
      const dayPx = track.clientWidth / days;
      const startX = e.clientX;
      let delta = 0;
      let moved = false;

      bar.classList.add('dragging');
      const tip = el('<div class="g-tip"></div>');
      document.body.appendChild(tip);

      const move = (ev) => {
        const dx = ev.clientX - startX;
        if (Math.abs(dx) > 4) moved = true;
        if (resizing) {
          const maxLen = Math.max(1, days - startIdx);
          const nl = Math.max(1, Math.min(maxLen, len + Math.round(dx / dayPx)));
          delta = nl - len;
          bar.style.width = `${(nl / days) * 100}%`;
          tipAt(tip, ev, `${md(item.date)} – ${md(addDays(item.date, nl - 1))}`);
        } else {
          const max = Math.max(0, days - startIdx - len);
          delta = Math.max(-startIdx, Math.min(max, Math.round(dx / dayPx)));
          bar.style.transform = `translateX(${(delta * dayPx).toFixed(1)}px)`;
          const nd = addDays(item.date, delta);
          tipAt(tip, ev, `${md(nd)}${item.endDate ? ' – ' + md(addDays(item.endDate, delta)) : ''}${item.time ? ' ' + item.time : ''}`);
        }
      };
      const up = async () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        bar.classList.remove('dragging');
        tip.remove();
        if (!moved || delta === 0) {
          if (!moved && !resizing) openItemDrawer(item);
          return;
        }
        if (resizing) {
          const nl = len + delta;
          const endDate = nl > 1 ? addDays(item.date, nl - 1) : '';
          await window.dayflow.saveItem(Object.assign({}, item, { endDate }));
          toast(nl > 1 ? `已调整至 ${md(item.date)} – ${md(endDate)}` : '已恢复为一天');
          return;
        }
        const date = addDays(item.date, delta);
        const endDate = item.endDate ? addDays(item.endDate, delta) : '';
        await window.dayflow.saveItem(Object.assign({}, item, { date, endDate }));
        toast(`已移至 ${md(date)}${item.time ? ' ' + item.time : ''}`);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });

    view.addEventListener('dblclick', (e) => {
      const track = e.target.closest('.g-track');
      if (!track || e.target.closest('.g-bar, .g-milestone, .g-summary')) return;
      const card = track.closest('.gantt-card');
      if (!card || !card.dataset.base) return;
      const days = Number(track.dataset.n) || 42;
      const rect = track.getBoundingClientRect();
      const idx = Math.max(0, Math.min(days - 1, Math.floor(((e.clientX - rect.left) / rect.width) * days)));
      window.dayflow.openAdd({ date: addDays(card.dataset.base, idx) });
    });
  }

  function setFilter(domain) {
    if (App.ui.filter === domain) return;
    App.ui.filter = domain;
    paint({ animate: false });
    animateIn(qsa('#view .task-card, #view .item, #view .cal-cell'), { y: 9, stagger: 15, duration: 320 });
  }

  /* ── 事项操作 ─────────────────────────────────────────── */
  function celebrateAt(x, y, opts = {}) {
    if (window.DF.reduced()) return;
    const host = el('<div class="celebrate"></div>');
    host.style.left = `${x}px`;
    host.style.top = `${y}px`;
    document.body.appendChild(host);
    const gold = ['#f59e0b', '#fbbf24', '#f97316', '#fde68a'];
    const mixed = ['#f59e0b', '#4361ee', '#10b981', '#7a6bff', '#f43f5e'];
    const colors = opts.priority ? gold : mixed;
    const lite = document.documentElement.classList.contains('quality-lite');
    const count = opts.big ? (lite ? 18 : 34) : (lite ? 12 : 20);
    for (let i = 0; i < count; i += 1) {
      const bit = document.createElement('i');
      const rect = Math.random() > 0.45;
      bit.style.background = colors[i % colors.length];
      bit.style.width = `${rect ? 4 + Math.random() * 3 : 5 + Math.random() * 3}px`;
      bit.style.height = `${rect ? 8 + Math.random() * 6 : 5 + Math.random() * 3}px`;
      bit.style.borderRadius = rect ? '2px' : '99px';
      host.appendChild(bit);
      const a = Math.random() * Math.PI * 2;
      const dist = (opts.big ? 110 : 55) + Math.random() * (opts.big ? 150 : 85);
      const dx = Math.cos(a) * dist;
      const dy = Math.sin(a) * dist + (opts.big ? 30 : 18);
      const lift = 28 + Math.random() * (opts.big ? 80 : 46);
      bit.animate(
        [
          { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
          { transform: `translate(${dx * 0.55}px, ${-lift}px) rotate(${120 + Math.random() * 160}deg) scale(1)`, opacity: 1, offset: 0.42 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${300 + Math.random() * 420}deg) scale(.55)`, opacity: 0 },
        ],
        { duration: 650 + Math.random() * (opts.big ? 550 : 320), delay: Math.random() * 70, easing: 'cubic-bezier(.18,.7,.3,1)', fill: 'both' }
      );
    }
    const badge = el(`<span class="celebrate-badge">${icon('check')}</span>`);
    host.appendChild(badge);
    badge.animate(
      [
        { transform: 'scale(.3)', opacity: 0 },
        { transform: 'scale(1.16)', opacity: 1, offset: 0.55 },
        { transform: 'scale(1)', opacity: 0 },
      ],
      { duration: 820, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' }
    );
    const plus = el('<span class="plus-one">+1</span>');
    host.appendChild(plus);
    setTimeout(() => host.remove(), opts.big ? 1500 : 1000);
  }

  function showAllDone() {
    if (window.DF.reduced()) {
      toast('今日事项已全部完成，辛苦了。', { icon: 'spark' });
      return;
    }
    const host = el(`<div class="all-done"><div class="ad-card">
      <span class="ad-check">${icon('check')}</span>
      <b>今日事项已完成</b>
      <em>辛苦了，明天见。</em>
    </div></div>`);
    document.body.appendChild(host);
    celebrateAt(window.innerWidth / 2, window.innerHeight * 0.46, { big: true });
    requestAnimationFrame(() => host.classList.add('on'));
    setTimeout(() => {
      host.classList.remove('on');
      setTimeout(() => host.remove(), 320);
    }, 2200);
  }

  async function toggleItem(id) {
    const row = qs(`.item[data-id="${id}"], .task-card[data-id="${id}"], .chat-task[data-id="${id}"]`);
    const wasDone = row ? row.classList.contains('done') : false;
    if (row) {
      row.classList.toggle('done', !wasDone);
      if (!window.DF.reduced()) {
        if (!wasDone) {
          row.animate(
            [
              { opacity: 1, translate: '0 0', scale: '1' },
              { opacity: 0.7, translate: '0 -2px', scale: '1.008', offset: 0.35 },
              { opacity: 0.3, translate: '0 0', scale: '1' },
            ],
            { duration: 360, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }
          );
        } else {
          row.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
        }
      }
    }
    const item = App.state.items.find((i) => i.id === id);
    if (!wasDone) {
      const check = row ? row.querySelector('.check') : null;
      const r = (check || row || {}).getBoundingClientRect ? (check || row).getBoundingClientRect() : null;
      const cx = r ? r.left + r.width / 2 : window.innerWidth / 2;
      const cy = r ? r.top + r.height / 2 : window.innerHeight / 2;
      if (r) celebrateAt(cx, cy, { priority: item && item.priority === 3 });
      const metric = qs('#view .metric-card');
      if (metric && !window.DF.reduced()) {
        metric.animate(
          [
            { boxShadow: '0 0 0 0 rgba(16,185,129,0)' },
            { boxShadow: '0 0 0 8px rgba(16,185,129,0.13)' },
            { boxShadow: '0 0 0 0 rgba(16,185,129,0)' },
          ],
          { duration: 720, easing: 'cubic-bezier(.16,1,.3,1)' }
        );
      }
      const today = App.payload.today.today;
      const n = App.state.items.filter((i) => i.status === 'done' && (i.completedAt || '').slice(0, 10) === today).length + 1;
      const now = Date.now();
      if (App.ui.lastDoneAt && now - App.ui.lastDoneAt < 15000) App.ui.doneCombo = (App.ui.doneCombo || 1) + 1;
      else App.ui.doneCombo = 1;
      App.ui.lastDoneAt = now;
      let msg = `已完成今日第 ${n} 项。`;
      if (item && item.priority === 3) msg = `重点事项已完成，今日第 ${n} 项。`;
      else if (n === 1) msg = '已完成今日第 1 项，开局顺利。';
      else if (n % 3 === 0) msg = `已完成今日第 ${n} 项，进度良好。`;
      else if (n % 5 === 0) msg = `已完成今日第 ${n} 项，节奏保持得不错。`;
      if (App.ui.doneCombo >= 2) msg += ` 连续完成 ${App.ui.doneCombo} 项。`;
      toast(msg, { icon: 'check' });
      const todayLeft = App.state.items.filter((i) => i.status !== 'done' && i.status !== 'dropped' && i.date === today && i.id !== id).length;
      const overdueLeft = App.state.items.filter((i) => i.status !== 'done' && i.status !== 'dropped' && i.date < today).length;
      if (item && item.date === today && todayLeft === 0 && overdueLeft === 0) {
        setTimeout(() => showAllDone(), 620);
      }
    }
    try {
      await window.dayflow.setStatus(id, wasDone ? 'todo' : 'done');
    } catch (err) {
      toast('更新未成功，请重试。');
    }
  }

  function openItemDrawer(item) {
    App.draft = item ? JSON.parse(JSON.stringify(item)) : { date: App.payload.today.today, domain: App.ui.filter === 'all' ? 'research' : App.ui.filter, priority: 2, kind: 'task', subtasks: [] };
    renderDrawer();
  }

  function renderDrawer() {
    const wrap = qs('#drawerWrap');
    wrap.hidden = false;
    if (App.draft) {
      wrap.innerHTML = `<div class="drawer-backdrop" data-act="drawer-close"></div>${R.itemDrawer(ctx(), App.draft)}`;
      const psel = qs('[data-field="priority"]');
      if (psel) {
        psel.addEventListener('change', () => {
          const keyEl = qs('[data-key-toggle]');
          if (keyEl) keyEl.classList.toggle('on', Number(psel.value) === 3);
        });
      }
      const title = qs('#dTitle');
      setTimeout(() => {
        title && title.focus();
        title && title.select();
      }, 60);
    } else if (App.trackDraft) {
      wrap.innerHTML = `<div class="drawer-backdrop" data-act="drawer-close"></div>${R.trackDrawer(ctx(), App.trackDraft)}`;
    } else if (App.courseDraft) {
      wrap.innerHTML = `<div class="drawer-backdrop" data-act="drawer-close"></div>${R.courseDrawer(ctx(), App.courseDraft)}`;
    }
  }

  function closeDrawer() {
    const wrap = qs('#drawerWrap');
    const drawer = wrap.querySelector('.drawer');
    if (drawer) drawer.classList.add('closing');
    setTimeout(() => {
      wrap.hidden = true;
      wrap.innerHTML = '';
    }, 200);
    App.draft = null;
    App.trackDraft = null;
    App.courseDraft = null;
  }

  function collectDraft() {
    const d = JSON.parse(JSON.stringify(App.draft || {}));
    d.title = (qs('#dTitle') || {}).value || d.title || '';
    d.notes = (qs('[data-field="notes"]') || {}).value || '';
    d.date = (qs('[data-field="date"]') || {}).value || d.date;
    d.time = (qs('[data-field="time"]') || {}).value || '';
    d.kind = (qs('[data-field="kind"]') || {}).value || d.kind;
    d.priority = (() => {
      const keyEl = qs('[data-key-toggle]');
      const keyOn = !!(keyEl && keyEl.classList.contains('on'));
      const selected = Number((qs('[data-field="priority"]') || {}).value || 2);
      return keyOn ? 3 : selected;
    })();
    d.course = (qs('[data-field="course"]') || {}).value || '';
    d.trackId = (qs('[data-field="trackId"]') || {}).value || '';
    d.subtasks = qsa('[data-sub-field]').map((inp, i) => ({
      id: (d.subtasks && d.subtasks[i] && d.subtasks[i].id) || undefined,
      title: inp.value,
      done: !!inp.closest('div').querySelector('.check.done'),
    })).filter((x) => x.title.trim());
    return d;
  }

  async function saveDrawer() {
    const d = collectDraft();
    if (!d.title.trim()) {
      toast('请填写事项标题。');
      qs('#dTitle') && qs('#dTitle').focus();
      return;
    }
    const saved = await window.dayflow.saveItem(d);
    closeDrawer();
    toast(d.id ? '已保存修改' : `已登记日程 · ${d.date.slice(5)}`, { icon: 'check' });
    if (saved && saved.id) App.ui.calSel = saved.date || App.ui.calSel;
  }

  async function deleteItemSafe(id, fromDrawer) {
    const item = App.state.items.find((i) => i.id === id);
    if (!item) return;
    if (fromDrawer) closeDrawer();
    await window.dayflow.deleteItem(id);
    toastAction(`已删除 · ${item.title.slice(0, 16)}`, '撤销', async () => {
      const restore = Object.assign({}, item);
      await window.dayflow.saveItem(restore);
      toast('已恢复');
    });
  }

  async function quickDelete(id, row) {
    if (row && !window.DF.reduced()) {
      try {
        await row.animate(
          [
            { opacity: 1, translate: '0 0', scale: '1' },
            { opacity: 0, translate: '0 8px', scale: '0.985' },
          ],
          { duration: 180, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }
        ).finished;
      } catch (_) {}
    }
    await deleteItemSafe(id, false);
  }

  async function toggleKey(id, btn) {
    const item = App.state.items.find((i) => i.id === id);
    if (!item) return;
    const next = item.priority === 3 ? 2 : 3;
    const source = (btn && btn.closest('.item, .task-card')) || qs(`[data-id="${id}"]`);
    const from = source ? source.getBoundingClientRect() : null;
    if (btn) btn.classList.add('pop');
    const saved = await window.dayflow.saveItem(Object.assign({}, item, { priority: next }));
    if (!saved) {
      if (btn) btn.classList.remove('pop');
      toast('没有保存成功，请重试。');
      return;
    }
    toast(next === 3 ? '已标为重点' : '已取消重点', { icon: 'star' });
    setTimeout(() => {
      if (btn) setTimeout(() => btn.classList.remove('pop'), 380);
      const card = qs(`.item[data-id="${id}"], .task-card[data-id="${id}"]`);
      if (!card) return;
      if (from && !DF.reduced() && !document.documentElement.classList.contains('quality-lite')) {
        const to = card.getBoundingClientRect();
        if (to.width > 0) {
          const scale = Math.max(0.86, Math.min(1.12, from.width / to.width));
          card.animate(
            [
              { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`, opacity: 0.65 },
              { transform: 'none', opacity: 1 },
            ],
            { duration: 380, easing: 'cubic-bezier(.2,.9,.25,1)' }
          );
        }
      }
      card.classList.add('key-glow');
      setTimeout(() => card.classList.remove('key-glow'), 560);
    }, 45);
  }

  async function moveItemToDate(item, date) {
    if (!item || !date || item.date === date) return false;
    const prev = { date: item.date, endDate: item.endDate || '' };
    const delta = diffDays(date, item.date);
    const endDate = item.endDate ? addDays(item.endDate, delta) : '';
    const saved = await window.dayflow.saveItem(Object.assign({}, item, { date, endDate }));
    if (!saved) {
      toast('改期没有保存成功，请重试。');
      return false;
    }
    toastAction(`已改到 ${md(date)}`, '撤销', async () => {
      await window.dayflow.saveItem(Object.assign({}, item, prev));
      toast('已恢复原日期');
    });
    return true;
  }

  /* ── 卡片拖动改期 ─────────────────────────────────── */
  let dragRail = null;

  function ensureDragRail() {
    if (dragRail && document.body.contains(dragRail)) return dragRail;
    dragRail = el('<div class="drag-rail" id="dragRail" hidden></div>');
    document.body.appendChild(dragRail);
    return dragRail;
  }

  function refreshDragRail() {
    const today = App.payload.today.today;
    const dow = parseISO(today).getDay();
    const nextMon = addDays(today, ((8 - dow) % 7) || 7);
    const dates = [
      { label: '今天', date: today },
      { label: '明天', date: addDays(today, 1) },
      { label: '后天', date: addDays(today, 2) },
      { label: '下周一', date: nextMon },
    ].filter((x, i, arr) => arr.findIndex((y) => y.date === x.date) === i);
    const rail = ensureDragRail();
    rail.innerHTML = `<span class="drag-hint">${icon('grip')} 拖到日期改期</span>
      <div class="drag-slots">${dates
        .map((d) => `<button type="button" class="drag-slot" data-drop-date="${d.date}"><b>${d.label}</b><small>${md(d.date)}</small></button>`)
        .join('')}</div>`;
    return rail;
  }

  function showDragRail() {
    const rail = refreshDragRail();
    rail.hidden = false;
    requestAnimationFrame(() => rail.classList.add('show'));
  }

  function hideDragRail() {
    if (!dragRail) return;
    dragRail.classList.remove('show');
    setTimeout(() => {
      if (dragRail && !dragRail.classList.contains('show')) dragRail.hidden = true;
    }, 220);
  }

  function initCardDrag() {
    let state = null;

    document.addEventListener(
      'click',
      (e) => {
        if (Date.now() < (App.ui.dragSuppressUntil || 0) && e.target instanceof Element) {
          if (e.target.closest('[data-act], [data-drag-handle], [data-order-handle], .pchip, .cal-ev')) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      },
      true
    );

    function clearTarget() {
      if (!state || !state.target) return;
      state.target.classList.remove('drop-over', 'over');
      state.target = null;
      state.dropDate = '';
    }

    function sourceCard(handle) {
      return handle.closest('.item, .task-card') || handle;
    }

    function cleanup() {
      if (!state) return;
      if (state.raf) cancelAnimationFrame(state.raf);
      clearTarget();
      if (state.card) state.card.classList.remove('drag-source');
      document.body.classList.remove('is-dragging');
      hideDragRail();
      window.removeEventListener('keydown', onKey, true);
      state = null;
    }

    function onKey(e) {
      if (e.key === 'Escape' && state && state.started) {
        e.preventDefault();
        finishDrag('');
      }
    }

    function onDown(e) {
      if (state) return;
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('.mini-acts, .mini-act')) return;
      const handle = e.target.closest('[data-drag-handle], .drag-mini[data-drag-id]');
      if (!handle || !App.state) return;
      const card = sourceCard(handle);
      const id = handle.dataset.dragId || card.dataset.id;
      const item = App.state.items.find((i) => i.id === id);
      if (!item) return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      state = {
        handle,
        card,
        item,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        rect,
        started: false,
        ghost: null,
        target: null,
        dropDate: '',
        raf: 0,
        pointerId: e.pointerId,
      };
      try {
        handle.setPointerCapture(e.pointerId);
      } catch (_) {}
      if (handle.hasAttribute('data-drag-handle')) {
        e.preventDefault();
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      }
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey, true);
    }

    function startGhost() {
      if (!state || state.started) return;
      state.started = true;
      App.ui.dragSuppressUntil = Date.now() + 650;
      const g = state.card.cloneNode(true);
      g.classList.add('drag-ghost');
      g.classList.remove('drag-source');
      g.removeAttribute('hidden');
      g.style.left = `${state.rect.left}px`;
      g.style.top = `${state.rect.top}px`;
      g.style.width = `${state.rect.width}px`;
      g.style.height = `${state.rect.height}px`;
      g.style.transform = 'translate3d(0,0,0) scale(1.025)';
      g.setAttribute('aria-hidden', 'true');
      document.body.appendChild(g);
      state.ghost = g;
      state.card.classList.add('drag-source');
      document.body.classList.add('is-dragging');
      showDragRail();
    }

    function paintGhost() {
      if (!state || !state.ghost) return;
      const dx = state.lastX - state.startX;
      const dy = state.lastY - state.startY;
      const reduced = DF.reduced() || document.documentElement.classList.contains('quality-lite');
      const tilt = reduced ? 0 : Math.max(-3.5, Math.min(3.5, dx / 24));
      state.ghost.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.025) rotate(${tilt}deg)`;
      const under = document.elementFromPoint(state.lastX, state.lastY);
      const target = under && under.closest('[data-drop-date]');
      if (target !== state.target) {
        clearTarget();
        state.target = target;
        if (target) {
          state.dropDate = target.dataset.dropDate || '';
          target.classList.add(target.classList.contains('drag-slot') ? 'over' : 'drop-over');
        }
      }
    }

    function onMove(e) {
      if (!state) return;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      if (!state.started) {
        if (Math.hypot(e.clientX - state.startX, e.clientY - state.startY) < 6) return;
        startGhost();
      }
      e.preventDefault();
      if (!state.raf) {
        state.raf = requestAnimationFrame(() => {
          if (!state) return;
          state.raf = 0;
          paintGhost();
        });
      }
    }

    function finishDrag(dropDate) {
      if (!state) return;
      const s = state;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
      if (s.raf) cancelAnimationFrame(s.raf);
      const target = s.target;
      const targetRect = target ? target.getBoundingClientRect() : null;
      const ghost = s.ghost;
      const moved = dropDate && dropDate !== s.item.date;
      clearTarget();
      hideDragRail();
      document.body.classList.remove('is-dragging');
      App.ui.dragSuppressUntil = Date.now() + 450;
      if (ghost) {
        if (moved && targetRect) {
          const sr = s.rect;
          const tx = targetRect.left + targetRect.width / 2 - (sr.left + sr.width / 2);
          const ty = targetRect.top + targetRect.height / 2 - (sr.top + sr.height / 2);
          const anim = ghost.animate(
            [
              { transform: ghost.style.transform, opacity: 0.98 },
              { transform: `translate3d(${tx}px, ${ty}px, 0) scale(.58) rotate(0deg)`, opacity: 0 },
            ],
            { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }
          );
          anim.onfinish = () => ghost.remove();
        } else {
          const anim = ghost.animate(
            [
              { transform: ghost.style.transform, opacity: 0.98 },
              { transform: 'translate3d(0,0,0) scale(1) rotate(0deg)', opacity: 1 },
            ],
            { duration: 280, easing: 'cubic-bezier(.2,.9,.25,1.18)', fill: 'forwards' }
          );
          anim.onfinish = () => ghost.remove();
        }
      }
      if (s.card) s.card.classList.remove('drag-source');
      state = null;
      if (moved) {
        moveItemToDate(s.item, dropDate);
      }
    }

    function onUp(e) {
      if (!state) return;
      const s = state;
      if (!s.started) {
        // 没有达到拖动阈值，保留普通点击
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey, true);
        try {
          s.handle.releasePointerCapture(s.pointerId);
        } catch (_) {}
        state = null;
        return;
      }
      e.preventDefault();
      try {
        s.handle.releasePointerCapture(s.pointerId);
      } catch (_) {}
      finishDrag(s.dropDate);
    }

    function onCancel() {
      if (!state) return;
      if (state.started) finishDrag('');
      else {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey, true);
        state = null;
      }
    }

    document.addEventListener('pointerdown', onDown, true);
  }

  /* ── 主线 / 课程卡片拖动排序 ───────────────────────── */
  function initOrderDrag() {
    let state = null;

    function cardSelector(kind) {
      return kind === 'track' ? '.track-card' : '.course-row';
    }

    function clearTarget() {
      if (state && state.target) state.target.classList.remove('order-over');
      if (state) state.target = null;
    }

    function onKey(e) {
      if (e.key === 'Escape' && state) finish('');
    }

    function onDown(e) {
      if (state || e.button !== 0) return;
      const handle = e.target.closest('[data-order-handle]');
      if (!handle) return;
      const kind = handle.dataset.orderKind;
      if (kind !== 'track' && kind !== 'course') return;
      const source = handle.closest(cardSelector(kind));
      const container = source && source.parentElement;
      if (!source || !container) return;
      e.preventDefault();
      const rect = source.getBoundingClientRect();
      if (!rect.width) return;
      state = { handle, kind, source, container, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, rect, started: false, ghost: null, target: null };
      try {
        handle.setPointerCapture(e.pointerId);
      } catch (_) {}
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey, true);
    }

    function startGhost() {
      if (!state || state.started) return;
      state.started = true;
      App.ui.dragSuppressUntil = Date.now() + 500;
      const g = state.source.cloneNode(true);
      g.classList.add('drag-ghost', 'order-ghost');
      g.classList.remove('order-source', 'rise', 'pulse');
      g.style.left = `${state.rect.left}px`;
      g.style.top = `${state.rect.top}px`;
      g.style.width = `${state.rect.width}px`;
      g.style.height = `${state.rect.height}px`;
      g.style.transform = 'translate3d(0,0,0) scale(1.015)';
      document.body.appendChild(g);
      state.ghost = g;
      state.source.classList.add('order-source');
      document.body.classList.add('is-dragging');
    }

    function onMove(e) {
      if (!state) return;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      if (!state.started) {
        if (Math.hypot(e.clientX - state.startX, e.clientY - state.startY) < 6) return;
        startGhost();
      }
      e.preventDefault();
      const dx = state.lastX - state.startX;
      const dy = state.lastY - state.startY;
      const tilt = DF.reduced() ? 0 : Math.max(-2.4, Math.min(2.4, dx / 50));
      state.ghost.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.015) rotate(${tilt}deg)`;
      const under = document.elementFromPoint(state.lastX, state.lastY);
      const candidate = under && under.closest(cardSelector(state.kind));
      const target = candidate && candidate !== state.source ? candidate : null;
      if (target !== state.target) {
        clearTarget();
        state.target = target;
        if (target) target.classList.add('order-over');
      }
    }

    function finish(commit) {
      if (!state) return;
      const s = state;
      const target = s.target;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
      clearTarget();
      const ghost = s.ghost;
      if (ghost) {
        if (commit && target) {
          ghost.style.opacity = '0';
          setTimeout(() => ghost.remove(), 180);
        } else {
          const anim = ghost.animate(
            [
              { transform: ghost.style.transform, opacity: 0.98 },
              { transform: 'translate3d(0,0,0) scale(1) rotate(0deg)', opacity: 1 },
            ],
            { duration: 240, easing: 'cubic-bezier(.2,.9,.25,1.15)', fill: 'forwards' }
          );
          anim.onfinish = () => ghost.remove();
        }
      }
      s.source.classList.remove('order-source');
      document.body.classList.remove('is-dragging');
      state = null;
      if (!commit || !target) return;

      const before = new Map();
      [...s.container.children].forEach((el) => before.set(el, el.getBoundingClientRect()));
      s.container.insertBefore(s.source, target);
      [...s.container.children].forEach((el) => {
        const a = before.get(el);
        if (!a) return;
        const b = el.getBoundingClientRect();
        const dx = a.left - b.left;
        const dy = a.top - b.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: 'translate(0,0)' },
          ],
          { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }
        );
      });
      const ids = [...s.container.querySelectorAll(cardSelector(s.kind))].map((el) => el.dataset.id);
      const patch = s.kind === 'track' ? { trackOrder: ids } : { courseOrder: ids };
      window.dayflow.updateSettings(patch).then(() => toast('排序已更新'));
    }

    function onUp(e) {
      if (!state) return;
      const s = state;
      if (!s.started) {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey, true);
        state = null;
        return;
      }
      e.preventDefault();
      try {
        s.handle.releasePointerCapture(s.pointerId);
      } catch (_) {}
      const commit = !!s.target;
      const target = s.target;
      // keep target for finish; clearTarget happens inside finish
      state = s;
      state.target = target;
      finish(commit);
    }

    function onCancel() {
      if (state && state.started) finish('');
      else if (state) {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey, true);
        state = null;
      }
    }

    document.addEventListener('pointerdown', onDown, true);
  }

  function toastAction(message, label, fn) {
    const box = qs('#toasts');
    const node = el(`<div class="toast">${icon('check')}<span>${esc(message)}</span><button style="margin-left:6px;color:#9fb0ff;font-size:12px;font-weight:600">${esc(label)}</button></div>`);
    box.appendChild(node);
    node.querySelector('button').addEventListener('click', () => {
      fn();
      node.classList.add('out');
      setTimeout(() => node.remove(), 220);
    });
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 240);
    }, 5200);
  }

  /* ── 倒计时 ───────────────────────────────────────────── */
  let clockTimer = null;
  function updateCountdown() {
    const node = qs('#countdown');
    if (!node) return;
    const date = node.dataset.date;
    const time = node.dataset.time || '23:59';
    const target = new Date(`${date}T${time}:00`);
    const now = new Date();
    let diff = Math.max(0, target - now);
    const days = Math.floor(diff / 86400000);
    diff -= days * 86400000;
    const h = Math.floor(diff / 3600000);
    diff -= h * 3600000;
    const m = Math.floor(diff / 60000);
    const sec = Math.floor((diff - m * 60000) / 1000);
    node.textContent = days > 0 ? `${days}天 ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
    const bar = qs('#countBar');
    if (bar) {
      const start = new Date(date === todayISO() ? `${date}T00:00:00` : `${date}T${time}:00`);
      const total = 6 * 3600000;
      const remain = target - now;
      const pct = Math.max(2, Math.min(100, (1 - remain / total) * 100));
      bar.style.width = `${pct}%`;
    }
  }

  function startClock() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(() => {
      const clock = qs('.tb-clock');
      if (clock) {
        const now = new Date();
        clock.textContent = `${now.getMonth() + 1} 月 ${now.getDate()} 日 ${weekday(todayISO())} · ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      }
      updateCountdown();
      if (now0() !== App.payload.today.today) {
        // 跨天刷新
        refresh();
      }
    }, 1000);
  }
  const now0 = () => todayISO();

  async function refresh() {
    const p = await window.dayflow.bootstrap();
    setPayload(p);
    paint({ animate: false });
  }

  /* ── 性能监视 ─────────────────────────────────────────── */
  function startPerf() {
    const hud = qs('#perfHud');
    let frames = 0;
    let last = performance.now();
    let lowStreak = 0;
    function loop(t) {
      frames++;
      if (t - last >= 1000) {
        const fps = Math.round((frames * 1000) / (t - last));
        frames = 0;
        last = t;
        if (App.ui.perfHud) {
          hud.hidden = false;
          hud.textContent = `${fps} fps · ${App.hardware ? App.hardware.maxHz + 'Hz' : ''} · ${document.body.dataset.quality}`;
        }
        if (fps < 46) lowStreak++;
        else lowStreak = 0;
        if (lowStreak >= 3 && document.body.dataset.quality !== 'low') {
          document.body.dataset.quality = 'low';
        } else if (fps > 57 && document.body.dataset.quality === 'low') {
          lowStreak = 0;
          document.body.dataset.quality = 'high';
        }
        lowStreak = Math.min(lowStreak, 5);
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  /* ── 命令面板 ─────────────────────────────────────────── */
  function paletteRows(query) {
    const q = query.trim();
    const rows = [];
    const s = App.state;
    const items = s.items
      .filter((i) => i.status !== 'done' && i.status !== 'dropped')
      .filter((i) => !q || i.title.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')))
      .slice(0, q ? 8 : 6);
    if (!q) {
      const done = s.items
        .filter((i) => i.status === 'done')
        .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
        .slice(0, 2);
      done.forEach((i) => items.push(i));
    }
    if (q) {
      rows.push({ kind: 'nl', label: `新建「${q}」`, meta: '回车用本地解析创建', icon: 'plus', text: q });
    }
    NAV.forEach((n) => rows.push({ kind: 'nav', label: `前往 ${n.label}`, meta: n.key, icon: n.icon, view: n.id }));
    rows.push({ kind: 'act', label: '新建事项', meta: 'N', icon: 'plus', action: 'new' });
    rows.push({ kind: 'act', label: '打开 Agent 接口', meta: '', icon: 'spark', action: 'agent' });
    if (items.length) {
      rows.push({ kind: 'group', label: '事项' });
      items.forEach((i) => rows.push({ kind: 'item', label: i.title, meta: `${md(i.date)} · ${(App.domainMap[i.domain] || {}).name || ''}`, icon: 'today', id: i.id }));
    }
    return rows;
  }

  function openPalette(prefill = '') {
    App.palette.open = true;
    App.palette.query = prefill;
    App.palette.index = 0;
    const wrap = qs('#paletteWrap');
    wrap.hidden = false;
    wrap.innerHTML = `<div class="palette-backdrop" data-act="palette-close"></div>
      <div class="palette">
        <div class="palette-input">${icon('search')}<input id="paletteInput" placeholder="搜索事项，或直接登记日程（如：明天下午三点提交月工作总结）" value="${esc(prefill)}" /></div>
        <div class="palette-list" id="paletteList"></div>
        <div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></div>
      </div>`;
    renderPalette();
    const input = qs('#paletteInput');
    input.focus();
    input.addEventListener('input', () => {
      App.palette.query = input.value;
      App.palette.index = 0;
      renderPalette();
    });
    input.addEventListener('keydown', onPaletteKey);
  }

  function renderPalette() {
    const rows = paletteRows(App.palette.query);
    App.palette.rows = rows;
    let html = '';
    let idx = -1;
    rows.forEach((r) => {
      if (r.kind === 'group') {
        html += `<div class="palette-group">${esc(r.label)}</div>`;
        return;
      }
      idx++;
      const selected = idx === App.palette.index;
      html += `<div class="palette-row ${selected ? 'sel' : ''}" data-pidx="${idx}">${icon(r.icon || 'today')}<span>${esc(r.label)}</span><span class="pl-meta">${esc(r.meta || '')}</span></div>`;
    });
    qs('#paletteList').innerHTML = html;
    qsa('.palette-row').forEach((n) => {
      n.addEventListener('mouseenter', () => {
        App.palette.index = Number(n.dataset.pidx);
        qsa('.palette-row').forEach((x) => x.classList.toggle('sel', x === n));
      });
      n.addEventListener('click', () => chooseRow(Number(n.dataset.pidx)));
    });
  }

  function onPaletteKey(e) {
    const rows = App.palette.rows.filter((r) => r.kind !== 'group');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      App.palette.index = Math.min(rows.length - 1, App.palette.index + 1);
      renderPalette();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      App.palette.index = Math.max(0, App.palette.index - 1);
      renderPalette();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      chooseRow(App.palette.index);
    } else if (e.key === 'Escape') {
      closePalette();
    }
  }

  async function chooseRow(index) {
    const row = App.palette.rows.filter((r) => r.kind !== 'group')[index];
    if (!row) return;
    if (row.kind === 'nl') {
      closePalette();
      const res = await window.dayflow.command(row.text, App.ui.agentMode === 'offline');
      toast(res.reply.split('\n')[0], { icon: 'spark' });
      return;
    }
    if (row.kind === 'nav') {
      closePalette();
      go(row.view);
      return;
    }
    if (row.kind === 'act') {
      closePalette();
      if (row.action === 'new') window.dayflow.openAdd({});
      if (row.action === 'agent') go('agent');
      return;
    }
    if (row.kind === 'item') {
      closePalette();
      const item = App.state.items.find((i) => i.id === row.id);
      if (item) openItemDrawer(item);
    }
  }

  function closePalette() {
    App.palette.open = false;
    const wrap = qs('#paletteWrap');
    wrap.hidden = true;
    wrap.innerHTML = '';
  }

  /* ── 模块快速切换 ─────────────────────────────────────── */
  let viewHintTimer = null;

  function showViewHint(nav) {
    if (!nav) return;
    let hint = qs('#viewHint');
    if (!hint) {
      hint = el('<div class="view-hint" id="viewHint"></div>');
      document.body.appendChild(hint);
    }
    const idx = NAV.findIndex((n) => n.id === nav.id);
    hint.innerHTML = `${icon(nav.icon)}<span>${nav.label}</span><em>${idx + 1} / ${NAV.length}</em>`;
    hint.classList.add('on');
    if (viewHintTimer) clearTimeout(viewHintTimer);
    viewHintTimer = setTimeout(() => hint.classList.remove('on'), 900);
  }

  function cycleView(dir = 1) {
    if (App.ui.modulesOpen) closeModules();
    if (App.palette.open) closePalette();
    if (!qs('#drawerWrap').hidden) closeDrawer();
    const idx = NAV.findIndex((n) => n.id === App.ui.view);
    const next = NAV[(idx + dir + NAV.length) % NAV.length];
    if (!next || next.id === App.ui.view) return;
    go(next.id);
    showViewHint(next);
  }

  function closeModules() {
    if (!App.ui.modulesOpen) return;
    App.ui.modulesOpen = false;
    const wrap = qs('#modules');
    wrap.hidden = true;
    wrap.innerHTML = '';
  }

  function openModules() {
    if (App.ui.modulesOpen) {
      closeModules();
      return;
    }
    if (App.palette.open) closePalette();
    if (!qs('#drawerWrap').hidden) closeDrawer();
    App.ui.modulesOpen = true;
    const wrap = qs('#modules');
    wrap.hidden = false;
    wrap.innerHTML = `<div class="mod-backdrop"></div>
      <section class="mod-panel" role="dialog" aria-modal="true" aria-label="切换模块">
        <header class="mod-head">
          <div><h2>切换模块</h2><p>Ctrl Tab 循环 · Alt ← → 前后 · 数字键 1–9 直达</p></div>
          <button class="mod-x" data-mod="close" aria-label="关闭">×</button>
        </header>
        <div class="mod-grid">
          ${NAV.map(
            (n, i) => `<button type="button" class="mod-card ${n.id === App.ui.view ? 'is-on' : ''}" data-mod="go" data-view="${n.id}" title="${n.label}（${n.key}）">
              <span class="mod-ic">${icon(n.icon)}</span><b>${n.label}</b><kbd>${i + 1}</kbd>
            </button>`
          ).join('')}
        </div>
        <div class="mod-foot"><span>Esc 关闭</span><span>鼠标侧键也可前后切换</span></div>
      </section>`;
    const panel = wrap.querySelector('.mod-panel');
    wrap.addEventListener('click', (e) => {
      const card = e.target.closest('[data-mod="go"]');
      if (card) {
        const v = card.dataset.view;
        closeModules();
        go(v);
        return;
      }
      if (e.target.closest('[data-mod="close"]') || e.target === wrap || e.target.classList.contains('mod-backdrop')) closeModules();
    });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeModules();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const cards = Array.from(wrap.querySelectorAll('.mod-card'));
        const at = cards.indexOf(document.activeElement);
        const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        cards[(at + delta + cards.length) % cards.length].focus();
      }
    });
    setTimeout(() => {
      const active = panel.querySelector('.mod-card.is-on') || panel.querySelector('.mod-card');
      if (active) active.focus();
    }, 70);
  }

  /* ── Agent 对话 / 日程导入 ─────────────────────────────── */
  const nowTime = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const pad2 = (n) => String(n).padStart(2, '0');
  const localISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  function scrollAgent() {
    const sc = qs('#agentScroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
  }

  function focusAgentInput() {
    setTimeout(() => {
      const input = qs('#agentInput');
      if (input) input.focus();
    }, 30);
  }

  function dealLastMsg() {
    const list = qsa('#view .msg');
    if (list.length) dealCards([list[list.length - 1]], { y: 8, rot: 0.5, stagger: 0, duration: 260 });
  }

  async function sendAgent() {
    const input = qs('#agentInput');
    if (!input || !input.value.trim() || App.ui.agentThinking) return;
    const text = input.value.trim();
    input.value = '';
    App.ui.agentMsgs.push({ role: 'me', text, time: nowTime() });
    App.ui.agentThinking = true;
    renderView({ animate: false });
    dealLastMsg();
    scrollAgent();
    try {
      const res = await window.dayflow.command(text, App.ui.agentMode === 'offline');
      App.ui.agentMsgs.push({ role: 'bot', text: res.reply, ops: res.ops || [], applied: res.applied || [], engine: res.engine, time: nowTime() });
    } catch (err) {
      App.ui.agentMsgs.push({ role: 'bot', text: '本地接口连接失败，请稍后重试。', time: nowTime() });
    }
    App.ui.agentThinking = false;
    if (App.ui.agentMsgs.length > 30) App.ui.agentMsgs = App.ui.agentMsgs.slice(-30);
    renderView({ animate: false });
    dealLastMsg();
    scrollAgent();
    focusAgentInput();
  }

  let agentListening = false;
  async function voiceAgent() {
    if (agentListening || App.ui.agentThinking) return;
    const input = qs('#agentInput');
    if (!input) return;
    const btn = qs('.ac-field .mic-btn');
    const prev = input.placeholder;
    agentListening = true;
    if (btn) btn.classList.add('listening');
    input.placeholder = '正在聆听…';
    try {
      const res = await window.Voice.listen();
      if (res && res.text) {
        input.value = res.text;
        input.focus();
      } else {
        toast(res && res.error ? '语音识别不可用' : '未识别到语音，请重试');
      }
    } catch (_) {
      toast('语音识别不可用');
    } finally {
      agentListening = false;
      if (btn) btn.classList.remove('listening');
      input.placeholder = prev;
    }
  }

  function showAgentDay(key) {
    const today = App.payload.today.today;
    const open = App.state.items.filter((i) => i.status !== 'done' && i.status !== 'dropped');
    const keyFirst = (a, b) => (b.priority === 3 ? 1 : 0) - (a.priority === 3 ? 1 : 0) || (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99'));
    let items = [];
    let label = '今天';
    if (key === 'today') {
      items = open.filter((i) => i.date <= today).sort(keyFirst);
      label = '今天';
    } else if (key === 'tomorrow') {
      items = open.filter((i) => i.date === addDays(today, 1)).sort(keyFirst);
      label = '明天';
    } else if (key === 'after') {
      items = open.filter((i) => i.date === addDays(today, 2)).sort(keyFirst);
      label = '后天';
    } else {
      items = open.filter((i) => i.date > addDays(today, 2)).sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
      label = '之后';
    }
    const shown = items.slice(0, 4);
    const over = key === 'today' ? items.filter((i) => i.date < today).length : 0;
    const intro = items.length
      ? `${label}有 ${items.length} 项在办${over ? `（含 ${over} 项逾期）` : ''}。`
      : `${label}还没有安排。`;
    App.ui.agentMsgs.push({ role: 'bot', kind: 'day', dayKey: key, text: intro, items: shown.map((i) => i.id), more: Math.max(0, items.length - shown.length) });
    if (App.ui.agentMsgs.length > 30) App.ui.agentMsgs = App.ui.agentMsgs.slice(-30);
    renderView({ animate: false });
    scrollAgent();
  }

  function guessDomain(title) {
    if (/论文|研究|文献|实验|综述|开题|国别|政策/.test(title)) return 'research';
    if (/课|作业|考试|测验|quiz|英语|数学|复习|自学|阅读|听力|词汇/i.test(title)) return 'study';
    if (/会|活动|材料|提交|总结|值班|讲座|比赛|答辩|报名|班/.test(title)) return 'duty';
    return 'research';
  }

  function guessKind(title) {
    if (/会议|活动|讲座|比赛|大赛|答辩/.test(title)) return 'event';
    if (/quiz|测验|小测/i.test(title)) return 'quiz';
    if (/截止|ddl|提交|交$/.test(title)) return 'deadline';
    return 'task';
  }

  function cleanTime(t) {
    const m = /(\d{1,2})[:：](\d{1,2})/.exec(String(t || ''));
    return m ? `${pad2(Number(m[1]))}:${pad2(Number(m[2]))}` : '';
  }

  function icsDate(v) {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(String(v || '').trim());
    if (!m) return null;
    let date = `${m[1]}-${m[2]}-${m[3]}`;
    let time = m[4] ? `${m[4]}:${m[5]}` : '';
    if (m[7] === 'Z' && m[4]) {
      const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0)));
      date = localISO(d);
      time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }
    return { date, time };
  }

  function parseICS(text) {
    const out = [];
    text
      .split(/BEGIN:VEVENT/i)
      .slice(1)
      .forEach((raw) => {
        const block = raw.split(/END:VEVENT/i)[0];
        const grab = (key) => {
          const m = new RegExp('^' + key + '[^:\\r\\n]*:(.*)$', 'mi').exec(block);
          return m ? m[1].trim() : '';
        };
        const title = grab('SUMMARY')
          .replace(/\\,/g, ',')
          .replace(/\\n/gi, ' ')
          .replace(/\\;/g, ';')
          .trim();
        const start = grab('DTSTART');
        if (!title || !start) return;
        const st = icsDate(start);
        if (!st) return;
        const endRaw = grab('DTEND');
        const et = endRaw ? icsDate(endRaw) : null;
        let endDate = '';
        if (et && et.date > st.date) {
          if (/^\d{8}$/.test(endRaw)) {
            const d = new Date(`${et.date}T00:00:00`);
            d.setDate(d.getDate() - 1);
            endDate = localISO(d);
          } else endDate = et.date;
        }
        out.push({ title: title.slice(0, 120), date: st.date, time: st.time, endDate, domain: guessDomain(title), kind: guessKind(title), priority: 2 });
      });
    return out;
  }

  function normalizeImport(x) {
    if (!x || typeof x !== 'object') return null;
    const title = String(x.title || x.summary || x.name || x.subject || '').trim();
    if (!title) return null;
    let date = String(x.date || x.start || x.startDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    let time = x.time || '';
    if (!time && typeof x.start === 'string' && x.start.includes('T')) time = x.start.slice(11, 16);
    return {
      title: title.slice(0, 120),
      date,
      time: cleanTime(time),
      endDate: x.endDate || '',
      domain: x.domain || guessDomain(title),
      kind: x.kind || guessKind(title),
      priority: x.priority === 3 ? 3 : 2,
    };
  }

  function parseJSONImport(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      return [];
    }
    const arr = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : Array.isArray(data.events) ? data.events : [];
    return arr.map(normalizeImport).filter(Boolean);
  }

  function parseTXTImport(text) {
    const lines = text.split(/\r?\n/);
    let header = null;
    if (lines[0] && /日期|date/i.test(lines[0]) && /标题|title|事项|日程|summary/i.test(lines[0])) {
      header = lines.shift().split(',').map((s) => s.trim().toLowerCase());
    }
    const out = [];
    const year = new Date().getFullYear();
    lines.forEach((line) => {
      const raw = line.trim();
      if (!raw) return;
      let title = raw;
      let date = '';
      let time = '';
      if (header) {
        const cols = raw.split(',').map((s) => s.trim());
        const at = (names) => names.map((n) => header.indexOf(n)).find((i) => i >= 0);
        const di = at(['日期', 'date']);
        const ti = at(['时间', 'time']);
        const ni = at(['标题', 'title', '事项', '日程', 'summary']);
        date = di >= 0 ? (cols[di] || '').slice(0, 10) : '';
        time = ti >= 0 ? cols[ti] || '' : '';
        title = ni >= 0 ? cols[ni] || '' : '';
      } else {
        const dm = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw) || /(\d{1,2})\s*[月/.-]\s*(\d{1,2})/.exec(raw);
        if (!dm) return;
        date = dm[1] && dm[1].length === 4 ? `${dm[1]}-${pad2(dm[2])}-${pad2(dm[3])}` : `${year}-${pad2(dm[1])}-${pad2(dm[2])}`;
        const tm = /(\d{1,2})[:：](\d{1,2})/.exec(raw) || /(\d{1,2})\s*点/.exec(raw);
        time = tm ? cleanTime(tm[0].replace('点', ':00')) : '';
        title = raw
          .replace(dm[0], '')
          .replace(tm ? tm[0] : '', '')
          .replace(/^[日号\s,，:：\-—·]+/, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      out.push({ title: title.slice(0, 120), date, time: cleanTime(time), endDate: '', domain: guessDomain(title), kind: guessKind(title), priority: 2 });
    });
    return out;
  }

  async function ingestFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    const items = [];
    const names = [];
    for (const f of list) {
      let text = '';
      try {
        text = await f.text();
      } catch (_) {
        continue;
      }
      let parsed = [];
      if (/\.ics$/i.test(f.name)) parsed = parseICS(text);
      else if (/\.json$/i.test(f.name)) parsed = parseJSONImport(text);
      else parsed = parseTXTImport(text);
      if (parsed.length) {
        items.push(...parsed);
        names.push(f.name);
      }
    }
    if (!items.length) {
      toast('文件中未识别到日程事项。');
      return;
    }
    const seen = new Set();
    const unique = items.filter((it) => {
      const k = it.title + '|' + it.date;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    App.ui.agentImport = { items: unique.slice(0, 60), source: names.join('、') };
    renderView({ animate: false });
    dealCards(qsa('#view .import-card'), { y: 8, rot: 0.8, stagger: 0, duration: 280 });
    scrollAgent();
  }

  function pickFiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.ics,.json,.txt,.md,.csv,text/calendar,application/json,text/plain';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      input.remove();
      await ingestFiles(files);
    });
    input.click();
  }

  async function confirmImport() {
    const imp = App.ui.agentImport;
    if (!imp) return;
    const existing = new Set(App.state.items.map((i) => i.title + '|' + i.date));
    let added = 0;
    let skipped = 0;
    for (const it of imp.items) {
      if (existing.has(it.title + '|' + it.date)) {
        skipped += 1;
        continue;
      }
      try {
        await window.dayflow.saveItem(Object.assign({ source: 'import' }, it));
        added += 1;
      } catch (_) {}
    }
    App.ui.agentImport = null;
    App.ui.agentMsgs.push({ role: 'bot', text: `已为您导入 ${added} 项日程${skipped ? `，跳过 ${skipped} 项重复` : ''}。可按日期查看。`, time: nowTime() });
    if (App.ui.agentMsgs.length > 30) App.ui.agentMsgs = App.ui.agentMsgs.slice(-30);
    renderView({ animate: false });
    dealLastMsg();
    scrollAgent();
    toast(`已导入 ${added} 项日程`);
  }

  /* ── 设置 ─────────────────────────────────────────────── */
  async function applySetting(key, value) {
    const patch = {};
    if (key.includes('.')) {
      const [a, b] = key.split('.');
      patch[a] = { [b]: value };
    } else {
      patch[key] = value;
    }
    await window.dayflow.updateSettings(patch);
    if (key === 'motion' || key === 'notify' || key === 'closeToTray') applyMotion();
  }

  /* ── 事件 ─────────────────────────────────────────────── */
  async function handleAction(act, node, e) {
    switch (act) {
      case 'nav':
        go(node.dataset.view);
        break;
      case 'filter':
        setFilter(node.dataset.domain);
        break;
      case 'ov-week': {
        const w = Number(node.dataset.week);
        App.ui.plannerOffset = w - App.payload.today.week;
        go('planner');
        break;
      }
      case 'ov-day': {
        const date = node.dataset.date;
        App.ui.calCursor = date.slice(0, 7);
        App.ui.calSel = date;
        go('calendar');
        break;
      }
      case 'show-done': {
        const openList = qs('#view .items:not([hidden])');
        if (App.ui.showDone && openList) {
          const h = openList.offsetHeight;
          openList.classList.add('done-list-anim');
          const anim = openList.animate(
            [
              { height: `${h}px`, opacity: 1 },
              { height: '0px', opacity: 0 },
            ],
            { duration: 210, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }
          );
          try {
            await anim.finished;
          } catch (_) {}
          App.ui.showDone = false;
          renderView({ animate: false });
        } else {
          App.ui.showDone = true;
          renderView({ animate: false });
          animateIn(qsa('#view .items .item'), { y: 10, stagger: 18, duration: 320 });
        }
        break;
      }
      case 'toggle':
        await toggleItem(node.dataset.id);
        break;
      case 'key':
        e && e.stopPropagation();
        await toggleKey(node.dataset.id, node);
        break;
      case 'drag':
        e && e.preventDefault();
        break;
      case 'order':
        e && e.preventDefault();
        break;
      case 'key-toggle': {
        e && e.preventDefault();
        e && e.stopPropagation();
        node.classList.toggle('on');
        const psel = qs('[data-field="priority"]');
        if (psel) {
          if (node.classList.contains('on')) psel.value = '3';
          else if (psel.value === '3') psel.value = '2';
        }
        break;
      }
      case 'quick-edit':
        e && e.stopPropagation();
        openItemDrawer(App.state.items.find((i) => i.id === node.dataset.id));
        break;
      case 'quick-delete':
        e && e.stopPropagation();
        await quickDelete(node.dataset.id, node.closest('.item, .task-card'));
        break;
      case 'edit':
        e && e.stopPropagation();
        openItemDrawer(App.state.items.find((i) => i.id === node.dataset.id));
        break;
      case 'del':
        e && e.stopPropagation();
        await deleteItemSafe(node.dataset.id);
        break;
      case 'add':
        window.dayflow.openAdd({ date: node.dataset.date || App.payload.today.today });
        break;
      case 'day':
        App.ui.calSel = node.dataset.date;
        App.ui.calCursor = node.dataset.date.slice(0, 7);
        go('calendar');
        break;
      case 'sel':
        App.ui.calSel = node.dataset.date;
        renderView({ animate: false });
        dealCards(qsa('#view .day-panel'), { y: 10, rot: 0.5, stagger: 0, duration: 280 });
        dealCards(qsa('#view .day-panel .item'), { y: 6, rot: 0.4, stagger: 8, duration: 240, delay: 40 });
        break;
      case 'cal': {
        const cursor = App.ui.calCursor || App.payload.today.today.slice(0, 7);
        const [y, m] = cursor.split('-').map(Number);
        const d = new Date(y, m - 1 + Number(node.dataset.dir), 1);
        App.ui.calCursor = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        renderView({ animate: true });
        animateCalendar(Number(node.dataset.dir));
        break;
      }
      case 'cal-today':
        App.ui.calCursor = App.payload.today.today.slice(0, 7);
        App.ui.calSel = App.payload.today.today;
        renderView({ animate: true });
        animateCalendar(0);
        break;
      case 'range':
        App.ui.plannerWeeks = Number(node.dataset.weeks);
        renderView({ animate: false });
        animatePlanner();
        break;
      case 'range-offset':
        App.ui.plannerOffset = Number(node.dataset.offset);
        renderView({ animate: true });
        animatePlanner();
        break;
      case 'gantt-weeks':
        App.ui.ganttWeeks = Number(node.dataset.weeks);
        renderView({ animate: false });
        break;
      case 'gantt-offset':
        App.ui.ganttOffset = Number(node.dataset.offset);
        renderView({ animate: false });
        break;
      case 'gantt-done':
        App.ui.ganttDone = !App.ui.ganttDone;
        renderView({ animate: false });
        break;
      case 'gantt-filter':
        App.ui.ganttFilter = node.dataset.filter || 'all';
        renderView({ animate: false });
        break;
      case 'gantt-key':
        App.ui.ganttKeyOnly = !App.ui.ganttKeyOnly;
        renderView({ animate: false });
        break;
      case 'checkin': {
        const rid = node.dataset.rid;
        node.classList.toggle('on');
        await window.dayflow.toggleCheckin(rid, App.payload.today.today);
        break;
      }
      case 'track': {
        const tr = (App.state.tracks || []).find((x) => x.id === node.dataset.id);
        if (tr) {
          App.trackDraft = JSON.parse(JSON.stringify(tr));
          renderDrawer();
        }
        break;
      }
      case 'track-del':
        e && e.stopPropagation();
        if (!App.trackDraft) {
          const tr = (App.state.tracks || []).find((x) => x.id === node.dataset.id);
          if (tr) App.trackDraft = JSON.parse(JSON.stringify(tr));
        }
        await deleteTrackSafe();
        break;
      case 'course-edit': {
        e && e.stopPropagation();
        const c = (App.state.courses || []).find((x) => x.id === node.dataset.id);
        if (c) {
          App.courseDraft = JSON.parse(JSON.stringify(c));
          renderDrawer();
        }
        break;
      }
      case 'course-save':
        await saveCourse();
        break;
      case 'course-del':
        e && e.stopPropagation();
        if (!App.courseDraft) {
          const c = (App.state.courses || []).find((x) => x.id === node.dataset.id);
          if (c) App.courseDraft = JSON.parse(JSON.stringify(c));
        }
        await deleteCourseSafe();
        break;
      case 'drawer-close':
        closeDrawer();
        break;
      case 'drawer-save':
        await saveDrawer();
        break;
      case 'drawer-del':
        if (App.draft && App.draft.id) await deleteItemSafe(App.draft.id, true);
        break;
      case 'track-save':
        await saveTrack();
        break;      case 'course': {
        const c = (App.state.courses || []).find((x) => x.id === node.dataset.id);
        if (c) openPalette(c.name);
        break;
      }
      case 'agent-mode':
        App.ui.agentMode = node.dataset.mode;
        renderView({ animate: false });
        break;
      case 'suggest': {
        const input = qs('#agentInput');
        if (input) input.value = node.dataset.text || '';
        await sendAgent();
        break;
      }
      case 'agent-send':
        await sendAgent();
        break;
      case 'voice-input':
        await voiceAgent();
        break;
      case 'agent-day':
        showAgentDay(node.dataset.day || 'today');
        break;
      case 'daily-day':
        App.ui.dailyDay = node.dataset.day || 'today';
        renderView({ animate: false });
        animateDaily(qs('#view'));
        break;
      case 'import-open':
        pickFiles();
        break;
      case 'import-confirm':
        await confirmImport();
        break;
      case 'import-cancel':
        App.ui.agentImport = null;
        renderView({ animate: false });
        break;
      case 'llm-toggle': {
        const willOpen = !(App.ui.llmOpen === undefined ? !!(App.state.settings.llm.hasKey) : !!App.ui.llmOpen);
        App.ui.llmOpen = willOpen;
        renderView({ animate: false });
        const fields = qs('#view .llm-fields');
        if (fields) {
          const h = fields.offsetHeight;
          fields.style.overflow = 'hidden';
          fields.animate(
            [
              { height: '0px', opacity: 0 },
              { height: `${h}px`, opacity: 1 },
            ],
            { duration: 300, easing: 'cubic-bezier(.16,1,.3,1)' }
          );
        }
        break;
      }
      case 'reveal-token':
        App.ui.showToken = !App.ui.showToken;
        renderView({ animate: false });
        break;
      case 'copy':
        await copyText(node.dataset.text || '');
        toast('已复制');
        break;
      case 'copy-prompt':
        await copyText(
          `你是我的日程助手。可调用日序本地 API：\nBase ${`http://127.0.0.1:${App.api.port}`}\nAuth: Bearer ${App.api.token}\n常用：GET /api/briefing、POST /api/items、PATCH /api/items/:id、POST /api/items/:id/complete、POST /api/command {text}`
        );
        toast('提示词已复制');
        break;
      case 'docs':
        window.dayflow.openExternal(`http://127.0.0.1:${App.api.port}/api/docs`);
        break;
      case 'refresh':
        await refresh();
        toast('已刷新');
        break;
      case 'autostart': {
        const next = !App.autostart;
        App.autostart = next;
        node.classList.toggle('on', next);
        const res = await window.dayflow.setAutostart(next);
        if (res && res.ok === false) {
          toast('系统未确认写入启动项；可运行 scripts\\enable-autostart.ps1 手动启用', { icon: 'bolt', duration: 4200 });
        } else {
          toast(next ? '已开启开机自启' : '已关闭开机自启', { icon: 'bolt' });
        }
        break;
      }
      case 'motion':
        await applySetting('motion', node.dataset.mode);
        renderView({ animate: false });
        break;
      case 'perf-hud':
        App.ui.perfHud = !App.ui.perfHud;
        qs('#perfHud').hidden = !App.ui.perfHud;
        node.classList.toggle('on', App.ui.perfHud);
        break;
      case 'llm-test': {
        toast('正在测试模型接口…', { icon: 'bolt' });
        const res = await window.dayflow.testLlm();
        toast(res.ok ? `模型可用 · ${res.ms}ms` : res.error, { icon: res.ok ? 'check' : 'close' });
        break;
      }
      case 'open-dir':
        window.dayflow.openDataDir();
        break;
      case 'export': {
        const res = await window.dayflow.exportData();
        if (res && res.path) toast('已导出到 ' + res.path.split('\\').pop());
        break;
      }
      case 'reset': {
        const res = await window.dayflow.resetData();
        if (res && res.ok) toast('已重置');
        break;
      }
      case 'quit':
        window.dayflow.quit();
        break;
      case 'palette-close':
        closePalette();
        break;
      default:
        break;
    }
  }

  async function saveTrack() {
    const tr = App.trackDraft;
    if (!tr) return;
    const parts = tr.parts.map((p, i) => ({
      id: p.id,
      title: p.title,
      progress: Number((qs(`[data-part="${i}"]`) || {}).value ?? p.progress),
      note: (qs(`[data-part-note="${i}"]`) || {}).value || '',
    }));
    const patch = {
      title: (qs('[data-track-field="title"]') || {}).value || tr.title,
      desc: (qs('[data-track-field="desc"]') || {}).value || '',
      due: (qs('[data-track-field="due"]') || {}).value || '',
      parts,
    };
    await window.dayflow.updateTrack(tr.id, patch);
    closeDrawer();
    toast('进度已更新');
    setTimeout(() => {
      const card = qs(`.track-card[data-id="${tr.id}"]`);
      if (!card) return;
      card.classList.add('pulse');
      setTimeout(() => card.classList.remove('pulse'), 720);
    }, 180);
  }

  async function deleteTrackSafe() {
    const tr = App.trackDraft;
    if (!tr) return;
    if (!window.confirm(`删除主线「${tr.title}」？关联日程会保留，但会解除与这条主线的关联。`)) return;
    await window.dayflow.deleteTrack(tr.id);
    closeDrawer();
    toast('已删除主线');
  }

  async function saveCourse() {
    const c = App.courseDraft;
    if (!c) return;
    const name = (qs('[data-course-field="name"]') || {}).value || '';
    if (!name.trim()) {
      toast('请填写课程名称。');
      return;
    }
    const patch = {
      id: c.id,
      name: name.trim(),
      short: (qs('[data-course-field="short"]') || {}).value || '',
      color: (qs('[data-course-field="color"]') || {}).value || c.color,
      note: (qs('[data-course-field="note"]') || {}).value || '',
    };
    await window.dayflow.updateCourse(patch);
    closeDrawer();
    toast('课程已更新');
  }

  async function deleteCourseSafe() {
    const c = App.courseDraft;
    if (!c) return;
    if (!window.confirm(`删除课程「${c.name}」？关联日程会保留，但会解除课程关联。`)) return;
    await window.dayflow.deleteCourse(c.id);
    closeDrawer();
    toast('已删除课程');
  }

  /* ── 抽屉里的自定义交互 ───────────────────────────────── */
  function bindDrawerEvents() {
    const wrap = qs('#drawerWrap');
    wrap.addEventListener('click', (e) => {
      const dom = e.target.closest('[data-field="domain"]');
      if (dom) {
        App.draft.domain = dom.dataset.value;
        qsa('[data-field="domain"]', wrap).forEach((b) => b.classList.toggle('on', b === dom));
        return;
      }
      const subToggle = e.target.closest('[data-sub-toggle]');
      if (subToggle) {
        subToggle.classList.toggle('done');
        const svg = subToggle.querySelector('svg');
        if (svg) svg.style.opacity = subToggle.classList.contains('done') ? '1' : '0';
        return;
      }
      const subDel = e.target.closest('[data-sub-del]');
      if (subDel) {
        subDel.closest('div').remove();
        return;
      }
      if (e.target.closest('[data-sub-add]')) {
        const holder = qs('#dSubtasks');
        const node = el(`<div style="display:flex;gap:7px;align-items:center">
          <button class="check" style="width:17px;height:17px;border-radius:5px" data-sub-toggle><svg viewBox="0 0 24 24" style="width:9px;height:9px;stroke:#fff;stroke-width:3;fill:none;opacity:0"><path d="M4.5 12.6l4.6 4.4L19.5 6.6"/></svg></button>
          <input class="input" style="height:30px;font-size:12px" data-sub-field placeholder="下一步" />
          <button class="icon-btn danger" data-sub-del>${icon('close')}</button>
        </div>`);
        holder.appendChild(node);
        node.querySelector('input').focus();
        return;
      }
      const actNode = e.target.closest('[data-act]');
      if (actNode) handleAction(actNode.dataset.act, actNode, e);
    });
    wrap.addEventListener('input', (e) => {
      const range = e.target.closest('[data-part]');
      if (range) {
        const i = range.dataset.part;
        const label = qs(`#tp-${i}`);
        if (label) label.textContent = range.value + '%';
      }
    });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        if (App.draft) saveDrawer();
        else if (App.trackDraft) saveTrack();
      }
    });
  }

  /* ── 全局事件 ─────────────────────────────────────────── */
  function bindGlobal() {
    const viewEl = qs('#view');
    viewEl.addEventListener('dragover', (e) => {
      if (App.ui.view !== 'agent') return;
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
      e.preventDefault();
      viewEl.classList.add('drop-hot');
    });
    viewEl.addEventListener('dragleave', (e) => {
      if (e.relatedTarget && viewEl.contains(e.relatedTarget)) return;
      viewEl.classList.remove('drop-hot');
    });
    viewEl.addEventListener('drop', async (e) => {
      if (App.ui.view !== 'agent') return;
      const files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      e.preventDefault();
      viewEl.classList.remove('drop-hot');
      await ingestFiles(files);
    });

    document.addEventListener('click', (e) => {
      const actNode = e.target.closest('[data-act]');
      if (!actNode) return;
      if (actNode.closest('#drawerWrap') || actNode.closest('#paletteWrap')) return;
      if (actNode.tagName === 'INPUT' || actNode.tagName === 'TEXTAREA') return;
      const act = actNode.dataset.act;
      if (act === 'setting') {
        if (actNode.dataset.type === 'bool') {
          actNode.classList.toggle('on');
          applySetting(actNode.dataset.key, actNode.classList.contains('on'));
        }
        return;
      }
      e.preventDefault();
      handleAction(act, actNode, e);
    });

    document.addEventListener('change', (e) => {
      const node = e.target.closest('[data-act="setting"]');
      if (!node) return;
      const key = node.dataset.key;
      const type = node.dataset.type;
      let value = node.value;
      if (type === 'bool') value = node.classList.contains('on');
      if (type === 'number') value = Number(value);
      applySetting(key, value);
    });

    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (App.ui.modulesOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeModules();
        }
        return;
      }
      if (mod && e.key === 'Tab') {
        e.preventDefault();
        cycleView(e.shiftKey ? -1 : 1);
        return;
      }
      if (mod && (e.key === 'PageDown' || e.key === 'PageUp')) {
        e.preventDefault();
        cycleView(e.key === 'PageDown' ? 1 : -1);
        return;
      }
      if (mod && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        openModules();
        return;
      }
      if (mod && (e.key === 'k' || e.key === 'K' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        App.palette.open ? closePalette() : openPalette();
        return;
      }
      if (e.key === 'Escape') {
        if (App.palette.open) closePalette();
        else if (!qs('#drawerWrap').hidden) closeDrawer();
        return;
      }
      const inField = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName);
      if (inField) {
        if (e.key === 'Enter' && e.ctrlKey) {
          const input = qs('#agentInput');
          if (input && document.activeElement === input) sendAgent();
        }
        return;
      }
      if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        cycleView(e.key === 'ArrowRight' ? 1 : -1);
        return;
      }
      if (mod) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        window.dayflow.openAdd({});
        return;
      }
      const nav = NAV.find((n) => n.key === e.key);
      if (nav) {
        e.preventDefault();
        go(nav.id);
      }
    });

    qs('#btnPalette').addEventListener('click', () => openPalette());
    qs('#btnModules').addEventListener('click', () => openModules());
    qs('#btnFormAdd').addEventListener('click', () => window.dayflow.openAdd({ mode: 'form' }));
    document.addEventListener('click', (e) => {
      if (e.target.closest('.page-title') && !e.target.closest('button')) {
        e.preventDefault();
        openModules();
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
        cycleView(e.button === 3 ? -1 : 1);
      }
    });
    document.addEventListener('auxclick', (e) => {
      if (e.button === 3 || e.button === 4) e.preventDefault();
    });

    let swipeX = 0;
    let swipeLocked = false;
    let swipeTimer = null;
    document.addEventListener(
      'wheel',
      (e) => {
        if (App.ui.modulesOpen || App.palette.open || !qs('#drawerWrap').hidden) return;
        if (e.ctrlKey) return;
        if (!(e.target instanceof Element)) return;
        if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.4) return;
        if (e.target.closest('textarea, input, select, .g-body, #modules')) return;
        swipeX += e.deltaX;
        clearTimeout(swipeTimer);
        swipeTimer = setTimeout(() => {
          swipeX = 0;
        }, 170);
        if (swipeLocked) return;
        if (Math.abs(swipeX) > 80) {
          swipeLocked = true;
          cycleView(swipeX > 0 ? 1 : -1);
          setTimeout(() => {
            swipeLocked = false;
            swipeX = 0;
          }, 650);
        }
      },
      { passive: true }
    );

    qs('#btnNew').addEventListener('click', () => window.dayflow.openAdd({}));
    qs('#agentPill').addEventListener('click', () => go('agent'));
    qs('#winMin').addEventListener('click', () => window.dayflow.minimize());
    qs('#winMax').addEventListener('click', () => window.dayflow.maximize());
    qs('#winClose').addEventListener('click', () => window.dayflow.close());
    qs('#titlebar').addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      window.dayflow.maximize();
    });
    qs('#agentSend') && qs('#agentSend').addEventListener('click', sendAgent);
    bindDrawerEvents();
  }

  /* ── 启动 ─────────────────────────────────────────────── */
  async function boot() {
    if (!window.dayflow) {
      document.body.innerHTML = '<div style="padding:40px;font:14px sans-serif">请通过 Dayflow 桌面应用启动。</div>';
      return;
    }
    const p = await window.dayflow.bootstrap();
    setPayload(p);
    paint({ animate: true });
    startClock();
    startPerf();
    bindGlobal();
    bindGanttDrag();
    initCardDrag();
    initOrderDrag();
    window.dayflow.onHealth((data) => toast((data && data.tip) || '请起身活动一下。', { icon: 'spark' }));

    window.dayflow.onState((payload) => {
      const sameView = App.ui.view;
      setPayload(payload);
      paint({ animate: false });
      if (sameView === 'agent' && qs('#agentScroll')) qs('#agentScroll').scrollTop = 99999;
    });
    window.dayflow.onQuickAdd(() => {
      openPalette();
    });
    window.dayflow.onNavigate((view) => go(view));
    window.dayflow.onWinState(({ maximized }) => {
      document.body.dataset.maximized = maximized ? '1' : '0';
    });
  }

  window.addEventListener('DOMContentLoaded', boot);
  window.App = App;
})();
