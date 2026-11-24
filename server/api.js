'use strict';

const http = require('http');
const { URL } = require('url');
const { isoDate, parseDate, dayDiff, nowISO } = require('./store');

const APP = { name: 'Dayflow', cn: '日序', version: '1.0.0' };

/* ──────────────────────────── 自然语言解析（本地兜底） ──────────────────────────── */

const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7, 七: 7, 两: 2, 十: 10 };

function parseCnDay(raw) {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  return CN_NUM[raw] || null;
}

function weekdayIndex(s) {
  if (!s) return null;
  const t = s.replace(/周|星期|礼拜/g, '');
  if (/日|天/.test(t)) return 0;
  const n = parseCnDay(t.replace(/[^\d一二三四五六日天两]/g, ''));
  if (!n || n < 1 || n > 7) return null;
  return n % 7; // 周一=1 … 周日=0
}

function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = x.getDay();
  x.setDate(x.getDate() - ((wd + 6) % 7));
  return x;
}

function fmt(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 从一句话里抽取日期；返回 {date, matched} */
function extractDate(text, today = new Date()) {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const add = (days) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return fmt(d);
  };

  let m;
  if ((m = /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/.exec(text))) {
    const y = base.getMonth() + 1 > Number(m[1]) + 1 ? base.getFullYear() + 1 : base.getFullYear();
    return { date: fmt(new Date(y, Number(m[1]) - 1, Number(m[2]))), matched: m[0] };
  }
  if ((m = /(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?!\d)/.exec(text))) {
    const y = base.getMonth() + 1 > Number(m[1]) + 1 ? base.getFullYear() + 1 : base.getFullYear();
    return { date: fmt(new Date(y, Number(m[1]) - 1, Number(m[2]))), matched: m[0] };
  }
  if ((m = /(\d{1,2})\s*天\s*(后|之后)/.exec(text))) return { date: add(Number(m[1])), matched: m[0] };
  if (/大后天/.test(text)) return { date: add(3), matched: '大后天' };
  if (/后天/.test(text)) return { date: add(2), matched: '后天' };
  if (/明天|明日/.test(text)) return { date: add(1), matched: '明天' };
  if (/今天|今日|今晚|今早/.test(text)) return { date: add(0), matched: '今天' };
  if ((m = /(下下|下|这|本)?\s*(?:周|星期|礼拜)\s*([一二三四五六日天1-7])/.exec(text))) {
    const which = m[1] || '这';
    const wd = weekdayIndex(m[2]);
    if (wd === null) return null;
    const sow = startOfWeek(base);
    const delta = which === '下下' ? 14 : which === '下' ? 7 : 0;
    const d = new Date(sow);
    d.setDate(sow.getDate() + delta + wd);
    return { date: fmt(d), matched: m[0] };
  }
  if (/(这|本)?周末/.test(text)) {
    const sow = startOfWeek(base);
    const d = new Date(sow);
    d.setDate(sow.getDate() + 6);
    return { date: fmt(d), matched: '周末' };
  }
  return null;
}

function cnNumber(raw) {
  if (!raw) return NaN;
  if (/^\d+$/.test(raw)) return Number(raw);
  const map = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (raw === '十') return 10;
  if (raw.includes('十')) {
    const [a, b] = raw.split('十');
    return (a ? map[a] || 0 : 1) * 10 + (b ? map[b] || 0 : 0);
  }
  return map[raw] ?? NaN;
}

function extractTime(text) {
  const m = /(凌晨|早上|上午|中午|下午|傍晚|晚上)?\s*(\d{1,2}|[一二三四五六七八九十两]{1,3})\s*(?:点|:|：)\s*(半|(\d{1,2}|[一二三四五六七八九十]{1,2}))?/.exec(text);
  if (!m) return null;
  let h = cnNumber(m[2]);
  if (!Number.isFinite(h)) return null;
  const min = m[3] === '半' ? 30 : Number.isFinite(cnNumber(m[4])) ? cnNumber(m[4]) : 0;
  const p = m[1] || '';
  if ((p === '下午' || p === '傍晚' || p === '晚上') && h < 12) h += 12;
  if (p === '中午' && h < 11) h += 12;
  if (p === '凌晨' && h === 12) h = 0;
  if (!p && h >= 1 && h <= 6) h += 12;
  if (h > 23) h = 23;
  return { time: `${String(h).padStart(2, '0')}:${String(Math.min(59, min)).padStart(2, '0')}`, matched: m[0] };
}

