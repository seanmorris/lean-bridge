/**
 * Scene input ownership for the React workbench.
 *
 * @file
 */

export interface Body {
	id: number; label: string; x: number; y: number; width: number; height: number;
	vx: number; vy: number;
}
export interface SceneSnapshot {
	bodies: Body[]; revision: number; axis: number; selected: number; allLinks: boolean;
	seed: string; count: number; seedEdited: boolean; seedNote: string; hint: string;
}
export interface SceneSession {
	getSnapshot(): SceneSnapshot;
	subscribe(listener: () => void): () => void;
	update(patch: Partial<SceneSnapshot>, changed?: boolean): void;
	select(id: number): void;
	move(id: number, x: number, y: number): void;
	advance(seconds: number): void;
	generate(): void;
	reset(): void;
}
export function createSceneSession(): SceneSession;
export function getBrowserSceneSession(): SceneSession;
