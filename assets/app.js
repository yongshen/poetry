/* ============================================================
   诗泉 · 背诗 —— 主应用：路由 / 渲染 / 练习会话 / 结果
   ============================================================ */
(function () {
  'use strict';

  var state = {
    homePoem: null,
    detailPoem: null,
    session: null,
    answers: [],
    feedbackShown: false,
    collectTab: 'review'
  };

  /* ---------- 基础工具 ---------- */
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1900);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var CN = ['日', '一', '二', '三', '四', '五', '六'];
  function toCn(n) {
    var d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二',
      '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '二十一', '二十二',
      '二十三', '二十四', '二十五', '二十六', '二十七', '二十八', '二十九', '三十', '三十一'];
    return d[n] != null ? d[n] : String(n);
  }

  /* ---------- 国际化（关键文案） ---------- */
  var T = {
    tabs: { home: { 'zh-Hans': '首页', 'zh-Hant': '首頁' }, practice: { 'zh-Hans': '练习', 'zh-Hant': '練習' }, collect: { 'zh-Hans': '收藏', 'zh-Hant': '收藏' }, me: { 'zh-Hans': '我的', 'zh-Hant': '我的' } }
  };
  function lang() { return Store.getSettings().lang; }
  function t(dict) { return dict[lang()] || dict['zh-Hans']; }

  /* ---------- 页面/标签切换 ---------- */
  function showTab(name) {
    $$('.tab-panel').forEach(function (p) {
      p.classList.toggle('is-active', p.getAttribute('data-tab') === name);
    });
    $$('#tabbar .tab').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === name);
    });
    $('#view').scrollTop = 0;
    if (name === 'me') { renderMe(); checkHealth(); }
    if (name === 'collect') renderCollect();
    if (name === 'home') renderHome();
  }

  function openPage(id) {
    $('#page-' + id).hidden = false;
  }
  function closePage(id) {
    $('#page-' + id).hidden = true;
  }

  /* ============================================================
     首页
     ============================================================ */
  function renderHomeDate() {
    var now = new Date();
    $('#homeDateB').textContent = toCn(now.getMonth() + 1) + '月' + toCn(now.getDate()) + '日';
    $('#homeDateS').textContent = now.getFullYear() + '年 · 星期' + CN[now.getDay()];
  }

  function renderHome() {
    renderHomeDate();
    renderHomeTask();
    renderHomeReview();
    applyLangLabels();
  }

  function renderHomeTask() {
    var due = Store.getDueReviews().length;
    var d = Store.getDerived();
    var target = Store.getSettings().dailyCount;
    var doneToday = Store.getStats().checkins[Store.dateStr()] ? 1 : 0;
    $('#homeTaskNum').textContent = doneToday + ' / ' + target + ' 首';
    $('#homeTaskBar').style.width = Math.min(100, Math.round(doneToday / target * 100)) + '%';
    if (doneToday) {
      $('#homeTaskSub').textContent = '已连续打卡 ' + d.streak + ' 天 · 今日已完成练习';
    } else {
      $('#homeTaskSub').textContent = '完成一组练习即可打卡 · 待复习 ' + due + ' 项';
    }
  }

  function loadHomePoem() {
    var card = $('#homePoemCard');
    card.innerHTML = '<div class="sk sk-w"></div><div class="sk sk-m"></div><div class="sk"></div><div class="sk sk-m"></div>';
    $('#homeActions').hidden = true;
    API.random().then(function (poem) {
      if (!poem) { card.innerHTML = errHtml('抽诗失败'); return; }
      state.homePoem = poem;
      renderHomePoem(poem);
    }).catch(function () {
      setOffline(true);
      // 离线兜底：从收藏里随机一首
      var favs = Store.getFavorites();
      if (favs.length) {
        state.homePoem = favs[Math.floor(Math.random() * favs.length)];
        renderHomePoem(state.homePoem);
      } else {
        card.innerHTML = errHtml('诗泉暂不可达，且无本地收藏');
      }
    });
  }

  function renderHomePoem(poem) {
    var card = $('#homePoemCard');
    var by = [poem.dynasty ? poem.dynasty.name : '', poem.author ? poem.author.name : '', poem.type ? poem.type.name : ''].filter(Boolean).join(' · ');
    var seal = (poem.author && poem.author.name) ? poem.author.name.charAt(0) : '詩';
    var content = poem.content || [];
    var show = content.slice(0, 6);
    var body = show.map(function (line) {
      return '<span class="ln">' + escapeHtml(line) + '</span>';
    }).join('');
    if (content.length > 6) {
      body += '<span class="ln more-lines">⋯ 点击查看全文</span>';
    }
    card.innerHTML =
      '<h3 class="poem-title">' + escapeHtml(poem.title) + '</h3>' +
      '<p class="poem-by">' + escapeHtml(by) + '</p>' +
      '<div class="poem-body">' + body + '</div>' +
      '<div class="mini-seal">' + escapeHtml(seal) + '</div>';
    $('#homeActions').hidden = false;
    updateFavoriteBtn();
  }

  function updateFavoriteBtn() {
    var btn = $('#homeActions [data-action="favorite"]');
    if (!btn) return;
    var fav = state.homePoem && Store.isFavorite(state.homePoem.id);
    btn.textContent = fav ? '已收藏' : '收藏';
    btn.classList.toggle('gold', fav);
  }

  function renderHomeReview() {
    var box = $('#homeReviewList');
    var due = Store.getDueReviews();
    if (!due.length) {
      box.innerHTML = '<p class="empty-mini">暂无待复习内容</p>';
      return;
    }
    box.innerHTML = due.slice(0, 3).map(function (r, i) {
      return '<div class="rec-line"><span class="rl-no">' + ['壹', '貳', '叁'][i] + '</span>' +
        '<span class="rl-t">' + escapeHtml(r.line) + '</span>' +
        '<span class="rl-a">' + escapeHtml(r.author) + '</span></div>';
    }).join('');
  }

  function errHtml(msg) {
    return '<div style="padding:30px 0;text-align:center"><span class="err-ico">!</span>' +
      '<p style="font-size:12.5px;color:var(--ink-faint);margin-top:12px">' + escapeHtml(msg) + '</p>' +
      '<button class="u-btn ghost" style="margin-top:14px" data-action="retry-home">重试</button></div>';
  }

  /* ============================================================
     练习会话
     ============================================================ */
  function startSession(opts) {
    opts = opts || {};
    var mode = opts.mode || 'daily';
    var difficulty = Store.getSettings().difficulty;

    if (mode === 'single') {
      var poem = opts.poem || state.detailPoem || state.homePoem;
      if (!poem) { toast('暂无诗词'); return; }
      var qs = Practice.buildPoemQuestions(poem, difficulty);
      if (!qs.length) { toast('这首诗太短，无法出题'); return; }
      beginSession({ mode: mode, difficulty: difficulty, questions: qs });
    } else if (mode === 'wrong') {
      var items = opts.wrongItems || Store.getWrongLines();
      var wq = Practice.buildWrongQuestions(items);
      if (!wq.length) { toast('错句本为空'); return; }
      beginSession({ mode: mode, difficulty: difficulty, questions: wq });
    } else {
      // daily：抽取 N 首随机诗
      var n = Store.getSettings().dailyCount || 5;
      toast('正在抽取 ' + n + ' 首诗词…');
      var pms = [];
      for (var i = 0; i < n; i++) {
        pms.push(API.random().catch(function () { return null; }));
      }
      Promise.all(pms).then(function (poems) {
        poems = poems.filter(Boolean);
        if (!poems.length) { setOffline(true); toast('抽取失败，请重试'); return; }
        var dq = Practice.buildDailyQuestions(poems, difficulty);
        if (!dq.length) { toast('抽取的诗词过短，请重试'); return; }
        beginSession({ mode: 'daily', difficulty: difficulty, questions: dq });
      }).catch(function () {
        setOffline(true);
        toast('网络不可用，请重试');
      });
    }
  }

  function beginSession(session) {
    state.session = session;
    state.session.index = 0;
    state.session.results = [];
    state.session.streak = 0;
    state.session.maxStreak = 0;
    state.session.totalHoles = 0;
    state.session.correctHoles = 0;
    state.session.startTime = Date.now();
    state.session.poemSet = {};
    state.feedbackShown = false;
    openPage('exercise');
    renderQuestion();
  }

  function currentQ() {
    return state.session.questions[state.session.index];
  }

  function renderQuestion() {
    var q = currentQ();
    var s = state.session;
    state.answers = q.holes.map(function () { return ''; });
    state.feedbackShown = false;

    // 头部
    $('#exHead').innerHTML =
      '<p class="eh-t">' + escapeHtml(q.title) + '</p>' +
      '<p class="eh-s">' + escapeHtml([q.dynasty, q.author, q.typeName].filter(Boolean).join(' · ')) + '</p>' +
      '<p class="eh-hint">点击下方候选字，填入空缺处</p>';

    // 进度
    $('#exProgress').style.width = Math.round(s.index / s.questions.length * 100) + '%';
    $('#exNum').textContent = (s.index + 1) + ' / ' + s.questions.length;

    // 连对
    renderStreak();

    // 挖空展示
    renderBlank();

    // 候选字
    renderCandidates();

    // 反馈区
    $('#exFeedback').hidden = true;
    $('#exFeedback').innerHTML = '';
    $('#exHint').textContent = '候选字含干扰项 · 已选 0 / ' + q.holes.length;

    // 提交按钮
    var sub = $('#exSubmit');
    sub.textContent = '提交答案';
    sub.disabled = true;
    sub.classList.remove('cinnabar', 'ghost');
    sub.classList.add('primary');
  }

  function renderStreak() {
    var s = state.session;
    var box = $('#exStreak');
    var lit = Math.min(5, s.streak);
    var html = '';
    for (var i = 0; i < 5; i++) html += '<i class="' + (i < lit ? 'on' : '') + '"></i>';
    box.innerHTML = html;
  }

  function renderBlank() {
    var q = currentQ();
    var holeBySeg = {};
    q.holes.forEach(function (h, i) { holeBySeg[h.segIdx] = i; });
    var box = $('#exBlank');
    box.innerHTML = '';
    var line = el('div', 'blank-line');
    q.segs.forEach(function (seg, segIdx) {
      if (seg.t === 'punct') {
        line.appendChild(el('span', 'ch punct', seg.text));
      } else if (holeBySeg[segIdx] != null) {
        var hi = holeBySeg[segIdx];
        var ch = el('span', 'ch hole', state.answers[hi] || '？');
        if (state.answers[hi]) ch.classList.add('filled');
        ch.setAttribute('data-hole', hi);
        line.appendChild(ch);
      } else {
        var c = el('span', 'ch', seg.text);
        if (state.feedbackShown) c.classList.add('dim');
        line.appendChild(c);
      }
    });
    box.appendChild(line);
  }

  function renderCandidates() {
    var q = currentQ();
    var box = $('#exCandidates');
    box.innerHTML = '';
    q.candidates.forEach(function (c) {
      var b = el('button', '', c.text);
      if (state.answers.indexOf(c.text) >= 0) b.classList.add('used');
      b.setAttribute('data-char', c.text);
      box.appendChild(b);
    });
  }

  function firstEmpty() {
    for (var i = 0; i < state.answers.length; i++) if (!state.answers[i]) return i;
    return -1;
  }

  function onCandidate(char) {
    if (state.feedbackShown) return;
    if (state.answers.indexOf(char) >= 0) { toast('该字已选'); return; }
    var idx = firstEmpty();
    if (idx < 0) return;
    state.answers[idx] = char;
    renderBlank();
    renderCandidates();
    var q = currentQ();
    var done = state.answers.filter(Boolean).length;
    $('#exHint').textContent = '候选字含干扰项 · 已选 ' + done + ' / ' + q.holes.length;
    $('#exSubmit').disabled = (firstEmpty() !== -1);
  }

  function onHoleClick(holeIdx) {
    if (state.feedbackShown) return;
    if (state.answers[holeIdx]) {
      state.answers[holeIdx] = '';
      renderBlank();
      renderCandidates();
      var q = currentQ();
      var done = state.answers.filter(Boolean).length;
      $('#exHint').textContent = '候选字含干扰项 · 已选 ' + done + ' / ' + q.holes.length;
      $('#exSubmit').disabled = true;
    }
  }

  function submitAnswer() {
    if (state.feedbackShown) { nextQuestion(); return; }
    var q = currentQ();
    if (firstEmpty() >= 0) { toast('还有空缺未填'); return; }

    var result = Practice.judge(q, state.answers);
    state.feedbackShown = true;

    var s = state.session;
    s.results.push({ q: q, result: result });
    s.totalHoles += result.total;
    s.correctHoles += result.correct;
    s.poemSet[q.poemId] = true;

    if (result.correct === result.total) {
      s.streak++;
      s.maxStreak = Math.max(s.maxStreak, s.streak);
    } else {
      s.streak = 0;
    }

    // 错句入本
    if (result.correct < result.total) {
      result.perHole.forEach(function (p) {
        if (!p.ok) {
          Store.addWrongLine({
            poemId: q.poemId, title: q.title, author: q.author, typeName: q.typeName,
            line: q.line, wrong: p.user, correct: p.answer
          });
        }
      });
    }

    // 错句复习（错句本模式）
    if (q.wrongItemId) {
      Store.reviewWrongLine(q.wrongItemId, result.correct === result.total);
    }

    renderBlankWithJudge(result);
    renderStreak();
    renderFeedback(result);

    var sub = $('#exSubmit');
    sub.disabled = false;
    sub.textContent = (s.index >= s.questions.length - 1) ? '查看结果' : '下一题';
    sub.classList.remove('primary');
    sub.classList.add('cinnabar');
  }

  function renderBlankWithJudge(result) {
    var q = currentQ();
    var holeBySeg = {};
    q.holes.forEach(function (h, i) { holeBySeg[h.segIdx] = i; });
    var box = $('#exBlank');
    box.innerHTML = '';
    var line = el('div', 'blank-line');
    q.segs.forEach(function (seg, segIdx) {
      if (seg.t === 'punct') {
        line.appendChild(el('span', 'ch punct', seg.text));
      } else if (holeBySeg[segIdx] != null) {
        var hi = holeBySeg[segIdx];
        var p = result.perHole[hi];
        var cls = p.ok ? 'ch hole right' : 'ch hole wrong';
        line.appendChild(el('span', cls, p.user));
      } else {
        line.appendChild(el('span', 'ch dim', seg.text));
      }
    });
    box.appendChild(line);
  }

  function renderFeedback(result) {
    var fb = $('#exFeedback');
    var ok = result.correct === result.total;
    fb.hidden = false;
    var wrongLines = result.perHole.filter(function (p) { return !p.ok; });
    if (ok) {
      fb.className = 'fb-bar ok';
      fb.innerHTML = '<span class="fb-i">✓</span><div style="flex:1 1 auto;min-width:0">' +
        '<b>全对，答对 ' + result.correct + ' / ' + result.total + '</b>' +
        '<p>连对 ' + state.session.streak + ' 题，继续加油。</p></div>';
    } else {
      var sample = wrongLines[0];
      fb.className = 'fb-bar err';
      fb.innerHTML = '<span class="fb-i">✕</span><div style="flex:1 1 auto;min-width:0">' +
        '<b>还差一点，答对 ' + result.correct + ' / ' + result.total + '</b>' +
        '<p>「' + escapeHtml(sample.user || '？') + '」应作「<strong style="color:var(--jade)">' + escapeHtml(sample.answer) + '</strong>」。此句已加入错句本。</p></div>';
    }
    $('#exHint').textContent = '已判定 · 点击下方按钮继续';
  }

  function nextQuestion() {
    var s = state.session;
    s.index++;
    if (s.index >= s.questions.length) {
      finishSession();
    } else {
      renderQuestion();
    }
  }

  function finishSession() {
    var s = state.session;
    var elapsed = Math.round((Date.now() - s.startTime) / 1000);
    var rate = s.totalHoles > 0 ? s.correctHoles / s.totalHoles : 0;
    var poemIds = Object.keys(s.poemSet);

    // 记录练习与打卡
    Store.recordPractice(poemIds, s.totalHoles, s.correctHoles);

    // 更新收藏诗词的记忆曲线
    poemIds.forEach(function (pid) {
      var qs = s.results.filter(function (r) { return String(r.q.poemId) === String(pid); });
      var c = 0, tot = 0;
      qs.forEach(function (r) { c += r.result.correct; tot += r.result.total; });
      if (tot > 0) Store.updateReview(pid, c / tot);
    });

    renderResult(rate, elapsed, poemIds);
    closePage('exercise');
    openPage('result');
  }

  /* ============================================================
     结果页
     ============================================================ */
  function renderResult(rate, elapsed, poemIds) {
    var pct = Math.round(rate * 100);
    // 环
    var C = 2 * Math.PI * 64;
    $('#resRing').innerHTML =
      '<div class="ring"><svg width="150" height="150" viewBox="0 0 150 150">' +
      '<circle cx="75" cy="75" r="64" fill="none" stroke="#EAE3D5" stroke-width="11"/>' +
      '<circle cx="75" cy="75" r="64" fill="none" stroke="#9E2B1E" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + C.toFixed(0) + '" stroke-dashoffset="' + (C * (1 - rate)).toFixed(0) + '"/>' +
      '</svg><div class="rg-txt"><div><b>' + pct + '%</b><span>正确率</span></div></div></div>';

    var s = state.session;
    var mm = Math.floor(elapsed / 60), ss = elapsed % 60;
    var timeStr = mm > 0 ? mm + '′' + (ss < 10 ? '0' : '') + ss + '″' : ss + '″';

    $('#resQuad').innerHTML =
      '<div class="rq"><span>答对</span><b>' + s.correctHoles + '<em>/ ' + s.totalHoles + ' 空</em></b></div>' +
      '<div class="rq"><span>用时长</span><b>' + timeStr + '</b></div>' +
      '<div class="rq"><span>最长连对</span><b>' + s.maxStreak + '<em>题</em></b></div>' +
      '<div class="rq"><span>涉及诗作</span><b>' + poemIds.length + '<em>首</em></b></div>';

    // 错句回顾
    var miss = [];
    s.results.forEach(function (r) {
      if (r.result.correct < r.result.total) {
        r.result.perHole.forEach(function (p) {
          if (!p.ok) miss.push({ q: r.q, p: p });
        });
      }
    });
    var missHtml = '';
    if (miss.length) {
      missHtml = '<div class="sect-label">错句回顾 <span style="margin-left:auto;letter-spacing:0;font-size:11px;color:var(--cinnabar)">' + miss.length + ' 句已入错句本</span></div>';
      miss.forEach(function (m) {
        var lineWithU = escapeHtml(m.q.line).replace(escapeHtml(m.p.answer), function () {
          return '<u>' + escapeHtml(m.p.user || '？') + '</u>';
        });
        missHtml += '<div class="miss-item"><p class="mi-q">' + lineWithU + '</p>' +
          '<p class="mi-a">正字：「' + escapeHtml(m.p.answer) + '」</p>' +
          '<p class="mi-f">' + escapeHtml(m.q.author || '') + '《' + escapeHtml(m.q.title) + '》</p></div>';
      });
    } else {
      missHtml = '<div class="sect-label">错句回顾</div><p class="empty-txt">全对，没有错句。</p>';
    }
    $('#resMiss').innerHTML = missHtml;
  }

  /* ============================================================
     收藏页
     ============================================================ */
  function renderCollect() {
    // 徽标
    var due = Store.getDueReviews().length;
    var favs = Store.getFavorites().length;
    var wrongs = Store.getWrongLines().length;
    $('#badgeReview').textContent = due;
    $('#badgeFav').textContent = favs;
    $('#badgeWrong').textContent = wrongs;

    var box = $('#collectList');
    if (state.collectTab === 'review') box.innerHTML = renderReviewList();
    else if (state.collectTab === 'favorite') box.innerHTML = renderFavList();
    else box.innerHTML = renderWrongList();
  }

  function renderReviewList() {
    var due = Store.getDueReviews();
    if (!due.length) {
      return '<div class="empty-ico">無</div><p class="empty-txt">暂无待复习内容<br>去收藏或练习，这里会按记忆曲线提醒你</p>';
    }
    return due.map(function (r) {
      var isPoem = r.kind === 'poem';
      var cls = 'review-card due';
      var title = isPoem ? r.title : r.title;
      var sub = isPoem ? r.line : '「' + r.wrong + '」应作「' + r.correct + '」';
      var act = isPoem
        ? '<button class="u-btn cinnabar" data-act="review-poem" data-id="' + r.poem.id + '">背这首</button>'
        : '<button class="u-btn cinnabar" data-act="review-wrong" data-id="' + r.wrongItem.id + '">练这句</button>';
      return '<div class="' + cls + '"><div class="rc-h"><b>' + escapeHtml(title) + '</b><span>今日到期</span></div>' +
        '<p>' + escapeHtml(sub) + '</p><div class="rc-act">' + act + '</div></div>';
    }).join('');
  }

  function renderFavList() {
    var favs = Store.getFavorites();
    if (!favs.length) {
      return '<div class="empty-ico">藏</div><p class="empty-txt">还没有收藏诗词<br>在首页点「收藏」即可加入</p>';
    }
    return favs.map(function (f) {
      var mastered = f.review && f.review.level >= 5;
      var by = [f.author ? f.author.name : '', f.type ? f.type.name : ''].filter(Boolean).join(' · ');
      return '<div class="fav-card" data-act="open-detail" data-id="' + f.id + '">' +
        '<div class="ri-h"><b>' + escapeHtml(f.title) + '</b><span>' + escapeHtml(by) + '</span></div>' +
        '<div class="ri-c">' + escapeHtml((f.content || []).join('')) + '</div>' +
        '<div class="ri-f">' + (mastered ? '<span class="mini-tag red">已背熟</span>' : '<span class="mini-tag gold">待复习</span>') + '</div></div>';
    }).join('');
  }

  function renderWrongList() {
    var wrongs = Store.getWrongLines();
    if (!wrongs.length) {
      return '<div class="empty-ico">錯</div><p class="empty-txt">错句本为空<br>练习中答错的句子会自动收录到这里</p>';
    }
    return wrongs.map(function (w) {
      var mastered = (w.level || 0) >= 5;
      var lineWithU = escapeHtml(w.line).replace(escapeHtml(w.correct), '<u>' + escapeHtml(w.wrong || w.correct) + '</u>');
      return '<div class="wrong-line"><p class="mi-q">' + lineWithU + '</p>' +
        '<p class="mi-a">正字：「' + escapeHtml(w.correct) + '」' + (mastered ? ' · 已掌握' : '') + '</p>' +
        '<p class="mi-f">' + escapeHtml(w.author || '') + '《' + escapeHtml(w.title) + '》</p></div>';
    }).join('');
  }

  /* ============================================================
     详情页
     ============================================================ */
  function openDetail(poem) {
    state.detailPoem = poem;
    renderDetail(poem);
    openPage('detail');
  }

  function renderDetail(poem) {
    var by = [poem.dynasty ? poem.dynasty.name : '', poem.author ? poem.author.name : '', poem.type ? poem.type.name : ''].filter(Boolean).join(' · ');
    var seal = (poem.author && poem.author.name) ? poem.author.name.charAt(0) : '詩';
    var fav = Store.isFavorite(poem.id);
    var body = (poem.content || []).map(function (line) {
      return '<span class="ln">' + escapeHtml(line) + '</span>';
    }).join('');

    var typeMeta = poem.type && poem.type.name;
    var typeDesc = typeMeta ? '<span class="mini-tag gold">' + escapeHtml(typeMeta) + '</span>' : '';

    $('#detailBody').innerHTML =
      '<div class="det-head"><h2>' + escapeHtml(poem.title) + '</h2>' +
      '<p class="dh-by">' + escapeHtml(by) + '</p>' +
      '<div class="det-tags">' + typeDesc + '<span class="mini-tag red">' + (fav ? '已收藏' : '未收藏') + '</span></div></div>' +
      '<div class="det-body">' + body + '<div class="mini-seal">' + escapeHtml(seal) + '</div></div>';

    var favBtn = $('#page-detail .det-actions [data-action="detail-favorite2"]');
    if (favBtn) favBtn.textContent = fav ? '已收藏' : '收藏';
    var starBtn = $('#page-detail [data-action="detail-favorite"]');
    if (starBtn) starBtn.textContent = fav ? '★' : '♡';
  }

  /* ============================================================
     我的页
     ============================================================ */
  function renderMe() {
    var d = Store.getDerived();
    $('#meDays').textContent = '已陪伴 ' + (d.learned || 0) + ' 首 · 本地档案';
    $('#meStreak').textContent = d.streak;
    $('#meLearned').textContent = d.learned;
    $('#meRate').textContent = d.accuracy == null ? '--' : d.accuracy + '%';
    $('#meCount').textContent = d.answered;
    $('#setDaily').textContent = Store.getSettings().dailyCount + ' 首 ›';

    // 繁体开关
    $('#toggleLang').classList.toggle('on', lang() === 'zh-Hant');

    renderHeatmap();
    applyLangLabels();
  }

  function renderHeatmap() {
    var d = Store.getDerived();
    var checkins = d.checkins;
    var box = $('#heatmap');
    box.style.gridTemplateColumns = 'repeat(7,1fr)';
    box.innerHTML = '';
    var today = new Date();
    var days = 35;
    var start = new Date(today); start.setDate(start.getDate() - days + 1);
    var monthDays = 0, thisMonth = 0;
    var nowMonth = today.getMonth(), nowYear = today.getFullYear();
    for (var i = 0; i < days; i++) {
      var dd = new Date(start); dd.setDate(start.getDate() + i);
      var key = Store.dateStr(dd);
      var cell = el('i');
      if (checkins[key]) cell.classList.add('l4');
      if (dd.getTime() === new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
        cell.style.outline = '1.5px solid var(--cinnabar)';
      }
      if (dd.getMonth() === nowMonth && dd.getFullYear() === nowYear) { thisMonth++; if (checkins[key]) monthDays++; }
      box.appendChild(cell);
    }
    $('#heatNote').textContent = '本月打卡 ' + monthDays + ' 天 · 最长连续 ' + d.longest + ' 天';
  }

  function checkHealth() {
    var status = $('#apiStatus');
    status.innerHTML = '<i></i>检测中…';
    status.className = 'api-ok';
    API.health().then(function (r) {
      if (r.ok) {
        status.innerHTML = '<i></i>正常 · ' + r.ms + 'ms';
        status.className = 'api-ok';
        setOffline(false);
      } else {
        status.innerHTML = '<i></i>不可达';
        status.className = 'api-ok off';
        setOffline(true);
      }
    });
    API.stats().then(function (s) {
      $('#apiScale').textContent = (s && s.poems) ? s.poems.toLocaleString() + ' 首' : '--';
    }).catch(function () { $('#apiScale').textContent = '--'; });
  }

  function setOffline(off) {
    $('#offlineBar').hidden = !off;
  }

  /* ============================================================
     语言切换
     ============================================================ */
  function applyLangLabels() {
    $$('#tabbar .tab').forEach(function (b) {
      var key = b.getAttribute('data-tab');
      if (T.tabs[key]) b.lastChild.textContent = t(T.tabs[key]);
    });
  }

  function switchLang(next) {
    Store.saveSettings({ lang: next });
    $$('#langSw button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-lang') === next);
    });
    applyLangLabels();
    $('#toggleLang').classList.toggle('on', next === 'zh-Hant');
    if (state.homePoem) {
      // 服务端转繁简，重新拉取
      loadHomePoem();
    }
    toast(next === 'zh-Hant' ? '已切换为繁体 · lang=zh-Hant' : '已切换为简体 · lang=zh-Hans');
  }

  /* ============================================================
     事件绑定
     ============================================================ */
  function bindEvents() {
    // 底部标签
    $('#tabbar').addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (b) showTab(b.getAttribute('data-tab'));
    });

    // 首页诗卡点击查看全文
    $('#homePoemCard').addEventListener('click', function () {
      if (state.homePoem) openDetail(state.homePoem);
    });

    // 全局 action 委托
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;
      var action = target.getAttribute('data-action');
      var id = target.getAttribute('data-id');
      handleAction(action, id, target);
    });

    // 数据 act 委托（收藏页等动态列表）
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]');
      if (!t) return;
      var act = t.getAttribute('data-act');
      var id = t.getAttribute('data-id');
      if (act === 'open-detail') {
        var f = Store.getFavorite(id);
        if (f) openDetail(f);
      } else if (act === 'review-poem') {
        var p = Store.getFavorite(id);
        if (p) startSession({ mode: 'single', poem: p });
      } else if (act === 'review-wrong') {
        var wl = Store.getWrongLines().filter(function (w) { return w.id === id; });
        if (wl.length) startSession({ mode: 'wrong', wrongItems: wl });
      }
    });

    // 语言切换
    $('#langSw').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) switchLang(b.getAttribute('data-lang'));
    });
    $('#toggleLang').addEventListener('click', function () {
      switchLang(lang() === 'zh-Hant' ? 'zh-Hans' : 'zh-Hant');
    });

    // 难度 / 练习量选择
    $('#diffSel').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      Store.saveSettings({ difficulty: b.getAttribute('data-diff') });
      $$('#diffSel button').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
    $('#countSel').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      Store.saveSettings({ dailyCount: parseInt(b.getAttribute('data-count'), 10) });
      $$('#countSel button').forEach(function (x) { x.classList.toggle('on', x === b); });
    });

    // 收藏页子标签
    $('#collectTabs').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      state.collectTab = b.getAttribute('data-ctab');
      $$('#collectTabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
      renderCollect();
    });

    // 答题页：候选字 & 挖空
    $('#exCandidates').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b && b.getAttribute('data-char')) onCandidate(b.getAttribute('data-char'));
    });
    $('#exBlank').addEventListener('click', function (e) {
      var h = e.target.closest('.ch.hole');
      if (h && h.getAttribute('data-hole') != null) onHoleClick(parseInt(h.getAttribute('data-hole'), 10));
    });
    $('#exSubmit').addEventListener('click', submitAnswer);
  }

  function handleAction(action, id, target) {
    switch (action) {
      case 'start-memorize':
        startSession({ mode: 'single', poem: state.homePoem });
        break;
      case 'favorite':
        if (state.homePoem) {
          var added = Store.toggleFavorite(state.homePoem);
          updateFavoriteBtn();
          toast(added ? '已收藏' : '已取消收藏');
          renderHomeTask();
        }
        break;
      case 'another':
        loadHomePoem();
        break;
      case 'retry-home':
        setOffline(false);
        loadHomePoem();
        break;
      case 'go-practice':
        showTab('practice');
        break;
      case 'go-review':
        state.collectTab = 'review';
        $$('#collectTabs button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-ctab') === 'review'); });
        showTab('collect');
        break;
      case 'go-wrong':
        state.collectTab = 'wrong';
        $$('#collectTabs button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-ctab') === 'wrong'); });
        showTab('collect');
        break;
      case 'go-me':
        showTab('me');
        break;
      case 'start-session':
        startSession({ mode: 'daily' });
        break;
      case 'start-wrong-only':
        startSession({ mode: 'wrong' });
        break;
      case 'quit-exercise':
        if (confirm('确定退出本次练习吗？进度将不会保存。')) {
          closePage('exercise');
          state.session = null;
        }
        break;
      case 'wrong-only':
        closePage('result');
        startSession({ mode: 'wrong' });
        break;
      case 'again':
        closePage('result');
        startSession({ mode: state.session ? state.session.mode : 'daily' });
        break;
      case 'back-home':
        closePage('result');
        showTab('home');
        loadHomePoem();
        break;
      case 'close-detail':
        closePage('detail');
        break;
      case 'detail-favorite':
      case 'detail-favorite2':
        if (state.detailPoem) {
          var a = Store.toggleFavorite(state.detailPoem);
          renderDetail(state.detailPoem);
          toast(a ? '已收藏' : '已取消收藏');
        }
        break;
      case 'detail-memorize':
        if (state.detailPoem) {
          closePage('detail');
          startSession({ mode: 'single', poem: state.detailPoem });
        }
        break;
      case 'set-daily':
        cycleDaily();
        break;
      case 'export':
        exportData();
        break;
      case 'reset-data':
        if (confirm('确定清空全部本地资料（收藏、错句本、打卡、设置）吗？此操作不可恢复。')) {
          Store.reset();
          state.homePoem = null;
          toast('已清空');
          renderHome();
          renderCollect();
          renderMe();
          loadHomePoem();
        }
        break;
    }
  }

  function cycleDaily() {
    var cur = Store.getSettings().dailyCount || 5;
    var opts = [3, 5, 10];
    var idx = opts.indexOf(cur);
    var next = opts[(idx + 1) % opts.length];
    Store.saveSettings({ dailyCount: next });
    $('#setDaily').textContent = next + ' 首 ›';
    toast('每日练习量已设为 ' + next + ' 首');
    renderHomeTask();
  }

  function exportData() {
    var payload = {
      exportedAt: new Date().toISOString(),
      settings: Store.getSettings(),
      favorites: Store.getFavorites(),
      wrongLines: Store.getWrongLines(),
      stats: Store.getStats()
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = el('a');
    a.href = url;
    a.download = 'shiquan-backup-' + Store.dateStr() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('已导出学习记录');
  }

  /* ============================================================
     初始化
     ============================================================ */
  function init() {
    bindEvents();
    renderHomeDate();
    applyLangLabels();
    setClock();
    setInterval(setClock, 30000);
    renderHomeTask();
    renderHomeReview();
    renderCollect();
    loadHomePoem();
    checkHealth();
  }

  function setClock() {
    var now = new Date();
    var h = now.getHours(), m = now.getMinutes();
    $('#sbTime').textContent = h + ':' + (m < 10 ? '0' : '') + m;
  }

  // 注册 Service Worker（仅在 HTTPS 或 localhost 等安全上下文生效）
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 非安全上下文会失败，忽略 */ });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
