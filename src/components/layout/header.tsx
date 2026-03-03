"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="page-header sticky top-0 z-10">
      <SidebarTrigger className="-ml-1 h-8 w-8" />
      <div className="page-header-sep" />
      <div className="flex-1">
        <h1 className="page-header-title">{title}</h1>
        {description && (
          <p className="page-header-description">{description}</p>
        )}
      </div>
      <LanguageSwitcher />
      <ThemeToggle />
    </header>
  );
}
