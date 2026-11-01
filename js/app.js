(function () {
  'use strict';

  var D = window.LIMBUS || {};
  D.personalities = D.personalities || [];
  D.egos = D.egos || [];
  D.supportPassives = D.supportPassives || [];
  D.deathPassives = D.deathPassives || [];
  D.spirits = D.spirits || [];
  D.items = D.items || [];
  D.body = D.body || { families: [], specials: [] };

  var SINS = ['憤怒', '色欲', '怠惰', '暴食', '憂鬱', '傲慢', '嫉妬'];
  var EGO_RANKS = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'];
  var KINDS = {
    normal: '通常人格',
    special: '特異人格',
    lcb: 'LCB人格',
    sync0: '同期化人格 ランク0',
    sync00: '同期化人格 ランク00',
    sync000: '同期化人格 ランク000'
  };
  var CT_KINDS = ['special', 'sync0', 'sync00', 'sync000'];
  var TYPES = ['斬撃', '貫通', '打撃', '防御', '回避', '反撃', '斬撃反撃', '貫通反撃', '打撃反撃'];
  var RESISTS = ['弱点', '普通', '抵抗'];
  var AFFILIATIONS = ['LCB', 'フィクサー'];
  var STORE_KEY = 'limbus-trpg-sheets-v1';
  var DICE_LINE = /^\s*((?:\d+-)?\d+[dD]\d+(?:[+-]\d+)?)\s*(?:[：:]\s*(.*))?$/;

  var COLOR_RE = /^(#[0-9a-f]{3,8}|[a-z]{3,24}|(?:rgb|hsl)a?\([0-9.,%\s\/deg]+\))$/i;

  var EGO_TABS = [['awaken', '覚醒'], ['corrosion', '侵食'], ['passive', 'パッシブ']];
  var egoTabs = {};

  var app = document.getElementById('app');
  var dialog = document.getElementById('dialog');
  var toastEl = document.getElementById('toast');

  var memoryStore = null;
  var store = loadStore();
  var S = null;
  var RO = false;
  var saveTimer = null;

  function esc(v) {
    return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function clone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }

  function isObj(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function toNum(v) {
    if (v === '' || v === null || v === undefined) {
      return null;
    }
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) {
      return o === undefined || o === null ? undefined : o[k];
    }, obj);
  }

  function setPath(obj, path, val) {
    var ks = path.split('.');
    var o = obj;
    for (var i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] === undefined || o[ks[i]] === null) {
        o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      }
      o = o[ks[i]];
    }
    o[ks[ks.length - 1]] = val;
  }

  function merge(def, val) {
    if (Array.isArray(def)) {
      return Array.isArray(val) ? val : clone(def);
    }
    if (isObj(def) && isObj(val)) {
      var o = {};
      Object.keys(def).forEach(function (k) {
        o[k] = k in val ? merge(def[k], val[k]) : clone(def[k]);
      });
      Object.keys(val).forEach(function (k) {
        if (!(k in def)) {
          o[k] = val[k];
        }
      });
      return o;
    }
    return val === undefined ? clone(def) : val;
  }

  function compact(v) {
    if (Array.isArray(v)) {
      var a = v.map(function (x) {
        var c = compact(x);
        if (c !== undefined) {
          return c;
        }
        return isObj(x) ? {} : '';
      });
      while (a.length) {
        var last = a[a.length - 1];
        if (last === '' || (isObj(last) && !Object.keys(last).length)) {
          a.pop();
        } else {
          break;
        }
      }
      return a;
    }
    if (isObj(v)) {
      var o = {};
      Object.keys(v).forEach(function (k) {
        var c = compact(v[k]);
        if (c !== undefined) {
          o[k] = c;
        }
      });
      return Object.keys(o).length ? o : undefined;
    }
    if (v === '' || v === null || v === undefined || v === false) {
      return undefined;
    }
    return v;
  }

  function emptyTactic() {
    return { name: '', type: '', sin: '', text: '' };
  }

  function emptyPassive() {
    return { name: '', cond: '', effect: '' };
  }

  function emptyItem() {
    return { name: '', count: '', desc: '' };
  }

  function emptyMemo() {
    return { title: '', text: '' };
  }

  function emptyScenario() {
    return { title: '', dateStart: '', dateEnd: '', kp: '', memo: '' };
  }

  function emptyEgo() {
    return {
      req: '',
      passive: emptyPassive(),
      awaken: { sin: '', type: '', text: '' },
      corrosion: { sin: '', type: '', text: '' }
    };
  }

  function emptyEquipped() {
    return {
      name: '',
      affiliation: '',
      hp: '',
      san: '',
      speed: '',
      resist: { slash: '', pierce: '', blunt: '' },
      bullets: '',
      passive: emptyPassive(),
      tactics: [0, 1, 2, 3, 4].map(emptyTactic),
      notes: ''
    };
  }

  function blankSheet() {
    return {
      id: '',
      v: 2,
      createdAt: 0,
      updatedAt: 0,
      name: '',
      player: '',
      affiliation: '',
      profile: { age: '', gender: '' },
      spirit: '',
      equipped: emptyEquipped(),
      support: [emptyPassive(), emptyPassive(), emptyPassive()],
      death: emptyPassive(),
      items: [],
      ego: { ZAYIN: '', TETH: '', HE: '', WAW: '', ALEPH: '' },
      egoDetail: { ZAYIN: emptyEgo(), TETH: emptyEgo(), HE: emptyEgo(), WAW: emptyEgo(), ALEPH: emptyEgo() },
      currency: { lp: '', shards: '' },
      owned: { personalities: [], egos: [], support: [], spirits: [], death: [] },
      scenarios: [],
      memos: []
    };
  }

  function itemDesc(name) {
    var it = D.items.filter(function (x) {
      return x.name === name;
    })[0];
    return it ? it.effect || '' : '';
  }

  function newSheet() {
    var s = blankSheet();
    s.id = uid();
    s.createdAt = Date.now();
    s.updatedAt = s.createdAt;
    s.currency = { lp: '30', shards: '10' };
    s.items = [
      { name: '包帯', count: '1', desc: itemDesc('包帯') },
      { name: '鎮静剤', count: '1', desc: itemDesc('鎮静剤') }
    ];
    s.memos = [emptyMemo()];
    return s;
  }

  function fixList(list, make, min) {
    var a = (Array.isArray(list) ? list : []).map(function (x) {
      return merge(make(), isObj(x) ? x : {});
    });
    while (a.length < (min || 0)) {
      a.push(make());
    }
    return a;
  }

  function normEquipped(e) {
    var m = merge(emptyEquipped(), isObj(e) ? e : {});
    m.tactics = fixList(m.tactics, emptyTactic, 5).slice(0, 5);
    return m;
  }

  function normalize(s) {
    s.equipped = normEquipped(s.equipped);
    s.support = fixList(s.support, emptyPassive, 3);
    s.death = merge(emptyPassive(), isObj(s.death) ? s.death : {});
    EGO_RANKS.forEach(function (r) {
      s.egoDetail[r] = merge(emptyEgo(), isObj(s.egoDetail[r]) ? s.egoDetail[r] : {});
    });
    s.items = fixList(s.items, emptyItem);
    s.memos = fixList(s.memos, emptyMemo);
    s.scenarios = fixList(s.scenarios, emptyScenario);
    ['personalities', 'egos', 'support', 'spirits', 'death'].forEach(function (k) {
      var a = s.owned[k];
      s.owned[k] = Array.isArray(a) ? a.map(function (x) {
        return isObj(x) ? x : {};
      }) : [];
    });
    return s;
  }

  function loadSheet(raw) {
    return normalize(merge(blankSheet(), isObj(raw) ? raw : {}));
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.sheets) {
          return s;
        }
      }
    } catch (e) {
      memoryStore = memoryStore || null;
    }
    return memoryStore || { sheets: {} };
  }

  function saveStore() {
    memoryStore = store;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {
      memoryStore = store;
    }
  }

  function touch() {
    if (RO || !S) {
      return;
    }
    S.updatedAt = Date.now();
    store.sheets[S.id] = S;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveStore, 250);
  }

  window.addEventListener('beforeunload', function () {
    clearTimeout(saveTimer);
    if (S && !RO) {
      store.sheets[S.id] = S;
      saveStore();
    }
  });

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2600);
  }

  function showText(title, text) {
    dialog.innerHTML =
      '<form method="dialog" class="dialog-body">' +
      '<h2>' + esc(title) + '</h2>' +
      '<p class="hint">自動でコピーできませんでした。下の文字を選択してコピーしてください。</p>' +
      '<textarea readonly rows="8" id="dialog-text">' + esc(text) + '</textarea>' +
      '<div class="actions"><button type="button" class="btn" data-action="dialog-copy">コピー</button><button class="btn primary">閉じる</button></div>' +
      '</form>';
    if (dialog.showModal) {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    var ta = document.getElementById('dialog-text');
    ta.focus();
    ta.select();
  }

  function copyText(text, label) {
    function fallback() {
      showText(label, text);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast(label + 'をコピーしました');
      }, fallback);
    } else {
      fallback();
    }
  }

  function b64encode(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64decode(str) {
    var b = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    var u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) {
      u[i] = b.charCodeAt(i);
    }
    return u;
  }

  function streamBytes(bytes, Stream) {
    var s = new Stream('deflate-raw');
    var w = s.writable.getWriter();
    w.write(bytes);
    w.close();
    return new Response(s.readable).arrayBuffer().then(function (buf) {
      return new Uint8Array(buf);
    });
  }

  function encodeSheet(sheet) {
    var c = clone(sheet);
    delete c.id;
    delete c.createdAt;
    delete c.updatedAt;
    var json = JSON.stringify(compact(c) || {});
    var bytes = new TextEncoder().encode(json);
    if (window.CompressionStream) {
      return streamBytes(bytes, window.CompressionStream).then(function (z) {
        return 'z' + b64encode(z);
      });
    }
    return Promise.resolve('r' + b64encode(bytes));
  }

  function decodeSheet(payload) {
    var mode = payload.charAt(0);
    var bytes = b64decode(payload.slice(1));
    var p;
    if (mode === 'z') {
      if (!window.DecompressionStream) {
        return Promise.reject(new Error('このブラウザは共有URLの展開に対応していません'));
      }
      p = streamBytes(bytes, window.DecompressionStream);
    } else {
      p = Promise.resolve(bytes);
    }
    return p.then(function (b) {
      var s = loadSheet(JSON.parse(new TextDecoder().decode(b)));
      s.id = uid();
      return s;
    });
  }

  function cleanStyle(text) {
    var out = [];
    String(text || '').split(';').forEach(function (d) {
      var i = d.indexOf(':');
      if (i < 0) {
        return;
      }
      var prop = d.slice(0, i).trim().toLowerCase();
      var val = d.slice(i + 1).trim();
      if (prop === 'color' && COLOR_RE.test(val)) {
        out.push('color:' + val);
      } else if (prop === 'font-size') {
        var m = val.match(/^(\d+(?:\.\d+)?)(px|rem|em|%|pt)?$/i);
        if (m) {
          var n = parseFloat(m[1]);
          var u = (m[2] || 'px').toLowerCase();
          var rem = u === 'px' ? n / 16 : u === 'pt' ? n / 12 : u === '%' ? n / 100 : n;
          rem = Math.min(3, Math.max(0.6, rem));
          out.push('font-size:' + Math.round(rem * 100) / 100 + 'rem');
        }
      }
    });
    return out.join(';');
  }

  function inlineFmt(s) {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/__(.+?)__/g, '<u>$1</u>')
      .replace(/~~(.+?)~~/g, '<s>$1</s>')
      .replace(/\*([^*\s](?:[^*]*?[^*\s])?)\*/g, '<i>$1</i>');
  }

  function mdInline(raw, st, styles) {
    var links = [];
    var s = esc(raw).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (m, t, u) {
      links.push('<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + inlineFmt(t) + '</a>');
      return '' + (links.length - 1) + '';
    });
    s = inlineFmt(s).replace(/(\d+)/g, function (m, i) {
      return links[Number(i)];
    });
    var before = st.filter(Boolean);
    s = s.replace(/(\d+)|/g, function (m, i) {
      if (i !== undefined) {
        var css = styles[Number(i)];
        st.push(css);
        return css ? '<span style="' + esc(css) + '">' : '';
      }
      return st.pop() ? '</span>' : '';
    });
    return before.map(function (c) {
      return '<span style="' + esc(c) + '">';
    }).join('') + s + st.filter(Boolean).map(function () {
      return '</span>';
    }).join('');
  }

  function mdHTML(text) {
    if (!text) {
      return '';
    }
    var styles = [];
    var src = String(text).replace(/[-]/g, '').replace(/<span\s+style\s*=\s*(?:"([^"]*)"|'([^']*)')\s*>|<\/span\s*>/gi, function (m, a, b) {
      if (/^<\/span/i.test(m)) {
        return '';
      }
      styles.push(cleanStyle(a !== undefined ? a : b));
      return '' + (styles.length - 1) + '';
    });
    var st = [];
    var out = '';
    var stack = [];
    function closeTo(indent) {
      while (stack.length && stack[stack.length - 1].indent > indent) {
        out += '</li></' + stack.pop().type + '>';
      }
    }
    src.split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^(\s*)(?:[*+-]|(\d+)[.)])\s+(.*)$/);
      if (m) {
        var indent = m[1].replace(/\t/g, '    ').length;
        var type = m[2] !== undefined ? 'ol' : 'ul';
        closeTo(indent);
        var top = stack[stack.length - 1];
        if (top && top.indent === indent) {
          if (top.type === type) {
            out += '</li><li>';
          } else {
            out += '</li></' + top.type + '><' + type + '><li>';
            top.type = type;
          }
        } else {
          out += '<' + type + '><li>';
          stack.push({ indent: indent, type: type });
        }
        out += mdInline(m[3], st, styles);
        return;
      }
      closeTo(-1);
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        out += '<hr>';
        return;
      }
      out += '<div class="ln">' + mdInline(line, st, styles) + '</div>';
    });
    closeTo(-1);
    return out;
  }

  function findPersona(name) {
    return D.personalities.filter(function (p) {
      return p.name === name;
    })[0];
  }

  function ownedFor(sheet, name) {
    if (!name) {
      return null;
    }
    return (sheet.owned.personalities || []).filter(function (p) {
      return p.name === name;
    })[0] || null;
  }

  function familiesFor(kind) {
    return D.body.families.filter(function (f) {
      return f.for.indexOf(kind) >= 0;
    });
  }

  function bonusOf(o) {
    var b = { hp: 0, san: 0 };
    familiesFor(o.kind || 'normal').forEach(function (f) {
      var r = Number(getPath(o, 'up.' + f.id) || 0);
      b[f.stat] += r * f.per;
    });
    return b;
  }

  function hasSpecial(sheet, id) {
    var o = ownedFor(sheet, sheet.equipped.name);
    return !!(o && o.sp && o.sp[id]);
  }

  function anyDeadslot(sheet) {
    return sheet.owned.personalities.some(function (o) {
      return o.sp && o.sp.deadslot;
    });
  }

  function totals(sheet) {
    var e = sheet.equipped;
    var o = ownedFor(sheet, e.name);
    var b = o ? bonusOf(o) : { hp: 0, san: 0 };
    var hp = toNum(e.hp);
    var san = toNum(e.san);
    return {
      hp: hp === null ? null : hp + b.hp,
      san: san === null ? null : san + b.san,
      bonus: b,
      owned: o
    };
  }

  function kindOfEquipped(sheet) {
    var o = ownedFor(sheet, sheet.equipped.name);
    if (o) {
      return o.kind || 'normal';
    }
    var p = findPersona(sheet.equipped.name);
    return p ? p.kind : 'normal';
  }

  function F(label, path, o) {
    o = o || {};
    var v = getPath(S, path);
    var a = ' data-path="' + path + '"';
    if (o.list) {
      a += ' list="' + o.list + '"';
    }
    if (o.fill) {
      a += ' data-fill="' + o.fill + '"';
    }
    if (o.idx !== undefined) {
      a += ' data-idx="' + o.idx + '"';
    }
    if (o.ph) {
      a += ' placeholder="' + esc(o.ph) + '"';
    }
    var t = o.type || 'text';
    if (t === 'number') {
      a += ' inputmode="numeric" step="any"';
    }
    return '<label class="f' + (o.cls ? ' ' + o.cls : '') + '"><span>' + label + '</span>' +
      '<input type="' + t + '"' + a + ' value="' + esc(v) + '" autocomplete="off"></label>';
  }

  function T(label, path, rows, cls, extra) {
    return '<label class="f' + (cls ? ' ' + cls : ' wide') + '"><span>' + label + '</span>' +
      '<textarea data-path="' + path + '" rows="' + (rows || 3) + '"' + (extra || '') + '>' + esc(getPath(S, path)) + '</textarea></label>';
  }

  function selectEl(path, options, o) {
    o = o || {};
    var v = getPath(S, path);
    var empty = v === undefined || v === '';
    var cls = o.blankLabel ? ' class="ph-select' + (empty ? ' is-empty' : '') + '"' : '';
    var h = '<select data-path="' + path + '"' + cls + (o.rerender ? ' data-rerender' : '') + '>';
    if (o.blank) {
      h += '<option value="">' + esc(o.blankLabel || '') + '</option>';
    }
    options.forEach(function (op) {
      var val = Array.isArray(op) ? op[0] : op;
      var lab = Array.isArray(op) ? op[1] : op;
      var sel = String(empty ? (o.def === undefined ? '' : o.def) : v) === String(val);
      h += '<option value="' + esc(val) + '"' + (sel ? ' selected' : '') + '>' + esc(lab) + '</option>';
    });
    return h + '</select>';
  }

  function SEL(label, path, options, o) {
    o = o || {};
    return '<label class="f' + (o.cls ? ' ' + o.cls : '') + '"><span>' + label + '</span>' + selectEl(path, options, o) + '</label>';
  }

  function titleInput(path, ph, o) {
    o = o || {};
    return '<input type="text" class="title-input" data-path="' + path + '" placeholder="' + esc(ph) + '"' +
      (o.list ? ' list="' + o.list + '"' : '') + ' value="' + esc(getPath(S, path)) + '" autocomplete="off" aria-label="' + esc(ph) + '">';
  }

  var HANDLE = '<span class="handle" title="ドラッグで並べ替え（スマホは長押ししてからドラッグ）" aria-label="並べ替え">☰</span>';

  function datalist(id, values) {
    return '<datalist id="' + id + '">' + values.map(function (v) {
      return '<option value="' + esc(Array.isArray(v) ? v[0] : v) + '"' + (Array.isArray(v) && v[1] ? ' label="' + esc(v[1]) + '"' : '') + '></option>';
    }).join('') + '</datalist>';
  }

  function datalistsHTML() {
    var ownedNames = (S.owned.personalities || []).map(function (p) {
      return p.name;
    }).filter(Boolean);
    var persona = ownedNames.map(function (n) {
      return [n, '所持'];
    }).concat(D.personalities.filter(function (p) {
      return ownedNames.indexOf(p.name) < 0;
    }).map(function (p) {
      return [p.name, (p.kind === 'special' ? '特異' : 'No.' + p.no) + ' ' + (p.affiliation || '')];
    }));
    var h = datalist('dl-persona', persona);
    h += datalist('dl-persona-all', D.personalities.map(function (p) {
      return [p.name, (p.kind === 'special' ? '特異' : 'No.' + p.no) + ' ' + (p.affiliation || '')];
    }));
    h += datalist('dl-support', D.supportPassives.map(function (s) {
      return [s.name, s.cond];
    }));
    h += datalist('dl-death', D.deathPassives.map(function (s) {
      return [s.name, s.cond];
    }));
    h += datalist('dl-spirit', D.spirits.map(function (s) {
      return [s.name, s.price];
    }));
    h += datalist('dl-item', D.items.map(function (s) {
      return [s.name, s.price];
    }));
    h += datalist('dl-ego-all', D.egos.map(function (e) {
      return [e.name, e.rank];
    }));
    EGO_RANKS.forEach(function (r) {
      h += datalist('dl-ego-' + r, D.egos.filter(function (e) {
        return e.rank === r;
      }).map(function (e) {
        return [e.name, e.req];
      }));
    });
    h += datalist('dl-type', TYPES);
    h += datalist('dl-resist', RESISTS);
    h += datalist('dl-affil', AFFILIATIONS);
    return h;
  }

  function spiritHint() {
    var s = D.spirits.filter(function (x) {
      return x.name === S.spirit;
    })[0];
    return s ? '士気低下：' + s.morale + ' ／ 混乱：' + s.panic : '';
  }

  function sinTypeHTML(p) {
    return '<div class="f wide"><span>罪悪属性</span><div class="pair">' +
      selectEl(p + '.sin', SINS, { blank: true, blankLabel: '罪悪' }) +
      '<input type="text" data-path="' + p + '.type" list="dl-type" placeholder="属性" value="' + esc(getPath(S, p + '.type')) + '" autocomplete="off">' +
      '</div></div>';
  }

  function pcbarHTML() {
    return '<div class="pcbar"><strong data-pcname></strong></div>';
  }

  function bottombarHTML() {
    if (RO) {
      return '<nav class="bottombar"><button type="button" class="btn" data-action="ccfolia">駒出力</button></nav>';
    }
    return '<nav class="bottombar">' +
      '<a class="btn" href="#/">一覧</a>' +
      '<button type="button" class="btn" data-action="share">共有</button>' +
      '<button type="button" class="btn" data-action="export-one">書き出し</button>' +
      '<button type="button" class="btn" data-action="ccfolia">駒出力</button>' +
      '</nav>';
  }

  function basicHTML() {
    return '<section class="card"><h2>基本</h2><div class="grid">' +
      F('PC名', 'name') + F('PL名', 'player') +
      F('年齢', 'profile.age') + F('性別', 'profile.gender') +
      F('所属', 'affiliation', { list: 'dl-affil' }) +
      '</div></section>';
  }

  function statusHTML() {
    var e = S.equipped;
    return '<section class="card"><h2>装備人格・ステータス</h2><div class="stack">' +
      F('装備する人格', 'equipped.name', { list: 'dl-persona', fill: 'persona', ph: '名前を入力すると候補が出ます' }) +
      '<div class="stats">' +
      F('HP（基礎値）', 'equipped.hp', { type: 'number', cls: 's-hp' }) +
      F('SAN（基礎値）', 'equipped.san', { type: 'number', cls: 's-san' }) +
      F('斬撃', 'equipped.resist.slash', { list: 'dl-resist', cls: 's-sla' }) +
      F('速度', 'equipped.speed', { cls: 's-spd' }) +
      F('貫通', 'equipped.resist.pierce', { list: 'dl-resist', cls: 's-pie' }) +
      F('保有弾丸数', 'equipped.bullets', { type: 'number', cls: 's-bul', ph: 'なし' }) +
      F('打撃', 'equipped.resist.blunt', { list: 'dl-resist', cls: 's-blu' }) +
      F('精神', 'spirit', { list: 'dl-spirit', fill: 'spirit', cls: 's-spi' }) +
      '</div></div><p class="hint" id="spirit-hint">' + esc(spiritHint()) + '</p>' +
      '<p class="derived" id="derived"></p>' +
      (e.notes !== undefined ? T('固有の効果・メモ', 'equipped.notes', 3) : '') +
      '</section>';
  }

  function passiveHTML() {
    return '<section class="card"><h2>パッシブ</h2><div class="grid">' +
      F('名称', 'equipped.passive.name') + F('発動条件', 'equipped.passive.cond') +
      T('効果', 'equipped.passive.effect', 2) +
      '</div></section>';
  }

  function supportHTML() {
    var slots = hasSpecial(S, 'supslot') ? 3 : 2;
    var h = '<section class="card"><h2>サポートパッシブ <small>装備枠 ' + slots + '</small></h2>' +
      '<div class="sortable" data-sort="support">';
    for (var i = 0; i < slots; i++) {
      h += '<div class="sub sortitem" data-sort-idx="' + i + '">' + HANDLE + '<div class="grid">' +
        F('名称', 'support.' + i + '.name', { list: 'dl-support', fill: 'support', idx: i }) +
        F('発動条件', 'support.' + i + '.cond') +
        T('効果', 'support.' + i + '.effect', 2) +
        '</div></div>';
    }
    h += '</div>';
    if (hasSpecial(S, 'deadslot')) {
      h += '<h3>死亡後パッシブ</h3><div class="sub"><div class="grid">' +
        F('名称', 'death.name', { list: 'dl-death', fill: 'death' }) +
        F('発動条件', 'death.cond') +
        T('効果', 'death.effect', 2) +
        '</div></div>';
    }
    return h + '</section>';
  }

  function tacticsHTML() {
    var h = '<section class="card"><h2>戦術</h2>';
    for (var i = 0; i < 5; i++) {
      var p = 'equipped.tactics.' + i;
      h += '<div class="sub tactic" data-tactic="' + i + '"><h3 class="title-row"><span>戦術' + i + ' -</span>' +
        titleInput(p + '.name', '戦術名') + '</h3><div class="grid">' +
        sinTypeHTML(p) +
        T('効果', p + '.text', 5) +
        '</div></div>';
    }
    return h + '</section>';
  }

  function itemsHTML() {
    var h = '<section class="card"><h2>アイテム</h2><div class="sortable" data-sort="items">';
    S.items.forEach(function (it, i) {
      h += '<div class="sub sortitem" data-sort-idx="' + i + '">' + HANDLE +
        '<div class="row">' +
        F('名称', 'items.' + i + '.name', { list: 'dl-item', fill: 'item', idx: i, cls: 'grow' }) +
        F('個数', 'items.' + i + '.count', { type: 'number', cls: 'narrow' }) +
        '</div>' +
        T('説明', 'items.' + i + '.desc', 2) +
        '<div class="actions"><button type="button" class="btn small danger" data-action="del-item" data-idx="' + i + '">削除</button></div></div>';
    });
    return h + '</div><button type="button" class="btn" data-action="add-item">アイテムを追加</button></section>';
  }

  function egoHTML() {
    var h = '<section class="card"><h2>装備E.G.O</h2>';
    EGO_RANKS.forEach(function (r) {
      var b = 'egoDetail.' + r;
      var cur = egoTabs[r] || 'awaken';
      h += '<div class="sub tactic" data-ego="' + r + '">' + F(r, 'ego.' + r, { list: 'dl-ego-' + r, fill: 'ego', idx: r }) +
        '<details class="detail" data-key="ego-' + r + '"><summary>必要資源・効果</summary><div class="stack">' +
        F('必要資源', b + '.req') +
        '<div class="tabs" role="tablist">' + EGO_TABS.map(function (t) {
          return '<span class="tab' + (t[0] === cur ? ' on' : '') + '" role="tab" data-action="ego-tab" data-rank="' + r + '" data-tab="' + t[0] + '">' + t[1] + '</span>';
        }).join('') + '</div>';
      EGO_TABS.forEach(function (t) {
        h += '<div class="tabpanel" data-rank="' + r + '" data-panel="' + t[0] + '"' + (t[0] === cur ? '' : ' hidden') + '>';
        if (t[0] === 'passive') {
          h += '<div class="grid">' + F('名称', b + '.passive.name') + F('発動条件', b + '.passive.cond') + T('効果', b + '.passive.effect', 4) + '</div>';
        } else {
          h += '<div class="stack">' + sinTypeHTML(b + '.' + t[0]) + T('効果', b + '.' + t[0] + '.text', 5) + '</div>';
        }
        h += '</div>';
      });
      h += '</div></details></div>';
    });
    return h + '</section>';
  }

  function ownedPersonaRow(o, i) {
    var p = 'owned.personalities.' + i;
    var fams = familiesFor(o.kind || 'normal');
    var h = '<div class="sub sortitem" data-sort-idx="' + i + '">' + HANDLE + '<div class="grid">' +
      F('人格名', p + '.name', { list: 'dl-persona-all', cls: 'wide' }) +
      SEL('種別', p + '.kind', Object.keys(KINDS).map(function (k) {
        return [k, KINDS[k]];
      }), { rerender: true, def: 'normal' }) +
      '</div><details class="detail" data-key="body-' + i + '"><summary>身体強化 <span data-bonus="' + i + '"></span></summary><div class="grid">';
    fams.forEach(function (f) {
      var opts = [['0', 'なし']];
      for (var r = 1; r <= f.costs.length; r++) {
        opts.push([String(r), 'ランク' + r + '（' + f.costs[r - 1] + '欠片）']);
      }
      h += SEL(f.label + '（' + (f.stat === 'hp' ? 'HP' : 'SAN') + '+' + f.per + '/ランク）', p + '.up.' + f.id, opts, { def: '0' });
    });
    h += '</div><div class="checks">';
    D.body.specials.forEach(function (s) {
      var checked = getPath(S, p + '.sp.' + s.id) === true;
      h += '<label class="check"><input type="checkbox" data-path="' + p + '.sp.' + s.id + '" data-rerender' + (checked ? ' checked' : '') + '>' +
        '<span>' + esc(s.label) + '（' + s.cost + '欠片）<small>' + esc(s.effect) + '</small></span></label>';
    });
    h += '</div></details><div class="actions">' +
      '<button type="button" class="btn small" data-action="remember-p" data-idx="' + i + '">装備中の内容をこの人格に記憶</button>' +
      '<button type="button" class="btn small danger" data-action="del-owned-p" data-idx="' + i + '">削除</button></div></div>';
    return h;
  }

  function ownedNameRows(key, list, dl, delAction) {
    var h = '<div class="sortable" data-sort="owned.' + key + '">';
    S.owned[key].forEach(function (o, i) {
      h += '<div class="sub sortitem" data-sort-idx="' + i + '">' + HANDLE + '<div class="row">' +
        F('名称', 'owned.' + key + '.' + i + '.name', { list: dl, cls: 'grow' }) +
        '<button type="button" class="btn small danger" data-action="' + delAction + '" data-idx="' + i + '">削除</button></div></div>';
    });
    return h + '</div>';
  }

  function ownedHTML() {
    var h = '<section class="card"><h2>所持品</h2>' +
      '<div class="grid">' + F('LP', 'currency.lp', { type: 'number' }) + F('自我の欠片', 'currency.shards', { type: 'number' }) + '</div>';

    h += '<h3>所持人格</h3><div class="sortable" data-sort="owned.personalities">';
    S.owned.personalities.forEach(function (o, i) {
      h += ownedPersonaRow(o, i);
    });
    h += '</div><button type="button" class="btn" data-action="add-owned-p">人格を追加</button>';

    h += '<h3>所持E.G.O</h3><div class="sortable" data-sort="owned.egos">';
    S.owned.egos.forEach(function (o, i) {
      var p = 'owned.egos.' + i;
      h += '<div class="sub sortitem" data-sort-idx="' + i + '">' + HANDLE +
        '<h3 class="title-row">' + titleInput(p + '.name', 'E.G.O名', { list: 'dl-ego-all' }) + '</h3><div class="grid">' +
        SEL('危険度', p + '.rank', EGO_RANKS, { blank: true }) +
        T('内容（解析E.G.Oなど自作のとき）', p + '.detail', 3) +
        '</div><div class="actions"><button type="button" class="btn small danger" data-action="del-owned-e" data-idx="' + i + '">削除</button></div></div>';
    });
    h += '</div><button type="button" class="btn" data-action="add-owned-e">E.G.Oを追加</button>';

    h += '<h3>所持サポートパッシブ</h3>' + ownedNameRows('support', S.owned.support, 'dl-support', 'del-owned-sp') +
      '<button type="button" class="btn" data-action="add-owned-sp">サポートパッシブを追加</button>';

    if (S.owned.death.length || anyDeadslot(S)) {
      h += '<h3>所持死亡後パッシブ</h3>' + ownedNameRows('death', S.owned.death, 'dl-death', 'del-owned-d') +
        '<button type="button" class="btn" data-action="add-owned-d">死亡後パッシブを追加</button>';
    }

    h += '<h3>所持精神</h3>' + ownedNameRows('spirits', S.owned.spirits, 'dl-spirit', 'del-owned-s');
    return h + '<button type="button" class="btn" data-action="add-owned-s">精神を追加</button></section>';
  }

  function ctHTML() {
    var h = '<section class="card"><h2>クールタイム（特異人格・同期化人格）</h2>' +
      '<p class="hint">所持人格の種別が「特異人格」「同期化人格」のものが表示されます。使用後に残りセッション数を記録します。</p>' +
      '<p class="derived" id="ct-summary"></p>';
    var any = false;
    S.owned.personalities.forEach(function (o, i) {
      if (CT_KINDS.indexOf(o.kind) < 0) {
        return;
      }
      any = true;
      var p = 'owned.personalities.' + i;
      h += '<div class="row"><div class="ct-name" data-ctname="' + i + '">' + esc(o.name || '（名称未入力）') + '</div>' +
        F('残りCT', p + '.ct', { type: 'number', cls: 'narrow' }) +
        F('メモ', p + '.ctMemo', { cls: 'grow' }) + '</div>';
    });
    if (!any) {
      h += '<p class="empty">該当する人格がありません。</p>';
    }
    return h + '</section>';
  }

  function scenarioHTML() {
    var h = '<section class="card"><h2>通過したシナリオ</h2>';
    S.scenarios.forEach(function (sc, i) {
      var p = 'scenarios.' + i;
      h += '<div class="sub"><div class="stack">' +
        F('シナリオ名', p + '.title') +
        '<div class="f"><span>日程</span><div class="range">' +
        '<input type="date" data-path="' + p + '.dateStart" value="' + esc(sc.dateStart) + '">' +
        '<i>〜</i>' +
        '<input type="date" data-path="' + p + '.dateEnd" value="' + esc(sc.dateEnd) + '"></div></div>' +
        F('KP', p + '.kp') +
        T('メモ', p + '.memo', 3) +
        '</div><div class="actions"><button type="button" class="btn small danger" data-action="del-scenario" data-idx="' + i + '">削除</button></div></div>';
    });
    if (!S.scenarios.length) {
      h += '<p class="empty">まだ記録がありません。</p>';
    }
    return h + '<button type="button" class="btn" data-action="add-scenario">シナリオを追加</button></section>';
  }

  function memoHTML() {
    var h = '<section class="card"><h2>メモ</h2>';
    if (RO) {
      var shown = S.memos.filter(function (m) {
        return m.text || m.title;
      });
      if (!shown.length) {
        return h + '<p class="empty">メモはありません。</p></section>';
      }
      shown.forEach(function (m) {
        h += (m.title ? '<h3 class="memo-title">' + esc(m.title) + '</h3>' : '') + '<div class="rich view">' + mdHTML(m.text) + '</div>';
      });
      return h + '</section>';
    }
    h += '<div class="sortable" data-sort="memos">';
    S.memos.forEach(function (m, i) {
      h += '<div class="sub sortitem" data-sort-idx="' + i + '">' + HANDLE +
        '<h3 class="title-row">' + titleInput('memos.' + i + '.title', 'メモ') + '</h3>' +
        '<label class="f"><textarea data-path="memos.' + i + '.text" rows="5" aria-label="メモ">' + esc(getPath(S, 'memos.' + i + '.text')) + '</textarea></label>' +
        '<div class="rich" data-memoview="' + i + '"></div>' +
        '<div class="actions"><button type="button" class="btn small danger" data-action="del-memo" data-idx="' + i + '">削除</button></div></div>';
    });
    return h + '</div><button type="button" class="btn" data-action="add-memo">メモを追加</button></section>';
  }

  function renderEditor(keep) {
    var y = window.scrollY;
    var opened = keep ? Array.prototype.map.call(app.querySelectorAll('details[open][data-key]'), function (d) {
      return d.dataset.key;
    }) : [];
    app.innerHTML = pcbarHTML() +
      (RO ? '<div class="banner"><p>[閲覧専用] 共有されたキャラシートです。</p></div>' : '') +
      '<fieldset class="sheet"' + (RO ? ' disabled' : '') + '>' +
      basicHTML() + statusHTML() + passiveHTML() + supportHTML() + tacticsHTML() + itemsHTML() + egoHTML() +
      ownedHTML() + ctHTML() + scenarioHTML() + memoHTML() +
      '</fieldset>' + bottombarHTML() + datalistsHTML();
    opened.forEach(function (k) {
      var d = app.querySelector('details[data-key="' + k + '"]');
      if (d) {
        d.open = true;
      }
    });
    document.body.classList.add('has-bar');
    updateDerived();
    window.scrollTo(0, y);
  }

  function updateDerived() {
    var t = totals(S);
    var d = document.getElementById('derived');
    if (d) {
      var kind = kindOfEquipped(S);
      d.innerHTML = '種別：' + esc(KINDS[kind]) + ' ／ HP <b>' + (t.hp === null ? '-' : t.hp) + '</b>' +
        (t.bonus.hp ? '（基礎 ' + esc(S.equipped.hp) + ' + 強化 ' + t.bonus.hp + '）' : '') +
        ' ／ SAN <b>' + (t.san === null ? '-' : t.san) + '</b>' +
        (t.bonus.san ? '（基礎 ' + esc(S.equipped.san) + ' + 強化 ' + t.bonus.san + '）' : '');
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-pcname]'), function (el) {
      el.textContent = S.name || '名称未設定';
      el.classList.toggle('is-unset', !S.name);
    });
    document.title = (S.name || (RO ? '共有キャラシート' : 'キャラシート')) + (RO ? '（閲覧）' : '') + ' - リンバスTRPG';
    Array.prototype.forEach.call(document.querySelectorAll('[data-bonus]'), function (el) {
      var o = S.owned.personalities[Number(el.dataset.bonus)];
      if (o) {
        var b = bonusOf(o);
        el.textContent = '（HP+' + b.hp + ' / SAN+' + b.san + '）';
      }
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-ctname]'), function (el) {
      var o = S.owned.personalities[Number(el.dataset.ctname)];
      if (o) {
        el.textContent = o.name || '（名称未入力）';
      }
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-tactic]'), function (el) {
      var t = S.equipped.tactics[Number(el.dataset.tactic)];
      el.dataset.sin = t && t.sin ? t.sin : '';
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-ego]'), function (el) {
      var d = S.egoDetail[el.dataset.ego];
      el.dataset.sin = d && d.awaken && d.awaken.sin ? d.awaken.sin : '';
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-memoview]'), function (el) {
      var m = S.memos[Number(el.dataset.memoview)];
      el.innerHTML = m ? mdHTML(m.text) : '';
    });
    var cs = document.getElementById('ct-summary');
    if (cs) {
      var list = S.owned.personalities.filter(function (o) {
        return CT_KINDS.indexOf(o.kind) >= 0 && Number(o.ct) > 0;
      }).map(function (o) {
        return esc(o.name) + '：残り' + esc(o.ct);
      });
      cs.innerHTML = list.length ? 'クールタイム中：' + list.join(' ／ ') : 'クールタイム中の人格はありません';
    }
  }

  function renderList() {
    var ids = Object.keys(store.sheets).sort(function (a, b) {
      return (store.sheets[b].updatedAt || 0) - (store.sheets[a].updatedAt || 0);
    });
    var h = '<div class="list-head"><h1>キャラクター一覧</h1><div class="actions">' +
      '<button type="button" class="btn primary" data-action="new">新規作成</button>' +
      '<label class="btn">JSON読み込み<input type="file" accept=".json,application/json" data-action-file="import" hidden></label>' +
      '<button type="button" class="btn" data-action="export-all">全て書き出し</button></div></div>';
    if (!ids.length) {
      h += '<div class="card"><p>まだキャラクターがありません。「新規作成」から始めてください。</p>' +
        '<p class="hint">データはこのブラウザに保存されます。別の端末へ移すときは編集画面の「書き出し」を使い、他の人に見せるときは「共有」を使います。</p></div>';
    }
    h += '<ul class="char-list">';
    ids.forEach(function (id) {
      var s = store.sheets[id];
      h += '<li class="card"><a class="char-main" href="#/edit/' + esc(id) + '"><strong>' + esc(s.name || '名称未設定') + '</strong>' +
        '<span>' + esc([s.affiliation, s.player && 'PL：' + s.player, s.equipped && s.equipped.name].filter(Boolean).join(' ／ ')) + '</span></a>' +
        '<div class="actions"><button type="button" class="btn small" data-action="dup" data-id="' + esc(id) + '">複製</button>' +
        '<button type="button" class="btn small danger" data-action="del" data-id="' + esc(id) + '">削除</button></div></li>';
    });
    app.innerHTML = h + '</ul>';
    S = null;
    document.body.classList.remove('has-bar');
    document.title = 'リンバスTRPG キャラシート';
  }

  function route() {
    var h = location.hash.replace(/^#/, '') || '/';
    var m;
    RO = false;
    if ((m = h.match(/^\/edit\/(.+)$/))) {
      var s = store.sheets[m[1]];
      if (!s) {
        location.hash = '#/';
        return;
      }
      S = loadSheet(s);
      S.id = m[1];
      store.sheets[S.id] = S;
      renderEditor(false);
      window.scrollTo(0, 0);
    } else if ((m = h.match(/^\/s\/(.+)$/))) {
      decodeSheet(m[1]).then(function (s) {
        S = s;
        RO = true;
        renderEditor(false);
        window.scrollTo(0, 0);
      }, function (err) {
        document.body.classList.remove('has-bar');
        app.innerHTML = '<div class="card"><h1>共有URLを開けませんでした</h1><p>' + esc(err.message || 'URLが壊れている可能性があります。') + '</p><a class="btn" href="#/">一覧へ</a></div>';
      });
    } else {
      renderList();
    }
  }

  function equipPersona(name) {
    var o = ownedFor(S, name);
    var p = findPersona(name);
    if (o && o.snapshot) {
      S.equipped = normEquipped(merge(emptyEquipped(), clone(o.snapshot)));
      S.equipped.name = name;
    } else if (p) {
      var e = emptyEquipped();
      e.name = p.name;
      e.affiliation = p.affiliation || '';
      e.hp = String(p.hp);
      e.san = String(p.san);
      e.speed = p.speed;
      e.resist = clone(p.resist);
      e.bullets = p.bullets === undefined ? '' : String(p.bullets);
      e.passive = clone(p.passive);
      p.tactics.forEach(function (t, i) {
        if (i < 5) {
          e.tactics[i] = merge(emptyTactic(), clone(t));
        }
      });
      e.notes = p.notes || '';
      S.equipped = e;
    }
    if (name && !o) {
      S.owned.personalities.push({ name: name, kind: p ? p.kind : 'normal' });
    }
  }

  function tacticLines(e) {
    var out = [];
    e.tactics.forEach(function (t, i) {
      (t.text || '').split('\n').forEach(function (line) {
        var m = line.match(DICE_LINE);
        if (m) {
          out.push(m[1] + ' 【' + i + '：' + (t.name || '戦術' + i) + '】' + (m[2] ? m[2] : ''));
        }
      });
    });
    return out;
  }

  function ccfoliaData(sheet) {
    var e = sheet.equipped;
    var t = totals(sheet);
    var bullets = toNum(e.bullets);
    var status = [
      { label: 'HP', value: t.hp === null ? 0 : t.hp, max: t.hp === null ? 0 : t.hp },
      { label: 'SAN', value: t.san === null ? 0 : t.san, max: t.san === null ? 0 : t.san }
    ];
    if (bullets !== null) {
      status.push({ label: '弾丸', value: bullets, max: bullets });
    }
    var params = [
      { label: '速度', value: e.speed || '' },
      { label: '斬撃', value: e.resist.slash || '' },
      { label: '貫通', value: e.resist.pierce || '' },
      { label: '打撃', value: e.resist.blunt || '' },
      { label: '精神', value: sheet.spirit || '' },
      { label: 'LP', value: String(sheet.currency.lp || '') },
      { label: '自我の欠片', value: String(sheet.currency.shards || '') }
    ];
    var memo = [];
    if (sheet.affiliation) {
      memo.push('所属：' + sheet.affiliation);
    }
    memo.push('人格：' + (e.name || ''));
    if (e.passive.name) {
      memo.push('【パッシブ】' + e.passive.name + '（' + e.passive.cond + '）' + e.passive.effect);
    }
    sheet.support.forEach(function (s) {
      if (s.name) {
        memo.push('【サポート】' + s.name + '（' + s.cond + '）' + s.effect);
      }
    });
    if (sheet.death && sheet.death.name && hasSpecial(sheet, 'deadslot')) {
      memo.push('【死亡後】' + sheet.death.name + '（' + sheet.death.cond + '）' + sheet.death.effect);
    }
    e.tactics.forEach(function (tc, i) {
      if (tc.name) {
        memo.push('【戦術' + i + '】' + tc.name + ' ' + tc.type + (tc.sin ? '：' + tc.sin : '') + '\n' + (tc.text || ''));
      }
    });
    var commands = ['2b4 【戦術選択】'];
    if (DICE_LINE.test(e.speed || '')) {
      commands.push(e.speed + ' 【速度】');
    }
    commands = commands.concat(tacticLines(e));
    return {
      kind: 'character',
      data: {
        name: sheet.name || '名称未設定',
        memo: memo.join('\n'),
        initiative: 0,
        externalUrl: '',
        status: status,
        params: params,
        iconUrl: null,
        faces: [],
        x: 0,
        y: 0,
        angle: 0,
        width: 4,
        height: 4,
        active: true,
        secret: false,
        invisible: false,
        hideStatus: false,
        color: '#888888',
        commands: commands.join('\n'),
        owner: null
      }
    };
  }

  function download(name, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  function importData(text) {
    var obj = JSON.parse(text);
    var list = [];
    if (obj && obj.sheets) {
      list = Object.keys(obj.sheets).map(function (k) {
        return obj.sheets[k];
      });
    } else if (Array.isArray(obj)) {
      list = obj;
    } else {
      list = [obj];
    }
    list.forEach(function (s) {
      var m = loadSheet(s);
      m.id = uid();
      store.sheets[m.id] = m;
    });
    saveStore();
    toast(list.length + '件を読み込みました');
    route();
  }

  function removeAt(path, el) {
    getPath(S, path).splice(Number(el.dataset.idx), 1);
    rerender();
  }

  var actions = {
    'new': function () {
      var s = newSheet();
      store.sheets[s.id] = s;
      saveStore();
      location.hash = '#/edit/' + s.id;
    },
    'dup': function (el) {
      var src = store.sheets[el.dataset.id];
      var c = clone(src);
      c.id = uid();
      c.name = (c.name || '名称未設定') + '（コピー）';
      c.updatedAt = Date.now();
      store.sheets[c.id] = c;
      saveStore();
      renderList();
    },
    'del': function (el) {
      var s = store.sheets[el.dataset.id];
      if (window.confirm('「' + (s.name || '名称未設定') + '」を削除します。元に戻せません。よろしいですか?')) {
        delete store.sheets[el.dataset.id];
        saveStore();
        renderList();
      }
    },
    'export-all': function () {
      download('limbus-sheets.json', JSON.stringify(store, null, 2));
    },
    'export-one': function () {
      download((S.name || 'character') + '.json', JSON.stringify(S, null, 2));
    },
    'share': function () {
      var w = window.open('', '_blank');
      encodeSheet(S).then(function (payload) {
        var url = location.href.split('#')[0] + '#/s/' + payload;
        if (w) {
          w.location.href = url;
        } else {
          copyText(url, '共有URL（' + url.length + '文字）');
        }
      }, function () {
        if (w) {
          w.close();
        }
      });
    },
    'ego-tab': function (el) {
      var r = el.dataset.rank;
      egoTabs[r] = el.dataset.tab;
      Array.prototype.forEach.call(app.querySelectorAll('.tab[data-rank="' + r + '"]'), function (t) {
        t.classList.toggle('on', t.dataset.tab === el.dataset.tab);
      });
      Array.prototype.forEach.call(app.querySelectorAll('.tabpanel[data-rank="' + r + '"]'), function (p) {
        p.hidden = p.dataset.panel !== el.dataset.tab;
      });
    },
    'ccfolia': function () {
      copyText(JSON.stringify(ccfoliaData(S)), 'ココフォリア用コマ');
    },
    'add-item': function () {
      S.items.push({ name: '', count: '1', desc: '' });
      rerender();
    },
    'del-item': function (el) {
      removeAt('items', el);
    },
    'add-memo': function () {
      S.memos.push(emptyMemo());
      rerender();
    },
    'del-memo': function (el) {
      removeAt('memos', el);
    },
    'add-scenario': function () {
      S.scenarios.push(emptyScenario());
      rerender();
    },
    'del-scenario': function (el) {
      removeAt('scenarios', el);
    },
    'add-owned-p': function () {
      S.owned.personalities.push({ name: '', kind: 'normal' });
      rerender();
    },
    'del-owned-p': function (el) {
      removeAt('owned.personalities', el);
    },
    'remember-p': function (el) {
      var o = S.owned.personalities[Number(el.dataset.idx)];
      if (!o.name || o.name !== S.equipped.name) {
        toast('装備中の人格と同じ名前のときだけ記憶できます');
        return;
      }
      o.snapshot = clone(S.equipped);
      touch();
      toast('装備中の内容を記憶しました');
    },
    'add-owned-e': function () {
      S.owned.egos.push({ name: '', rank: '', detail: '' });
      rerender();
    },
    'del-owned-e': function (el) {
      removeAt('owned.egos', el);
    },
    'add-owned-sp': function () {
      S.owned.support.push({ name: '' });
      rerender();
    },
    'del-owned-sp': function (el) {
      removeAt('owned.support', el);
    },
    'add-owned-d': function () {
      S.owned.death.push({ name: '' });
      rerender();
    },
    'del-owned-d': function (el) {
      removeAt('owned.death', el);
    },
    'add-owned-s': function () {
      S.owned.spirits.push({ name: '' });
      rerender();
    },
    'del-owned-s': function (el) {
      removeAt('owned.spirits', el);
    },
    'dialog-copy': function () {
      var ta = document.getElementById('dialog-text');
      ta.select();
      try {
        document.execCommand('copy');
        toast('コピーしました');
      } catch (e) {
        toast('コピーできませんでした。手動でコピーしてください');
      }
    }
  };

  function rerender() {
    touch();
    renderEditor(true);
  }

  function handleFill(el) {
    var kind = el.dataset.fill;
    var v = el.value;
    var hit;
    if (kind === 'persona') {
      equipPersona(v);
      rerender();
    } else if (kind === 'support') {
      hit = D.supportPassives.filter(function (x) {
        return x.name === v;
      })[0];
      if (hit) {
        S.support[Number(el.dataset.idx)] = { name: hit.name, cond: hit.cond, effect: hit.effect };
        rerender();
      }
    } else if (kind === 'death') {
      hit = D.deathPassives.filter(function (x) {
        return x.name === v;
      })[0];
      if (hit) {
        S.death = { name: hit.name, cond: hit.cond, effect: hit.effect };
        rerender();
      }
    } else if (kind === 'item') {
      hit = D.items.filter(function (x) {
        return x.name === v;
      })[0];
      if (hit) {
        S.items[Number(el.dataset.idx)].desc = hit.effect || '';
        rerender();
      }
    } else if (kind === 'ego') {
      hit = D.egos.filter(function (x) {
        return x.name === v;
      })[0];
      if (hit) {
        S.egoDetail[el.dataset.idx] = merge(emptyEgo(), {
          req: hit.req || '',
          passive: clone(hit.passive || {}),
          awaken: clone(hit.awaken || {}),
          corrosion: clone(hit.corrosion || {})
        });
        rerender();
      }
    } else if (kind === 'spirit') {
      var hint = document.getElementById('spirit-hint');
      if (hint) {
        hint.textContent = spiritHint();
      }
    }
  }

  app.addEventListener('input', function (ev) {
    var el = ev.target;
    if (!el.dataset || !el.dataset.path || el.type === 'checkbox' || RO) {
      return;
    }
    setPath(S, el.dataset.path, el.value);
    touch();
    updateDerived();
  });

  app.addEventListener('change', function (ev) {
    var el = ev.target;
    if (RO) {
      return;
    }
    if (el.dataset && el.dataset.path) {
      setPath(S, el.dataset.path, el.type === 'checkbox' ? el.checked : el.value);
      touch();
      if (el.classList.contains('ph-select')) {
        el.classList.toggle('is-empty', !el.value);
      }
    }
    if (el.dataset && el.dataset.fill) {
      handleFill(el);
    } else if (el.dataset && el.dataset.rerender !== undefined) {
      rerender();
    } else {
      updateDerived();
    }
    if (el.dataset && el.dataset.actionFile === 'import' && el.files[0]) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          importData(String(reader.result));
        } catch (e) {
          toast('読み込めませんでした。ファイルの形式を確認してください');
        }
      };
      reader.readAsText(el.files[0]);
    }
  });

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-action]');
    if (el && actions[el.dataset.action]) {
      actions[el.dataset.action](el);
    }
  });

  var pending = null;
  var drag = null;
  var scrollRaf = 0;

  function sortOrder(box) {
    return Array.prototype.filter.call(box.children, function (c) {
      return c.dataset.sortIdx !== undefined;
    }).map(function (c) {
      return Number(c.dataset.sortIdx);
    });
  }

  function dragMove(y) {
    var sibs = Array.prototype.filter.call(drag.box.children, function (c) {
      return c !== drag.row && c.dataset.sortIdx !== undefined;
    });
    var before = null;
    for (var i = 0; i < sibs.length; i++) {
      var r = sibs[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) {
        before = sibs[i];
        break;
      }
    }
    if (before) {
      if (drag.row.nextElementSibling !== before) {
        drag.box.insertBefore(drag.row, before);
      }
    } else if (drag.box.lastElementChild !== drag.row) {
      drag.box.appendChild(drag.row);
    }
  }

  function autoScroll() {
    if (!drag) {
      return;
    }
    var step = 0;
    if (drag.y < 70) {
      step = -14;
    } else if (drag.y > window.innerHeight - 70) {
      step = 14;
    }
    if (step) {
      window.scrollBy(0, step);
      dragMove(drag.y);
    }
    scrollRaf = requestAnimationFrame(autoScroll);
  }

  function startDrag(h, row, box, id, y) {
    var active = document.activeElement;
    if (active && active !== document.body && active.blur) {
      active.blur();
    }
    if (!document.body.contains(row)) {
      return;
    }
    drag = { handle: h, row: row, box: box, id: id, y: y };
    row.classList.add('dragging');
    document.body.classList.add('is-dragging');
    try {
      h.setPointerCapture(id);
    } catch (e) {
      drag.captured = false;
    }
    scrollRaf = requestAnimationFrame(autoScroll);
  }

  function endDrag() {
    if (!drag) {
      return;
    }
    var d = drag;
    drag = null;
    cancelAnimationFrame(scrollRaf);
    d.row.classList.remove('dragging');
    document.body.classList.remove('is-dragging');
    var order = sortOrder(d.box);
    var arr = getPath(S, d.box.dataset.sort);
    var changed = order.some(function (v, i) {
      return v !== i;
    });
    if (changed && arr) {
      var head = order.map(function (i) {
        return arr[i];
      });
      Array.prototype.splice.apply(arr, [0, order.length].concat(head));
      rerender();
    }
  }

  app.addEventListener('pointerdown', function (ev) {
    var h = ev.target.closest && ev.target.closest('.handle');
    if (!h || RO) {
      return;
    }
    var row = h.closest('[data-sort-idx]');
    var box = row && row.parentElement;
    if (!box || !box.dataset.sort) {
      return;
    }
    if (ev.pointerType === 'touch') {
      pending = {
        sx: ev.clientX,
        sy: ev.clientY,
        timer: setTimeout(function () {
          pending = null;
          startDrag(h, row, box, ev.pointerId, ev.clientY);
          if (navigator.vibrate) {
            navigator.vibrate(15);
          }
        }, 350)
      };
    } else {
      ev.preventDefault();
      startDrag(h, row, box, ev.pointerId, ev.clientY);
    }
  });

  document.addEventListener('pointermove', function (ev) {
    if (pending) {
      if (Math.abs(ev.clientX - pending.sx) > 8 || Math.abs(ev.clientY - pending.sy) > 8) {
        clearTimeout(pending.timer);
        pending = null;
      }
      return;
    }
    if (drag && ev.pointerId === drag.id) {
      drag.y = ev.clientY;
      dragMove(ev.clientY);
    }
  });

  function stopPointer() {
    if (pending) {
      clearTimeout(pending.timer);
      pending = null;
    }
    endDrag();
  }

  document.addEventListener('pointerup', stopPointer);
  document.addEventListener('pointercancel', stopPointer);

  app.addEventListener('contextmenu', function (ev) {
    if (ev.target.closest && ev.target.closest('.handle')) {
      ev.preventDefault();
    }
  });

  window.addEventListener('hashchange', route);
  route();
})();
