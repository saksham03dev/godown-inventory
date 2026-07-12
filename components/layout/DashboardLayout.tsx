"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { SaleModeGuard } from "./SaleModeGuard";

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardLayout({
  title,
  subtitle,
  actions,
  children,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setSidebarOpen(true)}
          actions={actions}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <SaleModeGuard>{children}</SaleModeGuard>
        </main>
      </div>
    </div>
  );
}
