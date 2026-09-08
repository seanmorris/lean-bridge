/**
 * Typed comparison results and disposable controller contracts.
 *
 * @file
 */

import type { ComparisonMode, DiffAnswer, Preview, ReplayDetails } from "./view-model.mjs";
export interface ComparisonInput { before: string; after: string; mode: ComparisonMode; }
export interface ComparisonResult { input: ComparisonInput; answer: DiffAnswer; details: ReplayDetails; milliseconds: number; preview: Preview; }
export type ComparisonState = { status: "pending"; result?: ComparisonResult } | { status: "ready"; result: ComparisonResult } | { status: "error"; error: unknown };
export type PreparedDiff = (() => DiffAnswer) & { dispose(): void };
export interface DiffRuntime { MAX_TOTAL_TOKENS: number; prepareDiff(input: { before: Uint32Array; after: Uint32Array }): Promise<PreparedDiff>; }
export interface ComparisonController { schedule(input: ComparisonInput, immediate?: boolean): void; suspend(): void; resume(): void; dispose(): void; }
export function createComparisonController(options: { loadRuntime: () => Promise<DiffRuntime>; onState: (state: ComparisonState) => void; delay?: number }): ComparisonController;
