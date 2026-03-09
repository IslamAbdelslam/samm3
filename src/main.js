import './style.css'
import './styles/components.css'
import { initPrefs, getPrefs } from './utils/prefs.js'
import { createWelcomeScreen } from './screens/welcome.js'
import { createReaderScreen } from './screens/reader.js'
import { prefetchAllPages } from './api/quran.js'

async function init() {
  const app = document.getElementById('app')
  await initPrefs()

  const prefs = getPrefs()
  const showWelcome = !localStorage.getItem('sammaa-visited')

  if (showWelcome) {
    const welcomeScreen = createWelcomeScreen(app, () => {
      localStorage.setItem('sammaa-visited', '1')
      createReaderScreen(app)
    })

    // Start prefetching all pages in the background — non-blocking
    prefetchAllPages((done, total) => {
      welcomeScreen.updatePrefetchProgress?.(done, total)
    }).catch(err => console.warn('Prefetch error:', err))

  } else {
    createReaderScreen(app)
  }
}

init()
