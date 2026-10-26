import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicBackendBase, joinUrl } from "@/lib/urlConfig";

export type RetailSalesPolicy = { enabled: boolean; version: number; changed_at: string | null };
export function parseRetailSalesPolicy(value: unknown): RetailSalesPolicy {
  const p = value as RetailSalesPolicy;
  if (!p || typeof p.enabled !== "boolean" || !Number.isSafeInteger(p.version) || p.version < 0)
    throw new Error("Retail sales settings could not be verified.");
  return { enabled: p.enabled, version: p.version, changed_at: p.changed_at || null };
}
const RetailSalesContext = createContext({ enabled: false, ready: false });
export const retailPolicyQueryKey = ["retail-sales-policy"] as const;
export function RetailSalesProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: retailPolicyQueryKey,
    queryFn: async () => {
      const response = await fetch(joinUrl(getPublicBackendBase(), "/api/alphascreen/packages"), {
        headers: { Accept: "application/json" }, cache: "no-store",
      });
      if (!response.ok) throw new Error("Retail sales settings unavailable");
      return parseRetailSalesPolicy((await response.json()).retail_sales_policy);
    },
    staleTime: 0, refetchInterval: 30_000, refetchOnWindowFocus: true, retry: false,
  });
  return <RetailSalesContext.Provider value={{ enabled: !query.isError && query.data?.enabled === true,
    ready: !query.isError && !!query.data }}>{children}</RetailSalesContext.Provider>;
}
export function useRetailSales() { return useContext(RetailSalesContext); }
