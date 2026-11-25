/* 日序 Dayflow — 基础工具、图标、动效原语 */
(function () {
  'use strict';

  const ICONS = {
    today:
      '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.1M12 19.3v2.1M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2.6 12h2.1M19.3 12h2.1M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5"/>',
    planner: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 3v3M16 3v3M7.5 13h3M13.5 13h3M7.5 17h3M13.5 17h3"/>',
    calendar: '<rect x="3.2" y="4.8" width="17.6" height="15.6" rx="3"/><path d="M3.2 9.6h17.6M8 2.9v3.4M16 2.9v3.4"/><circle cx="8.4" cy="14" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.6" cy="14" r="1.1" fill="currentColor" stroke="none"/>',
    target: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>',
    spark: '<path d="M12 3.2l1.8 4.9 4.9 1.8-4.9 1.8L12 16.6l-1.8-4.9-4.9-1.8 4.9-1.8L12 3.2Z"/><path d="M18.4 15.4l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3Z"/>',
    star: '<path d="M12 3.4l2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.9L12 3.4Z"/>',
    grip: '<circle cx="9" cy="6.4" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="6.4" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="17.6" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="17.6" r="1.3" fill="currentColor" stroke="none"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/>',
    overview: '<rect x="3.4" y="3.4" width="7.3" height="7.3" rx="2"/><rect x="13.3" y="3.4" width="7.3" height="7.3" rx="2"/><rect x="3.4" y="13.3" width="7.3" height="7.3" rx="2"/><rect x="13.3" y="13.3" width="7.3" height="7.3" rx="2"/>',
    gantt: '<rect x="3.4" y="5" width="10.6" height="3.2" rx="1.6"/><rect x="8.4" y="10.4" width="10.6" height="3.2" rx="1.6"/><rect x="5.4" y="15.8" width="12.6" height="3.2" rx="1.6"/>',
    daily: '<rect x="3.6" y="4.4" width="16.8" height="4.6" rx="1.8"/><rect x="3.6" y="10.4" width="16.8" height="4.2" rx="1.6"/><rect x="3.6" y="16" width="10.4" height="3.6" rx="1.4"/>',
    upload: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/>',
    mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/>',
    form: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.5 15.5l4.2 4.2"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    chevronLeft: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    chevronRight: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    chevronDown: '<path d="M5.5 9.5L12 16l6.5-6.5"/>',
    check: '<path d="M4.5 12.6l4.6 4.4L19.5 6.6"/>',
    clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.2 2"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2h9.2L17.5 7"/><path d="M10.5 10.5v5.5M13.5 10.5v5.5"/>',
    edit: '<path d="M4.5 19.5l4.2-1 10-10-3.2-3.2-10 10-1 4.2Z"/><path d="M13.8 6.4l3.2 3.2"/>',
    arrowUpRight: '<path d="M7 17L17 7M9 7h8v8"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.4"/><path d="M15 5.6H6.4A1.9 1.9 0 0 0 4.5 7.5v8.6"/>',
    external: '<path d="M14 4.5h5.5V10M19.5 4.5L11 13"/><path d="M18 14.5v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h4"/>',
    flame: '<path d="M12 21c3.8 0 6.4-2.6 6.4-6.1 0-3.1-1.9-5.1-3.4-6.8-.7-.8-1.4-1.6-1.8-2.6-2.4 1.5-3.2 3.6-3 5.5-1-.5-1.7-1.3-2-2.3-1.2 1.4-2.6 3.6-2.6 6.2C5.6 18.4 8.2 21 12 21Z"/>',
    bolt: '<path d="M13.2 2.8L5.4 13.4h5.4l-1 7.8 7.8-10.6h-5.4l1-6.8Z"/>',
    bell: '<path d="M6.5 10.5a5.5 5.5 0 0 1 11 0c0 4 1.4 5.4 2 6H4.5c.6-.6 2-2 2-6Z"/><path d="M10 19.2a2.2 2.2 0 0 0 4 0"/>',
    folder: '<path d="M3.6 7.2a2 2 0 0 1 2-2h3.5l1.8 2h7.5a2 2 0 0 1 2 2v7.6a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2V7.2Z"/>',
    download: '<path d="M12 4.5v10M8 11l4 4 4-4M5 19h14"/>',
    monitor: '<rect x="3" y="4.5" width="18" height="12" rx="2.2"/><path d="M9 20.5h6M12 16.5v4"/>',
    cpu: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.2"/><path d="M10 2.8v3.7M14 2.8v3.7M10 17.5v3.7M14 17.5v3.7M2.8 10h3.7M2.8 14h3.7M17.5 10h3.7M17.5 14h3.7"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 4.2v4.4h-4.4"/>',
    terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2.6"/><path d="M7 9.5l3 2.7-3 2.7M12.5 15h4.5"/>',
    send: '<path d="M20.5 3.8L3.8 10.4l6.2 2.6 2.6 6.2 7.9-15.4Z"/><path d="M10 13l4.6-4.6"/>',
    link: '<path d="M9.6 13.4a4 4 0 0 1 0-5.7l2-2a4 4 0 0 1 5.7 5.7l-1 1"/><path d="M14.4 10.6a4 4 0 0 1 0 5.7l-2 2a4 4 0 0 1-5.7-5.7l1-1"/>',
    dots: '<circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    book: '<path d="M4.5 5.2A2 2 0 0 1 6.5 3.2H19v15.4H6.5a2 2 0 0 0-2 2V5.2Z"/><path d="M4.5 18.2a2 2 0 0 1 2-2H19"/>',
    users: '<circle cx="9" cy="8.4" r="3.4"/><path d="M3.2 19.4c0-3 2.6-5.2 5.8-5.2s5.8 2.2 5.8 5.2"/><path d="M16 5.4a3.2 3.2 0 0 1 0 6.2M17.2 14.8c2.1.6 3.6 2.3 3.6 4.6"/>',
    shield: '<path d="M12 3.2l7 2.6v5.4c0 4.2-2.9 7.6-7 9.6-4.1-2-7-5.4-7-9.6V5.8l7-2.6Z"/>',
    inspect: '<circle cx="10.6" cy="10.6" r="6.4"/><path d="M15.4 15.4l4.6 4.6M8 10.6h5.2"/>',
    slider: '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
  };

  function icon(name, cls) {
    const p = ICONS[name] || '';
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"${cls ? ` class="${cls}"` : ''}>${p}</svg>`;
  }

  const BRAND = `<svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true">
    <defs><linearGradient id="df-brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7A6BFF"/><stop offset="0.55" stop-color="#4B5CF5"/><stop offset="1" stop-color="#3B49D8"/>
    </linearGradient></defs>
    <rect x="1.5" y="1.5" width="29" height="29" rx="9.5" fill="url(#df-brand)"/>
    <path d="M8 20.4h16" stroke="#fff" stroke-width="1.9" stroke-linecap="round" opacity=".42"/>
    <path d="M8.8 20.2a7.2 7.2 0 0 1 14.4 0" stroke="#fff" stroke-width="2.1" stroke-linecap="round" fill="none"/>
    <circle cx="23.2" cy="20.2" r="1.6" fill="#fff"/>
  </svg>`;

  /* ── 日期 ─────────────────────────────────────────────── */
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayISO = () => iso(new Date());
  function parseISO(s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function addDays(s, n) {
    const d = parseISO(s) || new Date();
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  function startOfWeek(s, weekStart = 1) {
    const d = parseISO(s) || new Date();
    const wd = d.getDay();
    const diff = (wd - weekStart + 7) % 7;
    d.setDate(d.getDate() - diff);
    return iso(d);
  }
  function diffDays(a, b) {
    const da = parseISO(a), db = parseISO(b);
    if (!da || !db) return 0;
    return Math.round((da - db) / 86400000);
  }
  const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const WD_SHORT = ['日', '一', '二', '三', '四', '五', '六'];
  const MONTH_CN = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  function weekday(s) {
    const d = parseISO(s);
    return d ? WD[d.getDay()] : '';
  }
  function md(s) {
    const d = parseISO(s);
    return d ? `${d.getMonth() + 1}.${pad(d.getDate())}` : '';
  }
  function cnDate(s) {
    const d = parseISO(s);
    return d ? `${d.getMonth() + 1} 月 ${d.getDate()} 日` : '';
  }
  function weekNo(s, firstMonday) {
    const first = parseISO(firstMonday);
    const d = parseISO(s);
    if (!first || !d) return 1;
    return Math.max(1, Math.floor(diffDays(iso(d), iso(first)) / 7) + 1);
  }
  function relLabel(s, today = todayISO()) {
    const n = diffDays(s, today);
    if (n === 0) return '今天';
    if (n === 1) return '明天';
    if (n === 2) return '后天';
    if (n === -1) return '昨天';
    if (n < 0) return `逾期 ${-n} 天`;
    if (n < 7) return `${n} 天后`;
    return md(s);
  }
  function dueLabel(item, today = todayISO()) {
    const n = diffDays(item.date, today);
    if (item.status === 'done') return '已完成';
    if (n < 0) return `逾期 ${-n} 天`;
    if (n === 0) return item.time ? `今天 ${item.time}` : '今天';
    if (n === 1) return item.time ? `明天 ${item.time}` : '明天';
    if (n < 7) return `${weekday(item.date)}${item.time ? ' ' + item.time : ''}`;
    return `${md(item.date)}${item.time ? ' ' + item.time : ''}`;
  }
  function timeAgo(isoStr) {
    const t = new Date(isoStr).getTime();
    if (!t) return '';
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return '刚刚';
    if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
    if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
    return `${Math.floor(s / 86400)} 天前`;
  }

  /* ── DOM ─────────────────────────────────────────────── */
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ── Toast ───────────────────────────────────────────── */
  let toastTimer = null;
  function toast(message, opts = {}) {
    const box = qs('#toasts');
    if (!box) return;
    const node = el(`<div class="toast">${icon(opts.icon || 'check')}<span>${esc(message)}</span></div>`);
    box.appendChild(node);
    if (toastTimer) clearTimeout(toastTimer);
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 240);
    }, opts.duration || 2600);
    while (box.children.length > 3) box.firstElementChild.remove();
  }

  /* ── 动效 ─────────────────────────────────────────────── */
  const reduced = () => document.body.dataset.motion === 'calm' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function stagger(root) {
    if (!root) return;
    const nodes = qsa('.rise, .pop', root);
    nodes.forEach((n, i) => n.style.setProperty('--i', Math.min(i, 8)));
  }
  function animateNumber(node, to, duration = 620) {
    if (!node) return;
    const from = Number(node.textContent) || 0;
    if (reduced() || from === to) {
      node.textContent = to;
      return;
    }
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(tick);
      else node.textContent = to;
    };
    requestAnimationFrame(tick);
  }
  function ringProgress(node, ratio, r = 56) {
    if (!node) return;
    const c = 2 * Math.PI * r;
    const value = Math.max(0, Math.min(1, ratio));
    if (value <= 0.0001) {
      node.style.transition = 'none';
      node.style.opacity = '0';
      node.style.strokeDasharray = '0 999';
      node.style.strokeDashoffset = '0';
      return;
    }
    node.style.opacity = '1';
    node.style.strokeDasharray = `${c}`;
    node.style.strokeDashoffset = `${c}`;
    const target = c * (1 - value);
    if (reduced()) {
      node.style.strokeDashoffset = `${target}`;
      return;
    }
    requestAnimationFrame(() => {
      node.style.transition = 'stroke-dashoffset .95s cubic-bezier(.16,1,.3,1)';
      node.style.strokeDashoffset = `${target}`;
    });
  }

  function copyText(text) {
    if (window.dayflow) return window.dayflow.copy(text);
    return navigator.clipboard.writeText(text).catch(() => {});
  }

  window.DF = {
    ICONS, icon, BRAND,
    iso, todayISO, parseISO, addDays, startOfWeek, diffDays, weekday, md, cnDate, weekNo, relLabel, dueLabel, timeAgo,
    WD, WD_SHORT, MONTH_CN, pad,
    el, esc, qs, qsa, toast, stagger, animateNumber, ringProgress, copyText, reduced,
  };
})();
