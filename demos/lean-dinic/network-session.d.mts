/**
 * Typed route-independent Dinic presentation state.
 *
 * @file
 */

export interface NetworkNode { id: string; name: string; x: number; y: number; }
export interface NetworkEdge { id: string; source: number; target: number; capacity: number; labelAt: number; }
export interface Network { source: number; sink: number; nodes: NetworkNode[]; edges: NetworkEdge[]; }
export interface NetworkSnapshot { network: Network; selected: string; revision: number; hasEdits: boolean; motionPaused: boolean | null; baseline?: {value: number; cut: string}; }
export interface NetworkSession {
	getSnapshot(): NetworkSnapshot;
	subscribe(listener: () => void): () => void;
	select(id: string): void;
	setCapacity(value: string | number): void;
	widen(): void;
	pauseMotion(paused: boolean): void;
	acceptBaseline(value: number, cut: string): void;
	reset(): void;
}
export function copyNetwork(network: Network): Network;
export function createNetworkSession(): NetworkSession;
export function getBrowserNetworkSession(): NetworkSession;
