'use strict';
/* =========================================================
   Кеј Резиденс — демо
   1) ПОДАТОЦИ   – катови, станови, распореди (менувај тука)
   2) ЗГРАДА     – SVG сцена + катови што светнуваат
   3) ПЛАН       – 2D/3D план на стан (CSS 3D)
   4) ПРОШЕТКА   – 3D соба низ која се движиш
   5) НАВИГАЦИЈА – премини меѓу екраните
   ========================================================= */

/* ===================== 1. ПОДАТОЦИ ===================== */

const PROJECT = { floors: 11, pricePerM2: 1350, floorPremium: 25 };

// Распореди на станови. Мерките се во метри (x, y = горен лев агол).
// Ако сакаш вистински/AI слики за собите, додади image: 'img/spalna.jpg' на собата.
const LAYOUTS = {
  A: {
    label: 'Едносoбен стан', bedrooms: 1, facing: 'Југ', w: 10, h: 6,
    rooms: [
      { id: 'living',  name: 'Дневна и кујна', scene: 'living',  x: 4,   y: 0,   w: 6,   h: 6 },
      { id: 'bedroom', name: 'Спална',         scene: 'bedroom', x: 0,   y: 0,   w: 4,   h: 3.6 },
      { id: 'bath',    name: 'Бања',           scene: 'bath',    x: 0,   y: 3.6, w: 2.2, h: 2.4 },
      { id: 'hall',    name: 'Ходник',         scene: 'hall',    x: 2.2, y: 3.6, w: 1.8, h: 2.4 },
    ],
  },
  B: {
    label: 'Двособен стан', bedrooms: 2, facing: 'Југозапад', w: 12, h: 6,
    rooms: [
      { id: 'living',   name: 'Дневна и кујна', scene: 'living',  x: 5,   y: 0,   w: 7,   h: 6 },
      { id: 'bedroom',  name: 'Главна спална',  scene: 'bedroom', x: 0,   y: 0,   w: 3.4, h: 3.2 },
      { id: 'bedroom2', name: 'Детска соба',    scene: 'bedroom', x: 0,   y: 3.2, w: 3.4, h: 2.8 },
      { id: 'bath',     name: 'Бања',           scene: 'bath',    x: 3.4, y: 0,   w: 1.6, h: 2.0 },
      { id: 'hall',     name: 'Ходник',         scene: 'hall',    x: 3.4, y: 2.0, w: 1.6, h: 4.0 },
    ],
  },
  C: {
    label: 'Студио', bedrooms: 0, facing: 'Исток', w: 7.6, h: 5,
    rooms: [
      { id: 'living', name: 'Студио', scene: 'studio', x: 0,   y: 0,   w: 5.4, h: 5 },
      { id: 'bath',   name: 'Бања',   scene: 'bath',   x: 5.4, y: 0,   w: 2.2, h: 2.4 },
      { id: 'hall',   name: 'Ходник', scene: 'hall',   x: 5.4, y: 2.4, w: 2.2, h: 2.6 },
    ],
  },
};

// AI фотографии за собите (по тип на соба) и каде стојат копчињата за соседните соби
// (spots = [x, y] во проценти од сликата). Избриши ред и собата се враќа на 3D цртежот.
const ROOM_PHOTOS = {
  living:  { src: 'img/living.jpg',  spots: [[0.85, 0.55], [0.12, 0.40], [0.50, 0.24]] },
  bedroom: { src: 'img/bedroom.jpg', spots: [[0.85, 0.42], [0.12, 0.45]] },
  kids:    { src: 'img/kids.jpg',    spots: [[0.85, 0.42], [0.12, 0.40]] },
  bath:    { src: 'img/bath.jpg',    spots: [[0.85, 0.50], [0.12, 0.45]] },
  hall:    { src: 'img/hall.jpg',    spots: [[0.12, 0.48], [0.78, 0.40], [0.62, 0.24], [0.36, 0.24]] },
  studio:  { src: 'img/studio.jpg',  spots: [[0.86, 0.50], [0.30, 0.30]] },
};
for (const L of Object.values(LAYOUTS)) {
  for (const r of L.rooms) {
    const key = r.id === 'bedroom2' ? 'kids' : r.scene;
    if (ROOM_PHOTOS[key]) r.photo = ROOM_PHOTOS[key];
  }
}

const STATUS = {
  available: { label: 'Слободен',   color: '#7fd1a8' },
  reserved:  { label: 'Резервиран', color: '#f2c46d' },
  sold:      { label: 'Продаден',   color: '#8a8f9a' },
};

// Детерминистички „случаен“ број (секогаш ист резултат за ист seed)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const APTS = [];
for (let f = 1; f <= PROJECT.floors; f++) {
  for (const t of ['B', 'A', 'C']) {
    const L = LAYOUTS[t];
    const area = +(L.w * L.h).toFixed(1);
    const price = Math.round(area * (PROJECT.pricePerM2 + f * PROJECT.floorPremium) / 100) * 100;
    const r = mulberry32(f * 131 + t.charCodeAt(0) * 17)();
    const status = r < 0.28 ? 'sold' : r < 0.42 ? 'reserved' : 'available';
    APTS.push({ id: f + t, floor: f, type: t, layout: L, area, price, status });
  }
}
// Врати ги вратите и ѕидовите за секој распоред еднаш
for (const L of Object.values(LAYOUTS)) {
  L.doors = computeDoors(L);
  L.windows = computeWindows(L);
  L.walls = computeWalls(L, [...L.doors, ...L.windows]);
}

/* ---------- помошни функции ---------- */
const $ = (q, r = document) => r.querySelector(q);
const $$ = (q, r = document) => [...r.querySelectorAll(q)];
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
const ICON = {
  arrowR: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
  arrowL: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8H3M7 4 3 8l4 4"/></svg>',
  close:  '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  plan:   '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 2.5h11v11h-11zM8 2.5v6h5.5M8 11v2.5M2.5 8H5"/></svg>',
  check:  '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5"/></svg>',
};
const euro = n => n.toLocaleString('de-DE') + ' €';
// Hover ефекти само за глувче — на телефон допирот веднаш отвора (без „двоен допир“ на iPhone)
const mouseOnly = fn => e => { if (e.pointerType === 'mouse') fn(e); };
const isPhone = () => matchMedia('(max-width: 860px) and (orientation: portrait)').matches;
const aptsOnFloor = f => APTS.filter(a => a.floor === f);
const roomArea = r => +(r.w * r.h).toFixed(1);
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- геометрија: врати, прозорци, ѕидови ---------- */
function sharedEdge(a, b) {
  const eps = 1e-6;
  for (const [p, q] of [[a, b], [b, a]]) {
    if (Math.abs(p.x + p.w - q.x) < eps) {
      const from = Math.max(p.y, q.y), to = Math.min(p.y + p.h, q.y + q.h);
      if (to - from > eps) return { o: 'v', c: q.x, from, to };
    }
    if (Math.abs(p.y + p.h - q.y) < eps) {
      const from = Math.max(p.x, q.x), to = Math.min(p.x + p.w, q.x + q.w);
      if (to - from > eps) return { o: 'h', c: q.y, from, to };
    }
  }
  return null;
}
function computeDoors(L) {
  const doors = [], R = L.rooms;
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const a = R[i], b = R[j];
    const viaHall = a.scene === 'hall' || b.scene === 'hall';
    const viaLiving = (a.id === 'living' || b.id === 'living') && a.scene !== 'bath' && b.scene !== 'bath';
    if (!viaHall && !viaLiving) continue;
    const e = sharedEdge(a, b);
    if (e && e.to - e.from >= 1.0) doors.push({ ...e, a: a.id, b: b.id, mid: (e.from + e.to) / 2, half: 0.42 });
  }
  return doors;
}
function computeWindows(L) {
  // Прозорец на надворешниот (горен) ѕид за секоја соба освен бања/ходник
  return L.rooms
    .filter(r => r.y === 0 && r.scene !== 'bath' && r.scene !== 'hall')
    .map(r => ({ o: 'h', c: 0, mid: r.x + r.w / 2, half: Math.min(0.9, r.w / 2 - 0.4), window: true }));
}
function computeWalls(L, gapsAll) {
  const map = new Map();
  const add = (o, c, a, b) => {
    const k = o + '|' + c.toFixed(3);
    if (!map.has(k)) map.set(k, { o, c, iv: [] });
    map.get(k).iv.push([a, b]);
  };
  for (const r of L.rooms) {
    add('h', r.y, r.x, r.x + r.w); add('h', r.y + r.h, r.x, r.x + r.w);
    add('v', r.x, r.y, r.y + r.h); add('v', r.x + r.w, r.y, r.y + r.h);
  }
  const segs = [];
  for (const { o, c, iv } of map.values()) {
    iv.sort((p, q) => p[0] - q[0]);
    const merged = [];
    for (const [a, b] of iv) {
      const last = merged[merged.length - 1];
      if (last && a <= last[1] + 1e-6) last[1] = Math.max(last[1], b);
      else merged.push([a, b]);
    }
    const gaps = gapsAll.filter(g => g.o === o && Math.abs(g.c - c) < 1e-6).map(g => [g.mid - g.half, g.mid + g.half]);
    for (const [a, b] of merged) {
      const cuts = gaps.filter(g => g[0] < b && g[1] > a).sort((p, q) => p[0] - q[0]);
      let s = a;
      for (const g of cuts) { if (g[0] > s) segs.push({ o, c, a: s, b: g[0] }); s = Math.max(s, g[1]); }
      if (b > s + 1e-6) segs.push({ o, c, a: s, b });
    }
  }
  return segs;
}
function neighbors(L, roomId) {
  return L.doors
    .filter(d => d.a === roomId || d.b === roomId)
    .map(d => L.rooms.find(r => r.id === (d.a === roomId ? d.b : d.a)));
}

