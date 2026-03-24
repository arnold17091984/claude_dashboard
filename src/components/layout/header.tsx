"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface HeaderProps {
  title: string;
  description?: string;
  /** Call this to trigger a re-fetch in the current page. The header exposes a refresh button. */
  onRefresh?: () => void;
  /** Whether the page is currently loading/refreshing */
  isRefreshing?: boolean;
}

export function Header({ title, description, onRefresh, isRefreshing }: Readonly<HeaderProps>) {
  const { t } = useI18n();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Record when page first loads
  useEffect(() => {
    setLastUpdated(new Date());
  }, []);

  // Update lastUpdated when refresh completes (isRefreshing goes false after being true)
  const prevRefreshing = useRef(false);
  useEffect(() => {
    if (prevRefreshing.current && !isRefreshing) {
      setLastUpdated(new Date());
    }
    prevRefreshing.current = !!isRefreshing;
  }, [isRefreshing]);

  // Auto-refresh every 60 s
  useEffect(() => {
    if (autoRefresh && onRefresh) {
      autoRefreshRef.current = setInterval(() => {
        onRefresh();
      }, 60_000);
    }
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [autoRefresh, onRefresh]);

  const handleRefresh = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  const formattedTime = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <header className="page-header sticky top-0 z-10">
      <SidebarTrigger className="-ml-1 h-8 w-8" />
      <div className="page-header-sep" />

      {/* Title + description */}
      <div className="flex-1 min-w-0">
        <h1 className="page-header-title truncate">{title}</h1>
        {description && (
          <p className="page-header-description truncate hidden sm:block">{description}</p>
        )}
      </div>

      {/* Right-side controls group */}
      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        {formattedTime && onRefresh && (
          <span className="hidden lg:block text-xs text-muted-foreground whitespace-nowrap mr-1">
            {t("header.lastUpdated", { time: formattedTime })}
          </span>
        )}

        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            className={`hidden md:flex h-7 gap-1 text-xs px-2 ${autoRefresh ? "text-primary" : "text-muted-foreground"}`}
            onClick={() => setAutoRefresh((v) => !v)}
            title={t("header.autoRefresh")}
            aria-pressed={autoRefresh}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-primary animate-pulse" : "bg-muted-foreground/40"}`}
            />
          </Button>
        )}

        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs shrink-0 px-2"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label={t("header.refresh")}
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        )}

        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
