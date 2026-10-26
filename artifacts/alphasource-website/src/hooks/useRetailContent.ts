import { useRetailSales } from "@/context/RetailSalesContext";
import { neutralRetailContent, retailContentForMode } from "@/content/retailSalesContent";

export function useRetailContent<T>(original: T): T {
  const { enabled, ready } = useRetailSales();
  return ready ? retailContentForMode(original, enabled) : neutralRetailContent(original);
}
