import { getCachedPage, setCachedPage, getCachedPageCount } from '../utils/db.js'

const BASE_URL = 'https://api.quran.com/api/v4'
const TOTAL_PAGES = 604

// ── In-memory cache for instant page re-visits ──────────────────────────────
const memCache = new Map()

/**
 * Fetch a Quran page with full word-by-word data.
 * Priority: memory cache → IndexedDB → network
 * @param {number} pageNum 1–604
 */
export async function fetchQuranPage(pageNum) {
  // 1. Memory cache (instant)
  if (memCache.has(pageNum)) return memCache.get(pageNum)

  // 2. IndexedDB cache (fast, offline support)
  const cached = await getCachedPage(pageNum)
  if (cached) {
    memCache.set(pageNum, cached.data)
    return cached.data
  }

  // 3. Network fetch
  return fetchFromNetwork(pageNum)
}

async function fetchFromNetwork(pageNum) {
  try {
    const url = `${BASE_URL}/verses/by_page/${pageNum}`
      + `?words=true&word_fields=text_uthmani,position`
      + `&fields=text_uthmani,verse_key`
      + `&per_page=50`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`API error ${res.status}`)
    const json = await res.json()

    const data = processPageData(pageNum, json)

    // Save to memory and IndexedDB (without rawJson to keep size small)
    memCache.set(pageNum, data)
    await setCachedPage(pageNum, data)

    return data
  } catch (err) {
    console.warn('Quran API error:', err)
    return { pageNumber: pageNum, verses: [], words: [], offline: true }
  }
}

function processPageData(pageNum, json) {
  const verses = json.verses || []
  const words = []

  verses.forEach(verse => {
    if (verse.words) {
      verse.words.forEach(w => {
        words.push({
          text: w.text_uthmani || w.text,
          verseKey: verse.verse_key,
          position: w.position,
          isEnd: w.char_type_name === 'end'
        })
      })
    }
  })

  // No rawJson stored — keeps cache lean
  return { pageNumber: pageNum, verses: verses.map(v => ({ verse_key: v.verse_key })), words }
}

/**
 * Prefetch ALL 604 pages on first load.
 * Skips pages already in IndexedDB (supports resume).
 * @param {function(done:number, total:number):void} onProgress
 */
export async function prefetchAllPages(onProgress) {
  const total = TOTAL_PAGES
  let done = await getCachedPageCount()

  // Report initial state (pages already cached)
  onProgress?.(done, total)
  if (done >= total) return

  for (let p = 1; p <= total; p++) {
    // Skip already-cached pages (fast check via memory or IDB)
    if (memCache.has(p)) { done++; onProgress?.(done, total); continue }
    const cached = await getCachedPage(p)
    if (cached) {
      memCache.set(p, cached.data)
      done++
      onProgress?.(done, total)
      continue
    }

    // Fetch from network
    await fetchFromNetwork(p).catch(() => {})
    done++
    onProgress?.(done, total)

    // Throttle to avoid rate-limiting
    await new Promise(r => setTimeout(r, 150))
  }
}

/**
 * Aggressively prefetch surrounding pages for smooth swipe navigation.
 * Fetches 3 pages ahead and 2 pages behind.
 */
export async function prefetchAdjacentPages(currentPage) {
  const ahead  = [1, 2, 3].map(d => currentPage - d)  // RTL: forward = lower number
  const behind = [1, 2].map(d => currentPage + d)
  const pages  = [...ahead, ...behind].filter(p => p >= 1 && p <= TOTAL_PAGES)

  // Sequential small delay between requests to avoid rate limiting
  for (const p of pages) {
    if (!memCache.has(p)) {
      fetchQuranPage(p).catch(() => {})
      await new Promise(r => setTimeout(r, 120))
    }
  }
}
