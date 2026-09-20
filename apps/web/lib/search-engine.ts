/**
 * GTS Product Search Engine v2
 * ─────────────────────────────────────────────────────────────────────────────
 * High-performance, zero-dependency search engine with:
 * - Token-level inverted index (sorted Uint32Array posting lists)
 * - Vocabulary-level trigram fuzzy matching (not document-level)
 * - BM25 relevance scoring with field weights
 * - NLP intent parsing (colors, price, stock, stopwords)
 * - Prefix trie autocomplete
 *
 * Architecture:
 *   Query → NLP Parse → Token Lookup (exact) or Vocab Fuzzy → Candidate
 *   Intersection/Union → BM25 Score → Rank → Return
 *
 * Target: < 0.19ms search latency at 500K+ products
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

// Price keywords that REQUIRE a following number to activate price filtering
const PRICE_BELOW_KEYWORDS = new Set(["under", "below", "less", "max", "cheaper"]);
const PRICE_ABOVE_KEYWORDS = new Set(["above", "over", "more", "min"]);
// Price keywords that activate WITHOUT a number (set a default)
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

// ─── Trigram Generator (used only for vocabulary fuzzy matching) ─────────────

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

    // Stock keywords
    if (STOCK_KEYWORDS.has(tok) || (tok === "in" && tokens[i + 1] === "stock")) {
      inStockOnly = true;
      if (tok === "in" && tokens[i + 1] === "stock") i++;
      continue;
    }

    // "under/below/less/max/cheaper" + NUMBER → maxPrice
    if (PRICE_BELOW_KEYWORDS.has(tok)) {
      const next = tokens[i + 1];
      if (next) {
        const parsed = parsePrice(next);
        if (parsed !== null) { maxPrice = parsed; i++; continue; }
      }
      continue; // Skip the keyword itself but don't set a default price
    }

    // "above/over/more/min" + NUMBER → minPrice
    if (PRICE_ABOVE_KEYWORDS.has(tok)) {
      const next = tokens[i + 1];
      if (next) {
        const parsed = parsePrice(next);
        if (parsed !== null) { minPrice = parsed; i++; continue; }
      }
      continue;
    }

    // "cheap/budget/affordable" → set default maxPrice AND keep as search term
    if (CHEAP_KEYWORDS.has(tok)) {
      if (maxPrice === null) maxPrice = 15000;
      terms.push(tok); // Keep as search term too (matches product descriptions)
      continue;
    }

    // "expensive/premium/luxury" → keep as search term only
    // These are commonly used in product names, so don't consume them as price filters
    if (EXPENSIVE_KEYWORDS.has(tok)) {
      terms.push(tok);
      continue;
    }

    // Colors
    if (COLOR_SET.has(tok)) { colors.push(tok); continue; }

    // Stopwords
    if (STOPWORDS.has(tok)) continue;

    terms.push(tok);
  }

  return { terms, colors, maxPrice, minPrice, inStockOnly, category };
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

// ─── Prefix Trie for Autocomplete ────────────────────────────────────────────

interface TrieNode {
  c: Map<number, TrieNode>; // children by char code
  t: string[]; // complete terms at this node
}

class PrefixTrie {
  private root: TrieNode = { c: new Map(), t: [] };

  insert(term: string): void {
    const lower = term.toLowerCase();
    let node = this.root;
    for (let i = 0; i < lower.length; i++) {
      const code = lower.charCodeAt(i);
      let child = node.c.get(code);
      if (!child) {
        child = { c: new Map(), t: [] };
        node.c.set(code, child);
      }
      node = child;
    }
    if (!node.t.includes(term)) node.t.push(term);
  }

  search(prefix: string, limit: number = 10): string[] {
    const lower = prefix.toLowerCase();
    let node = this.root;
    for (let i = 0; i < lower.length; i++) {
      const child = node.c.get(lower.charCodeAt(i));
      if (!child) return [];
      node = child;
    }
    const results: string[] = [];
    this._collect(node, results, limit);
    return results;
  }

  private _collect(node: TrieNode, results: string[], limit: number): void {
    for (const term of node.t) {
      if (results.length >= limit) return;
      results.push(term);
    }
    for (const child of node.c.values()) {
      if (results.length >= limit) return;
      this._collect(child, results, limit);
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
  /** Pre-computed weighted term frequencies: token → weighted TF */
  wtf: Map<string, number>;
  /** Total token count (for BM25 length normalization) */
  len: number;
  /** Lowercased color strings for NLP color matching */
  colors: string[];
  /** Product price */
  price: number | undefined;
  /** In-stock status */
  inStock: boolean | undefined;
  /** Category lowercased */
  cat: string;
}

