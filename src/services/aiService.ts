import type { ActionType, ChatMessage, SourceItem, TargetEngine, VerificationVerdict, WikiPage } from '../types/index.ts';

export interface GenerateAssistantParams {
  actionType: ActionType;
  prompt: string;
  pages: WikiPage[];
  targetEngine: TargetEngine;
  notepadContent?: string;
  chatHistory?: ChatMessage[];
  imageBase64?: string;
  imageMimeType?: string;
}

export interface AssistantResponse {
  text: string;
  modelUsed?: string;
}


import { aiGenerate, fetchRemoteText } from './ai.ts';
const requestAi = aiGenerate;

// Token-saving Smart Tiered Context Assembly with Hierarchy Awareness and GitHub Wiki link parsing
export function assembleWikiContext(pages: WikiPage[], query: string = ''): string {
  if (!pages.length) return '(No wiki pages yet.)';

  const queryLower = (query || '').toLowerCase();
  const mentions: string[] = [];

  // Match both GitHub Wiki format [[display text|Page Title]] and standard [[Page Title]]
  const mentionRe = /\[\[(?:([^\]|]+)\|)?([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = mentionRe.exec(queryLower)) !== null) {
    // In GitHub format: group 2 is target page; if no pipe, group 2 is also the title
    const target = m[2].trim();
    mentions.push(target);
    if (m[1]) mentions.push(m[1].trim());
  }

  const queryTerms = queryLower
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !['how', 'what', 'why', 'the', 'and', 'for', 'with', 'page', 'system'].includes(w));

  const home = pages.find((p) => p.title.toLowerCase() === 'home');
  const fullPages: WikiPage[] = [];
  const summarizedPages: WikiPage[] = [];

  pages.forEach((p) => {
    const titleLower = p.title.toLowerCase();
    const isHome = p === home;
    const isMentioned = mentions.some((men) => titleLower.includes(men) || men.includes(titleLower));
    const termMatches = queryTerms.some(
      (term) =>
        titleLower.includes(term) ||
        (p.keywords || []).some((k) => k.toLowerCase().includes(term))
    );

    if (pages.length <= 8 || isHome || isMentioned || termMatches) {
      fullPages.push(p);
    } else {
      summarizedPages.push(p);
    }
  });

  // Build hierarchical index tree
  const parentMap = new Map<string, WikiPage[]>();
  const topLevelPages: WikiPage[] = [];

  pages.forEach((p) => {
    if (p.parentId) {
      const children = parentMap.get(p.parentId) || [];
      children.push(p);
      parentMap.set(p.parentId, children);
    } else {
      topLevelPages.push(p);
    }
  });

  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const visited = new Set<string>();
  const index: string[] = [];
  const appendPage = (page: WikiPage, depth: number) => {
    if (visited.has(page.id)) return;
    visited.add(page.id);
    index.push(`${'  '.repeat(depth)}- [[${page.title}]] | Cat: ${page.category || 'Core'} | ${page.summary || page.content.slice(0, 140).replace(/[\n#]/g, ' ').trim()}`);
    for (const child of parentMap.get(page.id) || []) appendPage(child, depth + 1);
  };
  topLevelPages.forEach((page) => appendPage(page, 0));
  pages.forEach((page) => appendPage(page, 0)); // Include orphaned or cyclic legacy pages.
  const indexLines = index.join('\n');

  let fullBody = '';
  fullPages.forEach((p) => {
    const parent = p.parentId ? pagesById.get(p.parentId) : null;
    fullBody += `### PAGE: ${p.title}${parent ? ` (Subpage of ${parent.title})` : ''} [Category: ${p.category || 'General'}]\n${p.content}\n\n---\n\n`;
  });

  let sumBody = '';
  if (summarizedPages.length > 0) {
    sumBody = `\n\n=== SUMMARIZED WIKI SYSTEMS & SUBPAGES ===\n` +
      summarizedPages
        .map((p) => `* **${p.title}**: ${p.summary || p.content.slice(0, 180).replace(/[\n#]/g, ' ').trim()}`)
        .join('\n');
  }

  return `=== COMPLETE WIKI HIERARCHY TREE (${pages.length} pages/subpages) ===\n${indexLines}\n\n=== VERBATIM GDD SPECIFICATIONS (PRIMARY CONTEXT) ===\n${fullBody}${sumBody}`;
}

