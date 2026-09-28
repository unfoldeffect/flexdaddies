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
// Keeps the phone screen from dimming/locking while the app is open (after a
// profile is picked). Uses the Screen Wake Lock API (iPhone iOS 16.4+ in
// Safari, iOS 18.4+ from the home-screen app; Android Chrome). The browser
// drops the lock whenever the app is hidden, so it's re-requested when the
// app comes back and on any tap. Released when leaving (Switch profile).
function useKeepScreenOn() {
  useEffect(() => {
    const wakeLock = (navigator as any).wakeLock;
    if (!wakeLock) return;
    let lock: any = null;
    let pending = false;
    let cancelled = false;
    const request = async () => {
      if (cancelled || pending || document.visibilityState !== "visible") return;
      if (lock && !lock.released) return;
      pending = true;
      try {
        lock = await wakeLock.request("screen");
      } catch {
        // Not allowed right now (e.g. low-power mode) — try again on next tap.
      } finally {
        pending = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    request();
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("pointerdown", request);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("pointerdown", request);
      lock?.release?.().catch(() => {});
    };
  }, []);
}

export function RestTimer() {
  useKeepScreenOn();
  const [remaining, setRemaining] = useState(REST_SECONDS);
  const [running, setRunning] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Countdown is based on the finish time, not on counting ticks, so it
  // stays correct even if the phone pauses the page for a moment.
  const endAtRef = useRef(0);
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
    endAtRef.current = Date.now() + REST_SECONDS * 1000;
    setRemaining(REST_SECONDS);
    setRunning(true);
  }

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const left = Math.ceil((endAtRef.current - Date.now()) / 1000);
      if (left > 0) {
        setRemaining(left);
        return;
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRunning(false);
      setJustFinished(true);
      setRemaining(REST_SECONDS);
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
    };
    intervalRef.current = setInterval(tick, 250);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisible);
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
      className="fixed bottom-[104px] right-5 z-50 flex h-24 w-24 items-center justify-center rounded-full border-2 border-[#0b2545] bg-[#c9a227] shadow-lg transition-transform active:scale-95"
      style={ringStyle}
    >
      <span className="flex h-[78px] w-[78px] flex-col items-center justify-center rounded-full bg-[#0b2545] font-oswald font-bold text-white">
        {justFinished ? (
          <span className="text-[21px] leading-none">GO!</span>
        ) : (
          <>
            <span className="text-[27px] leading-none">{running ? remaining : REST_SECONDS}</span>
            <span className="mt-0.5 text-[13px] leading-none tracking-wide text-[#c9a227]">
              {running ? "REST" : "TAP"}
            </span>
          </>
        )}
      </span>
    </button>
  );
}
