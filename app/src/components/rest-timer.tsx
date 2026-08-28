import { useEffect, useRef, useState } from "react";

const REST_SECONDS = 90;

// Plays a short double-beep using the Web Audio API — no audio file needed,
// so it works offline and doesn't add anything to the bundle.
function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const beep = (delay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.3);
    };
    beep(0);
    beep(0.3);
  } catch {
    // Audio isn't critical — fail silently (e.g. autoplay-blocked browsers).
  }
}

// Floating rest timer, available on every screen. Tap it to start (or
// restart) a 90-second countdown between sets. Vibrates + chimes when time's
// up, then resets so it's ready for the next set.
export function RestTimer() {
  const [remaining, setRemaining] = useState(REST_SECONDS);
  const [running, setRunning] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function start() {
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
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          playChime();
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
      aria-label="Start 90 second rest timer"
      className="fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#0b2545] bg-[#c9a227] shadow-lg transition-transform active:scale-95"
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