/* ===================== 2. ЗГРАДА (фотографија + катови) ===================== */

const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

// Фотографијата на зградата и каде се катовите на неа (во пиксели од сликата).
// Ако ја смениш сликата, измери ги овие вредности одново (на пр. во Photoshop или Figma).
const HERO = {
  src: 'img/building.jpg', w: 2048, h: 1152,
  focusX: 612,                                   // центар на зградата (за тесни екрани)
  // Регион што мора да остане видлив на телефон (цела зграда, од покрив до приземје)
  frame: { x0: 300, y0: 120, x1: 925, y1: 1135 },
  // Трите вертикални рабови: лев, агол, десен. Во перспектива се малку закосени,
  // затоа имаат x горе (x0 на висина y0) и x долу (x1 на висина y1).
  edges: [
    { x0: 347, y0: 207, x1: 356, y1: 1048 },
    { x0: 600, y0: 172, x1: 605, y1: 1100 },
    { x0: 875, y0: 218, x1: 872, y1: 1045 },
  ],
  // Нивоа на подовите, измерени од дното на балконите на фотографијата.
  // levels[0] = подот на 1. кат, levels[11] = врвот на 11. кат.
  // Секое ниво има три y-вредности: лев раб, агол, десен раб.
  levels: [
    [962, 1057, 957], [904, 983, 894], [840, 909, 831], [774, 835, 769],
    [708, 759, 708],  [643, 684, 647], [576, 610, 587], [512, 533, 523],
    [447, 459, 459],  [380, 385, 398], [317, 310, 337], [254, 235, 276],
  ],
};
const lerp = (a, b, t) => a + (b - a) * t;
const edgeX = (i, y) => { const e = HERO.edges[i]; return lerp(e.x0, e.x1, (y - e.y0) / (e.y1 - e.y0)); };
// Линијата под кат f (1 = најдолен) — три y-вредности: лево, агол, десно
const floorLine = f => HERO.levels[Math.max(0, Math.min(HERO.levels.length - 1, f - 1))];
// Контура на кат што ја следи зградата околу аголот: [горе-лево, горе-агол, горе-десно, долу-десно, долу-агол, долу-лево]
function floorOutline(f) {
  const b = floorLine(f), t = floorLine(f + 1);
  return [[edgeX(0, t[0]), t[0]], [edgeX(1, t[1]), t[1]], [edgeX(2, t[2]), t[2]],
          [edgeX(2, b[2]), b[2]], [edgeX(1, b[1]), b[1]], [edgeX(0, b[0]), b[0]]];
}
const pts = arr => arr.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

function buildHero() {
  const svg = $('#scene');
  svg.setAttribute('viewBox', `0 0 ${HERO.w} ${HERO.h}`);
  svg.innerHTML = `
  <defs>
    <!-- светло на левата и десната фасада (левата е посветла кон аголот) -->
    <linearGradient id="fx-g-left" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffe3b3" stop-opacity=".10"/>
      <stop offset="1" stop-color="#ffd596" stop-opacity=".42"/>
    </linearGradient>
    <linearGradient id="fx-g-right" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffcf8a" stop-opacity=".34"/>
      <stop offset="1" stop-color="#ffcf8a" stop-opacity=".12"/>
    </linearGradient>
    <linearGradient id="fx-g-sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".5" stop-color="#fff" stop-opacity=".55"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="fx-glow" x="-10%" y="-60%" width="120%" height="220%">
      <feGaussianBlur stdDeviation="9" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <!-- „рефлектор“: сè се затемнува освен избраниот кат -->
    <mask id="fx-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${HERO.w}" height="${HERO.h}">
      <rect width="${HERO.w}" height="${HERO.h}" fill="#fff"/>
      <polygon id="fx-hole" fill="#000"/>
    </mask>
    <clipPath id="fx-clip"><polygon id="fx-clip-poly"/></clipPath>
  </defs>`;

  const kb = s('g', { class: 'kenburns' }, svg);
  s('image', { href: HERO.src, width: HERO.w, height: HERO.h, preserveAspectRatio: 'xMidYMid slice' }, kb);
  s('rect', { class: 'fx-dim', width: HERO.w, height: HERO.h, mask: 'url(#fx-mask)' }, kb);

  const fx = s('g', { id: 'fx', class: 'fx' }, kb);
  s('polygon', { id: 'fx-left', fill: 'url(#fx-g-left)' }, fx);
  s('polygon', { id: 'fx-right', fill: 'url(#fx-g-right)' }, fx);
  const sheenG = s('g', { 'clip-path': 'url(#fx-clip)' }, fx);
  s('rect', { id: 'fx-sheen', x: HERO.edges[0].x0 - 280, y: 0, width: 240, height: HERO.h, fill: 'url(#fx-g-sheen)' }, sheenG);
  s('polygon', { id: 'fx-outline', class: 'fx-outline', filter: 'url(#fx-glow)' }, fx);
  s('line', { id: 'fx-corner', class: 'fx-corner' }, fx);
  s('circle', { id: 'fx-dot', class: 'fx-dot', r: 7 }, fx);

  // Невидливи полигони за секој кат (hover + клик + тастатура)
  const hits = s('g', {}, kb);
  for (let f = 1; f <= PROJECT.floors; f++) {
    const poly = s('polygon', {
      points: pts(floorOutline(f)), class: 'floor-hit', tabindex: 0, role: 'button',
      'aria-label': `${f}. кат`, 'data-floor': f,
    }, hits);
    poly.addEventListener('pointerenter', mouseOnly(() => hoverFloor(f)));
    poly.addEventListener('pointerleave', mouseOnly(() => hoverFloor(0)));
    poly.addEventListener('focus', () => hoverFloor(f));
    poly.addEventListener('blur', () => hoverFloor(0));
    poly.addEventListener('click', () => openFloor(f));
    poly.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFloor(f); } });
  }

  // Листа со катови покрај зградата
  const rail = $('#floor-rail');
  rail.innerHTML = '<div class="rail-title">Кат</div>' + Array.from({ length: PROJECT.floors }, (_, i) => PROJECT.floors - i).map(f => {
    const apts = aptsOnFloor(f);
    const free = apts.filter(a => a.status === 'available').length;
    return `<button data-floor="${f}" style="--o:${f}" class="${free ? '' : 'full'}" aria-label="${f}. кат, ${free} слободни">
      <span class="n">${f}</span><span class="d">${apts.map(a => `<i class="dot ${a.status}"></i>`).join('')}</span></button>`;
  }).join('');
  $$('button', rail).forEach(b => {
    const f = +b.dataset.floor;
    b.addEventListener('pointerenter', mouseOnly(() => hoverFloor(f)));
    b.addEventListener('pointerleave', mouseOnly(() => hoverFloor(0)));
    b.addEventListener('click', () => openFloor(f));
  });

  fitHero();

  // Статистика
  const avail = APTS.filter(a => a.status === 'available');
  $('#stats').innerHTML = `
    <div><b>${PROJECT.floors}</b><span>ката</span></div>
    <div><b>${avail.length}</b><span>слободни станови</span></div>
    <div><b>${euro(Math.min(...avail.map(a => a.price)))}</b><span>почетна цена</span></div>`;
}

