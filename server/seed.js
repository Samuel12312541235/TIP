'use strict';

/**
 * 日序 Dayflow · 干净初始数据
 * 不包含任何个人日程；首次启动时生成一份可直接替换的示例数据。
 */

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const today = new Date();
const monday = new Date(today);
monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 70);
const now = new Date().toISOString();

const DOMAINS = [
  { id: 'research', name: '科研', desc: '论文 · 会议 · 书评', color: '#4361EE', soft: '#EEF2FF' },
  { id: 'duty', name: '学工', desc: '组织 · 材料 · 活动', color: '#E07A3F', soft: '#FFF3EA' },
  { id: 'study', name: '课业', desc: '课程 · 测验 · 作业', color: '#0F9D8A', soft: '#E9F8F4' },
  { id: 'plan', name: '长期', desc: '规划 · 大论文', color: '#8B5CF6', soft: '#F3EEFF' },
];

const COURSES = [
  { id: 'c_demo', name: '示例课程', short: '示例课程', color: '#0F9D8A', note: '可替换成你的课程' },
  { id: 'c_seminar', name: '研讨课', short: '研讨课', color: '#2563EB', note: '每周阅读与讨论' },
];

const TRACKS = [
  {
    id: 'trk_demo',
    title: '长期项目示例',
    domain: 'plan',
    due: iso(addDays(60)),
    desc: '把一个大目标拆成两段，按周推进；可以改成你的论文、项目或考试计划。',
    parts: [
      { id: 'p1', title: '资料与框架', progress: 20, note: '先收集资料，再搭结构' },
      { id: 'p2', title: '初稿与修订', progress: 0, note: '完成初稿后留出修订时间' },
    ],
  },
];

const ROUTINES = [
  { id: 'read', label: '阅读 30 分钟', hint: '专业书或论文' },
  { id: 'move', label: '运动 20 分钟', hint: '散步、拉伸或跑步' },
  { id: 'review', label: '当日复盘 · 写 3 行', hint: '完成 / 卡点 / 明日' },
];

function it(id, o) {
  const base = {
    id,
    domain: 'research',
    kind: 'task',
    priority: 2,
    status: 'todo',
    notes: '',
    time: '',
    endDate: '',
    course: '',
    trackId: '',
    subtasks: [],
    source: 'seed',
    createdAt: now,
    updatedAt: now,
    completedAt: '',
  };
  const merged = Object.assign(base, o);
  if (!o.domain && merged.course) merged.domain = 'study';
  return merged;
}

const ITEMS = [
  it('it_welcome', {
    title: '完成本周最重要的一件事',
    date: iso(today),
    time: '10:00',
    priority: 3,
    notes: '这是一条示例，可直接修改或删除。',
  }),
  it('it_inbox', { title: '整理收件箱与待办', date: iso(today), domain: 'duty' }),
  it('it_read', {
    title: '阅读 30 分钟',
    date: iso(addDays(1)),
    time: '20:00',
    domain: 'study',
    course: 'c_demo',
  }),
  it('it_review', {
    title: '复盘本周进展',
    date: iso(addDays(2)),
    domain: 'plan',
    trackId: 'trk_demo',
  }),
  it('it_plan', { title: '安排下周计划', date: iso(addDays(7)), domain: 'duty' }),
  it('it_done', {
    title: '示例事项 · 已完成',
    date: iso(addDays(-1)),
    status: 'done',
    completedAt: `${iso(addDays(-1))}T18:00:00+08:00`,
  }),
];

function buildSeed() {
  return {
    version: 1,
    createdAt: now,
    profile: { name: '我的日程' },
    settings: {
      theme: 'light',
      senior: false,
      motion: 'auto',
      autostart: false,
      autoAdapt: true,
      reduceTransparency: false,
      notify: true,
      health: true,
      api: { port: 7788, token: '' },
      llm: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', apiKey: '' },
      semesterFirstMonday: iso(monday),
      weekStart: 1,
      focusTitle: '把今天最重要的一件事做完',
      routines: ROUTINES,
    },
    domains: DOMAINS,
    courses: COURSES,
    tracks: TRACKS,
    items: ITEMS,
    checkins: {},
    log: [],
    meta: {
      lastOpen: now,
      completedDates: {},
      notified: {},
    },
  };
}

module.exports = { buildSeed, DOMAINS, COURSES, TRACKS, ITEMS, ROUTINES };
