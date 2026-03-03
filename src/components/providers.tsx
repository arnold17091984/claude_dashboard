"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { I18nProvider } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarProvider>
    </I18nProvider>
  );
}