// На тесни (портрет) екрани ја сечеме сликата така што зградата останува во средина
function fitHero() {
  const svg = $('#scene');
  const vw = svg.clientWidth || innerWidth, vh = svg.clientHeight || innerHeight;
  if (!vw || !vh) return;                        // скриен прозорец: нема што да се пресмета
  const aspect = vw / vh, imgAspect = HERO.w / HERO.h;
  // На телефон целата зграда (HERO.frame) мора да се гледа, од покривот до приземјето
  if (isPhone()) {
    const F = HERO.frame, fw = F.x1 - F.x0, fh = F.y1 - F.y0;
    let w, h;
    if (fw / fh > aspect) { w = fw; h = w / aspect; } else { h = fh; w = h * aspect; }
    w = Math.min(w, HERO.w); h = Math.min(h, HERO.h);
    const x0 = Math.max(0, Math.min(HERO.w - w, (F.x0 + F.x1) / 2 - w / 2));
    const y0 = Math.max(0, Math.min(HERO.h - h, (F.y0 + F.y1) / 2 - h / 2));
    svg.setAttribute('viewBox', `${x0.toFixed(0)} ${y0.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}`);
    return;
  }
  if (aspect >= imgAspect) { svg.setAttribute('viewBox', `0 0 ${HERO.w} ${HERO.h}`); return; }
  const w = HERO.h * aspect;
  const x0 = Math.max(0, Math.min(HERO.w - w, HERO.focusX - w / 2));
  svg.setAttribute('viewBox', `${x0.toFixed(0)} 0 ${w.toFixed(0)} ${HERO.h}`);
}

/* ---------- ефект на избран кат ---------- */
const fxState = { floor: 0, sel: 0, cur: null, raf: 0 };

// Ги поставува сите делови од ефектот според контурата o (6 точки)
function applyOutline(o) {
  const [tl, tc, tr, br, bc, bl] = o;
  $('#fx-left').setAttribute('points', pts([tl, tc, bc, bl]));
  $('#fx-right').setAttribute('points', pts([tc, tr, br, bc]));
  $('#fx-outline').setAttribute('points', pts(o));
  $('#fx-hole').setAttribute('points', pts(o));
  $('#fx-clip-poly').setAttribute('points', pts(o));
  const c = $('#fx-corner');
  c.setAttribute('x1', tc[0]); c.setAttribute('y1', tc[1]); c.setAttribute('x2', bc[0]); c.setAttribute('y2', bc[1]);
  const d = $('#fx-dot');
  d.setAttribute('cx', (tr[0] + br[0]) / 2); d.setAttribute('cy', (tr[1] + br[1]) / 2);
}

// Прикажи го ефектот на кат f (0 = исклучи). Помеѓу катови контурата мазно се лизга.
function setActiveFloor(f) {
  const svg = $('#scene'), fx = $('#fx');
  if (f === fxState.floor) return;
  const wasOff = !fxState.floor;
  fxState.floor = f;
  $$('#floor-rail button').forEach(b => b.classList.toggle('on', +b.dataset.floor === f));
  $('#view-building').classList.toggle('hovering', !!f);
  if (!f) { fx.classList.remove('on'); svg.classList.remove('spot'); hideTip(); return; }

  const target = floorOutline(f);
  cancelAnimationFrame(fxState.raf);
  if (wasOff || !fxState.cur) {
    fxState.cur = target;
    applyOutline(target);
    drawOutline();
    positionTip();
  } else {
    const from = fxState.cur.map(p => [...p]), t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 240), e = 1 - Math.pow(1 - k, 3);
      fxState.cur = from.map((p, i) => [lerp(p[0], target[i][0], e), lerp(p[1], target[i][1], e)]);
      applyOutline(fxState.cur);
      positionTip();
      if (k < 1) fxState.raf = requestAnimationFrame(step);
    };
    fxState.raf = requestAnimationFrame(step);
  }
  const sheen = $('#fx-sheen');
  sheen.classList.remove('run'); void sheen.getBBox(); sheen.classList.add('run');
  fx.classList.add('on'); svg.classList.add('spot');
}
// Линијата околу катот се „црта“ кога ефектот се појавува
function drawOutline() {
  const ol = $('#fx-outline');
  const len = ol.getTotalLength();
  ol.style.transition = 'none';
  ol.style.strokeDasharray = len; ol.style.strokeDashoffset = len;
  void ol.getBoundingClientRect();
  ol.style.transition = 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)';
  ol.style.strokeDashoffset = 0;
}

function hoverFloor(f) {
  // Кога е отворен панелот, без hover се враќаме на избраниот кат
  setActiveFloor(f || fxState.sel);
  if (f && f !== fxState.sel) showTip(f); else hideTip();
}
function selectFloor(f) {
  fxState.sel = f;
  setActiveFloor(f);
  hideTip();
}

function showTip(f) {
  const apts = aptsOnFloor(f);
  const free = apts.filter(a => a.status === 'available');
  const tip = $('#floor-tip');
  tip.innerHTML = `
    <div class="t-head">
      <div class="t-num">${f}</div>
      <div><div class="t-lbl">кат</div><div class="t-sub">${apts.length} стана · ${free.length} ${free.length === 1 ? 'слободен' : 'слободни'}</div></div>
    </div>
    <div class="t-units">${apts.map(a => `
      <div class="u ${a.status}"><b>${a.id}</b><span>${a.area} m²</span><em>${STATUS[a.status].label}</em></div>`).join('')}
    </div>
    <div class="t-foot">${free.length ? `<span>од <b>${euro(Math.min(...free.map(a => a.price)))}</b></span>` : '<span>Распродаден</span>'}<span class="go">Видете план ${ICON.arrowR}</span></div>`;
  tip.classList.add('show');
  positionTip();
}
// Картичката се „закачува“ десно од катот (или лево ако нема место)
function positionTip() {
  const tip = $('#floor-tip');
  if (!tip.classList.contains('show') || !fxState.floor) return;
  const r = $('#fx-outline').getBoundingClientRect();
  const d = $('#fx-dot').getBoundingClientRect();           // точка на десниот раб на катот
  const tw = tip.offsetWidth || 264, th = tip.offsetHeight || 200;
  let left = d.left + d.width / 2 + 34, flip = false;
  if (left + tw > innerWidth - 12) { left = r.left - 34 - tw; flip = true; }
  if (left < 12) { tip.classList.remove('show'); return; }   // нема место (тесен екран)
  const top = Math.max(12 + th / 2, Math.min(innerHeight - 12 - th / 2, d.top + d.height / 2));
  tip.classList.toggle('flip', flip);
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}
function hideTip() { $('#floor-tip').classList.remove('show'); }

