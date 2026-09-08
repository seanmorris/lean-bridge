/**
 * Typed exact strings, selections, history, and retained editor session contracts.
 *
 * @file
 */

import type { ComparisonMode } from "./view-model.mjs";
export type EditorSide = "before" | "after";
export interface EditorSelection { start: number; end: number; direction: "forward" | "backward" | "none"; scrollTop: number; scrollLeft: number; }
export interface EditorSnapshot { before: string; after: string; mode: ComparisonMode; preset: string; revision: number; history: Record<EditorSide, { undo: boolean; redo: boolean }>; }
export interface EditorPreset { before: string; after: string; mode: string; id: string; }
export interface EditorSession {
	getSnapshot(): EditorSnapshot;
	subscribe(listener: () => void): () => void;
	getSelection(side: EditorSide): EditorSelection;
	select(side: EditorSide, selection: Partial<EditorSelection>): void;
	breakGroup(side: EditorSide): void;
	edit(side: EditorSide, source: string, options?: { beforeSelection?: Partial<EditorSelection>; afterSelection?: Partial<EditorSelection>; group?: string | null; time?: number }): void;
	undo(side: EditorSide, direction?: number): boolean;
	setMode(mode: ComparisonMode): void;
	preset(preset: EditorPreset): void;
	swap(): void;
	visible(side: EditorSide): string;
}
export function createEditorSession(preset?: EditorPreset): EditorSession;
export function getBrowserEditorSession(): EditorSession;
