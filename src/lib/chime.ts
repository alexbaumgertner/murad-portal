// The slot timer's signal (story 014). Synthesized with the Web Audio API: no sound file, no
// request, no third-party origin (CSP stays untouched). Browsers keep audio locked until the
// visitor has touched the page, so every call can fail; the caller shows a visual banner then.

type AudioWindow = typeof globalThis & { webkitAudioContext?: typeof AudioContext }

let context: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (context) return context
  const Ctor = globalThis.AudioContext ?? (globalThis as AudioWindow).webkitAudioContext
  if (!Ctor) return null
  try {
    context = new Ctor()
  } catch {
    context = null
  }
  return context
}

/** Resolves true when the context is running (call it from a tap to be allowed to). */
async function unlock(): Promise<AudioContext | null> {
  const ctx = audioContext()
  if (!ctx) return null
  if (ctx.state !== 'running') {
    try {
      await ctx.resume()
    } catch {
      return null
    }
  }
  return ctx.state === 'running' ? ctx : null
}

/** Call from «Старт»: a tap lets later signals play even when the tab is in the background. */
export async function primeChime(): Promise<void> {
  await unlock()
}

/** Plays two short notes. Resolves false when the browser blocks audio or has none. */
export async function playChime(): Promise<boolean> {
  const ctx = await unlock()
  if (!ctx) return false
  const start = ctx.currentTime + 0.02
  for (const [index, frequency] of [880, 1318.5].entries()) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    const at = start + index * 0.22
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3)
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(at)
    oscillator.stop(at + 0.32)
  }
  return true
}

/** A short buzz where the device supports it; ignored elsewhere. */
export function vibrate(): void {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // Not supported or not allowed: the banner and the sound are enough.
  }
}
