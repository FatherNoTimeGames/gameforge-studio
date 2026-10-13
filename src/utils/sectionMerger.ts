export interface Section {
  heading: string | null;
  level: number;
  body: string;
}

export function splitSections(md: string): Section[] {
  const lines = String(md || '').split('\n');
  const secs: Section[] = [];
  let cur: Section = { heading: null, level: 0, body: '' };
  const curLines: string[] = [];

  let fence: { marker: string; length: number } | null = null;
  for (const ln of lines) {
    const marker = ln.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = { marker: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.marker && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      curLines.push(ln);
      continue;
    }
    const h = !fence && ln.match(/^(#{1,6})\s+(.*)$/);
    if (h && h[1].length >= 2) {
      cur.body = curLines.join('\n').trim();
      secs.push(cur);
      cur = { heading: h[2].trim(), level: h[1].length, body: '' };
      curLines.length = 0;
    } else {
      curLines.push(ln);
    }
  }

  cur.body = curLines.join('\n').trim();
  secs.push(cur);
  return secs.filter((s) => s.heading !== null || s.body.trim().length > 0);
}

const normH = (h: string | null) => {
  const raw = String(h || '').toLowerCase().trim();
  return raw.replace(/[^\p{L}\p{N}]+/gu, ' ').trim() || raw;
};

export function mergeSections(
  oldContent: string,
  newContent: string
): { merged: string; replaced: string[]; added: string[] } {
  const oldSecs = splitSections(oldContent);
  const newSecs = splitSections(newContent);
  const oldMap = new Map<string, number>();

  oldSecs.forEach((s, i) => {
    if (s.heading) oldMap.set(normH(s.heading), i);
  });

  const out = [...oldSecs.map((s) => ({ ...s }))];
  const replaced: string[] = [];
  const added: string[] = [];

  for (const ns of newSecs) {
    if (!ns.heading) continue;
    const k = normH(ns.heading);
    if (oldMap.has(k)) {
      const idx = oldMap.get(k)!;
      out[idx] = { ...ns };
      replaced.push(ns.heading);
    } else {
      out.push({ ...ns });
      added.push(ns.heading);
    }
  }

  const oldIntro = oldSecs.find((s) => !s.heading)?.body || '';
  const newIntro = newSecs.find((s) => !s.heading)?.body || '';
  if (!oldIntro.trim() && newIntro.trim()) {
    const ix = out.findIndex((s) => !s.heading);
    if (ix >= 0) out[ix] = { heading: null, level: 0, body: newIntro };
    else out.unshift({ heading: null, level: 0, body: newIntro });
  }

  const merged = out
    .map((s) =>
      s.heading
        ? `${'#'.repeat(Math.min(s.level || 2, 6))} ${s.heading}\n\n${s.body}`
        : s.body
    )
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return { merged, replaced, added };
}

export function parseWikiEditBlocks(text: string): { title: string; body: string }[] {
  const src = String(text || '');
  // Plain Markdown replies are supported too. Top-level page headings inside
  // code fences must not become separate wiki proposals.
  if (src.trimStart().startsWith('# ')) {
    const items: { title: string; body: string }[] = [];
    let fence: { marker: string; length: number } | null = null;
    let title = '', lines: string[] = [];
    for (const line of src.trim().split('\n')) {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (marker) {
        if (!fence) fence = { marker: marker[1][0], length: marker[1].length };
        else if (marker[1][0] === fence.marker && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      }
      const heading = !fence && line.match(/^#\s+(.+)$/);
      if (heading) {
        if (title) items.push({ title, body: lines.join('\n').trim() });
        title = heading[1].trim(); lines = [];
      }
      if (title) lines.push(line);
    }
    if (title) items.push({ title, body: lines.join('\n').trim() });
    return items;
  }

  const blocks: { body: string; end: number; claimed: boolean }[] = [];
  const fenceRe = /^ {0,3}(`{3,}|~{3,})([^\n]*)\n/gm;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(src)) !== null) {
    const opening = m[1];
    const language = m[2].trim().toLowerCase();
    const bodyStart = fenceRe.lastIndex;
    const closingRe = new RegExp(`^ {0,3}${opening[0]}{${opening.length},}[ \t]*$`, 'gm');
    closingRe.lastIndex = bodyStart;
    const close = closingRe.exec(src);
    if (!close) break;
    fenceRe.lastIndex = close.index + close[0].length;
    if (!language || ['markdown', 'md'].includes(language)) {
      blocks.push({ body: src.slice(bodyStart, close.index).trim(), end: fenceRe.lastIndex, claimed: false });
    }
  }

  const pasteRe = /^[ \t]*Paste into:[ \t]*(.+?)[ \t]*$/gim;
  const pastes: { title: string; idx: number }[] = [];
  while ((m = pasteRe.exec(src)) !== null) {
    pastes.push({ title: m[1].trim(), idx: m.index });
  }

  const isWiki = (b: string) => /^#\s+.+$/m.test(b);
  const items: { title: string; body: string }[] = [];

  for (const pl of pastes) {
    const cands = blocks.filter((b) => !b.claimed && b.end <= pl.idx && b.body.length >= 20);
    const pick = cands.filter((c) => isWiki(c.body)).pop() || (cands.length === 1 ? cands[0] : null);
    if (!pick) continue;
    pick.claimed = true;
    const title = pl.title.replace(/^["'\[{]+|["'\]}:]+$/g, '').trim() || 'Untitled';
    items.push({ title, body: pick.body });
  }

  // Fallback: if no "Paste into:" lines exist, find all markdown blocks that start with # Title
  if (!items.length) {
    for (const b of blocks) {
      const matchTitle = b.body.match(/^#\s+(.+)$/m);
      if (matchTitle) {
        items.push({
          title: matchTitle[1].replace(/^["'\[{]+|["'\]}:]+$/g, '').trim(),
          body: b.body
        });
      }
    }
  }


  return items;
}

export function extractFacts(md: string): { numbers: string[]; rows: string[]; links: string[] } {
  const t = String(md || '');
  const nums = [...t.matchAll(/(?<![\d.])[-+]?\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, ''));
  const rows = t
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^\|.*\|$/.test(l))
    .map((l) => l.replace(/\s+/g, ' ').toLowerCase());
  const links = [...t.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim().toLowerCase());
  return {
    numbers: [...new Set(nums)],
    rows: [...new Set(rows)],
    links: [...new Set(links)]
  };
}

export function checkCondenseOmissions(
  original: string,
  condensed: string
): {
  counts: { numbers: number; rows: number; links: number };
  missingNumbers: string[];
  missingRows: string[];
  missingLinks: string[];
} {
  const a = extractFacts(original);
  const b = extractFacts(condensed);
  const bNums = new Set(b.numbers);
  const bRows = new Set(b.rows);
  const bLinks = new Set(b.links);
  const condensedLow = String(condensed || '').toLowerCase();

  return {
    counts: { numbers: a.numbers.length, rows: a.rows.length, links: a.links.length },
    missingNumbers: a.numbers.filter((n) => !bNums.has(n)),
    missingRows: a.rows.filter((r) => !bRows.has(r)),
    missingLinks: a.links.filter((l) => !bLinks.has(l) && !condensedLow.includes(l))
  };
}

