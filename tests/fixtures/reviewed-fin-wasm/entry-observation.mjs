/**
 * Per-realm observation of one installed Fin package, portable across Node, pages and workers. Console capture and
 * the frame observer start once per realm, before the package loads, so the runtime binds the recorder and the
 * observed component instance. Each measured run reports its calls, its adapter counters and, for a probe package,
 * exactly its own console.error lines. A failed load stops the capture and restores the realm's console.
 *
 * @file
 */
import { withWasmFrameEntryObserver } from "./wasm-frame-entry-observer.mjs";
import { captureConsoleError, measureCorpus } from "./javascript-entry.mjs";

// One observation per realm, shared by every copy of this module in the realm (a Node preload and the emitted
// TypeScript output load separate copies).
const key = Symbol.for("lean-bridge.reviewed-fin-wasm-entry");
const current = () => globalThis[key] ?? null;

/**
 * Start observing this realm, synchronously: the console recorder and both instantiate hooks are installed before
 * this returns. Only one observation per realm is allowed.
 *
 * @param selection - Mode, side-module bytes and the selected adapter symbols, in counter order.
 * @param selection.mode - Mode: original or probe.
 * @param selection.moduleBytes - The installed side-module bytes the loader will instantiate.
 * @param selection.symbols - Selected adapter symbols.
 */
export const startEntryObservation = ({ mode, moduleBytes, symbols }) => {
	if(current()) throw new Error("one entry observation per realm");
	if(!["original", "probe"].includes(mode)) throw new Error("an explicit measurement mode");
	const capture = captureConsoleError();
	let finish, counts = null;
	const observed = withWasmFrameEntryObserver({ moduleBytes, symbols }, snapshot => new Promise(resolve => { counts = snapshot; finish = resolve; }));
	const state = { mode, capture, observed, finish: () => finish?.(), counts: () => counts?.() ?? [] };
	globalThis[key] = state;
	// A refused or absent load ends the observation; the console is restored and the failure is kept.
	state.done = observed.then(result => result, error => { capture.stop(); state.failure = error; throw error; });
	return state;
};

/**
 * End the realm's load observation once its package has loaded: the observer verifies the selected component
 * was instantiated once, unchanged, and restores both instantiate hooks. Counters keep counting afterwards.
 */
export const finishEntryObservation = async () => {
	const state = current();
	if(!state) throw new Error("no entry observation in this realm");
	state.finish();
	await state.done;
};

/**
 * Run the shared corpus once through the measured recorder and report this run only.
 *
 * @param request - Package name, selection, mode and the probe's control values.
 * @param api - Installed exports plus the package-internal raw call.
 */
export const measuredRun = (request, api) => {
	const state = current();
	if(!state || state.failure) throw new Error("the package was not loaded under observation");
	if(request.mode !== state.mode) throw new Error("the run's mode is not the observation's");
	const first = state.capture.lines.length;
	const controls = (request.controls ?? []).map(([name, values]) => [name, values.map(value => BigInt(value))]);
	const { result, calls } = measureCorpus(request, api, state.counts, controls);
	// Per-call counter changes only: a rerun in the same realm reports the same run.
	return { ...result, entry: { mode: state.mode, calls, ...state.mode === "probe" ? { lines: state.capture.lines.slice(first) } : {} } };
};
