import { openDB } from 'idb'

const DB_NAME = 'sammaa-db'
const DB_VERSION = 2  // bump to re-run upgrade for existing users

let _db = null

async function getDB() {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Quran page cache
      if (!db.objectStoreNames.contains('quran-pages')) {
        db.createObjectStore('quran-pages', { keyPath: 'page' })
      }
      // Recordings metadata
      if (!db.objectStoreNames.contains('recordings')) {
        const s = db.createObjectStore('recordings', { keyPath: 'id', autoIncrement: true })
        s.createIndex('by-page', 'page')
        s.createIndex('by-surah', 'surahNumber')
        s.createIndex('by-date', 'createdAt')
      }
      // Annotations
      if (!db.objectStoreNames.contains('annotations')) {
        const a = db.createObjectStore('annotations', { keyPath: 'id', autoIncrement: true })
        a.createIndex('by-page', 'page')
        a.createIndex('by-word', ['page', 'wordIndex'])
      }
      // Preferences (single record)
      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'key' })
      }
      // Audio blobs
      if (!db.objectStoreNames.contains('audio-blobs')) {
        db.createObjectStore('audio-blobs', { keyPath: 'id' })
      }
    }
  })
  return _db
}

// ── Quran Pages Cache ─────────────────────────
export async function getCachedPage(page) {
  const db = await getDB()
  return db.get('quran-pages', page)
}

export async function setCachedPage(page, data) {
  const db = await getDB()
  return db.put('quran-pages', { page, data, cachedAt: Date.now() })
}

export async function getCachedPageCount() {
  const db = await getDB()
  return db.count('quran-pages')
}

// ── Recordings ────────────────────────────────
export async function saveRecording(meta) {
  const db = await getDB()
  return db.add('recordings', { ...meta, createdAt: Date.now() })
}

export async function getRecordingsForPage(page) {
  const db = await getDB()
  return db.getAllFromIndex('recordings', 'by-page', page)
}

export async function getAllRecordings() {
  const db = await getDB()
  return db.getAll('recordings')
}

export async function deleteRecording(id) {
  const db = await getDB()
  await db.delete('recordings', id)
  await db.delete('audio-blobs', id)
}

// ── Audio Blobs ───────────────────────────────
export async function saveAudioBlob(id, blob) {
  const db = await getDB()
  return db.put('audio-blobs', { id, blob })
}

export async function getAudioBlob(id) {
  const db = await getDB()
  const record = await db.get('audio-blobs', id)
  return record?.blob
}

// ── Annotations ───────────────────────────────
export async function saveAnnotation(annotation) {
  const db = await getDB()
  return db.add('annotations', { ...annotation, createdAt: Date.now() })
}

export async function updateAnnotation(id, changes) {
  const db = await getDB()
  const existing = await db.get('annotations', id)
  if (!existing) throw new Error('Annotation not found')
  return db.put('annotations', { ...existing, ...changes })
}

export async function deleteAnnotation(id) {
  const db = await getDB()
  return db.delete('annotations', id)
}

export async function getAnnotationsForPage(page) {
  const db = await getDB()
  return db.getAllFromIndex('annotations', 'by-page', page)
}

// ── Preferences ───────────────────────────────
export async function getPref(key) {
  const db = await getDB()
  const record = await db.get('preferences', key)
  return record?.value
}

export async function setPref(key, value) {
  const db = await getDB()
  return db.put('preferences', { key, value })
}