/* ---------- страничен панел: кат / листа / за проектот ---------- */
function floorPlanSVG(f) {
  // Шема на катот: B | A | C, ходник и лифт долу
  const apts = Object.fromEntries(aptsOnFloor(f).map(a => [a.type, a]));
  const parts = [
    { a: apts.B, x: 0, w: 12, h: 6 },
    { a: apts.A, x: 12.4, w: 10, h: 6 },
    { a: apts.C, x: 22.8, w: 7.6, h: 5 },
  ];
  let g = `<rect x="0" y="6.3" width="30.4" height="1.6" rx=".2" fill="rgba(255,255,255,.08)"/>
           <rect x="13.5" y="8.1" width="3.4" height="1.8" rx=".2" fill="rgba(255,255,255,.12)"/>
           <text x="15.2" y="9.25" font-size=".55" text-anchor="middle" fill="rgba(255,255,255,.5)">ЛИФТ</text>`;
  for (const p of parts) {
    const st = STATUS[p.a.status];
    g += `<g class="unit ${p.a.status}" data-apt="${p.a.id}">
      <rect x="${p.x}" y="0" width="${p.w}" height="${p.h}" rx=".3" fill="${st.color}" fill-opacity="${p.a.status === 'sold' ? .25 : .55}" stroke="rgba(255,255,255,.3)" stroke-width=".06"/>
      <text x="${p.x + p.w / 2}" y="${p.h / 2 - .1}" font-size="1.4" text-anchor="middle" fill="#fff">${p.a.id}</text>
      <text x="${p.x + p.w / 2}" y="${p.h / 2 + 1.1}" font-size=".75" text-anchor="middle" fill="rgba(255,255,255,.8)">${p.a.area} m²</text>
    </g>`;
  }
  return `<svg class="floorplan" viewBox="-.3 -.3 31 10.6">${g}</svg>`;
}
function unitCard(a, showFloor) {
  return `<button class="unit-card" data-apt="${a.id}" ${a.status === 'sold' ? 'disabled' : ''}>
    <b>${a.id}</b>
    <span class="meta"><strong>${a.layout.label}</strong>${a.area} m²${showFloor ? ' · ' + a.floor + '. кат' : ''} · ${a.layout.facing}</span>
    <span class="price">${euro(a.price)}<span class="st ${a.status}">${STATUS[a.status].label}</span></span>
  </button>`;
}
function wireUnits(root) {
  $$('[data-apt]', root).forEach(n => {
    const id = n.dataset.apt;
    const a = APTS.find(x => x.id === id);
    n.addEventListener('click', () => {
      if (a.status === 'sold') return toast(`Станот ${id} е продаден.`);
      openApartment(id);
    });
    n.addEventListener('pointerenter', mouseOnly(() => $$(`[data-apt="${id}"]`, root).forEach(m => m.classList.add('hl'))));
    n.addEventListener('pointerleave', mouseOnly(() => $$(`[data-apt="${id}"]`, root).forEach(m => m.classList.remove('hl'))));
  });
}
function openDrawer(html) {
  const d = $('#drawer');
  d.innerHTML = `<button class="x" aria-label="Затвори">${ICON.close}</button>` + html;
  $('.x', d).onclick = closeDrawer;
  d.classList.add('open');
  $('#view-building').classList.add('drawer-open');
  wireUnits(d);
  return d;
}
function closeDrawer() {
  $('#drawer').classList.remove('open');
  $('#view-building').classList.remove('drawer-open');
  selectFloor(0);
  frameSelectedFloor();
}
// На телефон листот од дното го покрива долниот дел од зградата:
// ја поместуваме фотографијата нагоре за избраниот кат да остане видлив над листот.
function frameSelectedFloor() {
  const svg = $('#scene'), drawer = $('#drawer');
  if (!isPhone() || !fxState.sel || !drawer.classList.contains('open')) {
    svg.style.transform = ''; svg.dataset.shift = 0; return;
  }
  const r = $(`.floor-hit[data-floor="${fxState.sel}"]`).getBoundingClientRect();
  const center = (r.top + r.bottom) / 2 + (+svg.dataset.shift || 0);
  const visTop = $('.topbar').offsetHeight, visBottom = innerHeight - drawer.offsetHeight;
  const sceneBottom = svg.getBoundingClientRect().bottom + (+svg.dataset.shift || 0); // фотографијата мора да стигне до листот
  const shift = Math.max(0, Math.min(center - (visTop + visBottom) / 2, sceneBottom - visBottom));
  svg.dataset.shift = shift;
  svg.style.transform = `translateY(${-shift.toFixed(0)}px)`;
}
function openFloor(f) {
  selectFloor(f);
  const apts = aptsOnFloor(f);
  const free = apts.filter(a => a.status === 'available').length;
  openDrawer(`
    <h2>${f}. кат</h2>
    <div class="muted">${apts.length} стана · ${free} слободни · поглед кон реката</div>
    ${floorPlanSVG(f)}
    <div class="units">${apts.map(a => unitCard(a, false)).join('')}</div>`);
  requestAnimationFrame(frameSelectedFloor);
}
function openList(filter = 'all') {
  selectFloor(0);
  const list = APTS.filter(a => a.status !== 'sold' && (filter === 'all' || a.type === filter)).sort((a, b) => a.price - b.price);
  const chip = (v, t) => `<button data-filter="${v}" class="${filter === v ? 'on' : ''}">${t}</button>`;
  const d = openDrawer(`
    <h2>Достапни станови</h2>
    <div class="muted">${list.length} ${list.length === 1 ? 'стан' : 'станови'} · подредени по цена</div>
    <div class="chips">${chip('all', 'Сите')}${chip('C', 'Студио')}${chip('A', 'Едносoбен')}${chip('B', 'Двособен')}</div>
    <div class="units">${list.map(a => unitCard(a, true)).join('')}</div>`);
  $$('[data-filter]', d).forEach(b => b.onclick = () => openList(b.dataset.filter));
}
function openAbout() {
  selectFloor(0);
  openDrawer(`
    <h2>Кеј Резиденс</h2>
    <div class="muted">Станбена зграда покрај реката</div>
    <p class="body">Станбена зграда со ${PROJECT.floors} ката на самиот кеј, со поглед кон реката и планините.
      Секој стан има балкон, подно греење и паркинг место во подземната гаража.</p>
    <p class="body">Ова е <b>демо</b> проект: фотографиите на зградата и собите се генерирани со AI,
      а 3D плановите на становите се изработени со CSS.</p>
    <div class="kpis">
      <div><b>${PROJECT.floors}</b><span>ката</span></div>
      <div><b>${APTS.length}</b><span>станови</span></div>
      <div><b>38–72</b><span>m² површина</span></div>
      <div><b>2027</b><span>вселување</span></div>
    </div>`);
}

/* ===================== 3. ПЛАН (2D ↔ 3D) ===================== */

const WALL_H = 1.3;   // висина на ѕидовите во пресекот (m)
const WALL_T = 0.14;  // дебелина на ѕид (m)
const COL = {
  wood: '#c8996a', woodL: '#e2c9a6', sage: '#b4c39f', white: '#f8f6f2', sofa: '#d9cfc1',
  dark: '#4a4541', green: '#6f9058', rug: '#ece1cf', glass: 'rgba(160,205,228,.45)',
};

