"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>

      <div className="text-center space-y-2 max-w-sm">
        <h2 className="text-h2 text-foreground">
          {t("error.title")}
        </h2>
        <p className="text-small text-muted-foreground">
          {t("error.description")}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            {error.digest}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={reset} variant="default" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t("error.retry")}
        </Button>
        <Button
          onClick={() => router.push("/")}
          variant="outline"
          className="gap-2"
        >
          <LayoutDashboard className="h-4 w-4" />
          {t("error.goHome")}
        </Button>
      </div>
    </div>
  );
}
