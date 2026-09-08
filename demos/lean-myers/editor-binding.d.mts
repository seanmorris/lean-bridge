/**
 * Typed lifecycle contract for the native exact-text editor binding.
 *
 * @file
 */

import type { EditorSession, EditorSide } from "./editor-session.mjs";
export interface EditorBinding { sync(focus?: boolean): void; dispose(): void; }
export function attachExactEditor(options: { element: HTMLTextAreaElement; session: EditorSession; side: EditorSide; onComposition?: (active: boolean) => void }): EditorBinding;
