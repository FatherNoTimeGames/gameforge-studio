import type { SourceItem, VerificationVerdict, WikiPage } from '../types/index.ts';
import { autoFixPageFromSources, verifyWikiAgainstSources } from './aiService.ts';

export async function verifyAndRepairPages(options: {
  pages: WikiPage[];
  sources: SourceItem[];
  maxPasses: number;
  shouldStop: () => boolean;
  onVerdicts: (results: VerificationVerdict[]) => void;
  onRepair: (page: WikiPage, content: string) => void;
  onProgress: (pass: number, message: string, clean: number, resolved: number) => void;
  verify?: typeof verifyWikiAgainstSources;
  repair?: typeof autoFixPageFromSources;
}) {
  const { sources, maxPasses, shouldStop, onVerdicts, onRepair, onProgress } = options;
  const verify = options.verify || verifyWikiAgainstSources;
  const repair = options.repair || autoFixPageFromSources;
  let pages = options.pages.map((page) => ({ ...page }));
  let resolved = 0;
  for (let pass = 1; pass <= maxPasses && !shouldStop(); pass++) {
    onProgress(pass, `Pass ${pass}/${maxPasses}: Checking ${pages.length} pages against sources...`, 0, resolved);
    const results: VerificationVerdict[] = [];
    for (const page of pages) {
      if (shouldStop()) return;
      results.push(await verify(page, sources));
    }
    if (shouldStop()) return;
    onVerdicts(results);
    const clean = results.filter((result) => result.status === 'ok').length;
    if (clean === pages.length || pass === maxPasses) {
      onProgress(pass, `${clean}/${pages.length} pages passed the source checks.${clean < pages.length ? ' Review the remaining findings.' : ' Review important design decisions yourself.'}`, clean, resolved);
      return;
    }
    for (let index = 0; index < results.length && !shouldStop(); index++) {
      const verdict = results[index];
      if (verdict.status === 'ok') continue;
      const page = pages[index];
      onProgress(pass, `Pass ${pass}/${maxPasses}: Repairing "${page.title}" with GPT-6.1 Sol...`, clean, resolved);
      const content = await repair(page, verdict, sources);
      if (shouldStop()) return;
      onRepair(page, content);
      pages[index] = { ...page, content }; // Next pass must verify the repaired text.
      resolved += verdict.issues.length + verdict.unsupported.length;
      onProgress(pass, `Repaired "${page.title}". Rechecking...`, clean, resolved);
    }
  }
}
