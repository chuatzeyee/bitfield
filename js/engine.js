// Field engine: layers become masks, masks become a grid of glyphs.

export function rngFrom(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PATTERNS = {
  random: () => 1,
  "gradient down": (x, y, w, h) => 1 - y / h,
  "gradient right": (x, y, w) => x / w,
  waves: (x, y, w, h) => 0.5 + 0.5 * Math.sin((x / w) * 10 + (y / h) * 6),
  rings: (x, y, w, h) => 0.5 + 0.5 * Math.sin(Math.hypot(x - w / 2, y - h / 2) / 30),
  vortex: (x, y, w, h) => {
    const dx = x - w / 2, dy = y - h / 2;
    return 0.5 + 0.5 * Math.sin(Math.atan2(dy, dx) * 5 + Math.hypot(dx, dy) / 60);
  },
  checker: (x, y) => ((Math.floor(x / 140) + Math.floor(y / 140)) % 2 ? 0.12 : 1),
  scanlines: (x, y) => (Math.floor(y / 90) % 2 ? 0.15 : 1),
};

export function messageBits(msg) {
  const s = msg && msg.length ? msg : "BITFIELD";
  return [...s].map((c) => c.charCodeAt(0).toString(2).padStart(8, "0")).join("");
}

export function drawShape(c, ly, font, color) {
  const fill = color || ly.color;
  c.fillStyle = fill;
  c.strokeStyle = fill;
  if (ly.type === "rect") {
    c.beginPath();
    c.roundRect(ly.x, ly.y, ly.w, ly.h, ly.rx || 0);
    c.fill();
  } else if (ly.type === "ellipse") {
    c.beginPath();
    c.ellipse(ly.x + ly.w / 2, ly.y + ly.h / 2, ly.w / 2, ly.h / 2, 0, 0, Math.PI * 2);
    c.fill();
  } else if (ly.type === "line") {
    c.lineWidth = ly.width;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(ly.x1, ly.y1);
    c.lineTo(ly.x2, ly.y2);
    c.stroke();
  } else if (ly.type === "polygon") {
    c.beginPath();
    ly.points.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
    c.fill();
  } else if (ly.type === "text") {
    c.font = `${ly.weight || 400} ${ly.size}px ${font}`;
    c.letterSpacing = (ly.tracking || 0) + "px";
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
    c.fillText(ly.text, ly.x, ly.y);
    c.letterSpacing = "0px";
  }
}

const maskCache = new Map();

function maskFor(doc, ly) {
  const key = ly.id;
  const stamp = JSON.stringify([doc.width, doc.height, doc.font, ly]);
  const hit = maskCache.get(key);
  if (hit && hit.stamp === stamp) return hit.data;
  const cv = document.createElement("canvas");
  cv.width = doc.width;
  cv.height = doc.height;
  const mc = cv.getContext("2d", { willReadFrequently: true });
  drawShape(mc, ly, doc.font, "#fff");
  const data = mc.getImageData(0, 0, doc.width, doc.height).data;
  if (maskCache.size > 60) maskCache.clear();
  maskCache.set(key, { stamp, data });
  return data;
}

export function computeCells(doc, layers) {
  const masks = layers
    .filter((l) => l.visible && l.mode !== "solid")
    .map((l) => ({ layer: l, data: maskFor(doc, l) }));
  const rand = rngFrom(String(doc.seed));
  const bits = messageBits(doc.message);
  const pat = PATTERNS[doc.pattern] || PATTERNS.random;
  const cs = doc.charset && doc.charset.length ? doc.charset : "01";
  const cells = [];
  let mi = 0;
  const cell = Math.max(8, doc.cell | 0);
  for (let y = cell; y < doc.height - cell / 2; y += cell) {
    for (let x = cell; x < doc.width - cell / 2; x += cell) {
      const w8 = Math.max(0, Math.min(1, pat(x, y, doc.width, doc.height)));
      let ch;
      if (doc.bitSource === "message") ch = bits[mi++ % bits.length];
      else if (doc.bitSource === "pattern") ch = w8 > 0.5 ? "1" : "0";
      else ch = cs[Math.floor(rand() * cs.length)];
      const r = rand();
      let hit = null;
      for (let i = masks.length - 1; i >= 0; i--) {
        if (masks[i].data[(y * doc.width + x) * 4 + 3] > 0) {
          hit = masks[i].layer;
          break;
        }
      }
      if (hit) {
        if (hit.mode === "punch") continue;
        cells.push({ x, y, ch, color: hit.color, bold: true });
      } else if (doc.showField && r < w8 * doc.density) {
        cells.push({ x, y, ch, color: doc.faint, bold: false });
      }
    }
  }
  return cells;
}

export function renderCanvas(ctx, doc, layers) {
  ctx.fillStyle = doc.bg;
  ctx.fillRect(0, 0, doc.width, doc.height);
  const cells = computeCells(doc, layers);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const boldFont = `900 ${doc.cell}px ${doc.font}`;
  const faintFont = `400 ${Math.round(doc.cell * 0.85)}px ${doc.font}`;
  let last = "";
  for (const c of cells) {
    const f = c.bold ? boldFont : faintFont;
    if (f !== last) {
      ctx.font = f;
      last = f;
    }
    ctx.fillStyle = c.color;
    ctx.fillText(c.ch, c.x, c.y);
  }
  for (const ly of layers) {
    if (ly.visible && ly.mode === "solid") drawShape(ctx, ly, doc.font);
  }
}

export function bboxOf(ly, mctx, font) {
  if (ly.type === "rect" || ly.type === "ellipse") return [ly.x, ly.y, ly.w, ly.h];
  if (ly.type === "line") {
    const p = ly.width / 2;
    const x0 = Math.min(ly.x1, ly.x2) - p, y0 = Math.min(ly.y1, ly.y2) - p;
    return [x0, y0, Math.abs(ly.x1 - ly.x2) + ly.width, Math.abs(ly.y1 - ly.y2) + ly.width];
  }
  if (ly.type === "polygon") {
    const xs = ly.points.map((p) => p[0]), ys = ly.points.map((p) => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0];
  }
  mctx.font = `${ly.weight || 400} ${ly.size}px ${font}`;
  mctx.letterSpacing = (ly.tracking || 0) + "px";
  const w = mctx.measureText(ly.text).width;
  mctx.letterSpacing = "0px";
  return [ly.x, ly.y - ly.size * 0.78, w, ly.size];
}

export function movedLayer(ly, dx, dy) {
  if (ly.type === "line")
    return { ...ly, x1: ly.x1 + dx, y1: ly.y1 + dy, x2: ly.x2 + dx, y2: ly.y2 + dy };
  if (ly.type === "polygon")
    return { ...ly, points: ly.points.map((p) => [p[0] + dx, p[1] + dy]) };
  return { ...ly, x: ly.x + dx, y: ly.y + dy };
}
