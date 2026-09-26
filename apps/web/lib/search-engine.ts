/**
 * GTS Product Search Engine v3
 * ─────────────────────────────────────────────────────────────────────────────
 * High-performance, zero-dependency client-side search engine with:
 * - Token-level inverted index (sorted Uint32Array posting lists)
 * - TOKENIZED prefix trie (individual words, not full names)
 * - Vocabulary-level trigram fuzzy matching with Damerau-Levenshtein typo correction
 * - BM25 relevance scoring with field weights
 * - NLP intent parsing (colors, price, stock, stopwords)
 * - Synonym expansion (hoodie→hoody→sweatshirt, phone→mobile→cell)
 * - Character-transposition typo tolerance ("bule"→"blue", "jodran"→"jordan")
 *
 * Target: < 1ms autocomplete, < 5ms search at 10K products
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SearchableProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  subCategory?: string;
  tags?: string[];
  colors?: string[];
  description?: string;
  price?: number;
  inStock?: boolean;
}

export interface SearchResult {
  id: string;
  score: number;
  matchedFields: string[];
}

export interface SearchOptions {
  limit?: number;
  inStockOnly?: boolean;
  maxPrice?: number;
  minPrice?: number;
  colors?: string[];
  category?: string;
}

export interface ParsedIntent {
  terms: string[];
  colors: string[];
  maxPrice: number | null;
  minPrice: number | null;
  inStockOnly: boolean;
  category: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "a", "an", "the", "for", "and", "or", "but", "in", "on", "at", "to",
  "of", "is", "it", "i", "me", "my", "we", "our", "you", "your",
  "with", "from", "by", "this", "that", "these", "those",
  "some", "any", "all", "each", "every", "both", "few",
  "want", "need", "looking", "find", "show", "get", "buy",
  "please", "can", "could", "would", "like", "give",
]);

const COLOR_SET = new Set([
  "red", "blue", "green", "yellow", "orange", "purple", "pink", "black",
  "white", "brown", "grey", "gray", "beige", "navy", "teal", "cyan",
  "maroon", "olive", "coral", "gold", "silver", "cream", "ivory",
  "tan", "khaki", "burgundy", "magenta", "turquoise", "indigo",
  "lavender", "charcoal", "rose", "peach", "mint", "aqua",
  "crimson", "scarlet", "violet", "lilac", "mauve", "plum",
  "chocolate", "caramel", "rust", "amber", "emerald", "sapphire",
  "ruby", "wine", "champagne", "nude", "blush",
]);

// ─── Synonym Map ─────────────────────────────────────────────────────────────
// Each group shares meaning; searching any member also matches the others.
const SYNONYM_GROUPS: string[][] = [
  ["hoodie", "hoody", "sweatshirt", "pullover"],
  ["phone", "mobile", "cell", "smartphone", "handset"],
  ["laptop", "notebook", "computer"],
  ["sneaker", "sneakers", "trainer", "trainers", "kicks"],
  ["shirt", "tee", "tshirt", "top"],
  ["pants", "trousers", "bottoms", "jeans"],
  ["bag", "handbag", "purse", "tote"],
  ["watch", "watches", "timepiece", "wristwatch"],
  ["headphone", "headphones", "earphone", "earphones", "earbuds", "airpods"],
  ["television", "tv", "monitor", "screen"],
  ["fridge", "refrigerator", "freezer"],
  ["washer", "washing", "laundry"],
  ["shoe", "shoes", "footwear"],
  ["dress", "gown", "frock"],
  ["jacket", "coat", "blazer", "outerwear"],
  ["cap", "hat", "beanie", "beret"],
  ["perfume", "fragrance", "cologne", "scent"],
  ["cream", "moisturizer", "lotion"],
  ["charger", "cable", "adapter", "cord"],
  ["speaker", "speakers", "soundbar", "boombox"],
];

const SYNONYM_MAP = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) {
    SYNONYM_MAP.set(word, group.filter((w) => w !== word));
  }
}

// Price keywords
const PRICE_BELOW_KEYWORDS = new Set(["under", "below", "less", "max", "cheaper"]);
const PRICE_ABOVE_KEYWORDS = new Set(["above", "over", "more", "min"]);
const CHEAP_KEYWORDS = new Set(["cheap", "budget", "affordable"]);
const EXPENSIVE_KEYWORDS = new Set(["expensive", "premium", "luxury"]);
const STOCK_KEYWORDS = new Set(["available", "instock", "stock", "ready"]);

// BM25 parameters
const BM25_K1 = 1.2;
const BM25_B = 0.75;

// Field boost weights
const FIELD_WEIGHTS: Record<string, number> = {
  name: 3.0,
  brand: 2.5,
  category: 1.8,
  subCategory: 1.5,
  tags: 1.3,
  colors: 2.0,
  description: 0.5,
};

// ─── Tokenizer ───────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

// ─── Damerau-Levenshtein Distance (handles transpositions like "bule"→"blue") ─

function damerauLevenshtein(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  if (Math.abs(la - lb) > 2) return 3; // Early exit for very different lengths

  const d: number[][] = [];
  for (let i = 0; i <= la; i++) {
    d[i] = [];
    d[i]![0] = i;
  }
  for (let j = 0; j <= lb; j++) {
    d[0]![j] = j;
  }

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,      // deletion
        d[i]![j - 1]! + 1,      // insertion
        d[i - 1]![j - 1]! + cost // substitution
      );
      // Transposition (swapped adjacent characters)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + cost);
      }
    }
  }
  return d[la]![lb]!;
}

// ─── Trigram Generator ──────────────────────────────────────────────────────

function getTrigramsSet(word: string): Set<string> {
  const padded = `__${word}_`;
  const s = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i++) {
    s.add(padded.slice(i, i + 3));
  }
  return s;
}

// ─── NLP Intent Parser ──────────────────────────────────────────────────────

export function parseIntent(query: string): ParsedIntent {
  const raw = query.toLowerCase().trim();
  const tokens = raw.replace(/[^a-z0-9\s.]/g, " ").split(/\s+/).filter(Boolean);

  const colors: string[] = [];
  const terms: string[] = [];
  let maxPrice: number | null = null;
  let minPrice: number | null = null;
  let inStockOnly = false;
  const category: string | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;

    if (STOCK_KEYWORDS.has(tok) || (tok === "in" && tokens[i + 1] === "stock")) {
      inStockOnly = true;
      if (tok === "in" && tokens[i + 1] === "stock") i++;
      continue;
    }

    if (PRICE_BELOW_KEYWORDS.has(tok)) {
      const next = tokens[i + 1];
      if (next) {
        const parsed = parsePrice(next);
        if (parsed !== null) { maxPrice = parsed; i++; continue; }
      }
      continue;
    }

    if (PRICE_ABOVE_KEYWORDS.has(tok)) {
      const next = tokens[i + 1];
      if (next) {
        const parsed = parsePrice(next);
        if (parsed !== null) { minPrice = parsed; i++; continue; }
      }
      continue;
    }

    if (CHEAP_KEYWORDS.has(tok)) {
      if (maxPrice === null) maxPrice = 15000;
      terms.push(tok);
      continue;
    }

    if (EXPENSIVE_KEYWORDS.has(tok)) {
      terms.push(tok);
      continue;
    }

    // Try to correct color typos (e.g., "bule" → "blue")
    if (COLOR_SET.has(tok)) {
      colors.push(tok);
      continue;
    }
    // Check if it's a typo of a color
    const correctedColor = fuzzyMatchColor(tok);
    if (correctedColor) {
      colors.push(correctedColor);
      continue;
    }

    if (STOPWORDS.has(tok)) continue;

    terms.push(tok);
  }

  return { terms, colors, maxPrice, minPrice, inStockOnly, category };
}

/** Check if a token is a misspelling of a known color (edit distance ≤ 1) */
function fuzzyMatchColor(token: string): string | null {
  if (token.length < 3) return null;
  for (const color of COLOR_SET) {
    if (Math.abs(token.length - color.length) > 1) continue;
    if (damerauLevenshtein(token, color) <= 1) return color;
  }
  return null;
}