// Мебел во планот, во метри релативно на собата
function furnishPlan(r) {
  const w = r.w, h = r.h, I = [];
  const add = (x, y, fw, fd, fh, c, z0 = 0, cls = '') => I.push({ x, y, w: fw, d: fd, h: fh, c, z0, cls });
  switch (r.scene) {
    case 'bedroom': {
      const bx = w / 2 - 0.9;
      add(bx - 0.3, 0.9, 2.4, 1.5, 0.01, COL.rug);
      add(bx, 0.18, 1.8, 0.08, 0.95, COL.wood);
      add(bx, 0.26, 1.8, 2.0, 0.3, COL.woodL);
      add(bx + 0.05, 0.3, 1.7, 1.9, 0.18, COL.white, 0.3);
      add(bx + 0.02, 0.95, 1.76, 1.25, 0.04, COL.sage, 0.48);
      add(bx + 0.12, 0.36, 0.7, 0.35, 0.12, COL.white, 0.48);
      add(bx + 0.98, 0.36, 0.7, 0.35, 0.12, COL.white, 0.48);
      if (bx - 0.55 > 0.05) add(bx - 0.55, 0.2, 0.45, 0.4, 0.5, COL.wood);
      if (bx + 2.4 < w - 0.05) add(bx + 1.9, 0.2, 0.45, 0.4, 0.5, COL.wood);
      const wy = Math.min(1.0, h - 1.2);
      add(w - 0.62, wy, 0.55, Math.min(2.2, h - wy - 0.15), 1.15, COL.white);
      break;
    }
    case 'living': {
      add(w * 0.08, h * 0.45, 2.6, 1.9, 0.01, COL.rug);
      add(w * 0.12, h * 0.75, 2.4, 0.85, 0.42, COL.sofa);
      add(w * 0.12, h * 0.75 + 0.65, 2.4, 0.22, 0.8, COL.sofa);
      add(w * 0.12 + 0.8, h * 0.53, 0.8, 0.5, 0.35, COL.woodL);
      add(w * 0.12 + 0.2, h * 0.3, 2.0, 0.4, 0.5, COL.dark);
      add(w * 0.55, 1.05, 1.1, 0.85, 0.74, COL.woodL);
      add(w * 0.55 + 0.15, 0.62, 0.38, 0.36, 0.46, COL.dark);
      add(w * 0.55 + 0.6, 0.62, 0.38, 0.36, 0.46, COL.dark);
      add(w * 0.55 + 0.15, 1.98, 0.38, 0.36, 0.46, COL.dark);
      add(w * 0.55 + 0.6, 1.98, 0.38, 0.36, 0.46, COL.dark);
      add(w - 0.66, 2.6, 0.6, h * 0.5 - 0.4, 0.9, COL.white);
      add(w - 0.66, 2.6 + h * 0.5 - 0.4, 0.6, 0.7, 1.25, COL.white);
      add(w - 0.6, h - 0.6, 0.42, 0.42, 0.85, COL.green, 0, 'round');
      break;
    }
    case 'studio': {
      add(0.2, 0.2, 1.6, 0.08, 0.9, COL.wood);
      add(0.2, 0.28, 1.6, 2.0, 0.3, COL.woodL);
      add(0.25, 0.32, 1.5, 1.9, 0.16, COL.white, 0.3);
      add(0.22, 0.95, 1.56, 1.25, 0.04, COL.sage, 0.46);
      add(1.98, 0.2, 0.08, 2.3, 1.25, COL.wood);
      add(2.4, h * 0.55, 2.6, 1.9, 0.01, COL.rug);
      add(2.6, h - 1.1, 2.0, 0.8, 0.42, COL.sofa);
      add(2.6, h - 0.5, 2.0, 0.2, 0.78, COL.sofa);
      add(3.2, h * 0.6, 0.8, 0.5, 0.35, COL.woodL);
      add(w - 0.66, 0.3, 0.6, 2.2, 0.9, COL.white);
      break;
    }
    case 'bath': {
      add(0.1, 0.1, 0.9, 0.9, 0.05, COL.white);
      add(1.0, 0.1, 0.04, 0.9, 1.15, COL.glass, 0, 'glass');
      add(w - 0.55, 0.15, 0.4, 0.55, 0.42, COL.white, 0, 'round');
      add(0.1, h - 0.55, Math.min(1.0, w - 0.2), 0.45, 0.85, COL.wood);
      add(0.3, h - 0.5, 0.45, 0.34, 0.1, COL.white, 0.85, 'round');
      break;
    }
    case 'hall': {
      add(0.2, h - 0.45, w - 0.4, 0.38, 0.9, COL.woodL);
      add(0.3, 0.3, 0.36, 0.36, 0.7, COL.green, 0, 'round');
      break;
    }
  }
  return I;
}

// Кутија во планот: x/y/w/d/h во метри, S = пиксели по метар
function box3(parent, x, y, w, d, h, S, { cls = '', color = null, z0 = 0 } = {}) {
  const W = w * S, D = d * S, H = h * S;
  const b = el('div', 'b3 ' + cls);
  Object.assign(b.style, { left: x * S + 'px', top: y * S + 'px', width: W + 'px', height: D + 'px', transform: `translateZ(${z0 * S}px)` });
  if (color) b.style.setProperty('--c', color);
  b.innerHTML =
    `<i class="f top" style="transform:translateZ(${H}px)"></i>` +
    `<i class="f n" style="left:0;top:0;width:${W}px;height:${H}px"></i>` +
    `<i class="f s" style="left:0;top:${D}px;width:${W}px;height:${H}px"></i>` +
    `<i class="f w" style="left:0;top:0;width:${H}px;height:${D}px"></i>` +
    `<i class="f e" style="left:${W}px;top:0;width:${H}px;height:${D}px"></i>`;
  parent.appendChild(b);
  return b;
}

function renderPlan(apt, animateTo3D) {
  const wrap = $('#plan-wrap');
  wrap.innerHTML = '';
  const L = apt.layout;
  const cw = wrap.clientWidth || innerWidth, ch = wrap.clientHeight || innerHeight;
  const fill = isPhone() ? 0.82 : 0.66;
  const S = Math.max(16, Math.min(cw * fill / L.w, ch * 0.72 / L.h, 78));
  const plan = el('div', 'plan');
  Object.assign(plan.style, { width: L.w * S + 'px', height: L.h * S + 'px', marginLeft: -L.w * S / 2 + 'px', marginTop: -L.h * S / 2 + 'px' });

  const shadow = el('div', 'plan-shadow');
  Object.assign(shadow.style, { left: -S * 0.5 + 'px', top: -S * 0.5 + 'px', width: (L.w + 1) * S + 'px', height: (L.h + 1) * S + 'px', transform: `translateZ(${-S * 0.45}px)` });
  plan.appendChild(shadow);
  box3(plan, -0.25, -0.25, L.w + 0.5, L.h + 0.5, 0.29, S, { cls: 'slab', z0: -0.3 });

  for (const r of L.rooms) {
    const t = el('div', 'tile ' + (r.scene === 'bath' ? 'tiles' : 'wood'));
    Object.assign(t.style, { left: r.x * S + 'px', top: r.y * S + 'px', width: r.w * S + 'px', height: r.h * S + 'px' });
    t.dataset.room = r.id;
    t.addEventListener('click', () => enterTour(r.id));
    t.addEventListener('pointerenter', mouseOnly(() => hlRoom(r.id, true)));
    t.addEventListener('pointerleave', mouseOnly(() => hlRoom(r.id, false)));
    plan.appendChild(t);
    for (const f of furnishPlan(r)) {
      box3(plan, r.x + f.x, r.y + f.y, f.w, f.d, f.h, S, { cls: f.cls, color: f.c, z0: f.z0 });
    }
  }
  const t = WALL_T;
  for (const g of L.walls) {
    if (g.o === 'h') box3(plan, g.a - t / 2, g.c - t / 2, g.b - g.a + t, t, WALL_H, S, { cls: 'wall' });
    else box3(plan, g.c - t / 2, g.a - t / 2, t, g.b - g.a + t, WALL_H, S, { cls: 'wall' });
  }
  for (const wdw of L.windows) {
    box3(plan, wdw.mid - wdw.half, -t / 2, wdw.half * 2, t, 0.45, S, { cls: 'wall' });
    box3(plan, wdw.mid - wdw.half, -0.02, wdw.half * 2, 0.04, WALL_H - 0.45, S, { cls: 'glass', z0: 0.45 });
  }
  // Ознаки (pins) — секогаш свртени кон камерата
  for (const r of L.rooms) {
    const p = el('div', 'pin');
    p.dataset.room = r.id;
    Object.assign(p.style, {
      left: (r.x + r.w / 2) * S + 'px', top: (r.y + r.h / 2) * S + 'px',
      transform: `translateZ(${S * 1.9}px) rotateZ(calc(var(--rz) * -1)) rotateX(calc(var(--rx) * -1))`,
    });
    p.innerHTML = `<button><span class="ring"></span>${r.name}</button>`;
    $('button', p).addEventListener('click', () => enterTour(r.id));
    $('button', p).addEventListener('pointerenter', mouseOnly(() => hlRoom(r.id, true)));
    $('button', p).addEventListener('pointerleave', mouseOnly(() => hlRoom(r.id, false)));
    plan.appendChild(p);
  }
  wrap.appendChild(plan);

  if (animateTo3D) {
    setDim('2d', true);
    setTimeout(() => setDim('3d'), 450);
  } else {
    setDim(state.dim, true);
  }
}
function setDim(dim, silent) {
  if (!silent) state.dim = dim;
  const plan = $('.plan');
  if (plan) plan.classList.toggle('is3d', dim === '3d');
  $$('#dim-toggle button').forEach(b => b.classList.toggle('on', b.dataset.dim === dim));
}
function hlRoom(id, on) {
  $$(`#view-apartment [data-room="${id}"]`).forEach(n => n.classList.toggle('hl', on));
}

