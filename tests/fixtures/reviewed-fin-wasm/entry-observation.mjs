/**
 * Per-realm observation of one installed Fin package, portable across Node, pages and workers. Console capture and
 * the frame observer start once per realm, before the package loads, so the runtime binds the recorder and the
 * observed component instance. Each measured run reports its calls, its adapter counters and, for a probe package,
 * exactly its own console.error lines, and every counter change and console line since the realm's previous run
 * or its observation began. A failed load settles the observer, restores both instantiate hooks and the console and
 * keeps the original error.
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
	const state = { mode, capture, observed, finish: () => finish?.(), counts: () => counts?.() ?? symbols.map(() => 0), failure: null };
	// Everything since observation began is accounted: the first run reports what happened before it.
	state.mark = { counts: symbols.map(() => 0), line: 0 };
	// The observer's outcome never rejects unobserved; a caller settles it explicitly.
	state.done = observed.then(value => ({ value }), error => ({ error }));
	globalThis[key] = state;
	return state;
};

/**
 * Settle a failed load: end the observer, which restores both instantiate hooks, stop the console recorder and
 * clear the realm's observation. The original error is the caller's to rethrow.
 *
 * @param error - The load's original failure.
 */
export const abortEntryObservation = async error => {
	const state = current();
	if(!state) return;
	state.failure ??= error;
	state.finish();
	await state.done;
	state.capture.stop();
	delete globalThis[key];
};

/**
 * End the realm's load observation once its package has loaded: the observer verifies the selected component
 * was instantiated once, unchanged, and restores both instantiate hooks. Counters keep counting afterwards.
 */
export const finishEntryObservation = async () => {
	const state = current();
	if(!state) throw new Error("no entry observation in this realm");
	state.finish();
	const settled = await state.done;
	if(settled.error) throw settled.error;
};

/**
 * Load a package under this realm's observation: a successful load ends the load observation, and any failure,
 * before or after the selected instantiation, settles and cleans it before the original error propagates.
 *
 * @param load - Imports the package and returns its API.
 */
export const loadUnderObservation = async load => {
	try
	{
		const api = await load();
		await finishEntryObservation();
		return api;
	}
	catch(error)
	{
		await abortEntryObservation(error);
		throw error;
	}
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
	const first = state.capture.lines.length, start = state.counts();
	// Activity between runs, such as a consumer's own calls before its corpus, is reported, never dropped.
	const before = { deltas: start.map((value, index) => value - state.mark.counts[index]), lines: state.capture.lines.slice(state.mark.line, first) };
	const controls = (request.controls ?? []).map(([name, values]) => [name, values.map(value => BigInt(value))]);
	const { result, calls } = measureCorpus(request, api, state.counts, controls);
	state.mark = { counts: state.counts(), line: state.capture.lines.length };
	// Per-call counter changes only: a rerun in the same realm reports the same run.
	return { ...result, entry: { mode: state.mode, before, calls, ...state.mode === "probe" ? { lines: state.capture.lines.slice(first) } : {} } };
};
