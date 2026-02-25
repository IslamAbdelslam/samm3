import { getPrefs, setTheme, setFontSize } from '../utils/prefs.js'
import { showSuccess } from '../components/toast.js'

export function openSettings() {
  const prefs = getPrefs()

  const overlay = document.createElement('div')
  overlay.className = 'overlay overlay-enter'

  const sheet = document.createElement('div')
  sheet.className = 'sheet'
  sheet.style.maxHeight = '85dvh'
  sheet.style.overflowY = 'auto'

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">⚙ الإعدادات</div>

    <div class="settings-section">
      <div class="settings-label">المظهر</div>
      <div class="settings-options" id="themeOptions">
        <button class="opt-btn ${prefs.theme === 'dark' ? 'active' : ''}" data-val="dark">🌙 ليلي</button>
        <button class="opt-btn ${prefs.theme === 'light' ? 'active' : ''}" data-val="light">☀️ صباحي</button>
        <button class="opt-btn ${prefs.theme === 'auto' ? 'active' : ''}" data-val="auto">🔄 تلقائي</button>
      </div>
    </div>

    <div class="divider"></div>

    <div class="settings-section">
      <div class="settings-label">حجم الخط القرآني</div>
      <div class="settings-options" id="fontOptions">
        <button class="opt-btn ${prefs.fontSize === 'small' ? 'active' : ''}" data-val="small">صغير</button>
        <button class="opt-btn ${prefs.fontSize === 'medium' ? 'active' : ''}" data-val="medium">متوسط</button>
        <button class="opt-btn ${prefs.fontSize === 'large' ? 'active' : ''}" data-val="large">كبير</button>
      </div>
    </div>

    <div class="divider"></div>

    <div class="settings-section">
      <div class="settings-label">عن التطبيق</div>
      <div class="settings-about">
        <div class="about-name">سَمَّعْ</div>
        <div class="about-desc">تطبيق حفظ القرآن الكريم بالتسميع الصوتي</div>
        <div class="about-ver">الإصدار 1.0.0</div>
        <div class="about-note" style="margin-top:12px;font-size:12px;color:var(--text3)">
          ⚠ جميع التسجيلات محفوظة على جهازك فقط. لا يُرفع أي محتوى دون موافقتك.
        </div>
      </div>
    </div>

    <button class="btn btn-ghost w-full" id="settingsClose" style="margin-top:16px">إغلاق</button>
  `

  overlay.appendChild(sheet)
  document.body.appendChild(overlay)

  const close = () => {
    overlay.classList.add('overlay-leave')
    setTimeout(() => overlay.remove(), 300)
  }

  // Theme
  sheet.querySelectorAll('#themeOptions .opt-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      sheet.querySelectorAll('#themeOptions .opt-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      await setTheme(btn.dataset.val)
      showSuccess('تمّ حفظ المظهر')
    })
  })

  // Font size
  sheet.querySelectorAll('#fontOptions .opt-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      sheet.querySelectorAll('#fontOptions .opt-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      await setFontSize(btn.dataset.val)
      showSuccess('تمّ حفظ حجم الخط')
    })
  })

  sheet.querySelector('#settingsClose').addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })
}
