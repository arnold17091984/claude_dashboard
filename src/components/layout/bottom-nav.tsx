"use client";

import {
  BarChart3,
  Trophy,
  Clock,
  Sparkles,
  LayoutDashboard,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

const navItems = [
  { titleKey: "nav.overview", href: "/", icon: LayoutDashboard },
  { titleKey: "nav.ranking", href: "/ranking", icon: Trophy },
  { titleKey: "nav.sessions", href: "/sessions", icon: Clock },
  { titleKey: "nav.tools", href: "/tools", icon: Wrench },
  { titleKey: "nav.models", href: "/models", icon: BarChart3 },
  { titleKey: "nav.insights", href: "/insights", icon: Sparkles },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item${isActive ? " bottom-nav-item--active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <item.icon className="bottom-nav-icon" aria-hidden="true" />
            <span className="bottom-nav-label">{t(item.titleKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
