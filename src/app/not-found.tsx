import Link from "next/link";
import { LayoutDashboard, SearchX } from "lucide-react";

/**
 * Global 404 page.
 *
 * This file lives outside the (dashboard) route group so the I18nProvider
 * context is unavailable here. We render compact trilingual text that covers
 * all supported locales (ja / en / ko) without any client-side hydration.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 bg-background text-foreground">
      {/* Icon */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <SearchX className="h-10 w-10 text-muted-foreground" />
      </div>

      {/* Status code */}
      <p className="text-8xl font-bold tracking-tight text-muted-foreground/30 select-none">
        404
      </p>

      {/* Message block */}
      <div className="text-center space-y-2 -mt-4 max-w-sm">
        <h1 className="text-2xl font-semibold">
          ページが見つかりません / Page not found / 페이지를 찾을 수 없습니다
        </h1>
        <p className="text-sm text-muted-foreground">
          お探しのページは存在しないか、移動した可能性があります。
          <br />
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          <br />
          찾으시는 페이지가 존재하지 않거나 이동되었습니다.
        </p>
      </div>

      {/* CTA */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <LayoutDashboard className="h-4 w-4" />
        ダッシュボードへ / Dashboard / 대시보드
      </Link>
    </div>
  );
}