function renderAptCard(apt) {
  const L = apt.layout;
  $('#apt-pill').innerHTML = `<b>Стан ${apt.id}</b> · ${apt.area} m² · ${euro(apt.price)}`;
  $('#apt-card').innerHTML = `
    <h2>${L.label}</h2>
    <div class="muted">Стан ${apt.id} · ${apt.floor}. кат</div>
    <div class="price-row"><span class="price">${euro(apt.price)}</span><span class="st ${apt.status}">${STATUS[apt.status].label}</span></div>
    <div class="specs">
      <div><b>${apt.area}</b><span>m²</span></div>
      <div><b>${L.bedrooms || '—'}</b><span>${L.bedrooms === 1 ? 'спална' : 'спални'}</span></div>
      <div><b>${L.facing}</b><span>ориентација</span></div>
    </div>
    <h3 class="rooms-h">Простории</h3>
    <ul class="roomlist">${L.rooms.map(r => `<li data-room="${r.id}" tabindex="0" role="button"><span>${r.name}</span><span>${roomArea(r)} m²</span></li>`).join('')}</ul>
    <div class="thumbs">${L.rooms.filter(r => r.photo).map(r =>
      `<button data-room="${r.id}" style="background-image:url('${r.photo.src}')"><span>${r.name}</span></button>`).join('')}</div>
    <div class="apt-actions">
      <button class="btn primary" data-action="offer">Закажете разгледување</button>
      <button class="btn ghost" data-action="tour">Прошетајте низ станот ${ICON.arrowR}</button>
    </div>`;
  $$('#apt-card [data-room]').forEach(li => {
    li.addEventListener('click', () => enterTour(li.dataset.room));
    li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enterTour(li.dataset.room); } });
    li.addEventListener('pointerenter', mouseOnly(() => hlRoom(li.dataset.room, true)));
    li.addEventListener('pointerleave', mouseOnly(() => hlRoom(li.dataset.room, false)));
  });
}

/* ===================== 4. ПРОШЕТКА ===================== */

/* ---------- 4а. Фотографија на собата (панорамско влечење) ---------- */
const photo = { layer: null, x: 0, tx: 0, range: 0, raf: 0 };

function buildPhotoTour(apt, room, fx) {
  const layer = el('div', 'photo-layer');
  layer.innerHTML = `<img src="${room.photo.src}" alt="${room.name}" draggable="false">`;
  fx.appendChild(layer);

  const nbs = neighbors(apt.layout, room.id);
  nbs.forEach((n, i) => {
    const [px, py] = room.photo.spots[i % room.photo.spots.length];
    const h = el('div', 'hs photo');
    Object.assign(h.style, { left: px * 100 + '%', top: py * 100 + '%' });
    h.innerHTML = `<button><span class="ring"></span>${n.name}</button>`;
    const btn = $('button', h);
    btn.addEventListener('pointerdown', e => e.stopPropagation());
    btn.addEventListener('click', () => enterTour(n.id));
    layer.appendChild(h);
  });

  // Копчиња долу — корисно на телефон, каде дел од сликата е надвор од екранот
  const nav = el('div', 'photo-nav');
  nav.innerHTML = nbs.map(n => `<button data-go="${n.id}">${n.name} ${ICON.arrowR}</button>`).join('');
  $$('button', nav).forEach(b => {
    b.addEventListener('pointerdown', e => e.stopPropagation());
    b.addEventListener('click', () => enterTour(b.dataset.go));
  });
  fx.appendChild(nav);

  photo.layer = layer;
  fitPhoto();
  photo.x = photo.range * 0.25; photo.tx = 0; // мал „влез“ — сликата се лизга кон центарот
  photoTick();
}
function fitPhoto() {
  if (!photo.layer) return;
  const vw = innerWidth, vh = innerHeight;
  let w = Math.max(vw * 1.25, vh * 16 / 9), h = w * 9 / 16;
  if (h < vh) { h = vh; w = h * 16 / 9; }
  Object.assign(photo.layer.style, { width: w + 'px', height: h + 'px' });
  photo.range = (w - vw) / 2;
  photo.tx = Math.max(-photo.range, Math.min(photo.range, photo.tx));
}
function photoTick() {
  if (!photo.layer) return;
  photo.x += (photo.tx - photo.x) * 0.08;
  photo.layer.style.transform = `translate(-50%, -50%) translateX(${photo.x.toFixed(2)}px)`;
  photo.raf = requestAnimationFrame(photoTick);
}

/* ---------- 4б. CSS 3D соба (се користи кога собата нема фотографија) ---------- */

const PERSP = 560;
// [ширина, висина, длабочина] на собата во пиксели
const DIMS = { living: [1200, 620, 900], studio: [1150, 620, 860], bedroom: [1050, 620, 820], bath: [800, 620, 660], hall: [760, 620, 820] };
const cam = { yaw: -10, pitch: 2, ty: 0, tp: 0, raf: 0, world: null, camZ: 0 };

function buildTour(apt, room) {
  const stage = $('#tour-stage');
  stage.innerHTML = '';
  const fx = el('div', 'tour-fx');
  stage.appendChild(fx);

  cancelAnimationFrame(cam.raf); cam.world = null;
  cancelAnimationFrame(photo.raf); photo.layer = null;

  // Ако собата има фотографија, прикажи ја неа (може да се влече лево-десно)
  if (room.photo) return buildPhotoTour(apt, room, fx);

  const [RW, RH, RD] = DIMS[room.scene];
  const vp = el('div', 'tour-vp');
  const world = el('div', 'tour-world');
  vp.appendChild(world); fx.appendChild(vp);
  cam.world = world; cam.vp = vp;
  cam.camZ = PERSP - 60 - RD / 2;
  vp.style.perspective = PERSP + 'px';
  fitTour();

  const face = (w, h, tr, cls) => {
    const f = el('div', 'face ' + cls);
    Object.assign(f.style, { width: w + 'px', height: h + 'px', marginLeft: -w / 2 + 'px', marginTop: -h / 2 + 'px', transform: tr });
    world.appendChild(f);
    return f;
  };
  const F = {
    back: face(RW, RH, `translateZ(${-RD / 2}px)`, 'fc-back'),
    left: face(RD, RH, `rotateY(90deg) translateZ(${-RW / 2}px)`, 'fc-left'),
    right: face(RD, RH, `rotateY(-90deg) translateZ(${-RW / 2}px)`, 'fc-right'),
    floor: face(RW, RD, `rotateX(90deg) translateZ(${-RH / 2}px)`, 'fc-floor'),
    ceil: face(RW, RD, `rotateX(-90deg) translateZ(${-RH / 2}px)`, 'fc-ceil'),
  };

  // Декорации на ѕид: c = центар (x за задниот ѕид, z за левиот/десниот), above = висина од подот
  const onWall = (side, c, above, w, h, cls, style) => {
    let l;
    if (side === 'back') l = c + RW / 2 - w / 2;
    else if (side === 'left') l = RD / 2 - c - w / 2;
    else l = c + RD / 2 - w / 2;
    const d = el('div', 'deco ' + cls);
    Object.assign(d.style, { left: l + 'px', top: (RH - above - h) + 'px', width: w + 'px', height: h + 'px' }, style || {});
    F[side].appendChild(d);
    return d;
  };
  const onFloor = (x, z, w, d, cls) => {
    const e = el('div', 'deco ' + cls);
    Object.assign(e.style, { left: (x + RW / 2 - w / 2) + 'px', top: (z + RD / 2 - d / 2) + 'px', width: w + 'px', height: d + 'px' });
    F.floor.appendChild(e);
    return e;
  };
  // 3D кутија на подот: центар (x, z), големина w×d, висина h, кренато за elev
  const box = (x, z, w, d, h, color, elev = 0, cls = '') => {
    const b = el('div', 'bx ' + cls);
    b.style.transform = `translate3d(${x}px, ${RH / 2 - elev}px, ${z}px)`;
    b.style.setProperty('--c', color);
    b.innerHTML =
      `<i class="f t" style="width:${w}px;height:${d}px;left:${-w / 2}px;top:${-d / 2}px;transform:translateY(${-h}px) rotateX(90deg)"></i>` +
      `<i class="f fr" style="width:${w}px;height:${h}px;left:${-w / 2}px;top:${-h}px;transform:translateZ(${d / 2}px)"></i>` +
      `<i class="f bk" style="width:${w}px;height:${h}px;left:${-w / 2}px;top:${-h}px;transform:translateZ(${-d / 2}px)"></i>` +
      `<i class="f l" style="width:${d}px;height:${h}px;left:${-d / 2}px;top:${-h}px;transform:translateX(${-w / 2}px) rotateY(90deg)"></i>` +
      `<i class="f r" style="width:${d}px;height:${h}px;left:${-d / 2}px;top:${-h}px;transform:translateX(${w / 2}px) rotateY(90deg)"></i>`;
    world.appendChild(b);
    return b;
  };

  const k = { RW, RH, RD, F, onWall, onFloor, box };
  // Секоја сцена враќа каде има слободно место за врата
  const doorSlots = (SCENES[room.scene] || SCENES.living)(k) || [];

  // Врати кон соседните соби + лебдечки копчиња (hotspots) што секогаш се гледаат
  const sw = Math.min(RW, cam.vpW * 1.05); // на тесни (портрет) екрани копчињата одат поблиску до центарот
  const spots = [
    { x: -sw * 0.27, z: -RD * 0.18 }, { x: sw * 0.27, z: -RD * 0.18 },
    { x: 0, z: -RD * 0.32 }, { x: -sw * 0.1, z: -RD * 0.05 },
  ];
  neighbors(apt.layout, room.id).forEach((n, i) => {
    if (doorSlots[i]) onWall(doorSlots[i].side, doorSlots[i].c, 0, 170, 430, 'doorway');
    const { x, z } = spots[i % spots.length];
    const h = el('div', 'hs');
    h.style.transform = `translate3d(${x}px, ${RH / 2 - 330}px, ${z}px)`;
    h.innerHTML = `<button><span class="ring"></span>${n.name}</button>`;
    const btn = $('button', h);
    btn.addEventListener('pointerdown', e => e.stopPropagation());
    btn.addEventListener('click', () => enterTour(n.id));
    world.appendChild(h);
  });

  cam.yaw = -12; cam.pitch = -2; cam.ty = 0; cam.tp = -8; // негативно = поглед малку надолу
  cancelAnimationFrame(cam.raf);
  tick();
}