// ─── Main Engine ─────────────────────────────────────────────────────────────

export class ProductSearchEngine {
  private docs: CompactDoc[] = [];

  /** Token → sorted array of doc indices */
  private tokenIndex: Map<string, Uint32Array> = new Map();
  /** Token → document frequency count */
  private tokenDf: Map<string, number> = new Map();

  /** All unique vocabulary tokens */
  private vocab: string[] = [];
  /** Vocabulary trigram index: trigram → indices into this.vocab */
  private vocabTrigramIdx: Map<string, Uint16Array | Uint32Array> = new Map();
  /** Pre-computed trigram sets for each vocabulary token */
  private vocabTrigramSets: Set<string>[] = [];

  private avgDocLength: number = 0;
  private trie: PrefixTrie = new PrefixTrie();
  private docCount: number = 0;

  /** Number of indexed products */
  get size(): number {
    return this.docCount;
  }

  /**
   * Build the search index from a product catalog.
   */
  buildIndex(products: SearchableProduct[]): void {
    this.docCount = products.length;
    this.docs = new Array(products.length);
    this.trie = new PrefixTrie();

    // Phase 1: Tokenize all docs, build token → doc-indices map
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

      // Track which docs contain each token
      for (const token of uniqueTokens) {
        let arr = tokenToDocSet.get(token);
        if (!arr) { arr = []; tokenToDocSet.set(token, arr); }
        arr.push(i);
      }

      // Feed trie (only top-level fields, not description)
      this.trie.insert(p.name);
      if (p.brand) this.trie.insert(p.brand);
      if (p.category) this.trie.insert(p.category);
      if (p.subCategory) this.trie.insert(p.subCategory);
      if (p.tags) { for (const tag of p.tags) this.trie.insert(tag); }
    }

    this.avgDocLength = products.length > 0 ? totalTokensAll / products.length : 0;

    // Phase 2: Convert token posting lists to sorted Uint32Array
    this.tokenIndex = new Map();
    this.tokenDf = new Map();

    for (const [token, indices] of tokenToDocSet) {
      // Indices are already in insertion order (0..N), which is sorted
      this.tokenIndex.set(token, new Uint32Array(indices));
      this.tokenDf.set(token, indices.length);
    }

    // Phase 3: Build vocabulary-level trigram index for fuzzy matching
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
      this.vocabTrigramIdx.set(tri, useU16
        ? new Uint16Array(indices)
        : new Uint32Array(indices));
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

    if (searchTerms.length === 0 && (!effectiveColors || effectiveColors.length === 0)) return [];

    // Step 1: Resolve each search term to posting list + actual vocab tokens
    const resolvedTerms: { original: string; resolved: string[]; posting: Uint32Array }[] = [];

    for (const term of searchTerms) {
      const result = this._resolveAndGetPosting(term);
      if (result && result.posting.length > 0) {
        resolvedTerms.push(result);
      }
    }

    // Step 2: Determine candidate set
    let candidates: Uint32Array;

