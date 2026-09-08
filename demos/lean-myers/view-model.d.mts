/**
 * Typed replay validation and presentation of compiled Lean edit decisions.
 *
 * @file
 */

export type ComparisonMode = "lines" | "characters";
export interface DiffAnswer { distance: number; operations: Uint32Array; usedFallback?: boolean; }
export interface TokenInput { beforeTokens: string[]; afterTokens: string[]; before: Uint32Array; after: Uint32Array; }
export interface ReplayDetails { kept: number; removed: number; added: number; beforeKinds: number[]; afterKinds: number[]; }
export interface PreviewLine { text: string; terminator: string; ending: string; segments?: { text: string; kind: number }[]; endingKinds?: number[]; }
export interface Preview { rows: { before: number | null; after: number | null; changed: boolean }[]; beforeLines: PreviewLine[]; afterLines: PreviewLine[]; }
export function replay(answer: DiffAnswer, tokens: TokenInput): ReplayDetails;
export function characterLines(lines: string[], kinds: number[]): PreviewLine[];
export function buildPreview(mode: ComparisonMode, lineInput: TokenInput, lineAnswer: DiffAnswer, details: ReplayDetails): Preview;