function guessDomain(text) {
  if (/学工|部门|活动|总结|PPT|ppt|例会|值班|材料|通知|班会/.test(text)) return 'duty';
  if (/课|作业|quiz|Quiz|考试|复习|英语|马原|导论|写作|自学|笔记|讲座/.test(text)) return 'study';
  if (/大论文|长期|规划|读书报告|论文选题/.test(text)) return 'plan';
  return 'research';
}

function guessKind(text) {
  if (/截止|ddl|DDL|deadline|交|提交/.test(text)) return 'deadline';
  if (/比赛|大赛|会议|答辩|汇报|活动|讲座/.test(text)) return 'event';
  if (/quiz|Quiz|测验|小测/.test(text)) return 'quiz';
  return 'task';
}

function cleanTitle(text, dateHit, timeHit) {
  let t = text;
  [dateHit, timeHit].forEach((h) => {
    if (h && h.matched) t = t.split(h.matched).join(' ');
  });
  t = t
    .replace(
      /(请|帮我|帮忙|记得|提醒我?|添加|加一个?|新增|记一下|安排|把|我要|需要|在|于|截止|之前|完成|做|一下|一个|任务|日程|待办|的)/g,
      ' '
    )
    .replace(/[，。！？、,.!?;；:：\s]+/g, ' ')
    .trim();
  return t.slice(0, 120);
}

