"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DEFAULT_SALE_MODE,
  getSaleModeRedirect,
  SALE_MODE_STORAGE_KEY,
  type SaleMode,
} from "@/lib/constants/saleMode";
import { BILLING_ENABLED } from "@/lib/constants/features";
import { useAuth } from "@/contexts/AuthContext";

interface SaleModeContextValue {
  mode: SaleMode;
  setMode: (mode: SaleMode) => void;
  canSwitchMode: boolean;
}

const SaleModeContext = createContext<SaleModeContextValue | null>(null);

function readStoredMode(): SaleMode {
  if (typeof window === "undefined") return DEFAULT_SALE_MODE;
  const stored = localStorage.getItem(SALE_MODE_STORAGE_KEY);
  return stored === "retail" ? "retail" : DEFAULT_SALE_MODE;
}

export function SaleModeProvider({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mode, setModeState] = useState<SaleMode>(DEFAULT_SALE_MODE);

  const canSwitchMode = BILLING_ENABLED && (role === "admin" || role === "manager");

  useEffect(() => {
    setModeState(readStoredMode());
  }, []);

  useEffect(() => {
    if (role === "employee") {
      setModeState("wholesale");
    }
  }, [role]);

  const setMode = useCallback(
    (next: SaleMode) => {
      if (!canSwitchMode && role === "employee") return;
      setModeState(next);
      localStorage.setItem(SALE_MODE_STORAGE_KEY, next);

      const redirect = getSaleModeRedirect(pathname, next);
      if (redirect) {
        router.push(redirect);
      }
    },
    [canSwitchMode, role, pathname, router]
  );

  const value = useMemo(
    () => ({ mode, setMode, canSwitchMode }),
    [mode, setMode, canSwitchMode]
  );

  return (
    <SaleModeContext.Provider value={value}>{children}</SaleModeContext.Provider>
  );
}

export function useSaleMode() {
  const ctx = useContext(SaleModeContext);
  if (!ctx) {
    throw new Error("useSaleMode must be used within SaleModeProvider");
  }
  return ctx;
}
