#!/usr/bin/env node
/*
 * Export a lesson (lesson.json + extracted page images) to an editable PowerPoint deck.
 *
 * Usage:
 *   node export_pptx.js <lesson.json> <work_dir> <out.pptx> [--lang zh|ko|en] [--narration both|notes]
 *
 * Deck: title → contents → for each chapter: divider, one slide per step (page image,
 * key points, warning, the narration as on-slide text and as speaker notes), quiz slide
 * (answers in the notes) → glossary.
 * All slide text sits inside its own filled shape (no loose text boxes laid over shapes).
 */
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

/* ---------- args ---------- */
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('usage: node export_pptx.js <lesson.json> <work_dir> <out.pptx> [--lang xx] [--narration both|notes]');
  process.exit(1);
}
const [lessonPath, workDir, outPath] = args;
const opt = (name, def) => { const i = args.indexOf('--' + name); return i > -1 && args[i + 1] ? args[i + 1] : def; };
const RAW = JSON.parse(fs.readFileSync(lessonPath, 'utf8'));
const LANGS = (RAW.languages && RAW.languages.length ? RAW.languages : [RAW.language || 'zh']).map(x => String(x).slice(0, 2));
const LANG = (opt('lang', RAW.language || LANGS[0]) || 'zh').slice(0, 2);
const NARR = opt('narration', 'both');   // both = on slide + speaker notes; notes = notes only

/* ---------- localize multi-language lessons ---------- */
const LANG_KEYS = new Set(['zh', 'ko', 'en', 'ja']);
const isTr = o => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length > 0 &&
  Object.keys(o).every(k => LANGS.includes(k) || LANG_KEYS.has(k));
function loc(o) {
  if (Array.isArray(o)) return o.map(loc);
  if (isTr(o)) return loc(o[LANG] != null ? o[LANG] : o[Object.keys(o)[0]]);
  if (o && typeof o === 'object') { const r = {}; for (const k in o) r[k] = k === 'knowledge' ? o[k] : loc(o[k]); return r; }
  return o;
}
const L = loc(RAW);

/* ---------- labels & fonts ---------- */
const T = {
  zh: { ch: n => `第 ${n} 章`, toc: '目录', quiz: '小测验', gl: '术语', warn: '注意', narr: '讲解', ans: '答案', ref: '参考页',
        page: n => `第${n}页`, steps: n => `${n} 个步骤`, stats: (c, n) => `${c} 章 · ${n} 个步骤`, src: '资料', term: '术语', def: '说明', note: '讲解词（照读即可）' },
  ko: { ch: n => `${n}장`, toc: '목차', quiz: '퀴즈', gl: '용어', warn: '주의', narr: '설명', ans: '정답', ref: '참고 페이지',
        page: n => `${n}쪽`, steps: n => `${n}단계`, stats: (c, n) => `${c}개 장 · ${n}단계`, src: '자료', term: '용어', def: '설명', note: '설명 대본 (그대로 읽으면 됩니다)' },
  en: { ch: n => `Chapter ${n}`, toc: 'Contents', quiz: 'Quiz', gl: 'Glossary', warn: 'Caution', narr: 'Narration', ans: 'Answer', ref: 'Pages',
        page: n => `p.${n}`, steps: n => `${n} steps`, stats: (c, n) => `${c} chapters · ${n} steps`, src: 'Source', term: 'Term', def: 'Meaning', note: 'Speaker script' },
}[LANG] || null;
const S = T || {
  ch: n => `Chapter ${n}`, toc: 'Contents', quiz: 'Quiz', gl: 'Glossary', warn: 'Caution', narr: 'Narration', ans: 'Answer', ref: 'Pages',
  page: n => `p.${n}`, steps: n => `${n} steps`, stats: (c, n) => `${c} chapters · ${n} steps`, src: 'Source', term: 'Term', def: 'Meaning', note: 'Speaker script' };
const FONT = { zh: 'Microsoft YaHei', ko: 'Malgun Gothic', ja: 'Yu Gothic', en: 'Calibri' }[LANG] || 'Calibri';

