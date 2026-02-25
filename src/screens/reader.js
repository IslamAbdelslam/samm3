import { fetchQuranPage, prefetchAdjacentPages } from '../api/quran.js'
import { getSurahByPage, getJuzByPage, TOTAL_PAGES, SURAHS } from '../data/surahs.js'
import { createSidebar } from '../components/sidebar.js'
import { createRecorder } from '../components/recorder.js'
import { createPlayer } from '../components/player.js'
import { initAnnotations } from '../components/annotation.js'
import { getPrefs, setLastRead } from '../utils/prefs.js'
import { showToast, showError } from '../components/toast.js'

export function createReaderScreen(app) {
  let currentPage = 1
  let isRecording = false
  let currentPlayerWrap = null

  const prefs = getPrefs()
  currentPage = prefs.lastReadPage || 1

  // ── DOM ───────────────────────────────────────
  const screen = document.createElement('div')
  screen.className = 'screen screen-enter reader-screen'
  screen.innerHTML = `
    <!-- Header -->
    <header class="reader-header">
      <button class="btn btn-icon" id="menuBtn" title="قائمة السور">☰</button>
      <div class="reader-meta">
        <span class="reader-surah-name" id="surahName">...</span>
        <span class="reader-page-info" id="pageInfo"></span>
      </div>
      <button class="btn btn-icon" id="settingsBtn" title="الإعدادات">⚙</button>
    </header>

    <!-- Page Display -->
    <div class="reader-body" id="readerBody">
      <div class="page-container" id="pageContainer">
        <div class="quran-page text-visible" id="quranPage">
          <div class="page-loading" id="pageLoading">
            <div class="spinner"></div>
            <span>جاري التحميل...</span>
          </div>
        </div>
      </div>
      <!-- Fixed page number badge -->
      <div class="page-num-badge" id="pageNumBadge"></div>
    </div>

    <!-- Bottom spacer: reserves space for idle FAB -->
    <footer class="reader-footer"></footer>

    <!-- Recorder overlay: direct child of reader-screen so position:absolute
         is scoped to reader-screen, NOT reader-body (which has position:relative) -->
    <div id="recContainer" class="rec-screen-overlay"></div>

    <!-- Player area -->
    <div class="player-container hidden" id="playerContainer"></div>
  `

  app.appendChild(screen)

  // ── Elements ──────────────────────────────────
  const pageEl = screen.querySelector('#quranPage')
  const pageLoading = screen.querySelector('#pageLoading')
  const surahNameEl = screen.querySelector('#surahName')
  const pageInfoEl = screen.querySelector('#pageInfo')
  const pageNumBadge = screen.querySelector('#pageNumBadge')
  const playerContainer = screen.querySelector('#playerContainer')
  const recContainer = screen.querySelector('#recContainer')

  // ── Sidebar ───────────────────────────────────
  const sidebar = createSidebar((page, surah) => {
    goToPage(page)
  })
  screen.querySelector('#menuBtn').addEventListener('click', () => sidebar.show())

  // ── Settings ──────────────────────────────────
  screen.querySelector('#settingsBtn').addEventListener('click', () => {
    import('./settings.js').then(m => m.openSettings())
  })

  // ── Recorder ─────────────────────────────────
  createRecorder(recContainer, {
    currentPage: () => currentPage,
    currentSurah: () => getSurahByPage(currentPage)[0],
    onRecordingStart: () => {
      isRecording = true
      pageEl.classList.remove('text-visible')
      pageEl.classList.add('text-hidden')
      // Remove old player
      currentPlayerWrap?.remove()
      currentPlayerWrap = null
      playerContainer.classList.add('hidden')
    },
    onRecordingStop: (recording) => {
      isRecording = false
      pageEl.classList.remove('text-hidden')
      pageEl.classList.add('text-visible')
      showPlayer(recording)
    }
  })

  // ── Navigation ────────────────────────────────
  // Touch swipe (primary navigation — mobile first)
  let touchStartX = 0
  let touchStartY = 0
  const readerBody = screen.querySelector('#readerBody')

  readerBody.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
  }, { passive: true })

  readerBody.addEventListener('touchend', e => {
    if (isRecording) return
    const dx = e.changedTouches[0].clientX - touchStartX
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY)
    if (Math.abs(dx) > 40 && dy < 80) {
      // RTL convention: swipe left → next page, swipe right → previous page
      if (dx < 0) goToPage(currentPage - 1)
      else goToPage(currentPage + 1)
    }
  }, { passive: true })

  // ── Page Rendering ────────────────────────────
  async function goToPage(page) {
    if (page < 1 || page > TOTAL_PAGES) return
    currentPage = page
    await renderPage(currentPage)
    prefetchAdjacentPages(currentPage)
    const surah = getSurahByPage(currentPage)
    setLastRead(currentPage, surah[0])
  }

  async function renderPage(page) {
    // Show skeleton while loading
    pageEl.className = 'quran-page'
    pageEl.innerHTML = skeletonHTML()
    pageEl.style.height = ''

    const surah = getSurahByPage(page)
    const juz = getJuzByPage(page)
    surahNameEl.textContent = surah[1]
    pageInfoEl.textContent = `صفحة ${page} • جزء ${juz}`

    try {
      const data = await fetchQuranPage(page)

      if (!data.words?.length) {
        pageEl.innerHTML = offlinePlaceholder(page)
        return
      }

      // Render words — insert surah header when a new surah starts (ayah 1)
      let html = '<div class="page-verses">'
      let lastSurahNum = -1

      data.words.forEach((w, i) => {
        const surahNum = parseInt(w.verseKey.split(':')[0])
        const ayahNum  = w.verseKey.split(':')[1]

        // Insert surah header ONLY at the START of a surah (ayah 1)
        if (surahNum !== lastSurahNum && ayahNum === '1') {
          const info = SURAHS.find(s => s[0] === surahNum)
          html += buildSurahHeader(surahNum, info ? info[1] : '')
        }
        lastSurahNum = surahNum

        if (w.isEnd) {
          html += `<span class="ayah-number" data-word-index="${i}" data-verse="${w.verseKey}">&#xFD3F;${toArabicNum(ayahNum)}&#xFD3E;</span> `
        } else {
          html += `<span class="word" data-word-index="${i}" data-verse="${w.verseKey}">${w.text}</span> `
        }
      })

      html += '</div>'  // close .page-verses

      pageEl.className = 'quran-page text-visible'
      pageEl.innerHTML = html

      // Update fixed badge
      if (pageNumBadge) pageNumBadge.textContent = page

      initAnnotations(pageEl, page)

      // ── Auto-scale font to fit container ──
      await fitFontToScreen()

      // ── Fill remaining space — same surah only ──
      await fillRemainingSpace(page)

    } catch (e) {
      console.error(e)
      pageEl.innerHTML = offlinePlaceholder(page)
    }
  }

  /**
   * Fit all Quran words to screen with no scroll:
   * 1. Pin quran-page height = container inner height
   * 2. Binary-search largest font where page-verses fits inside that height
   */
  function fitFontToScreen() {
    return new Promise(resolve => {
      // Two rAF passes: first to get layout after render, second after we set height
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const container = screen.querySelector('#pageContainer')
        const versesEl  = pageEl.querySelector('.page-verses')
        if (!container || !versesEl) return resolve()

        // Step 1: Set exact height on pageEl = container inner height
        const containerInnerH = container.clientHeight
        const pagePadV = 20 + 24  // quran-page top(20) + bottom(24) padding
        const pageH    = containerInnerH - 24  // minus container padding (12+12)
        pageEl.style.height   = pageH + 'px'
        pageEl.style.overflow = 'hidden'

        // Full available height for verses — no page-number deduction
        const available = pageH - pagePadV - 8  // 8px small safety margin

        // Step 2: Font size cap based on user preference
        const fs     = getPrefs().fontSize  // 'small' | 'medium' | 'large'
        const maxPx  = fs === 'small' ? 18 : fs === 'large' ? 38 : 28
        let lo = 11, hi = maxPx, best = 13

        while (hi - lo > 0.3) {
          const mid = (lo + hi) / 2
          const lh  = mid <= 16 ? 1.9 : mid <= 22 ? 2.1 : 2.25
          versesEl.style.fontSize   = mid + 'px'
          versesEl.style.lineHeight = String(lh)

          if (versesEl.scrollHeight <= available) {
            best = mid
            lo = mid + 0.3
          } else {
            hi = mid - 0.3
          }
        }

        // Apply best
        const bestLh = best <= 16 ? 1.9 : best <= 22 ? 2.1 : 2.25
        versesEl.style.fontSize   = best + 'px'
        versesEl.style.lineHeight = String(bestLh)
        pageEl.style.fontSize     = best + 'px'

        resolve()
      }))
    })
  }

  /**
   * Fill remaining empty space at bottom with verses from the next Mushaf page,
   * BUT ONLY if those verses belong to the SAME surah as the current page.
   * Stops immediately at any surah boundary.
   */
  async function fillRemainingSpace(basePage) {
    const versesEl = pageEl.querySelector('.page-verses')
    if (!versesEl) return

    const pageH    = parseInt(pageEl.style.height) || 0
    const pagePadV = 44   // quran-page padding top+bottom
    const available = pageH - pagePadV - 8

    const currentSurahNum = getSurahByPage(basePage)[0]  // surah number
    let nextPage = basePage + 1
    let attempts = 0

    while (versesEl.scrollHeight < available * 0.85 && attempts < 4 && nextPage <= TOTAL_PAGES) {
      // ❌ Stop if next page belongs to a different surah
      const nextSurahNum = getSurahByPage(nextPage)[0]
      if (nextSurahNum !== currentSurahNum) break

      try {
        const data = await fetchQuranPage(nextPage)
        if (!data.words?.length) break

        // Extra safety: filter to only same-surah words
        const sameWords = data.words.filter(w =>
          parseInt(w.verseKey.split(':')[0]) === currentSurahNum
        )
        if (!sameWords.length) break

        appendWordsTo(versesEl, sameWords)
        nextPage++
        attempts++
      } catch { break }
    }
  }

  /** Build decorated surah name header HTML */
  function buildSurahHeader(surahNum, nameAr) {
    const showBismillah = surahNum !== 1 && surahNum !== 9  // No bismillah for Fatiha & Tawba
    return `
      <div class="surah-header">
        <div class="surah-name-banner">
          <span class="surah-ornament">﴿</span>
          <span class="surah-name-text">سورة ${nameAr}</span>
          <span class="surah-ornament">﴾</span>
        </div>
        ${showBismillah ? '<div class="surah-bismillah">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ</div>' : ''}
      </div>
    `
  }

  /** Append word+ayah-number spans (with surah headers) into an existing .page-verses element */
  function appendWordsTo(versesEl, words) {
    // Get surah of last rendered word (to detect new surah starts)
    const lastEl = versesEl.querySelector('[data-verse]:last-of-type')
    let lastSurahNum = lastEl ? parseInt(lastEl.dataset.verse.split(':')[0]) : -1

    words.forEach((w, i) => {
      const surahNum = parseInt(w.verseKey.split(':')[0])
      const ayahNum  = w.verseKey.split(':')[1]

      // Insert surah header when new surah starts
      if (surahNum !== lastSurahNum && ayahNum === '1') {
        const info = SURAHS.find(s => s[0] === surahNum)
        const headerHtml = buildSurahHeader(surahNum, info ? info[1] : '')
        const tmp = document.createElement('div')
        tmp.innerHTML = headerHtml
        while (tmp.firstChild) versesEl.appendChild(tmp.firstChild)
      }
      lastSurahNum = surahNum

      const span = document.createElement('span')
      if (w.isEnd) {
        span.className = 'ayah-number'
        span.dataset.verse = w.verseKey
        span.innerHTML = `&#xFD3F;${toArabicNum(ayahNum)}&#xFD3E;`
      } else {
        span.className = 'word'
        span.dataset.verse = w.verseKey
        span.dataset.wordIndex = w.idx
        span.textContent = w.text
      }
      versesEl.appendChild(span)
      versesEl.appendChild(document.createTextNode(' '))
    })
  }

  function toArabicNum(n) {
    return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d])
  }

  function skeletonHTML() {
    const widths = [95, 88, 92, 85, 90, 80, 93, 70]
    const lines = widths.map(w =>
      `<div class="skel-line" style="width:${w}%"></div>`
    ).join('')
    return `<div class="page-skeleton">${lines}</div>`
  }

  function offlinePlaceholder(page) {
    return `
      <div class="offline-msg">
        <div class="offline-icon">📵</div>
        <div class="offline-title">غير متاح دون الإنترنت</div>
        <div class="offline-sub">صفحة ${page} لم تُحمَّل بعد. تحقق من الاتصال.</div>
      </div>
    `
  }

  // ── Player ────────────────────────────────────
  function showPlayer(recording) {
    currentPlayerWrap?.remove()
    playerContainer.classList.remove('hidden')
    currentPlayerWrap = createPlayer(playerContainer, recording)
  }

  // ── Initial Load ─────────────────────────────
  renderPage(currentPage)
  prefetchAdjacentPages(currentPage)

  // Re-fit on window resize (orientation change, split-screen, etc.)
  const resizeObserver = new ResizeObserver(() => {
    fitFontToScreen()
  })
  resizeObserver.observe(screen)

  // Re-fit when user changes font size in settings
  window.addEventListener('fontsize-changed', () => {
    fitFontToScreen().then(() => fillRemainingSpace(currentPage))
  })

  return screen
}
