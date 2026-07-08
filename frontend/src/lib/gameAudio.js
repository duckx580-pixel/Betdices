let audioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function safePlay(fn) {
  try {
    fn();
  } catch (_) {
    // no-op; audio should never break gameplay
  }
}

function playTone(ctx, { freq, type = "sine", at = 0, duration = 0.1, gain = 0.035 }) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now + at);

  g.gain.setValueAtTime(0.0001, now + at);
  g.gain.exponentialRampToValueAtTime(gain, now + at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + at + duration);

  osc.connect(g);
  g.connect(ctx.destination);

  osc.start(now + at);
  osc.stop(now + at + duration + 0.02);
}

function ensureReady(ctx) {
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

export function playGameActionSound() {
  safePlay(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    ensureReady(ctx);
    playTone(ctx, { freq: 520, type: "triangle", duration: 0.06, gain: 0.02 });
    playTone(ctx, { freq: 700, type: "triangle", at: 0.05, duration: 0.08, gain: 0.018 });
  });
}

export function playGameWinSound(multiplier = 1) {
  safePlay(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    ensureReady(ctx);
    const boost = Math.min(1.35, 1 + (Number(multiplier) || 0) / 10);
    playTone(ctx, { freq: 520 * boost, type: "sine", duration: 0.1, gain: 0.03 });
    playTone(ctx, { freq: 680 * boost, type: "sine", at: 0.08, duration: 0.12, gain: 0.03 });
    playTone(ctx, { freq: 860 * boost, type: "sine", at: 0.16, duration: 0.18, gain: 0.034 });
  });
}

export function playGameLoseSound() {
  safePlay(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    ensureReady(ctx);
    playTone(ctx, { freq: 280, type: "sawtooth", duration: 0.1, gain: 0.02 });
    playTone(ctx, { freq: 220, type: "sawtooth", at: 0.08, duration: 0.13, gain: 0.02 });
  });
}
