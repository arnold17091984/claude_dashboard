"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthAccount {
  id: string;
  nickname: string;
  role: string;
  linkedUserId: string | null;
}

interface AuthContextValue {
  account: AuthAccount | null;
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue>({
  account: null,
  loading: true,
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// ---------------------------------------------------------------------------
// AuthGuard
// ---------------------------------------------------------------------------

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip auth check on login page itself
    if (pathname === "/login") {
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetch("/api/v1/auth/me", { credentials: "include" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setAccount(data.account ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Network error: redirect to login
          router.replace("/login");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  // Show minimal loading spinner while auth check is in progress
  if (loading && pathname !== "/login") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "oklch(0.985 0.004 65)",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "3px solid oklch(0.870 0.010 65)",
            borderTopColor: "oklch(0.600 0.190 65)",
            borderRadius: "50%",
            animation: "auth-spin 0.7s linear infinite",
          }}
        />
        <style>{`
          @keyframes auth-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ account, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
