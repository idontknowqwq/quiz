/* ============================================================
   loader.js  —  B1/B2/B3：題庫轉換器（抽取 + 扁平化 + 快取）
   ------------------------------------------------------------
   流程：fetch 來源 HTML → 依 varName 定位題目陣列 → 字串/註解感知的
   括號掃描取出陣列字面值 → eval 成物件 → 扁平化為平台 wire 格式 → 快取。
   不重新轉錄任何一題，answer 索引原樣沿用（避免 G3 位移錯誤）。

   ⚠ 部署備註：fetch 需同源。請以靜態伺服器開啟（例如
     python -m http.server）或部署到網站；直接用 file:// 開啟會被
     瀏覽器 CORS 擋下。
   ============================================================ */
(function (global) {
  const cache = new Map();

  /* 取出 `varName = [ ... ]` 的陣列字面值（跳過字串與註解中的括號） */
  function extractArrayLiteral(src, varName) {
    const declRe = new RegExp('(?:const|let|var)\\s+' + varName + '\\s*=\\s*\\[');
    const m = declRe.exec(src);
    if (!m) throw new Error('找不到變數 ' + varName);
    let i = m.index + m[0].length - 1;      // 指到開頭的 '['
    const start = i;
    let depth = 0, str = null, esc = false;
    for (; i < src.length; i++) {
      const ch = src[i], nx = src[i + 1];
      if (str) {                             // 字串內：只處理跳脫與結束
        if (esc) { esc = false; }
        else if (ch === '\\') { esc = true; }
        else if (ch === str) { str = null; }
        continue;
      }
      if (ch === '/' && nx === '/') { i = src.indexOf('\n', i); if (i < 0) i = src.length; continue; }
      if (ch === '/' && nx === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
      if (ch === '[') depth++;
      else if (ch === ']') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    }
    throw new Error('陣列括號未正常閉合：' + varName);
  }

  /* 將巢狀雙語題目扁平化成平台 wire 格式（B2 欄位對映） */
  function flattenItem(it, idx, warns) {
    const zh = it.zh || {}, en = it.en || null;
    if (!en) warns.push('Q' + (idx + 1) + '：缺英文，已以中文遞補');
    const E = en || zh;
    const out = {
      q:  E.question,                    qz: zh.question || E.question,
      o:  E.options || zh.options,       oz: zh.options || E.options,
      a:  it.answer,                                       // 索引原樣沿用
      exp: (E.explanation) || '',        expz: zh.explanation || (E.explanation) || '',
      pd: it.difficulty || '',           pts: it.points || 0
    };
    // 防禦性檢查（支援 G3 驗證）
    if (typeof out.a !== 'number' || out.a < 0 || !out.oz || out.a >= out.oz.length)
      warns.push('Q' + (idx + 1) + '：answer 索引異常（' + out.a + '）');
    return out;
  }

  /* 解析 + 扁平化；回傳 { questions, warnings } */
  function normalize(literal) {
    let raw;
    try { raw = (new Function('return ' + literal + ';'))(); }
    catch (e) { throw new Error('題目陣列解析失敗：' + e.message); }
    if (!Array.isArray(raw)) throw new Error('解析結果不是陣列');
    const warns = [];
    const questions = raw.map((it, i) => flattenItem(it, i, warns));
    return { questions, warnings: warns };
  }

  /* 統一檔名：優先讀 <id>.html（更名後的標準檔名），讀不到再退回登記表的原始檔名。
     如此在「更名前」與「更名後」都能正常載入。 */
  async function fetchSource(meta) {
    // 題庫 html 已整理至 quizzes/ 子資料夾；保留根目錄與 meta.src 作為後備，移動位置都能載入
    const tries = ['quizzes/' + meta.id + '.html', meta.id + '.html', meta.src].filter((v, i, a) => v && a.indexOf(v) === i);
    let lastErr = '';
    for (const f of tries) {
      try {
        const r = await fetch(encodeURI(f));   // 中文/特殊字元檔名需編碼
        if (r.ok) return await r.text();
        lastErr = 'HTTP ' + r.status + ' @ ' + f;
      } catch (e) { lastErr = (e.message || e) + ' @ ' + f; }
    }
    throw new Error('讀取來源失敗（' + meta.id + '）：' + lastErr);
  }

  /* 對外：載入某卷題目（含快取），回傳扁平題目陣列 */
  async function loadQuizQuestions(id) {
    if (cache.has(id)) return cache.get(id);
    const meta = (global.QUIZZES || []).find(q => q.id === id);
    if (!meta) throw new Error('未知測驗 id：' + id);
    const src = await fetchSource(meta);
    const literal = extractArrayLiteral(src, meta.varName);
    const { questions, warnings } = normalize(literal);
    if (warnings.length) console.warn('[' + id + '] 轉換警告：', warnings);
    cache.set(id, questions);
    return questions;
  }

  /* 對外：一次驗證全部題庫（給 E1/G3 抽查用，於 console 輸出報告） */
  async function validateAll() {
    const report = [];
    for (const meta of (global.QUIZZES || [])) {
      try {
        const src = await fetchSource(meta);
        const { questions, warnings } = normalize(extractArrayLiteral(src, meta.varName));
        report.push({ id: meta.id, ok: true, count: questions.length, expected: meta.n, warnings });
      } catch (e) {
        report.push({ id: meta.id, ok: false, error: e.message });
      }
    }
    console.table(report.map(r => ({ id: r.id, ok: r.ok, count: r.count, expected: r.expected, warn: (r.warnings || []).length, error: r.error || '' })));
    return report;
  }

  /* J2：Fisher–Yates 洗牌（就地，回傳同一陣列） */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* J2：依難度配額抽題並隨機排序。
     questions = loadQuizQuestions 回傳的扁平題目（含 pd）；quota 預設取 window.SAMPLE。
     做法：依 pd 分組 → 各組洗牌後抽固定數 → 某組不足則由其餘題目遞補到配額合計 → 整體再洗牌。
     回傳「新陣列」，不改動原陣列、不進快取，故每次呼叫都是一份新題組。 */
  function sampleQuestions(questions, quota) {
    quota = quota || global.SAMPLE || null;
    if (!quota) return shuffle(questions.slice());          // 沒設定配額 → 整卷洗牌
    const byTier = {};
    questions.forEach(q => { const t = q.pd || 'medium'; (byTier[t] = byTier[t] || []).push(q); });
    const picked = [], used = new Set();
    Object.keys(quota).forEach(tier => {
      const pool = shuffle((byTier[tier] || []).slice());
      const take = Math.min(quota[tier] || 0, pool.length);
      for (let i = 0; i < take; i++) { picked.push(pool[i]); used.add(pool[i]); }
    });
    const target = Object.keys(quota).reduce((s, k) => s + (quota[k] || 0), 0);
    if (picked.length < target) {                           // 遞補：某難度不足時，從未用到的題目補滿
      const rest = shuffle(questions.filter(q => !used.has(q)));
      for (let i = 0; i < rest.length && picked.length < target; i++) picked.push(rest[i]);
    }
    return shuffle(picked);
  }

  global.QuizLoader = { loadQuizQuestions, sampleQuestions, validateAll, _extractArrayLiteral: extractArrayLiteral, _normalize: normalize };
})(window);
