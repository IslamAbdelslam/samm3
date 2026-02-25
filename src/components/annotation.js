import { saveAnnotation, updateAnnotation, deleteAnnotation, getAnnotationsForPage } from '../utils/db.js'
import { showSuccess } from './toast.js'

const COLORS = [
  { id: 'red',    label: 'خطأ متكرر',      hex: '#e05252' },
  { id: 'yellow', label: 'يحتاج مراجعة',   hex: '#d4a017' },
  { id: 'green',  label: 'محفوظ جيداً',     hex: '#4a9e6b' },
]

export function initAnnotations(pageEl, page) {
  let longPressTimer = null
  const LONG_PRESS = 600

  // Load existing annotations
  loadAnnotations(pageEl, page)

  // Attach listeners to all word spans
  attachListeners(pageEl, page)
}

async function loadAnnotations(pageEl, page) {
  const annotations = await getAnnotationsForPage(page)
  annotations.forEach(ann => {
    const wordEl = pageEl.querySelector(`[data-word-index="${ann.wordIndex}"]`)
    if (wordEl) applyAnnotationStyle(wordEl, ann)
  })
}

function attachListeners(pageEl, page) {
  let longPressTimer = null
  let touchedEl = null

  pageEl.addEventListener('contextmenu', e => {
    const word = e.target.closest('.word')
    if (!word) return
    e.preventDefault()
    openAnnotationModal(word, page)
  })

  pageEl.addEventListener('touchstart', e => {
    const word = e.target.closest('.word')
    if (!word) return
    touchedEl = word
    longPressTimer = setTimeout(() => {
      touchedEl = null
      openAnnotationModal(word, page)
    }, 600)
  }, { passive: true })

  pageEl.addEventListener('touchend', () => {
    clearTimeout(longPressTimer)
    touchedEl = null
  })

  pageEl.addEventListener('touchmove', () => {
    clearTimeout(longPressTimer)
    touchedEl = null
  })

  // Tap on already annotated word
  pageEl.addEventListener('click', e => {
    const word = e.target.closest('.word-annotated')
    if (!word) return
    const annId = Number(word.dataset.annotationId)
    if (annId) openViewModal(word, annId, page)
  })
}

function openAnnotationModal(wordEl, page) {
  const wordIndex = Number(wordEl.dataset.wordIndex)
  const wordText = wordEl.textContent.trim()
  let selectedColor = 'red'

  const overlay = document.createElement('div')
  overlay.className = 'overlay overlay-enter'

  const sheet = document.createElement('div')
  sheet.className = 'sheet'
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">إضافة ملاحظة على: <span style="font-family:var(--quran-font);color:var(--gold)">${wordText}</span></div>
    <div class="ann-colors" id="annColors">
      ${COLORS.map(c => `
        <button class="ann-color-btn ${c.id === 'red' ? 'selected' : ''}" data-color="${c.id}"
          style="--color: ${c.hex}" title="${c.label}">
          <span class="ann-dot"></span>
          <span>${c.label}</span>
        </button>
      `).join('')}
    </div>
    <textarea id="annNote" rows="3" placeholder="اكتب ملاحظتك هنا..."></textarea>
    <div class="sheet-actions">
      <button class="btn btn-primary" id="annSave" style="flex:1">حفظ</button>
      <button class="btn btn-ghost" id="annCancel" style="flex:1">إلغاء</button>
    </div>
  `

  overlay.appendChild(sheet)
  document.body.appendChild(overlay)

  // Color selection
  const colorBtns = sheet.querySelectorAll('.ann-color-btn')
  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      colorBtns.forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      selectedColor = btn.dataset.color
    })
  })

  sheet.querySelector('#annCancel').addEventListener('click', () => {
    overlay.classList.add('overlay-leave')
    setTimeout(() => overlay.remove(), 300)
  })

  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.add('overlay-leave')
      setTimeout(() => overlay.remove(), 300)
    }
  })

  sheet.querySelector('#annSave').addEventListener('click', async () => {
    const noteText = sheet.querySelector('#annNote').value.trim()
    const id = await saveAnnotation({
      page,
      wordIndex,
      color: selectedColor,
      noteText
    })
    applyAnnotationStyle(wordEl, { id, wordIndex, color: selectedColor, noteText })
    overlay.remove()
    showSuccess('تمّت إضافة الملاحظة')
  })
}

function openViewModal(wordEl, annId, page) {
  const wordText = wordEl.textContent.trim()
  const color = wordEl.dataset.color
  const note = wordEl.dataset.note || ''
  const colorInfo = COLORS.find(c => c.id === color) || COLORS[0]

  const overlay = document.createElement('div')
  overlay.className = 'overlay overlay-enter'

  const sheet = document.createElement('div')
  sheet.className = 'sheet'
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">ملاحظة على: <span style="font-family:var(--quran-font);color:var(--gold)">${wordText}</span></div>
    <div class="ann-view-color">
      <span class="ann-dot" style="background:${colorInfo.hex};width:12px;height:12px;display:inline-block;border-radius:50%;margin-left:8px"></span>
      <span style="color:${colorInfo.hex}">${colorInfo.label}</span>
    </div>
    <div class="ann-view-note">${note || '<em style="color:var(--text3)">لا توجد ملاحظة</em>'}</div>
    <div class="sheet-actions">
      <button class="btn btn-danger" id="annDelete" style="flex:1">🗑 حذف</button>
      <button class="btn btn-ghost" id="annClose" style="flex:1">إغلاق</button>
    </div>
  `

  overlay.appendChild(sheet)
  document.body.appendChild(overlay)

  const close = () => {
    overlay.classList.add('overlay-leave')
    setTimeout(() => overlay.remove(), 300)
  }

  sheet.querySelector('#annClose').addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  sheet.querySelector('#annDelete').addEventListener('click', async () => {
    await deleteAnnotation(annId)
    wordEl.classList.remove('word-annotated')
    wordEl.removeAttribute('data-color')
    wordEl.removeAttribute('data-annotation-id')
    wordEl.removeAttribute('data-note')
    close()
    showSuccess('تمّ حذف الملاحظة')
  })
}

function applyAnnotationStyle(wordEl, ann) {
  wordEl.classList.add('word-annotated')
  wordEl.setAttribute('data-color', ann.color)
  wordEl.setAttribute('data-annotation-id', ann.id)
  wordEl.setAttribute('data-note', ann.noteText || '')
}
