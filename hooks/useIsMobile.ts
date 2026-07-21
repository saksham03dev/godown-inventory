"use client";

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 639px)";

/** True when viewport is below the `sm` breakpoint (mobile). */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}
