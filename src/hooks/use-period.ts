"use client";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

const VALID_PERIODS = ["7d", "30d", "90d"] as const;
type Period = typeof VALID_PERIODS[number];

export function usePeriod(defaultPeriod: Period = "30d") {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const period = (VALID_PERIODS.includes(searchParams.get("period") as Period)
    ? searchParams.get("period")
    : defaultPeriod) as Period;

  const setPeriod = useCallback(
    (newPeriod: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", newPeriod);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  return [period, setPeriod] as const;
}
