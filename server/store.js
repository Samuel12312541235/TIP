'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { buildSeed } = require('./seed');

const VALID_STATUS = new Set(['todo', 'doing', 'done', 'dropped']);
const VALID_KIND = new Set(['task', 'deadline', 'event', 'quiz', 'class', 'idea']);
const VALID_DOMAIN = new Set(['research', 'duty', 'study', 'plan']);

function pad(n) {
  return String(n).padStart(2, '0');
}
function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseDate(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
function dayDiff(a, b) {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return 0;
  return Math.round((da - db) / 86400000);
}
function rid(prefix = 'it') {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}
function nowISO() {
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

class Store extends EventEmitter {
  constructor(dir) {
    super();
    this.dir = dir;
    this.file = path.join(dir, 'data.json');
    this.backupDir = path.join(dir, 'backups');
    this.state = null;
    this._timer = null;
    this._dirty = false;
    fs.mkdirSync(this.dir, { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
  }

  load() {
    let data = null;
    if (fs.existsSync(this.file)) {
      try {
        data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      } catch (err) {
        const broken = path.join(this.dir, `data.broken-${Date.now()}.json`);
        try {
          fs.copyFileSync(this.file, broken);
        } catch (_) {}
        data = null;
      }
    }
    if (!data || !Array.isArray(data.items)) {
      data = buildSeed();
      this.state = data;
      this.saveNow();
      return this.state;
    }
    // 版本迁移 / 结构补全
    const base = buildSeed();
    this.state = Object.assign({}, base, data, {
      settings: Object.assign({}, base.settings, data.settings, {
        api: Object.assign({}, base.settings.api, (data.settings || {}).api),
        llm: Object.assign({}, base.settings.llm, (data.settings || {}).llm),
      }),
      meta: Object.assign({}, base.meta, data.meta),
      checkins: data.checkins || {},
      log: Array.isArray(data.log) ? data.log : [],
    });
    if (!this.state.settings.api.token) {
      this.state.settings.api.token = rid('df').replace('_', '');
      this.saveNow();
    }
    return this.state;
  }

  saveNow() {
    if (!this.state) return;
    const tmp = `${this.file}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(tmp, this.file);
      this._dirty = false;
    } catch (err) {
      console.error('[store] save failed', err);
    }
  }

  save() {
    this._dirty = true;
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      this.saveNow();
    }, 120);
  }

  backup(label = 'auto') {
    try {
      const name = `data-${label}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      fs.writeFileSync(path.join(this.backupDir, name), JSON.stringify(this.state, null, 2), 'utf8');
      const files = fs
        .readdirSync(this.backupDir)
        .filter((f) => f.endsWith('.json'))
        .sort();
      while (files.length > 20) {
        try {
          fs.unlinkSync(path.join(this.backupDir, files.shift()));
        } catch (_) {}
      }
    } catch (err) {
      console.error('[store] backup failed', err);
    }
  }

  changed(reason = 'update', actor = 'user') {
    this.save();
    this.emit('change', { reason, actor, at: Date.now() });
  }

  get() {
    return this.state;
  }

  log(entry) {
    const s = this.state;
    if (!s) return;
    s.log.unshift(
      Object.assign({ id: rid('lg'), at: nowISO(), actor: 'agent', action: '', detail: '' }, entry)
    );
    if (s.log.length > 240) s.log.length = 240;
  }

  normalizeItem(input, existing) {
    const s = this.state;
    const out = Object.assign({}, existing || {});
    const pick = (k, dflt) => (input[k] === undefined ? dflt : input[k]);

    out.id = existing ? existing.id : input.id || rid('it');
    out.title = String(pick('title', existing ? out.title : '未命名')).trim().slice(0, 200);
    out.domain = VALID_DOMAIN.has(pick('domain', out.domain)) ? pick('domain', out.domain) : 'research';
    out.kind = VALID_KIND.has(pick('kind', out.kind)) ? pick('kind', out.kind) : 'task';
    const p = Number(pick('priority', out.priority));
    out.priority = Number.isFinite(p) ? Math.max(0, Math.min(3, Math.round(p))) : 2;
    const st = pick('status', out.status);
    out.status = VALID_STATUS.has(st) ? st : 'todo';
    out.date = parseDate(pick('date', out.date)) ? pick('date', out.date) : isoDate();
    out.endDate = parseDate(pick('endDate', out.endDate)) ? pick('endDate', out.endDate) : '';
    out.time = /^([01]\d|2[0-3]):[0-5]\d$/.test(pick('time', out.time) || '') ? pick('time', out.time) : '';
    out.notes = String(pick('notes', out.notes) || '').slice(0, 4000);
    out.course = String(pick('course', out.course) || '');
    out.trackId = String(pick('trackId', out.trackId) || '');
    out.pinned = !!pick('pinned', out.pinned);
    if (Array.isArray(pick('subtasks', out.subtasks))) {
      out.subtasks = pick('subtasks', out.subtasks).slice(0, 30).map((x) => ({
        id: x.id || rid('st'),
        title: String(x.title || '').slice(0, 120),
        done: !!x.done,
      }));
    } else if (!Array.isArray(out.subtasks)) {
      out.subtasks = [];
    }
    out.source = existing ? existing.source : input.source || 'user';
    out.createdAt = existing ? existing.createdAt : nowISO();
    out.updatedAt = nowISO();

    if (existing && existing.status !== 'done' && out.status === 'done') {
      out.completedAt = nowISO();
      const day = isoDate();
      s.meta.completedDates = s.meta.completedDates || {};
      s.meta.completedDates[day] = (s.meta.completedDates[day] || 0) + 1;
    }
    if (existing && out.status !== 'done') out.completedAt = '';
    if (!existing && out.status === 'done') out.completedAt = nowISO();
    return out;
  }

  addItem(input = {}) {
    const item = this.normalizeItem(input, null);
    this.state.items.push(item);
    this.log({
      actor: input.actor || 'user',
      action: 'add',
      detail: `${item.title} · ${item.date}${item.time ? ' ' + item.time : ''}`,
    });
    this.changed('add', input.actor || 'user');
    return item;
  }

  updateItem(id, patch = {}) {
    const idx = this.state.items.findIndex((x) => x.id === id);
    if (idx < 0) return null;
    const next = this.normalizeItem(Object.assign({}, patch, { id }), this.state.items[idx]);
    // 允许显式清空 endDate / time
    if ('endDate' in patch && !patch.endDate) next.endDate = '';
    if ('time' in patch && !patch.time) next.time = '';
    this.state.items[idx] = next;
    this.log({
      actor: patch.actor || 'user',
      action: patch._action || 'update',
      detail: `${next.title}`,
    });
    this.changed('update', patch.actor || 'user');
    return next;
  }

  deleteItem(id, actor = 'user') {
    const idx = this.state.items.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    const [removed] = this.state.items.splice(idx, 1);
    this.log({ actor, action: 'delete', detail: removed.title });
    this.changed('delete', actor);
    return true;
  }

  setStatus(id, status, actor = 'user') {
    return this.updateItem(id, { status, actor, _action: status === 'done' ? 'done' : 'status' });
  }

  toggleCheckin(routineId, date = isoDate()) {
    const s = this.state;
    s.checkins[date] = s.checkins[date] || {};
    s.checkins[date][routineId] = !s.checkins[date][routineId];
    this.changed('checkin');
    return s.checkins[date][routineId];
  }

  addTrack(input = {}) {
    const track = {
      id: input.id || rid('trk'),
      title: String(input.title || '新规划').slice(0, 80),
      domain: VALID_DOMAIN.has(input.domain) ? input.domain : 'plan',
      due: parseDate(input.due) ? input.due : '',
      desc: String(input.desc || '').slice(0, 500),
      parts: (Array.isArray(input.parts) ? input.parts : []).map((p) => ({
        id: p.id || rid('p'),
        title: String(p.title || '阶段').slice(0, 80),
        progress: Math.max(0, Math.min(100, Number(p.progress) || 0)),
        note: String(p.note || ''),
      })),
    };
    this.state.tracks.push(track);
    this.log({ actor: input.actor || 'user', action: 'track-add', detail: track.title });
    this.changed('track');
    return track;
  }

  updateTrack(id, patch = {}) {
    const t = this.state.tracks.find((x) => x.id === id);
    if (!t) return null;
    if (patch.title !== undefined) t.title = String(patch.title).slice(0, 80);
    if (patch.desc !== undefined) t.desc = String(patch.desc).slice(0, 500);
    if (patch.due !== undefined) t.due = parseDate(patch.due) ? patch.due : '';
    if (patch.domain !== undefined && VALID_DOMAIN.has(patch.domain)) t.domain = patch.domain;
    if (Array.isArray(patch.parts)) {
      t.parts = patch.parts.map((p) => ({
        id: p.id || rid('p'),
        title: String(p.title || '阶段').slice(0, 80),
        progress: Math.max(0, Math.min(100, Number(p.progress) || 0)),
        note: String(p.note || ''),
      }));
    }
    this.log({ actor: patch.actor || 'user', action: 'track-update', detail: t.title });
    this.changed('track');
    return t;
  }

  deleteTrack(id, actor = 'user') {
    const idx = this.state.tracks.findIndex((x) => x.id === id);
    if (idx < 0) return null;
    const [removed] = this.state.tracks.splice(idx, 1);
    let unlinked = 0;
    this.state.items.forEach((i) => {
      if (i.trackId === id) {
        i.trackId = '';
        unlinked += 1;
      }
    });
    this.log({ actor, action: 'track-delete', detail: removed.title });
    this.changed('track');
    return { removed, unlinked };
  }

  updateCourse(id, patch = {}) {
    const c = (this.state.courses || []).find((x) => x.id === id);
    if (!c) return null;
    if (patch.name !== undefined) c.name = String(patch.name).slice(0, 60);
    if (patch.short !== undefined) c.short = String(patch.short).slice(0, 20);
    if (patch.note !== undefined) c.note = String(patch.note).slice(0, 300);
    if (patch.color !== undefined && /^#[0-9a-f]{6}$/i.test(String(patch.color))) c.color = String(patch.color);
    this.log({ actor: patch.actor || 'user', action: 'course-update', detail: c.name });
    this.changed('course');
    return c;
  }

  deleteCourse(id, actor = 'user') {
    const idx = (this.state.courses || []).findIndex((x) => x.id === id);
    if (idx < 0) return null;
    const [removed] = this.state.courses.splice(idx, 1);
    let unlinked = 0;
    this.state.items.forEach((i) => {
      if (i.course === id) {
        i.course = '';
        unlinked += 1;
      }
    });
    this.log({ actor, action: 'course-delete', detail: removed.name });
    this.changed('course');
    return { removed, unlinked };
  }

  updateSettings(patch = {}) {
    const s = this.state.settings;
    const next = JSON.parse(JSON.stringify(patch));
    if (next.api) next.api = Object.assign({}, s.api, next.api);
    if (next.llm) next.llm = Object.assign({}, s.llm, next.llm);
    this.state.settings = Object.assign({}, s, next);
    this.log({ actor: 'user', action: 'settings', detail: Object.keys(patch).join(',') });
    this.changed('settings');
    return this.state.settings;
  }

  /** 供 agent / UI 使用的结构化简报 */
  briefing(today = isoDate()) {
    const s = this.state;
    const open = s.items.filter((x) => x.status !== 'done' && x.status !== 'dropped');
    const overdue = open
      .filter((x) => x.date < today)
      .sort((a, b) => a.date.localeCompare(b.date));
    const dueToday = open.filter((x) => x.date === today);
    const next7 = open
      .filter((x) => x.date > today && dayDiff(x.date, today) <= 7)
      .sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
    const doneToday = s.items.filter((x) => x.status === 'done' && (x.completedAt || '').slice(0, 10) === today);
    const line = (x) =>
      `${x.date === today ? '今天' : x.date.slice(5)}${x.time ? ' ' + x.time : ''} [${x.domain}] ${x.title}`;
    const text = [
      `# 日序简报 · ${today}`,
      `待办 ${open.length} 项 · 今日到期 ${dueToday.length} · 逾期 ${overdue.length} · 今日完成 ${doneToday.length}`,
      '',
      '## 逾期',
      ...(overdue.length ? overdue.map(line) : ['（无）']),
      '',
      '## 今日',
      ...(dueToday.length ? dueToday.map(line) : ['（无）']),
      '',
      '## 未来 7 天',
      ...(next7.length ? next7.map(line) : ['（无）']),
      '',
      '## 长期规划',
      ...s.tracks.map((t) => `- ${t.title}：${t.parts.map((p) => `${p.title} ${p.progress}%`).join(' / ')}`),
    ].join('\n');
    return { text, overdue, dueToday, next7, doneToday, open };
  }
}

module.exports = { Store, isoDate, parseDate, dayDiff, nowISO, rid };