// Alias kept for component call sites; implementation lives in services/ai.ts.
export const proxyFetchUrl = fetchRemoteText;

export async function requestAssistantResponse(
  params: GenerateAssistantParams
): Promise<AssistantResponse> {
  const {
    actionType,
    prompt,
    pages,
    targetEngine,
    notepadContent,
    chatHistory,
    imageBase64,
    imageMimeType
  } = params;

  const wikiContext = assembleWikiContext(pages, prompt);

  // Format recent conversation history so the assistant maintains continuity and tracks user mastery
  let chatContextStr = '';
  if (chatHistory && chatHistory.length > 0) {
    const recent = chatHistory.slice(-8);
    chatContextStr =
      `\n\n=== RECENT CONVERSATION HISTORY (CONTINUITY & MASTERY TRACKING) ===\n` +
      recent
        .map(
          (m) =>
            `[${m.role.toUpperCase()} - ${m.actionType}]: ${m.text.slice(0, 1400)}`
        )
        .join('\n\n') +
      `\n=== END OF CONVERSATION HISTORY ===\n`;
  }

  // Format private working scratchpad / notes
  let scratchpadStr = '';
  if (notepadContent && notepadContent.trim()) {
    scratchpadStr = `\n\n=== PRIVATE WORKING SCRATCHPAD & TECHNICAL NOTES ===\n${notepadContent.slice(
      0,
      3000
    )}\n=== END SCRATCHPAD ===\n`;
  }

  let systemInstruction = '';
  let fullPrompt = prompt;

  if (actionType === 'discuss') {
    systemInstruction = `You are my co-developer and concept companion.
The wiki is our source of truth, but we build it conversationally: discuss every detail, explore all options, and update full page text as we agree.
Periodically recompile and restate the complete current text of affected pages in your reply to keep context fresh and prevent continuity errors.
Use the Socratic method to help build out the concept.
Never cap questions, never decide unilaterally, never "move on" until I agree; keep decisions open until we settle them together.
Be challenging and candid; prioritize accuracy and continuity over being supportive.
Ask clarifying questions freely.
Ground feedback in community consensus when findable; label consensus vs. opinion.
Balance fun, feasibility.

GITHUB WIKI INLINE LINKING & SUBPAGE ORGANIZATION:
- When referencing mechanics, stats, systems, or formulas (e.g. "strength", "stamina", "poise", "phase dodge", "hitstop"), use GitHub Wiki format [[display text|Target Page Title]] or [[Target Page Title]].
  Example: "scales with your [[strength|Strength & Poise]] attribute".
- When a sub-feature grows extensive, recommend organizing it as a dedicated subpage under the parent system.
- When proposing concrete updates to wiki pages, present the complete, updated markdown in a fenced \`\`\`markdown block starting with "# <Exact Title>" followed immediately on the next line outside the fence by:
Paste into: <exact page title>
(Optional if subpage: Parent: <parent page title>)
This allows the user to review and apply it directly to the wiki with one click.
- Close proposal messages with an agreement prompt (e.g. "If you agree, say the word and click 'Agree & Apply to Wiki' to lock this into our design document.")

Target Game Engine: ${targetEngine.name} (${targetEngine.lang})

${wikiContext}${chatContextStr}${scratchpadStr}`;
  } else if (actionType === 'recompile') {
    systemInstruction = `You are my co-developer and concept companion, acting as Systems Architect.
Your task is to RECOMPILE and restate the complete current text of affected pages in your reply to keep context fresh and prevent continuity errors.
The wiki is our source of truth.
For EVERY page/subpage affected:
- Restate its FULL current text starting with "# <Exact Title>" in a fenced \`\`\`markdown block.
- Place intelligent GitHub Wiki inline links [[display text|Target Page Title]] or [[Target Page Title]].
- AFTER each page fence, output on a new line: "Paste into: <exact page title>".
- If it is a subpage, add on the next line: "Parent: <parent page title>".
- Explicitly highlight any open, unresolved design questions with "> Open: ...".
- Keep decisions open until we settle them together.

${wikiContext}${chatContextStr}${scratchpadStr}`;
    fullPrompt = prompt || 'Please recompile and audit our game design document from our discussion.';
  } else if (actionType === 'balance') {
    systemInstruction = `You are my co-developer and concept companion, acting as Quantitative Balance Designer and Mathematical Systems Modeler.
The wiki is our source of truth, but we build and balance it conversationally.
Your task is to stress-test numerical parameters, frame data, recharge curves, damage scaling, time-to-kill (TTK), stamina burnout penalties, and economic sinks.
Point out edge cases (infinite dashing, stamina starvation lockouts, death spirals), with concrete tuning formulas and comparison tables.
Be challenging and candid: prioritize accuracy and continuity over being supportive.
Ground balancing metrics in community consensus and genre standards when available (label consensus vs. designer opinion).
Use GitHub Wiki inline links [[display text|Target Page Title]] or [[Target Page Title]] for all stats and mechanics.
When proposing revised stat blocks or tables, provide the complete revised section or page inside a fenced \`\`\`markdown block followed by "Paste into: <exact page title>" so it can be merged directly into the wiki.

${wikiContext}${chatContextStr}${scratchpadStr}`;
    fullPrompt =
      prompt || 'Analyze our combat numbers and stamina economy for balance exploits or pacing issues.';
  } else if (actionType === 'teach') {
    systemInstruction = `You are a Senior Game Developer, Engine Architect, and Pedagogical Code Teacher specializing in ${targetEngine.name} (${targetEngine.lang}).

DIRECTIVE:
1. WORK STEP-BY-STEP WITH PEDAGOGICAL CLARITY:
   - Walk through the implementation step by step, clearly explaining every aspect of the code, how each line works, and why it is structured that way in ${targetEngine.name}.
   - Break scripts into logical modules and lifecycle steps (e.g. initialization, input gathering, physics processing, signal dispatch, state transitions).
2. ADAPT TO CONVERSATION & PROJECT HISTORY:
   - Carefully inspect the conversation history and code scratchpad to see what concepts, nodes, inputs, and mechanics the user has already mastered.
   - Hopefully as the project builds, adapt to what the user should now be able to do so production speeds up bit by bit based on that, but in a gentle, supportive way.
   - Gently taper basic repetitive explanations for patterns already demonstrated, while remaining thorough, pedagogical, and clear on any newly introduced systems or tricky edge cases.
3. STRICT WIKI SPEC GROUNDING:
   - Variable names, formulas, timing windows (frames/ms), friction curves, and state flags MUST strictly adhere to the parameters in the GDD WIKI CONTEXT.
4. ENGINE-NATIVE BEST PRACTICES (${targetEngine.name} - ${targetEngine.lang}):
   - For Godot 4: Modern GDScript 2.0 with static typing (var x: float = ...), @export variables, typed signals, CharacterBody2D/3D velocity and move_and_slide(), and clean Node hierarchies.
   - For Unity: Modern C#, [SerializeField], Actions/Events, FixedUpdate for physics, ScriptableObjects for data.
   - For Unreal/Phaser/Pygame/Bevy: Idiomatic, clean, production-grade architecture.
5. SCREENSHOT & ERROR ASSISTANCE:
   - If a screenshot is attached (engine error, stack trace, inspector, node tree), inspect it directly and provide the exact diagnostic cause and step-by-step fix.

Target Engine: ${targetEngine.name}
Language: ${targetEngine.lang}

${wikiContext}${chatContextStr}${scratchpadStr}`;
  } else if (actionType === 'wiki_edit') {
    systemInstruction = `You are my co-developer and concept companion, acting as Lead Technical Writer.
Your task is to propose clean, copy-ready wiki updates matching our project's exact markdown standard.
RULES FOR GITHUB WIKI INLINE LINKING & SUBPAGES:
- GITHUB WIKI INLINE LINKING: When referencing any concept, mechanic, parameter, or stat defined in another page or subpage (e.g. "strength", "poise", "stamina", "phase dodge", "hitstop"), you MUST create an in-text link using GitHub Wiki format:
  [[display text|Target Page Title]] or [[Target Page Title]].
  Example: write "scales with player [[strength|Strength & Poise]]" or "causes a [[hitstop|Damage & Hitstop Formulas]] freeze frame".
- SUBPAGES: If a sub-topic has extensive standalone mechanics, specify it as a subpage.
Output in this structure:
1. 1-2 sentences explaining what changed and why.
2. For each affected page, output a fenced \`\`\`markdown block starting with "# <Exact Title>".
3. Immediately after each markdown block, on a new line OUTSIDE the fence, write:
Paste into: <exact page title>
(Optional if subpage: Parent: <parent page title>)

${wikiContext}${chatContextStr}${scratchpadStr}`;
    fullPrompt = `Generate a structured wiki documentation update for: ${prompt}`;
  } else if (actionType === 'test_logic') {
    systemInstruction = `You are a Game Quality Assurance and Systems Logic Engineer specializing in ${targetEngine.name}.
Generate unit test scripts, state machine edge-case verification, or automated logic tests for the specified mechanic.
Work step by step, explaining test fixtures, inputs, and expected outcomes.
Adapt to existing project history and patterns.

Target Engine: ${targetEngine.name}

${wikiContext}${chatContextStr}${scratchpadStr}`;
  } else if (actionType === 'apply_agreed') {
    systemInstruction = `You are my co-developer and concept companion.
The user just agreed to a design proposal! Output the FULL updated markdown for all affected pages and subpages to keep continuity 100% clean.
Ensure all cross-references to stats, systems, and subpages have intelligent GitHub Wiki inline links [[display text|Target Page Title]] or [[Target Page Title]].
For EACH affected page, output:
\`\`\`markdown
# <Exact Title>
## Section...
\`\`\`
Followed on a new line outside the fence by:
Paste into: <exact page title>
(Optional if subpage: Parent: <parent page title>)

${wikiContext}${chatContextStr}${scratchpadStr}`;
  }

  const data = await requestAi({
      prompt: fullPrompt,
      systemInstruction,
      imageBase64,
      imageMimeType
  });
  return {
    text: data.text || '',
    modelUsed: data.modelUsed
  };
}

