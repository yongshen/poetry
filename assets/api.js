/* ============================================================
   诗泉 API 客户端（7 接口 + lang 全局参数）
   含内存缓存、超时、以及 CORS/网络失败时的代理回退。
   ============================================================ */
window.API = (function () {
  'use strict';

  var BASE = 'https://poetry.palemoky.com';
  var PROXY = 'https://api.allorigins.win/raw?url=';
  var TIMEOUT = 16000;

  // 内存缓存（dynasties / types / stats 变化极慢）
  var _cache = { dynasties: null, types: null, stats: null };

  function currentLang() {
    try {
      if (window.Store && window.Store.getSettings) {
        return window.Store.getSettings().lang || 'zh-Hans';
      }
    } catch (e) { /* ignore */ }
    return 'zh-Hans';
  }

  function qs(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.join('&');
  }

  function fetchJson(url) {
    return new Promise(function (resolve, reject) {
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT);
      var opts = { headers: { 'Accept': 'application/json' } };
      if (ctrl) opts.signal = ctrl.signal;

      fetch(url, opts).then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function (data) {
        clearTimeout(timer);
        resolve(data);
      }).catch(function (err) {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  // 直连失败后走 CORS 代理回退
  function request(path) {
    var full = BASE + path;
    return fetchJson(full).catch(function () {
      return fetchJson(PROXY + encodeURIComponent(full)).catch(function (e2) {
        var err = new Error('NETWORK');
        err.cause = e2;
        throw err;
      });
    });
  }

  function extractPoem(payload) {
    return (payload && payload.data) ? payload.data : null;
  }

  return {
    BASE: BASE,

    // 随机抽诗：author / dynasty / type / char 任一筛选
    random: function (opts) {
      var p = Object.assign({}, opts || {});
      p.lang = p.lang || currentLang();
      return request('/api/poems/random?' + qs(p)).then(extractPoem);
    },

    // 全文检索（分页）
    search: function (q, page, pageSize) {
      var p = { q: q, page: page || 1, pageSize: pageSize || 20, lang: currentLang() };
      return request('/api/search?' + qs(p)).then(function (payload) {
        return {
          list: (payload && payload.data) || [],
          pagination: (payload && payload.pagination) || { page: 1, pageSize: 20, hasMore: false },
          lang: payload && payload.lang
        };
      });
    },

    // 作者名录（分页）
    authors: function (page, pageSize) {
      var p = { page: page || 1, pageSize: pageSize || 20 };
      return request('/api/authors?' + qs(p)).then(function (payload) {
        return {
          list: (payload && payload.data) || [],
          pagination: (payload && payload.pagination) || {}
        };
      });
    },

    dynasties: function () {
      if (_cache.dynasties) return Promise.resolve(_cache.dynasties);
      return request('/api/dynasties').then(function (payload) {
        _cache.dynasties = (payload && payload.data) || [];
        return _cache.dynasties;
      });
    },

    types: function () {
      if (_cache.types) return Promise.resolve(_cache.types);
      return request('/api/types').then(function (payload) {
        _cache.types = (payload && payload.data) || [];
        return _cache.types;
      });
    },

    stats: function () {
      if (_cache.stats) return Promise.resolve(_cache.stats);
      return request('/api/stats').then(function (payload) {
        _cache.stats = (payload && payload.data) || {};
        return _cache.stats;
      });
    },

    // 服务健康检查（含响应耗时）
    health: function () {
      var t0 = Date.now();
      return fetchJson(BASE + '/health').then(function (data) {
        return { ok: !!(data && data.ok), ms: Date.now() - t0, data: data };
      }).catch(function () {
        return fetchJson(PROXY + encodeURIComponent(BASE + '/health')).then(function (data) {
          return { ok: !!(data && data.ok), ms: Date.now() - t0, data: data };
        }).catch(function () {
          return { ok: false, ms: Date.now() - t0, data: null };
        });
      });
    },

    clearCache: function () {
      _cache = { dynasties: null, types: null, stats: null };
    }
  };
})();
