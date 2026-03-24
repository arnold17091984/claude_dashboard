import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login — Claude Code Dashboard",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
