export function createWelcomeScreen(app, onEnter) {
  const screen = document.createElement('div')
  screen.className = 'screen bg-pattern welcome-screen'
  screen.innerHTML = `
    <div class="welcome-inner">
      <div class="welcome-logo">
        <div class="welcome-bismillah">بسم الله الرحمن الرحيم</div>
        <div class="welcome-app-name">سَمَّعْ</div>
        <div class="welcome-tagline">تطبيق حفظ القرآن الكريم بالتسميع الصوتي</div>
      </div>

      <div class="welcome-features">
        <div class="feature-item">
          <span class="feature-icon">📖</span>
          <span>عرض القرآن الكريم صفحةً بصفحة</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">🎙️</span>
          <span>تسجيل الصوت ومقارنته بالنص</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">🎵</span>
          <span>تأثيرات صوتية احترافية</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">📝</span>
          <span>ملاحظات ملونة على الكلمات</span>
        </div>
      </div>

      <!-- Download progress bar (shown on first visit) -->
      <div class="prefetch-banner" id="prefetchBanner" style="display:none">
        <div class="prefetch-text" id="prefetchText">جارٍ تحميل القرآن الكريم...</div>
        <div class="prefetch-bar-track">
          <div class="prefetch-bar-fill" id="prefetchFill" style="width:0%"></div>
        </div>
        <div class="prefetch-count" id="prefetchCount">0 / 604</div>
      </div>

      <div class="welcome-actions">
        <button class="btn btn-primary welcome-skip" id="skipBtn">
          ابدأ الآن
          <span style="opacity:0.6;font-size:13px;margin-right:4px">بدون تسجيل</span>
        </button>
        <div class="welcome-or">أو</div>
        <button class="btn btn-ghost welcome-google" id="googleBtn">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          تسجيل الدخول بجوجل
        </button>
        <div class="welcome-privacy">
          🔒 تسجيلاتك محفوظة على جهازك فقط. لا نرفع أي بيانات بدون إذنك.
        </div>
      </div>
    </div>
  `

  app.appendChild(screen)

  // ── Public method to update the progress bar ─────────────────────────────
  screen.updatePrefetchProgress = function(done, total) {
    const banner  = screen.querySelector('#prefetchBanner')
    const fill    = screen.querySelector('#prefetchFill')
    const count   = screen.querySelector('#prefetchCount')
    const text    = screen.querySelector('#prefetchText')

    banner.style.display = 'block'
    const pct = Math.round((done / total) * 100)
    fill.style.width = pct + '%'
    count.textContent = `${done} / ${total}`

    if (done >= total) {
      text.textContent = '✅ تم تحميل القرآن الكريم بالكامل!'
      fill.style.background = 'var(--color-success, #4caf50)'
      setTimeout(() => { banner.style.opacity = '0'; banner.style.transition = 'opacity 1s' }, 2000)
    } else {
      text.textContent = 'جارٍ تحميل القرآن الكريم للاستخدام بدون إنترنت...'
    }
  }

  // ── Button handlers ──────────────────────────────────────────────────────
  const enter = () => {
    screen.style.animation = 'screenOut 0.3s ease forwards'
    setTimeout(() => { screen.remove(); onEnter() }, 280)
  }

  screen.querySelector('#skipBtn').addEventListener('click', enter)
  screen.querySelector('#googleBtn').addEventListener('click', enter)

  return screen
}