// Build wiki pages and subpages from sources with intelligent GitHub Wiki inline links
export async function buildWikiFromSources(
  sources: SourceItem[],
  existingPages: WikiPage[],
  replaceMode = false
): Promise<{ title: string; content: string; parentTitle?: string }[]> {
  const combinedSourcesText = sources
    .map((s, idx) => `=== SOURCE ${idx + 1}: ${s.title} (${s.kind}) ===\n${s.text}`)
    .join('\n\n');

  const knownTitles = (replaceMode ? [] : existingPages).map((p) => p.title).join(', ');

  const systemInstruction = `You are an expert Game Systems Architect.
Convert the provided SOURCE materials into clean, cohesive Game Design Document (GDD) wiki pages and SUBPAGES.
CRITICAL RULES FOR ORGANIZATION & GITHUB WIKI INLINE LINKING:
1. SUBPAGES & HIERARCHY:
   - Identify core parent systems (e.g. "Combat System", "Player Controller", "Stats & Attributes").
   - If a topic within a parent system has deep, dedicated rules (e.g. "Damage & Hitstop Formulas" under Combat, or "Strength & Poise" under Stats), output it as a SUBPAGE by providing "parentTitle": "<Parent Page Title>".
2. GITHUB WIKI INLINE (IN-TEXT) LINKING:
   - Make intelligent decisions about where to place in-text links!
   - Follow GitHub Wiki format: [[display text|Target Page Title]] or [[Target Page Title]].
   - Example: "...scales with player [[strength|Strength & Poise]] and triggers a [[stagger|Combat & Stamina System]]".
3. OUTPUT FORMAT:
   - Output a STRICT JSON object with a "pages" array of objects:
     [
       {
         "title": "Combat System",
         "content": "# Combat System\\n\\n## Overview\\n..."
       },
       {
         "title": "Damage & Hitstop Formulas",
         "parentTitle": "Combat System",
         "content": "# Damage & Hitstop Formulas\\n\\n## Formulas\\n..."
       }
     ]
   - Content starts with "# Title", followed by ## Overview, ## Mechanics, ## Data tables, ## Edge Cases.
   - Known titles to align with: ${knownTitles || 'None yet'}
   - Wrap the array in {"pages": [...]}. Set parentTitle to null for top-level pages.
   - STRICT JSON ONLY. No prose or markdown fences.`;

  const data = await requestAi({
      prompt: `Transform these sources into structured, hierarchically organized game design pages with intelligent GitHub Wiki inline linking:\n\n${combinedSourcesText}`,
      systemInstruction,
      outputKind: 'wiki_build',
  });
  let rawText = (data.text || '').trim();

  const fenceMatch = rawText.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
  if (fenceMatch) rawText = fenceMatch[1].trim();

  try {
    const decoded = JSON.parse(rawText);
    const parsed = Array.isArray(decoded) ? decoded : decoded.pages;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: Record<string, unknown>) => ({
        title: String(item.title || 'Untitled System'),
        parentTitle: item.parentTitle ? String(item.parentTitle) : undefined,
        content: String(item.content || '')
      }));
    }
  } catch (e) {
    const titleRegex = /^#\s+(.+?)$/gm;
    let match;
    const items: { title: string; content: string }[] = [];
    const indices: { title: string; start: number }[] = [];

    while ((match = titleRegex.exec(rawText)) !== null) {
      indices.push({ title: match[1].trim(), start: match.index });
    }

    for (let i = 0; i < indices.length; i++) {
      const end = i + 1 < indices.length ? indices[i + 1].start : rawText.length;
      const body = rawText.slice(indices[i].start, end).trim();
      items.push({ title: indices[i].title, content: body });
    }

    if (items.length > 0) return items;
  }

  throw new Error('AI returned an unparseable response. Try running build with fewer sources.');
}

