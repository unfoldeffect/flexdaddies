import { useEffect, useRef, useState } from "react";

const REST_SECONDS = 60;

function playChime(ctx: AudioContext) {
  try {
    const beep = (delay: number) => {
      // Two oscillators (a fundamental + an octave-up harmonic) read as a
      // brighter, more piercing "alarm" tone than a single sine at the same
      // volume — and gain is maxed near 1.0 to be as loud as this API allows.
      [880, 1760].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        const peak = i === 0 ? 0.9 : 0.4;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.45);
      });
    };
    beep(0);
    beep(0.45);
    beep(0.9);
  } catch {
    // Audio isn't critical — fail silently (e.g. autoplay-blocked browsers).
  }
}

// Inline rest timer, sits between the Plans row and the date field on the Log
// tab. Tap to start (or restart) a countdown between sets. Vibrates + chimes
// when time's up, then resets so it's ready for the next set.
export function RestTimer() {
  const [remaining, setRemaining] = useState(REST_SECONDS);
  const [running, setRunning] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // iOS/Safari suspends AudioContext until it's created *and* resumed inside
  // a direct user-gesture handler — if that only happens later (e.g. inside
  // a setInterval callback when the timer finishes), no sound ever plays.
  // Unlocking it here, synchronously on tap, is what makes the chime reliable.
  function ensureAudioUnlocked() {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
  }

  function start() {
    ensureAudioUnlocked();
    setJustFinished(false);
    setRemaining(REST_SECONDS);
    setRunning(true);
  }

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setRunning(false);
          setJustFinished(true);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
          if (audioCtxRef.current) playChime(audioCtxRef.current);
          return REST_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  // Clear the "time's up" flash a few seconds after the timer finishes.
  useEffect(() => {
    if (!justFinished) return;
    const t = setTimeout(() => setJustFinished(false), 3000);
    return () => clearTimeout(t);
  }, [justFinished]);

  const progress = running ? (REST_SECONDS - remaining) / REST_SECONDS : 0;

  return (
    <button
      type="button"
      onClick={start}
      className={`rest-timer-pill ${justFinished ? "rest-timer-pill--done" : ""}`}
      aria-label={`Start ${REST_SECONDS} second rest timer`}
    >
      <span className="rest-timer-fill" style={{ width: `${progress * 100}%` }} />
      <span className="rest-timer-label">
        {justFinished ? "DONE — TAP" : running ? `${remaining}s` : `REST ${REST_SECONDS}s`}
      </span>
    </button>
  );
}
