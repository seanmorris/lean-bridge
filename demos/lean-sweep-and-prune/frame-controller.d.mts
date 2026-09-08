/**
 * Latest-frame Lean result and lifecycle contracts.
 *
 * @file
 */

import type { SceneSnapshot } from "./scene-session.mjs";

export interface SweepAnswer { candidates: Uint32Array; overlaps: Uint32Array; }
export type PreparedSweep = (() => SweepAnswer) & { dispose(): void };
export interface SweepRuntime {
	prepareSweep(input: {boxes: Int32Array; dimensions: number; axis: number}): Promise<PreparedSweep>;
}
export interface ReadyFrame {
	status: "ready"; input: SceneSnapshot; answer: SweepAnswer; milliseconds: number;
}
export type FrameState = ReadyFrame | {status: "error"; error: unknown};
export interface FrameController {
	request(input: SceneSnapshot): void;
	suspend(): void;
	resume(): void;
	isBusy(): boolean;
	dispose(): void;
}
export function createFrameController(options: {
	loadRuntime(): Promise<SweepRuntime>; onState(state: FrameState): void; now?(): number;
}): FrameController;
