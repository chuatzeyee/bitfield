import { PATTERNS, renderCanvas, bboxOf, movedLayer } from "./engine.js";
import { exportPNG, exportSVG, exportJSON, svgString } from "./export.js";
import { PRESETS, defaultState, baseDoc, nid } from "./presets.js";

let state = defaultState();
let undoStack = [];
let redoStack = [];

const $ = (s) => document.querySelector(s);
const canvas = $("#board");
const ctx = canvas.getContext("2d");

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const kid of kids) el.append(kid);
  return el;
}

// --- undo ---------------------------------------------------------------
function snapshot() {
  return JSON.stringify({ doc: state.doc, layers: state.layers });
}
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 80) undoStack.shift();
  redoStack = [];
}
function restore(json) {
  const s = JSON.parse(json);
  state = { ...s, selectedId: state.selectedId };
  if (!state.layers.some((l) => l.id === state.selectedId)) state.selectedId = null;
  refresh();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
}

// --- state helpers ------------------------------------------------------
const selected = () => state.layers.find((l) => l.id === state.selectedId) || null;

function setDoc(key, value) {
  state = { ...state, doc: { ...state.doc, [key]: value } };
}
function patchLayer(id, patch) {
  state = {
    ...state,
    layers: state.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  };
}
function clampDoc(doc) {
  return {
    ...doc,
    width: Math.min(8000, Math.max(200, doc.width | 0)),
    height: Math.min(8000, Math.max(200, doc.height | 0)),
    cell: Math.min(200, Math.max(8, doc.cell | 0)),
    density: Math.min(1, Math.max(0, +doc.density || 0)),
  };
}

// --- painting -----------------------------------------------------------
function syncCanvasSize() {
  state = { ...state, doc: clampDoc(state.doc) };
  if (canvas.width !== state.doc.width) canvas.width = state.doc.width;
  if (canvas.height !== state.doc.height) canvas.height = state.doc.height;
}

function repaint() {
  syncCanvasSize();
  renderCanvas(ctx, state.doc, state.layers);
  const sel = selected();
  if (sel) {
    const [x, y, w, hh] = bboxOf(sel, ctx, state.doc.font);
    ctx.save();
    ctx.strokeStyle = "#2e7bd6";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(x - 6, y - 6, w + 12, hh + 12);
    ctx.restore();
  }
}

// --- document panel -----------------------------------------------------
const DOC_FIELDS = [
  ["width", "width", "number"],
  ["height", "height", "number"],
  ["cell", "cell size", "number"],
  ["seed", "seed", "text"],
  ["bitSource", "bit source", "select", ["random", "message", "pattern"]],
  ["charset", "charset", "text"],
  ["message", "message", "text"],
  ["pattern", "pattern", "select", Object.keys(PATTERNS)],
  ["density", "density", "range"],
  ["bg", "background", "color"],
  ["faint", "faint ink", "color"],
  ["showField", "show field", "checkbox"],
  ["font", "font", "select", ["Fraunces", "IBM Plex Mono", "Georgia", "serif"]],
];

function docInput(key, kind, options) {
  const v = state.doc[key];
  if (kind === "select") {
    const sel = h("select", { onchange: (e) => commitDoc(key, e.target.value) });
    for (const o of options) sel.append(h("option", { value: o, ...(o === v ? { selected: "" } : {}) }, o));
    return sel;
  }
  if (kind === "checkbox")
    return h("input", {
      type: "checkbox",
      ...(v ? { checked: "" } : {}),
      onchange: (e) => commitDoc(key, e.target.checked),
    });
  if (kind === "range")
    return h("input", {
      type: "range", min: 0, max: 1, step: 0.05, value: v,
      oninput: (e) => { setDoc(key, +e.target.value); repaint(); },
      onchange: (e) => commitDoc(key, +e.target.value),
    });
  return h("input", {
    type: kind, value: v,
    onfocus: pushUndo,
    oninput: (e) => {
      const val = kind === "number" ? +e.target.value : e.target.value;
      setDoc(key, val);
      repaint();
    },
  });
}
function commitDoc(key, value) {
  pushUndo();
  setDoc(key, value);
  repaint();
}

function renderDocPanel() {
  const box = $("#docpanel");
  box.replaceChildren();
  for (const [key, label, kind, options] of DOC_FIELDS) {
    box.append(h("label", { class: "row" }, h("span", {}, label), docInput(key, kind, options)));
  }
  box.append(
    h("button", {
      class: "wide",
      onclick: () => commitDoc("seed", Math.random().toString(36).slice(2, 8).toUpperCase()),
    }, "reroll seed")
  );
}

