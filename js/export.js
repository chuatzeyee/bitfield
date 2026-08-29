import { computeCells, renderCanvas } from "./engine.js";

function download(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export function exportPNG(doc, layers, scale) {
  const cv = document.createElement("canvas");
  cv.width = Math.round(doc.width * scale);
  cv.height = Math.round(doc.height * scale);
  const c = cv.getContext("2d");
  c.scale(scale, scale);
  renderCanvas(c, doc, layers);
  cv.toBlob((b) => download("bitfield.png", b), "image/png");
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function svgShape(ly) {
  if (ly.type === "rect")
    return `<rect x="${ly.x}" y="${ly.y}" width="${ly.w}" height="${ly.h}" rx="${ly.rx || 0}" fill="${ly.color}"/>`;
  if (ly.type === "ellipse")
    return `<ellipse cx="${ly.x + ly.w / 2}" cy="${ly.y + ly.h / 2}" rx="${ly.w / 2}" ry="${ly.h / 2}" fill="${ly.color}"/>`;
  if (ly.type === "line")
    return `<line x1="${ly.x1}" y1="${ly.y1}" x2="${ly.x2}" y2="${ly.y2}" stroke="${ly.color}" stroke-width="${ly.width}" stroke-linecap="round"/>`;
  if (ly.type === "polygon")
    return `<polygon points="${ly.points.map((p) => p.join(",")).join(" ")}" fill="${ly.color}"/>`;
  return `<text x="${ly.x}" y="${ly.y}" font-size="${ly.size}" font-weight="${ly.weight || 400}" letter-spacing="${ly.tracking || 0}" fill="${ly.color}">${esc(ly.text)}</text>`;
}

export function svgString(doc, layers) {
  const out = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}" font-family="${esc(doc.font)}, serif">`,
    `<style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,100..900&amp;display=swap');</style>`,
    `<rect width="${doc.width}" height="${doc.height}" fill="${doc.bg}"/>`,
  ];
  const cells = computeCells(doc, layers);
  let run = null;
  const flush = () => {
    if (!run) return;
    out.push(
      `<text y="${run.y}" x="${run.xs.join(" ")}" font-size="${run.size}" font-weight="${run.wt}" fill="${run.color}" text-anchor="middle" dominant-baseline="central">${esc(run.chs.join(""))}</text>`
    );
    run = null;
  };
  for (const c of cells) {
    const wt = c.bold ? 900 : 400;
    if (!run || run.y !== c.y || run.color !== c.color || run.wt !== wt) {
      flush();
      run = { y: c.y, color: c.color, wt, size: c.bold ? doc.cell : Math.round(doc.cell * 0.85), xs: [], chs: [] };
    }
    run.xs.push(c.x);
    run.chs.push(c.ch);
  }
  flush();
  for (const ly of layers) if (ly.visible && ly.mode === "solid") out.push(svgShape(ly));
  out.push("</svg>");
  return out.join("\n");
}

export function exportSVG(doc, layers) {
  download("bitfield.svg", new Blob([svgString(doc, layers)], { type: "image/svg+xml" }));
}

export function exportJSON(state) {
  const data = JSON.stringify({ doc: state.doc, layers: state.layers }, null, 2);
  download("bitfield.json", new Blob([data], { type: "application/json" }));
}