function parsePrice(token: string): number | null {
  const kMatch = token.match(/^(\d+(?:\.\d+)?)k$/i);
  if (kMatch) return parseFloat(kMatch[1]!) * 1000;
  const mMatch = token.match(/^(\d+(?:\.\d+)?)m$/i);
  if (mMatch) return parseFloat(mMatch[1]!) * 1000000;
  const num = parseFloat(token);
  if (!isNaN(num) && num > 0) return num;
  return null;
}

// ─── Tokenized Prefix Trie for Autocomplete ──────────────────────────────────
// Key difference from v2: inserts INDIVIDUAL TOKENS (words), not full names.
// Each token maps back to a set of "suggestion phrases" (product name, brand, category).

interface TrieNode {
  c: Map<number, TrieNode>;
  /** Complete suggestions reachable from this node */
  suggestions: Set<string>;
}

class TokenizedTrie {
  private root: TrieNode = { c: new Map(), suggestions: new Set() };

  /** Insert a phrase, indexing each word token as a trie entry pointing to the full phrase */
  insertPhrase(phrase: string): void {
    const lower = phrase.toLowerCase().trim();
    if (!lower) return;
    const tokens = lower.split(/\s+/).filter((t) => t.length >= 2);
    // Insert each token individually so "hoodie" matches "streetwear hoodie"
    for (const token of tokens) {
      this._insertToken(token, lower);
    }
    // Also insert the full phrase as one entry
    this._insertToken(lower, lower);
  }