// Auto-link wiki references using GitHub Wiki format: [[display text|Target Page Title]]
export function autoLinkWikiReferences(text: string, pages: WikiPage[], currentPageId: string): string {
  const titles = [...pages].filter((p) => p.id !== currentPageId && p.title.length > 2).sort((a, b) => b.title.length - a.title.length);
  if (!titles.length) return text;
  const escaped = titles.map((p) => p.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const titlePattern = new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  const byTitle = new Map(titles.map((p) => [p.title.toLowerCase(), p.title]));
  const protectedPattern = /(^`{3,}[^\n]*\n[\s\S]*?^`{3,}[^\n]*$|^~{3,}[^\n]*\n[\s\S]*?^~{3,}[^\n]*$|`+[^`\n]*`+|\[\[[^\]]+\]\]|!?\[[^\]]*\]\([^)]*\)|^#{1,6} .*$|<[^>]*>)/gm;
  return text.split(protectedPattern).map((part, index) => {
    if (index % 2) return part;
    return part.replace(titlePattern, (match) => {
      const title = byTitle.get(match.toLowerCase())!;
      return match === title ? `[[${title}]]` : `[[${match}|${title}]]`;
    });
  }).join('');
}

// Verify single wiki page against sources
export async function verifyWikiAgainstSources(
  page: WikiPage,
  sources: SourceItem[]
): Promise<VerificationVerdict> {
  const sourcesText = sources
    .map((s) => `--- SOURCE: ${s.title} ---\n${s.text}`)
    .join('\n\n');

  const systemInstruction = `You are a strict game design fact-checker.
Compare this single GDD wiki page against the provided SOURCE excerpts (ground truth).
Output a STRICT JSON object ONLY:
{
  "status": "ok" | "warning" | "error",
  "issues": ["any contradictions or inconsistencies"],
  "unsupported": ["claims with no evidence in the sources"],
  "missing": ["crucial details in sources omitted by this page"]
}
- "ok" = all numbers and mechanics are fully backed by sources.
- "warning" = minor wording differences or minor gaps.
- "error" = contradicted numbers or invented rules.
Output STRICT JSON ONLY.`;

  const data = await requestAi({
      prompt: `WIKI PAGE TO CHECK:\n# ${page.title}\n${page.content}\n\nSOURCES (GROUND TRUTH):\n${sourcesText}`,
      systemInstruction,
      outputKind: 'verification',
  });
  let rawText = (data.text || '').trim();
  const fence = rawText.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
  if (fence) rawText = fence[1].trim();

  try {
    const parsed = JSON.parse(rawText);
    return {
      title: page.title,
      status: ['ok', 'warning', 'error'].includes(parsed.status) ? parsed.status : 'warning',
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      unsupported: Array.isArray(parsed.unsupported) ? parsed.unsupported : [],
      missing: Array.isArray(parsed.missing) ? parsed.missing : []
    };
  } catch {
    return {
      title: page.title,
      status: 'warning',
      issues: [rawText.slice(0, 300)],
      unsupported: [],
      missing: []
    };
  }
}

