import { getAudioBlob } from '../utils/db.js'
import { applyReverb } from '../utils/audio.js'
import { showToast, showSuccess, showError } from './toast.js'

const DEFAULT_REVERB = {
  roomSize: 0.7, reverbTime: 2.5, damping: 0.5,
  inputBandwidth: 0.5, dryLevel: -1, earlyLevel: -6, tailLevel: -6,
}

const REVERB_PRESETS = {
  light: {
    label: '🌿 خفيف',
    params: { roomSize: 0.3, reverbTime: 0.8, damping: 0.3, inputBandwidth: 0.2, dryLevel: 0, earlyLevel: -10, tailLevel: -10 }
  },
  medium: {
    label: '🎵 متوسط',
    params: { roomSize: 0.65, reverbTime: 2.5, damping: 0.5, inputBandwidth: 0.5, dryLevel: -1, earlyLevel: -6, tailLevel: -6 }
  },
  strong: {
    label: '🕌 قوي',
    params: { roomSize: 0.95, reverbTime: 6.0, damping: 0.7, inputBandwidth: 0.7, dryLevel: -3, earlyLevel: -3, tailLevel: -3 }
  },
}

export function createPlayer(container, recording) {
  const { id, blob: initialBlob } = recording

  let currentBlob   = initialBlob
  let reverbEnabled = false
  let reverbParams  = { ...DEFAULT_REVERB }
  let isProcessing  = false

  // ── Build DOM ────────────────────────────────
  const wrap = document.createElement('div')
  wrap.className = 'player-wrap'
  wrap.innerHTML = `
    <div class="player-header">
      <span class="player-title">🎙 التسجيل</span>
      <button class="btn btn-icon player-close" title="إغلاق">✕</button>
    </div>

    <div class="player-body">
      <div class="player-time-row">
        <span class="player-time-cur" id="timeCur">0:00</span>
        <input type="range" class="player-seek" id="seekBar" min="0" step="0.01" value="0">
        <span class="player-time-dur" id="timeDur">--:--</span>
      </div>
      <div class="player-transport">
        <button class="transport-btn" id="rewBtn">⏮ 5ث</button>
        <button class="transport-btn play-btn" id="playBtn">▶</button>
        <button class="transport-btn" id="fwdBtn">5ث ⏭</button>
      </div>
    </div>

    <div class="player-reverb-section">
      <button class="reverb-toggle-btn" id="reverbToggle">
        <span class="reverb-icon">🎵</span>
        <span>صدى الصوت (Reverb)</span>
        <span class="reverb-badge" id="reverbBadge">معطّل</span>
      </button>
      <div class="reverb-panel" id="reverbPanel" style="display:none">
        <div class="reverb-presets" id="reverbPresets">
          <span class="reverb-presets-label">قوالب سريعة:</span>
          <button class="reverb-preset-btn" data-preset="light">🌿 خفيف</button>
          <button class="reverb-preset-btn" data-preset="medium">🎵 متوسط</button>
          <button class="reverb-preset-btn" data-preset="strong">🕌 قوي</button>
        </div>
        ${reverbSlider('roomSize',       'حجم الغرفة',               0,   1,    0.7,  2)}
        ${reverbSlider('reverbTime',     'مدة الصدى (ثانية)',        0.1, 10,   2.5,  1)}
        ${reverbSlider('damping',        'التخميد (Damping)',         0,   1,    0.5,  2)}
        ${reverbSlider('inputBandwidth', 'النطاق الترددي للمدخل',   0,   1,    0.5,  2)}
        ${reverbSlider('dryLevel',       'مستوى الجاف (dB)',        -70,  0,   -1,   1)}
        ${reverbSlider('earlyLevel',     'الانعكاسات المبكرة (dB)', -70,  0,   -6,   1)}
        ${reverbSlider('tailLevel',      'مستوى الذيل (dB)',        -70,  0,   -6,   1)}
        <button class="btn btn-primary reverb-apply-btn" id="reverbApply">✦ تطبيق الصدى</button>
        <button class="btn btn-ghost reverb-reset-btn"  id="reverbReset">↺ إعادة الضبط</button>
      </div>
      <div class="fx-processing hidden" id="fxProcessing">
        <div class="spinner"></div>
        <span>جاري تطبيق الصدى...</span>
      </div>
    </div>

    <div class="player-actions">
      <button class="btn btn-primary" id="exportBtn">⬇ تصدير</button>
      <button class="btn btn-ghost"   id="shareBtn">↗ مشاركة</button>
    </div>
  `
  container.appendChild(wrap)

  // ── Hidden audio element ─────────────────────
  // IMPORTANT: declare all DOM refs BEFORE calling setAudioSource
  const audioEl  = document.createElement('audio')
  audioEl.preload = 'metadata'
  audioEl.style.display = 'none'
  wrap.appendChild(audioEl)

  // ── Query elements (must come before setAudioSource) ──
  const playBtn  = wrap.querySelector('#playBtn')
  const seekBar  = wrap.querySelector('#seekBar')
  const timeCur  = wrap.querySelector('#timeCur')
  const timeDur  = wrap.querySelector('#timeDur')

  // Now safe to set audio source
  setAudioSource(currentBlob)

  // ── Audio events ─────────────────────────────
  audioEl.addEventListener('loadedmetadata', () => {
    if (isFinite(audioEl.duration)) {
      seekBar.max = audioEl.duration
      timeDur.textContent = fmtTime(audioEl.duration)
    }
  })

  audioEl.addEventListener('timeupdate', () => {
    seekBar.value = audioEl.currentTime
    timeCur.textContent = fmtTime(audioEl.currentTime)
  })

  audioEl.addEventListener('ended', () => { playBtn.textContent = '▶' })

  audioEl.addEventListener('error', (e) => {
    console.error('Audio error:', audioEl.error)
    showError('تعذّر تشغيل الصوت')
  })

  // ── Transport ────────────────────────────────
  playBtn.addEventListener('click', () => {
    if (audioEl.paused) {
      audioEl.play().catch(e => showError('تعذّر التشغيل: ' + e.message))
      playBtn.textContent = '⏸'
    } else {
      audioEl.pause()
      playBtn.textContent = '▶'
    }
  })

  seekBar.addEventListener('input', () => {
    audioEl.currentTime = parseFloat(seekBar.value)
  })

  wrap.querySelector('#rewBtn').addEventListener('click', () => {
    audioEl.currentTime = Math.max(0, audioEl.currentTime - 5)
  })
  wrap.querySelector('#fwdBtn').addEventListener('click', () => {
    audioEl.currentTime = Math.min(audioEl.duration || 0, audioEl.currentTime + 5)
  })

  // ── Reverb toggle ────────────────────────────
  const reverbPanel  = wrap.querySelector('#reverbPanel')
  const reverbBadge  = wrap.querySelector('#reverbBadge')
  const reverbToggle = wrap.querySelector('#reverbToggle')

  reverbToggle.addEventListener('click', () => {
    const open = reverbPanel.style.display === 'none'
    reverbPanel.style.display = open ? 'flex' : 'none'
    reverbToggle.classList.toggle('panel-open', open)
  })

  // Slider sync
  reverbPanel.querySelectorAll('.reverb-slider').forEach(slider => {
    const key   = slider.dataset.param
    const valEl = reverbPanel.querySelector(`#val_${key}`)
    slider.addEventListener('input', () => {
      reverbParams[key] = parseFloat(slider.value)
      if (valEl) valEl.textContent = Number(reverbParams[key]).toFixed(+slider.dataset.dec)
    })
  })

  // Preset buttons — load all params at once and auto-apply
  reverbPanel.querySelectorAll('.reverb-preset-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (isProcessing) return
      const preset = REVERB_PRESETS[btn.dataset.preset]
      if (!preset) return

      // Load preset params
      reverbParams = { ...preset.params }

      // Sync sliders + value labels
      reverbPanel.querySelectorAll('.reverb-slider').forEach(sl => {
        const k     = sl.dataset.param
        const valEl = reverbPanel.querySelector(`#val_${k}`)
        sl.value = reverbParams[k]
        if (valEl) valEl.textContent = Number(reverbParams[k]).toFixed(+sl.dataset.dec)
      })

      // Mark active preset
      reverbPanel.querySelectorAll('.reverb-preset-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')

      // Auto-apply immediately
      await applyReverbEffect()
    })
  })


  wrap.querySelector('#reverbApply').addEventListener('click', async () => {
    if (isProcessing) return
    await applyReverbEffect()
  })

  wrap.querySelector('#reverbReset').addEventListener('click', async () => {
    if (isProcessing) return
    reverbParams = { ...DEFAULT_REVERB }
    reverbPanel.querySelectorAll('.reverb-slider').forEach(sl => {
      sl.value = reverbParams[sl.dataset.param]
      const valEl = reverbPanel.querySelector(`#val_${sl.dataset.param}`)
      if (valEl) valEl.textContent = Number(reverbParams[sl.dataset.param]).toFixed(+sl.dataset.dec)
    })
    const orig = await getAudioBlob(id) || initialBlob
    currentBlob = orig
    setAudioSource(currentBlob)
    reverbEnabled = false
    reverbBadge.textContent = 'معطّل'
    reverbToggle.classList.remove('active')
    showToast('تمّت إعادة الضبط')
  })

  // ── Export / Share ────────────────────────────
  wrap.querySelector('#exportBtn').addEventListener('click', exportAudio)
  wrap.querySelector('#shareBtn').addEventListener('click', shareAudio)
  wrap.querySelector('.player-close').addEventListener('click', () => wrap.remove())

  // ── Helpers ───────────────────────────────────
  function setAudioSource(blob) {
    const url = URL.createObjectURL(blob)
    audioEl.src = url
    audioEl.load()
    playBtn.textContent = '▶'
    seekBar.value = 0
    timeCur.textContent = '0:00'
    timeDur.textContent = '--:--'
  }

  async function applyReverbEffect() {
    isProcessing = true
    const procEl = wrap.querySelector('#fxProcessing')
    procEl.classList.remove('hidden')
    try {
      const originalBlob = await getAudioBlob(id) || initialBlob
      currentBlob = await applyReverb(originalBlob, reverbParams)
      setAudioSource(currentBlob)
      reverbEnabled = true
      reverbBadge.textContent = 'مفعّل'
      reverbToggle.classList.add('active')
      showSuccess('تمّ تطبيق الصدى')
    } catch (e) {
      console.error('Reverb error:', e)
      showError('خطأ في تطبيق الصدى: ' + e.message)
    } finally {
      isProcessing = false
      procEl.classList.add('hidden')
    }
  }

  async function exportAudio() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(currentBlob)
    const ext = currentBlob.type.includes('webm') ? 'webm' : 'wav'
    a.download = `sammaa_${new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')}.${ext}`
    a.click()
    showSuccess('تمّ التصدير')
  }

  async function shareAudio() {
    if (!navigator.share) { exportAudio(); return }
    try {
      const file = new File([currentBlob], `sammaa-${Date.now()}.wav`, { type: currentBlob.type })
      await navigator.share({ title: 'تسجيل سَمَّعْ', files: [file] })
    } catch (e) {
      if (e.name !== 'AbortError') showError('تعذّرت المشاركة')
    }
  }

  return wrap
}

// ── Builder helpers ────────────────────────────

function reverbSlider(param, label, min, max, defaultVal, dec) {
  return `
    <div class="reverb-row">
      <div class="reverb-row-header">
        <span class="reverb-row-label">${label}</span>
        <span class="reverb-row-value" id="val_${param}">${Number(defaultVal).toFixed(dec)}</span>
      </div>
      <input type="range" class="reverb-slider"
        data-param="${param}" data-dec="${dec}"
        min="${min}" max="${max}" step="${((max - min) / 200).toFixed(4)}"
        value="${defaultVal}">
    </div>
  `
}

function fmtTime(s) {
  if (!isFinite(s)) return '--:--'
  const m   = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