  /** Insert a single word/token */
  insertToken(word: string): void {
    const lower = word.toLowerCase().trim();
    if (lower.length < 2) return;
    this._insertToken(lower, lower);
  }

  private _insertToken(token: string, suggestion: string): void {
    let node = this.root;
    for (let i = 0; i < token.length; i++) {
      const code = token.charCodeAt(i);
      let child = node.c.get(code);
      if (!child) {
        child = { c: new Map(), suggestions: new Set() };
        node.c.set(code, child);
      }
      node = child;
    }
    node.suggestions.add(suggestion);
  }

  /** Find suggestions matching a prefix, with typo tolerance */
  search(prefix: string, limit: number = 10): string[] {
    const lower = prefix.toLowerCase().trim();
    if (!lower) return [];

    // Split multi-word query: match last word as prefix, earlier words as filters
    const words = lower.split(/\s+/).filter((w) => w.length >= 1);
    const lastWord = words[words.length - 1]!;
    const prefixWords = words.slice(0, -1);

    // 1. Exact prefix match on the last word
    let results = this._prefixSearch(lastWord, limit * 3);

    // 2. If few results, try fuzzy: check trie entries within edit distance 1
    if (results.length < limit && lastWord.length >= 3) {
      const fuzzyResults = this._fuzzySearch(lastWord, limit * 3);
      const existing = new Set(results);
      for (const r of fuzzyResults) {
        if (!existing.has(r)) results.push(r);
      }
    }

    // 3. Filter by prefix words if multi-word query
    if (prefixWords.length > 0) {
      results = results.filter((suggestion) => {
        const lowerSug = suggestion.toLowerCase();
        return prefixWords.every((pw) => lowerSug.includes(pw));
      });
    }

    // 4. Score by relevance: exact prefix match > starts with > contains
    const scored = results.map((s) => {
      let score = 0;
      const ls = s.toLowerCase();
      if (ls.startsWith(lower)) score += 10;
      else if (ls.includes(lower)) score += 5;
      // Bonus for shorter suggestions (more specific)
      score += Math.max(0, 20 - s.length) * 0.3;
      // Bonus for word starting with the last query word
      if (ls.split(/\s+/).some((w) => w.startsWith(lastWord))) score += 8;
      return { text: s, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Deduplicate case-insensitive
    const seen = new Set<string>();
    const final: string[] = [];
    for (const item of scored) {
      const key = item.text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      final.push(item.text);
      if (final.length >= limit) break;
    }
    return final;
  }

  private _prefixSearch(prefix: string, limit: number): string[] {
    let node = this.root;
    for (let i = 0; i < prefix.length; i++) {
      const child = node.c.get(prefix.charCodeAt(i));
      if (!child) return [];
      node = child;
    }
    const results: string[] = [];
    this._collect(node, results, limit);
    return results;
  }

  /** Fuzzy search: find trie paths within edit distance 1 of the query */
  private _fuzzySearch(word: string, limit: number): string[] {
    const results = new Set<string>();
    this._fuzzyRecurse(this.root, word, 0, 1, results, limit);
    return Array.from(results);
  }

  private _fuzzyRecurse(
    node: TrieNode, word: string, depth: number, maxEdits: number,
    results: Set<string>, limit: number
  ): void {
    if (results.size >= limit) return;

    // If we've consumed the word, collect suggestions from here
    if (depth >= word.length) {
      if (maxEdits >= 0) {
        for (const s of node.suggestions) {
          results.add(s);
          if (results.size >= limit) return;
        }
        // Also collect from children (prefix completion after fuzzy match)
        this._collectInto(node, results, limit);
      }
      return;
    }

    if (maxEdits < 0) return;

    const targetChar = word.charCodeAt(depth);

    for (const [charCode, child] of node.c) {
      if (charCode === targetChar) {
        // Exact match: no edit cost
        this._fuzzyRecurse(child, word, depth + 1, maxEdits, results, limit);
      } else if (maxEdits > 0) {
        // Substitution: consume one edit
        this._fuzzyRecurse(child, word, depth + 1, maxEdits - 1, results, limit);
      }
    }

    // Deletion: skip a character in the word
    if (maxEdits > 0) {
      this._fuzzyRecurse(node, word, depth + 1, maxEdits - 1, results, limit);
    }

    // Insertion: consume a trie char without advancing in the word
    if (maxEdits > 0) {
      for (const [, child] of node.c) {
        this._fuzzyRecurse(child, word, depth, maxEdits - 1, results, limit);
      }
    }

    // Transposition: swap adjacent characters ("bule" → "blue")
    if (maxEdits > 0 && depth + 1 < word.length) {
      const nextChar = word.charCodeAt(depth + 1);
      const child1 = node.c.get(nextChar);
      if (child1) {
        const child2 = child1.c.get(targetChar);
        if (child2) {
          this._fuzzyRecurse(child2, word, depth + 2, maxEdits - 1, results, limit);
        }
      }
    }
  }

  private _collect(node: TrieNode, results: string[], limit: number): void {
    for (const s of node.suggestions) {
      if (results.length >= limit) return;
      results.push(s);
    }
    for (const child of node.c.values()) {
      if (results.length >= limit) return;
      this._collect(child, results, limit);
    }
  }

  private _collectInto(node: TrieNode, results: Set<string>, limit: number): void {
    for (const s of node.suggestions) {
      if (results.size >= limit) return;
      results.add(s);
    }
    for (const child of node.c.values()) {
      if (results.size >= limit) return;
      this._collectInto(child, results, limit);
    }
  }
}

// ─── Sorted Array Intersection ───────────────────────────────────────────────

function intersectSorted(a: Uint32Array, b: Uint32Array): Uint32Array {
  const result: number[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i]! < b[j]!) i++;
    else if (a[i]! > b[j]!) j++;
    else { result.push(a[i]!); i++; j++; }
  }
  return new Uint32Array(result);
}

// ─── Compact Document Record ─────────────────────────────────────────────────

interface CompactDoc {
  id: string;
  wtf: Map<string, number>;
  len: number;
  colors: string[];
  price: number | undefined;
  inStock: boolean | undefined;
  cat: string;
}

// ─── Main Engine ─────────────────────────────────────────────────────────────

export class ProductSearchEngine {
  private docs: CompactDoc[] = [];
  private tokenIndex: Map<string, Uint32Array> = new Map();
  private tokenDf: Map<string, number> = new Map();
  private vocab: string[] = [];
  private vocabTrigramIdx: Map<string, Uint16Array | Uint32Array> = new Map();
  private vocabTrigramSets: Set<string>[] = [];
  private avgDocLength: number = 0;
  private trie: TokenizedTrie = new TokenizedTrie();
  private docCount: number = 0;

