import './style.css'
import './styles/components.css'
import { initPrefs, getPrefs } from './utils/prefs.js'
import { createWelcomeScreen } from './screens/welcome.js'
import { createReaderScreen } from './screens/reader.js'

async function init() {
  const app = document.getElementById('app')
  await initPrefs()

  const prefs = getPrefs()
  const showWelcome = !localStorage.getItem('sammaa-visited')

  if (showWelcome) {
    createWelcomeScreen(app, () => {
      localStorage.setItem('sammaa-visited', '1')
      createReaderScreen(app)
    })
  } else {
    createReaderScreen(app)
  }
}

init()
