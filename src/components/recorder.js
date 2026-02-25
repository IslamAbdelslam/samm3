import { drawWaveform } from '../utils/audio.js'
import { saveRecording, saveAudioBlob } from '../utils/db.js'
import { showError, showToast } from './toast.js'

export function createRecorder(container, opts = {}) {
  const { onRecordingStart, onRecordingStop, currentPage, currentSurah } = opts

  let mediaRecorder = null
  let audioChunks = []
  let analyser = null
  let audioCtx = null
  let recordingId = null
  let timerInterval = null
  let seconds = 0
  let autosaveInterval = null
  let stream = null

  // ── DOM ──────────────────────────────────────
  const wrap = document.createElement('div')
  wrap.className = 'recorder-wrap'
  wrap.innerHTML = `
    <div class="recorder-idle">
      <button class="rec-fab" id="recStart" title="ابدأ التسميع">
        <span class="rec-icon">🎙️</span>
        <span class="rec-label">ابدأ التسميع</span>
      </button>
    </div>

    <div class="recorder-active hidden" id="recActive">
      <div class="rec-waveform-wrap">
        <canvas id="waveform" width="300" height="60"></canvas>
      </div>
      <div class="rec-timer" id="recTimer">00:00</div>
      <button class="rec-stop-btn" id="recStop">
        <span class="rec-stop-icon">⏹</span>
        <span>إيقاف التسجيل</span>
      </button>
    </div>
  `
  container.appendChild(wrap)

  // ── Buttons ─────────────────────────────────
  const startBtn = wrap.querySelector('#recStart')
  const stopBtn  = wrap.querySelector('#recStop')
  const activePanel = wrap.querySelector('#recActive')
  const idlePanel = wrap.querySelector('.recorder-idle')
  const timerEl = wrap.querySelector('#recTimer')
  const canvas = wrap.querySelector('#waveform')

  startBtn.addEventListener('click', startRecording)
  stopBtn.addEventListener('click', stopRecording)

  // ── Start ────────────────────────────────────
  async function startRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } })
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        showError('يرجى منح إذن استخدام الميكروفون')
      } else {
        showError('تعذّر الوصول للميكروفون')
      }
      return
    }

    // Set up Web Audio for visualizer
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const source = audioCtx.createMediaStreamSource(stream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    // Set up MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'

    mediaRecorder = new MediaRecorder(stream, { mimeType })
    audioChunks = []

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) audioChunks.push(e.data)
    }

    mediaRecorder.start(1000) // collect every 1s

    // UI switch
    idlePanel.classList.add('hidden')
    activePanel.classList.remove('hidden')

    // Waveform
    canvas.width = canvas.offsetWidth || 300
    drawWaveform(analyser, canvas)

    // Timer
    seconds = 0
    timerInterval = setInterval(() => {
      seconds++
      timerEl.textContent = formatTime(seconds)
    }, 1000)

    // Autosave every 30s
    autosaveInterval = setInterval(() => {
      if (mediaRecorder?.state === 'recording') {
        mediaRecorder.requestData()
      }
    }, 30000)

    onRecordingStart?.()
  }

  // ── Stop ─────────────────────────────────────
  async function stopRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return

    return new Promise(resolve => {
      mediaRecorder.onstop = async () => {
        clearInterval(timerInterval)
        clearInterval(autosaveInterval)

        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType })
        const id = Date.now()

        // Save to IndexedDB
        await saveAudioBlob(id, blob)
        recordingId = await saveRecording({
          id,
          page: currentPage(),
          surahNumber: currentSurah(),
          duration: seconds,
          mimeType: mediaRecorder.mimeType,
          appliedEffects: []
        })

        // Cleanup
        stream?.getTracks().forEach(t => t.stop())
        audioCtx?.close()

        // UI back to idle (but show player above)
        activePanel.classList.add('hidden')
        idlePanel.classList.remove('hidden')

        onRecordingStop?.({ id, blob, duration: seconds })
        resolve({ id, blob, duration: seconds })
      }

      mediaRecorder.stop()
    })
  }

  function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const ss = (s % 60).toString().padStart(2, '0')
    return `${m}:${ss}`
  }

  return { startRecording, stopRecording }
}
