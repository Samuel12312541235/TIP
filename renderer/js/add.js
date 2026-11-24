/* 日序 · 日程登记：大字提问 + 一句话输入 */
(function () {
  'use strict';

  const qs = (s) => document.querySelector(s);
  const qsa = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pad = (n) => String(n).padStart(2, '0');
  const parseISO = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
  };
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (s, n) => {
    const d = parseISO(s);
    d.setDate(d.getDate() + n);
    return isoDate(d);
  };
  const startOfWeek = (s) => {
    const d = parseISO(s);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return isoDate(d);
  };
  const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const md = (s) => `${parseISO(s).getMonth() + 1} 月 ${parseISO(s).getDate()} 日`;
  const weekday = (s) => WEEK[parseISO(s).getDay()];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const S = {
    step: 'start',
    title: '',
    date: '',
    time: '',
    domain: 'research',
    priority: 2,
    kind: '',
    domains: [],
    today: '',
    preset: '',
  };
  let busy = false;

  const app = qs('#app');
  const thread = qs('#thread');
  const answers = qs('#answers');
  const input = qs('#input');
  const sendBtn = qs('#btnSend');

  const DOMAIN_DESC = {
    research: '论文 · 实验 · 会议',
    duty: '值班 · 材料 · 活动',
    study: '课程 · 作业 · 考试',
    long: '长期目标 · 主线',
  };

  /* ── 工具 ─────────────────────────────────────────── */
  function whenLabel() {
    const d = S.date || S.today;
    let day;
    if (d === S.today) day = '今天';
    else if (d === addDays(S.today, 1)) day = '明天';
    else if (d === addDays(S.today, 2)) day = '后天';
    else day = `${md(d)} ${weekday(d)}`;
    return S.time ? `${day} ${S.time}` : `${day} · 全天`;
  }

  function domainObj(id) {
    return S.domains.find((d) => d.id === id) || S.domains[0] || { id: 'research', name: '科研', color: '#4361ee' };
  }

  function scrollDown() {
    requestAnimationFrame(() => thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' }));
  }

  function setStep(n) {
    qsa('.step').forEach((s, i) => {
      s.classList.toggle('done', i < n);
      s.classList.toggle('active', i === n);
    });
  }

  function setBusy(v) {
    busy = v;
    sendBtn.disabled = v;
  }

  function focusInput() {
    setTimeout(() => input.focus(), 40);
  }

  function resizeInput() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(104, input.scrollHeight)}px`;
  }

  function clearInput() {
    input.value = '';
    resizeInput();
  }

  function startChat() {
    app.classList.add('chatting');
    scrollDown();
  }

  /* ── 消息 ─────────────────────────────────────────── */
  const AVATAR = `<span class="av"><svg viewBox="0 0 24 24" fill="none"><path d="M5 16a7 7 0 0 1 14 0" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="17.4" cy="16" r="1.7" fill="#fff"/><path d="M5.5 19.5h13" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".45"/></svg></span>`;

  function meSay(text) {
    const node = el(`<div class="msg me"><div class="say">${esc(text)}</div></div>`);
    thread.appendChild(node);
    scrollDown();
  }

  async function aiSay(html, opts = {}) {
    const node = el(`<div class="msg ai">${AVATAR}<div class="say"><span class="typing"><i></i><i></i><i></i></span></div></div>`);
    thread.appendChild(node);
    scrollDown();
    await sleep(opts.typing || 420);
    node.querySelector('.say').innerHTML = html;
    scrollDown();
    await sleep(90);
    return node;
  }

  /* ── 选项 ─────────────────────────────────────────── */
  function options(items, onPick, opts = {}) {
    qsa('.opts').forEach((o) => o.classList.add('spent'));
    const box = el(`<div class="opts"></div>`);
    items.forEach((it, i) => {
      const btn = el(`<button class="opt" style="--i:${i}">
        <b>${it.color ? `<span class="dot" style="background:${it.color}"></span>` : ''}${esc(it.label)}</b>
        ${it.sub ? `<span>${esc(it.sub)}</span>` : ''}
      </button>`);
      btn.addEventListener('click', () => {
        if (busy || box.classList.contains('spent')) return;
        onPick(it);
      });
      box.appendChild(btn);
    });
    thread.appendChild(box);
    scrollDown();
    return box;
  }

  function setPlaceholder(t) {
    input.placeholder = t;
  }

  /* ── 问题 ─────────────────────────────────────────── */
  async function askWhen() {
    S.step = 'when';
    setStep(1);
    setBusy(true);
    const ws = startOfWeek(S.today);
    await aiSay('请问安排在哪一天？也可以直接说明具体日期与时间。');
    options(
      [
        { label: '今天', sub: `${md(S.today)} ${weekday(S.today)}`, date: S.today },
        { label: '明天', sub: `${md(addDays(S.today, 1))} ${weekday(addDays(S.today, 1))}`, date: addDays(S.today, 1) },
        { label: '后天', sub: `${md(addDays(S.today, 2))} ${weekday(addDays(S.today, 2))}`, date: addDays(S.today, 2) },
        { label: '本周六', sub: `${md(addDays(ws, 5))} ${weekday(addDays(ws, 5))}`, date: addDays(ws, 5) },
        { label: '下周一', sub: `${md(addDays(ws, 7))} ${weekday(addDays(ws, 7))}`, date: addDays(ws, 7) },
        { label: '暂不设定', sub: '先登记，随后补充', date: S.today, noTime: true },
      ],
      async (it) => {
        meSay(it.label);
        S.date = it.date;
        S.time = '';
        if (it.noTime) await askDomain();
        else await askClock();
      }
    );
    setBusy(false);
    setPlaceholder('例如：明天下午三点 / 11 月 30 日 / 周五');
    focusInput();
  }

  async function askClock() {
    S.step = 'clock';
    setStep(1);
    setBusy(true);
    await aiSay(`<b>${whenLabel().replace(' · 全天', '')}</b>，请问具体时间是？`);
    options(
      [
        { label: '09:00', sub: '上午', time: '09:00' },
        { label: '14:00', sub: '下午', time: '14:00' },
        { label: '20:00', sub: '晚上', time: '20:00' },
        { label: '全天', sub: '不设具体时间', time: '' },
      ],
      async (it) => {
        meSay(it.label);
        S.time = it.time;
        await askDomain();
      }
    );
    setBusy(false);
    setPlaceholder('例如：下午三点 / 15:00 / 全天');
    focusInput();
  }

  async function askDomain(hintId) {
    S.step = 'domain';
    setStep(2);
    setBusy(true);
    const guess = hintId && S.domains.find((d) => d.id === hintId);
    await aiSay(guess ? `建议归入 <b>${esc(guess.name)}</b>，如不合适请选择其他类别。` : '请选择事项类别。');
    options(
      S.domains.map((d) => ({
        label: d.name,
        sub: DOMAIN_DESC[d.id] || '归入此类',
        color: d.color,
        id: d.id,
        hint: hintId && d.id === hintId,
      })),
      async (it) => {
        meSay(it.label);
        S.domain = it.id;
        qsa('.opt.hint').forEach((o) => o.classList.remove('hint'));
        await goConfirm();
      }
    );
    setBusy(false);
    setPlaceholder('例如：科研 / 学工 / 课业 / 长期');
    focusInput();
  }

  /* ── 确认 ─────────────────────────────────────────── */
  async function goConfirm() {
    S.step = 'confirm';
    setStep(3);
    setBusy(true);
    await aiSay('请确认以下安排。');
    const d = domainObj(S.domain);
    const card = el(`<div class="summary" style="--c:${d.color}">
      <div class="kicker">${S.priority === 3 ? '<span class="sum-key">★ 重点</span>' : '待登记'}</div>
      <div class="s-title">${esc(S.title)}</div>
      <div class="s-meta"><span class="dot" style="background:${d.color}"></span><span>${esc(d.name)}</span><span>·</span><span>${whenLabel()}</span></div>
      <div class="s-actions">
        <button class="btn primary" id="doAdd">确认登记</button>
        <button class="flag" id="flag"><span>★</span>设为重点</button>
        <button class="btn ghost" id="doWhen">调整时间</button>
        <span class="spacer"></span>
        <button class="btn ghost" id="doCancel">取消登记</button>
      </div>
    </div>`);
    thread.appendChild(card);
    scrollDown();
    setBusy(false);
    setPlaceholder('按 Enter 确认登记');

    const flag = card.querySelector('#flag');
    if (S.priority === 3) flag.classList.add('on');
    flag.addEventListener('click', () => {
      S.priority = S.priority === 3 ? 2 : 3;
      flag.classList.toggle('on', S.priority === 3);
    });

    card.querySelector('#doWhen').addEventListener('click', async () => {
      if (busy) return;
      card.remove();
      await askWhen();
    });
    card.querySelector('#doCancel').addEventListener('click', () => window.dayflow.addClose());

    card.querySelector('#doAdd').addEventListener('click', async function () {
      if (busy) return;
      setBusy(true);
      this.disabled = true;
      this.classList.add('done');
      this.textContent = '已登记 ✓';
      try {
        await window.dayflow.addSave({
          title: S.title,
          date: S.date || S.today,
          time: S.time || '',
          domain: S.domain,
          priority: S.priority,
          kind: S.kind || guessKind(S.title),
        });
        await reset({ afterAdd: true });
      } catch (_) {
        this.disabled = false;
        this.classList.remove('done');
        this.textContent = '确认登记';
        setBusy(false);
      }
    });
  }

  function guessKind(title) {
    if (/会议|活动|讲座|比赛|大赛|答辩/.test(title)) return 'event';
    if (/quiz|测验|小测/i.test(title)) return 'quiz';
    if (/截止|ddl|提交|交$/.test(title)) return 'deadline';
    return 'task';
  }

  /* ── 首句 ─────────────────────────────────────────── */
  async function firstSay(text) {
    startChat();
    meSay(text);
    setBusy(true);
    clearInput();

    let item = null;
    try {
      const res = await window.dayflow.parse(text);
      const op = (res.ops || []).find((o) => o.op === 'add');
      item = op && op.item;
    } catch (_) {}

    const hasDate = /今天|明天|后天|大后天|周[一二三四五六日天]|星期|下周|本周|这周|下个?月|\d{1,2}\s*月|\d{1,2}\s*[日号]|\d{1,2}[:：]\d{1,2}|上午|下午|晚上|早上|中午|今晚|明早/.test(text);
    if (item && item.date && (hasDate || item.time)) {
      S.title = (item.title || text).replace(/^(重要|紧急|重点|急)[:：\s]*/, '').slice(0, 120);
      S.kind = item.kind || '';
      S.priority = item.priority === 3 ? 3 : 2;
      S.date = item.date;
      S.time = item.time || '';
      if (S.time) {
        await aiSay(`已记录：<b>${whenLabel()}</b>「${esc(S.title)}」。`);
        setBusy(false);
        await askDomain(item.domain);
      } else {
        await aiSay(`已记录事项「${esc(S.title)}」。`);
        setBusy(false);
        await askClock();
      }
      return;
    }

    S.title = text.slice(0, 120);
    await aiSay(`已记录事项「${esc(S.title)}」。`);
    setBusy(false);
    await askWhen();
  }

  /* ── 输入提交 ─────────────────────────────────────── */
  async function submit() {
    if (S.step === 'confirm') {
      const btn = qs('#doAdd');
      if (btn && !btn.disabled) btn.click();
      return;
    }
    const text = input.value.trim();
    if (!text || busy) return;
    if (S.step === 'start') {
      if (S.preset) {
        startChat();
        meSay(text);
        clearInput();
        S.title = text.slice(0, 120);
        await askClock();
        return;
      }
      await firstSay(text);
      return;
    }
    if (S.step === 'when') {
      const item = await parseText(text);
      const hasDate = /今天|明天|后天|大后天|周[一二三四五六日天]|星期|下周|本周|这周|下个?月|\d{1,2}\s*月|\d{1,2}\s*[日号]|\d{1,2}[:：]\d{1,2}|上午|下午|晚上|早上|中午|今晚|明早/.test(text);
    if (item && item.date && (hasDate || item.time)) {
        meSay(text);
        clearInput();
        S.date = item.date;
        S.time = item.time || '';
        if (S.time) await askDomain();
        else await askClock();
      } else {
        await aiSay('未能识别日期，请使用「明天」「下周一」或「11 月 30 日」等表达。');
      }
      return;
    }
    if (S.step === 'clock') {
      const item = await parseText(text);
      const m = /(\d{1,2})[:：](\d{1,2})/.exec(text);
      let time = (item && item.time) || '';
      if (!time && m) time = `${pad(Number(m[1]))}:${pad(Number(m[2]))}`;
      if (/全天|不确定|没时间/.test(text)) time = '';
      if (time || /全天|不确定|没时间/.test(text)) {
        meSay(text);
        clearInput();
        S.time = time;
        await askDomain();
      } else {
        await aiSay('未能识别时间，请选择上方选项或输入具体时间。');
      }
      return;
    }
    if (S.step === 'domain') {
      const hit = S.domains.find((d) => text.includes(d.name) || (d.id === 'research' && /科研/.test(text)));
      if (hit) {
        meSay(text);
        clearInput();
        S.domain = hit.id;
        await goConfirm();
      } else {
        await aiSay('请选择上方类别，或输入「科研」「学工」「课业」「长期」。');
      }
    }
  }

  async function parseText(text) {
    try {
      const res = await window.dayflow.parse(text);
      return ((res.ops || []).find((o) => o.op === 'add') || {}).item || null;
    } catch (_) {
      return null;
    }
  }

  /* ── 启动 / 重置 ──────────────────────────────────── */
  async function reset(payload = {}) {
    if (payload.mode === 'form') {
      showForm(payload);
      return;
    }
    document.body.classList.remove('form-mode');
    thread.innerHTML = '';
    answers.innerHTML = '';
    clearInput();
    setBusy(false);
    app.classList.remove('chatting');
    const heroSub = qs('#hero p');
    if (heroSub) {
      heroSub.textContent = payload.afterAdd ? '已为您登记上一项。请继续告知下一项。' : '请口述或输入事项，我来整理日期、时间与类别。';
    }
    qsa('.step').forEach((s) => s.classList.remove('done', 'active'));

    S.title = '';
    S.kind = '';
    S.date = payload.date || '';
    S.time = '';
    S.domain = 'research';
    S.priority = 2;
    S.step = 'start';
    S.preset = payload.date || '';

    qsa('.example').forEach((n) => n.remove());
    const examples = [
      '明天下午三点提交月工作总结',
      '周六上午完成省赛问答准备',
      '下周一前提交导师所需提纲',
    ];
    examples.forEach((t, i) => {
      const b = el(`<button class="example" style="--i:${i}">${t}</button>`);
      b.addEventListener('click', () => {
        if (busy) return;
        input.value = t;
        submit();
      });
      qs('#examples').appendChild(b);
    });

    input.placeholder = '例如：明天下午三点提交月工作总结';
    if (payload.date) {
      startChat();
      await aiSay(`已选择日期：<b>${md(payload.date)} ${weekday(payload.date)}</b>。请问事项名称是什么？`, { typing: 200 });
      setStep(0);
      input.placeholder = '请输入事项名称';
    } else {
      setStep(0);
    }
    focusInput();
    resizeInput();
  }

  let listening = false;
  async function voiceInput() {
    if (listening || busy) return;
    const btn = qs('#btnMic');
    listening = true;
    btn.classList.add('listening');
    const prev = input.placeholder;
    input.placeholder = '正在聆听…';
    try {
      const res = await window.Voice.listen();
      if (res && res.text) {
        input.value = res.text;
        resizeInput();
        input.focus();
      } else {
        input.placeholder = res && res.error ? '语音识别不可用' : '未识别到语音';
        setTimeout(() => {
          input.placeholder = prev;
        }, 1700);
      }
    } catch (_) {
      input.placeholder = '语音识别不可用';
      setTimeout(() => {
        input.placeholder = prev;
      }, 1700);
    } finally {
      listening = false;
      btn.classList.remove('listening');
      if (input.placeholder === '正在聆听…') input.placeholder = prev;
    }
  }

  /* ── 传统表单登记 ─────────────────────────────────── */
  let formReady = false;

  function setFormStatus(text, err = false) {
    const node = qs('#fStatus');
    if (!node) return;
    node.textContent = text || '';
    node.classList.toggle('err', !!err);
  }

  function initForm() {
    if (formReady) return;
    formReady = true;
    qs('#itemForm').addEventListener('submit', saveForm);
    qs('#fReset').addEventListener('click', () => {
      qs('#fTitle').value = '';
      qs('#fTime').value = '';
      qs('#fNotes').value = '';
      setFormStatus('');
      qs('#fTitle').focus();
    });
    ['fTitle', 'fDate', 'fTime', 'fNotes'].forEach((id) => {
      qs(`#${id}`).addEventListener('input', () => setFormStatus(''));
    });
    ['fDomain', 'fPriority'].forEach((id) => {
      qs(`#${id}`).addEventListener('change', () => setFormStatus(''));
    });
    qs('#btnFormBack').addEventListener('click', hideForm);
  }

  function showForm(payload = {}) {
    initForm();
    const sel = qs('#fDomain');
    sel.innerHTML = (S.domains.length ? S.domains : [{ id: 'research', name: '科研' }])
      .map((d) => `<option value="${d.id}">${esc(d.name)}</option>`)
      .join('');
    document.body.classList.add('form-mode');
    qs('#fDate').value = payload.date || S.date || S.today;
    qs('#fTime').value = '';
    qs('#fTitle').value = '';
    qs('#fNotes').value = '';
    qs('#fPriority').value = '2';
    setFormStatus('');
    setTimeout(() => qs('#fTitle').focus(), 40);
  }

  function hideForm() {
    document.body.classList.remove('form-mode');
    setFormStatus('');
    setTimeout(() => input.focus(), 30);
  }

  async function saveForm(e) {
    e.preventDefault();
    const title = qs('#fTitle').value.trim();
    if (!title) {
      setFormStatus('请填写事项名称。', true);
      qs('#fTitle').focus();
      return;
    }
    const date = qs('#fDate').value || S.today;
    const time = qs('#fTime').value || '';
    const domain = qs('#fDomain').value || 'research';
    const priority = Number(qs('#fPriority').value) || 2;
    const notes = qs('#fNotes').value.trim();
    const btn = qs('#fSave');
    btn.disabled = true;
    setFormStatus('正在登记…');
    try {
      await window.dayflow.addSave({ title, date, time, domain, priority, notes, kind: guessKind(title) });
      qs('#fTitle').value = '';
      qs('#fTime').value = '';
      qs('#fNotes').value = '';
      setFormStatus('已登记，可继续填写下一项。');
      qs('#fTitle').focus();
    } catch (_) {
      setFormStatus('登记未成功，请重试。', true);
    } finally {
      btn.disabled = false;
    }
  }

  function bind() {
    qs('#brand').innerHTML = `<svg viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7A6BFF"/><stop offset="1" stop-color="#3B49D8"/></linearGradient></defs><rect x="1.5" y="1.5" width="29" height="29" rx="9" fill="url(#g)"/><path d="M8 20.4h16" stroke="#fff" stroke-width="1.9" stroke-linecap="round" opacity=".42"/><path d="M8.8 20.2a7.2 7.2 0 0 1 14.4 0" stroke="#fff" stroke-width="2.1" stroke-linecap="round" fill="none"/><circle cx="23.2" cy="20.2" r="1.6" fill="#fff"/></svg>`;
    qs('#btnClose').addEventListener('click', () => window.dayflow.addClose());
    qs('#btnMic').addEventListener('click', voiceInput);
    qs('#btnForm').addEventListener('click', () => showForm({ date: qs('#fDate').value || S.date }));
    sendBtn.addEventListener('click', submit);
    input.addEventListener('input', resizeInput);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') window.dayflow.addClose();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !document.body.classList.contains('form-mode')) submit();
    });
    thread.addEventListener('click', (e) => {
      if (e.target.closest('.opt')) return;
      input.focus();
    });
  }

  async function boot() {
    if (!window.dayflow) {
      document.body.innerHTML = '<div style="padding:30px;font:14px sans-serif">请通过日序启动。</div>';
      return;
    }
    bind();
    const ctx = await window.dayflow.addContext();
    document.documentElement.classList.toggle('senior', !!ctx.senior);
    S.domains = ctx.domains || [];
    S.today = ctx.today;
    S.date = S.today;
    const q = new URLSearchParams(location.search);
    await reset({ date: q.get('date') || '', mode: q.get('mode') || '' });
    window.dayflow.onAddReset((payload) => reset(payload || {}));
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
