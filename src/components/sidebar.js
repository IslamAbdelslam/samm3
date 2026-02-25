import { SURAHS } from '../data/surahs.js'

export function createSidebar(onSelectSurah) {
  let visible = false

  const overlay = document.createElement('div')
  overlay.className = 'sidebar-overlay'
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    backdrop-filter: blur(3px); z-index: 300;
    opacity: 0; pointer-events: none;
    transition: opacity 0.3s cubic-bezier(0.4,0,0.2,1);
  `

  const drawer = document.createElement('div')
  drawer.className = 'sidebar-drawer'
  drawer.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-title">
        <span class="sidebar-icon">📖</span>
        <span>سور القرآن الكريم</span>
      </div>
      <button class="btn btn-icon sidebar-close" id="sidebarClose" title="إغلاق">✕</button>
    </div>
    <div class="sidebar-search-wrap">
      <input type="text" class="sidebar-search" id="surahSearch" placeholder="ابحث عن سورة..." />
    </div>
    <div class="sidebar-list" id="surahList"></div>
  `
  drawer.style.cssText = `
    position: fixed; right: 0; top: 0; bottom: 0;
    width: min(320px, 85vw);
    background: var(--surface);
    border-left: 1px solid var(--border);
    z-index: 301;
    display: flex; flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
    box-shadow: -8px 0 32px rgba(0,0,0,0.4);
  `

  document.body.appendChild(overlay)
  document.body.appendChild(drawer)

  // Build surah list
  const listEl = drawer.querySelector('#surahList')
  renderList(listEl, SURAHS)

  // Search
  const searchInput = drawer.querySelector('#surahSearch')
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase()
    const filtered = q
      ? SURAHS.filter(s =>
          s[1].includes(searchInput.value.trim()) ||
          s[2].toLowerCase().includes(q) ||
          String(s[0]).includes(q)
        )
      : SURAHS
    renderList(listEl, filtered)
  })

  // Close
  overlay.addEventListener('click', hide)
  drawer.querySelector('#sidebarClose').addEventListener('click', hide)

  function renderList(container, surahs) {
    container.innerHTML = surahs.map(s => {
      const [num, nameAr, nameEn, ayahs, type] = s
      return `
        <button class="surah-item" data-page="${s[5]}" data-num="${num}">
          <div class="surah-num">${num}</div>
          <div class="surah-info">
            <div class="surah-name-ar">${nameAr}</div>
            <div class="surah-meta">
              <span class="badge badge-${type === 'makkiyya' ? 'makkiyya' : 'madaniyya'}">
                ${type === 'makkiyya' ? 'مكية' : 'مدنية'}
              </span>
              <span class="surah-ayahs">${ayahs} آية</span>
            </div>
          </div>
          <div class="surah-name-en">${nameEn}</div>
        </button>
      `
    }).join('')

    container.querySelectorAll('.surah-item').forEach(btn => {
      btn.addEventListener('click', () => {
        onSelectSurah(Number(btn.dataset.page), Number(btn.dataset.num))
        hide()
      })
    })
  }

  function show() {
    visible = true
    overlay.style.opacity = '1'
    overlay.style.pointerEvents = 'auto'
    drawer.style.transform = 'translateX(0)'
    searchInput.value = ''
    renderList(listEl, SURAHS)
    setTimeout(() => searchInput.focus(), 350)
  }

  function hide() {
    visible = false
    overlay.style.opacity = '0'
    overlay.style.pointerEvents = 'none'
    drawer.style.transform = 'translateX(100%)'
  }

  function toggle() {
    visible ? hide() : show()
  }

  return { show, hide, toggle }
}
