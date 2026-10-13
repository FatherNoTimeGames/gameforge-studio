import type { WikiPage } from '../types/index.ts';

export function markdownExportFiles(pages: WikiPage[]) {
  const used = new Set<string>();
  return pages.map((page, index) => {
    const base = (page.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100) || `page_${index + 1}`).replace(/\.+$/, '_');
    let name = `${base}.md`, suffix = 2;
    while (used.has(name.toLowerCase())) name = `${base}_${suffix++}.md`;
    used.add(name.toLowerCase());
    const modified = new Date(page.lastModified);
    const content = `---\ntitle: ${JSON.stringify(page.title)}\ncategory: ${JSON.stringify(page.category || 'General')}\nlastModified: ${JSON.stringify(Number.isFinite(modified.getTime()) ? modified.toISOString() : '')}\n---\n\n${page.content}`;
    return { name, content };
  });
}
