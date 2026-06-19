import type { DataSource } from "./types";
import { gbfsSource } from "./gbfs";
import { syntheticSource } from "./synthetic";

/** All configured sources. The orchestrator iterates this list. */
export const SOURCES: DataSource[] = [gbfsSource, syntheticSource];

export function getSource(key: string): DataSource | undefined {
  return SOURCES.find((s) => s.key === key);
}
