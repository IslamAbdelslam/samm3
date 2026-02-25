import { getPref, setPref } from './db.js'

const DEFAULTS = {
  theme: 'dark',
  fontSize: 'medium',
  lastReadPage: 1,
  lastReadSurah: 1,
  driveAutoUpload: false
}

const cache = { ...DEFAULTS }
let initialized = false

export async function initPrefs() {
  if (initialized) return cache
  for (const key of Object.keys(DEFAULTS)) {
    const val = await getPref(key)
    if (val !== undefined) cache[key] = val
  }
  initialized = true
  applyTheme(cache.theme)
  applyFontSize(cache.fontSize)
  return cache
}

export function getPrefs() {
  return { ...cache }
}

export async function setTheme(theme) {
  cache.theme = theme
  await setPref('theme', theme)
  applyTheme(theme)
}

export async function setFontSize(size) {
  cache.fontSize = size
  await setPref('fontSize', size)
  applyFontSize(size)
  // Notify reader to re-fit immediately
  window.dispatchEvent(new CustomEvent('fontsize-changed', { detail: size }))
}

export async function setLastRead(page, surah) {
  cache.lastReadPage = page
  cache.lastReadSurah = surah
  await setPref('lastReadPage', page)
  await setPref('lastReadSurah', surah)
}

function applyTheme(theme) {
  const t = theme === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : theme
  document.documentElement.setAttribute('data-theme', t)
}

function applyFontSize(size) {
  document.body.setAttribute('data-fontsize', size)
}

// Auto-theme listener
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (cache.theme === 'auto') applyTheme('auto')
})
