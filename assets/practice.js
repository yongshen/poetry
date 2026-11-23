/* ============================================================
   练习引擎：挖空默写 —— 出题、候选字、判定
   全部由 content[] 逐句数组在本地生成，不额外消耗接口。
   ============================================================ */
window.Practice = (function () {
  'use strict';

  // 标点/空白视为不可挖空的"标点"段
  var PUNCT_RE = /[，。！？、；：·「」『』（）《》〈〉…—,\s.!?;:'"“”‘’]/;

  function isPunct(ch) { return PUNCT_RE.test(ch); }

  // 依据难度决定挖空数量
  function holeCount(difficulty) {
    if (difficulty === 'enlighten') return 1;
    if (difficulty === 'challenge') return 3;
    return 2; // standard
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pick(arr, n) {
    return shuffle(arr).slice(0, n);
  }

  // 常用易混字兜底干扰池
  var POOL = ('日月山水风云花鸟人天地心事情意春秋雪雨江河湖海客舟马门窗灯酒梦家国故乡明' +
    '清白青绿红黄远近高低大小长短来去出入上下左右东西南北今古朝夕昼夜').split('');

  function collectPoemChars(poem) {
    var set = {};
    (poem.content || []).forEach(function (line) {
      Array.from(line).forEach(function (ch) { if (!isPunct(ch)) set[ch] = true; });
    });
    return Object.keys(set);
  }

  // 将一行拆成段：{t:'char'|'punct', text}
  function splitLine(line) {
    return Array.from(line).map(function (ch) {
      return { t: isPunct(ch) ? 'punct' : 'char', text: ch };
    });
  }

  function buildCandidates(answers, distractorPool) {
    var uniq = {};
    answers.forEach(function (a) { if (a) uniq[a] = true; });
    // 干扰字：优先同诗其余字，再兜底常用字池
    var distractors = [];
    (distractorPool || []).forEach(function (c) { if (!uniq[c]) distractors.push(c); });
    if (distractors.length < 12) {
      POOL.forEach(function (c) { if (!uniq[c] && distractors.indexOf(c) < 0) distractors.push(c); });
    }
    var need = Math.max(6, Math.min(8, answers.length + 5));
    var picked = pick(distractors, need - Object.keys(uniq).length);
    var cands = Object.keys(uniq).concat(picked);
    return shuffle(cands).map(function (t) { return { text: t }; });
  }

  // 生成一道挖空题；返回 null 表示该句可挖汉字不足
  function buildBlank(poem, difficulty, lineIndex) {
    var line = poem.content[lineIndex];
    if (line == null) return null;
    var segs = splitLine(line);
    var charIdx = [];
    segs.forEach(function (s, i) { if (s.t === 'char') charIdx.push(i); });
    if (charIdx.length < 2) return null; // 至少 2 个汉字才有挖空意义

    var n = Math.min(holeCount(difficulty), charIdx.length - 1);
    if (n < 1) n = 1;

    var pool = charIdx.slice();
    if (difficulty === 'challenge') pool.shift(); // 挑战：留首字
    // 优先选不重复的汉字位置，避免多个空答案相同导致候选字不够
    var shuffled = shuffle(pool);
    var seen = {};
    var holePos = [];
    for (var i = 0; i < shuffled.length && holePos.length < n; i++) {
      var ch = segs[shuffled[i]].text;
      if (!seen[ch]) { seen[ch] = true; holePos.push(shuffled[i]); }
    }
    for (var j = 0; j < shuffled.length && holePos.length < n; j++) {
      if (holePos.indexOf(shuffled[j]) < 0) holePos.push(shuffled[j]);
    }

    var holes = holePos.map(function (segIdx) {
      return { segIdx: segIdx, answer: segs[segIdx].text };
    });
    holes.sort(function (a, b) { return a.segIdx - b.segIdx; }); // 按阅读顺序填空
    var answers = holes.map(function (h) { return h.answer; });

    return {
      poemId: poem.id,
      title: poem.title,
      author: poem.author ? poem.author.name : '',
      dynasty: poem.dynasty ? poem.dynasty.name : '',
      typeName: poem.type ? poem.type.name : '',
      lineIndex: lineIndex,
      line: line,
      segs: segs,
      holes: holes,
      candidates: buildCandidates(answers, collectPoemChars(poem))
    };
  }

  // 一首诗逐句出题
  function buildPoemQuestions(poem, difficulty) {
    var qs = [];
    (poem.content || []).forEach(function (_, i) {
      var q = buildBlank(poem, difficulty, i);
      if (q) qs.push(q);
    });
    return qs;
  }

  // 多首诗：每首出一道（随机选一句）
  function buildDailyQuestions(poems, difficulty) {
    var qs = [];
    poems.forEach(function (poem) {
      if (!poem || !poem.content) return;
      var idxs = [];
      for (var i = 0; i < poem.content.length; i++) idxs.push(i);
      var order = shuffle(idxs);
      for (var k = 0; k < order.length; k++) {
        var q = buildBlank(poem, difficulty, order[k]);
        if (q) { qs.push(q); break; }
      }
    });
    return qs;
  }

  // 错句本出题：挖出错的那个字（若出现多次则全部挖）
  function buildWrongQuestions(wrongLines) {
    var qs = [];
    wrongLines.forEach(function (w) {
      var line = w.line;
      var segs = splitLine(line);
      var target = w.correct || w.wrong;
      var holes = [];
      // 挖错字的第一处出现（单字候选与单空一一对应）
      for (var i = 0; i < segs.length; i++) {
        if (segs[i].t === 'char' && segs[i].text === target) {
          holes.push({ segIdx: i, answer: target });
          break;
        }
      }
      if (holes.length === 0) {
        // 兜底：挖句中第一个汉字
        for (var i = 0; i < segs.length; i++) {
          if (segs[i].t === 'char') { holes.push({ segIdx: i, answer: segs[i].text }); break; }
        }
      }
      if (holes.length === 0) return;
      qs.push({
        poemId: w.poemId,
        title: w.title,
        author: w.author,
        typeName: w.typeName,
        lineIndex: 0,
        line: line,
        wrongItemId: w.id,
        segs: segs,
        holes: holes,
        candidates: buildCandidates([target], POOL)
      });
    });
    return qs;
  }

  // 判定：userAnswers = 与 holes 同序的用户所选字数组
  function judge(question, userAnswers) {
    var perHole = question.holes.map(function (h, i) {
      var u = (userAnswers && userAnswers[i]) || '';
      return { answer: h.answer, user: u, ok: u === h.answer };
    });
    var correct = perHole.filter(function (p) { return p.ok; }).length;
    return { perHole: perHole, correct: correct, total: perHole.length };
  }

  return {
    buildBlank: buildBlank,
    buildPoemQuestions: buildPoemQuestions,
    buildDailyQuestions: buildDailyQuestions,
    buildWrongQuestions: buildWrongQuestions,
    judge: judge,
    splitLine: splitLine,
    shuffle: shuffle,
    isPunct: isPunct,
    holeCount: holeCount
  };
})();
