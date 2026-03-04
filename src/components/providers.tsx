"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { I18nProvider } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <SidebarProvider>
        <AppSidebar />
        {/* pb-16 on mobile reserves space above the bottom navigation bar */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
        <BottomNav />
      </SidebarProvider>
    </I18nProvider>
  );
}