  get size(): number {
    return this.docCount;
  }

  /**
   * Build the search index from a product catalog.
   */
  buildIndex(products: SearchableProduct[]): void {
    this.docCount = products.length;
    this.docs = new Array(products.length);
    this.trie = new TokenizedTrie();

    const tokenToDocSet = new Map<string, number[]>();
    let totalTokensAll = 0;

    for (let i = 0; i < products.length; i++) {
      const p = products[i]!;
      const wtf = new Map<string, number>();
      let docLen = 0;

      const fieldTexts: [string, string][] = [
        ["name", p.name],
        ["brand", p.brand],
        ["category", p.category],
        ["subCategory", p.subCategory || ""],
        ["tags", (p.tags || []).join(" ")],
        ["colors", (p.colors || []).join(" ")],
        ["description", p.description || ""],
      ];

      const uniqueTokens = new Set<string>();

      for (const [fieldName, text] of fieldTexts) {
        const weight = FIELD_WEIGHTS[fieldName] ?? 1.0;
        const tokens = tokenize(text);
        docLen += tokens.length;
        for (const t of tokens) {
          uniqueTokens.add(t);
          wtf.set(t, (wtf.get(t) || 0) + weight);
          // Also index synonyms
          const syns = SYNONYM_MAP.get(t);
          if (syns) {
            for (const syn of syns) {
              uniqueTokens.add(syn);
              // Synonyms get slightly lower weight than the original
              wtf.set(syn, (wtf.get(syn) || 0) + weight * 0.7);
            }
          }
        }
      }

      // Colors
      const colors: string[] = [];
      if (p.colors) {
        for (const c of p.colors) {
          const lower = c.toLowerCase();
          if (!colors.includes(lower)) colors.push(lower);
          for (const w of lower.split(/\s+/)) {
            if (COLOR_SET.has(w) && !colors.includes(w)) colors.push(w);
          }
        }
      }
      for (const nt of tokenize(p.name)) {
        if (COLOR_SET.has(nt) && !colors.includes(nt)) colors.push(nt);
      }

      this.docs[i] = {
        id: p.id,
        wtf,
        len: docLen,
        colors,
        price: p.price,
        inStock: p.inStock,
        cat: p.category.toLowerCase(),
      };

      totalTokensAll += docLen;

      for (const token of uniqueTokens) {
        let arr = tokenToDocSet.get(token);
        if (!arr) { arr = []; tokenToDocSet.set(token, arr); }
        arr.push(i);
      }

      // Feed trie with TOKENIZED entries (individual words, not full names)
      this.trie.insertPhrase(p.name);
      if (p.brand) this.trie.insertPhrase(p.brand);
      if (p.category) this.trie.insertPhrase(p.category);
      if (p.subCategory) this.trie.insertPhrase(p.subCategory);
      if (p.tags) {
        for (const tag of p.tags) this.trie.insertPhrase(tag);
      }
    }

    this.avgDocLength = products.length > 0 ? totalTokensAll / products.length : 0;

    // Build token posting lists
    this.tokenIndex = new Map();
    this.tokenDf = new Map();
    for (const [token, indices] of tokenToDocSet) {
      this.tokenIndex.set(token, new Uint32Array(indices));
      this.tokenDf.set(token, indices.length);
    }

    // Build vocabulary trigram index for fuzzy matching
    this.vocab = Array.from(tokenToDocSet.keys());
    this.vocabTrigramSets = new Array(this.vocab.length);

    const triToVocabIndices = new Map<string, number[]>();
    for (let vi = 0; vi < this.vocab.length; vi++) {
      const triSet = getTrigramsSet(this.vocab[vi]!);
      this.vocabTrigramSets[vi] = triSet;
      for (const tri of triSet) {
        let arr = triToVocabIndices.get(tri);
        if (!arr) { arr = []; triToVocabIndices.set(tri, arr); }
        arr.push(vi);
      }
    }

    this.vocabTrigramIdx = new Map();
    const useU16 = this.vocab.length <= 65535;
    for (const [tri, indices] of triToVocabIndices) {
      this.vocabTrigramIdx.set(tri, useU16 ? new Uint16Array(indices) : new Uint32Array(indices));
    }
  }

