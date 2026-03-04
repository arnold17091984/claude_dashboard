"use client";

import { type LucideIcon, Database } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Database,
  title,
  description,
  hint,
  action,
  className,
}: EmptyStateProps) {
  const { t } = useI18n();

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-16 px-6 text-center ${className ?? ""}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground/60" />
      </div>
      <div className="space-y-1 max-w-xs">
        <p className="text-h3 text-foreground font-semibold">
          {title ?? t("empty.title")}
        </p>
        {(description ?? hint) && (
          <p className="text-small text-muted-foreground">
            {description ?? hint ?? t("empty.description")}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
