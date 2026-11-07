// Pure notebook helpers shared by the build (extract, census) and the in-browser Report Builder.
// Nothing here touches the DOM, so node can check it.

export const join = (t) => (Array.isArray(t) ? t.join('') : t ?? '');

export function parseNotebook(text) {
  let nb;
  try { nb = JSON.parse(text); } catch { throw new Error('This file is not valid JSON, so it is not a .ipynb notebook.'); }
  if (!nb || !Array.isArray(nb.cells)) throw new Error('No "cells" list found: this JSON is not a Jupyter notebook (nbformat 4).');
  return nb;
}

const isImage = (o) => typeof o.data?.['image/png'] === 'string' || Array.isArray(o.data?.['image/png']);

export function census(nb) {
  const c = { cells: nb.cells.length, markdown: 0, raw: 0, code: 0, outputs: 0, images: 0, errors: 0, executed: 0, codeLines: 0 };
  for (const cell of nb.cells) {
    if (cell.cell_type in c) c[cell.cell_type]++;
    if (cell.cell_type !== 'code') continue;
    if (cell.execution_count != null) c.executed++;
    const src = join(cell.source);
    if (src.trim()) c.codeLines += src.replace(/\n$/, '').split('\n').length;
    for (const o of cell.outputs || []) {
      c.outputs++;
      if (isImage(o)) c.images++;
      if (o.output_type === 'error') c.errors++;
    }
  }
  return c;
}

const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');
const B64 = /^[A-Za-z0-9+/=\s]+$/;

// Markdown/raw cells become heading and paragraph lines. HTML tags are dropped and the rest is
// rendered as text by React, so a dropped notebook can never inject markup.
function prose(src) {
  const lines = [];
  let para = [];
  const flush = () => { if (para.length) lines.push({ p: para.join(' ') }); para = []; };
  for (const raw of src.replace(/<[^>]*>/g, '').split('\n')) {
    const l = raw.trim();
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flush(); lines.push({ h: Math.min(h[1].length + 1, 4), text: h[2] }); }
    else if (/^([-*]|\d+\.)\s+/.test(l)) { flush(); lines.push({ li: l.replace(/^([-*]|\d+\.)\s+/, '') }); }
    else if (!l) flush();
    else para.push(l);
  }
  flush();
  return lines;
}

// Turn a notebook into report blocks, honouring the include toggles.
export function reportBlocks(nb, { prose: withProse = true, code = true, outputs = true } = {}) {
  const blocks = [];
  nb.cells.forEach((cell, i) => {
    const src = join(cell.source);
    if (cell.cell_type === 'markdown' || cell.cell_type === 'raw') {
      if (!withProse) return;
      const lines = prose(src);
      if (lines.length) blocks.push({ kind: 'prose', cell: i, lines });
      return;
    }
    if (cell.cell_type !== 'code') return;
    if (code && src.trim()) blocks.push({ kind: 'code', cell: i, text: src });
    if (!outputs) return;
    (cell.outputs || []).forEach((o, k) => {
      const key = `${i}-${k}`;
      if (o.output_type === 'stream') blocks.push({ kind: 'text', cell: i, key, text: stripAnsi(join(o.text)) });
      else if (o.output_type === 'error') blocks.push({ kind: 'error', cell: i, key, text: `${o.ename}: ${stripAnsi(o.evalue || '')}` });
      else if (isImage(o)) {
        const b64 = join(o.data['image/png']);
        if (B64.test(b64)) blocks.push({ kind: 'image', cell: i, key, src: `data:image/png;base64,${b64.replace(/\s/g, '')}` });
      } else if (o.data?.['text/plain']) blocks.push({ kind: 'text', cell: i, key, text: join(o.data['text/plain']) });
    });
  });
  return blocks;
}

// First comment line of a code cell, minus emoji and non-ASCII, used as a figure caption.
export function caption(cell) {
  const first = join(cell.source).split('\n').find((l) => l.trim().startsWith('#')) || '';
  const t = first.replace(/^\s*#+\s*/, '').replace(/[^\x20-\x7e]/g, '').trim();
  return /^\(.*\)$/.test(t) ? t.slice(1, -1) : t;
}
