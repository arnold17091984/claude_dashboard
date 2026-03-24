"use client";

import {
  BarChart3,
  Trophy,
  Wrench,
  DollarSign,
  Sparkles,
  LayoutDashboard,
  Clock,
  Users,
  FolderGit2,
  Puzzle,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useI18n } from "@/lib/i18n";

export function AppSidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  const navItems = [
    { titleKey: "nav.overview", href: "/", icon: LayoutDashboard },
    { titleKey: "nav.ranking", href: "/ranking", icon: Trophy },
    { titleKey: "nav.users", href: "/users", icon: Users },
    { titleKey: "nav.sessions", href: "/sessions", icon: Clock },
    { titleKey: "nav.projects", href: "/projects", icon: FolderGit2 },
    { titleKey: "nav.tools", href: "/tools", icon: Wrench },
    { titleKey: "nav.skills", href: "/skills", icon: Puzzle },
    { titleKey: "nav.models", href: "/models", icon: DollarSign },
    { titleKey: "nav.insights", href: "/insights", icon: Sparkles },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/" className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <BarChart3 className="h-4 w-4" />
          </div>
          <span className="sidebar-brand-name">Claude Dashboard</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.groupLabel")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href)
                    }
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{t(item.titleKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <p className="text-overline text-muted-foreground px-1">
          v0.1.0
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
