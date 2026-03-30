/**
 * TanStack Query bridge — lets the Zustand store invalidate the TanStack cache
 * without importing QueryClient directly (which requires the React tree).
 */
import type { QueryClient } from "@tanstack/react-query";

let _qc: QueryClient | null = null;

export function registerQueryClient(qc: QueryClient): void {
  _qc = qc;
}

/** Invalidate all reference-bank queries (triggers background refetch). */
export function invalidateRBQueries(): void {
  _qc?.invalidateQueries({ queryKey: ["reference-bank"] });
  _qc?.invalidateQueries({ queryKey: ["shared-folders"] });
}
