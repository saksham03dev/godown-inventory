"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchBusinessDays } from "@/lib/services/businessDayService";
import type { DailyBillClosing } from "@/lib/types/database";
import {
  formatBusinessDateLabel,
  getTodayBusinessDate,
} from "@/lib/utils/businessDay";
import { useAuth } from "@/contexts/AuthContext";

interface BusinessDayContextValue {
  today: string;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  closings: DailyBillClosing[];
  loading: boolean;
  refreshDays: () => Promise<void>;
  isViewingToday: boolean;
  selectedLabel: string;
}

const BusinessDayContext = createContext<BusinessDayContextValue | null>(null);

export function BusinessDayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, can } = useAuth();
  const [today, setToday] = useState(getTodayBusinessDate);
  const [selectedDate, setSelectedDate] = useState(getTodayBusinessDate);
  const [closings, setClosings] = useState<DailyBillClosing[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshDays = useCallback(async () => {
    if (!profile || !can("billing.view")) return;
    setLoading(true);
    try {
      const data = await fetchBusinessDays();
      if (data.success) {
        setToday(data.today);
        setClosings(data.closings ?? []);
        setSelectedDate((prev) =>
          prev === getTodayBusinessDate() ? data.today : prev
        );
      }
    } catch {
      // Keep local today if API fails
      setToday(getTodayBusinessDate());
    } finally {
      setLoading(false);
    }
  }, [profile, can]);

  useEffect(() => {
    void refreshDays();
  }, [refreshDays]);

  // Roll calendar date at midnight IST without full reload
  useEffect(() => {
    const id = setInterval(() => {
      const next = getTodayBusinessDate();
      setToday((prev) => {
        if (prev !== next) {
          void refreshDays();
          return next;
        }
        return prev;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [refreshDays]);

  const value = useMemo(
    () => ({
      today,
      selectedDate,
      setSelectedDate,
      closings,
      loading,
      refreshDays,
      isViewingToday: selectedDate === today,
      selectedLabel: formatBusinessDateLabel(selectedDate),
    }),
    [today, selectedDate, closings, loading, refreshDays]
  );

  return (
    <BusinessDayContext.Provider value={value}>
      {children}
    </BusinessDayContext.Provider>
  );
}

export function useBusinessDay() {
  const ctx = useContext(BusinessDayContext);
  if (!ctx) {
    throw new Error("useBusinessDay must be used within BusinessDayProvider");
  }
  return ctx;
}
