/* ============================================================
   本地存储层：设置 / 收藏(含复习进度) / 错句本 / 打卡统计
   全部存 localStorage，无服务端用户体系。
   ============================================================ */
window.Store = (function () {
  'use strict';

  var NS = 'shiquan.';
  var INTERVALS = [0, 1, 3, 7, 15, 30]; // 记忆曲线：级数 0..5 对应天数

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(NS + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(NS + key, JSON.stringify(val)); } catch (e) { /* 存储满时忽略 */ }
  }

  /* ---------- 日期工具 ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function addDays(str, n) {
    var d = new Date(str + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return dateStr(d);
  }
  function isDue(nextAt) {
    return !nextAt || nextAt <= dateStr();
  }

  /* ---------- 设置 ---------- */
  function getSettings() {
    var s = read('settings', {});
    return Object.assign({ lang: 'zh-Hans', difficulty: 'standard', dailyCount: 5, poemFontSize: 'normal' }, s);
  }
  function saveSettings(patch) {
    var s = getSettings();
    Object.assign(s, patch);
    write('settings', s);
    return s;
  }

  /* ---------- 收藏 ---------- */
  function getFavorites() { return read('favorites', []); }

  function isFavorite(id) {
    return getFavorites().some(function (f) { return String(f.id) === String(id); });
  }

  function getFavorite(id) {
    var list = getFavorites();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }

  function toggleFavorite(poem) {
    var list = getFavorites();
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(poem.id)) { idx = i; break; }
    }
    if (idx >= 0) {
      list.splice(idx, 1);
      write('favorites', list);
      return false; // 已取消收藏
    }
    poem = JSON.parse(JSON.stringify(poem));
    poem.savedAt = Date.now();
    poem.review = { level: 0, nextAt: dateStr(), practiced: 0 };
    list.unshift(poem);
    write('favorites', list);
    return true; // 已收藏
  }

  // 练习一首诗后更新记忆曲线。correctRate ∈ [0,1]
  function updateReview(poemId, correctRate) {
    var list = getFavorites();
    var changed = false;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(poemId)) {
        var r = list[i].review || { level: 0, nextAt: dateStr(), practiced: 0 };
        r.practiced = (r.practiced || 0) + 1;
        if (correctRate >= 0.8) {
          r.level = Math.min(r.level + 1, 5);
        } else {
          r.level = Math.max(r.level - 1, 0);
        }
        r.nextAt = addDays(dateStr(), INTERVALS[r.level]);
        list[i].review = r;
        changed = true;
        break;
      }
    }
    if (changed) write('favorites', list);
  }

  /* ---------- 错句本 ---------- */
  function getWrongLines() { return read('wrong', []); }

  function addWrongLine(item) {
    var list = getWrongLines();
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].poemId) === String(item.poemId) && list[i].line === item.line) {
        list[i].wrong = item.wrong;
        list[i].correct = item.correct;
        list[i].level = 0;
        list[i].nextAt = dateStr();
        list[i].updatedAt = Date.now();
        found = true;
        break;
      }
    }
    if (!found) {
      item.id = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      item.createdAt = Date.now();
      item.level = 0;
      item.nextAt = dateStr();
      list.unshift(item);
    }
    write('wrong', list);
  }

  function removeWrongLine(id) {
    var list = getWrongLines().filter(function (w) { return w.id !== id; });
    write('wrong', list);
  }

  // 复习错句：ok 为是否答对
  function reviewWrongLine(id, ok) {
    var list = getWrongLines();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        if (ok) {
          list[i].level = Math.min((list[i].level || 0) + 1, 5);
        } else {
          list[i].level = Math.max((list[i].level || 0) - 1, 0);
        }
        list[i].nextAt = ok ? addDays(dateStr(), INTERVALS[list[i].level]) : addDays(dateStr(), 1);
        break;
      }
    }
    write('wrong', list);
  }

  /* ---------- 统计 / 打卡 ---------- */
  function getStats() {
    return read('stats', { practicedIds: {}, totalAnswered: 0, totalCorrect: 0, checkins: {}, lastPracticeDate: '' });
  }

  function recordPractice(poemIds, answered, correct) {
    var s = getStats();
    (poemIds || []).forEach(function (id) { s.practicedIds[id] = true; });
    s.totalAnswered += (answered || 0);
    s.totalCorrect += (correct || 0);
    s.checkins[dateStr()] = true;
    s.lastPracticeDate = dateStr();
    write('stats', s);
    return s;
  }

  function recordCheckin() {
    var s = getStats();
    s.checkins[dateStr()] = true;
    s.lastPracticeDate = dateStr();
    write('stats', s);
  }

  function computeStreak(checkins) {
    var cur = new Date();
    // 允许"今天还没打卡"，从昨天起算连续
    if (!checkins[dateStr(cur)]) cur.setDate(cur.getDate() - 1);
    var streak = 0;
    for (var i = 0; i < 3650; i++) {
      var d = dateStr(cur);
      if (checkins[d]) { streak++; cur.setDate(cur.getDate() - 1); }
      else { break; }
    }
    return streak;
  }

  function computeLongestStreak(checkins) {
    var dates = Object.keys(checkins).sort();
    var longest = 0, run = 0, prev = null;
    for (var i = 0; i < dates.length; i++) {
      if (prev && addDays(prev, 1) === dates[i]) { run++; }
      else { run = 1; }
      longest = Math.max(longest, run);
      prev = dates[i];
    }
    return longest;
  }

  /* ---------- 派生：待复习 ---------- */
  function getDueReviews() {
    var today = dateStr();
    var due = [];
    getFavorites().forEach(function (f) {
      var r = f.review || { level: 0, nextAt: today };
      if (isDue(r.nextAt)) {
        due.push({ kind: 'poem', key: 'p' + f.id, title: f.title, author: f.author ? f.author.name : '', line: (f.content && f.content[0]) || '', nextAt: r.nextAt, level: r.level, poem: f });
      }
    });
    getWrongLines().forEach(function (w) {
      if (isDue(w.nextAt)) {
        due.push({ kind: 'wrong', key: 'w' + w.id, title: w.title, author: w.author, line: w.line, wrong: w.wrong, correct: w.correct, nextAt: w.nextAt, level: w.level || 0, wrongItem: w });
      }
    });
    due.sort(function (a, b) { return (a.nextAt || '').localeCompare(b.nextAt || ''); });
    return due;
  }

  function getDerived() {
    var s = getStats();
    var learned = Object.keys(s.practicedIds || {}).length;
    var accuracy = s.totalAnswered > 0 ? Math.round(s.totalCorrect / s.totalAnswered * 100) : null;
    return {
      learned: learned,
      answered: s.totalAnswered,
      correct: s.totalCorrect,
      accuracy: accuracy,
      streak: computeStreak(s.checkins || {}),
      longest: computeLongestStreak(s.checkins || {}),
      checkins: s.checkins || {},
      firstDay: s.lastPracticeDate
    };
  }

  function reset() {
    ['settings', 'favorites', 'wrong', 'stats'].forEach(function (k) {
      try { localStorage.removeItem(NS + k); } catch (e) { /* ignore */ }
    });
    if (window.API) window.API.clearCache();
  }

  return {
    getSettings: getSettings,
    saveSettings: saveSettings,
    getFavorites: getFavorites,
    isFavorite: isFavorite,
    getFavorite: getFavorite,
    toggleFavorite: toggleFavorite,
    updateReview: updateReview,
    getWrongLines: getWrongLines,
    addWrongLine: addWrongLine,
    removeWrongLine: removeWrongLine,
    reviewWrongLine: reviewWrongLine,
    getStats: getStats,
    recordPractice: recordPractice,
    recordCheckin: recordCheckin,
    getDueReviews: getDueReviews,
    getDerived: getDerived,
    reset: reset,
    dateStr: dateStr,
    addDays: addDays,
    isDue: isDue,
    INTERVALS: INTERVALS
  };
})();