// Auto-fix a page based on a verification verdict and sources
export async function autoFixPageFromSources(
  page: WikiPage,
  verdict: VerificationVerdict,
  sources: SourceItem[]
): Promise<string> {
  const sourcesText = sources
    .map((s) => `--- SOURCE: ${s.title} ---\n${s.text}`)
    .join('\n\n');

  const findings = [
    ...verdict.issues.map((i) => `ISSUE: ${i}`),
    ...verdict.unsupported.map((u) => `UNSUPPORTED: ${u}`),
    ...verdict.missing.map((m) => `MISSING TOPIC: ${m}`)
  ].join('\n- ');

  const systemInstruction = `You are a Game Technical Editor fixing ONE game design wiki page from a fact-check report.
CRITICAL RULES:
- Correct every claim flagged in the report so it aligns 100% with the SOURCE EXCERPTS.
- Maintain intelligent GitHub Wiki inline links [[display text|Target Page Title]] to other pages and subpages.
- Keep all valid numbers, tables, formulas, and headings from the original page.
- Output ONLY the corrected full page markdown starting with "# ${page.title}".
- Do not output JSON, do not output explanations outside the page.`;

  const data = await requestAi({
      prompt: `ORIGINAL PAGE:\n# ${page.title}\n${page.content}\n\nFINDINGS TO RESOLVE:\n- ${findings}\n\nSOURCE EXCERPTS (GROUND TRUTH):\n${sourcesText}`,
      systemInstruction,
  });
  let fixedText = (data.text || '').trim();
  const fence = fixedText.match(/```(?:markdown|md)?[^\S\n]*\n([\s\S]*?)```/i);
  if (fence) fixedText = fence[1].trim();

  if (!fixedText.startsWith('#')) {
    fixedText = `# ${page.title}\n\n` + fixedText;
  }

  return fixedText;
}

