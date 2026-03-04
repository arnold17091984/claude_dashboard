"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronRight, Home } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface HeaderProps {
  title: string;
  description?: string;
  /** Call this to trigger a re-fetch in the current page. The header exposes a refresh button. */
  onRefresh?: () => void;
  /** Whether the page is currently loading/refreshing */
  isRefreshing?: boolean;
}

// Map pathnames to breadcrumb labels (translation key)
const BREADCRUMB_MAP: Record<string, string> = {
  "/ranking": "nav.ranking",
  "/users": "nav.users",
  "/sessions": "nav.sessions",
  "/projects": "nav.projects",
  "/tools": "nav.tools",
  "/models": "nav.models",
  "/insights": "nav.insights",
};

function useBreadcrumbs() {
  const pathname = usePathname();
  const { t } = useI18n();

  const crumbs: Array<{ label: string; href: string; current: boolean }> = [
    { label: t("breadcrumb.home"), href: "/", current: pathname === "/" },
  ];

  // Try direct match first
  const directMatch = BREADCRUMB_MAP[pathname];
  if (directMatch) {
    crumbs.push({ label: t(directMatch), href: pathname, current: true });
    return crumbs;
  }

  // Handle nested paths like /users/[id]
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0) {
    const parentPath = `/${segments[0]}`;
    const parentKey = BREADCRUMB_MAP[parentPath];
    if (parentKey) {
      crumbs.push({ label: t(parentKey), href: parentPath, current: segments.length === 1 });
    }
    if (segments.length > 1) {
      // Leaf segment — show truncated ID or name
      const leaf = segments.at(-1) ?? "";
      crumbs.push({
        label: leaf.length > 12 ? `${leaf.slice(0, 12)}…` : leaf,
        href: pathname,
        current: true,
      });
    }
  }

  return crumbs;
}

export function Header({ title, description, onRefresh, isRefreshing }: Readonly<HeaderProps>) {
  const { t } = useI18n();
  const crumbs = useBreadcrumbs();
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

      {/* Breadcrumbs + Title */}
      <div className="flex-1 min-w-0">
        {/* Breadcrumb trail — visible on md+ */}
        {crumbs.length > 1 && (
          <nav
            className="hidden md:flex items-center gap-1 text-xs text-muted-foreground mb-0.5"
            aria-label="Breadcrumb"
          >
            {crumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />}
                {crumb.current ? (
                  <span className="text-foreground font-medium truncate max-w-[160px]">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="hover:text-foreground transition-colors flex items-center gap-1 truncate max-w-[120px]"
                  >
                    {i === 0 && <Home className="h-3 w-3 shrink-0" />}
                    <span>{i > 0 ? crumb.label : ""}</span>
                  </Link>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="page-header-title truncate">{title}</h1>
        {description && (
          <p className="page-header-description truncate hidden sm:block">{description}</p>
        )}
      </div>

      {/* Last updated timestamp — hidden on very small screens */}
      {formattedTime && onRefresh && (
        <span className="hidden lg:block text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {t("header.lastUpdated", { time: formattedTime })}
        </span>
      )}

      {/* Auto-refresh toggle — only when a refresh handler is provided */}
      {onRefresh && (
        <Button
          variant="ghost"
          size="sm"
          className={`hidden md:flex h-7 gap-1.5 text-xs px-2 ${autoRefresh ? "text-primary" : "text-muted-foreground"}`}
          onClick={() => setAutoRefresh((v) => !v)}
          title={t("header.autoRefresh")}
          aria-pressed={autoRefresh}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-primary animate-pulse" : "bg-muted-foreground/40"}`}
          />
          <span className="hidden xl:inline">{t("header.autoRefresh")}</span>
        </Button>
      )}

      {/* Refresh button */}
      {onRefresh && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs shrink-0"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label={t("header.refresh")}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">
            {isRefreshing ? t("header.refreshing") : t("header.refresh")}
          </span>
        </Button>
      )}

      <LanguageSwitcher />
      <ThemeToggle />
    </header>
  );
}