function tick() {
  if (!cam.world) return;
  cam.yaw += (cam.ty - cam.yaw) * 0.07;
  cam.pitch += (cam.tp - cam.pitch) * 0.07;
  cam.world.style.transform =
    `translateZ(${PERSP}px) rotateX(${cam.pitch.toFixed(3)}deg) rotateY(${cam.yaw.toFixed(3)}deg) translateZ(${-PERSP + cam.camZ}px)`;
  cam.raf = requestAnimationFrame(tick);
}
function fitTour() {
  // Висината е секогаш 700px; ширината ја следи формата на екранот (без сечење)
  const aspect = innerWidth / innerHeight;
  cam.vpW = Math.max(420, 700 * aspect);
  if (!cam.vp) return;
  Object.assign(cam.vp.style, { width: cam.vpW + 'px', marginLeft: -cam.vpW / 2 + 'px', transform: `scale(${innerHeight / 700})` });
}

// Сцени — секоја соба е составена од ѕидови, под, кутии (мебел) и декорации
const SCENES = {
  living({ RW, RD, onWall, onFloor, box }) {
    onWall('back', 300, 120, 340, 360, 'win');
    onFloor(260, -RD / 2 + 230, 560, 380, 'sunpatch');
    onWall('back', -170, 250, 320, 180, 'tv');
    box(-170, -RD / 2 + 40, 470, 60, 55, COL.woodL);
    // трпезарија
    box(300, -RD / 2 + 210, 230, 130, 8, COL.woodL, 72);
    box(300, -RD / 2 + 210, 20, 20, 72, COL.dark);
    for (const dx of [-150, 150]) {
      box(300 + dx, -RD / 2 + 210, 46, 46, 6, COL.dark, 44);
      box(300 + dx + Math.sign(dx) * 22, -RD / 2 + 210, 6, 46, 46, COL.dark, 50);
      box(300 + dx, -RD / 2 + 210, 6, 6, 44, COL.dark);
    }
    box(300, -RD / 2 + 210, 2, 2, 190, COL.dark, 420);
    box(300, -RD / 2 + 210, 70, 70, 34, '#efcf95', 388, 'round shade');
    // дневен дел
    // софа на средина свртена кон телевизорот
    const sx = -170, sz = 40;
    onFloor(sx, -110, 480, 380, 'rug');
    box(sx, sz, 340, 120, 42, COL.sofa);
    box(sx, sz + 52, 340, 24, 100, COL.sofa);
    box(sx - 170, sz, 24, 124, 66, COL.sofa);
    box(sx + 170, sz, 24, 124, 66, COL.sofa);
    box(sx - 78, sz - 6, 150, 100, 14, '#cfc3b1', 42);
    box(sx + 78, sz - 6, 150, 100, 14, '#cfc3b1', 42);
    box(sx, -170, 150, 150, 6, COL.woodL, 38, 'round');
    box(sx, -170, 18, 18, 38, COL.dark);
    // кујна на десниот ѕид
    box(RW / 2 - 42, -130, 84, 360, 88, COL.white);
    box(RW / 2 - 42, -130, 86, 364, 4, '#d6cfc4', 88);
    onWall('right', -130, 300, 360, 150, 'cabinets');
    // растение
    box(-RW / 2 + 70, -RD / 2 + 60, 60, 60, 60, '#d8cfc2');
    box(-RW / 2 + 70, -RD / 2 + 60, 100, 100, 120, COL.green, 60, 'leaves');
    return [{ side: 'left', c: -RD * 0.2 }, { side: 'left', c: RD * 0.05 }];
  },

  bedroom({ RW, RD, onWall, onFloor, box }) {
    onWall('right', -170, 120, 300, 340, 'win');
    onFloor(RW / 2 - 260, -170, 420, 320, 'sunpatch');
    onWall('left', -RD / 2 + 130, 0, 260, 620, 'slats');
    onWall('back', 0, 270, 230, 150, 'art');
    onFloor(0, -RD / 2 + 240, 620, 420, 'rug');
    const bz = -RD / 2 + 24 + 200;
    box(0, -RD / 2 + 14, 430, 24, 190, COL.wood);
    box(0, bz, 400, 400, 40, COL.woodL);
    box(0, bz, 384, 386, 30, COL.white, 40);
    box(0, bz + 50, 394, 290, 8, COL.sage, 70);
    box(0, bz + 150, 398, 70, 5, '#d9c6aa', 78);
    box(-90, -RD / 2 + 72, 160, 56, 26, COL.white, 70);
    box(90, -RD / 2 + 72, 160, 56, 26, COL.white, 70);
    for (const nx of [-275, 275]) {
      box(nx, -RD / 2 + 50, 90, 70, 72, COL.wood);
      box(nx, -RD / 2 + 50, 10, 10, 40, COL.dark, 72);
      box(nx, -RD / 2 + 50, 60, 60, 44, '#f4e4c8', 110, 'round shade');
    }
    return [{ side: 'left', c: -RD * 0.03 }, { side: 'right', c: RD * 0.1 }];
  },

  bath({ RW, RD, F, onWall, onFloor, box }) {
    for (const f of [F.back, F.left, F.right, F.floor]) f.classList.add('tiled');
    onFloor(-RW / 2 + 140, -RD / 2 + 130, 260, 240, 'tray');
    box(-RW / 2 + 272, -RD / 2 + 130, 6, 240, 440, COL.glass, 0, 'glass');
    onWall('back', -RW / 2 + 140, 430, 70, 12, 'metal');
    onWall('back', -RW / 2 + 140, 200, 6, 240, 'metal');
    onWall('back', -RW / 2 + 60, 240, 80, 60, 'niche');
    box(RW / 2 - 200, -RD / 2 + 45, 250, 90, 60, COL.wood, 140);
    box(RW / 2 - 200, -RD / 2 + 45, 100, 70, 22, COL.white, 200, 'round');
    onWall('back', RW / 2 - 200, 300, 180, 220, 'mirror');
    onWall('back', RW / 2 - 200, 232, 10, 40, 'metal');
    box(-RW / 2 + 70, -40, 100, 80, 40, COL.white, 22, 'round');
    onWall('left', -40, 100, 70, 40, 'tray');
    onWall('right', -170, 200, 120, 170, 'towel');
    return [{ side: 'right', c: RD * 0.05 }];
  },

  hall({ RW, RD, onWall, box }) {
    onWall('back', 0, 0, 190, 440, 'frontdoor');
    box(-RW / 2 + 32, -170, 64, 200, 85, COL.woodL);
    onWall('left', -170, 160, 180, 280, 'mirror tall');
    onWall('right', -220, 330, 220, 8, 'metal');
    onWall('right', -270, 180, 64, 150, 'coat c1');
    onWall('right', -180, 170, 64, 160, 'coat c2');
    return [{ side: 'left', c: RD * 0.06 }, { side: 'right', c: RD * 0.06 }, { side: 'back', c: -RW * 0.36 }, { side: 'back', c: RW * 0.36 }];
  },

  studio({ RW, RD, onWall, onFloor, box }) {
    onWall('back', 260, 120, 360, 360, 'win');
    onFloor(240, -RD / 2 + 240, 520, 360, 'sunpatch');
    const bz = -RD / 2 + 24 + 190;
    box(-330, -RD / 2 + 14, 320, 24, 170, COL.wood);
    box(-330, bz, 300, 380, 40, COL.woodL);
    box(-330, bz, 288, 368, 28, COL.white, 40);
    box(-330, bz + 45, 296, 270, 8, COL.sage, 68);
    box(-390, -RD / 2 + 70, 120, 50, 24, COL.white, 68);
    box(-270, -RD / 2 + 70, 120, 50, 24, COL.white, 68);
    box(-172, -RD / 2 + 210, 16, 400, 470, COL.wood, 0, 'slatbox');
    onFloor(150, -30, 380, 280, 'rug');
    box(150, 30, 260, 100, 40, COL.sofa);
    box(150, 72, 260, 22, 90, COL.sofa);
    box(150, -90, 110, 70, 6, COL.woodL, 36, 'round');
    box(150, -90, 14, 14, 36, COL.dark);
    box(RW / 2 - 42, -200, 84, 320, 88, COL.white);
    box(RW / 2 - 42, -200, 86, 324, 4, '#d6cfc4', 88);
    onWall('right', -200, 300, 320, 150, 'cabinets');
    return [{ side: 'left', c: -RD * 0.02 }];
  },
};

