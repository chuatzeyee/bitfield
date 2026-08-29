let idSeq = 1;
export const nid = () => "L" + Date.now().toString(36) + "_" + idSeq++;

const layer = (props) => ({
  id: nid(),
  name: props.name || props.type,
  visible: true,
  mode: "bits",
  color: "#141414",
  ...props,
});

export function baseDoc(over = {}) {
  return {
    width: 1400,
    height: 990,
    cell: 22,
    seed: "GENEO",
    charset: "01",
    bitSource: "random",
    message: "BITFIELD",
    pattern: "random",
    density: 1,
    bg: "#faf6ec",
    faint: "#e6d5a4",
    showField: true,
    font: "Canela",
    ...over,
  };
}

const RED = "#ba2029";
const INK = "#141414";
const YELLOW = "#eab30f";

export const PRESETS = {
  "usb trident": () => ({
    doc: baseDoc(),
    layers: [
      layer({ name: "stem", type: "line", x1: 700, y1: 860, x2: 700, y2: 300, width: 90, color: INK }),
      layer({ name: "left branch", type: "line", x1: 700, y1: 740, x2: 420, y2: 540, width: 90, color: INK }),
      layer({ name: "right branch", type: "line", x1: 700, y1: 620, x2: 980, y2: 430, width: 90, color: INK }),
      layer({ name: "arrowhead", type: "polygon", points: [[560, 330], [840, 330], [700, 120]], color: RED }),
      layer({ name: "circle end", type: "ellipse", x: 260, y: 380, w: 150, h: 150, color: RED }),
      layer({ name: "square end", type: "rect", x: 1000, y: 280, w: 140, h: 140, rx: 0, color: RED }),
      layer({ name: "tail", type: "ellipse", x: 635, y: 845, w: 130, h: 120, color: RED }),
    ],
  }),
  heart: () => ({
    doc: baseDoc({ seed: "LOVE", pattern: "rings" }),
    layers: [
      layer({ name: "left lobe", type: "ellipse", x: 420, y: 220, w: 330, h: 330, color: RED }),
      layer({ name: "right lobe", type: "ellipse", x: 650, y: 220, w: 330, h: 330, color: RED }),
      layer({ name: "point", type: "polygon", points: [[440, 460], [960, 460], [700, 840]], color: RED }),
    ],
  }),
  smiley: () => ({
    doc: baseDoc({ seed: "GRIN", pattern: "waves" }),
    layers: [
      layer({ name: "face", type: "ellipse", x: 440, y: 230, w: 520, h: 520, color: YELLOW }),
      layer({ name: "left eye", type: "ellipse", x: 590, y: 370, w: 60, h: 100, mode: "punch" }),
      layer({ name: "right eye", type: "ellipse", x: 750, y: 370, w: 60, h: 100, mode: "punch" }),
      layer({ name: "mouth", type: "ellipse", x: 570, y: 520, w: 260, h: 140, mode: "punch" }),
      layer({ name: "mouth top", type: "rect", x: 550, y: 490, w: 300, h: 90, mode: "punch", color: INK }),
    ],
  }),
  headline: () => ({
    doc: baseDoc({ seed: "TYPE", pattern: "gradient down", density: 0.9 }),
    layers: [
      layer({ name: "big word", type: "text", text: "HELLO", x: 160, y: 600, size: 310, weight: 900, tracking: 6, color: INK }),
      layer({ name: "kicker", type: "text", text: "BINARY FIELD STUDIO", x: 170, y: 760, size: 52, weight: 500, tracking: 22, mode: "solid", color: RED }),
    ],
  }),
  blank: () => ({ doc: baseDoc({ seed: "SEED" }), layers: [] }),
};

export function defaultState() {
  const p = PRESETS["usb trident"]();
  return { doc: p.doc, layers: p.layers, selectedId: null };
}