/* ---------- palette (deep teal / navy, amber for warnings) ---------- */
const C = {
  dark: '14304A', dark2: '1D4766', accent: '0F8A8A', accentSoft: 'DDF1F0',
  ink: '1F2933', muted: '5B6B7A', panel: 'F1F5F8', white: 'FFFFFF',
  warnFill: 'FFF1D6', warnInk: '7A4A00', narrFill: 'EEF2F6', ok: '1F7A45',
};

/* ---------- geometry (LAYOUT_WIDE 13.333 x 7.5 in) ---------- */
const W = 13.333, H = 7.5, M = 0.5;

/* ---------- helpers ---------- */
function jpegSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] !== 0xFF || b[1] !== 0xD8) return null;
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
const pageFile = n => path.join(workDir, 'pages', `p${n}.jpg`);
function imageFor(n) {
  const f = pageFile(n);
  if (!n || !fs.existsSync(f)) return null;
  const s = jpegSize(f);
  return s ? { path: f, w: s.w, h: s.h } : null;
}
// rough text height estimate (CJK glyph ≈ 1 em, latin ≈ 0.52 em)
function lines(text, widthIn, pt) {
  const perLine = (widthIn * 72) / pt;
  let total = 0;
  for (const para of String(text).split('\n')) {
    let em = 0;
    for (const ch of para) em += /[\u1100-\u11ff\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(ch) ? 1 : 0.52;
    total += Math.max(1, Math.ceil(em / perLine));
  }
  return total;
}
const textH = (text, widthIn, pt, spacing = 1.3) => lines(text, widthIn, pt) * pt * spacing / 72;
function fitText(text, widthIn, maxH, sizes, pad) {
  for (const pt of sizes) { const h = textH(text, widthIn - pad * 2, pt) + pad * 2; if (h <= maxH) return { pt, h }; }
  const pt = sizes[sizes.length - 1];
  return { pt, h: textH(text, widthIn - pad * 2, pt) + pad * 2 };
}
const base = (extra) => Object.assign({ fontFace: FONT, color: C.ink, valign: 'top', margin: 10, paraSpaceAfter: 4 }, extra);

/* ---------- deck ---------- */
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.title = String(L.title || 'Lesson');
pres.subject = String(L.subtitle || '');
pres.author = 'manual-explainer';
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

pres.defineSlideMaster({
  title: 'CONTENT',
  background: { color: C.white },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.62, w: W - 2 * M, h: 0.72, fontFace: FONT, fontSize: 30, bold: true, color: C.dark, align: 'left', valign: 'middle', margin: 0 }, text: '' } },
  ],
  slideNumber: { x: W - 1.0, y: H - 0.42, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 10, color: C.muted, align: 'right' },
});
pres.defineSlideMaster({ title: 'DARK', background: { color: C.dark } });

const chapters = L.chapters || [];
const slideCount = { n: 0 };

/* title slide */
{
  const s = pres.addSlide({ masterName: 'DARK' }); slideCount.n++;
  s.addText(String(L.title || ''), { x: M + 0.3, y: 2.2, w: W - 2 * M - 0.6, h: 1.4, fontFace: FONT, fontSize: 40, bold: true, color: C.white, valign: 'bottom', margin: 0, fit: 'shrink', objectName: 'Title' });
  const sub = [L.subtitle, L.source_file ? `${S.src}: ${L.source_file}` : null].filter(Boolean).join('\n');
  if (sub) s.addText(sub, { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.12, x: M + 0.3, y: 3.95, w: 7.6, h: 1.0, fill: { color: C.dark2 }, line: { color: C.dark2 }, fontFace: FONT, fontSize: 16, color: 'D7E6F2', valign: 'middle', margin: 14, objectName: 'Subtitle' });
  s.addText(S.stats(chapters.length, chapters.reduce((a, c) => a + (c.steps || []).length, 0)), { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.12, x: M + 0.3, y: 5.2, w: 4.2, h: 0.55, fill: { color: C.accent }, line: { color: C.accent }, fontFace: FONT, fontSize: 14, bold: true, color: C.white, valign: 'middle', align: 'center', margin: 7, objectName: 'Stats' });
}