function renderMinimap(apt, roomId) {
  const L = apt.layout;
  const rects = L.rooms.map(r =>
    `<rect class="r ${r.id === roomId ? 'cur' : ''}" data-room="${r.id}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"><title>${r.name}</title></rect>`).join('');
  const cur = L.rooms.find(r => r.id === roomId);
  $('#minimap').innerHTML =
    `<svg viewBox="-.2 -.2 ${L.w + .4} ${L.h + .4}">${rects}
      <circle cx="${cur.x + cur.w / 2}" cy="${cur.y + cur.h / 2}" r=".28" fill="#16181d"/></svg>
     <div class="cap">Стан ${apt.id} · ${cur.name}</div>`;
  $$('#minimap .r').forEach(r => r.addEventListener('click', () => enterTour(r.dataset.room)));
}

// Влечење со глувче / прст
(function setupDrag() {
  const stage = $('#tour-stage');
  let drag = null;
  stage.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, yaw: cam.ty, pitch: cam.tp, px: photo.tx };
    stage.classList.add('dragging');
    stage.setPointerCapture(e.pointerId);
    $('#hint').classList.add('hide');
  });
  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    const clamp = (v, a) => Math.max(-a, Math.min(a, v));
    if (photo.layer) { photo.tx = clamp(drag.px + (e.clientX - drag.x), photo.range); return; }
    cam.ty = clamp(drag.yaw - (e.clientX - drag.x) * 0.1, 24);
    cam.tp = Math.max(-18, Math.min(6, drag.pitch + (e.clientY - drag.y) * 0.06));
  });
  const end = () => { drag = null; stage.classList.remove('dragging'); };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
})();

/* ===================== 5. НАВИГАЦИЈА ===================== */

const state = { view: 'building', apt: null, room: null, dim: '3d' };

function showView(name) {
  state.view = name;
  for (const v of ['building', 'apartment', 'tour']) {
    $('#view-' + v).classList.toggle('active', v === name);
  }
  if (name !== 'tour') { cancelAnimationFrame(cam.raf); cancelAnimationFrame(photo.raf); photo.layer = null; }
}
function openApartment(id) {
  const apt = APTS.find(a => a.id === id);
  state.apt = apt;
  closeDrawer();
  $('#view-building').classList.add('leaving');
  showView('apartment');
  renderAptCard(apt);
  requestAnimationFrame(() => renderPlan(apt, true));
}
function enterTour(roomId) {
  const apt = state.apt;
  const room = apt.layout.rooms.find(r => r.id === roomId);
  state.room = roomId;
  $('#tour-pill').innerHTML = `<b>Стан ${apt.id}</b> · ${room.name}`;
  if (state.view !== 'tour') showView('tour');
  buildTour(apt, room);
  renderMinimap(apt, roomId);
}
function toPlan() {
  showView('apartment');
  renderPlan(state.apt, false);
}
function toBuilding() {
  $('#view-building').classList.remove('leaving');
  showView('building');
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]');
  if (a) {
    const act = a.dataset.action;
    if (act === 'list') openList();
    else if (act === 'about') openAbout();
    else if (act === 'to-building') toBuilding();
    else if (act === 'to-plan') toPlan();
    else if (act === 'tour') enterTour(state.apt.layout.rooms[0].id);
    else if (act === 'offer') openInquiry(state.apt);
    return;
  }
  const d = e.target.closest('[data-dim]');
  if (d) setDim(d.dataset.dim);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if ($('#inquiry').open) return;          // <dialog> се затвора сам
  if (state.view === 'tour') toPlan();
  else if (state.view === 'apartment') toBuilding();
  else closeDrawer();
});
let rT;
addEventListener('resize', () => {
  clearTimeout(rT);
  rT = setTimeout(() => {
    fitTour(); fitPhoto(); fitHero(); positionTip();
    if (state.view === 'apartment' && state.apt) renderPlan(state.apt, false);
  }, 150);
});

/* ===================== 6. БАРАЊЕ ЗА РАЗГЛЕДУВАЊЕ ===================== */
// Демо: формуларот не праќа ништо. За вистински клиент поврзете го со е-пошта или CRM
// (на пр. Formspree, Netlify Forms или сопствен API) во submitInquiry.
function openInquiry(apt) {
  const dlg = $('#inquiry');
  const form = $('form', dlg);
  form.reset();
  dlg.classList.remove('sent');
  $('#inq-apt').textContent = apt ? `Стан ${apt.id} · ${apt.layout.label} · ${apt.area} m² · ${euro(apt.price)}` : '';
  form.elements.apt.value = apt ? apt.id : '';
  $$('.err', form).forEach(e => e.textContent = '');
  dlg.showModal();
}
function submitInquiry(e) {
  e.preventDefault();
  const form = e.target, f = form.elements;
  const err = (name, msg) => { form.querySelector(`[data-err="${name}"]`).textContent = msg; return !msg; };
  const okName = err('name', f.name.value.trim().length < 2 ? 'Внесете име и презиме.' : '');
  const phone = f.phone.value.replace(/[\s\/-]/g, '');
  const okPhone = err('phone', /^\+?\d{8,15}$/.test(phone) ? '' : 'Внесете телефонски број, на пр. 070 123 456.');
  const okMail = err('email', !f.email.value || f.email.validity.valid ? '' : 'Е-поштата не е во точен формат.');
  if (!(okName && okPhone && okMail)) {
    const first = form.querySelector('.err:not(:empty)');
    if (first) first.closest('label').querySelector('input, textarea').focus();
    return;
  }
  $('#inquiry').classList.add('sent');
}
(function setupInquiry() {
  const dlg = $('#inquiry');
  $('form', dlg).addEventListener('submit', submitInquiry);
  $$('[data-close]', dlg).forEach(b => b.addEventListener('click', () => dlg.close()));
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });   // клик надвор
})();

buildHero();
