/**
 * Browser lifetime contract shared by React hosts and standalone bootstraps.
 *
 * @file
 */

/** Independently disposable ownership of one workbench's resources. */
export interface WorkbenchScope {
	readonly active: boolean;
	readonly root: HTMLElement;
	remember(read: () => object): void;
	fail(error: unknown): void;
	onDispose(callback: () => void): void;
	listen(target: EventTarget, type: string, callback: (event: any) => void, options?: boolean | AddEventListenerOptions): void;
	requestAnimationFrame(callback: FrameRequestCallback): number;
	cancelAnimationFrame(id: number): void;
	setTimeout(callback: () => void, delay: number): number;
	clearTimeout(id: number): void;
	resizeObserver(callback: ResizeObserverCallback): ResizeObserver;
	benchmark(options: object): object;
	runtime<T extends object>(module: T): T;
	dispose(): void;
}

/** Create a scope without loading or instantiating any Wasm module. */
export function createWorkbenchScope(root: HTMLElement, options?: {
	remember?: (value: object) => void;
	fail?: (error: unknown) => void;
}): WorkbenchScope;
