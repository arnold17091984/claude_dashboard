import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login — Claude Code Dashboard",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
