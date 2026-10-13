import { WikiPage } from '../types';

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Technical game design text and markdown code blocks averages ~3.8 characters per token
  const trimmed = text.trim();
  return Math.ceil(trimmed.length / 3.8);
}

export function calculateTotalWikiTokens(pages: WikiPage[]): {
  totalTokens: number;
  totalChars: number;
  totalWords: number;
} {
  let totalChars = 0;
  let totalWords = 0;

  for (const page of pages) {
    const content = page.content || '';
    totalChars += content.length + page.title.length;
    const words = content.match(/\b\S+\b/g);
    if (words) {
      totalWords += words.length;
    }
  }

  const totalTokens = Math.ceil(totalChars / 3.8);

  return {
    totalTokens,
    totalChars,
    totalWords
  };
}
