"use client";

import { useEffect, useRef } from "react";
import {
  ACTIVITY_PING_INTERVAL_MS,
  INACTIVITY_TIMEOUT_MS,
} from "@/lib/auth/idle-timeout";

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

interface UseIdleTimeoutOptions {
  enabled: boolean;
  onIdle: () => void;
}

export function useIdleTimeout({ enabled, onIdle }: UseIdleTimeoutOptions) {
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPingRef = useRef(0);
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return;

    const pingActivity = () => {
      const now = Date.now();
      if (now - lastPingRef.current < ACTIVITY_PING_INTERVAL_MS) return;
      lastPingRef.current = now;
      void fetch("/api/auth/activity", { method: "POST" });
    };

    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        onIdleRef.current();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const handleActivity = () => {
      resetIdleTimer();
      pingActivity();
    };

    resetIdleTimer();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleActivity();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled]);
}