// --- add layer buttons ---------------------------------------------------
function addLayer(props) {
  pushUndo();
  const ly = { id: nid(), name: props.type, visible: true, mode: "bits", color: "#141414", ...props };
  state = { ...state, layers: [...state.layers, ly], selectedId: ly.id };
  refresh();
}

function adders() {
  const { width: w, height: hh } = state.doc;
  const cx = w / 2, cy = hh / 2;
  return {
    rect: () => ({ type: "rect", x: cx - 150, y: cy - 100, w: 300, h: 200, rx: 0 }),
    ellipse: () => ({ type: "ellipse", x: cx - 130, y: cy - 130, w: 260, h: 260 }),
    line: () => ({ type: "line", x1: cx - 200, y1: cy + 120, x2: cx + 200, y2: cy - 120, width: 80 }),
    triangle: () => ({ type: "polygon", points: [[cx - 170, cy + 130], [cx + 170, cy + 130], [cx, cy - 170]] }),
    "text bits": () => ({ type: "text", text: "HELLO", size: 200, weight: 900, tracking: 0, x: cx - 280, y: cy + 60 }),
    "text solid": () => ({ type: "text", text: "caption", size: 60, weight: 500, tracking: 8, x: cx - 120, y: cy, mode: "solid" }),
  };
}

function renderToolPanel() {
  const box = $("#tools");
  box.replaceChildren();
  for (const [label, make] of Object.entries(adders()))
    box.append(h("button", { onclick: () => addLayer(make()) }, label));
}

// --- layer list ----------------------------------------------------------
function moveInStack(id, dir) {
  const i = state.layers.findIndex((l) => l.id === id);
  const j = i + dir;
  if (j < 0 || j >= state.layers.length) return;
  pushUndo();
  const layers = [...state.layers];
  [layers[i], layers[j]] = [layers[j], layers[i]];
  state = { ...state, layers };
  refresh();
}

function deleteLayer(id) {
  pushUndo();
  state = {
    ...state,
    layers: state.layers.filter((l) => l.id !== id),
    selectedId: state.selectedId === id ? null : state.selectedId,
  };
  refresh();
}

function renderLayerList() {
  const box = $("#layers");
  box.replaceChildren();
  for (const ly of [...state.layers].reverse()) {
    box.append(
      h("div", { class: "layer" + (ly.id === state.selectedId ? " sel" : "") },
        h("button", { class: "mini", title: "raise", onclick: () => moveInStack(ly.id, 1) }, "^"),
        h("button", { class: "mini", title: "lower", onclick: () => moveInStack(ly.id, -1) }, "v"),
        h("button", {
          class: "mini", title: "visibility",
          onclick: () => { pushUndo(); patchLayer(ly.id, { visible: !ly.visible }); refresh(); },
        }, ly.visible ? "o" : "-"),
        h("span", {
          class: "lname",
          onclick: () => { state = { ...state, selectedId: ly.id }; refresh(); },
        }, `${ly.name} [${ly.mode}]`),
        h("button", { class: "mini", title: "delete", onclick: () => deleteLayer(ly.id) }, "x")
      )
    );
  }
  if (!state.layers.length) box.append(h("p", { class: "hint" }, "no layers yet, add one on the left"));
}

// --- properties panel ------------------------------------------------------
const NUM_FIELDS = {
  rect: ["x", "y", "w", "h", "rx"],
  ellipse: ["x", "y", "w", "h"],
  line: ["x1", "y1", "x2", "y2", "width"],
  polygon: [],
  text: ["x", "y", "size", "tracking"],
};

function propInput(ly, key, value, cast, kind = "number") {
  return h("input", {
    type: kind, value,
    onfocus: pushUndo,
    oninput: (e) => {
      patchLayer(ly.id, { [key]: cast(e.target.value) });
      repaint();
      renderLayerList();
    },
  });
}