    if (resolvedTerms.length === 0) {
      if (effectiveColors && effectiveColors.length > 0) {
        return this._colorOnlyScan(effectiveColors, effectiveMaxPrice, effectiveMinPrice, effectiveInStockOnly, effectiveCategory, limit);
      }
      return [];
    } else if (resolvedTerms.length === 1) {
      candidates = resolvedTerms[0]!.posting;
    } else {
      // Sort by posting list size (smallest first) for efficient intersection
      resolvedTerms.sort((a, b) => a.posting.length - b.posting.length);

      // Try AND intersection
      let intersection = resolvedTerms[0]!.posting;
      for (let i = 1; i < resolvedTerms.length; i++) {
        intersection = intersectSorted(intersection, resolvedTerms[i]!.posting);
        if (intersection.length === 0) break;
      }

      if (intersection.length > 0) {
        candidates = intersection;
      } else {
        // Fallback: use smallest posting list
        candidates = resolvedTerms[0]!.posting;
      }
    }

    // Step 3: Score candidates using resolved tokens for TF lookup
    // Cap candidates to keep scoring O(1) — 1500 is enough for top-50 quality
    const maxCandidates = Math.min(candidates.length, 1500);
    const scored: SearchResult[] = [];

    for (let ci = 0; ci < maxCandidates; ci++) {
      const docIdx = candidates[ci]!;
      const doc = this.docs[docIdx]!;

      // Hard filters
      if (effectiveInStockOnly && doc.inStock === false) continue;
      if (effectiveMaxPrice !== null && doc.price !== undefined && doc.price > effectiveMaxPrice) continue;
      if (effectiveMinPrice !== null && doc.price !== undefined && doc.price < effectiveMinPrice) continue;
      if (effectiveCategory && doc.cat !== effectiveCategory.toLowerCase()) continue;

      // BM25 score using resolved tokens
      let totalScore = 0;
      const matchedFields: string[] = [];

      for (const rt of resolvedTerms) {
        // Look up TF using each resolved vocabulary token (not the raw query typo)
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
   * Get autocomplete suggestions for a prefix query.
   */
  autocomplete(prefix: string, limit: number = 10): string[] {
    const trimmed = prefix.trim();
    if (!trimmed) return [];
    return this.trie.search(trimmed, limit);
  }

  /**
   * Resolve a query term to matching vocabulary tokens and their merged posting list.
   * Returns the resolved tokens + combined posting list.
   */
  private _resolveAndGetPosting(term: string): { original: string; resolved: string[]; posting: Uint32Array } | null {
    // 1. Exact match
    const exact = this.tokenIndex.get(term);
    if (exact) return { original: term, resolved: [term], posting: exact };

    // 2. Prefix match: find vocab tokens that share a prefix with this term
    // Guard: shorter string must be ≥50% the length of the longer
    // Limit to 3 matches to avoid expensive merges
    const prefixResolved: string[] = [];
    const prefixPostings: Uint32Array[] = [];
    for (let vi = 0; vi < this.vocab.length && prefixPostings.length < 3; vi++) {
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

    // 3. Fuzzy match via vocabulary trigram index — take BEST match only
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

    // Find the single best Jaccard match
    let bestVi = -1;
    let bestJaccard = 0;
    for (const [vi, count] of vocabScores) {
      const vocabTrigramSize = this.vocabTrigramSets[vi]!.size;
      const unionSize = queryTrigrams.size + vocabTrigramSize - count;
      const jaccard = count / unionSize;
      if (jaccard > bestJaccard && jaccard >= 0.3) {
        bestJaccard = jaccard;
        bestVi = vi;
      }
    }

    if (bestVi >= 0) {
      const token = this.vocab[bestVi]!;
      const posting = this.tokenIndex.get(token);
      if (posting) {
        return { original: term, resolved: [token], posting };
      }
    }

    return null;
  }

  /**
   * Merge multiple sorted posting lists into one sorted deduplicated array.
   */
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

  /**
   * Color-only scan (when query has no text terms, only colors).
   */
  private _colorOnlyScan(
    colors: string[],
    maxPrice: number | null,
    minPrice: number | null,
    inStockOnly: boolean,
    category: string | null,
    limit: number,
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

