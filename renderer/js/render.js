/* 日序 Dayflow — 视图渲染层（简洁版） */
(function () {
  'use strict';
  const { icon, esc, md, weekday, dueLabel, diffDays, relLabel, addDays, startOfWeek, weekNo, WD_SHORT, MONTH_CN, parseISO, iso, pad } = window.DF;

  const R = {};

  /* ── 常用 ─────────────────────────────────────────────── */
  const byDate = (a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99'));
  // 紧迫度：逾期最早 → 今天 → 之后；同一天按时间；同一时间再按优先级。
  const byUrgency = (a, b) => {
    const ad = a.status === 'done' || a.status === 'dropped';
    const bd = b.status === 'done' || b.status === 'dropped';
    if (ad !== bd) return ad ? 1 : -1;
    const dateCmp = (a.date || '').localeCompare(b.date || '');
    if (dateCmp) return dateCmp;
    const timeCmp = (a.time || '24:00').localeCompare(b.time || '24:00');
    if (timeCmp) return timeCmp;
    return (b.priority || 0) - (a.priority || 0);
  };
  const isOpen = (i) => i.status !== 'done' && i.status !== 'dropped';
  const domOf = (ctx, id) => ctx.domainMap[id] || ctx.state.domains[0];
  const cv = (d) => `--c:${d.color};--c-soft:${d.soft}`;
  const courseOf = (ctx, id) => (ctx.state.courses || []).find((c) => c.id === id);
  const trackOf = (ctx, id) => (ctx.state.tracks || []).find((t) => t.id === id);
  const trackPct = (t) => (!t.parts.length ? 0 : Math.round(t.parts.reduce((n, p) => n + (Number(p.progress) || 0), 0) / t.parts.length));

  function calcStreak(completedDates, today) {
    let n = 0;
    let d = today;
    for (let i = 0; i < 400; i++) {
      if ((completedDates[d] || 0) > 0) {
        n++;
        d = addDays(d, -1);
      } else if (i === 0) {
        d = addDays(d, -1);
      } else break;
    }
    return n;
  }

  R.itemRow = function (it, ctx) {
    const d = domOf(ctx, it.domain);
    const today = ctx.today.today;
    const done = it.status === 'done';
    const overdue = !done && it.date < today;
    const course = it.course ? courseOf(ctx, it.course) : null;
    return `<div class="item ${done ? 'done' : ''} ${overdue ? 'overdue' : ''}" data-p="${it.priority}" data-id="${it.id}" data-act="edit" style="${cv(d)}">
      <button class="check" data-act="toggle" data-id="${it.id}" title="${done ? '标记未完成' : '完成'}">
        <svg viewBox="0 0 24 24"><path class="ck-path" d="M4.5 12.6l4.6 4.4L19.5 6.6"/></svg>
      </button>
      <div class="item-main" data-act="edit" data-id="${it.id}">
        <div class="item-title">${esc(it.title)}</div>
        <div class="item-meta">
          <span class="mdot"></span><span>${esc(d.name)}</span>
          ${it.time ? `<span class="msep"></span><span class="tnum">${it.time}</span>` : ''}
          ${course ? `<span class="msep"></span><span>${esc(course.short || course.name)}</span>` : ''}
          ${it.priority === 3 ? `<span class="key-badge">${icon('star')}重点</span>` : ''}
        </div>
      </div>
      <div class="item-right"><span class="due ${overdue ? '' : it.date === today ? 'hot' : ''}">${esc(dueLabel(it, today))}</span>
        <div class="quick-acts">
          <button class="qa key ${it.priority === 3 ? 'on' : ''}" data-act="key" data-id="${it.id}" title="${it.priority === 3 ? '取消重点' : '标为重点'}">${icon('star')}</button>
          <button class="qa drag" data-act="drag" data-drag-handle data-id="${it.id}" title="拖动改期">${icon('grip')}</button>
          <button class="qa" data-act="quick-edit" data-id="${it.id}" title="修改">${icon('edit')}</button>
          <button class="qa danger" data-act="quick-delete" data-id="${it.id}" title="删除">${icon('trash')}</button>
        </div>
      </div>
    </div>`;
  };

  function focusRow(it, ctx) {
    const d = domOf(ctx, it.domain);
    const today = ctx.today.today;
    const overdue = it.date < today;
    const course = it.course ? courseOf(ctx, it.course) : null;
    const track = it.trackId ? trackOf(ctx, it.trackId) : null;
    const kindLabel = it.kind === 'deadline' ? '截止' : it.kind === 'quiz' ? '测验' : it.kind === 'event' ? '日程' : '';
    const meta = [track && track.title, course && course.name, it.notes ? it.notes.slice(0, 42) : ''].filter(Boolean);
    return `<article class="task-card ${it.priority === 3 ? 'key' : ''}" data-p="${it.priority}" data-id="${it.id}" data-act="edit" style="${cv(d)}">
      <button class="check big" data-act="toggle" data-id="${it.id}" title="完成">
        <svg viewBox="0 0 24 24"><path class="ck-path" d="M4.5 12.6l4.6 4.4L19.5 6.6"/></svg>
      </button>
      <div class="task-main" data-act="edit" data-id="${it.id}">
        <div class="task-top">
          <span class="task-domain"><i></i>${esc(d.name)}</span>
          <span class="task-sep"></span>
          <span class="task-time">${it.time || '全天'}</span>
          ${kindLabel ? `<span class="task-kind">${kindLabel}</span>` : ''}
          ${it.priority === 3 ? `<button class="task-flag" data-act="key" data-id="${it.id}" title="取消重点">${icon('star')}重点</button>` : ''}
        </div>
        <div class="task-title">${esc(it.title)}</div>
        ${meta.length ? `<div class="task-meta">${meta.map(esc).join(' · ')}</div>` : ''}
      </div>
      <div class="task-side">
        <span class="task-due ${overdue ? 'overdue' : ''}">${overdue ? `逾期 ${-diffDays(it.date, today)} 天` : '今天'}</span>
        <button class="task-done" data-act="toggle" data-id="${it.id}">完成</button>
        <div class="quick-acts">
          <button class="qa key ${it.priority === 3 ? 'on' : ''}" data-act="key" data-id="${it.id}" title="${it.priority === 3 ? '取消重点' : '标为重点'}">${icon('star')}</button>
          <button class="qa drag" data-act="drag" data-drag-handle data-id="${it.id}" title="拖动改期">${icon('grip')}</button>
          <button class="qa" data-act="quick-edit" data-id="${it.id}" title="修改">${icon('edit')}</button>
          <button class="qa danger" data-act="quick-delete" data-id="${it.id}" title="删除">${icon('trash')}</button>
        </div>
      </div>
    </article>`;
  }

  /* ── 今日 ─────────────────────────────────────────────── */
  R.today = function (ctx) {
    const s = ctx.state;
    const today = ctx.today.today;
    const t = parseISO(today);
    const ws = startOfWeek(today, 1);
    const open = s.items.filter(isOpen);
    const overdue = open.filter((i) => i.date < today);
    const todayOpen = open.filter((i) => i.date === today || (i.endDate && i.date <= today && i.endDate >= today));
    const todayAll = s.items.filter((i) => i.date === today || (i.endDate && i.date <= today && i.endDate >= today));
    const doneToday = s.items.filter((i) => i.status === 'done' && (i.completedAt || '').slice(0, 10) === today);
    const weekItems = open.filter((i) => i.date >= ws && i.date <= addDays(ws, 6));
    const weekAll = s.items.filter((i) => i.date >= ws && i.date <= addDays(ws, 6));
    const weekDone = weekAll.filter((i) => i.status === 'done');
    const weekRate = weekAll.length ? Math.round((weekDone.length / weekAll.length) * 100) : 0;
    const streak = calcStreak(s.meta.completedDates || {}, today);
    const dayTotal = todayAll.length;
    const dayDone = todayAll.filter((i) => i.status === 'done').length;
    const ratio = dayTotal ? dayDone / dayTotal : 0;
    const filter = ctx.ui.filter || 'all';

    const inFilter = (i) => filter === 'all' || i.domain === filter;
    const pool = [...overdue, ...todayOpen].filter(inFilter);
    const focus = pool
      .filter((i) => i.priority === 3 || i.kind === 'deadline' || i.kind === 'quiz')
      .sort(byUrgency)
      .slice(0, 3);
    const focused = new Set(focus.map((i) => i.id));
    const restAll = pool.filter((i) => !focused.has(i.id)).sort(byUrgency);
    const rest = restAll.slice(0, 4);
    const restMore = restAll.length - rest.length;
    const doneList = doneToday.filter(inFilter);
    const keyCount = pool.filter((i) => i.priority === 3).length;

    const nowTs = Date.now();
    const tsOf = (i) => new Date(`${i.date}T${i.time || '23:59'}:00`).getTime();
    const next = open
      .filter((i) => tsOf(i) >= nowTs - 60000)
      .sort((a, b) => tsOf(a) - tsOf(b))
      .slice(0, 3);

    const deadlines = open
      .filter((i) => i.date >= today && i.date <= addDays(today, 32) && (i.kind === 'deadline' || i.kind === 'quiz' || i.kind === 'event' || i.priority === 3))
      .sort(byUrgency)
      .slice(0, 5);

    const routines = s.settings.routines || [];
    const checks = s.checkins[today] || {};
    const doneRoutines = routines.filter((r) => checks[r.id]).length;
    const nextOne = next[0];

    return `<div class="view-inner today">
      <div class="hero-row">
        <section class="hero rise" style="--i:0">
          <div class="hero-eyebrow">
            <span class="wk">第 ${ctx.today.week} 周</span><span class="sep"></span><span>${weekday(today)}</span><span class="sep"></span><span>距期末 ${Math.max(0, ctx.today.daysToTermEnd)} 天</span>
          </div>
          <div class="hero-date">
            <span class="d-num">${pad(t.getDate())}</span>
            <div class="d-side"><span class="d-month">${MONTH_CN[t.getMonth()]}</span><span class="d-year">${t.getFullYear()}</span></div>
          </div>
          <p class="hero-focus">${esc(s.settings.focusTitle || '把最重要的一件事先做完')}</p>
          <div class="hero-stats">
            <div class="hero-stat"><b data-count="${todayOpen.length}">0</b><span>今日待办</span></div>
            <div class="hero-stat ${overdue.length ? 'warn' : ''}"><b data-count="${overdue.length}">0</b><span>逾期</span></div>
            <div class="hero-stat ${weekRate > 0 ? 'ok' : ''}"><b data-count="${weekRate}">0</b><span>本周完成 %</span></div>
            <div class="hero-stat key"><b data-count="${keyCount}">0</b><span>重点</span></div>
          </div>
        </section>

        <section class="card metric-card rise" style="--i:1">
          <div class="ring-wrap">
            <svg width="152" height="152" viewBox="0 0 152 152" aria-hidden="true">
              <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7A6BFF"/><stop offset="1" stop-color="#4B5CF5"/></linearGradient></defs>
              <circle class="ring-track" cx="76" cy="76" r="64"/>
              <circle class="ring-value" id="ringValue" cx="76" cy="76" r="64" stroke="url(#ringGrad)"/>
            </svg>
            <div class="ring-center"><b data-count="${dayDone}">0</b><span>/ ${dayTotal} 项</span></div>
          </div>
          <div class="metric-copy">
            <div class="mc-title">今日完成 ${Math.round(ratio * 100)}%</div>
            <div class="mc-sub">${dayTotal === 0 ? '今日暂无安排' : dayDone === dayTotal ? '今日事项已全部完成' : `还剩 ${dayTotal - dayDone} 项`}</div>
            <div class="mc-streak">${icon('flame')}连续 <b>${streak}</b> 天</div>
            <div class="habit-head">每日习惯 <b>${doneRoutines}/${routines.length}</b></div>
            <div class="habit-mini">
              ${routines
                .map(
                  (r) => `<button class="habit ${checks[r.id] ? 'on' : ''}" data-act="checkin" data-rid="${r.id}" title="${esc(r.label)}">
                    <span class="h-dot">${icon('check')}</span><span class="h-label">${esc(r.label)}</span>
                  </button>`
                )
                .join('')}
            </div>
          </div>
        </section>
      </div>

      <div class="split">
        <section class="agenda rise" style="--i:2">
          <div class="agenda-head">
            <div class="agenda-title">今日重点 <span>${pool.length} 项待办${pool.filter((i) => i.date < today).length ? ` · ${pool.filter((i) => i.date < today).length} 逾期` : ''}</span></div>
            <button class="link-btn" data-act="add" data-date="${today}">${icon('plus')} 添加</button>
          </div>
          <div class="agenda-body">
            <div class="filter-row">
              <button class="filter-chip ${filter === 'all' ? 'on' : ''}" data-act="filter" data-domain="all">全部</button>
              ${s.domains.map((d) => `<button class="filter-chip ${filter === d.id ? 'on' : ''}" data-act="filter" data-domain="${d.id}"><span class="cdot" style="--c:${d.color}"></span>${esc(d.name)}</button>`).join('')}
            </div>
            ${focus.length ? `<div class="stack">${focus.map((i) => focusRow(i, ctx)).join('')}</div>` : `<div class="empty">${icon('check')}<div>今日暂无待办事项</div></div>`}
            ${
              rest.length
                ? `<div class="sub-label">其他安排 <span>${restAll.length}</span></div><div class="more-list">${rest.map((i) => R.itemRow(i, ctx)).join('')}</div>`
                : ''
            }
            ${restMore > 0 ? `<button class="more-link" data-act="nav" data-view="planner">另有 ${restMore} 项 · 查看全部排期 ${icon('chevronRight')}</button>` : ''}
            ${doneList.length ? `<button class="done-toggle ${ctx.ui.showDone ? 'open' : ''}" data-act="show-done">${icon('chevronRight')} 已完成 ${doneList.length} 项</button><div class="items" ${ctx.ui.showDone ? '' : 'hidden'}>${doneList.map((i) => R.itemRow(i, ctx)).join('')}</div>` : ''}
          </div>
        </section>

        <aside class="side-stack">
          <section class="card next-card rise" style="--i:3">
            <div class="next-label">接下来</div>
            ${nextOne
              ? `<div class="next-title">${esc(nextOne.title)}</div>
                 <div class="next-meta"><span class="cdot" style="--c:${domOf(ctx, nextOne.domain).color}"></span><span>${esc(domOf(ctx, nextOne.domain).name)}</span><span class="dot-sep"></span><span>${nextOne.date === today ? '今天' : md(nextOne.date)}${nextOne.time ? ' ' + nextOne.time : ' · 全天'}</span></div>
                 ${nextOne.time ? `<div class="next-count"><b id="countdown" data-date="${nextOne.date}" data-time="${nextOne.time}">--:--:--</b><span>后开始</span></div><div class="next-bar"><i id="countBar" style="width:0%"></i></div>` : ''}
                 ${next.length > 1 ? `<div class="next-follow">${next.slice(1).map((i) => `<div class="follow-row"><span class="f-day">${i.date === today ? '今天' : md(i.date)}</span><span class="f-dot" style="background:${domOf(ctx, i.domain).color}"></span><span class="f-title">${esc(i.title)}</span></div>`).join('')}</div>` : ''}`
              : `<div class="next-title">暂无后续事项</div><div class="mc-sub">明日暂无安排。</div>`}
          </section>

          <section class="card rise" style="--i:4">
            <div class="card-head"><div class="card-title">近期截止</div><button class="link-btn" data-act="nav" data-view="planner">排期 ${icon('chevronRight')}</button></div>
            <div class="card-body tight">
              ${deadlines.length
                ? deadlines.map((i) => `<div class="dl-row" data-act="edit" data-id="${i.id}">
                    <span class="dl-date">${md(i.date)}<em>${weekday(i.date).replace('周', '')}</em></span>
                    <span class="dl-title">${esc(i.title)}</span>
                    <span class="dl-left ${diffDays(i.date, today) <= 2 ? 'hot' : ''}">${diffDays(i.date, today) === 0 ? '今天' : diffDays(i.date, today) + '天'}</span>
                  </div>`).join('')
                : '<div class="empty" style="padding:18px 6px">一个月内暂无截止事项</div>'}
            </div>
          </section>
        </aside>
      </div>
    </div>`;
  };

  /* ── 总览（宏观俯视） ─────────────────────────────────── */
  R.overview = function (ctx) {
    const s = ctx.state;
    const today = ctx.today.today;
    const first = s.settings.semesterFirstMonday || '2026-09-07';
    const TOTAL = 18;
    const cur = ctx.today.week;
    const all = s.items.filter((i) => i.status !== 'dropped');
    const open = all.filter(isOpen);
    const done = all.filter((i) => i.status === 'done');

    const weeks = Array.from({ length: TOTAL }, (_, i) => {
      const start = addDays(first, i * 7);
      const end = addDays(start, 6);
      const items = all.filter((it) => it.date >= start && it.date <= end);
      return { no: i + 1, start, end, items, isNow: i + 1 === cur };
    });
    const maxCount = Math.max(1, ...weeks.map((w) => w.items.length));

    const byDomain = s.domains.map((d) => ({ d, n: open.filter((i) => i.domain === d.id).length }));
    const totalOpen = byDomain.reduce((a, b) => a + b.n, 0) || 1;

    const heatStart = startOfWeek(today, 1);
    const heat = Array.from({ length: 56 }, (_, i) => {
      const date = addDays(heatStart, i);
      const n = all.filter((it) => it.date === date || (it.endDate && it.date <= date && it.endDate >= date)).length;
      return { date, n };
    });
    const heatMax = Math.max(1, ...heat.map((h) => h.n));

    const ringR = 54;
    const ringC = 2 * Math.PI * ringR;
    let acc = 0;
    const segments = byDomain
      .map(({ d, n }) => {
        const dash = (n / totalOpen) * ringC;
        const seg = `<circle cx="70" cy="70" r="${ringR}" fill="none" stroke="${d.color}" stroke-width="15" stroke-dasharray="${dash.toFixed(1)} ${(ringC - dash).toFixed(1)}" stroke-dashoffset="${(-acc).toFixed(1)}" transform="rotate(-90 70 70)"/>`;
        acc += dash;
        return seg;
      })
      .join('');

    let prevMonth = 0;
    const monthAxis = weeks
      .map((w) => {
        const m = parseISO(w.start).getMonth() + 1;
        const label = m !== prevMonth ? `${m} 月` : '';
        prevMonth = m;
        return `<span>${label}</span>`;
      })
      .join('');

    const barSegs = (w) =>
      s.domains
        .map((d) => {
          const n = w.items.filter((i) => i.domain === d.id).length;
          return n ? `<i style="flex:${n};background:${d.color}"></i>` : '';
        })
        .join('');

    const keyItems = open
      .filter((i) => i.priority === 3 && i.date <= addDays(today, 7))
      .sort(byDate)
      .slice(0, 3);

    return `<div class="view-inner overview">
      <div class="page-head">
        <div><h1 class="page-title">总览</h1><p class="page-sub">第 ${cur} / ${TOTAL} 周 · ${all.length} 项 · 已完成 ${done.length} · ${open.length} 项在办</p></div>
        <div class="page-actions">
          <span class="chip">学期进度 ${Math.round((cur / TOTAL) * 100)}%</span>
          <span class="chip">${first.slice(5).replace('-', '.')} – ${addDays(first, TOTAL * 7 - 1).slice(5).replace('-', '.')}</span>
        </div>
      </div>

      ${keyItems.length ? `<div class="ov-keys">
        <span class="ov-keys-label">${icon('spark')} 本周重点</span>
        ${keyItems
          .map((it) => {
            const d = domOf(ctx, it.domain);
            const dd = diffDays(it.date, today);
            const when = dd < 0 ? `逾期 ${-dd} 天` : dd === 0 ? '今天' : dd === 1 ? '明天' : `${dd} 天后`;
            return `<button class="ov-key" data-act="edit" data-id="${it.id}" style="--c:${d.color}">
              <span class="ov-key-title">${esc(it.title)}</span>
              <span class="ov-key-meta"><i></i>${esc(d.name)} · ${md(it.date)}<em class="${dd < 0 ? 'over' : ''}">${when}</em></span>
            </button>`;
          })
          .join('')}
      </div>` : ''}

      <section class="card map-card rise" style="--i:0">
        <div class="card-head">
          <div class="card-title">学期地图 <span class="sub">每周事务量 · 点击跳到该周</span></div>
          <div class="map-legend">
            ${s.domains.map((d) => `<span><i style="background:${d.color}"></i>${esc(d.name)}</span>`).join('')}
          </div>
        </div>
        <div class="card-body">
          <div class="map-strip">
            ${weeks
              .map((w) => {
                const h = w.items.length ? 16 + Math.round((w.items.length / maxCount) * 84) : 6;
                return `<button class="wk ${w.isNow ? 'now' : ''} ${w.items.length ? '' : 'empty'}" data-act="ov-week" data-week="${w.no}" title="${md(w.start)} – ${md(w.end)} · ${w.items.length} 项">
                  <span class="wk-n">${w.items.length || ''}</span>
                  <span class="wk-bar" style="height:${h}px">${barSegs(w)}</span>
                  <span class="wk-no">W${w.no}</span>
                </button>`;
              })
              .join('')}
          </div>
          <div class="map-axis">${monthAxis}</div>
        </div>
      </section>

      <div class="ov-grid">
        <section class="card rise" style="--i:1">
          <div class="card-head"><div class="card-title">领域分布 <span class="sub">${totalOpen} 项在办</span></div></div>
          <div class="card-body">
            <div class="ring-layout">
              <div class="donut">
                <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
                  <circle cx="70" cy="70" r="54" fill="none" stroke="rgba(19,21,27,.06)" stroke-width="15"/>
                  ${segments}
                </svg>
                <div class="donut-center"><b>${totalOpen}</b><span>待办</span></div>
              </div>
              <div class="ov-legend">
                ${byDomain
                  .map(
                    ({ d, n }) => `<div class="ov-leg-row"><i style="background:${d.color}"></i><span>${esc(d.name)}</span><b>${n}</b><em>${Math.round((n / totalOpen) * 100)}%</em></div>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </section>

        <section class="card rise" style="--i:2">
          <div class="card-head"><div class="card-title">未来 8 周 <span class="sub">每天的事务密度 · 点格子看当天</span></div></div>
          <div class="card-body">
            <div class="heat-wrap">
              <div class="heat-days">${['一', '二', '三', '四', '五', '六', '日'].map((d) => `<span>${d}</span>`).join('')}</div>
              <div class="heat-body">
                <div class="heat-cols">
                  ${Array.from({ length: 8 }, (_, i) => {
                    const start = addDays(heatStart, i * 7);
                    return `<span>${i === 0 ? '本周' : md(start)}</span>`;
                  }).join('')}
                </div>
                <div class="heat-grid">
                  ${heat
                    .map((h) => {
                      const lvl = h.n === 0 ? 0 : Math.min(4, Math.ceil((h.n / heatMax) * 4));
                      return `<button class="heat-cell l${lvl} ${h.date === today ? 'today' : ''}" data-act="ov-day" data-date="${h.date}" title="${md(h.date)} ${weekday(h.date)} · ${h.n} 项"></button>`;
                    })
                    .join('')}
                </div>
              </div>
            </div>
            <div class="heat-foot">
              <span>${md(heatStart)} – ${md(addDays(heatStart, 55))}</span>
              <span class="heat-scale">少 <i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> 多</span>
            </div>
          </div>
        </section>
      </div>

      <section class="card rise" style="--i:3">
        <div class="card-head"><div class="card-title">长期主线 <span class="sub">${s.tracks.length} 条</span></div><button class="link-btn" data-act="nav" data-view="projects">规划 ${icon('chevronRight')}</button></div>
        <div class="card-body tight">
          ${s.tracks
            .map((t) => {
              const d = domOf(ctx, t.domain);
              const pct = trackPct(t);
              return `<div class="ov-track" data-act="nav" data-view="projects" style="--c:${d.color}">
                <span class="ot-name">${esc(t.title)}</span>
                <span class="ot-due">${t.due ? diffDays(t.due, today) + ' 天' : '长期'}</span>
                <div class="progress"><i style="width:${pct}%;background:${d.color}"></i></div>
                <span class="ot-pct">${pct}%</span>
              </div>`;
            })
            .join('')}
        </div>
      </section>
    </div>`;
  };

  /* ── 甘特 ─────────────────────────────────────────────── */
  R.gantt = function (ctx) {
    const s = ctx.state;
    const today = ctx.today.today;
    const weeks = ctx.ui.ganttWeeks || 6;
    const offset = ctx.ui.ganttOffset || 0;
    const days = weeks * 7;
    const base = addDays(startOfWeek(today, 1), offset * 7);
    const rangeEnd = addDays(base, days - 1);
    const includeDone = !!ctx.ui.ganttDone;

    const all = s.items.filter((i) => i.status !== 'dropped' && (includeDone || isOpen(i)));
    const filter = ctx.ui.ganttFilter || 'all';
    const keyOnly = !!ctx.ui.ganttKeyOnly;
    const items = all.filter((it) => {
      if (filter !== 'all' && it.domain !== filter) return false;
      if (keyOnly && it.priority !== 3) return false;
      const end = it.endDate || it.date;
      return end >= base && it.date <= rangeEnd;
    });
    const keyCount = items.filter((i) => i.priority === 3).length;
    const dayCells = Array.from({ length: days }, (_, i) => addDays(base, i));
    const months = [];
    dayCells.forEach((d, i) => {
      const key = d.slice(0, 7);
      const last = months[months.length - 1];
      if (last && last.key === key) last.end = i;
      else months.push({ key, start: i, end: i });
    });
    const pct = (n) => (n / days) * 100;
    const weekStrip = Array.from({ length: weeks }, (_, i) => ({
      label: `W${ctx.today.week + offset + i}`,
      left: pct(i * 7),
      width: pct(7),
    }));
    const todayIdx = diffDays(today, base);
    const ratio = todayIdx >= 0 && todayIdx < days ? (todayIdx + 0.5) / days : -1;
    const groups = s.domains
      .map((d) => ({
        d,
        items: items.filter((i) => i.domain === d.id).sort(byUrgency),
      }))
      .filter((g) => g.items.length);

    const barFor = (it) => {
      const d = domOf(ctx, it.domain);
      const startIdx = Math.max(0, diffDays(it.date, base));
      const endIdx = Math.min(days - 1, diffDays(it.endDate || it.date, base));
      const len = Math.max(1, endIdx - startIdx + 1);
      const clipped = diffDays(it.date, base) < 0;
      const wide = len >= 4;
      const title = `${it.title} · ${md(it.date)}${it.endDate ? '–' + md(it.endDate) : ''}${it.time ? ' ' + it.time : ''}`;
      if (it.kind === 'deadline' || it.kind === 'quiz') {
        return `<div class="g-milestone ${it.priority === 3 ? 'key' : ''}" data-id="${it.id}" data-start="${it.date}" data-idx="${startIdx}" data-len="1" data-clip="${clipped ? 1 : 0}" style="left:${pct(startIdx + 0.5)}%;--c:${d.color}" title="${esc(title)}"><i></i></div>`;
      }
      return `<div class="g-bar ${it.endDate ? 'multi' : ''} ${wide ? 'wide' : ''} ${it.priority === 3 ? 'key' : ''}" data-id="${it.id}" data-start="${it.date}" data-idx="${startIdx}" data-end="${it.endDate || ''}" data-len="${len}" data-clip="${clipped ? 1 : 0}" style="left:${pct(startIdx)}%;width:${pct(len)}%;--c:${d.color}" title="${esc(title)}">${wide ? `<span>${esc(it.title)}</span>` : ''}<i class="g-resize" title="拖右边改结束日期"></i></div>`;
    };

    return `<div class="view-inner gantt-page">
      <div class="page-head">
        <div>
          <h1 class="page-title">甘特</h1>
          <p class="page-sub">${md(base)} – ${md(rangeEnd)} · ${items.length} 项${keyCount ? ` · <b class="key-count">${keyCount} 重点</b>` : ''}${includeDone ? '（含已完成）' : '在办'}</p>
        </div>
        <div class="page-actions">
          <div class="segmented">${[4, 6, 8, 12].map((n) => `<button class="${weeks === n ? 'on' : ''}" data-act="gantt-weeks" data-weeks="${n}">${n} 周</button>`).join('')}</div>
          <button class="icon-btn" data-act="gantt-offset" data-offset="${offset - 1}" title="往前一周">${icon('chevronLeft')}</button>
          <button class="chip" data-act="gantt-offset" data-offset="0">本周</button>
          <button class="icon-btn" data-act="gantt-offset" data-offset="${offset + 1}" title="往后一周">${icon('chevronRight')}</button>
          <button class="chip ${includeDone ? 'on' : ''}" data-act="gantt-done" style="${includeDone ? 'background:var(--ink);color:#fff' : ''}">${includeDone ? '隐藏已完成' : '显示已完成'}</button>
        </div>
      </div>

      <section class="card gantt-card rise" data-base="${base}" data-days="${days}">
        <div class="g-toolbar">
          <div class="g-filters">
            <button class="g-chip ${filter === 'all' ? 'on' : ''}" data-act="gantt-filter" data-filter="all">全部</button>
            <button class="g-chip key ${keyOnly ? 'on' : ''}" data-act="gantt-key"><span class="g-star">★</span>只看重点${keyCount ? ` <em>${keyCount}</em>` : ''}</button>
            ${s.domains
              .map((d) => `<button class="g-chip ${filter === d.id ? 'on' : ''}" data-act="gantt-filter" data-filter="${d.id}"><i style="background:${d.color}"></i>${esc(d.name)}</button>`)
              .join('')}
          </div>
          <div class="g-hint">拖动改期 · 拖边改时长 · 双击新建</div>
        </div>
        <div class="g-head">
          <div class="g-label g-corner">任务 <span>${weeks} 周</span></div>
          <div class="g-axis">
            <div class="g-months">
              ${months.map((m) => `<span style="left:${pct(m.start)}%;width:${pct(m.end - m.start + 1)}%">${Number(m.key.slice(5))} 月</span>`).join('')}
            </div>
            <div class="g-weeks">
              ${weekStrip.map((w) => `<span style="left:${w.left}%;width:${w.width}%">${w.label}</span>`).join('')}
            </div>
            <div class="g-days" style="grid-template-columns:repeat(${days}, minmax(0, 1fr))">
              ${dayCells.map((d, i) => {
                const wd = parseISO(d).getDay();
                const num = Number(d.slice(8));
                const show = days <= 42 || (days <= 56 ? i % 2 === 0 || wd === 1 : wd === 1 || num === 1);
                return `<span class="${wd === 0 || wd === 6 ? 'we' : ''} ${d === today ? 'today' : ''}">${show ? num : ''}</span>`;
              }).join('')}
            </div>
          </div>
        </div>

        <div class="g-body">
          <div class="g-inner">
            ${groups.map((g) => {
              const starts = g.items.map((i) => diffDays(i.date, base));
              const ends = g.items.map((i) => diffDays(i.endDate || i.date, base));
              const gs = Math.max(0, Math.min(...starts));
              const ge = Math.min(days - 1, Math.max(...ends));
              return `<div class="g-row is-group">
                <div class="g-label"><span class="g-dot" style="background:${g.d.color}"></span><b>${esc(g.d.name)}</b><em>${g.items.length}</em></div>
                <div class="g-track" data-n="${days}" style="--dw:${(100 / days).toFixed(4)}%">
                  <div class="g-summary" style="left:${pct(gs)}%;width:${pct(Math.max(1, ge - gs + 1))}%;--c:${g.d.color}"></div>
                </div>
              </div>
              ${g.items.map((it) => `<div class="g-row item ${it.priority === 3 ? 'key' : ''}">
                <div class="g-label" data-act="edit" data-id="${it.id}" title="${esc(it.title)}">
                  <span class="g-title ${it.status === 'done' ? 'done' : ''}">${it.priority === 3 ? '<i class="g-star">★</i>' : ''}${esc(it.title)}</span>
                  <em>${it.time || (it.endDate ? md(it.date) + '–' + md(it.endDate) : '全天')}</em>
                </div>
                <div class="g-track" data-n="${days}" style="--dw:${(100 / days).toFixed(4)}%">${barFor(it)}</div>
              </div>`).join('')}`;
            }).join('')}
            ${groups.length ? '' : '<div class="empty" style="padding:40px">当前时段暂无安排</div>'}
            ${ratio >= 0 ? `<div class="g-today" style="--ratio:${ratio}"></div>` : ''}
          </div>
        </div>
      </section>
    </div>`;
  };

  /* ── 排期 ─────────────────────────────────────────────── */
  R.planner = function (ctx) {
    const today = ctx.today.today;
    const weeks = ctx.ui.plannerWeeks || 6;
    const ws = startOfWeek(today, 1);
    const start = addDays(ws, (ctx.ui.plannerOffset || 0) * 7);
    const all = ctx.state.items.filter((i) => i.status !== 'dropped');
    const headDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));

    let rows = '';
    for (let w = 0; w < weeks; w++) {
      const wStart = addDays(start, w * 7);
      const wNo = weekNo(wStart, ctx.state.settings.semesterFirstMonday);
      const isNow = wStart === ws;
      rows += `<div class="pweek-label ${isNow ? 'now' : ''}"><b>W${wNo}</b><span>${md(wStart)}</span></div>`;
      for (let d = 0; d < 7; d++) {
        const date = addDays(wStart, d);
        const dayItems = all.filter((i) => i.date === date || (i.endDate && i.date <= date && i.endDate >= date)).sort(byUrgency);
        const visible = dayItems.slice(0, 2);
        rows += `<div class="pday ${date === today ? 'today' : ''}" data-act="day" data-date="${date}" data-drop-date="${date}">
          <div class="pd-num"><b>${Number(date.slice(8))}</b>${dayItems.length ? `<span>${dayItems.length}</span>` : ''}</div>
          ${visible.map((i) => `<div class="pchip drag-mini ${i.status === 'done' ? 'done' : ''}" data-drag-id="${i.id}" style="${cv(domOf(ctx, i.domain))}">${i.time ? i.time + ' ' : ''}${esc(i.title)}</div>`).join('')}
          ${dayItems.length > 2 ? `<div class="pmore">+${dayItems.length - 2}</div>` : ''}
        </div>`;
      }
    }

    const open = ctx.state.items.filter(isOpen);
    return `<div class="view-inner planner">
      <div class="page-head">
        <div><h1 class="page-title">排期</h1><p class="page-sub">${md(start)} – ${md(addDays(start, weeks * 7 - 1))} · ${open.length} 项待办</p></div>
        <div class="page-actions">
          <div class="segmented">${[4, 6, 8].map((n) => `<button class="${weeks === n ? 'on' : ''}" data-act="range" data-weeks="${n}">${n} 周</button>`).join('')}</div>
          <button class="icon-btn" data-act="range-offset" data-offset="${(ctx.ui.plannerOffset || 0) - 1}" title="往前一周">${icon('chevronLeft')}</button>
          <button class="chip" data-act="range-offset" data-offset="0">本周</button>
          <button class="icon-btn" data-act="range-offset" data-offset="${(ctx.ui.plannerOffset || 0) + 1}" title="往后一周">${icon('chevronRight')}</button>
        </div>
      </div>
      <div class="pgrid">
        <div class="phead-cell"></div>
        ${headDays.map((d) => `<div class="phead-cell ${d === today ? 'today' : ''}"><div class="ph-wd">${weekday(d)}</div><div class="ph-date">${md(d)}</div></div>`).join('')}
        ${rows}
      </div>
    </div>`;
  };

  /* ── 日历 ─────────────────────────────────────────────── */
  R.calendar = function (ctx) {
    const today = ctx.today.today;
    const cursor = ctx.ui.calCursor || today.slice(0, 7);
    const [y, m] = cursor.split('-').map(Number);
    const monthStart = iso(new Date(y, m - 1, 1));
    const gridStart = startOfWeek(monthStart, 1);
    const sel = ctx.ui.calSel || today;
    const filter = ctx.ui.filter || 'all';
    const all = ctx.state.items.filter((i) => i.status !== 'dropped');

    let cells = '';
    for (let i = 0; i < 42; i++) {
      const date = addDays(gridStart, i);
      const items = all
        .filter((x) => (x.date === date || (x.endDate && x.date <= date && x.endDate >= date)) && (filter === 'all' || x.domain === filter))
        .sort(byUrgency);
      const out = date.slice(0, 7) !== cursor;
      cells += `<div class="cal-cell ${out ? 'out' : ''} ${date === today ? 'today' : ''} ${date === sel ? 'sel' : ''}" data-act="sel" data-date="${date}" data-drop-date="${date}">
        <div class="cc-num"><span>${Number(date.slice(8))}</span>${date === today ? '<span class="cc-dot"></span>' : ''}</div>
        ${items.slice(0, 2).map((x) => `<div class="cal-ev drag-mini" data-drag-id="${x.id}" style="${cv(domOf(ctx, x.domain))}">${esc(x.title)}</div>`).join('')}
        ${items.length > 2 ? `<div class="cal-more">+${items.length - 2}</div>` : ''}
      </div>`;
    }

    const selItems = all.filter((x) => x.date === sel || (x.endDate && x.date <= sel && x.endDate >= sel)).sort(byUrgency);
    const monthItems = all.filter((x) => x.date.slice(0, 7) === cursor);
    const monthDone = monthItems.filter((x) => x.status === 'done').length;

    return `<div class="view-inner">
      <div class="page-head">
        <div><h1 class="page-title">日历</h1><p class="page-sub">${monthItems.length} 项 · 已完成 ${monthDone}</p></div>
        <div class="page-actions">
          <div class="segmented">
            <button class="${filter === 'all' ? 'on' : ''}" data-act="filter" data-domain="all">全部</button>
            ${ctx.state.domains.map((d) => `<button class="${filter === d.id ? 'on' : ''}" data-act="filter" data-domain="${d.id}">${esc(d.name)}</button>`).join('')}
          </div>
          <button class="chip" data-act="cal-today">今天</button>
          <button class="icon-btn" data-act="cal" data-dir="-1">${icon('chevronLeft')}</button>
          <button class="icon-btn" data-act="cal" data-dir="1">${icon('chevronRight')}</button>
        </div>
      </div>
      <div class="cal-wrap">
        <section class="card cal-card">
          <div class="cal-head"><div class="cal-month"><b>${y} 年 ${m} 月</b></div></div>
          <div class="cal-weekdays">${['一', '二', '三', '四', '五', '六', '日'].map((w) => `<div>${w}</div>`).join('')}</div>
          <div class="cal-grid">${cells}</div>
        </section>
        <aside class="day-panel">
          <section class="card">
            <div class="card-head">
              <div>
                <div class="dp-date"><b>${Number(sel.slice(8))}</b><span>${parseISO(sel).getMonth() + 1} 月 · ${weekday(sel)}</span></div>
                <div class="dp-sub">${relLabel(sel, today)} · ${selItems.length} 项</div>
              </div>
              <button class="icon-btn" data-act="add" data-date="${sel}">${icon('plus')}</button>
            </div>
            <div class="card-body">
              <div class="items compact">
                ${selItems.length ? selItems.map((i) => R.itemRow(i, ctx)).join('') : `<div class="empty">${icon('calendar')}<div>这天还空着</div></div>`}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>`;
  };

  /* ── 规划 ─────────────────────────────────────────────── */
  R.projects = function (ctx) {
    const tracks = ctx.state.tracks || [];
    const courses = ctx.state.courses || [];
    const open = ctx.state.items.filter(isOpen);

    return `<div class="view-inner">
      <div class="page-head">
        <div><h1 class="page-title">规划</h1><p class="page-sub">${tracks.length} 条主线 · ${courses.length} 门课程</p></div>
      </div>

      <div class="track-grid">
        ${tracks
          .map((t, idx) => {
            const d = domOf(ctx, t.domain);
            const pct = trackPct(t);
            const linked = open.filter((i) => i.trackId === t.id).length;
            const oddLast = idx === tracks.length - 1 && tracks.length % 2 === 1;
            return `<section class="card hoverable track-card ${oddLast ? 'wide' : ''} rise" data-act="track" data-id="${t.id}" style="--i:${idx};${cv(d)}">
              <div class="tc-head">
                <div>
                  <div class="tc-title">${esc(t.title)}</div>
                  <div class="tc-desc">${esc(t.desc || '')}</div>
                </div>
                <span class="tc-due">${t.due ? diffDays(t.due, ctx.today.today) + ' 天' : '长期'}</span>
              </div>
              <div class="tc-parts">
                ${t.parts.map((p) => `<div class="part-row">
                  <div class="part-top"><span class="pt-name">${esc(p.title)}</span><span class="pt-pct">${p.progress}%</span></div>
                  <div class="progress"><i style="width:${p.progress}%;background:${d.color}"></i></div>
                </div>`).join('')}
              </div>
              <div class="tc-foot">
                <span class="tc-pct">${pct}%</span>
                <span class="tc-sub">${linked} 项在办</span>
                <span class="spacer" style="flex:1"></span>
                <button class="icon-btn" data-act="track" data-id="${t.id}" title="更新进度">${icon('edit')}</button>
              </div>
            </section>`;
          })
          .join('')}
      </div>

      <section class="card rise" style="--i:5;margin-top:16px">
        <div class="card-head"><div class="card-title">课程 <span class="sub">最近的提交</span></div></div>
        <div class="card-body tight">
          <div class="course-list">
            ${courses
              .map((c) => {
                const next = open.filter((i) => i.course === c.id).sort(byUrgency)[0];
                return `<div class="course-row" style="--c:${c.color}" data-act="course" data-id="${c.id}">
                  <span class="cr-dot"></span><span class="cr-name">${esc(c.name)}</span>
                  <span class="cr-next">${next ? esc(next.title) : '暂无待办'}</span>
                  <span class="cr-date">${next ? relLabel(next.date) : ''}</span>
                </div>`;
              })
              .join('')}
          </div>
        </div>
      </section>
    </div>`;
  };

  /* ── 安排（按天） ─────────────────────────────────────── */
  R.daily = function (ctx) {
    const s = ctx.state;
    const today = ctx.today.today;
    const sel = ctx.ui.dailyDay || 'today';
    const open = s.items.filter(isOpen);
    const doneAll = s.items.filter((i) => i.status === 'done');
    const D = (n) => addDays(today, n);
    const overdue = open.filter((i) => i.date < today).sort(byUrgency);
    const tabs = [
      { key: 'today', label: '今天', date: today, items: [...overdue, ...open.filter((i) => i.date === today)].sort(byUrgency), over: overdue.length },
      { key: 'tomorrow', label: '明天', date: D(1), items: open.filter((i) => i.date === D(1)).sort(byUrgency), over: 0 },
      { key: 'after', label: '后天', date: D(2), items: open.filter((i) => i.date === D(2)).sort(byUrgency), over: 0 },
      { key: 'later', label: '之后', date: D(3), items: open.filter((i) => i.date > D(2)).sort(byUrgency), over: 0 },
    ];
    const cur = tabs.find((t) => t.key === sel) || tabs[0];
    const doneCount = doneAll.filter((i) => i.date === cur.date).length;

    const tabsHtml = tabs
      .map((t) => {
        return `<button class="day-card ${t.key === cur.key ? 'is-on' : ''} ${t.items.length ? '' : 'is-empty'}" data-act="daily-day" data-day="${t.key}" data-drop-date="${t.date}">
          <span class="dc-head"><b>${t.label}</b><em>${t.key === 'later' ? md(t.date) + ' 起' : md(t.date)}</em></span>
          <span class="dc-count"><b>${t.items.length}</b><span>项</span>${t.over ? `<em class="dc-over">${t.over} 逾期</em>` : ''}</span>
        </button>`;
      })
      .join('');

    const cards = (list) => (list.length ? `<div class="items daily-items">${list.map((i) => R.itemRow(i, ctx)).join('')}</div>` : '');

    let body = '';
    if (cur.key === 'today') {
      if (overdue.length) {
        body += `<div class="dp-sec"><span class="dp-sec-t over">逾期 ${overdue.length}</span><span class="dp-sec-line"></span></div>${cards(overdue)}`;
      }
      const todays = open.filter((i) => i.date === today).sort(byUrgency);
      body += `<div class="dp-sec"><span class="dp-sec-t">今天 · ${md(today)} ${weekday(today)}</span><span class="dp-sec-line"></span></div>${todays.length ? cards(todays) : '<div class="dp-empty">今日暂无其他安排。</div>'}`;
    } else if (cur.key === 'later') {
      const groups = [];
      cur.items.forEach((i) => {
        const last = groups[groups.length - 1];
        if (last && last.date === i.date) last.items.push(i);
        else groups.push({ date: i.date, items: [i] });
      });
      const shown = groups.slice(0, 5);
      const restCount = groups.slice(5).reduce((n, g) => n + g.items.length, 0);
      body = shown.length
        ? shown.map((g) => `<div class="dp-sec"><span class="dp-sec-t">${md(g.date)} ${weekday(g.date)}</span><span class="dp-sec-line"></span></div>${cards(g.items)}`).join('') +
          (restCount ? `<button class="link-btn dp-more" data-act="nav" data-view="planner">另有 ${restCount} 项 · 查看排期 ${icon('chevronRight')}</button>` : '')
        : '<div class="dp-empty">之后暂无安排。</div>';
    } else {
      body = cur.items.length ? cards(cur.items) : `<div class="dp-empty">${cur.label}暂无安排。</div>`;
    }

    return `<div class="view-inner daily-page">
      <div class="page-head">
        <div><h1 class="page-title">安排</h1><p class="page-sub">按日程时间 · 紧迫度排序</p></div>
        <div class="page-actions"><button class="btn primary" data-act="add" data-date="${cur.date}">${icon('plus')} 添加</button></div>
      </div>

      <div class="daily-tabs">${tabsHtml}</div>

      <section class="card daily-panel rise">
        <header class="dp-head">
          <div class="dp-date"><b>${Number(cur.date.slice(8))}</b><div><span>${MONTH_CN[parseISO(cur.date).getMonth()]}</span><em>${cur.label} · ${weekday(cur.date)}</em></div></div>
          <div class="dp-meta">
            <span><b>${cur.items.length}</b> 在办</span>
            ${cur.over ? `<span class="over"><b>${cur.over}</b> 逾期</span>` : ''}
          </div>
        </header>
        <div class="dp-body">${body}</div>
      </section>
    </div>`;
  };

  /* ── Agent ────────────────────────────────────────────── */
  R.agent = function (ctx) {
    const s = ctx.state;
    const today = ctx.today.today;
    const base = `http://127.0.0.1:${ctx.api.port || 7788}`;
    const msgs = ctx.ui.agentMsgs || [];

    const LOGO = `<svg viewBox="0 0 24 24" fill="none"><path d="M5 16a7 7 0 0 1 14 0" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="17.4" cy="16" r="1.7" fill="#fff"/><path d="M5.5 19.5h13" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".45"/></svg>`;

    const opCards = (m) => {
      const ops = Array.isArray(m.ops) ? m.ops : [];
      const applied = Array.isArray(m.applied) ? m.applied : [];
      return ops
        .map((op, i) => {
          const res = applied[i] || {};
          const rec =
            op.item ||
            (op.id ? s.items.find((x) => x.id === op.id) : null) ||
            (res.id ? s.items.find((x) => x.id === res.id) : null);
          const id = (rec && rec.id) || res.id || op.id;
          const title = (rec && rec.title) || res.title || '';
          if (!id || !title) return '';
          const d = rec ? domOf(ctx, rec.domain) : domOf(ctx, 'research');
          let tag = '已登记';
          let iconName = 'plus';
          let meta = rec ? `${md(rec.date)}${rec.time ? ' ' + rec.time : ''} · ${esc(d.name)}` : '';
          if (op.op === 'update') {
            const patch = op.patch || {};
            if (patch.status === 'done') {
              tag = '已完成';
              iconName = 'check';
            } else {
              tag = '已调整';
              iconName = 'refresh';
              meta = rec ? `${md(patch.date || rec.date)}${(patch.time || rec.time) ? ' ' + (patch.time || rec.time) : ''} · ${esc(d.name)}` : '';
            }
          } else if (op.op === 'delete') {
            tag = '已删除';
            iconName = 'trash';
          }
          return `<div class="act-card" data-act="edit" data-id="${id}" style="--c:${d.color}">
            <span class="ac-ic">${icon(iconName)}</span>
            <span class="ac-main"><b>${esc(title)}</b><em>${meta}</em></span>
            <span class="ac-tag">${tag}</span>
          </div>`;
        })
        .join('');
    };

    const dayList = (m) => {
      const items = (m.items || []).map((id) => s.items.find((i) => i.id === id)).filter(Boolean);
      if (!items.length) return '<div class="chat-empty">该日期暂无待办事项。</div>';
      return `<div class="chat-cards">${items
        .map((it) => {
          const d = domOf(ctx, it.domain);
          const done = it.status === 'done';
          const over = !done && it.date < today;
          return `<div class="chat-task ${done ? 'done' : ''}" data-act="edit" data-id="${it.id}" style="--c:${d.color}">
            <button class="check" data-act="toggle" data-id="${it.id}" title="${done ? '标记未完成' : '完成'}"><svg viewBox="0 0 24 24"><path class="ck-path" d="M4.5 12.6l4.6 4.4L19.5 6.6"/></svg></button>
            <span class="ct-main"><b>${esc(it.title)}</b><em>${it.time || '全天'} · ${esc(d.name)}</em></span>
            <span class="ct-due ${over ? 'over' : ''}">${over ? `逾期 ${-diffDays(it.date, today)} 天` : dueLabel(it, today)}</span>
          </div>`;
        })
        .join('')}</div>${m.more ? `<button class="chat-more" data-act="nav" data-view="${m.dayKey === 'later' ? 'planner' : 'today'}">另有 ${m.more} 项 · 查看${m.dayKey === 'later' ? '排期' : '今日'}</button>` : ''}`;
    };

    const renderMsg = (m) => {
      if (m.role === 'me') return `<div class="msg me"><div class="bubble">${esc(m.text)}</div></div>`;
      const extra = m.kind === 'day' ? dayList(m) : opCards(m);
      return `<div class="msg bot"><span class="avatar">${LOGO}</span><div class="say"><p>${esc(m.text || '').replace(/\n/g, '<br>')}</p>${extra}</div></div>`;
    };

    const imp = ctx.ui.agentImport;
    const importCard =
      imp && imp.items.length
        ? `<div class="import-card">
            <div class="ic-head"><span class="ic-kicker">导入预览</span><b>识别到 ${imp.items.length} 项</b><em>${esc(imp.source || '')}</em></div>
            <div class="ic-list">
              ${imp.items
                .slice(0, 5)
                .map((it) => {
                  const d = domOf(ctx, it.domain);
                  return `<div class="ic-row"><span class="ic-dot" style="background:${d.color}"></span><span class="ic-title">${esc(it.title)}</span><span class="ic-when">${md(it.date)}${it.time ? ' ' + it.time : ''}</span></div>`;
                })
                .join('')}
            </div>
            ${imp.items.length > 5 ? `<div class="ic-more">还有 ${imp.items.length - 5} 项</div>` : ''}
            <div class="ic-actions"><button class="btn primary" data-act="import-confirm">确认导入 ${imp.items.length} 项</button><button class="btn ghost" data-act="import-cancel">取消</button></div>
          </div>`
        : '';

    const thinking = ctx.ui.agentThinking
      ? `<div class="msg bot"><span class="avatar">${LOGO}</span><div class="say"><span class="typing"><i></i><i></i><i></i></span></div></div>`
      : '';

    const greet = msgs.length
      ? ''
      : `<div class="msg bot"><span class="avatar">${LOGO}</span><div class="say">
          <p>您好，请告知需要登记的事项，或导入日程文件。</p>
          <div class="chat-suggests">
            <button class="chat-chip" data-act="suggest" data-text="今天还有什么没做完？">梳理今日待办</button>
            <button class="chat-chip" data-act="suggest" data-text="明天有什么安排？">查看明日安排</button>
            <button class="chat-chip" data-act="import-open">导入日程文件</button>
          </div>
        </div></div>`;

    return `<div class="view-inner agent-page">
      <header class="agent-head">
        <div class="ah-left"><h1 class="page-title">日程登记</h1><p class="page-sub">口述事项，或导入日程文件</p></div>
        <div class="ah-right">
          <button class="link-btn" data-act="nav" data-view="daily">${icon('daily')} 查看每日安排</button>
        </div>
      </header>

      <div class="agent-chat">
        <div class="chat-scroll ${msgs.length ? '' : 'is-empty'}" id="agentScroll">
          <div class="chat-col">${greet}${msgs.map(renderMsg).join('')}${thinking}${importCard}</div>
        </div>
        <div class="ac-dock">
          <div class="ac-tools">
            <button class="attach-btn" data-act="import-open">${icon('upload')} 导入日程文件</button>
            <span class="dock-note">.ics / .json / .txt</span>
          </div>
          <div class="ac-field">
            <textarea id="agentInput" rows="1" placeholder="请描述需要登记的事项，Enter 提交"></textarea>
            <button class="mic-btn" data-act="voice-input" title="语音输入">${icon('mic')}</button>
            <button class="btn primary" id="agentSend" data-act="agent-send">${icon('send')} 提交</button>
          </div>
        </div>
      </div>
    </div>`;
  };

  /* ── 设置 ─────────────────────────────────────────────── */
  R.settings = function (ctx) {
    const s = ctx.state;
    const hw = ctx.hardware || { displays: [], gpu: [], cpu: {} };
    const disp = hw.displays.find((d) => d.primary) || hw.displays[0] || {};
    const gpu = (hw.gpu || []).find((g) => /NVIDIA|AMD|Intel/i.test(g.device || g.vendor || '')) || (hw.gpu || [])[0] || {};
    const motion = s.settings.motion || 'auto';
    const llmOpen = ctx.ui.llmOpen === undefined ? !!s.settings.llm.hasKey : !!ctx.ui.llmOpen;
    const rawKey = s.settings.llm.apiKey || '';
    const maskedKey = rawKey ? `${rawKey.slice(0, 3)}••••••••${rawKey.slice(-4)}` : '';
    const autoStart = ctx.autostart;

    return `<div class="view-inner">
      <div class="page-head"><div><h1 class="page-title">设置</h1><p class="page-sub">每一项都是一个具体开关</p></div></div>
      <div class="settings">
        <section class="card set-card rise" style="--i:0">
          <div class="set-head"><h3>启动</h3></div>
          <div class="set-row"><span class="sr-title">开机自启</span><button class="switch ${autoStart ? 'on' : ''}" data-act="autostart"></button></div>
          <div class="set-row"><span class="sr-title">关闭后驻留托盘</span><button class="switch ${s.settings.closeToTray !== false ? 'on' : ''}" data-act="setting" data-key="closeToTray" data-type="bool"></button></div>
          <div class="set-row"><span class="sr-title">桌面提醒</span><button class="switch ${s.settings.notify ? 'on' : ''}" data-act="setting" data-key="notify" data-type="bool"></button></div>
          <div class="set-row"><span class="sr-title">健康提醒 <em class="sr-note">每 30 分钟</em></span><button class="switch ${s.settings.health !== false ? 'on' : ''}" data-act="setting" data-key="health" data-type="bool"></button></div>
        </section>

        <section class="card set-card rise" style="--i:1">
          <div class="set-head"><h3>外观</h3></div>
          <div class="set-row"><span class="sr-title">长辈模式 <em class="sr-note">更大字 · 更大按钮 · 更轻的堆叠</em></span><button class="switch ${s.settings.senior ? 'on' : ''}" data-act="setting" data-key="senior" data-type="bool"></button></div>
          <div class="set-row"><span class="sr-title">自动适配 <em class="sr-note">按屏幕 / 显卡 / 内存</em></span><button class="switch ${s.settings.autoAdapt !== false ? 'on' : ''}" data-act="setting" data-key="autoAdapt" data-type="bool"></button></div>
          <div class="set-row"><span class="sr-title">动效</span><div class="segmented">${[['auto', '自动'], ['full', '流畅'], ['calm', '克制']].map(([v, l]) => `<button class="${motion === v ? 'on' : ''}" data-act="motion" data-mode="${v}">${l}</button>`).join('')}</div></div>
          <div class="set-row"><span class="sr-title">帧率显示</span><button class="switch ${ctx.ui.perfHud ? 'on' : ''}" data-act="perf-hud"></button></div>
          <div class="set-row"><span class="sr-title">本周焦点</span><input class="input" style="width:210px" data-act="setting" data-key="focusTitle" data-type="text" value="${esc(s.settings.focusTitle || '')}" /></div>
        </section>

        <section class="card set-card rise wide" style="--i:2">
          <div class="set-head"><h3>接口</h3><span class="set-hint">http://127.0.0.1:${ctx.api.port || 7788} · 仅本机</span></div>
          <div class="set-row">
            <span class="sr-title">Agent 接入</span>
            <div class="btn-row"><button class="btn tiny ghost" data-act="copy" data-text="${esc(ctx.api.token)}">复制 token</button><button class="btn tiny ghost" data-act="nav" data-view="agent">打开日程登记</button></div>
          </div>
          <div class="set-row"><span class="sr-title">模型解析</span><button class="switch ${llmOpen ? 'on' : ''}" data-act="llm-toggle"></button></div>
          ${llmOpen ? `<div class="llm-fields">
            <label>Base URL<input class="input mono" data-act="setting" data-key="llm.baseUrl" data-type="text" value="${esc(s.settings.llm.baseUrl || '')}" placeholder="https://api.deepseek.com" /></label>
            <label>模型<input class="input mono" data-act="setting" data-key="llm.model" data-type="text" value="${esc(s.settings.llm.model || '')}" placeholder="deepseek-chat" /></label>
            <label>API Key<input class="input mono" data-act="setting" data-key="llm.apiKey" data-type="text" value="${esc(maskedKey)}" placeholder="sk-..." /></label>
            <button class="btn tiny ghost" data-act="llm-test">${icon('bolt')} 测试</button>
          </div>` : ''}
        </section>

        <section class="card set-card rise" style="--i:3">
          <div class="set-head"><h3>数据</h3></div>
          <div class="set-row"><span class="sr-title">全部日程</span><div class="btn-row"><button class="btn tiny ghost" data-act="open-dir">${icon('folder')} 目录</button><button class="btn tiny ghost" data-act="export">${icon('download')} 导出</button><button class="btn tiny ghost" data-act="reset" style="color:var(--danger)">${icon('refresh')} 重置</button></div></div>
        </section>

        <section class="card set-card rise" style="--i:4">
          <div class="set-head"><h3>本机</h3></div>
          <div class="hw-line">
            <span>${disp.physicalWidth || disp.width || 0}×${disp.physicalHeight || disp.height || 0}</span>
            <span>${disp.frequency || 60}Hz</span>
            <span>${esc((gpu.device || 'GPU').replace('NVIDIA ', ''))}</span>
            <span>${esc((hw.cpu.model || '').replace(/\(R\)|\(TM\)|CPU @.*/g, '').trim())}</span>
            <span>${hw.memGB || 0}GB</span>
            ${(hw.maxHz || 60) >= 120 ? '<em class="hw-badge">高刷</em>' : ''}
          </div>
        </section>

        <section class="card set-card rise wide" style="--i:5">
          <div class="about-line">
            <span class="am">${window.DF.BRAND}</span>
            <span class="at">日序 Dayflow 1.0</span>
            <span class="as">Chromium ${esc(((ctx.versions || {}).chrome || '').split('.')[0])}</span>
            <span class="spacer" style="flex:1"></span>
            <button class="btn tiny ghost" data-act="quit">退出</button>
          </div>
        </section>
      </div>
    </div>`;
  };

  /* ── 抽屉 ─────────────────────────────────────────────── */
  R.itemDrawer = function (ctx, draft) {
    const isNew = !draft.id;
    const s = ctx.state;
    return `<div class="drawer" role="dialog" aria-modal="true">
      <div class="drawer-head"><div class="drawer-title">${isNew ? '新建' : '编辑'}</div><button class="icon-btn" data-act="drawer-close">${icon('close')}</button></div>
      <div class="drawer-body">
        <input class="input title-input" id="dTitle" data-field="title" value="${esc(draft.title || '')}" placeholder="要做什么？" autofocus />
        <div class="segmented" id="dDomain">
          ${s.domains.map((d) => `<button class="${(draft.domain || 'research') === d.id ? 'on' : ''}" data-field="domain" data-value="${d.id}">${esc(d.name)}</button>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <label class="mini-field">日期<input class="input" type="date" data-field="date" value="${esc(draft.date || ctx.today.today)}" /></label>
          <label class="mini-field">时间<input class="input" type="time" data-field="time" value="${esc(draft.time || '')}" /></label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <label class="mini-field">类型<select class="select" data-field="kind">${[['task', '任务'], ['deadline', '截止'], ['event', '日程'], ['quiz', '测验']].map(([v, l]) => `<option value="${v}" ${(draft.kind || 'task') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="mini-field">优先级<select class="select" data-field="priority">${[[3, '重点'], [2, '普通'], [1, '轻']].map(([v, l]) => `<option value="${v}" ${(draft.priority ?? 2) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
        <button type="button" class="key-toggle ${draft.priority === 3 ? 'on' : ''}" data-act="key-toggle" data-key-toggle>${icon('star')}<span>标为重点</span><i class="kt-dot"></i></button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <label class="mini-field">课程<select class="select" data-field="course"><option value="">无</option>${(s.courses || []).map((c) => `<option value="${c.id}" ${draft.course === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
          <label class="mini-field">主线<select class="select" data-field="trackId"><option value="">无</option>${(s.tracks || []).map((t) => `<option value="${t.id}" ${draft.trackId === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></label>
        </div>
        <textarea class="textarea" data-field="notes" placeholder="备注">${esc(draft.notes || '')}</textarea>
        <div id="dSubtasks" class="subtasks">
          ${(draft.subtasks || []).map((st, i) => `<div class="subtask-row">
            <button class="check ${st.done ? 'done' : ''}" data-sub-toggle="${i}"><svg viewBox="0 0 24 24"><path class="ck-path" d="M4.5 12.6l4.6 4.4L19.5 6.6"/></svg></button>
            <input class="input" data-sub-field="${i}" value="${esc(st.title)}" placeholder="下一步" />
            <button class="icon-btn danger" data-sub-del="${i}">${icon('close')}</button>
          </div>`).join('')}
        </div>
        <button class="btn tiny ghost" data-sub-add style="align-self:flex-start">${icon('plus')} 加一步</button>
      </div>
      <div class="drawer-foot">
        ${isNew ? '' : `<button class="btn ghost" data-act="drawer-del" style="color:var(--danger)">${icon('trash')}</button>`}
        <span class="spacer"></span>
        <button class="btn ghost" data-act="drawer-close">取消</button>
        <button class="btn primary" data-act="drawer-save">${icon('check')} 保存</button>
      </div>
    </div>`;
  };

  R.trackDrawer = function (ctx, tr) {
    return `<div class="drawer" role="dialog" aria-modal="true">
      <div class="drawer-head"><div class="drawer-title">更新进度</div><button class="icon-btn" data-act="drawer-close">${icon('close')}</button></div>
      <div class="drawer-body">
        <input class="input title-input" data-track-field="title" value="${esc(tr.title)}" />
        <textarea class="textarea" data-track-field="desc">${esc(tr.desc || '')}</textarea>
        <label class="mini-field">目标日期<input class="input" type="date" data-track-field="due" value="${esc(tr.due || '')}" /></label>
        <div class="divider"></div>
        ${tr.parts
          .map(
            (p, i) => `<div class="field">
              <label style="display:flex;justify-content:space-between">${esc(p.title)} <span class="tnum" id="tp-${i}">${p.progress}%</span></label>
              <input type="range" min="0" max="100" step="5" value="${p.progress}" data-part="${i}" style="width:100%;accent-color:var(--accent)" />
            </div>`
          )
          .join('')}
      </div>
      <div class="drawer-foot"><span class="spacer"></span><button class="btn ghost" data-act="drawer-close">取消</button><button class="btn primary" data-act="track-save">保存</button></div>
    </div>`;
  };

  window.Render = R;
})();
