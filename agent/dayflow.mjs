#!/usr/bin/env node
/**
 * 日序 Dayflow · Agent 命令行
 *
 * 直接操作本机运行中的日序实例（HTTP API），供 AI Agent 或用户在终端使用。
 *
 *   node agent/dayflow.mjs briefing
 *   node agent/dayflow.mjs list --from 2026-11-23 --to 2026-11-30
 *   node agent/dayflow.mjs add "整理西电会议摘要" --date 2026-11-29 --time 10:00 --domain research
 *   node agent/dayflow.mjs done it_abc123
 *   node agent/dayflow.mjs command "明天下午三点提醒我交月总结"
 *   node agent/dayflow.mjs move it_abc123 --date 2026-12-01 --time 09:00
 *
 * 连接信息来自 agent/connection.json（应用启动时写入），
 * 或 data/api-token.txt + 默认端口 7788。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
function resolveConnection() {
  const candidates = [path.join(__dirname, 'connection.json'), path.join(ROOT, 'data', 'connection.json')];
  for (const file of candidates) {
    try {
      const info = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (info.baseUrl && info.token) return info;
    } catch (_) {}
  }
  const tokenFile = path.join(ROOT, 'data', 'api-token.txt');
  let token = '';
  try {
    token = fs.readFileSync(tokenFile, 'utf8').trim();
  } catch (_) {}
  return { baseUrl: 'http://127.0.0.1:7788', token };
}

function parseArgs(argv) {
  const args = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      args.push(a);
    }
  }
  return { args, flags };
}

async function call(conn, method, endpoint, body) {
  if (!conn.token) throw new Error('找不到 token：请先启动日序，或检查 data/api-token.txt');
  const res = await fetch(`${conn.baseUrl}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${conn.token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {}
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || `${res.status} ${text.slice(0, 200)}`);
  }
  return data ? data.data : text;
}

function show(value) {
  if (typeof value === 'string') return console.log(value);
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  const cmd = args[0] || 'briefing';
  const conn = resolveConnection();

  switch (cmd) {
    case 'health':
      show(await call(conn, 'GET', '/api/health'));
      break;
    case 'briefing': {
      const data = await call(conn, 'GET', '/api/briefing');
      if (flags.json) show(data);
      else console.log(data.text);
      break;
    }
    case 'state':
      show(await call(conn, 'GET', '/api/state'));
      break;
    case 'list': {
      const qs = new URLSearchParams();
      ['from', 'to', 'domain', 'status', 'q'].forEach((k) => flags[k] && qs.set(k, flags[k]));
      const rows = await call(conn, 'GET', `/api/items?${qs.toString()}`);
      rows.forEach((r) =>
        console.log(
          `${r.id}  ${r.date}${r.time ? ' ' + r.time : '    '}  [${r.status === 'done' ? 'x' : ' '}] ${r.title}  (${r.domain})`
        )
      );
      console.log(`共 ${rows.length} 项`);
      break;
    }
    case 'add': {
      const title = args.slice(1).join(' ');
      if (!title) throw new Error('用法：add "标题" --date 2026-11-30 [--time 18:00] [--domain research] [--kind deadline] [--priority 3]');
      const item = await call(conn, 'POST', '/api/items', {
        title,
        date: flags.date || new Date().toISOString().slice(0, 10),
        time: flags.time || '',
        domain: flags.domain || 'research',
        kind: flags.kind || 'task',
        priority: flags.priority !== undefined ? Number(flags.priority) : 2,
        notes: flags.notes || '',
        trackId: flags.track || '',
        source: 'agent',
      });
      console.log(`已创建：${item.id}  ${item.date}${item.time ? ' ' + item.time : ''}  ${item.title}`);
      break;
    }
    case 'done': {
      const id = args[1] || flags.id;
      if (!id) throw new Error('用法：done <item-id>');
      const item = await call(conn, 'POST', `/api/items/${id}/complete`);
      console.log(`已完成：${item.title}`);
      break;
    }
    case 'reopen': {
      const item = await call(conn, 'POST', `/api/items/${args[1]}/reopen`);
      console.log(`已重新打开：${item.title}`);
      break;
    }
    case 'update':
    case 'move': {
      const id = args[1] || flags.id;
      if (!id) throw new Error('用法：move <item-id> --date 2026-12-01 [--time 09:00]');
      const patch = {};
      ['date', 'time', 'title', 'notes', 'status', 'priority', 'domain', 'kind'].forEach((k) => {
        if (flags[k] !== undefined) patch[k] = k === 'priority' ? Number(flags[k]) : flags[k];
      });
      const item = await call(conn, 'PATCH', `/api/items/${id}`, patch);
      console.log(`已更新：${item.title} → ${item.date}${item.time ? ' ' + item.time : ''}`);
      break;
    }
    case 'delete': {
      await call(conn, 'DELETE', `/api/items/${args[1]}`);
      console.log('已删除');
      break;
    }
    case 'command': {
      const text = args.slice(1).join(' ');
      const result = await call(conn, 'POST', '/api/command', { text });
      console.log(result.reply);
      if (result.applied && result.applied.length) console.log('操作：' + JSON.stringify(result.applied));
      break;
    }
    case 'raw': {
      const method = (flags.method || 'GET').toUpperCase();
      const endpoint = args[1];
      const body = flags.body ? JSON.parse(flags.body) : undefined;
      show(await call(conn, method, endpoint, body));
      break;
    }
    default:
      throw new Error(`未知命令：${cmd}`);
  }
}

main().catch((err) => {
  console.error('dayflow:', err.message);
  process.exit(1);
});