function findItem(items, text) {
  const t = text.replace(/[「」『』"'《》\s]/g, '').toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const it of items) {
    const title = it.title.replace(/\s/g, '').toLowerCase();
    let score = 0;
    if (t.includes(title)) score = title.length + 10;
    else {
      for (let i = 0; i < title.length - 1; i++) {
        const gram = title.slice(i, i + 2);
        if (gram.length === 2 && t.includes(gram)) score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return bestScore >= 2 ? best : null;
}

function explainDate(date, today = isoDate()) {
  const d = dayDiff(date, today);
  if (d === 0) return '今天';
  if (d === 1) return '明天';
  if (d === -1) return '昨天';
  if (d > 1 && d < 7) return `${d} 天后`;
  return date.slice(5);
}

/** 本地规则解析：返回 {reply, ops, intent} */
function parseCommand(store, text, opts = {}) {
  const state = store.get();
  const today = opts.today || isoDate();
  const todayDate = parseDate(today) || new Date();
  const raw = String(text || '').trim();
  if (!raw) return { reply: '请告知需要登记的事项。', ops: [], intent: 'none' };

  const open = state.items.filter((x) => x.status !== 'done' && x.status !== 'dropped');

  // 1) 查询
  if (/(有什么|哪些|安排|简报|待办|看看|列出|清单|汇总|状态|overview)/.test(raw)) {
    const d = extractDate(raw, todayDate);
    const target = d ? d.date : today;
    const list = state.items
      .filter((x) => x.status !== 'done' && (d ? x.date === target : x.date <= today))
      .sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
    const title = d ? `${explainDate(target, today)}（${target}）` : '今日及逾期事项';
    return {
      intent: 'query',
      ops: [],
      reply: list.length
        ? `${title}共 ${list.length} 项，具体如下：\n` +
          list.map((x) => `· ${x.time || '全天'} ${x.title}${x.date < today ? '（逾期）' : ''}`).join('\n')
        : `${title}暂无待办事项，可继续推进长期安排。`,
    };
  }

  // 2) 完成 / 删除 / 修改
  const hit = findItem(open, raw) || findItem(state.items, raw);
  if (/(完成|做完|搞定|打勾|勾掉|done)/i.test(raw) && hit) {
    return {
      intent: 'done',
      ops: [{ op: 'update', id: hit.id, patch: { status: 'done' } }],
      reply: `已为您标记完成：${hit.title}`,
      target: hit.id,
    };
  }
  if (/(删除|删掉|去掉|作废|取消)/.test(raw) && hit) {
    return {
      intent: 'delete',
      ops: [{ op: 'delete', id: hit.id }],
      reply: `已删除：${hit.title}`,
    };
  }
  if (hit && /(改到|改成|推迟|提前|延期|调整到|挪到|换到|顺延)/.test(raw)) {
    const d = extractDate(raw, todayDate);
    const t = extractTime(raw);
    const patch = {};
    if (d) patch.date = d.date;
    if (t) patch.time = t.time;
    if (!Object.keys(patch).length) return { reply: '未能识别新的日期，请使用「改到 12 月 2 日下午 3 点」等表达。', ops: [], intent: 'none' };
    return {
      intent: 'update',
      ops: [{ op: 'update', id: hit.id, patch }],
      reply: `已调整：${hit.title} → ${patch.date || hit.date}${patch.time ? ' ' + patch.time : ''}`,
    };
  }

  // 3) 新建
  const d = extractDate(raw, todayDate);
  const t = extractTime(raw);
  const title = cleanTitle(raw, d, t);
  if (!title) return { reply: '未能识别事项名称，请补充说明。', ops: [], intent: 'none' };
  const domain = guessDomain(raw);
  const kind = guessKind(raw);
  const priority = /(重要|紧急|必须|一定|ddl|DDL|截止)/.test(raw) ? 3 : 2;
  const item = {
    title,
    date: d ? d.date : today,
    time: t ? t.time : '',
    domain,
    kind,
    priority,
  };
  return {
    intent: 'add',
    ops: [{ op: 'add', item }],
    reply: `已登记：${title}（${explainDate(item.date, today)}${item.time ? ' ' + item.time : ''}）。`,
  };
}

/* ──────────────────────────── LLM 解析（可选） ──────────────────────────── */

async function llmCommand(store, text, settings) {
  const { baseUrl, model, apiKey } = settings.llm || {};
  if (!apiKey) return null;
  const s = store.get();
  const today = isoDate();
  const compact = s.items
    .filter((x) => x.status !== 'done')
    .slice(0, 120)
    .map((x) => `${x.id}|${x.title}|${x.date}${x.time ? ' ' + x.time : ''}|${x.domain}|${x.status}`)
    .join('\n');
  const sys = [
    '你是一名专业、简洁的中文日程秘书，负责把用户口述的事项整理成日程操作。',
    '回复使用礼貌的书面语，称呼用户为「您」，先说明处理结果；不要寒暄，不要输出多余文字。',
    `今天是 ${today}。`,
    '可用领域: research(科研) duty(学工) study(课业) plan(长期)。kind: task deadline event quiz class idea。',
    '输出 JSON: {"reply":"给用户看的一句话","ops":[...]}',
    'op 可以是:',
    '{"op":"add","item":{"title":"","date":"YYYY-MM-DD","time":"HH:mm 或 空","domain":"","kind":"","priority":0-3,"notes":""}}',
    '{"op":"update","id":"现有id","patch":{"date":"","time":"","title":"","status":"todo|done","priority":2}}',
    '{"op":"delete","id":"现有id"}',
    '只解决用户明确要求的事，不要编造。',
    '现有未完成事项（id|标题|日期时间|领域|状态）:',
    compact,
  ].join('\n');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(`${(baseUrl || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: text },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonText = (content.match(/\{[\s\S]*\}/) || [])[0];
    if (!jsonText) throw new Error('LLM 返回无法解析');
    const parsed = JSON.parse(jsonText);
    return { reply: String(parsed.reply || '已完成解析'), ops: Array.isArray(parsed.ops) ? parsed.ops : [], intent: 'llm' };
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ──────────────────────────── HTTP server ──────────────────────────── */

function send(res, status, payload, headers = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Dayflow-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    ...headers,
  });
  res.end(body);
}
function ok(res, data) {
  send(res, 200, { ok: true, data });
}
function fail(res, status, error) {
  send(res, status, { ok: false, error });
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function applyOps(store, ops, actor = 'agent') {
  const results = [];
  for (const op of ops.slice(0, 50)) {
    const kind = String(op.op || op.type || '').toLowerCase();
    try {
      if (kind === 'add' || kind === 'create') {
        const it = store.addItem(Object.assign({}, op.item || op.data || {}, { source: 'agent', actor }));
        results.push({ op: kind, id: it.id, title: it.title });
      } else if (kind === 'update' || kind === 'patch') {
        const target = op.id ? store.updateItem(op.id, Object.assign({}, op.patch || op.data, { actor })) : null;
        results.push({ op: kind, id: op.id, ok: !!target });
      } else if (kind === 'done' || kind === 'complete') {
        const target = op.id ? store.setStatus(op.id, 'done', actor) : null;
        results.push({ op: kind, id: op.id, ok: !!target });
      } else if (kind === 'delete' || kind === 'remove') {
        results.push({ op: kind, id: op.id, ok: store.deleteItem(op.id, actor) });
      } else if (kind === 'track-update') {
        results.push({ op: kind, id: op.id, ok: !!store.updateTrack(op.id, Object.assign({}, op.patch, { actor })) });
      }
    } catch (err) {
      results.push({ op: kind, error: String(err.message || err) });
    }
  }
  return results;
}

function startApi({ store, appVersion = APP.version, onOpenCommand }) {
  const feed = [];
  const startedAt = Date.now();
  let server = null;
  let port = 0;

  const pushFeed = (entry) => {
    feed.unshift(entry);
    if (feed.length > 60) feed.length = 60;
  };

  const tokenOK = (req, url) => {
    const header = req.headers.authorization || '';
    const bearer = header.replace(/^Bearer\s+/i, '').trim();
    const alt = req.headers['x-dayflow-token'];
    const q = url.searchParams.get('token');
    const expected = store.get().settings.api.token;
    return [bearer, alt, q].filter(Boolean).some((v) => v === expected);
  };

  const handler = async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, `http://127.0.0.1:${port || 7788}`);
    const p = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return send(res, 204, '');

    const entry = { at: nowISO(), method: req.method, path: p, status: 200, ms: 0 };
    const done = () => {
      entry.ms = Date.now() - started;
      pushFeed(entry);
    };

    try {
      if (p === '/api/health' || p === '/health') {
        const s = store.get();
        entry.status = 200;
        done();
        return ok(res, {
          app: APP.name,
          cn: APP.cn,
          version: appVersion,
          uptime: Math.round((Date.now() - startedAt) / 1000),
          items: s.items.length,
          open: s.items.filter((x) => x.status !== 'done').length,
          time: nowISO(),
        });
      }

      if (p === '/api/docs' || p === '/' || p === '/docs') {
        entry.status = 200;
        done();
        return send(res, 200, docsHtml(port), { 'Content-Type': 'text/html; charset=utf-8' });
      }

      if (p === '/api/docs.json') {
        entry.status = 200;
        done();
        return ok(res, docsSpec());
      }

      if (!tokenOK(req, url)) {
        entry.status = 401;
        done();
        return fail(res, 401, 'unauthorized: 需要 Bearer token（见设置页 / api-token.txt）');
      }

      // ── state ──
      if (p === '/api/state' && req.method === 'GET') {
        const clone = JSON.parse(JSON.stringify(store.get()));
        if (clone.settings && clone.settings.llm && clone.settings.llm.apiKey) clone.settings.llm.apiKey = '***';
        entry.status = 200;
        done();
        return ok(res, clone);
      }
      if (p === '/api/briefing' && req.method === 'GET') {
        const data = store.briefing(url.searchParams.get('date') || isoDate());
        entry.status = 200;
        done();
        return ok(res, data);
      }
      if (p === '/api/feed' && req.method === 'GET') {
        entry.status = 200;
        done();
        return ok(res, feed);
      }
      if (p === '/api/log' && req.method === 'GET') {
        entry.status = 200;
        done();
        return ok(res, store.get().log.slice(0, 80));
      }

      // ── items ──
      if (p === '/api/items' && req.method === 'GET') {
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        const domain = url.searchParams.get('domain');
        const status = url.searchParams.get('status');
        const q = (url.searchParams.get('q') || '').toLowerCase();
        let list = store.get().items;
        if (from) list = list.filter((x) => (x.endDate || x.date) >= from);
        if (to) list = list.filter((x) => x.date <= to);
        if (domain) list = list.filter((x) => x.domain === domain);
        if (status) list = list.filter((x) => x.status === status);
        if (q) list = list.filter((x) => (x.title + x.notes).toLowerCase().includes(q));
        list = list.slice().sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
        entry.status = 200;
        done();
        return ok(res, list);
      }
      if (p === '/api/items' && req.method === 'POST') {
        const body = await readBody(req);
        const item = store.addItem(Object.assign({ actor: 'agent' }, body, { source: body.source || 'agent' }));
        entry.status = 201;
        done();
        return send(res, 201, { ok: true, data: item });
      }
      const mItem = /^\/api\/items\/([\w-]+)(?:\/(\w+))?$/.exec(p);
      if (mItem) {
        const id = mItem[1];
        const action = mItem[2];
        if (req.method === 'PATCH' || req.method === 'PUT') {
          const body = await readBody(req);
          const item = store.updateItem(id, Object.assign({}, body, { actor: 'agent' }));
          entry.status = item ? 200 : 404;
          done();
          return item ? ok(res, item) : fail(res, 404, 'not found');
        }
        if (req.method === 'DELETE') {
          const okDel = store.deleteItem(id, 'agent');
          entry.status = okDel ? 200 : 404;
          done();
          return okDel ? ok(res, { id }) : fail(res, 404, 'not found');
        }
        if (req.method === 'POST' && action === 'complete') {
          const item = store.setStatus(id, 'done', 'agent');
          entry.status = item ? 200 : 404;
          done();
          return item ? ok(res, item) : fail(res, 404, 'not found');
        }
        if (req.method === 'POST' && action === 'reopen') {
          const item = store.setStatus(id, 'todo', 'agent');
          entry.status = item ? 200 : 404;
          done();
          return item ? ok(res, item) : fail(res, 404, 'not found');
        }
      }

      // ── tracks ──
      if (p === '/api/tracks' && req.method === 'POST') {
        const body = await readBody(req);
        entry.status = 201;
        done();
        return send(res, 201, { ok: true, data: store.addTrack(Object.assign({}, body, { actor: 'agent' })) });
      }
      const mTrack = /^\/api\/tracks\/([\w-]+)$/.exec(p);
      if (mTrack && (req.method === 'PATCH' || req.method === 'PUT')) {
        const body = await readBody(req);
        const track = store.updateTrack(mTrack[1], Object.assign({}, body, { actor: 'agent' }));
        entry.status = track ? 200 : 404;
        done();
        return track ? ok(res, track) : fail(res, 404, 'not found');
      }

      // ── 自然语言指令 ──
      if (p === '/api/command' && req.method === 'POST') {
        const body = await readBody(req);
        const text = String(body.text || body.command || '');
        let result = null;
        if (!body.offline) result = await llmCommand(store, text, store.get().settings);
        const usedLlm = !!result;
        if (!result) result = parseCommand(store, text, { today: body.today });
        const results = applyOps(store, result.ops || [], body.actor || 'agent');
        store.log({ actor: body.actor || 'agent', action: 'command', detail: text.slice(0, 120) });
        entry.status = 200;
        done();
        return ok(res, Object.assign({}, result, { applied: results, engine: usedLlm ? 'llm' : 'local' }));
      }

      // ── settings / checkin ──
      if (p === '/api/settings' && req.method === 'PATCH') {
        const body = await readBody(req);
        const settings = store.updateSettings(body);
        entry.status = 200;
        done();
        return ok(res, settings);
      }
      if (p === '/api/checkin' && req.method === 'POST') {
        const body = await readBody(req);
        const value = store.toggleCheckin(String(body.routineId), body.date);
        entry.status = 200;
        done();
        return ok(res, { routineId: body.routineId, value });
      }

      if (p === '/api/bulk' && req.method === 'POST') {
        const body = await readBody(req);
        const results = applyOps(store, body.ops || [], body.actor || 'agent');
        entry.status = 200;
        done();
        return ok(res, results);
      }

      entry.status = 404;
      done();
      return fail(res, 404, 'no route');
    } catch (err) {
      entry.status = 500;
      entry.ms = Date.now() - started;
      pushFeed(entry);
      return fail(res, 500, String((err && err.message) || err));
    }
  };

  return new Promise((resolve) => {
    const tryListen = (candidate) => {
      server = http.createServer(handler);
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && candidate < 7805) {
          tryListen(candidate + 1);
        } else {
          resolve({ port: 0, error: String(err.message) });
        }
      });
      server.listen(candidate, '127.0.0.1', () => {
        port = candidate;
        if (store.get().settings.api.port !== candidate) {
          store.get().settings.api.port = candidate;
          store.save();
        }
        resolve({ port, server, feed, close: () => server.close() });
      });
    };
    tryListen(Number(store.get().settings.api.port) || 7788);
  });
}

/* ──────────────────────────── docs ──────────────────────────── */

function commandList() {
  return [
    ['GET', '/api/health', '健康检查（无需 token）'],
    ['GET', '/api/state', '全部状态：items / tracks / domains / settings / log'],
    ['GET', '/api/briefing', '结构化简报：逾期 / 今日 / 未来 7 天 + 文本摘要'],
    ['GET', '/api/items?from=&to=&domain=&status=&q=', '查询事项'],
    ['POST', '/api/items', '新建事项 {title,date,time,domain,kind,priority,notes,trackId}'],
    ['PATCH', '/api/items/:id', '修改事项（任意字段）'],
    ['DELETE', '/api/items/:id', '删除事项'],
    ['POST', '/api/items/:id/complete', '标记完成'],
    ['POST', '/api/items/:id/reopen', '重新打开'],
    ['POST', '/api/command', '自然语言：{text}，如「明天下午三点提醒我交月总结」'],
    ['POST', '/api/bulk', '批量操作 {ops:[{op:"add|update|delete",...}]}'],
    ['PATCH', '/api/settings', '修改设置（含 LLM 配置）'],
    ['POST', '/api/checkin', '每日习惯打卡 {routineId,date}'],
    ['GET', '/api/log', '操作日志'],
    ['GET', '/api/docs.json', '机器可读的接口清单'],
  ];
}

function docsSpec() {
  return {
    app: 'Dayflow',
    version: APP.version,
    auth: 'Authorization: Bearer <token>（token 见 ~/AppData/Roaming/dayflow/api-token.txt）',
    endpoints: commandList().map(([method, path, desc]) => ({ method, path, desc })),
  };
}

function docsHtml(port = 7788) {
  const rows = commandList()
    .map(
      ([m, p, d]) =>
        `<tr><td><span class="m ${m.toLowerCase()}">${m}</span></td><td><code>${p}</code></td><td>${d}</td></tr>`
    )
    .join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>日序 · Agent API</title>
<style>
body{font:14px/1.6 "Segoe UI Variable","Microsoft YaHei UI",sans-serif;background:#f6f6f9;color:#14151a;margin:0;padding:48px}
main{max-width:880px;margin:0 auto;background:#fff;border:1px solid rgba(20,21,26,.08);border-radius:20px;padding:36px 40px;box-shadow:0 24px 60px -30px rgba(20,21,26,.25)}
h1{font-size:24px;margin:0 0 6px} p{color:#6e7280}
code{font-family:"Cascadia Code",Consolas,monospace;font-size:12.5px;background:#f2f3f7;padding:2px 6px;border-radius:6px}
table{width:100%;border-collapse:collapse;margin-top:20px}
td{padding:10px 8px;border-bottom:1px solid rgba(20,21,26,.06);vertical-align:top}
.m{font-size:11px;font-weight:700;letter-spacing:.04em;padding:2px 7px;border-radius:5px;background:#eef2ff;color:#4361ee}
.m.post{background:#e9f8f4;color:#0f9d8a}.m.patch{background:#fff3ea;color:#e07a3f}.m.delete{background:#fdecec;color:#e5484d}
pre{background:#14151a;color:#e8e9ee;padding:16px 18px;border-radius:12px;overflow:auto;font-size:12.5px}
</style>
<main><h1>日序 · Agent API</h1>
<p>本机接口，仅在 127.0.0.1 监听。所有请求需携带 <code>Authorization: Bearer &lt;token&gt;</code>。</p>
<pre>curl -s http://127.0.0.1:${port}/api/briefing -H "Authorization: Bearer $env:DAYFLOW_TOKEN"</pre>
<table>${rows}</table>
</main></html>`;
}

module.exports = { startApi, parseCommand, applyOps, llmCommand };
