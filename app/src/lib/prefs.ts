// Settings that belong to this phone or browser (not to the shared data):
// units, rest timer length, chime. Kept in localStorage; every part of the
// app that reads a setting updates the moment it changes anywhere.
import { useSyncExternalStore } from "react";

export const REST_CHOICES = [30, 45, 60, 90, 120] as const;
export const DEFAULT_REST_SECONDS = 60;

export const PREF_KEYS = {
  weightUnit: "fd-weight-unit",
  lengthUnit: "fd-length-unit",
  restSeconds: "fd-rest-seconds",
  restSound: "fd-rest-sound",
} as const;

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts until the page reloads */
  }
  memory.set(key, value);
  listeners.forEach((fn) => fn());
}

// Fallback copy for when localStorage is blocked (private mode, etc.).
const memory = new Map<string, string>();

/** A stored choice from a fixed list, e.g. lbs/kg. Falls back when unset or invalid. */
export function useStoredPref<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key) ?? memory.get(key) ?? null,
    () => null,
  );
  const value =
    raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  return [value, (next: T) => write(key, next)] as const;
}

/** Picks the stored rest length, or the default when it is missing or not one of the choices. */
export function parseRestSeconds(raw: string | null): number {
  const n = Number(raw);
  return (REST_CHOICES as readonly number[]).includes(n) ? n : DEFAULT_REST_SECONDS;
}

export function useRestSeconds() {
  const [raw, setRaw] = useStoredPref<string>(
    PREF_KEYS.restSeconds,
    String(DEFAULT_REST_SECONDS),
    REST_CHOICES.map(String),
  );
  return [parseRestSeconds(raw), (s: number) => setRaw(String(s))] as const;
}

export function useRestSound() {
  const [raw, setRaw] = useStoredPref<"on" | "off">(PREF_KEYS.restSound, "on", ["on", "off"]);
  return [raw === "on", (on: boolean) => setRaw(on ? "on" : "off")] as const;
}

/** "45s", "1 min", "90s", "2 min" */
export function restLabel(s: number): string {
  return s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s}s`;
}
