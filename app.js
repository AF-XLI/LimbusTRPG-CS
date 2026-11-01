(function () {
  'use strict';

  var D = window.LIMBUS;
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
  var AFFILIATIONS = ['囚人', 'フィクサー', '翼の職員', 'LCCB職員', '協会所属', '事務所所属'];
  var STORE_KEY = 'limbus-trpg-sheets-v1';
  var DICE_LINE = /^\s*((?:\d+-)?\d+[dD]\d+(?:[+-]\d+)?)\s*(?:[：:]\s*(.*))?$/;

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
    var i;
    if (Array.isArray(def) && Array.isArray(val)) {
      var out = [];
      var n = Math.max(def.length, val.length);
      for (i = 0; i < n; i++) {
        if (i < val.length) {
          out.push(def[i] !== undefined ? merge(def[i], val[i]) : val[i]);
        } else {
          out.push(clone(def[i]));
        }
      }
      return out;
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
      var a = v.map(compact);
      var allEmpty = a.every(function (x) {
        return x === undefined;
      });
      return allEmpty ? undefined : a.map(function (x) {
        return x === undefined ? {} : x;
      });
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

  function emptyEquipped() {
    return {
      name: '',
      affiliation: '',
      hp: '',
      san: '',
      speed: '',
      resist: { slash: '', pierce: '', blunt: '' },
      bullets: '',
      passive: { name: '', cond: '', effect: '' },
      tactics: [0, 1, 2, 3, 4].map(emptyTactic),
      notes: ''
    };
  }

  function newSheet() {
    return {
      id: uid(),
      v: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      name: '',
      player: '',
      affiliation: '囚人',
      profile: { background: '', age: '', gender: '', appearance: '' },
      spirit: '',
      equipped: emptyEquipped(),
      support: [
        { name: '', cond: '', effect: '' },
        { name: '', cond: '', effect: '' },
        { name: '', cond: '', effect: '' }
      ],
      items: [
        { name: '包帯', count: '1' },
        { name: '鎮静剤', count: '1' }
      ],
      ego: { ZAYIN: '', TETH: '', HE: '', WAW: '', ALEPH: '' },
      currency: { lp: '30', shards: '10' },
      owned: { personalities: [], egos: [], support: [], spirits: [] },
      scenarios: [],
      memo: ''
    };
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
      var obj = JSON.parse(new TextDecoder().decode(b));
      var s = merge(newSheet(), obj);
      s.id = uid();
      return s;
    });
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

  function T(label, path, rows, cls) {
    return '<label class="f' + (cls ? ' ' + cls : ' wide') + '"><span>' + label + '</span>' +
      '<textarea data-path="' + path + '" rows="' + (rows || 3) + '">' + esc(getPath(S, path)) + '</textarea></label>';
  }

  function SEL(label, path, options, o) {
    o = o || {};
    var v = getPath(S, path);
    var h = '<label class="f' + (o.cls ? ' ' + o.cls : '') + '"><span>' + label + '</span>' +
      '<select data-path="' + path + '"' + (o.rerender ? ' data-rerender' : '') + '>';
    if (o.blank) {
      h += '<option value=""></option>';
    }
    options.forEach(function (op) {
      var val = Array.isArray(op) ? op[0] : op;
      var lab = Array.isArray(op) ? op[1] : op;
      var sel = String(v === undefined || v === '' ? (o.def === undefined ? '' : o.def) : v) === String(val);
      h += '<option value="' + esc(val) + '"' + (sel ? ' selected' : '') + '>' + esc(lab) + '</option>';
    });
    return h + '</select></label>';
  }

  function sinOptions() {
    return SINS;
  }

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

  function egoDetailHTML(rank) {
    var name = S.ego[rank];
    if (!name) {
      return '';
    }
    var g = D.egos.filter(function (e) {
      return e.name === name;
    })[0];
    if (g) {
      return '<details class="detail"><summary>' + esc(g.name) + '（必要資源：' + esc(g.req) + '）</summary>' +
        '<p><b>パッシブ：' + esc(g.passive.name) + '</b>（' + esc(g.passive.cond) + '）<br>' + esc(g.passive.effect) + '</p>' +
        '<p><b>覚醒：</b>' + esc(g.awaken.type) + '：' + esc(g.awaken.sin) + '<br>' + esc(g.awaken.text).replace(/\n/g, '<br>') + '</p>' +
        '<p><b>侵蝕：</b>' + esc(g.corrosion.type) + '：' + esc(g.corrosion.sin) + '<br>' + esc(g.corrosion.text).replace(/\n/g, '<br>') + '</p></details>';
    }
    var own = (S.owned.egos || []).filter(function (e) {
      return e.name === name && e.detail;
    })[0];
    if (own) {
      return '<details class="detail"><summary>' + esc(name) + '（所持E.G.Oのメモ）</summary><p>' + esc(own.detail).replace(/\n/g, '<br>') + '</p></details>';
    }
    return '';
  }

  function spiritHint() {
    var s = D.spirits.filter(function (x) {
      return x.name === S.spirit;
    })[0];
    return s ? '士気低下：' + s.morale + ' ／ 混乱：' + s.panic : '';
  }

  function sectionNav() {
    var items = [
      ['basic', '基本'], ['status', '人格'], ['passive', 'パッシブ'], ['support', 'サポート'], ['tactics', '戦術'],
      ['items', 'アイテム'], ['ego', 'E.G.O'], ['owned', '所持'], ['ct', 'CT'], ['scenario', 'シナリオ'], ['memo', 'メモ']
    ];
    return '<nav class="jump">' + items.map(function (i) {
      return '<a href="#" data-jump="sec-' + i[0] + '">' + i[1] + '</a>';
    }).join('') + '</nav>';
  }

  function basicHTML() {
    return '<section class="card" id="sec-basic"><h2>基本</h2><div class="grid">' +
      F('PC名', 'name') + F('PL名', 'player') +
      F('所属（人格の所属ではありません）', 'affiliation', { list: 'dl-affil', ph: '囚人 / フィクサー など' }) +
      F('年齢', 'profile.age') + F('性別', 'profile.gender') +
      T('経歴・目的', 'profile.background', 3) +
      T('外見的特徴', 'profile.appearance', 2) +
      '</div></section>';
  }

  function statusHTML() {
    var e = S.equipped;
    return '<section class="card" id="sec-status"><h2>装備人格・ステータス</h2><div class="grid">' +
      F('装備する人格', 'equipped.name', { list: 'dl-persona', fill: 'persona', cls: 'wide', ph: '名前を入力すると候補が出ます' }) +
      F('人格の所属', 'equipped.affiliation') +
      F('HP（基礎値）', 'equipped.hp', { type: 'number' }) +
      F('SAN（基礎値）', 'equipped.san', { type: 'number' }) +
      F('速度', 'equipped.speed', { ph: '2d3' }) +
      F('斬撃', 'equipped.resist.slash', { list: 'dl-resist' }) +
      F('貫通', 'equipped.resist.pierce', { list: 'dl-resist' }) +
      F('打撃', 'equipped.resist.blunt', { list: 'dl-resist' }) +
      F('保有弾丸数', 'equipped.bullets', { type: 'number' }) +
      F('精神', 'spirit', { list: 'dl-spirit', fill: 'spirit' }) +
      '</div><p class="hint" id="spirit-hint">' + esc(spiritHint()) + '</p>' +
      '<p class="derived" id="derived"></p>' +
      (e.notes !== undefined ? T('固有の効果・メモ', 'equipped.notes', 3) : '') +
      '</section>';
  }

  function passiveHTML() {
    return '<section class="card" id="sec-passive"><h2>パッシブ</h2><div class="grid">' +
      F('名称', 'equipped.passive.name') + F('発動条件', 'equipped.passive.cond') +
      T('効果', 'equipped.passive.effect', 2) +
      '</div></section>';
  }

  function supportHTML() {
    var slots = hasSpecial(S, 'supslot') ? 3 : 2;
    var h = '<section class="card" id="sec-support"><h2>サポートパッシブ <small>装備枠 ' + slots + '</small></h2>';
    for (var i = 0; i < slots; i++) {
      h += '<div class="sub"><div class="grid">' +
        F('名称', 'support.' + i + '.name', { list: 'dl-support', fill: 'support', idx: i }) +
        F('発動条件', 'support.' + i + '.cond') +
        T('効果', 'support.' + i + '.effect', 2) +
        '</div></div>';
    }
    return h + '</section>';
  }

  function tacticsHTML() {
    var h = '<section class="card" id="sec-tactics"><h2>戦術</h2>';
    for (var i = 0; i < 5; i++) {
      var p = 'equipped.tactics.' + i;
      h += '<div class="sub"><h3>戦術 ' + i + '</h3><div class="grid">' +
        F('戦術名', p + '.name') +
        F('属性', p + '.type', { list: 'dl-type' }) +
        SEL('罪', p + '.sin', sinOptions(), { blank: true }) +
        T('ダイス・効果（1行に1つ）', p + '.text', 5) +
        '</div></div>';
    }
    return h + '</section>';
  }

  function itemsHTML() {
    var h = '<section class="card" id="sec-items"><h2>アイテム</h2>';
    S.items.forEach(function (it, i) {
      h += '<div class="row">' +
        F('名称', 'items.' + i + '.name', { list: 'dl-item', cls: 'grow' }) +
        F('個数', 'items.' + i + '.count', { type: 'number', cls: 'narrow' }) +
        '<button type="button" class="btn small danger" data-action="del-item" data-idx="' + i + '">削除</button></div>';
    });
    return h + '<button type="button" class="btn" data-action="add-item">アイテムを追加</button></section>';
  }

  function egoHTML() {
    var h = '<section class="card" id="sec-ego"><h2>装備E.G.O</h2>';
    EGO_RANKS.forEach(function (r) {
      h += '<div class="sub">' + F(r, 'ego.' + r, { list: 'dl-ego-' + r, fill: 'ego', idx: r }) +
        '<div id="ego-detail-' + r + '">' + egoDetailHTML(r) + '</div></div>';
    });
    return h + '</section>';
  }

  function ownedPersonaRow(o, i) {
    var p = 'owned.personalities.' + i;
    var fams = familiesFor(o.kind || 'normal');
    var h = '<div class="sub"><div class="grid">' +
      F('人格名', p + '.name', { list: 'dl-persona-all', cls: 'wide' }) +
      SEL('種別', p + '.kind', Object.keys(KINDS).map(function (k) {
        return [k, KINDS[k]];
      }), { rerender: true, def: 'normal' }) +
      '</div><details class="detail"><summary>身体強化 <span data-bonus="' + i + '"></span></summary><div class="grid">';
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

  function ownedHTML() {
    var h = '<section class="card" id="sec-owned"><h2>所持品</h2>' +
      '<div class="grid">' + F('LP', 'currency.lp', { type: 'number' }) + F('自我の欠片', 'currency.shards', { type: 'number' }) + '</div>';
    h += '<h3>所持人格</h3>';
    S.owned.personalities.forEach(function (o, i) {
      h += ownedPersonaRow(o, i);
    });
    h += '<button type="button" class="btn" data-action="add-owned-p">人格を追加</button>';

    h += '<h3>所持E.G.O</h3>';
    S.owned.egos.forEach(function (o, i) {
      var p = 'owned.egos.' + i;
      h += '<div class="sub"><div class="grid">' +
        F('E.G.O名', p + '.name', { list: 'dl-ego-all', cls: 'wide' }) +
        SEL('危険度', p + '.rank', EGO_RANKS, { blank: true }) +
        T('内容（解析E.G.Oなど自作のとき）', p + '.detail', 3) +
        '</div><div class="actions"><button type="button" class="btn small danger" data-action="del-owned-e" data-idx="' + i + '">削除</button></div></div>';
    });
    h += '<button type="button" class="btn" data-action="add-owned-e">E.G.Oを追加</button>';

    h += '<h3>所持サポートパッシブ</h3>';
    S.owned.support.forEach(function (o, i) {
      h += '<div class="row">' + F('名称', 'owned.support.' + i + '.name', { list: 'dl-support', cls: 'grow' }) +
        '<button type="button" class="btn small danger" data-action="del-owned-sp" data-idx="' + i + '">削除</button></div>';
    });
    h += '<button type="button" class="btn" data-action="add-owned-sp">サポートパッシブを追加</button>';

    h += '<h3>所持精神</h3>';
    S.owned.spirits.forEach(function (o, i) {
      h += '<div class="row">' + F('名称', 'owned.spirits.' + i + '.name', { list: 'dl-spirit', cls: 'grow' }) +
        '<button type="button" class="btn small danger" data-action="del-owned-s" data-idx="' + i + '">削除</button></div>';
    });
    return h + '<button type="button" class="btn" data-action="add-owned-s">精神を追加</button></section>';
  }

  function ctHTML() {
    var h = '<section class="card" id="sec-ct"><h2>クールタイム（特異人格・同期化人格）</h2>' +
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
    var h = '<section class="card" id="sec-scenario"><h2>通過したシナリオ</h2>';
    S.scenarios.forEach(function (sc, i) {
      var p = 'scenarios.' + i;
      h += '<div class="sub"><div class="grid">' +
        F('日付', p + '.date', { type: 'date' }) + F('シナリオ名', p + '.title') + F('GM / KP', p + '.gm') +
        T('メモ（結果・取得物・印象など）', p + '.memo', 3) +
        '</div><div class="actions"><button type="button" class="btn small danger" data-action="del-scenario" data-idx="' + i + '">削除</button></div></div>';
    });
    if (!S.scenarios.length) {
      h += '<p class="empty">まだ記録がありません。</p>';
    }
    return h + '<button type="button" class="btn" data-action="add-scenario">シナリオを追加</button></section>';
  }

  function memoHTML() {
    return '<section class="card" id="sec-memo"><h2>メモ</h2><div class="grid">' + T('自由メモ', 'memo', 5) + '</div></section>';
  }

  function toolbarHTML() {
    return '<div class="toolbar"><a class="btn" href="#/">← 一覧</a>' +
      '<button type="button" class="btn" data-action="share">共有URL</button>' +
      '<button type="button" class="btn" data-action="ccfolia">ココフォリア用コマ</button>' +
      '<button type="button" class="btn" data-action="export-one">JSON書き出し</button>' +
      (RO ? '' : '<span class="saved">自動保存</span>') + '</div>';
  }

  function renderEditor() {
    var y = window.scrollY;
    app.innerHTML = toolbarHTML() +
      (RO ? '<div class="banner"><p>共有されたキャラシートです（閲覧専用）。</p><button type="button" class="btn primary" data-action="save-shared">自分用にコピーして保存</button></div>' : '') +
      sectionNav() +
      '<fieldset class="sheet"' + (RO ? ' disabled' : '') + '>' +
      basicHTML() + statusHTML() + passiveHTML() + supportHTML() + tacticsHTML() + itemsHTML() + egoHTML() +
      ownedHTML() + ctHTML() + scenarioHTML() + memoHTML() +
      '</fieldset>' + datalistsHTML();
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
        '<p class="hint">データはこのブラウザに保存されます。別の端末へ移すときは「JSON書き出し」を使い、他の人に見せるときは各キャラの「共有URL」を使います。</p></div>';
    }
    h += '<ul class="char-list">';
    ids.forEach(function (id) {
      var s = store.sheets[id];
      h += '<li class="card"><a class="char-main" href="#/edit/' + esc(id) + '"><strong>' + esc(s.name || '名無しのキャラ') + '</strong>' +
        '<span>' + esc([s.affiliation, s.player && 'PL：' + s.player, s.equipped && s.equipped.name].filter(Boolean).join(' ／ ')) + '</span></a>' +
        '<div class="actions"><button type="button" class="btn small" data-action="dup" data-id="' + esc(id) + '">複製</button>' +
        '<button type="button" class="btn small danger" data-action="del" data-id="' + esc(id) + '">削除</button></div></li>';
    });
    app.innerHTML = h + '</ul>';
    S = null;
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
      S = merge(newSheet(), s);
      S.id = m[1];
      store.sheets[S.id] = S;
      document.title = (S.name || 'キャラシート') + ' - リンバスTRPG';
      renderEditor();
      window.scrollTo(0, 0);
    } else if ((m = h.match(/^\/s\/(.+)$/))) {
      decodeSheet(m[1]).then(function (s) {
        S = s;
        RO = true;
        document.title = (S.name || '共有キャラシート') + '（閲覧）- リンバスTRPG';
        renderEditor();
        window.scrollTo(0, 0);
      }, function (err) {
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
      S.equipped = merge(emptyEquipped(), clone(o.snapshot));
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
          e.tactics[i] = clone(t);
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
    var memo = ['所属：' + (sheet.affiliation || ''), '人格：' + (e.name || '')];
    if (e.passive.name) {
      memo.push('【パッシブ】' + e.passive.name + '（' + e.passive.cond + '）' + e.passive.effect);
    }
    sheet.support.forEach(function (s) {
      if (s.name) {
        memo.push('【サポート】' + s.name + '（' + s.cond + '）' + s.effect);
      }
    });
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
        name: sheet.name || '名無し',
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
      var m = merge(newSheet(), s);
      m.id = uid();
      store.sheets[m.id] = m;
    });
    saveStore();
    toast(list.length + '件を読み込みました');
    route();
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
      c.name = (c.name || '名無しのキャラ') + '（コピー）';
      c.updatedAt = Date.now();
      store.sheets[c.id] = c;
      saveStore();
      renderList();
    },
    'del': function (el) {
      var s = store.sheets[el.dataset.id];
      if (window.confirm('「' + (s.name || '名無しのキャラ') + '」を削除します。元に戻せません。よろしいですか?')) {
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
      encodeSheet(S).then(function (payload) {
        var url = location.href.split('#')[0] + '#/s/' + payload;
        copyText(url, '共有URL（' + url.length + '文字）');
        if (url.length > 1800) {
          toast('URLが長めです。チャットに貼ると途中で切れる場合があります');
        }
      });
    },
    'ccfolia': function () {
      copyText(JSON.stringify(ccfoliaData(S)), 'ココフォリア用コマ');
    },
    'save-shared': function () {
      var c = clone(S);
      c.id = uid();
      c.updatedAt = Date.now();
      store.sheets[c.id] = c;
      saveStore();
      location.hash = '#/edit/' + c.id;
    },
    'add-item': function () {
      S.items.push({ name: '', count: '1' });
      rerender();
    },
    'del-item': function (el) {
      S.items.splice(Number(el.dataset.idx), 1);
      rerender();
    },
    'add-scenario': function () {
      S.scenarios.push({ date: '', title: '', gm: '', memo: '' });
      rerender();
    },
    'del-scenario': function (el) {
      S.scenarios.splice(Number(el.dataset.idx), 1);
      rerender();
    },
    'add-owned-p': function () {
      S.owned.personalities.push({ name: '', kind: 'normal' });
      rerender();
    },
    'del-owned-p': function (el) {
      S.owned.personalities.splice(Number(el.dataset.idx), 1);
      rerender();
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
      S.owned.egos.splice(Number(el.dataset.idx), 1);
      rerender();
    },
    'add-owned-sp': function () {
      S.owned.support.push({ name: '' });
      rerender();
    },
    'del-owned-sp': function (el) {
      S.owned.support.splice(Number(el.dataset.idx), 1);
      rerender();
    },
    'add-owned-s': function () {
      S.owned.spirits.push({ name: '' });
      rerender();
    },
    'del-owned-s': function (el) {
      S.owned.spirits.splice(Number(el.dataset.idx), 1);
      rerender();
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
    renderEditor();
  }

  function handleFill(el) {
    var kind = el.dataset.fill;
    var v = el.value;
    if (kind === 'persona') {
      equipPersona(v);
      rerender();
    } else if (kind === 'support') {
      var sp = D.supportPassives.filter(function (x) {
        return x.name === v;
      })[0];
      if (sp) {
        S.support[Number(el.dataset.idx)] = { name: sp.name, cond: sp.cond, effect: sp.effect };
        rerender();
      }
    } else if (kind === 'ego') {
      var box = document.getElementById('ego-detail-' + el.dataset.idx);
      if (box) {
        box.innerHTML = egoDetailHTML(el.dataset.idx);
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
    var jump = ev.target.closest && ev.target.closest('[data-jump]');
    if (jump) {
      ev.preventDefault();
      var sec = document.getElementById(jump.dataset.jump);
      if (sec) {
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
    var el = ev.target.closest && ev.target.closest('[data-action]');
    if (el && actions[el.dataset.action]) {
      actions[el.dataset.action](el);
    }
  });

  window.addEventListener('hashchange', route);
  route();
})();
