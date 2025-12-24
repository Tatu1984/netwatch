"use client";

import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { CommandPalette } from "@/components/command-palette";
import { Modals } from "@/components/modals";
import { useUIStore } from "@/stores/ui";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "pl-16" : "pl-64"
      )}>
        <Header />
        <main className="p-6">{children}</main>
      </div>
      <CommandPalette />
      <Modals />
    </div>
  );
}