function renderProps() {
  const box = $("#props");
  box.replaceChildren();
  const ly = selected();
  if (!ly) {
    box.append(h("p", { class: "hint" }, "select a layer to edit it"));
    return;
  }
  box.append(h("label", { class: "row" }, h("span", {}, "name"), propInput(ly, "name", ly.name, String, "text")));
  const modeSel = h("select", {
    onchange: (e) => { pushUndo(); patchLayer(ly.id, { mode: e.target.value }); refresh(); },
  });
  for (const m of ["bits", "solid", "punch"])
    modeSel.append(h("option", { value: m, ...(m === ly.mode ? { selected: "" } : {}) }, m));
  box.append(h("label", { class: "row" }, h("span", {}, "mode"), modeSel));
  box.append(h("label", { class: "row" }, h("span", {}, "color"), propInput(ly, "color", ly.color, String, "color")));
  for (const key of NUM_FIELDS[ly.type])
    box.append(h("label", { class: "row" }, h("span", {}, key), propInput(ly, key, ly[key], Number)));
  if (ly.type === "polygon") {
    ly.points.forEach((p, i) => {
      const setPoint = (axis) => (e) => {
        const points = ly.points.map((q, j) => (j === i ? (axis ? [q[0], +e.target.value] : [+e.target.value, q[1]]) : q));
        patchLayer(ly.id, { points });
        repaint();
      };
      box.append(
        h("label", { class: "row" }, h("span", {}, `p${i + 1}`),
          h("input", { type: "number", value: p[0], onfocus: pushUndo, oninput: setPoint(0) }),
          h("input", { type: "number", value: p[1], onfocus: pushUndo, oninput: setPoint(1) }))
      );
    });
  }
  if (ly.type === "text") {
    box.append(h("label", { class: "row" }, h("span", {}, "text"), propInput(ly, "text", ly.text, String, "text")));
    const wSel = h("select", {
      onchange: (e) => { pushUndo(); patchLayer(ly.id, { weight: +e.target.value }); repaint(); },
    });
    for (const w of [100, 300, 400, 500, 700, 900])
      wSel.append(h("option", { value: w, ...(w === (ly.weight || 400) ? { selected: "" } : {}) }, w));
    box.append(h("label", { class: "row" }, h("span", {}, "weight"), wSel));
  }
}

// --- canvas interaction ------------------------------------------------------
let drag = null;

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) * state.doc.width) / r.width, ((e.clientY - r.top) * state.doc.height) / r.height];
}

canvas.addEventListener("pointerdown", (e) => {
  const [px, py] = canvasPoint(e);
  const hit = [...state.layers].reverse().find((ly) => {
    if (!ly.visible) return false;
    const [x, y, w, hh] = bboxOf(ly, ctx, state.doc.font);
    return px >= x && px <= x + w && py >= y && py <= y + hh;
  });
  state = { ...state, selectedId: hit ? hit.id : null };
  if (hit) {
    drag = { id: hit.id, lx: px, ly: py, moved: false };
    canvas.setPointerCapture(e.pointerId);
  }
  refresh();
});

canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const [px, py] = canvasPoint(e);
  const dx = px - drag.lx, dy = py - drag.ly;
  if (!drag.moved) {
    if (Math.hypot(dx, dy) < 3) return;
    pushUndo();
    drag.moved = true;
  }
  drag.lx = px;
  drag.ly = py;
  state = {
    ...state,
    layers: state.layers.map((l) => (l.id === drag.id ? movedLayer(l, dx, dy) : l)),
  };
  repaint();
});

canvas.addEventListener("pointerup", () => {
  if (drag && drag.moved) renderProps();
  drag = null;
});

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, select, textarea")) return;
  if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); return; }
  const ly = selected();
  if (!ly) return;
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteLayer(ly.id); return; }
  const step = e.shiftKey ? 20 : 3;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.key]) {
    e.preventDefault();
    pushUndo();
    state = { ...state, layers: state.layers.map((l) => (l.id === ly.id ? movedLayer(l, ...moves[e.key]) : l)) };
    repaint();
    renderProps();
  }
});

// --- header actions ----------------------------------------------------------
function wireHeader() {
  const presetSel = $("#preset");
  for (const name of Object.keys(PRESETS)) presetSel.append(h("option", { value: name }, name));
  presetSel.value = "usb trident";
  presetSel.addEventListener("change", () => {
    pushUndo();
    const p = PRESETS[presetSel.value]();
    state = { doc: p.doc, layers: p.layers, selectedId: null };
    refresh();
  });
  $("#undo").addEventListener("click", undo);
  $("#redo").addEventListener("click", redo);
  $("#png").addEventListener("click", () => exportPNG(state.doc, state.layers, +$("#pngscale").value));
  $("#svg").addEventListener("click", () => exportSVG(state.doc, state.layers));
  $("#save").addEventListener("click", () => exportJSON(state));
  $("#load").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const s = JSON.parse(text);
        if (!s.doc || !Array.isArray(s.layers)) throw new Error("not a bitfield file");
        pushUndo();
        state = { doc: { ...baseDoc(), ...s.doc }, layers: s.layers, selectedId: null };
        refresh();
      } catch (err) {
        alert("Could not load that file: " + err.message);
      }
      e.target.value = "";
    });
  });
}

// --- boot ---------------------------------------------------------------------
function refresh() {
  repaint();
  renderDocPanel();
  renderToolPanel();
  renderLayerList();
  renderProps();
}

wireHeader();
refresh();
document.fonts.ready.then(repaint);

// exposed for headless testing
window.bitfield = { getState: () => state, svgString };