/* contents slide */
{
  const s = pres.addSlide({ masterName: 'CONTENT' }); slideCount.n++;
  s.addText(S.toc, { placeholder: 'title' });
  const n = chapters.length, cols = n > 5 ? 2 : 1, rows = Math.ceil(n / cols);
  const gap = 0.18, cw = (W - 2 * M - (cols - 1) * 0.4) / cols, ch = Math.min(0.9, (H - 1.7 - 0.6 - (rows - 1) * gap) / rows);
  chapters.forEach((c, i) => {
    const col = Math.floor(i / rows), row = i % rows;
    const x = M + col * (cw + 0.4), y = 1.65 + row * (ch + gap);
    s.addText([
      { text: `${i + 1}  `, options: { bold: true, color: C.accent, fontSize: 20 } },
      { text: String(c.title), options: { bold: true, color: C.ink, fontSize: 16 } },
      { text: `   ${S.steps((c.steps || []).length)}`, options: { color: C.muted, fontSize: 12 } },
    ], { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.1, x, y, w: cw, h: ch, fill: { color: C.panel }, line: { color: C.panel }, fontFace: FONT, valign: 'middle', margin: 14, fit: 'shrink', objectName: `Chapter ${i + 1}` });
  });
}

/* chapters */
chapters.forEach((c, ci) => {
  pres.addSection({ title: `${ci + 1}. ${c.title}` });
  const sec = `${ci + 1}. ${c.title}`;

  // divider
  {
    const s = pres.addSlide({ masterName: 'DARK', sectionTitle: sec }); slideCount.n++;
    s.addText(S.ch(ci + 1), { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.12, x: M + 0.3, y: 1.4, w: 2.4, h: 0.6, fill: { color: C.accent }, line: { color: C.accent }, fontFace: FONT, fontSize: 16, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 4, objectName: 'Chapter number' });
    s.addText(String(c.title), { x: M + 0.3, y: 2.2, w: W - 2 * M - 0.6, h: 1.2, fontFace: FONT, fontSize: 38, bold: true, color: C.white, valign: 'top', margin: 0, fit: 'shrink', objectName: 'Title' });
    const items = (c.steps || []).map((st, si) => ({ text: `${si + 1}. ${st.title}`, options: { breakLine: true } }));
    if (c.quiz && c.quiz.length) items.push({ text: `${items.length + 1}. ${S.quiz}`, options: { breakLine: true } });
    if (items.length) {
      items[items.length - 1].options.breakLine = false;
      const h = Math.min(H - 3.7 - 0.5, 0.42 * items.length + 0.4);
      s.addText(items, { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.12, x: M + 0.3, y: 3.6, w: 8.4, h, fill: { color: C.dark2 }, line: { color: C.dark2 }, fontFace: FONT, fontSize: 16, color: 'D7E6F2', valign: 'top', margin: 16, paraSpaceAfter: 4, fit: 'shrink', objectName: 'Steps' });
    }
  }

  // steps
  (c.steps || []).forEach((st, si) => {
    const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: sec }); slideCount.n++;
    s.addText(`${S.ch(ci + 1)} · ${c.title}   ${si + 1}/${(c.steps || []).length}`, { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x: M, y: 0.18, w: 5.6, h: 0.36, fill: { color: C.accentSoft }, line: { color: C.accentSoft }, fontFace: FONT, fontSize: 11, color: C.accent, bold: true, valign: 'middle', margin: 7, fit: 'shrink', objectName: 'Chapter label' });
    s.addText(String(st.title), { placeholder: 'title' });

    const top = 1.5, bottom = H - 0.55, leftW = 7.85, rightX = M + leftW + 0.3, rightW = W - M - rightX;
    const narr = String(st.narration || '');
    const showNarr = NARR !== 'notes' && narr;

    // left column: image + narration under it
    let narrBox = null;
    if (showNarr) {
      const f = fitText(`${S.narr}\n${narr}`, leftW, 2.4, [14, 13, 12], 0.16);
      narrBox = { h: Math.min(f.h, 2.6), pt: f.pt };
    }
    const img = imageFor(st.image);
    const imgAreaH = (bottom - top) - (narrBox ? narrBox.h + 0.2 : 0);
    if (img) {
      const r = Math.min(leftW / img.w, imgAreaH / img.h);
      const w = img.w * r, h = img.h * r;
      s.addImage({ path: img.path, x: M + (leftW - w) / 2, y: top + (imgAreaH - h) / 2, w, h, altText: S.page(st.image), objectName: 'Page image' });
      s.addText(S.page(st.image), { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, x: M + (leftW + w) / 2 - 0.95, y: top + (imgAreaH + h) / 2 - 0.36, w: 0.9, h: 0.3, fill: { color: C.dark, transparency: 20 }, line: { color: C.dark, transparency: 20 }, fontFace: FONT, fontSize: 10, color: C.white, align: 'center', valign: 'middle', margin: 0, objectName: 'Page tag' });
    }
    if (narrBox) {
      s.addText([
        { text: S.narr, options: { bold: true, color: C.accent, fontSize: narrBox.pt, breakLine: true } },
        { text: narr, options: { color: C.ink, fontSize: narrBox.pt } },
      ], base({ shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.1, x: M, y: bottom - narrBox.h, w: leftW, h: narrBox.h, fill: { color: C.narrFill }, line: { color: C.narrFill }, margin: 12, fit: 'shrink', objectName: 'Narration' }));
    }

    // right column: key points, warning, page refs
    let y = top;
    const avail = bottom - top;
    const refs = (st.page_refs || []).filter(n => n !== st.image);
    const refTxt = refs.length ? `${S.ref}: ${refs.map(S.page).join(', ')}` : '';
    const warnTxt = st.warning ? `⚠ ${S.warn}\n${st.warning}` : '';
    const warnFit = warnTxt ? fitText(warnTxt, rightW, avail * 0.45, [14, 13, 12], 0.16) : null;
    const refH = refTxt ? 0.42 : 0;
    const bullets = (st.bullets || []).map(String);
    if (bullets.length) {
      const maxH = avail - (warnFit ? warnFit.h + 0.2 : 0) - (refH ? refH + 0.2 : 0);
      const f = fitText(bullets.join('\n'), rightW - 0.25, maxH, [16, 15, 14, 13, 12], 0.18);
      const h = Math.min(maxH, f.h + 0.1);
      s.addText(bullets.map((b, i) => ({ text: b, options: { bullet: { indent: 14 }, breakLine: i < bullets.length - 1 } })),
        base({ shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.1, x: rightX, y, w: rightW, h, fill: { color: C.panel }, line: { color: C.panel }, fontSize: f.pt, margin: 13, paraSpaceAfter: 6, fit: 'shrink', objectName: 'Key points' }));
      y += h + 0.2;
    }
    if (warnFit) {
      s.addText([
        { text: `⚠ ${S.warn}`, options: { bold: true, breakLine: true } },
        { text: String(st.warning) },
      ], base({ shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.1, x: rightX, y, w: rightW, h: warnFit.h, fill: { color: C.warnFill }, line: { color: C.warnFill }, color: C.warnInk, fontSize: warnFit.pt, margin: 12, fit: 'shrink', objectName: 'Warning' }));
      y += warnFit.h + 0.2;
    }
    if (refTxt) {
      s.addText(refTxt, { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x: rightX, y: Math.max(y, bottom - refH), w: rightW, h: refH, fill: { color: C.accentSoft }, line: { color: C.accentSoft }, fontFace: FONT, fontSize: 11, color: C.accent, valign: 'middle', margin: 9, fit: 'shrink', objectName: 'Page references' });
    }

    // speaker notes = full narration (+ refs + warning)
    const notes = [narr, st.warning ? `\n[${S.warn}] ${st.warning}` : '', refs.length || st.image ? `\n[${S.ref}] ${[st.image].concat(refs).filter(Boolean).map(S.page).join(', ')}` : ''].join('');
    if (notes.trim()) s.addNotes(notes.trim());
  });

  // quiz
  if (c.quiz && c.quiz.length) {
    const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: sec }); slideCount.n++;
    s.addText(`${S.ch(ci + 1)} · ${c.title}`, { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x: M, y: 0.18, w: 5.6, h: 0.36, fill: { color: C.accentSoft }, line: { color: C.accentSoft }, fontFace: FONT, fontSize: 11, color: C.accent, bold: true, valign: 'middle', margin: 7, fit: 'shrink', objectName: 'Chapter label' });
    s.addText(`${S.quiz}`, { placeholder: 'title' });
    const qs = c.quiz.slice(0, 4), cols = qs.length > 1 ? 2 : 1, rows = Math.ceil(qs.length / cols);
    const gx = 0.3, gy = 0.25, cw = (W - 2 * M - (cols - 1) * gx) / cols, maxH = (H - 1.6 - 0.6 - (rows - 1) * gy) / rows;
    // cards only as tall as the longest question needs (same height for all, for a tidy grid)
    const need = Math.max(...qs.map(q => textH([q.q].concat(q.options || []).join('\n'), cw - 0.4, 16, 1.45) + 0.5));
    const chH = Math.min(maxH, Math.max(1.6, need));
    qs.forEach((q, qi) => {
      const col = qi % cols, row = Math.floor(qi / cols);
      const runs = [{ text: `${qi + 1}. ${q.q}`, options: { bold: true, breakLine: true } }];
      (q.options || []).forEach((o, oi) => runs.push({ text: `${String.fromCharCode(65 + oi)}. ${o}`, options: { breakLine: oi < q.options.length - 1 } }));
      const all = runs.map(r => r.text).join('\n');
      const f = fitText(all, cw, chH, [16, 15, 14, 13, 12], 0.2);
      s.addText(runs, base({ shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.12, x: M + col * (cw + gx), y: 1.6 + row * (chH + gy), w: cw, h: chH, fill: { color: C.panel }, line: { color: C.panel }, fontSize: f.pt, margin: 14, paraSpaceAfter: 6, fit: 'shrink', objectName: `Question ${qi + 1}` }));
    });
    s.addNotes(c.quiz.map((q, qi) => `${qi + 1}. ${q.q}\n${S.ans}: ${String.fromCharCode(65 + q.answer)}. ${(q.options || [])[q.answer]}${q.explain ? '\n' + q.explain : ''}`).join('\n\n'));
  }
});

