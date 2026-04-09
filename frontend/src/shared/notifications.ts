export async function requestNotificationPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default') {
    return
  }

  await Notification.requestPermission()
}

export function notifyNewMessage(title: string, body: string) {
  if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') {
    return
  }

  new Notification(title, { body })
}

export function playNotificationTone() {
  const ToneContext = window.AudioContext ?? (window as typeof window & {
    webkitAudioContext?: typeof AudioContext
  }).webkitAudioContext

  if (!ToneContext) {
    return
  }

  const context = new ToneContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = 'triangle'
  oscillator.frequency.value = 660
  gain.gain.value = 0.025
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.12)
}