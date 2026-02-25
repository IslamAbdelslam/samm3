let container = null

function getContainer() {
  if (!container) {
    container = document.createElement('div')
    container.className = 'toast-container'
    document.body.appendChild(container)
  }
  return container
}

export function showToast(message, duration = 3000) {
  const c = getContainer()
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = message
  c.appendChild(toast)

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s cubic-bezier(0.4,0,0.2,1) forwards'
    setTimeout(() => toast.remove(), 300)
  }, duration)
}

export function showSuccess(msg) {
  const c = getContainer()
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.style.borderColor = 'rgba(74,158,107,0.4)'
  toast.style.color = '#74c69d'
  toast.innerHTML = `✓ ${msg}`
  c.appendChild(toast)
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards'
    setTimeout(() => toast.remove(), 300)
  }, 2500)
}

export function showError(msg) {
  const c = getContainer()
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.style.borderColor = 'rgba(224,82,82,0.4)'
  toast.style.color = '#f08080'
  toast.innerHTML = `✗ ${msg}`
  c.appendChild(toast)
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards'
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}
