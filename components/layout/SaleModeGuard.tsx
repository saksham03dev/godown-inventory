"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSaleModeRedirect } from "@/lib/constants/saleMode";
import { useSaleMode } from "@/contexts/SaleModeContext";
import { useAuth } from "@/contexts/AuthContext";

/** Redirects when the active sale mode cannot access the current route. */
export function SaleModeGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode } = useSaleMode();
  const { role } = useAuth();

  useEffect(() => {
    if (role === "employee") return;
    const redirect = getSaleModeRedirect(pathname, mode);
    if (redirect) {
      router.replace(redirect);
    }
  }, [pathname, mode, role, router]);

  return <>{children}</>;
}
