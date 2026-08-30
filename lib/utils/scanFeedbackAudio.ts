"use client";

import { SCAN_SOUND_STORAGE_KEY } from "@/lib/constants/scan";

const OKAY_SRC = "/audio/okay.wav";

let primed = false;
let soundPrefLoaded = false;
let soundEnabled = true;
let okayAudio: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;

export function isScanSoundEnabled(): boolean {
  if (typeof window === "undefined") return soundEnabled;
  if (!soundPrefLoaded) {
    soundPrefLoaded = true;
    soundEnabled = localStorage.getItem(SCAN_SOUND_STORAGE_KEY) !== "off";
  }
  return soundEnabled;
}

export function setScanSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  soundPrefLoaded = true;
  if (typeof window === "undefined") return;
  localStorage.setItem(SCAN_SOUND_STORAGE_KEY, enabled ? "on" : "off");
  if (enabled) {
    unlockScanFeedback();
    return;
  }
  okayAudio?.pause();
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

function getOkayAudio(): HTMLAudioElement {
  if (!okayAudio) {
    okayAudio = new Audio(OKAY_SRC);
    okayAudio.preload = "auto";
    okayAudio.volume = 1;
  }
  return okayAudio;
}

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

/** Call from a tap/click so later scanner-only scans can play sound. */
export function unlockScanFeedback(): void {
  if (typeof window === "undefined" || primed) return;
  primed = true;

  const audio = getOkayAudio();
  audio.muted = true;
  void audio
    .play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    })
    .catch(() => {
      audio.muted = false;
    });

  void getAudioCtx()?.resume();
}

function speakOkayFallback(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance("Okay");
  utterance.lang = "en-US";
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

export function playScanOkay(): void {
  if (typeof window === "undefined" || !isScanSoundEnabled()) return;

  const audio = getOkayAudio();
  audio.muted = false;
  try {
    audio.currentTime = 0;
  } catch {
    /* ignore unseekable state */
  }
  void audio.play().catch(() => speakOkayFallback());
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number
): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.16, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

export function playScanReject(): void {
  if (typeof window === "undefined" || !isScanSoundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  void ctx.resume();
  const t = ctx.currentTime;
  tone(ctx, 220, t, 0.14);
  tone(ctx, 175, t + 0.18, 0.2);
}

if (typeof window !== "undefined") {
  const prime = () => unlockScanFeedback();
  window.addEventListener("pointerdown", prime, { once: true, capture: true });
  window.addEventListener("keydown", prime, { once: true, capture: true });
}
