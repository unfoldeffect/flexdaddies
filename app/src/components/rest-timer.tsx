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

// Floating rest timer, visible on every screen once a profile is chosen (not
// on the profile-select screen). Tap it to start (or restart) a countdown
// between sets. Vibrates + chimes when time's up, then resets so it's ready
// for the next set.
export function RestTimer() {
  const [remaining, setRemaining] = useState(REST_SECONDS);
  const [running, setRunning] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const keepAliveRef = useRef<OscillatorNode | null>(null);

  // iOS/Safari (and some Android browsers) suspend an AudioContext that's
  // gone quiet for a while, even after it was unlocked by a tap — so a beep
  // scheduled a full minute later can silently do nothing. Two fixes below:
  // (1) re-check and resume the context right before actually playing, not
  // just once at the start; (2) keep a near-silent oscillator running the
  // whole time so the context never goes idle enough to get suspended.
  function ensureAudioUnlocked() {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    if (!keepAliveRef.current) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.00001;
      osc.frequency.value = 20;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      keepAliveRef.current = osc;
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
          const ctx = audioCtxRef.current;
          if (ctx) {
            if (ctx.state === "suspended") {
              ctx
                .resume()
                .then(() => playChime(ctx))
                .catch(() => playChime(ctx));
            } else {
              playChime(ctx);
            }
          }
          return REST_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  // Clear the "Go!" flash a couple seconds after the timer finishes.
  useEffect(() => {
    if (!justFinished) return;
    const t = setTimeout(() => setJustFinished(false), 2500);
    return () => clearTimeout(t);
  }, [justFinished]);

  const progress = running ? remaining / REST_SECONDS : 1;
  // Circular progress ring via conic-gradient, gold when idle/finished, navy sweep while running.
  const ringStyle = running
    ? {
        background: `conic-gradient(#c9a227 ${(1 - progress) * 360}deg, #0b254522 0deg)`,
      }
    : undefined;

  return (
    <button
      type="button"
      onClick={start}
      aria-label="Start 60 second rest timer"
      className="fixed top-24 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#0b2545] bg-[#c9a227] shadow-lg transition-transform active:scale-95"
      style={ringStyle}
    >
      <span className="flex h-[52px] w-[52px] flex-col items-center justify-center rounded-full bg-[#0b2545] font-oswald font-bold text-white">
        {justFinished ? (
          <span className="text-sm leading-none">GO!</span>
        ) : (
          <>
            <span className="text-lg leading-none">{running ? remaining : REST_SECONDS}</span>
            <span className="text-[9px] leading-none tracking-wide text-[#c9a227]">
              {running ? "REST" : "TAP"}
            </span>
          </>
        )}
      </span>
    </button>
  );
}
