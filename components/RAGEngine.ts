import { Note } from "../types";

export interface IndexedDocument {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  tokens: string[];
  termFreqs: Map<string, number>; // term -> count
}

export interface SearchResult {
  doc: Note;
  score: number;
  matchedKeywords: string[];
  snippet: string;
}

/**
 * Clean and segment string into bilingual tokens.
 * Supports character-level unigrams and bigrams for CJK (Chinese),
 * and regex word boundaries for Western words.
 * This is extremely accurate and lightweight for client-side search without thick models.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const tokens: string[] = [];
  const normalized = text.toLowerCase();

  // 1. English & Alphanumeric word tokens
  const englishMatches = normalized.match(/[a-z0-9]+/g);
  if (englishMatches) {
    tokens.push(...englishMatches);
  }

  // 2. Chinese (CJK) characters & bigrams
  const chineseBlocks = normalized.match(/[\u4e00-\u9fa5]+/g);
  if (chineseBlocks) {
    for (const block of chineseBlocks) {
      const chars = block.split("");
      // Unigrams
      tokens.push(...chars);
      // Bigrams
      for (let i = 0; i < chars.length - 1; i++) {
        tokens.push(chars[i] + chars[i + 1]);
      }
    }
  }

  return tokens.filter((t) => t.trim().length > 0);
}

/**
 * Builds the search index from an array of Notes.
 */
export function buildIndex(notes: Note[]): IndexedDocument[] {
  return notes.map((note) => {
    // We boost the title by duplicating it inside the corpus to give title matches higher priority!
    const textToCorpus = `${note.title} ${note.title} ${note.title} ${note.content || ""}`;
    const tokens = tokenize(textToCorpus);

    const termFreqs = new Map<string, number>();
    tokens.forEach((token) => {
      termFreqs.set(token, (termFreqs.get(token) || 0) + 1);
    });

    return {
      id: note.id,
      title: note.title,
      content: note.content || "",
      wordCount: (note.content || "").length,
      tokens,
      termFreqs,
    };
  });
}

/**
 * Highlights and extracts a beautiful excerpt snippet from a document around matching keywords.
 */
export function extractSnippet(
  content: string,
  keywords: string[],
  len: number = 200,
): string {
  if (!content) return "";

  // Find index of the first matching keyword in the document
  let bestIdx = 0;
  let maxMatchWeight = 0;

  for (const kw of keywords) {
    if (kw.length > 1) {
      // Prefer multi-character keywords for context
      const idx = content.toLowerCase().indexOf(kw.toLowerCase());
      if (idx !== -1) {
        bestIdx = idx;
        break;
      }
    }
  }

  // Fallback to if any single keyword is found
  if (bestIdx === 0 && keywords.length > 0) {
    for (const kw of keywords) {
      const idx = content.toLowerCase().indexOf(kw.toLowerCase());
      if (idx !== -1) {
        bestIdx = idx;
        break;
      }
    }
  }

  const start = Math.max(0, bestIdx - Math.floor(len / 3));
  const end = Math.min(content.length, start + len);
  let snippet = content.slice(start, end);

  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";

  return snippet;
}

/**
 * Computes TF-IDF similarity ranks of documents for a given query text.
 */
export function searchIndex(
  query: string,
  notes: Note[],
  limit: number = 3,
): SearchResult[] {
  const queryTokens = Array.from(new Set(tokenize(query)));
  if (queryTokens.length === 0 || notes.length === 0) {
    return [];
  }

  const indexedDocs = buildIndex(notes);
  const docCount = indexedDocs.length;

  // Compute Document Frequency (DF) for each query token
  const docFreqs = new Map<string, number>();
  queryTokens.forEach((token) => {
    let df = 0;
    indexedDocs.forEach((doc) => {
      if (doc.termFreqs.has(token)) {
        df++;
      }
    });
    docFreqs.set(token, df);
  });

  const results: SearchResult[] = [];

  indexedDocs.forEach((doc, idx) => {
    let score = 0;
    const matchedKeywords: string[] = [];

    queryTokens.forEach((token) => {
      if (doc.termFreqs.has(token)) {
        // TF: Term Frequency normalized by doc length
        const tf = doc.termFreqs.get(token)! / doc.tokens.length;

        // IDF: Inverse Document Frequency
        const df = docFreqs.get(token) || 0;
        const idf = Math.log(1 + docCount / (1 + df));

        // Accumulate query term TF-IDF score
        let termScore = tf * idf;

        // Custom boost for exact matches in the note's Title!
        if (doc.title.toLowerCase().includes(token)) {
          termScore *= 3.0;
          if (!matchedKeywords.includes(token)) {
            matchedKeywords.push(token);
          }
        } else {
          if (!matchedKeywords.includes(token)) {
            matchedKeywords.push(token);
          }
        }

        score += termScore;
      }
    });

    if (score > 0) {
      const origNote = notes[idx];
      results.push({
        doc: origNote,
        score,
        matchedKeywords,
        snippet: extractSnippet(origNote.content, matchedKeywords),
      });
    }
  });

  // Sort by score in descending order
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
