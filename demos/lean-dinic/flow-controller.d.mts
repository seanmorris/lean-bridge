/**
 * Compiled flow result and disposable workbench controller contracts.
 *
 * @file
 */

import type { Network } from "./network-session.mjs";
export interface FlowAnswer { value: number; cutCapacity: number; flows: Uint32Array; sourceSide: Uint32Array; phaseCount: number; augmentationCount: number; usedFallback: boolean; }
export interface FlowRequest { vertexCount: number; source: number; sink: number; offsets: Uint32Array; targets: Uint32Array; capacities: Uint32Array; }
export interface FlowRuntime { prepareGraph(request: FlowRequest): Promise<(() => FlowAnswer) & {dispose(): void}>; }
export interface FlowResult { network: Network; answer: FlowAnswer; edgeIndex: Map<string, number>; milliseconds: number; }
export type FlowState = { status: "pending"; result?: FlowResult } | {status: "ready"; result: FlowResult} | {status: "error"; error: unknown};
export interface FlowController { schedule(network: Network, immediate?: boolean): void; suspend(): void; resume(): void; dispose(): void; }
export function createFlowController(options: {loadRuntime(): Promise<FlowRuntime>; onState(state: FlowState): void; requestFrame?: (callback: () => void) => number; cancelFrame?: (handle: number) => void}): FlowController;
