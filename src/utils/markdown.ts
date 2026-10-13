import DOMPurify from 'dompurify';
import { marked } from 'marked';

export function renderMarkdown(markdown: string): string {
  return DOMPurify.sanitize(marked.parse(markdown, { async: false }), {
    ADD_ATTR: ['data-wikitarget'],
    FORBID_TAGS: ['style', 'form', 'input', 'iframe'],
  });
}
