/* 语音输入：优先用 Chromium 的 SpeechRecognition，失败时回退到 Windows 本地识别 */
(function () {
  'use strict';

  function webRecognize(timeoutMs) {
    return new Promise((resolve) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        resolve({ error: 'unsupported' });
        return;
      }
      let rec;
      try {
        rec = new SR();
      } catch (_) {
        resolve({ error: 'unsupported' });
        return;
      }
      rec.lang = 'zh-CN';
      rec.interimResults = false;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      let done = false;
      const finish = (payload) => {
        if (done) return;
        done = true;
        try {
          rec.abort();
        } catch (_) {}
        resolve(payload);
      };
      const timer = setTimeout(() => finish({ error: 'timeout' }), timeoutMs || 9000);
      rec.onresult = (e) => {
        let text = '';
        for (let i = 0; i < e.results.length; i += 1) {
          if (e.results[i] && e.results[i][0]) text += e.results[i][0].transcript || '';
        }
        clearTimeout(timer);
        finish({ text: text.trim() });
      };
      rec.onerror = (e) => {
        clearTimeout(timer);
        finish({ error: (e && e.error) || 'error' });
      };
      rec.onend = () => {
        setTimeout(() => finish({ error: 'no-speech' }), 80);
      };
      try {
        rec.start();
      } catch (_) {
        clearTimeout(timer);
        finish({ error: 'start' });
      }
    });
  }

  async function listen() {
    const first = await webRecognize();
    if (first.text) return first;
    if (first.error === 'no-speech' || first.error === 'timeout') return first;
    try {
      const local = await window.dayflow.voiceListen();
      if (local && local.text) return { text: local.text };
      return { error: 'unavailable' };
    } catch (_) {
      return { error: 'unavailable' };
    }
  }

  window.Voice = { listen };
})();