/* glossary */
const gl = (L.glossary || []).filter(g => g && g.term);
for (let i = 0; i < gl.length; i += 10) {
  const part = gl.slice(i, i + 10);
  const s = pres.addSlide({ masterName: 'CONTENT' }); slideCount.n++;
  s.addText(gl.length > 10 ? `${S.gl} (${i / 10 + 1})` : S.gl, { placeholder: 'title' });
  const rows = [[
    { text: S.term, options: { bold: true, color: C.white, fill: { color: C.dark } } },
    { text: S.def, options: { bold: true, color: C.white, fill: { color: C.dark } } },
  ]].concat(part.map((g, k) => [
    { text: String(g.term), options: { bold: true, fill: { color: k % 2 ? C.white : C.panel } } },
    { text: String(g.def), options: { fill: { color: k % 2 ? C.white : C.panel } } },
  ]));
  s.addTable(rows, { x: M, y: 1.6, w: W - 2 * M, colW: [3.4, W - 2 * M - 3.4], fontFace: FONT, fontSize: 13, color: C.ink, border: { type: 'solid', pt: 0.5, color: 'D5DDE5' }, margin: 6, valign: 'middle', rowH: 0.42 });
}

// Write, then drop the ZIP's folder entries (cloud services such as SharePoint/OneDrive
// can refuse to open or co-edit decks that contain them).
(async () => {
  const buf = await pres.write({ outputType: 'nodebuffer' });
  let out = buf;
  try {
    const JSZip = require(require.resolve('jszip', { paths: [path.dirname(require.resolve('pptxgenjs'))] }));
    const zin = await JSZip.loadAsync(buf), zout = new JSZip();
    for (const name of Object.keys(zin.files)) {
      const f = zin.files[name];
      if (!f.dir) zout.file(name, await f.async('nodebuffer'), { createFolders: false });
    }
    out = await zout.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  } catch (e) { /* keep the original buffer */ }
  fs.writeFileSync(outPath, out);
  console.log(JSON.stringify({ out: outPath, slides: slideCount.n, chapters: chapters.length, language: LANG, narration: NARR }));
})();
