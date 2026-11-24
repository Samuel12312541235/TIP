'use strict';
/**
 * 调试用 CDP 客户端：连接 --remote-debugging-port=9222 的渲染进程，
 * 执行一段 JS（可选）并截图到 shots/<name>.png。
 *   node scripts/cdp.js shot today
 *   node scripts/cdp.js shot planner "document.querySelector('[data-view=planner]').click()"
 *   node scripts/cdp.js eval "JSON.stringify(App.state.settings)"
 */
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.CDP_PORT || 9222);

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || 'shot';
  const a = argv[1] || '';
  const b = argv[2] || '';
  const name = cmd === 'shot' ? a || 'shot' : 'shot';
  const js = cmd === 'eval' ? a : b;
  const delay = Number(argv[3] || 850);
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const match = process.env.CDP_URL || '';
  const page = list.find((t) => t.type === 'page' && (!match || t.url.includes(match))) || list.find((t) => t.type === 'page') || list[0];
  if (!page) throw new Error('no debuggable page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  const send = (method, params = {}) =>
    new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };

  if (js) {
    const val = await evalJs(js);
    if (cmd === 'eval') {
      console.log(typeof val === 'string' ? val : JSON.stringify(val));
      ws.close();
      return;
    }
    if (val !== undefined && val !== null) console.log('eval:', typeof val === 'string' ? val : JSON.stringify(val));
  }
  if (cmd === 'shot') {
    await new Promise((r) => setTimeout(r, delay));
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const dir = path.join(__dirname, '..', 'shots');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${name}.png`);
    fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    console.log('saved', file);
  }
  if (cmd === 'eval' && !js) {
    const val = await evalJs('JSON.stringify({view: App.ui.view, items: App.state.items.length})');
    console.log(val);
  }
  ws.close();
}

main().catch((err) => {
  console.error('CDP error:', err.message);
  process.exit(1);
});