  /**
   * Search for products matching a natural language query.
   */
  search(query: string, options?: SearchOptions): SearchResult[] {
    const limit = options?.limit ?? 50;
    if (!query.trim()) return [];

    const intent = parseIntent(query);

    const effectiveMaxPrice = options?.maxPrice ?? intent.maxPrice;
    const effectiveMinPrice = options?.minPrice ?? intent.minPrice;
    const effectiveInStockOnly = options?.inStockOnly ?? intent.inStockOnly;
    const effectiveColors = options?.colors ?? (intent.colors.length > 0 ? intent.colors : null);
    const effectiveCategory = options?.category ?? intent.category;
    const searchTerms = intent.terms;

    // Expand search terms with synonyms
    const expandedTerms: string[] = [...searchTerms];
    for (const term of searchTerms) {
      const syns = SYNONYM_MAP.get(term);
      if (syns) {
        for (const syn of syns) {
          if (!expandedTerms.includes(syn)) expandedTerms.push(syn);
        }
      }
    }

    if (expandedTerms.length === 0 && (!effectiveColors || effectiveColors.length === 0)) return [];

    // Resolve each search term to posting list
    const resolvedTerms: { original: string; resolved: string[]; posting: Uint32Array }[] = [];

    for (const term of expandedTerms) {
      const result = this._resolveAndGetPosting(term);
      if (result && result.posting.length > 0) {
        resolvedTerms.push(result);
      }
    }

    // Determine candidate set
    let candidates: Uint32Array;

    if (resolvedTerms.length === 0) {
      if (effectiveColors && effectiveColors.length > 0) {
        return this._colorOnlyScan(effectiveColors, effectiveMaxPrice, effectiveMinPrice, effectiveInStockOnly, effectiveCategory, limit);
      }
      return [];
    } else if (resolvedTerms.length === 1) {
      candidates = resolvedTerms[0]!.posting;
    } else {
      resolvedTerms.sort((a, b) => a.posting.length - b.posting.length);

      // Try AND intersection with original terms first
      const originalResolved = resolvedTerms.filter((rt) => searchTerms.includes(rt.original));
      let intersection: Uint32Array | null = null;

      if (originalResolved.length > 0) {
        intersection = originalResolved[0]!.posting;
        for (let i = 1; i < originalResolved.length; i++) {
          intersection = intersectSorted(intersection, originalResolved[i]!.posting);
          if (intersection.length === 0) break;
        }
      }

      if (intersection && intersection.length > 0) {
        candidates = intersection;
      } else {
        // Union all posting lists (OR mode) for maximum recall
        candidates = this._mergePostingLists(resolvedTerms.map((rt) => rt.posting));
      }
    }

    // Score candidates
    const maxCandidates = Math.min(candidates.length, 2000);
    const scored: SearchResult[] = [];

    for (let ci = 0; ci < maxCandidates; ci++) {
      const docIdx = candidates[ci]!;
      const doc = this.docs[docIdx]!;

      if (effectiveInStockOnly && doc.inStock === false) continue;
      if (effectiveMaxPrice !== null && doc.price !== undefined && doc.price > effectiveMaxPrice) continue;
      if (effectiveMinPrice !== null && doc.price !== undefined && doc.price < effectiveMinPrice) continue;
      if (effectiveCategory && doc.cat !== effectiveCategory.toLowerCase()) continue;

      let totalScore = 0;
      const matchedFields: string[] = [];

      for (const rt of resolvedTerms) {
        let bestWtf = 0;
        let bestDf = 1;
        for (const resolvedToken of rt.resolved) {
          const w = doc.wtf.get(resolvedToken);
          if (w !== undefined && w > bestWtf) {
            bestWtf = w;
            bestDf = this.tokenDf.get(resolvedToken) || 1;
          }
        }

        if (bestWtf > 0) {
          const idf = Math.log((this.docCount - bestDf + 0.5) / (bestDf + 0.5) + 1);
          const tfNorm = (bestWtf * (BM25_K1 + 1)) /
            (bestWtf + BM25_K1 * (1 - BM25_B + BM25_B * (doc.len / this.avgDocLength)));
          totalScore += idf * tfNorm;
        }
      }

      // Color match bonus
      if (intent.colors.length > 0) {
        for (const c of intent.colors) {
          if (doc.colors.includes(c)) {
            totalScore += 2.0;
            if (!matchedFields.includes("colors")) matchedFields.push("colors");
          }
        }
      }

      if (totalScore > 0) {
        scored.push({ id: doc.id, score: totalScore, matchedFields });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  /**
   * Get autocomplete suggestions for a query with typo tolerance.
   * Uses tokenized trie with fuzzy matching (edit distance 1 + transpositions).
   */
  autocomplete(prefix: string, limit: number = 10): string[] {
    const trimmed = prefix.trim();
    if (!trimmed) return [];
    return this.trie.search(trimmed, limit);
  }

  /**
   * Resolve a query term to matching vocabulary tokens and their merged posting list.
   */
  private _resolveAndGetPosting(term: string): { original: string; resolved: string[]; posting: Uint32Array } | null {
    // 1. Exact match
    const exact = this.tokenIndex.get(term);
    if (exact) return { original: term, resolved: [term], posting: exact };

    // 2. Prefix match
    const prefixResolved: string[] = [];
    const prefixPostings: Uint32Array[] = [];
    for (let vi = 0; vi < this.vocab.length && prefixPostings.length < 5; vi++) {
      const v = this.vocab[vi]!;
      if (v.startsWith(term) || (term.startsWith(v) && v.length >= term.length * 0.5)) {
        const posting = this.tokenIndex.get(v);
        if (posting) {
          prefixResolved.push(v);
          prefixPostings.push(posting);
        }
      }
    }
    if (prefixPostings.length > 0) {
      return { original: term, resolved: prefixResolved, posting: prefixPostings.length === 1 ? prefixPostings[0]! : this._mergePostingLists(prefixPostings) };
    }

    // 3. Typo correction via Damerau-Levenshtein (handles transpositions like "bule"→"blue")
    if (term.length >= 3) {
      let bestVocab: string | null = null;
      let bestDist = 3;
      const maxDist = term.length <= 4 ? 1 : 2;

      for (let vi = 0; vi < this.vocab.length; vi++) {
        const v = this.vocab[vi]!;
        if (Math.abs(v.length - term.length) > maxDist) continue;
        const dist = damerauLevenshtein(term, v);
        if (dist < bestDist) {
          bestDist = dist;
          bestVocab = v;
          if (dist === 0) break; // Perfect match (shouldn't happen since exact match checked above)
        }
      }

      if (bestVocab && bestDist <= maxDist) {
        const posting = this.tokenIndex.get(bestVocab);
        if (posting) return { original: term, resolved: [bestVocab], posting };
      }
    }

    // 4. Trigram fuzzy fallback (for longer words where edit distance is expensive)
    const queryTrigrams = getTrigramsSet(term);
    if (queryTrigrams.size === 0) return null;

    const vocabScores = new Map<number, number>();
    for (const tri of queryTrigrams) {
      const vocabIndices = this.vocabTrigramIdx.get(tri);
      if (!vocabIndices) continue;
      for (let i = 0; i < vocabIndices.length; i++) {
        const vi = vocabIndices[i]!;
        vocabScores.set(vi, (vocabScores.get(vi) || 0) + 1);
      }
    }

    let bestVi = -1;
    let bestJaccard = 0;
    for (const [vi, count] of vocabScores) {
      const vocabTrigramSize = this.vocabTrigramSets[vi]!.size;
      const unionSize = queryTrigrams.size + vocabTrigramSize - count;
      const jaccard = count / unionSize;
      if (jaccard > bestJaccard && jaccard >= 0.25) {
        bestJaccard = jaccard;
        bestVi = vi;
      }
    }

    if (bestVi >= 0) {
      const token = this.vocab[bestVi]!;
      const posting = this.tokenIndex.get(token);
      if (posting) return { original: term, resolved: [token], posting };
    }

    return null;
  }

  private _mergePostingLists(lists: Uint32Array[]): Uint32Array {
    if (lists.length === 1) return lists[0]!;
    const merged = new Set<number>();
    for (const list of lists) {
      for (let i = 0; i < list.length; i++) merged.add(list[i]!);
    }
    const arr = new Uint32Array(merged.size);
    let idx = 0;
    for (const v of merged) arr[idx++] = v;
    arr.sort();
    return arr;
  }

  private _colorOnlyScan(
    colors: string[], maxPrice: number | null, minPrice: number | null,
    inStockOnly: boolean, category: string | null, limit: number,
  ): SearchResult[] {
    const results: SearchResult[] = [];
    for (let i = 0; i < this.docCount && results.length < limit; i++) {
      const doc = this.docs[i]!;
      if (inStockOnly && doc.inStock === false) continue;
      if (maxPrice !== null && doc.price !== undefined && doc.price > maxPrice) continue;
      if (minPrice !== null && doc.price !== undefined && doc.price < minPrice) continue;
      if (category && doc.cat !== category.toLowerCase()) continue;

      let score = 0;
      for (const c of colors) {
        if (doc.colors.includes(c)) score += 2.0;
      }
      if (score > 0) {
        results.push({ id: doc.id, score, matchedFields: ["colors"] });
      }
    }
    return results;
  }
}
