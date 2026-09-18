import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderCanvas } from "../js/engine.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
GlobalFonts.registerFromPath(path.join(dir, "fonts/JetBrainsMono-Regular.ttf"), "JetBrains Mono");
GlobalFonts.registerFromPath(path.join(dir, "fonts/JetBrainsMono-Bold.ttf"), "JetBrains Mono");

// engine.js is written for a browser; give it just enough of `document` to run headless.
globalThis.document = {
  fonts: { check: () => true, load: () => {} },
  createElement: (tag) => {
    if (tag !== "canvas") throw new Error(`unsupported element: ${tag}`);
    return createCanvas(1, 1);
  },
};

function layoutHeadline(width, height, text, ink) {
  if (!text) return [];
  const size = Math.min(width / (text.length * 0.62), height * 0.45);
  const probe = createCanvas(1, 1).getContext("2d");
  probe.font = `900 ${size}px "JetBrains Mono"`;
  const w = probe.measureText(text).width;
  return [{
    id: "headline", type: "text", text, mode: "bits", visible: true,
    x: (width - w) / 2, y: height / 2 + size * 0.32,
    size, weight: 900, tracking: 0, color: ink,
  }];
}

export default function handler(req, res) {
  const q = req.query;
  const width = Number(q.width) || 1920;
  const height = Number(q.height) || 1080;
  const hex = (v, fallback) => "#" + (v || fallback);

  const doc = {
    width, height,
    cell: Number(q.cell) || 16,
    seed: q.seed || "KIOSK",
    charset: "01",
    bitSource: "random",
    message: "BITFIELD",
    pattern: q.pattern || "waves",
    density: Number(q.density) || 0.55,
    bg: hex(q.bg, "0a0f14"),
    faint: hex(q.faint, "1f6f5c"),
    showField: true,
    font: "JetBrains Mono",
  };
  const layers = layoutHeadline(width, height, q.text || "", hex(q.ink, "eafff5"));

  const canvas = createCanvas(width, height);
  renderCanvas(canvas.getContext("2d"), doc, layers);

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store");
  res.send(canvas.toBuffer("image/png"));
}