// Generate index for 1 page
export async function generateIndexForPage(
  page: WikiPage
): Promise<{ summary: string; keywords: string[] }> {
  const systemInstruction = `You are indexing ONE game design wiki page for fast retrieval.
Read it and output STRICT JSON ONLY:
{
  "summary": "2-3 concise lines describing what this page defines and its key parameters/numbers",
  "keywords": ["5-10 key terms, system names, mechanics, or stats"]
}`;

  const data = await requestAi({
      prompt: `# ${page.title}\n${page.content}`,
      systemInstruction,
      outputKind: 'index',
  });
  let rawText = (data.text || '').trim();
  const fence = rawText.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
  if (fence) rawText = fence[1].trim();

  try {
    const parsed = JSON.parse(rawText);
    return {
      summary: String(parsed.summary || '').slice(0, 400),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String).slice(0, 10) : []
    };
  } catch {
    return {
      summary: rawText.slice(0, 300),
      keywords: [page.title]
    };
  }
}

// Condense selected page without losing facts/numbers
export async function condenseWikiPage(page: WikiPage): Promise<string> {
  const systemInstruction = `You are a Game Technical Editor tightening ONE game wiki page WITHOUT losing information.
CRITICAL RULES:
- Keep EVERY fact, number, stat, damage value, cooldown, table row, and formula.
- Preserve all in-text GitHub Wiki links [[display text|Target Page Title]] and cross-references.
- Cut fluff and repetition only.
- Output ONLY the rewritten markdown starting with "# ${page.title}". No JSON, no prose outside the page.`;

  const data = await requestAi({
      prompt: `# ${page.title}\n${page.content}`,
      systemInstruction,
  });
  return (data.text || '').trim();
}

// Auto-name project in 2-4 words from Home page
export async function autoNameProject(homeContent: string, pageTitles: string[]): Promise<string> {
  const data = await requestAi({
      prompt: `Name a game project in 2-4 words based on this design document (plain title only, no quotes, no punctuation).
Home Premise: ${homeContent.slice(0, 1000)}
Pages: ${pageTitles.join(', ')}`,
  });
  return (data.text || '').trim().replace(/^["']|["']$/g, '').slice(0, 40) || 'New Game Project';
}

